import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { CLAUDE_MESSAGES, ClaudeError, classifyResultError } from './errors'

/** How to start the CLI. Real use: `{ file: 'C:\\…\\claude.exe', prefixArgs: [] }`. */
export interface ClaudeCommand {
  file: string
  prefixArgs: string[]
}

export interface ClaudeRunRequest {
  command: ClaudeCommand
  systemPrompt: string
  /** All dynamic content goes here; it is written to stdin, never put on the command line. */
  input: string
  jsonSchema: object
  /** '' = the CLI's default model. */
  model: string
  /** An empty directory, so no project CLAUDE.md or settings are picked up. */
  cwd: string
  timeoutMs?: number
  signal?: AbortSignal
  env?: NodeJS.ProcessEnv
}

export interface AuthStatus {
  loggedIn: boolean
  authMethod?: string
  subscriptionType?: string
}

const DEFAULT_TIMEOUT_MS = 300_000
// Either of these would make the CLI bill the API instead of the user's subscription.
const STRIPPED_ENV = new Set(['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN'])

function childEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return Object.fromEntries(Object.entries(env).filter(([k]) => !STRIPPED_ENV.has(k.toUpperCase())))
}

/** The flags every print-mode call shares; formatArgs chooses the input and output format. */
function printArgs(formatArgs: string[], systemPromptFile: string, model: string): string[] {
  const args = [
    '-p',
    ...formatArgs,
    '--system-prompt-file',
    systemPromptFile,
    '--safe-mode',
    '--tools',
    '',
    '--no-session-persistence'
  ]
  return model ? [...args, '--model', model] : args
}

export function buildClaudeArgs(jsonSchema: object, systemPromptFile: string, model: string): string[] {
  return printArgs(['--output-format', 'json', '--json-schema', JSON.stringify(jsonSchema)], systemPromptFile, model)
}

/** stream-json input is the only way to hand the CLI a PDF; it requires stream-json output. */
export function buildChatArgs(systemPromptFile: string, model: string): string[] {
  return printArgs(['--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose'], systemPromptFile, model)
}

interface ProcessResult {
  code: number | null
  stdout: string
  stderr: string
}

function exec(
  command: ClaudeCommand,
  args: string[],
  opts: { cwd?: string; env: NodeJS.ProcessEnv; input?: string; timeoutMs: number; signal?: AbortSignal }
): Promise<ProcessResult> {
  return new Promise((resolve, reject) => {
    if (opts.signal?.aborted) return reject(new ClaudeError('cancelled', CLAUDE_MESSAGES.cancelled))

    const child = spawn(command.file, [...command.prefixArgs, ...args], {
      cwd: opts.cwd,
      env: opts.env,
      windowsHide: true,
      shell: false
    })
    const out: Buffer[] = []
    const err: Buffer[] = []
    let settled = false

    const finish = (settle: () => void): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      opts.signal?.removeEventListener('abort', onAbort)
      settle()
    }
    const timer = setTimeout(() => {
      child.kill()
      finish(() => reject(new ClaudeError('timeout', CLAUDE_MESSAGES.timeout)))
    }, opts.timeoutMs)
    const onAbort = (): void => {
      child.kill()
      finish(() => reject(new ClaudeError('cancelled', CLAUDE_MESSAGES.cancelled)))
    }
    opts.signal?.addEventListener('abort', onAbort, { once: true })

    child.on('error', (e: NodeJS.ErrnoException) =>
      finish(() =>
        reject(
          e.code === 'ENOENT'
            ? new ClaudeError('not_found', CLAUDE_MESSAGES.not_found)
            : new ClaudeError('process_failed', `Could not start Claude Code: ${e.message}`)
        )
      )
    )
    child.stdout.on('data', (c: Buffer) => out.push(c))
    child.stderr.on('data', (c: Buffer) => err.push(c))
    child.on('close', (code) =>
      finish(() =>
        resolve({
          code,
          stdout: Buffer.concat(out).toString('utf8'),
          stderr: Buffer.concat(err).toString('utf8')
        })
      )
    )
    child.stdin.on('error', () => {}) // the child may exit before reading stdin; the close handler reports it
    child.stdin.end(opts.input ?? '', 'utf8')
  })
}

function parseJsonOutput(stdout: string): Record<string, unknown> | null {
  const attempts = [stdout, ...stdout.split(/\r?\n/).filter((l) => l.trim().startsWith('{')).reverse()]
  for (const text of attempts) {
    try {
      const value = JSON.parse(text)
      if (value && typeof value === 'object') return value
    } catch {
      // try the next candidate
    }
  }
  return null
}

function interpret(res: ProcessResult): unknown {
  const parsed = parseJsonOutput(res.stdout)
  if (!parsed) {
    const detail = (res.stderr.trim() || res.stdout.trim()).slice(-500)
    throw new ClaudeError('process_failed', `Claude Code exited with code ${res.code}: ${detail}`)
  }
  if (parsed.is_error) {
    throw classifyResultError(parsed as { result?: string; api_error_status?: number | null })
  }
  if (parsed.structured_output !== undefined && parsed.structured_output !== null) {
    return parsed.structured_output
  }
  if (typeof parsed.result === 'string') {
    try {
      return JSON.parse(parsed.result)
    } catch {
      // fall through
    }
  }
  throw new ClaudeError('invalid_output', CLAUDE_MESSAGES.invalid_output)
}

type PrintRequest = Pick<ClaudeRunRequest, 'command' | 'systemPrompt' | 'model' | 'cwd' | 'timeoutMs' | 'signal' | 'env'>

/** One print-mode run: the system prompt goes in a temporary file (removed afterwards), the input on stdin. */
async function runPrint<T>(
  req: PrintRequest,
  args: (systemPromptFile: string) => string[],
  input: string,
  read: (res: ProcessResult) => T
): Promise<T> {
  await mkdir(req.cwd, { recursive: true })
  const systemPromptFile = join(tmpdir(), `applicator-sys-${randomBytes(6).toString('hex')}.txt`)
  await writeFile(systemPromptFile, req.systemPrompt, 'utf8')
  try {
    const res = await exec(req.command, args(systemPromptFile), {
      cwd: req.cwd,
      env: childEnv(req.env ?? process.env),
      input,
      timeoutMs: req.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      signal: req.signal
    })
    return read(res)
  } finally {
    await rm(systemPromptFile, { force: true }).catch(() => {})
  }
}

/** Runs one print-mode request and returns the CLI's structured output (not yet validated). */
export function runClaude(req: ClaudeRunRequest): Promise<unknown> {
  return runPrint(req, (file) => buildClaudeArgs(req.jsonSchema, file, req.model), req.input, interpret)
}

/** A piece of a chat message: text, or a PDF Claude reads itself (scanned pages included). */
export type ChatContent =
  | { type: 'text'; text: string }
  | { type: 'pdf'; name: string; base64: string }

export interface ClaudeChatRequest {
  command: ClaudeCommand
  systemPrompt: string
  /** Sent as one user message on stdin. */
  content: ChatContent[]
  model: string
  cwd: string
  timeoutMs?: number
  signal?: AbortSignal
  env?: NodeJS.ProcessEnv
}

/** The stdin line: one user message in the Messages API format. */
export function chatInputLine(content: ChatContent[]): string {
  const blocks = content.map((c) =>
    c.type === 'text'
      ? { type: 'text', text: c.text }
      : { type: 'document', title: c.name, source: { type: 'base64', media_type: 'application/pdf', data: c.base64 } }
  )
  return JSON.stringify({ type: 'user', message: { role: 'user', content: blocks } }) + '\n'
}

/** stream-json prints one JSON object per line; the answer is in the last one, of type "result". */
function interpretChat(res: ProcessResult): string {
  let result: Record<string, unknown> | null = null
  for (const line of res.stdout.split(/\r?\n/).reverse()) {
    if (!line.trim().startsWith('{')) continue
    try {
      const value = JSON.parse(line)
      if (value?.type === 'result') {
        result = value
        break
      }
    } catch {
      // not a complete JSON line
    }
  }
  if (!result) {
    const detail = (res.stderr.trim() || res.stdout.trim()).slice(-500)
    throw new ClaudeError('process_failed', `Claude Code exited with code ${res.code}: ${detail}`)
  }
  if (result.is_error) {
    throw classifyResultError(result as { result?: string; api_error_status?: number | null })
  }
  if (typeof result.result === 'string' && result.result.trim()) return result.result.trim()
  throw new ClaudeError('invalid_output', CLAUDE_MESSAGES.invalid_output)
}

/** Runs one print-mode request and returns Claude's reply as plain text. */
export function runClaudeChat(req: ClaudeChatRequest): Promise<string> {
  return runPrint(req, (file) => buildChatArgs(file, req.model), chatInputLine(req.content), interpretChat)
}

export async function getAuthStatus(
  command: ClaudeCommand,
  env: NodeJS.ProcessEnv = process.env
): Promise<AuthStatus> {
  const res = await exec(command, ['auth', 'status'], { env: childEnv(env), timeoutMs: 30_000 })
  const parsed = parseJsonOutput(res.stdout)
  if (!parsed) {
    const detail = (res.stderr.trim() || res.stdout.trim()).slice(-300)
    throw new ClaudeError('process_failed', `Could not read Claude Code's login status: ${detail}`)
  }
  return {
    loggedIn: Boolean(parsed.loggedIn),
    authMethod: typeof parsed.authMethod === 'string' ? parsed.authMethod : undefined,
    subscriptionType: typeof parsed.subscriptionType === 'string' ? parsed.subscriptionType : undefined
  }
}
