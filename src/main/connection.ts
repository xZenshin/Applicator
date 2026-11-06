import type { ClaudeStatus, ConnectionResult } from '../shared/api'
import { AppError } from '../shared/errors'
import { CLAUDE_MESSAGES, ClaudeError } from './claude/errors'
import { getAuthStatus, runClaude, type AuthStatus, type ClaudeCommand } from './claude/run'

/** Applicator only runs on the user's claude.ai subscription, never on API billing. */
export async function assertSubscriptionAuth(
  command: ClaudeCommand,
  env: NodeJS.ProcessEnv = process.env
): Promise<AuthStatus> {
  const status = await getAuthStatus(command, env)
  if (!status.loggedIn) throw new ClaudeError('not_logged_in', CLAUDE_MESSAGES.not_logged_in)
  if (status.authMethod !== 'claude.ai') {
    throw new ClaudeError(
      'not_subscription',
      `Claude Code is logged in with ${status.authMethod ?? 'an unknown method'}, not a claude.ai subscription. ` +
        'Applicator only uses your subscription — run /login in Claude Code and choose your claude.ai account.'
    )
  }
  return status
}

// Short enough for the sidebar; the detail explains.
const STATUS_LABELS: Record<string, string> = {
  not_found: 'Claude not found',
  not_logged_in: 'Not logged in',
  not_subscription: 'Not on subscription'
}

/** The sidebar's status line: is Claude Code there and logged in with claude.ai? Sends Claude no message, so it costs nothing. */
export async function claudeStatus(
  getCommand: () => Promise<ClaudeCommand>,
  env: NodeJS.ProcessEnv = process.env
): Promise<ClaudeStatus> {
  try {
    const status = await assertSubscriptionAuth(await getCommand(), env)
    return { ok: true, label: 'Claude connected', detail: `Logged in via claude.ai (${status.subscriptionType ?? 'subscription'}).` }
  } catch (e) {
    if (e instanceof AppError) return { ok: false, label: STATUS_LABELS[e.kind] ?? 'Claude unavailable', detail: e.message }
    throw e
  }
}

const REPLY_SCHEMA = {
  type: 'object',
  properties: { reply: { type: 'string' } },
  required: ['reply'],
  additionalProperties: false
}

export async function testConnection(a: {
  command: ClaudeCommand
  cwd: string
  model: string
  env?: NodeJS.ProcessEnv
}): Promise<ConnectionResult> {
  try {
    const status = await assertSubscriptionAuth(a.command, a.env)
    const started = Date.now()
    await runClaude({
      command: a.command,
      systemPrompt: 'You are a connectivity check. Answer as briefly as possible.',
      input: 'Reply with OK.',
      jsonSchema: REPLY_SCHEMA,
      model: a.model,
      cwd: a.cwd,
      env: a.env,
      timeoutMs: 120_000
    })
    const seconds = ((Date.now() - started) / 1000).toFixed(1)
    return {
      ok: true,
      message: `Connected via claude.ai (${status.subscriptionType ?? 'subscription'}). Claude replied in ${seconds} s.`
    }
  } catch (e) {
    if (e instanceof AppError) return { ok: false, message: e.message }
    throw e
  }
}
