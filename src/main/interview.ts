import { AppError } from '../shared/errors'
import type { InterviewSession } from '../shared/types'
import {
  FREE_SYSTEM,
  REPORT_SYSTEM,
  buildReplyContent,
  buildReportContent,
  interviewerSystem,
  type InterviewContext
} from './llm/interview-prompts'
import type { ChatFn } from './llm/run-fn'
import { loadApplication } from './storage/applications'
import { loadMaterials, loadSession, readPdfs, updateSession } from './storage/interview'

/** Everything Claude sees besides the conversation: the posting, what was sent, and the prep material. */
async function loadContext(dataDir: string, appId: string): Promise<InterviewContext> {
  const record = await loadApplication(dataDir, appId)
  const materials = await loadMaterials(dataDir, appId)
  return {
    jobDescription: record.jobDescription,
    job: record.draft.job,
    profile: record.profile,
    cv: record.draft.cv,
    letter: record.draft.letter,
    materialText: materials.text,
    pdfs: await readPdfs(dataDir, appId)
  }
}

/** The transcript marks turns with <interviewer>, <coach> and <candidate>; a reply that copies the tag around itself loses it. */
export function withoutRoleTags(reply: string): string {
  return reply
    .trim()
    .replace(/^<(interviewer|coach)>\s*/i, '')
    .replace(/\s*<\/(interviewer|coach)>$/i, '')
    .trim()
}

const systemFor = (s: InterviewSession): string => (s.mode === 'interviewer' ? interviewerSystem(s.feedback) : FREE_SYSTEM)

/**
 * The user's message is saved before Claude is asked, so a failed or cancelled reply loses nothing:
 * sending again with empty text retries the reply.
 */
export async function sendInterviewMessage(a: {
  chat: ChatFn
  dataDir: string
  appId: string
  sessionId: string
  text: string
  now: () => Date
}): Promise<InterviewSession> {
  let session = await loadSession(a.dataDir, a.appId, a.sessionId)
  const text = a.text.trim()
  if (text) {
    const message = { role: 'user' as const, text, at: a.now().toISOString() }
    session = await updateSession(a.dataDir, a.appId, { ...session, messages: [...session.messages, message] }, a.now())
  } else {
    const last = session.messages.at(-1)
    const canOpen = session.mode === 'interviewer' && !last
    if (!canOpen && last?.role !== 'user') throw new AppError('nothing_to_answer', 'Write a message first.')
  }

  const ctx = await loadContext(a.dataDir, a.appId)
  const reply = await a.chat({ system: systemFor(session), content: buildReplyContent(ctx, session) })
  const message = { role: 'assistant' as const, text: withoutRoleTags(reply), at: a.now().toISOString() }
  return updateSession(a.dataDir, a.appId, { ...session, messages: [...session.messages, message] }, a.now())
}

export async function writeInterviewReport(a: {
  chat: ChatFn
  dataDir: string
  appId: string
  sessionId: string
  now: () => Date
}): Promise<InterviewSession> {
  const session = await loadSession(a.dataDir, a.appId, a.sessionId)
  if (!session.messages.some((m) => m.role === 'user')) {
    throw new AppError('nothing_to_report', 'Answer at least one question before asking for feedback.')
  }
  const ctx = await loadContext(a.dataDir, a.appId)
  const text = await a.chat({ system: REPORT_SYSTEM, content: buildReportContent(ctx, session) })
  return updateSession(a.dataDir, a.appId, { ...session, report: { text, at: a.now().toISOString() } }, a.now())
}
