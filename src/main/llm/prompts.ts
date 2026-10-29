import { countWords } from '../../shared/text'
import type { ApplicationLetter, CvContent, JobInfo, Profile, Style } from '../../shared/types'

const CV_RULES = `Rules:
1. Use only information from the candidate profile. Never add skills, tools, employers, numbers, achievements or responsibilities that are not in the profile. If the posting asks for something the candidate lacks, leave it out.
2. Select only the items that are relevant to this posting. Reference each one by its exact id. Never output an id that is not in the profile, and never move an id to a different section than the one it comes from. Within each section, order items from most to least relevant.
3. Light rewording only: you may rephrase, shorten, reorder or drop bullet points, and echo the posting's terminology where it truthfully describes the candidate's experience. Do not exaggerate.
4. Write all text (titles, bullets, degree names, skill names and categories, language names and levels, the headline, the summary and the section labels) in the language of the job posting. Proper nouns, product names and technologies stay as they are.
5. headline: one line describing the candidate for this role. summary: 2-4 sentences based on the profile summary and the selected items.
6. labels: the section headings, and the word for an ongoing period ("present"), in the posting's language.
7. Dates, employers, institutions, locations and links are added later from the profile by id, so do not put them in the text fields.
8. Follow the candidate's extra instructions unless they conflict with these rules.`

const LETTER_RULES = `Rules:
1. Write in the posting's language, given as job.language in the job analysis.
2. Match the candidate's own writing: mirror the samples' tone, formality, sentence length, structure, number of paragraphs, and their greeting and sign-off conventions. Aim for the target length. Never copy sentences from the samples; write new text in the same voice. If there are no samples, write in a warm, professional and concrete style.
3. Use only facts found in the profile or the tailored CV. Never invent experience, skills, numbers or achievements, and never state details about the company that the posting does not give.
4. Connect the candidate's most relevant experience to the posting's key requirements with specific examples rather than generic claims.
5. subject: a short subject line in the posting's language (e.g. "Application for the position as Data Engineer"). greeting: the salutation line; use the contact person's name if the posting gives one. paragraphs: the body only, without greeting or sign-off. signOff: the closing phrase only (e.g. "Kind regards,"), without the candidate's name, which is added afterwards.
6. Follow the default instructions and the instructions for this application unless they conflict with these rules.`

export const TAILOR_SYSTEM = `You tailor a candidate's CV to one specific job posting. You receive the job posting and the candidate's profile as JSON, where every item has an id such as "exp_01" or "skill_03".

${CV_RULES}

Also fill in "job": company and role as stated in the posting ("" if it does not say), language as the ISO 639-1 code of the posting's language (e.g. "da" or "en"), and keyRequirements as the 3-8 most important requirements of the posting, in the posting's language.`

export const CV_REVISE_SYSTEM = `You revise a CV that was already tailored to a job posting. You receive the posting, an analysis of it (job.language is the language to write in), the candidate's profile as JSON with item ids, the current CV and a requested change.

${CV_RULES}

Apply the requested change and keep everything else as it is. You may add items from the profile if the change calls for it. Return the complete revised CV.`

export const LETTER_SYSTEM = `You write a job application letter for a candidate. You receive the job posting, an analysis of it, the candidate's full profile, a CV already tailored to this job, applications the candidate wrote themselves, a target length, and instructions.

${LETTER_RULES}`

export const LETTER_REVISE_SYSTEM = `You revise a job application letter. You receive the same context the letter was written from, the current letter and a requested change.

${LETTER_RULES}

Apply the requested change and keep everything else as it is. Return the complete revised letter.`

const DEFAULT_TARGET_WORDS = 350

/** Average length of the active writing samples, rounded to the nearest 10 words. */
export function targetWordCount(style: Style): number {
  const counts = style.samples.filter((s) => s.active).map((s) => countWords(s.text)).filter((n) => n > 0)
  if (counts.length === 0) return DEFAULT_TARGET_WORDS
  const average = counts.reduce((a, b) => a + b, 0) / counts.length
  return Math.round(average / 10) * 10
}

const section = (title: string, body: string): string => `## ${title}\n${body.trim() || '(none)'}`
const json = (value: unknown): string => JSON.stringify(value, null, 2)

function profileForPrompt(profile: Profile): Omit<Profile, 'version' | 'nextIds'> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { version, nextIds, ...rest } = profile
  return rest
}

export function buildTailorInput(a: { profile: Profile; jobDescription: string; instructions: string }): string {
  return [
    section('Job posting', a.jobDescription),
    section('Candidate profile (JSON)', json(profileForPrompt(a.profile))),
    section('Extra instructions', a.instructions)
  ].join('\n\n')
}

export function buildCvReviseInput(a: {
  profile: Profile
  jobDescription: string
  job: JobInfo
  cv: CvContent
  instruction: string
  instructions?: string
}): string {
  return [
    section('Job posting', a.jobDescription),
    section('Job analysis (JSON)', json(a.job)),
    section('Candidate profile (JSON)', json(profileForPrompt(a.profile))),
    section('Extra instructions', a.instructions ?? ''),
    section('Current CV (JSON)', json(a.cv)),
    section('Requested change', a.instruction)
  ].join('\n\n')
}

function letterSections(a: {
  profile: Profile
  style: Style
  jobDescription: string
  instructions: string
  job: JobInfo
  cv: CvContent
}): string[] {
  const samples = a.style.samples
    .filter((s) => s.active && s.text.trim())
    .map((s) => `### Sample: ${s.title.trim() || 'Untitled'}\n${s.text.trim()}`)
    .join('\n\n')
  return [
    section('Job posting', a.jobDescription),
    section('Job analysis (JSON)', json(a.job)),
    section('Candidate profile (JSON)', json(profileForPrompt(a.profile))),
    section('Tailored CV (JSON)', json(a.cv)),
    section('Writing samples', samples),
    section('Target length', `About ${targetWordCount(a.style)} words.`),
    section('Default instructions', a.style.defaultInstructions),
    section('Instructions for this application', a.instructions)
  ]
}

export function buildLetterInput(a: {
  profile: Profile
  style: Style
  jobDescription: string
  instructions: string
  job: JobInfo
  cv: CvContent
}): string {
  return letterSections(a).join('\n\n')
}

export function buildLetterReviseInput(a: {
  profile: Profile
  style: Style
  jobDescription: string
  job: JobInfo
  cv: CvContent
  letter: ApplicationLetter
  instruction: string
  instructions?: string
}): string {
  return [
    ...letterSections({ ...a, instructions: a.instructions ?? '' }),
    section('Current letter (JSON)', json(a.letter)),
    section('Requested change', a.instruction)
  ].join('\n\n')
}
