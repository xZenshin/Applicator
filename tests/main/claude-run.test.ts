import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ClaudeError } from '../../src/main/claude/errors'
import { buildClaudeArgs, getAuthStatus, runClaude, type ClaudeCommand } from '../../src/main/claude/run'

const FAKE = resolve(__dirname, '../fixtures/fake-claude.mjs')
const command: ClaudeCommand = { file: process.execPath, prefixArgs: [FAKE] }
const cwd = join(tmpdir(), 'applicator-claude-workdir-test')
const schema = { type: 'object', properties: { echo: { type: 'string' } } }

function run(fakeEnv: Record<string, string>, extra: Partial<Parameters<typeof runClaude>[0]> = {}) {
  return runClaude({
    command,
    systemPrompt: 'You are a test.',
    input: 'hello',
    jsonSchema: schema,
    model: '',
    cwd,
    env: { ...process.env, ...fakeEnv },
    ...extra
  })
}

async function failure(p: Promise<unknown>): Promise<ClaudeError> {
  const e = await p.then(
    () => null,
    (err) => err
  )
  expect(e).toBeInstanceOf(ClaudeError)
  return e as ClaudeError
}

describe('buildClaudeArgs', () => {
  it('builds the exact print-mode invocation', () => {
    expect(buildClaudeArgs(schema, 'C:\\tmp\\sys.txt', '')).toEqual([
      '-p',
      '--output-format',
      'json',
      '--json-schema',
      JSON.stringify(schema),
      '--system-prompt-file',
      'C:\\tmp\\sys.txt',
      '--safe-mode',
      '--tools',
      '',
      '--no-session-persistence'
    ])
  })

  it('appends --model only when a model is set', () => {
    expect(buildClaudeArgs(schema, 'f', 'opus').slice(-2)).toEqual(['--model', 'opus'])
  })
})

describe('runClaude', () => {
  it('returns structured_output', async () => {
    expect(await run({ FAKE_CLAUDE_MODE: 'ok', FAKE_CLAUDE_OUTPUT: '{"echo":"hi"}' })).toEqual({ echo: 'hi' })
  })

  it('falls back to parsing result', async () => {
    expect(await run({ FAKE_CLAUDE_MODE: 'result-only', FAKE_CLAUDE_OUTPUT: '{"echo":"from result"}' })).toEqual({
      echo: 'from result'
    })
  })

  it('reports invalid_output when result is not JSON either', async () => {
    const e = await failure(run({ FAKE_CLAUDE_MODE: 'result-only', FAKE_CLAUDE_OUTPUT: 'plain words' }))
    expect(e.kind).toBe('invalid_output')
  })

  it('passes a 200 KB stdin payload intact', async () => {
    const input = 'Søg jobbet hos Ærø Øl – vi glæder os! '.repeat(5300)
    expect(input.length).toBeGreaterThan(200_000)
    const out = (await run({ FAKE_CLAUDE_MODE: 'echo' }, { input })) as { stdin: string }
    expect(out.stdin).toBe(input)
  })

  it('passes the system prompt via file and deletes the file afterwards', async () => {
    const out = (await run({ FAKE_CLAUDE_MODE: 'echo' }, { systemPrompt: 'Skriv på dansk.' })) as {
      systemPrompt: string
      systemPromptFile: string
      args: string[]
    }
    expect(out.systemPrompt).toBe('Skriv på dansk.')
    expect(out.args).toContain('--safe-mode')
    expect(existsSync(out.systemPromptFile)).toBe(false)
  })

  it('strips ANTHROPIC_API_KEY and ANTHROPIC_AUTH_TOKEN', async () => {
    const out = (await run({
      FAKE_CLAUDE_MODE: 'echo',
      ANTHROPIC_API_KEY: 'sk-test',
      ANTHROPIC_AUTH_TOKEN: 'token'
    })) as { apiKey: string | null; authToken: string | null }
    expect(out).toMatchObject({ apiKey: null, authToken: null })
  })

  it('classifies 401 as not_logged_in', async () => {
    const e = await failure(run({ FAKE_CLAUDE_MODE: 'error', FAKE_CLAUDE_STATUS: '401', FAKE_CLAUDE_MESSAGE: 'Invalid API key · Please run /login' }))
    expect(e.kind).toBe('not_logged_in')
    expect(e.message).toContain('/login')
  })

  it('classifies 429 as usage_limit', async () => {
    const e = await failure(run({ FAKE_CLAUDE_MODE: 'error', FAKE_CLAUDE_STATUS: '429', FAKE_CLAUDE_MESSAGE: 'Claude AI usage limit reached' }))
    expect(e.kind).toBe('usage_limit')
    expect(e.message).toContain('Claude AI usage limit reached')
  })

  it('classifies other is_error as api_error with the CLI message', async () => {
    const msg = "There's an issue with the selected model (x)."
    const e = await failure(run({ FAKE_CLAUDE_MODE: 'error', FAKE_CLAUDE_STATUS: '404', FAKE_CLAUDE_MESSAGE: msg }))
    expect(e.kind).toBe('api_error')
    expect(e.message).toBe(msg)
  })

  it('crash → process_failed including stderr', async () => {
    const e = await failure(run({ FAKE_CLAUDE_MODE: 'crash' }))
    expect(e.kind).toBe('process_failed')
    expect(e.message).toContain('boom')
  })

  it('hang + timeoutMs → timeout', async () => {
    const e = await failure(run({ FAKE_CLAUDE_MODE: 'hang' }, { timeoutMs: 300 }))
    expect(e.kind).toBe('timeout')
  })

  it('abort → cancelled', async () => {
    const ac = new AbortController()
    setTimeout(() => ac.abort(), 200)
    const e = await failure(run({ FAKE_CLAUDE_MODE: 'hang' }, { signal: ac.signal }))
    expect(e.kind).toBe('cancelled')
  })

  it('missing executable → not_found', async () => {
    const e = await failure(run({}, { command: { file: 'C:\\definitely\\missing\\claude.exe', prefixArgs: [] } }))
    expect(e.kind).toBe('not_found')
  })
})

describe('getAuthStatus', () => {
  it('parses auth status JSON', async () => {
    expect(await getAuthStatus(command, process.env)).toMatchObject({
      loggedIn: true,
      authMethod: 'claude.ai',
      subscriptionType: 'pro'
    })
  })
})
