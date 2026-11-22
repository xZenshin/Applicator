import { PROGRESS_CHANNEL, type GenerationStage } from '../../shared/api'
import type { ApplicationLetter, CvContent, Highlight } from '../../shared/types'
import { getDataDir, makeAppRunFn } from '../context'
import { runCvRevision, runGeneration, runLetterRevision } from '../generation'
import type { RunFn } from '../llm/run-fn'
import { measureCvHeight } from '../pdf/measure'
import { broadcast, cancelClaude, withClaude } from './claude-lock'
import { handle } from './handle'

const withRun = <T>(fn: (run: RunFn) => Promise<T>): Promise<T> =>
  withClaude(async (signal) => fn(await makeAppRunFn(signal)))

const broadcastStage = (stage: GenerationStage): void => broadcast(PROGRESS_CHANNEL, stage)

export function registerLlmIpc(): void {
  handle('llm:generate', (input: { jobDescription: string; instructions: string; ownText?: string; cvOnly?: boolean }) =>
    withRun(async (run) =>
      runGeneration({
        run,
        dataDir: await getDataDir(),
        jobDescription: String(input.jobDescription ?? ''),
        instructions: String(input.instructions ?? ''),
        ownText: String(input.ownText ?? ''),
        cvOnly: input.cvOnly === true,
        measureCv: measureCvHeight,
        onStage: broadcastStage,
        now: new Date()
      })
    )
  )

  handle('llm:reviseCv', (input: { id: string; cv: CvContent; instruction: string; highlight?: Highlight }) =>
    withRun(async (run) => runCvRevision({ run, dataDir: await getDataDir(), ...input }))
  )

  handle(
    'llm:reviseLetter',
    (input: { id: string; cv: CvContent; letter: ApplicationLetter; instruction: string; highlight?: Highlight }) =>
      withRun(async (run) => runLetterRevision({ run, dataDir: await getDataDir(), ...input }))
  )

  handle('llm:cancel', async () => cancelClaude())
}
