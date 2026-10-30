import type { GenerationStage } from '../shared/api'
import { AppError } from '../shared/errors'
import { isProfileUsable } from '../shared/profile-checks'
import type { ApplicationLetter, ApplicationMeta, CvContent, Highlight } from '../shared/types'
import { generateApplication, reviseCv, reviseLetter, type MeasureCv } from './llm/pipeline'
import type { RunFn } from './llm/run-fn'
import { createApplication, loadApplication } from './storage/applications'
import { loadProfile } from './storage/profile'
import { loadStyle } from './storage/style'

const MIN_JOB_DESCRIPTION_CHARS = 50

/** Generates a CV + letter (or, with cvOnly, just the CV) and saves them as a new application. Nothing is written unless every call succeeds. */
export async function runGeneration(a: {
  run: RunFn
  dataDir: string
  jobDescription: string
  instructions: string
  ownText?: string
  cvOnly?: boolean
  measureCv?: MeasureCv
  onStage: (s: GenerationStage) => void
  now: Date
}): Promise<ApplicationMeta> {
  const profile = await loadProfile(a.dataDir)
  const style = await loadStyle(a.dataDir)
  if (!isProfileUsable(profile)) {
    throw new AppError(
      'profile_empty',
      'Add your name and at least one experience, education or skill on the My CV page first.'
    )
  }
  if (a.jobDescription.trim().length < MIN_JOB_DESCRIPTION_CHARS) {
    throw new AppError('job_too_short', 'The job description looks too short — paste the full posting.')
  }

  const { job, cv, letter, warnings } = await generateApplication({
    run: a.run,
    profile,
    style,
    jobDescription: a.jobDescription,
    instructions: a.instructions,
    ownText: a.ownText,
    cvOnly: a.cvOnly,
    measureCv: a.measureCv,
    onStage: a.onStage
  })
  return createApplication(a.dataDir, {
    jobDescription: a.jobDescription,
    draft: { version: 1, instructions: a.instructions, ownText: a.ownText ?? '', job, cv, letter, untranslatedIds: [], warnings },
    profile,
    now: a.now
  })
}

/** Revisions use the profile snapshot taken at generation time; the renderer applies and saves the result. */
export async function runCvRevision(a: {
  run: RunFn
  dataDir: string
  id: string
  cv: CvContent
  instruction: string
  highlight?: Highlight
}): Promise<{ cv: CvContent; warnings: string[] }> {
  const record = await loadApplication(a.dataDir, a.id)
  const cvOnly = record.draft.letter === null ? { style: await loadStyle(a.dataDir), ownText: record.draft.ownText } : undefined
  return reviseCv({
    run: a.run,
    profile: record.profile,
    jobDescription: record.jobDescription,
    job: record.draft.job,
    cv: a.cv,
    instruction: a.instruction,
    instructions: record.draft.instructions,
    cvOnly,
    highlight: a.highlight
  })
}

export async function runLetterRevision(a: {
  run: RunFn
  dataDir: string
  id: string
  cv: CvContent
  letter: ApplicationLetter
  instruction: string
  highlight?: Highlight
}): Promise<ApplicationLetter> {
  const record = await loadApplication(a.dataDir, a.id)
  return reviseLetter({
    run: a.run,
    profile: record.profile,
    style: await loadStyle(a.dataDir),
    jobDescription: record.jobDescription,
    job: record.draft.job,
    cv: a.cv,
    letter: a.letter,
    instruction: a.instruction,
    instructions: record.draft.instructions,
    ownText: record.draft.ownText,
    highlight: a.highlight
  })
}
