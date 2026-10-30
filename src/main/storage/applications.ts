import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { AppError } from '../../shared/errors'
import { applicationFolderName, uniqueName } from '../../shared/filenames'
import {
  ApplicationMetaSchema,
  DraftSchema,
  ProfileSchema,
  type ApplicationMeta,
  type ApplicationRecord,
  type Draft,
  type Profile
} from '../../shared/types'
import { DataFileError, readJsonFile, writeJsonAtomic, writeTextAtomic } from './atomic'

const APPLICATIONS = 'applications'
const META = 'meta.json'
const JOB = 'job-description.txt'
const DRAFT = 'draft.json'
const SNAPSHOT = 'profile-snapshot.json'

/** The folder of one application. Ids come from the renderer, so they must not escape the data folder. */
export function applicationDir(dataDir: string, id: string): string {
  if (!id || id === '.' || id === '..' || /[\\/:]/.test(id)) {
    throw new AppError('bad_id', `Invalid application id: "${id}"`)
  }
  return join(dataDir, APPLICATIONS, id)
}

const missing = (id: string) => (): never => {
  throw new AppError('app_missing', `The application "${id}" no longer exists.`)
}

async function readMeta(dataDir: string, id: string): Promise<ApplicationMeta> {
  const meta = await readJsonFile(join(applicationDir(dataDir, id), META), ApplicationMetaSchema, missing(id))
  return { ...meta, id }
}

async function writeMeta(dataDir: string, meta: ApplicationMeta): Promise<ApplicationMeta> {
  await writeJsonAtomic(join(applicationDir(dataDir, meta.id), META), meta)
  return meta
}

export async function createApplication(
  dataDir: string,
  a: { jobDescription: string; draft: Draft; profile: Profile; now: Date }
): Promise<ApplicationMeta> {
  const root = join(dataDir, APPLICATIONS)
  await mkdir(root, { recursive: true })
  const { company, role, language } = a.draft.job
  const id = uniqueName(applicationFolderName(a.now, company, role), (n) => existsSync(join(root, n)))
  const dir = applicationDir(dataDir, id)
  await mkdir(dir)
  const stamp = a.now.toISOString()
  const meta: ApplicationMeta = {
    id,
    company,
    role,
    language,
    createdAt: stamp,
    updatedAt: stamp,
    exportedAt: null,
    cvPdf: null,
    letterPdf: null
  }
  try {
    await writeTextAtomic(join(dir, JOB), a.jobDescription)
    await writeJsonAtomic(join(dir, DRAFT), DraftSchema.parse(a.draft))
    await writeJsonAtomic(join(dir, SNAPSHOT), a.profile)
    // meta.json last: a folder without it is incomplete and is skipped by listApplications.
    return await writeMeta(dataDir, meta)
  } catch (e) {
    await rm(dir, { recursive: true, force: true })
    throw e
  }
}

export async function listApplications(dataDir: string): Promise<ApplicationMeta[]> {
  let names: string[]
  try {
    const entries = await readdir(join(dataDir, APPLICATIONS), { withFileTypes: true })
    names = entries.filter((e) => e.isDirectory()).map((e) => e.name)
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw e
  }
  const metas: ApplicationMeta[] = []
  for (const name of names) {
    try {
      metas.push(await readMeta(dataDir, name))
    } catch {
      // Broken, incomplete or unreadable folder (e.g. an offline OneDrive file): skip it, keep the rest.
    }
  }
  return metas.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function loadApplication(dataDir: string, id: string): Promise<ApplicationRecord> {
  const meta = await readMeta(dataDir, id)
  const dir = applicationDir(dataDir, id)
  let jobDescription: string
  try {
    jobDescription = await readFile(join(dir, JOB), 'utf8')
  } catch {
    throw new DataFileError(join(dir, JOB), 'the file is missing')
  }
  const draft = await readJsonFile(join(dir, DRAFT), DraftSchema, missing(id))
  const profile = await readJsonFile(join(dir, SNAPSHOT), ProfileSchema, missing(id))
  return { meta, jobDescription, draft, profile }
}

export async function saveDraft(
  dataDir: string,
  id: string,
  draft: Draft,
  now: Date
): Promise<ApplicationMeta> {
  const meta = await readMeta(dataDir, id)
  await writeJsonAtomic(join(applicationDir(dataDir, id), DRAFT), DraftSchema.parse(draft))
  // Company, role and language can be corrected in the editor; meta mirrors them for History and PDF names.
  const { company, role, language } = draft.job
  return writeMeta(dataDir, { ...meta, company, role, language, updatedAt: now.toISOString() })
}

export async function setExported(
  dataDir: string,
  id: string,
  files: { cvPdf: string; letterPdf: string | null },
  now: Date
): Promise<ApplicationMeta> {
  const meta = await readMeta(dataDir, id)
  return writeMeta(dataDir, { ...meta, ...files, exportedAt: now.toISOString() })
}
