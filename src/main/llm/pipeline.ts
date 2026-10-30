import type { GenerationStage } from '../../shared/api'
import { overflowLines } from '../../shared/templates/page-fit'
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
  fitOnePageInstruction,
  type CvOnlyContext
} from './prompts'
import type { RunFn } from './run-fn'
import { normalizeLanguage, sanitizeCv } from './sanitize'
import { TailorOutputSchema } from './schemas'

/** Renders the CV as it will be printed and returns its height in pixels at 96 dpi. */
export type MeasureCv = (profile: Profile, cv: CvContent, language: string) => Promise<number>

const MAX_FIT_ATTEMPTS = 2

/** While the rendered CV runs past one page, asks Claude to shorten it, at most twice; warns if it still does. */
async function fitOnePage(a: {
  run: RunFn
  profile: Profile
  jobDescription: string
  job: JobInfo
  cv: CvContent
  instructions: string
  cvOnly?: CvOnlyContext
  measureCv: MeasureCv
  onStage: (s: GenerationStage) => void
}): Promise<{ cv: CvContent; warnings: string[] }> {
  let cv = a.cv
  const warnings: string[] = []
  for (let attempt = 0; ; attempt++) {
    const over = overflowLines(await a.measureCv(a.profile, cv, a.job.language))
    if (over === 0) return { cv, warnings }
    if (attempt === MAX_FIT_ATTEMPTS) {
      const lines = `${over} line${over === 1 ? '' : 's'}`
      warnings.push(`The CV is still about ${lines} longer than one page. Untick some items, or ask Claude to shorten it.`)
      return { cv, warnings }
    }
    a.onStage('fitting')
    const revised = await reviseCv({ ...a, cv, instruction: fitOnePageInstruction(over, Boolean(a.cvOnly)) })
    cv = revised.cv
    warnings.push(...revised.warnings)
  }
}

/**
 * With cvOnly, the CV gets a motivated summary in place of a letter, and no letter is written.
 * With measureCv, a CV that runs past one page is shortened before the letter is written from it.
 */
export async function generateApplication(a: {
  run: RunFn
  profile: Profile
  style: Style
  jobDescription: string
  instructions: string
  ownText?: string
  cvOnly?: boolean
  measureCv?: MeasureCv
  onStage: (s: GenerationStage) => void
}): Promise<{ job: JobInfo; cv: CvContent; letter: ApplicationLetter | null; warnings: string[] }> {
  a.onStage('tailoring')
  const cvOnly = a.cvOnly ? { style: a.style, ownText: a.ownText } : undefined
  const tailored = await a.run({
    system: a.cvOnly ? CV_ONLY_TAILOR_SYSTEM : TAILOR_SYSTEM,
    input: buildTailorInput({ ...a, cvOnly }),
    schema: TailorOutputSchema
  })
  const sanitized = sanitizeCv(a.profile, tailored.cv)
  const warnings = sanitized.warnings
  const language = normalizeLanguage(tailored.job.language)
  if (language.warning) warnings.push(language.warning)
  const job = { ...tailored.job, language: language.language }

  let cv = sanitized.cv
  if (a.measureCv) {
    const fitted = await fitOnePage({ ...a, job, cv, cvOnly, measureCv: a.measureCv })
    cv = fitted.cv
    warnings.push(...fitted.warnings)
  }
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
