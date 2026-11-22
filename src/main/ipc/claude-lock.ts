import { BrowserWindow } from 'electron'
import { BUSY_CHANNEL } from '../../shared/api'
import { AppError } from '../../shared/errors'
import { CLAUDE_MESSAGES, ClaudeError } from '../claude/errors'
import { assertSubscriptionAuth } from '../connection'
import { requireClaudeCommand } from '../context'

let current: AbortController | null = null
let subscriptionVerified = false

export function broadcast(channel: string, value: unknown): void {
  for (const window of BrowserWindow.getAllWindows()) window.webContents.send(channel, value)
}

/** Runs one Claude operation at a time, across the whole app; cancelClaude() stops it. */
export async function withClaude<T>(fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
  if (current) {
    throw new AppError('busy', 'Claude is already working on something. Wait or cancel it first.')
  }
  const controller = new AbortController()
  current = controller
  broadcast(BUSY_CHANNEL, true)
  try {
    if (!subscriptionVerified) {
      await assertSubscriptionAuth(await requireClaudeCommand())
      subscriptionVerified = true
    }
    if (controller.signal.aborted) throw new ClaudeError('cancelled', CLAUDE_MESSAGES.cancelled)
    return await fn(controller.signal)
  } finally {
    if (current === controller) current = null
    broadcast(BUSY_CHANNEL, false)
  }
}

export function cancelClaude(): void {
  current?.abort()
}
