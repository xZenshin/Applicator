import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  applicationDir,
  createApplication,
  listApplications,
  loadApplication,
  saveDraft,
  setExported
} from '../../src/main/storage/applications'
import { AppError } from '../../src/shared/errors'
import { sampleDraft, sampleProfile } from '../fixtures/sample-data'

let dataDir: string
beforeEach(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'applicator-apps-'))
})

const create = (now: Date, company = 'Acme', role = 'Data Engineer') => {
  const draft = sampleDraft()
  draft.job = { ...draft.job, company, role }
  return createApplication(dataDir, { jobDescription: 'We are hiring a data engineer.', draft, profile: sampleProfile(), now })
}

describe('createApplication', () => {
  it('writes meta, job description, draft and profile snapshot', async () => {
    const meta = await create(new Date(2026, 9, 29, 12, 0))
    expect(meta.id).toBe('2026-10-29_Acme_Data-Engineer')
    expect(meta).toMatchObject({ company: 'Acme', role: 'Data Engineer', language: 'en', exportedAt: null })
    const folder = join(dataDir, 'applications', meta.id)
    for (const f of ['meta.json', 'job-description.txt', 'draft.json', 'profile-snapshot.json']) {
      expect(existsSync(join(folder, f))).toBe(true)
    }
    expect(await readFile(join(folder, 'job-description.txt'), 'utf8')).toBe('We are hiring a data engineer.')
  })

  it('suffixes colliding folder names', async () => {
    await create(new Date(2026, 9, 29))
    const second = await create(new Date(2026, 9, 29))
    expect(second.id).toBe('2026-10-29_Acme_Data-Engineer-2')
  })
})

describe('listApplications', () => {
  it('returns newest first and skips broken folders', async () => {
    await create(new Date(2026, 9, 1), 'Old Co')
    await create(new Date(2026, 9, 20), 'New Co')
    await mkdir(join(dataDir, 'applications', 'junk'), { recursive: true })
    await writeFile(join(dataDir, 'applications', 'junk', 'meta.json'), '{oops')
    const list = await listApplications(dataDir)
    expect(list.map((m) => m.company)).toEqual(['New Co', 'Old Co'])
  })

  it('returns an empty list when nothing exists yet', async () => {
    expect(await listApplications(dataDir)).toEqual([])
  })
})

describe('loadApplication / saveDraft / setExported', () => {
  it('loads the full record', async () => {
    const meta = await create(new Date(2026, 9, 29))
    const rec = await loadApplication(dataDir, meta.id)
    expect(rec.meta).toEqual(meta)
    expect(rec.draft).toEqual(sampleDraft())
    expect(rec.profile).toEqual(sampleProfile())
    expect(rec.jobDescription).toBe('We are hiring a data engineer.')
  })

  it('saveDraft updates draft and updatedAt', async () => {
    const meta = await create(new Date(2026, 9, 29))
    const draft = sampleDraft()
    draft.letter.subject = 'Changed subject'
    const later = new Date(2026, 9, 30)
    const updated = await saveDraft(dataDir, meta.id, draft, later)
    expect(updated.updatedAt).toBe(later.toISOString())
    expect((await loadApplication(dataDir, meta.id)).draft.letter.subject).toBe('Changed subject')
  })

  it('setExported records file names and time', async () => {
    const meta = await create(new Date(2026, 9, 29))
    const when = new Date(2026, 10, 1)
    const updated = await setExported(dataDir, meta.id, { cvPdf: 'cv.pdf', letterPdf: 'letter.pdf' }, when)
    expect(updated).toMatchObject({ cvPdf: 'cv.pdf', letterPdf: 'letter.pdf', exportedAt: when.toISOString() })
    expect((await loadApplication(dataDir, meta.id)).meta.exportedAt).toBe(when.toISOString())
  })
})

describe('applicationDir', () => {
  it('rejects path traversal ids', () => {
    for (const bad of ['..\\x', 'a/b', '', '..']) {
      const err = (() => {
        try {
          applicationDir(dataDir, bad)
          return null
        } catch (e) {
          return e
        }
      })()
      expect(err).toBeInstanceOf(AppError)
      expect((err as AppError).kind).toBe('bad_id')
    }
  })

  it('resolves a normal id inside the applications folder', () => {
    expect(applicationDir(dataDir, '2026-10-29_Acme_Data-Engineer')).toBe(
      join(dataDir, 'applications', '2026-10-29_Acme_Data-Engineer')
    )
  })
})
