import { mkdtemp, readdir, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { exportApplicationPdfs } from '../../src/main/pdf/export'
import { applicationDir, createApplication, loadApplication } from '../../src/main/storage/applications'
import { sampleDraft, sampleProfile } from '../fixtures/sample-data'

let dataDir: string
let id: string
const toPdf = async (html: string): Promise<Buffer> => Buffer.from(html, 'utf8')

beforeEach(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'applicator-export-'))
  const meta = await createApplication(dataDir, {
    jobDescription: 'Posting',
    draft: sampleDraft(),
    profile: sampleProfile(),
    now: new Date(2026, 9, 29)
  })
  id = meta.id
})

describe('exportApplicationPdfs', () => {
  it('writes both PDFs with the expected names and marks exported', async () => {
    const now = new Date(2026, 9, 30, 9, 0)
    const meta = await exportApplicationPdfs({ dataDir, id, html: { cv: '<cv/>', letter: '<letter/>' }, toPdf, now })
    const dir = applicationDir(dataDir, id)
    expect(await readFile(join(dir, 'CV - Jane Doe - Acme.pdf'), 'utf8')).toBe('<cv/>')
    expect(await readFile(join(dir, 'Application - Acme - Data Engineer.pdf'), 'utf8')).toBe('<letter/>')
    expect(meta).toMatchObject({
      exportedAt: now.toISOString(),
      cvPdf: 'CV - Jane Doe - Acme.pdf',
      letterPdf: 'Application - Acme - Data Engineer.pdf'
    })
    expect((await loadApplication(dataDir, id)).meta.exportedAt).toBe(now.toISOString())
  })

  it('re-export overwrites the same files', async () => {
    await exportApplicationPdfs({ dataDir, id, html: { cv: 'v1', letter: 'v1' }, toPdf, now: new Date() })
    const before = (await readdir(applicationDir(dataDir, id))).sort()
    await exportApplicationPdfs({ dataDir, id, html: { cv: 'v2', letter: 'v2' }, toPdf, now: new Date() })
    const after = (await readdir(applicationDir(dataDir, id))).sort()
    expect(after).toEqual(before)
    expect(await readFile(join(applicationDir(dataDir, id), 'CV - Jane Doe - Acme.pdf'), 'utf8')).toBe('v2')
  })
})

describe('export write failures', () => {
  it('reports a PDF that cannot be written as export_failed with advice', async () => {
    const { mkdir } = await import('node:fs/promises')
    await mkdir(join(applicationDir(dataDir, id), 'CV - Jane Doe - Acme.pdf'))
    const e = await exportApplicationPdfs({ dataDir, id, html: { cv: 'x', letter: 'y' }, toPdf, now: new Date() }).catch((x) => x)
    expect(e.kind).toBe('export_failed')
    expect(e.message).toMatch(/close it/i)
    expect(e.message).toContain('CV - Jane Doe - Acme.pdf')
  })
})
