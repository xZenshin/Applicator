import { BrowserWindow } from 'electron'
import { PROGRESS_CHANNEL, type GenerationStage } from '../../shared/api'
import { AppError } from '../../shared/errors'
import type { ApplicationLetter, CvContent, Highlight } from '../../shared/types'
import { CLAUDE_MESSAGES, ClaudeError } from '../claude/errors'
import { assertSubscriptionAuth } from '../connection'
import { getDataDir, makeAppRunFn, requireClaudeCommand } from '../context'
import { runCvRevision, runGeneration, runLetterRevision } from '../generation'
import type { RunFn } from '../llm/run-fn'
import { handle } from './handle'

let current: AbortController | null = null
let subscriptionVerified = false

/** Runs one LLM operation at a time, cancellable via llm:cancel. */
async function withClaude<T>(fn: (run: RunFn) => Promise<T>): Promise<T> {
  if (current) {
    throw new AppError('busy', 'Claude is already working on something. Wait or cancel it first.')
  }
  const controller = new AbortController()
  current = controller
  try {
    if (!subscriptionVerified) {
      await assertSubscriptionAuth(await requireClaudeCommand())
      subscriptionVerified = true
    }
    if (controller.signal.aborted) throw new ClaudeError('cancelled', CLAUDE_MESSAGES.cancelled)
    return await fn(await makeAppRunFn(controller.signal))
  } finally {
    if (current === controller) current = null
  }
}

function broadcastStage(stage: GenerationStage): void {
  for (const window of BrowserWindow.getAllWindows()) window.webContents.send(PROGRESS_CHANNEL, stage)
}

export function registerLlmIpc(): void {
  handle('llm:generate', (input: { jobDescription: string; instructions: string; ownText?: string; cvOnly?: boolean }) =>
    withClaude(async (run) =>
      runGeneration({
        run,
        dataDir: await getDataDir(),
        jobDescription: String(input.jobDescription ?? ''),
        instructions: String(input.instructions ?? ''),
        ownText: String(input.ownText ?? ''),
        cvOnly: input.cvOnly === true,
        onStage: broadcastStage,
        now: new Date()
      })
    )
  )

  handle('llm:reviseCv', (input: { id: string; cv: CvContent; instruction: string; highlight?: Highlight }) =>
    withClaude(async (run) => runCvRevision({ run, dataDir: await getDataDir(), ...input }))
  )

  handle(
    'llm:reviseLetter',
    (input: { id: string; cv: CvContent; letter: ApplicationLetter; instruction: string; highlight?: Highlight }) =>
      withClaude(async (run) => runLetterRevision({ run, dataDir: await getDataDir(), ...input }))
  )

  handle('llm:cancel', async () => {
    current?.abort()
  })
}
