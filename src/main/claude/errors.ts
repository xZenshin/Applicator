import { AppError } from '../../shared/errors'

export type ClaudeErrorKind =
  | 'not_found'
  | 'not_logged_in'
  | 'not_subscription'
  | 'usage_limit'
  | 'api_error'
  | 'invalid_output'
  | 'timeout'
  | 'cancelled'
  | 'process_failed'

export class ClaudeError extends AppError {
  declare readonly kind: ClaudeErrorKind

  constructor(kind: ClaudeErrorKind, message: string) {
    super(kind, message)
    this.name = 'ClaudeError'
  }
}

export const CLAUDE_MESSAGES = {
  not_found: 'Claude Code CLI was not found. Install it (see README) or set its path in Settings.',
  not_logged_in: 'Claude Code is not logged in. Open a terminal, run `claude`, and log in with /login.',
  invalid_output: 'Claude returned an answer in an unexpected format. Please try again.',
  timeout: 'Claude did not answer within 5 minutes.',
  cancelled: 'Cancelled.'
} as const

/** Maps a CLI result with `is_error: true` to a ClaudeError the user can act on. */
export function classifyResultError(r: {
  result?: string
  api_error_status?: number | null
}): ClaudeError {
  const text = r.result?.trim() || 'Claude Code reported an error.'
  const status = r.api_error_status ?? null
  if (status === 401 || /log ?in|\/login|not logged|invalid api key|authenticat/i.test(text)) {
    return new ClaudeError('not_logged_in', CLAUDE_MESSAGES.not_logged_in)
  }
  if (status === 429 || /usage limit|rate limit|limit reached/i.test(text)) {
    return new ClaudeError('usage_limit', `Your Claude usage limit has been reached. Try again later. (CLI: ${text})`)
  }
  return new ClaudeError('api_error', text)
}
