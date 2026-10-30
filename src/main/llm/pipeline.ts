import type { GenerationStage } from '../../shared/api'
import {
  ApplicationLetterSchema,
  CvContentSchema,
  type ApplicationLetter,
  type CvContent,
  type Highlight,
  type JobInfo,
  type Profile,
  type Style
} from '../../shared/types'
import {
  CV_ONLY_REVISE_SYSTEM,
  CV_ONLY_TAILOR_SYSTEM,
  CV_REVISE_SYSTEM,
  LETTER_REVISE_SYSTEM,
  LETTER_SYSTEM,
  TAILOR_SYSTEM,
  buildCvReviseInput,
  buildLetterInput,
  buildLetterReviseInput,
  buildTailorInput,
  type CvOnlyContext
} from './prompts'
import type { RunFn } from './run-fn'
import { normalizeLanguage, sanitizeCv } from './sanitize'
import { TailorOutputSchema } from './schemas'

/** With cvOnly, the CV gets a motivated summary in place of a letter, and no letter is written. */
export async function generateApplication(a: {
  run: RunFn
  profile: Profile
  style: Style
  jobDescription: string
  instructions: string
  ownText?: string
  cvOnly?: boolean
  onStage: (s: GenerationStage) => void
}): Promise<{ job: JobInfo; cv: CvContent; letter: ApplicationLetter | null; warnings: string[] }> {
  a.onStage('tailoring')
  const tailored = await a.run({
    system: a.cvOnly ? CV_ONLY_TAILOR_SYSTEM : TAILOR_SYSTEM,
    input: buildTailorInput({ ...a, cvOnly: a.cvOnly ? { style: a.style, ownText: a.ownText } : undefined }),
    schema: TailorOutputSchema
  })
  const { cv, warnings } = sanitizeCv(a.profile, tailored.cv)
  const language = normalizeLanguage(tailored.job.language)
  if (language.warning) warnings.push(language.warning)
  const job = { ...tailored.job, language: language.language }
  if (a.cvOnly) return { job, cv, letter: null, warnings }

  a.onStage('writing')
  const letter = await a.run({
    system: LETTER_SYSTEM,
    input: buildLetterInput({ ...a, job, cv }),
    schema: ApplicationLetterSchema
  })
  return { job, cv, letter, warnings }
}

/** The prompt marks a highlighted passage with ⟦ ⟧; Claude is told not to copy them, but if it does they must not reach the documents. */
function withoutHighlightMarks<T>(value: T): T {
  return JSON.parse(JSON.stringify(value).replace(/[⟦⟧]/g, ''))
}

export async function reviseCv(a: {
  run: RunFn
  profile: Profile
  jobDescription: string
  job: JobInfo
  cv: CvContent
  instruction: string
  instructions?: string
  cvOnly?: CvOnlyContext
  highlight?: Highlight
}): Promise<{ cv: CvContent; warnings: string[] }> {
  const system = a.cvOnly ? CV_ONLY_REVISE_SYSTEM : CV_REVISE_SYSTEM
  const revised = await a.run({ system, input: buildCvReviseInput(a), schema: CvContentSchema })
  return sanitizeCv(a.profile, withoutHighlightMarks(revised))
}

export async function reviseLetter(a: {
  run: RunFn
  profile: Profile
  style: Style
  jobDescription: string
  job: JobInfo
  cv: CvContent
  letter: ApplicationLetter
  instruction: string
  instructions?: string
  ownText?: string
  highlight?: Highlight
}): Promise<ApplicationLetter> {
  const revised = await a.run({ system: LETTER_REVISE_SYSTEM, input: buildLetterReviseInput(a), schema: ApplicationLetterSchema })
  return withoutHighlightMarks(revised)
}
