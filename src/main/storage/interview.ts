import { randomBytes } from 'node:crypto'
import { copyFile, mkdir, open, readdir, readFile, rm, stat } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { AppError } from '../../shared/errors'
import {
  InterviewMaterialsSchema,
  InterviewSessionSchema,
  emptyInterviewMaterials,
  type InterviewFile,
  type InterviewMaterials,
  type InterviewSession,
  type InterviewSessionSummary,
  type NewInterviewSession
} from '../../shared/types'
import { applicationDir } from './applications'
import { readJsonFile, writeJsonAtomic } from './atomic'

const INTERVIEW = 'interview'
const MATERIALS = 'materials.json'
const FILES = 'files'
const SESSIONS = 'sessions'

/** Claude reads at most 32 MB per request, and base64 makes a PDF a third bigger. */
export const MAX_PDF_BYTES = 20 * 1024 * 1024

const MB = (bytes: number): string => `${(bytes / 1024 / 1024).toFixed(1)} MB`

/** Ids come from the renderer, so like application ids they must not escape their folder. */
function safeId(id: string, what: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new AppError('bad_id', `Invalid ${what} id: "${id}"`)
  return id
}

export function interviewDir(dataDir: string, appId: string): string {
  return join(applicationDir(dataDir, appId), INTERVIEW)
}

export function pdfPath(dataDir: string, appId: string, fileId: string): string {
  return join(interviewDir(dataDir, appId), FILES, `${safeId(fileId, 'file')}.pdf`)
}

export function sessionPath(dataDir: string, appId: string, sessionId: string): string {
  return join(interviewDir(dataDir, appId), SESSIONS, `${safeId(sessionId, 'session')}.json`)
}

/** Ids that sort by creation time, so file listings come out in order. */
function newId(now: Date): string {
  return `${now.getTime().toString(36)}-${randomBytes(3).toString('hex')}`
}

// ---------- Materials ----------

export async function loadMaterials(dataDir: string, appId: string): Promise<InterviewMaterials> {
  return readJsonFile(join(interviewDir(dataDir, appId), MATERIALS), InterviewMaterialsSchema, emptyInterviewMaterials)
}

async function writeMaterials(dataDir: string, appId: string, m: InterviewMaterials): Promise<InterviewMaterials> {
  await writeJsonAtomic(join(interviewDir(dataDir, appId), MATERIALS), InterviewMaterialsSchema.parse(m))
  return m
}

export async function saveMaterialsText(dataDir: string, appId: string, text: string): Promise<InterviewMaterials> {
  const m = await loadMaterials(dataDir, appId)
  return writeMaterials(dataDir, appId, { ...m, text })
}

async function isPdf(path: string): Promise<boolean> {
  const handle = await open(path, 'r')
  try {
    const { buffer, bytesRead } = await handle.read(Buffer.alloc(5), 0, 5, 0)
    return bytesRead === 5 && buffer.toString('latin1') === '%PDF-'
  } finally {
    await handle.close()
  }
}

/** Copies the files in. All of them are checked first, so a bad file adds none. */
export async function addPdfs(dataDir: string, appId: string, sourcePaths: string[], now: Date): Promise<InterviewMaterials> {
  const m = await loadMaterials(dataDir, appId)
  let total = m.files.reduce((sum, f) => sum + f.size, 0)
  const checked: { path: string; size: number }[] = []
  for (const path of sourcePaths) {
    const name = basename(path)
    const { size } = await stat(path)
    if (!(await isPdf(path))) throw new AppError('not_pdf', `"${name}" is not a PDF file.`)
    total += size
    if (total > MAX_PDF_BYTES) {
      throw new AppError(
        'pdf_too_large',
        `The PDFs would come to ${MB(total)}; Claude can read at most ${MB(MAX_PDF_BYTES)} in all. Remove a PDF or add a smaller one.`
      )
    }
    checked.push({ path, size })
  }

  const dir = join(interviewDir(dataDir, appId), FILES)
  await mkdir(dir, { recursive: true })
  const added: InterviewFile[] = []
  for (const c of checked) {
    const id = newId(now)
    await copyFile(c.path, join(dir, `${id}.pdf`))
    added.push({ id, name: basename(c.path), size: c.size, addedAt: now.toISOString() })
  }
  return writeMaterials(dataDir, appId, { ...m, files: [...m.files, ...added] })
}

export async function removePdf(dataDir: string, appId: string, fileId: string): Promise<InterviewMaterials> {
  const m = await loadMaterials(dataDir, appId)
  const path = pdfPath(dataDir, appId, fileId)
  const next = await writeMaterials(dataDir, appId, { ...m, files: m.files.filter((f) => f.id !== fileId) })
  await rm(path, { force: true })
  return next
}

/** Every PDF in the materials, for sending to Claude. */
export async function readPdfs(dataDir: string, appId: string): Promise<{ name: string; base64: string }[]> {
  const m = await loadMaterials(dataDir, appId)
  return Promise.all(
    m.files.map(async (f) => {
      try {
        return { name: f.name, base64: (await readFile(pdfPath(dataDir, appId, f.id))).toString('base64') }
      } catch {
        throw new AppError('pdf_missing', `The PDF "${f.name}" is missing from the application folder. Remove it and add it again.`)
      }
    })
  )
}

// ---------- Sessions ----------

const missingSession = (sessionId: string) => (): never => {
  throw new AppError('session_missing', `The practice session "${sessionId}" no longer exists.`)
}

export async function loadSession(dataDir: string, appId: string, sessionId: string): Promise<InterviewSession> {
  const s = await readJsonFile(sessionPath(dataDir, appId, sessionId), InterviewSessionSchema, missingSession(sessionId))
  return { ...s, id: sessionId }
}

export async function saveSession(dataDir: string, appId: string, s: InterviewSession, now: Date): Promise<InterviewSession> {
  const next = InterviewSessionSchema.parse({ ...s, updatedAt: now.toISOString() })
  await writeJsonAtomic(sessionPath(dataDir, appId, s.id), next)
  return next
}

export async function createSession(dataDir: string, appId: string, n: NewInterviewSession, now: Date): Promise<InterviewSession> {
  applicationDir(dataDir, appId) // validates the id before anything is written
  const stamp = now.toISOString()
  const session: InterviewSession = {
    version: 1,
    id: newId(now),
    mode: n.mode,
    feedback: n.feedback,
    focus: n.focus.trim(),
    createdAt: stamp,
    updatedAt: stamp,
    messages: [],
    report: null
  }
  return saveSession(dataDir, appId, session, now)
}

const shorten = (text: string, max = 80): string => {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat
}

export function summarizeSession(s: InterviewSession): InterviewSessionSummary {
  const firstUser = s.messages.find((m) => m.role === 'user')?.text ?? ''
  return {
    id: s.id,
    mode: s.mode,
    feedback: s.feedback,
    title: shorten(s.mode === 'free' ? firstUser : s.focus),
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    answers: s.messages.filter((m) => m.role === 'user').length,
    hasReport: s.report !== null
  }
}

/** Newest first. Unreadable session files are skipped, as broken application folders are in History. */
export async function listSessions(dataDir: string, appId: string): Promise<InterviewSessionSummary[]> {
  let names: string[]
  try {
    names = (await readdir(join(interviewDir(dataDir, appId), SESSIONS))).filter((n) => n.endsWith('.json'))
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw e
  }
  const summaries: InterviewSessionSummary[] = []
  for (const name of names) {
    try {
      summaries.push(summarizeSession(await loadSession(dataDir, appId, name.slice(0, -'.json'.length))))
    } catch {
      // skip it, keep the rest
    }
  }
  return summaries.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}
