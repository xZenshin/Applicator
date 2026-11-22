import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { ClaudeError } from '../../src/main/claude/errors'
import type { ChatContent } from '../../src/main/claude/run'
import { sendInterviewMessage, withoutRoleTags, writeInterviewReport } from '../../src/main/interview'
import { FREE_SYSTEM, REPORT_SYSTEM, cvAsText, interviewerSystem, letterAsText } from '../../src/main/llm/interview-prompts'
import type { ChatFn } from '../../src/main/llm/run-fn'
import { createApplication } from '../../src/main/storage/applications'
import {
  MAX_PDF_BYTES,
  addPdfs,
  createSession,
  listSessions,
  loadMaterials,
  loadSession,
  pdfPath,
  removePdf,
  saveMaterialsText,
  sessionPath
} from '../../src/main/storage/interview'
import { AppError } from '../../src/shared/errors'
import { sampleCv, sampleDraft, sampleLetter, sampleProfile } from '../fixtures/sample-data'

const JOB_TEXT = 'Acme is hiring a Data Engineer. You know Python and SQL.'
const PDF = Buffer.from('%PDF-1.4\n% fake test document\n%%EOF\n', 'latin1')

let dataDir: string
let appId: string
let clock: number

const now = (): Date => new Date(Date.UTC(2026, 10, 22, 10, 0, clock++))

beforeEach(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'applicator-interview-'))
  clock = 0
  const meta = await createApplication(dataDir, {
    jobDescription: JOB_TEXT,
    draft: sampleDraft(),
    profile: sampleProfile(),
    now: now()
  })
  appId = meta.id
})

async function writePdf(name: string, bytes: Buffer = PDF): Promise<string> {
  const path = join(dataDir, name)
  await writeFile(path, bytes)
  return path
}

function fakeChat(replies: (string | Error)[]): { chat: ChatFn; calls: { system: string; content: ChatContent[]; text: string }[] } {
  const calls: { system: string; content: ChatContent[]; text: string }[] = []
  const chat: ChatFn = async (req) => {
    const text = req.content.flatMap((c) => (c.type === 'text' ? [c.text] : [])).join('\n')
    calls.push({ system: req.system, content: req.content, text })
    const reply = replies.shift() ?? 'OK'
    if (reply instanceof Error) throw reply
    return reply
  }
  return { chat, calls }
}

async function failure(p: Promise<unknown>): Promise<AppError> {
  const e = await p.then(
    () => null,
    (err) => err
  )
  expect(e).toBeInstanceOf(AppError)
  return e as AppError
}

describe('interview materials', () => {
  it('starts empty and saves the text', async () => {
    expect(await loadMaterials(dataDir, appId)).toEqual({ version: 1, text: '', files: [] })
    await saveMaterialsText(dataDir, appId, 'Case: design a pipeline.')
    expect((await loadMaterials(dataDir, appId)).text).toBe('Case: design a pipeline.')
  })

  it('copies PDFs in and removes them again', async () => {
    const m = await addPdfs(dataDir, appId, [await writePdf('Case study.pdf')], now())
    expect(m.files).toHaveLength(1)
    expect(m.files[0]).toMatchObject({ name: 'Case study.pdf', size: PDF.length })
    const stored = pdfPath(dataDir, appId, m.files[0].id)
    expect(await readFile(stored)).toEqual(PDF)

    const after = await removePdf(dataDir, appId, m.files[0].id)
    expect(after.files).toEqual([])
    expect(existsSync(stored)).toBe(false)
  })

  it('rejects files that are not PDFs, and adds none of the batch', async () => {
    const good = await writePdf('good.pdf')
    const bad = await writePdf('notes.pdf', Buffer.from('just text'))
    expect((await failure(addPdfs(dataDir, appId, [good, bad], now()))).kind).toBe('not_pdf')
    expect((await loadMaterials(dataDir, appId)).files).toEqual([])
  })

  it('rejects PDFs over the size limit in total', async () => {
    const big = Buffer.concat([PDF, Buffer.alloc(MAX_PDF_BYTES - PDF.length)])
    await addPdfs(dataDir, appId, [await writePdf('big.pdf', big)], now())
    expect((await failure(addPdfs(dataDir, appId, [await writePdf('small.pdf')], now()))).kind).toBe('pdf_too_large')
  })

  it('refuses ids that could escape the folder', () => {
    expect(() => pdfPath(dataDir, appId, '../x')).toThrow(AppError)
    expect(() => sessionPath(dataDir, appId, 'a\\b')).toThrow(AppError)
  })
})

describe('interview sessions', () => {
  it('creates, lists (newest first) and summarizes sessions', async () => {
    const a = await createSession(dataDir, appId, { mode: 'interviewer', feedback: 'end', focus: '  Technical round  ' }, now())
    expect(a).toMatchObject({ mode: 'interviewer', focus: 'Technical round', messages: [], report: null })
    const b = await createSession(dataDir, appId, { mode: 'free', feedback: 'end', focus: '' }, now())
    const { chat } = fakeChat(['Sure.'])
    await sendInterviewMessage({ chat, dataDir, appId, sessionId: b.id, text: 'Quiz me on SQL window functions', now })

    const list = await listSessions(dataDir, appId)
    expect(list.map((s) => s.id)).toEqual([b.id, a.id])
    expect(list[0]).toMatchObject({ mode: 'free', title: 'Quiz me on SQL window functions', answers: 1, hasReport: false })
    expect(list[1]).toMatchObject({ title: 'Technical round', answers: 0 })
  })

  it('skips unreadable session files', async () => {
    await createSession(dataDir, appId, { mode: 'free', feedback: 'end', focus: '' }, now())
    await writeFile(join(dataDir, 'applications', appId, 'interview', 'sessions', 'broken.json'), '{oops')
    expect(await listSessions(dataDir, appId)).toHaveLength(1)
  })

  it('returns an empty list before any session exists', async () => {
    expect(await listSessions(dataDir, appId)).toEqual([])
  })
})

describe('sendInterviewMessage', () => {
  it('has the interviewer open the interview, then saves each turn', async () => {
    await saveMaterialsText(dataDir, appId, 'The interview includes a 10-minute case.')
    await addPdfs(dataDir, appId, [await writePdf('case.pdf')], now())
    const s = await createSession(dataDir, appId, { mode: 'interviewer', feedback: 'end', focus: 'Python' }, now())
    const { chat, calls } = fakeChat(['Hi, I am Maja. Tell me about yourself.', 'Thanks. Why Acme?'])

    const opened = await sendInterviewMessage({ chat, dataDir, appId, sessionId: s.id, text: '', now })
    expect(opened.messages.map((m) => [m.role, m.text])).toEqual([['assistant', 'Hi, I am Maja. Tell me about yourself.']])
    expect(calls[0].system).toBe(interviewerSystem('end'))
    expect(calls[0].content[0]).toEqual({ type: 'pdf', name: 'case.pdf', base64: PDF.toString('base64') })
    expect(calls[0].text).toContain(JOB_TEXT)
    expect(calls[0].text).toContain('The interview includes a 10-minute case.')
    expect(calls[0].text).toContain('"case.pdf"')
    expect(calls[0].text).toContain('## Focus for this session\nPython')
    expect(calls[0].text).toContain('Write your opening message.')

    const next = await sendInterviewMessage({ chat, dataDir, appId, sessionId: s.id, text: '  I build pipelines.  ', now })
    expect(next.messages.map((m) => m.role)).toEqual(['assistant', 'user', 'assistant'])
    expect(next.messages[1].text).toBe('I build pipelines.')
    expect(calls[1].text).toContain('<interviewer>\nHi, I am Maja. Tell me about yourself.\n</interviewer>')
    expect(calls[1].text).toContain('<candidate>\nI build pipelines.\n</candidate>')
    expect(await loadSession(dataDir, appId, s.id)).toEqual(next)
  })

  it('uses the per-answer feedback prompt when asked', async () => {
    const s = await createSession(dataDir, appId, { mode: 'interviewer', feedback: 'each', focus: '' }, now())
    const { chat, calls } = fakeChat(['Hello.'])
    await sendInterviewMessage({ chat, dataDir, appId, sessionId: s.id, text: '', now })
    expect(calls[0].system).toBe(interviewerSystem('each'))
    expect(calls[0].system).toContain('"Feedback:"')
    expect(interviewerSystem('end')).not.toContain('"Feedback:"')
  })

  it('keeps the user message when the reply fails, and retries with empty text', async () => {
    const s = await createSession(dataDir, appId, { mode: 'free', feedback: 'end', focus: '' }, now())
    const { chat, calls } = fakeChat([new ClaudeError('cancelled', 'Cancelled.'), 'Here you go.'])
    await failure(sendInterviewMessage({ chat, dataDir, appId, sessionId: s.id, text: 'Ask me something', now }))
    expect((await loadSession(dataDir, appId, s.id)).messages.map((m) => m.role)).toEqual(['user'])

    const retried = await sendInterviewMessage({ chat, dataDir, appId, sessionId: s.id, text: '', now })
    expect(retried.messages.map((m) => m.role)).toEqual(['user', 'assistant'])
    expect(calls[1].system).toBe(FREE_SYSTEM)
    expect(calls[1].text).toContain('<candidate>\nAsk me something\n</candidate>')
  })

  it('does not bring back a session deleted while Claude was answering', async () => {
    const s = await createSession(dataDir, appId, { mode: 'free', feedback: 'end', focus: '' }, now())
    const path = sessionPath(dataDir, appId, s.id)
    const chat: ChatFn = async () => {
      await rm(path) // the user deletes the session mid-reply
      return 'Late reply.'
    }
    expect((await failure(sendInterviewMessage({ chat, dataDir, appId, sessionId: s.id, text: 'Hi', now }))).kind).toBe('session_missing')
    expect(existsSync(path)).toBe(false)
  })

  it('refuses an empty message when there is nothing to answer', async () => {
    const free = await createSession(dataDir, appId, { mode: 'free', feedback: 'end', focus: '' }, now())
    const { chat, calls } = fakeChat([])
    expect((await failure(sendInterviewMessage({ chat, dataDir, appId, sessionId: free.id, text: ' ', now }))).kind).toBe(
      'nothing_to_answer'
    )
    expect(calls).toHaveLength(0)
  })
})

describe('writeInterviewReport', () => {
  it('needs at least one answer', async () => {
    const s = await createSession(dataDir, appId, { mode: 'interviewer', feedback: 'end', focus: '' }, now())
    const { chat } = fakeChat(['Hello.'])
    await sendInterviewMessage({ chat, dataDir, appId, sessionId: s.id, text: '', now })
    expect((await failure(writeInterviewReport({ chat, dataDir, appId, sessionId: s.id, now }))).kind).toBe('nothing_to_report')
  })

  it('saves the report with the session', async () => {
    const s = await createSession(dataDir, appId, { mode: 'interviewer', feedback: 'end', focus: '' }, now())
    const { chat, calls } = fakeChat(['Tell me about yourself.', 'Go on.', '## Overall\nSolid.'])
    await sendInterviewMessage({ chat, dataDir, appId, sessionId: s.id, text: '', now })
    await sendInterviewMessage({ chat, dataDir, appId, sessionId: s.id, text: 'I am a data engineer.', now })
    const done = await writeInterviewReport({ chat, dataDir, appId, sessionId: s.id, now })
    expect(done.report?.text).toBe('## Overall\nSolid.')
    expect(calls[2].system).toBe(REPORT_SYSTEM)
    expect(calls[2].text).toContain('## Transcript')
    expect((await listSessions(dataDir, appId))[0].hasReport).toBe(true)
  })
})

describe('prompt helpers', () => {
  it('writes the sent CV as text, with facts from the profile', () => {
    const text = cvAsText(sampleProfile(), sampleCv())
    const profile = sampleProfile()
    expect(text).toContain(profile.personal.fullName)
    expect(text).toContain(profile.experience[0].employer)
    for (const b of sampleCv().experience[0].bullets) expect(text).toContain(b)
  })

  it('writes the letter as text, or says there was none', () => {
    const text = letterAsText(sampleLetter(), 'Anna')
    expect(text.startsWith(sampleLetter().greeting)).toBe(true)
    expect(text.endsWith('Anna')).toBe(true)
    expect(letterAsText(null, 'Anna')).toContain('only the CV')
  })
})

describe('withoutRoleTags', () => {
  it('removes a transcript tag Claude copied around its reply', () => {
    expect(withoutRoleTags('<interviewer>Hello Jane. Why Acme?\n</interviewer>')).toBe('Hello Jane. Why Acme?')
    expect(withoutRoleTags('<coach>\n- One\n- Two')).toBe('- One\n- Two')
    expect(withoutRoleTags('Plain reply.')).toBe('Plain reply.')
  })
})
