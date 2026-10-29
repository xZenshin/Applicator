import type { GenerationStage } from '../../shared/api'
import {
  ApplicationLetterSchema,
  CvContentSchema,
  type ApplicationLetter,
  type CvContent,
  type JobInfo,
  type Profile,
  type Style
} from '../../shared/types'
import {
  CV_REVISE_SYSTEM,
  LETTER_REVISE_SYSTEM,
  LETTER_SYSTEM,
  TAILOR_SYSTEM,
  buildCvReviseInput,
  buildLetterInput,
  buildLetterReviseInput,
  buildTailorInput
} from './prompts'
import type { RunFn } from './run-fn'
import { normalizeLanguage, sanitizeCv } from './sanitize'
import { TailorOutputSchema } from './schemas'

export async function generateApplication(a: {
  run: RunFn
  profile: Profile
  style: Style
  jobDescription: string
  instructions: string
  onStage: (s: GenerationStage) => void
}): Promise<{ job: JobInfo; cv: CvContent; letter: ApplicationLetter; warnings: string[] }> {
  a.onStage('tailoring')
  const tailored = await a.run({ system: TAILOR_SYSTEM, input: buildTailorInput(a), schema: TailorOutputSchema })
  const { cv, warnings } = sanitizeCv(a.profile, tailored.cv)
  const language = normalizeLanguage(tailored.job.language)
  if (language.warning) warnings.push(language.warning)
  const job = { ...tailored.job, language: language.language }

  a.onStage('writing')
  const letter = await a.run({
    system: LETTER_SYSTEM,
    input: buildLetterInput({ ...a, job, cv }),
    schema: ApplicationLetterSchema
  })
  return { job, cv, letter, warnings }
}

export async function reviseCv(a: {
  run: RunFn
  profile: Profile
  jobDescription: string
  job: JobInfo
  cv: CvContent
  instruction: string
  instructions?: string
}): Promise<{ cv: CvContent; warnings: string[] }> {
  const revised = await a.run({ system: CV_REVISE_SYSTEM, input: buildCvReviseInput(a), schema: CvContentSchema })
  return sanitizeCv(a.profile, revised)
}

export function reviseLetter(a: {
  run: RunFn
  profile: Profile
  style: Style
  jobDescription: string
  job: JobInfo
  cv: CvContent
  letter: ApplicationLetter
  instruction: string
  instructions?: string
}): Promise<ApplicationLetter> {
  return a.run({ system: LETTER_REVISE_SYSTEM, input: buildLetterReviseInput(a), schema: ApplicationLetterSchema })
}
