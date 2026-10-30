import { countWords } from '../../shared/text'
import type { ApplicationLetter, CvContent, Highlight, JobInfo, Profile, Style } from '../../shared/types'

const SUMMARY_RULE = '5. summary: 2-4 sentences based on the profile summary and the selected items.'

/** A CV sent without a letter: the summary at the top has to do the letter's job. */
const CV_ONLY_SUMMARY_RULE = `5. summary: this CV is sent without an application letter, so the summary also does the letter's job. Write 6-8 sentences (about 130-160 words) in the first person, in the candidate's own voice as shown in the writing samples, in this order: who the candidate is and their strongest qualification for this job; their most relevant experience, told concretely, and what it taught them; other relevant experience; what they want to work on; and why they want this job at this company. Base the motivation on the posting and on the candidate's own ties to the company found in the profile (for example having worked there), and never state details about the company that the posting does not give. Never copy sentences from the writing samples. If there is text the candidate wrote for this application, build the summary on it: you may improve its wording and adapt it to the posting, but keep its points. Facts in that text count as the candidate's own, like facts in the profile, but use them in the summary only.`

const cvRules = (summaryRule: string): string => `Rules:
1. Use only information from the candidate profile. Never add skills, tools, employers, numbers, achievements or responsibilities that are not in the profile. If the posting asks for something the candidate lacks, leave it out.
2. Select only the items that are relevant to this posting. Reference each one by its exact id. Never output an id that is not in the profile, and never move an id to a different section than the one it comes from. Within each section, order items from most to least relevant.
3. Light rewording only: you may rephrase, shorten, reorder or drop bullet points, and echo the posting's terminology where it truthfully describes the candidate's experience. Do not exaggerate.
4. Write all text (job titles, bullets, degree names and details, skill names and categories, the summary and the section labels) in the language of the job posting. Proper nouns, product names and technologies stay as they are.
${summaryRule}
6. labels: the section headings, and the word for an ongoing period ("present"), in the posting's language.
7. Dates, employers, institutions and locations are added later from the profile by id, so do not put them in the text fields.
8. Follow the candidate's extra instructions unless they conflict with these rules.`

const LETTER_RULES = `Rules:
1. Write in the posting's language, given as job.language in the job analysis.
2. Match the candidate's own writing: mirror the samples' tone, formality, sentence length, structure, number of paragraphs, and their greeting and sign-off conventions. Aim for the target length. Never copy sentences from the samples; write new text in the same voice. If there are no samples, write in a warm, professional and concrete style.
3. Use only facts found in the profile, the tailored CV or the text the candidate wrote for this application. Never invent experience, skills, numbers or achievements, and never state details about the company that the posting does not give.
4. Connect the candidate's most relevant experience to the posting's key requirements with specific examples rather than generic claims.
5. greeting: the salutation line; use the contact person's name if the posting gives one. paragraphs: the body only, without greeting or sign-off. signOff: the closing phrase only (e.g. "Kind regards,"), without the candidate's name, which is added afterwards.
6. If there is text the candidate wrote for this application, build the letter on it: use what fits the posting, put it where it reads best and write the rest around it, so the letter reads as one piece. If it is an unfinished letter, finish it. You may improve its wording and adapt it to the posting, but keep its points; parts that do not fit the posting may be left out. The target length still applies.
7. Follow the default instructions and the instructions for this application unless they conflict with these rules.`

const highlightRule = (document: string): string =>
  `If a highlighted passage is given, it is shown with some of the text around it, and the passage itself is marked with ⟦ and ⟧. The requested change then applies to that passage only: rewrite it as asked and keep the rest of the ${document} word for word, apart from small adjustments to the text right next to it where they are needed for the result to read naturally. Never put ⟦ or ⟧ in your answer.`

const CV_ONLY_INPUTS =
  ' As the CV is sent without a letter, you also receive applications the candidate wrote earlier (writing samples) and sometimes text the candidate wrote for this application.'

const tailorSystem = (cvOnly: boolean): string => `You tailor a candidate's CV to one specific job posting. You receive the job posting and the candidate's profile as JSON, where every item has an id such as "exp_01" or "skill_03".${cvOnly ? CV_ONLY_INPUTS : ''}

${cvRules(cvOnly ? CV_ONLY_SUMMARY_RULE : SUMMARY_RULE)}

Also fill in "job": company and role as stated in the posting ("" if it does not say), language as the ISO 639-1 code of the posting's language (e.g. "da" or "en"), and keyRequirements as the 3-8 most important requirements of the posting, in the posting's language.`

const cvReviseSystem = (cvOnly: boolean): string => `You revise a CV that was already tailored to a job posting. You receive the posting, an analysis of it (job.language is the language to write in), the candidate's profile as JSON with item ids, the current CV and a requested change.${cvOnly ? CV_ONLY_INPUTS : ''}

${cvRules(cvOnly ? CV_ONLY_SUMMARY_RULE : SUMMARY_RULE)}

Apply the requested change and keep everything else as it is. The requested change takes priority over rule 2 (which items to select) and rule 5 (lengths), but never over rule 1: do not add facts that are not in the profile. You may add items from the profile if the change calls for it. Return the complete revised CV.

${highlightRule('CV')}`

export const TAILOR_SYSTEM = tailorSystem(false)
export const CV_REVISE_SYSTEM = cvReviseSystem(false)
export const CV_ONLY_TAILOR_SYSTEM = tailorSystem(true)
export const CV_ONLY_REVISE_SYSTEM = cvReviseSystem(true)

export const LETTER_SYSTEM = `You write a job application letter for a candidate. You receive the job posting, an analysis of it, the candidate's full profile, a CV already tailored to this job, applications the candidate wrote earlier (writing samples), a target length, instructions, and sometimes text the candidate wrote for this application.

${LETTER_RULES}`

export const LETTER_REVISE_SYSTEM = `You revise a job application letter. You receive the same context the letter was written from, the current letter and a requested change.

${LETTER_RULES}

Apply the requested change and keep everything else as it is. The requested change takes priority over the target length, the writing samples and the text the candidate wrote for this application, but never over rule 3: do not add facts that are not in the profile or the tailored CV. Return the complete revised letter.

${highlightRule('letter')}`

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

/** The highlighted passage in its context, marked as described in highlightRule. */
const highlightSections = (highlight?: Highlight): string[] =>
  highlight ? [section('Highlighted passage', `${highlight.before}⟦${highlight.text}⟧${highlight.after}`)] : []

function profileForPrompt(profile: Profile): Omit<Profile, 'version' | 'nextIds'> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { version, nextIds, ...rest } = profile
  return rest
}

const writingSamples = (style: Style): string =>
  style.samples
    .filter((s) => s.active && s.text.trim())
    .map((s) => `### Sample: ${s.title.trim() || 'Untitled'}\n${s.text.trim()}`)
    .join('\n\n')

const ownTextSections = (ownText?: string): string[] =>
  ownText?.trim() ? [section('Text the candidate wrote for this application', ownText)] : []

/** What a CV sent without a letter needs for its motivated summary. */
export interface CvOnlyContext {
  style: Style
  ownText?: string
}

// The default instructions are left out: they are written for letters.
const cvOnlySections = (c?: CvOnlyContext): string[] =>
  c ? [section('Writing samples', writingSamples(c.style)), ...ownTextSections(c.ownText)] : []

export function buildTailorInput(a: {
  profile: Profile
  jobDescription: string
  instructions: string
  cvOnly?: CvOnlyContext
}): string {
  return [
    section('Job posting', a.jobDescription),
    section('Candidate profile (JSON)', json(profileForPrompt(a.profile))),
    section('Extra instructions', a.instructions),
    ...cvOnlySections(a.cvOnly)
  ].join('\n\n')
}

export function buildCvReviseInput(a: {
  profile: Profile
  jobDescription: string
  job: JobInfo
  cv: CvContent
  instruction: string
  instructions?: string
  cvOnly?: CvOnlyContext
  highlight?: Highlight
}): string {
  return [
    section('Job posting', a.jobDescription),
    section('Job analysis (JSON)', json(a.job)),
    section('Candidate profile (JSON)', json(profileForPrompt(a.profile))),
    section('Extra instructions', a.instructions ?? ''),
    ...cvOnlySections(a.cvOnly),
    section('Current CV (JSON)', json(a.cv)),
    ...highlightSections(a.highlight),
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
  ownText?: string
}): string[] {
  return [
    section('Job posting', a.jobDescription),
    section('Job analysis (JSON)', json(a.job)),
    section('Candidate profile (JSON)', json(profileForPrompt(a.profile))),
    section('Tailored CV (JSON)', json(a.cv)),
    section('Writing samples', writingSamples(a.style)),
    section('Target length', `About ${targetWordCount(a.style)} words.`),
    section('Default instructions', a.style.defaultInstructions),
    section('Instructions for this application', a.instructions),
    ...ownTextSections(a.ownText)
  ]
}

export function buildLetterInput(a: {
  profile: Profile
  style: Style
  jobDescription: string
  instructions: string
  job: JobInfo
  cv: CvContent
  ownText?: string
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
  ownText?: string
  highlight?: Highlight
}): string {
  return [
    ...letterSections({ ...a, instructions: a.instructions ?? '' }),
    section('Current letter (JSON)', json(a.letter)),
    ...highlightSections(a.highlight),
    section('Requested change', a.instruction)
  ].join('\n\n')
}
