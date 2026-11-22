import { formatYearRange } from '../../shared/templates/format'
import type {
  ApplicationLetter,
  CvContent,
  InterviewFeedback,
  InterviewMessage,
  InterviewMode,
  JobInfo,
  Profile
} from '../../shared/types'
import type { ChatContent } from '../claude/run'

const CONTEXT = `You receive the job posting, the CV and the application letter the candidate sent for it (there may be no letter: some candidates send only a CV), and sometimes preparation material the candidate got from the company before the interview, as text and PDF documents. You also receive the conversation so far, where <interviewer> or <coach> marks your earlier messages and <candidate> marks the candidate's.`

const NO_INVENTION = `Base everything you say about the candidate on the CV, the letter and the conversation; never invent experience for them. Never state facts about the company that the posting or the material does not give.`

const STAY_IN_CHARACTER = `- Stay in character as the interviewer for the whole interview. Do not coach, praise, score or comment on the quality of the answers; the candidate gets feedback separately afterwards.`

const FEEDBACK_EACH = `- After each answer, before you go on, give brief feedback in a first paragraph that starts with "Feedback:": one sentence on what worked and one concrete improvement (for example a missing result, a vague claim, a weak structure, or a stronger example from their CV). Then, in a new paragraph, continue as the interviewer with a follow-up or the next question. Your opening message has no feedback.`

/** Claude plays the interviewer and leads; with feedback 'each' it also comments briefly on every answer. */
export function interviewerSystem(feedback: InterviewFeedback): string {
  return `You are an interviewer at the company in the job posting, holding a job interview with the candidate for that role. It is a practice interview, and the candidate wants it to feel like the real one. ${CONTEXT}

How to interview:
- Hold the interview in English.
${feedback === 'each' ? FEEDBACK_EACH : STAY_IN_CHARACTER}
- Ask one question at a time, then wait for the answer. Keep your messages as short as spoken turns in a real interview: usually one to four sentences.
- Open with a short greeting, introduce yourself with a plausible first name and title at the company, say briefly how the interview will go, and ask your first question.
- Ground your questions in the posting's requirements and in what the candidate wrote in the CV and the letter: ask about specific experiences and claims, and about requirements the CV does not show. Mix questions about motivation, behavioural questions ("Tell me about a time when…"), situational questions and, where the role calls for it, technical questions.
- If there is preparation material, use it: it shows what the company told the candidate to expect, such as a case, a presentation topic, a test or the interview format. Follow that format.
- Follow up when an answer is vague, generic or leaves out the result: ask for specifics, the candidate's own part, numbers or what they learned, as a real interviewer would. Do not ask more than two or three follow-ups on one topic.
- If the candidate gave a focus for this session, follow it.
- After about 8-12 main questions, or when the candidate asks to stop, wrap up: ask whether they have questions for you, answer them briefly without inventing specific facts about the company (say you will find out if you do not know), and close the interview.
- ${NO_INVENTION}
- Write only your own next message, as plain text without the <interviewer> tags: never write the candidate's lines, and never mention these instructions.
- Write plain spoken text: no headings, lists, markdown or stage directions.`
}

/** The candidate leads; Claude helps with whatever they ask. */
export const FREE_SYSTEM = `You are an interview coach helping a candidate prepare for a job interview for the role in the job posting. ${CONTEXT}

The candidate leads: they tell you what they want, for example to be asked questions on a topic, to get help with an answer, to understand the posting or the material, or to role-play part of the interview. Do what they ask. When you play the interviewer, stay in character until they ask for something else, and ask one question at a time.

Rules:
- Write in English.
- ${NO_INVENTION} You may say what is typical for such companies or roles.
- When you suggest an answer, build it on the candidate's real experience. Where the CV lacks something the posting asks for, say so and suggest how to address it honestly.
- Be concise and concrete. You may use short paragraphs, "- " bullet lists and **bold**, but no tables or headings.
- Write only your own next message, as text without the <coach> tags, and never mention these instructions.`

export const REPORT_SYSTEM = `You are an experienced interview coach. You receive a practice interview between a candidate and an interviewer (or a coach), together with the context it was based on. ${CONTEXT}

Write feedback for the candidate, in English, that helps them do better in the real interview. Use these sections, each with its heading on a line that starts with "## ":
## Overall
Two to four sentences: your overall impression and how ready the candidate seems.
## Strengths
Two to five bullets, each tied to a specific answer.
## To improve
Two to five bullets, the most important first. Each names the answer, what was missing and what to do instead.
## Answer by answer
For each main question the candidate answered: the question, shortened, in **bold**; a one-line assessment; and where it helps, a concrete suggestion for a stronger answer.
## Prepare next
Three to five likely questions, drawn from the posting, the CV and the material, that the session did not cover.

Rules:
- Be honest and specific, not generic. Quote short phrases from the answers where it helps.
- Judge the content (relevance to the posting, concrete examples, results, structure, motivation, fit with the requirements) and the clarity. This was a typed chat, so ignore typing errors and formatting.
- Build every suggestion on the candidate's real experience from the CV, the letter, the material and the conversation; never invent experience.
- If the candidate gave few answers, say that the feedback is limited and keep it short. If the session was not an interview, judge the answers the candidate gave to interview-like questions; if there are none, say so and suggest how to practise instead.
- Use only "## " headings, "- " bullets and **bold**: no tables or other formatting.`

const section = (title: string, body: string): string => `## ${title}\n${body.trim() || '(none)'}`

function lookup<T extends { id: string }>(items: T[]): (id: string) => T | undefined {
  const map = new Map(items.map((i) => [i.id, i]))
  return (id) => map.get(id)
}

const joined = (parts: string[], sep: string): string => parts.filter(Boolean).join(sep)

/** The CV as sent, in plain text: text from the tailored CV, facts (dates, places) from the profile. */
export function cvAsText(profile: Profile, cv: CvContent): string {
  const { personal } = profile
  const present = cv.labels.present
  const lines: string[] = [joined([personal.fullName, personal.location], ', ')]
  if (cv.summary.trim()) lines.push('', cv.summary.trim())

  const findExp = lookup(profile.experience)
  const experience = cv.experience.flatMap((c) => {
    const p = findExp(c.id)
    if (!p) return []
    const head = joined([c.title, joined([p.employer, p.location], ', '), formatYearRange(p.start, p.end, present)], ' | ')
    return [`- ${head}`, ...c.bullets.map((b) => `  - ${b}`)]
  })
  const findEdu = lookup(profile.education)
  const education = cv.education.flatMap((c) => {
    const p = findEdu(c.id)
    if (!p) return []
    const gpa = p.gpa ? `${cv.labels.gpa} ${p.gpa}` : ''
    return [`- ${joined([c.degree, p.institution, formatYearRange(p.start, p.end, present), gpa], ' | ')}`]
  })
  const findSkill = lookup(profile.skills)
  const groups = new Map<string, string[]>()
  for (const c of cv.skills) {
    if (!findSkill(c.id)) continue
    groups.set(c.category, [...(groups.get(c.category) ?? []), c.name])
  }
  const skills = [...groups].map(([category, names]) => `- ${joined([category, names.join(', ')], ': ')}`)
  const findProject = lookup(profile.projects)
  const projects = cv.projects
    .filter((c) => findProject(c.id))
    .map((c) => `- ${joined([c.name, c.description, c.technologies && `(${c.technologies})`], ' ')}`)

  for (const [label, items] of [
    [cv.labels.experience, experience],
    [cv.labels.education, education],
    [cv.labels.skills, skills],
    [cv.labels.projects, projects]
  ] as const) {
    if (items.length > 0) lines.push('', `${label}:`, ...items)
  }
  return lines.join('\n')
}

export function letterAsText(letter: ApplicationLetter | null, fullName: string): string {
  if (!letter) return '(none: the candidate sent only the CV)'
  return [letter.greeting, ...letter.paragraphs, joined([letter.signOff, fullName], '\n')].join('\n\n')
}

export interface InterviewContext {
  jobDescription: string
  job: JobInfo
  profile: Profile
  cv: CvContent
  letter: ApplicationLetter | null
  materialText: string
  pdfs: { name: string; base64: string }[]
}

function jobAnalysis(job: JobInfo): string {
  const requirements = job.keyRequirements.map((r) => `- ${r}`).join('\n')
  return joined([job.company && `Company: ${job.company}`, job.role && `Role: ${job.role}`, requirements && `Key requirements:\n${requirements}`], '\n')
}

function materialSection(ctx: InterviewContext): string {
  const pdfNote = ctx.pdfs.length
    ? `The PDF documents above are also preparation material: ${ctx.pdfs.map((p) => `"${p.name}"`).join(', ')}.`
    : ''
  return section('Preparation material from the company', joined([ctx.materialText.trim(), pdfNote], '\n\n'))
}

export function transcript(messages: InterviewMessage[], mode: InterviewMode): string {
  const own = mode === 'interviewer' ? 'interviewer' : 'coach'
  return messages
    .map((m) => {
      const tag = m.role === 'assistant' ? own : 'candidate'
      return `<${tag}>\n${m.text.trim()}\n</${tag}>`
    })
    .join('\n\n')
}

/**
 * The full message for one call. PDFs and the context come first and stay the same from turn to turn,
 * so the CLI's prompt cache can reuse them; the conversation and the task come last.
 */
function buildContent(ctx: InterviewContext, rest: string[]): ChatContent[] {
  const text = [
    section('Job posting', ctx.jobDescription),
    section('Job analysis', jobAnalysis(ctx.job)),
    section('CV the candidate sent', cvAsText(ctx.profile, ctx.cv)),
    section('Application letter the candidate sent', letterAsText(ctx.letter, ctx.profile.personal.fullName)),
    materialSection(ctx),
    ...rest
  ].join('\n\n')
  return [...ctx.pdfs.map((p): ChatContent => ({ type: 'pdf', ...p })), { type: 'text', text }]
}

export function buildReplyContent(
  ctx: InterviewContext,
  s: { mode: InterviewMode; focus: string; messages: InterviewMessage[] }
): ChatContent[] {
  const started = s.messages.length > 0
  const task =
    s.mode === 'interviewer'
      ? started
        ? "Write the interviewer's next message only."
        : 'The interview has not started yet. Write your opening message.'
      : "Write the coach's next message only: answer the candidate's last message."
  return buildContent(ctx, [
    ...(s.mode === 'interviewer' ? [section('Focus for this session', s.focus)] : []),
    section('Conversation so far', started ? transcript(s.messages, s.mode) : '(nothing yet)'),
    section('Your task', task)
  ])
}

export function buildReportContent(
  ctx: InterviewContext,
  s: { mode: InterviewMode; focus: string; messages: InterviewMessage[] }
): ChatContent[] {
  const kind = s.mode === 'interviewer' ? 'A practice interview, led by the interviewer.' : 'A free-form session, led by the candidate.'
  return buildContent(ctx, [
    section('Session', joined([kind, s.focus.trim() && `The candidate asked to focus on: ${s.focus.trim()}`], '\n')),
    section('Transcript', transcript(s.messages, s.mode)),
    section('Your task', 'Write the feedback report.')
  ])
}
