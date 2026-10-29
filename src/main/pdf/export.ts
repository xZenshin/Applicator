import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { cvPdfName, letterPdfName } from '../../shared/filenames'
import type { ApplicationMeta } from '../../shared/types'
import { applicationDir, loadApplication, setExported } from '../storage/applications'

/**
 * Prints the CV and letter HTML (exactly what the preview shows) to PDFs in the application's folder.
 * Re-exporting overwrites the same files.
 */
export async function exportApplicationPdfs(a: {
  dataDir: string
  id: string
  html: { cv: string; letter: string }
  toPdf: (html: string) => Promise<Buffer>
  now: Date
}): Promise<ApplicationMeta> {
  const { meta, profile } = await loadApplication(a.dataDir, a.id)
  const dir = applicationDir(a.dataDir, a.id)
  const cvPdf = cvPdfName(profile.personal.fullName, meta.company)
  const letterPdf = letterPdfName(meta.company, meta.role)
  const [cv, letter] = [await a.toPdf(a.html.cv), await a.toPdf(a.html.letter)]
  await writeFile(join(dir, cvPdf), cv)
  await writeFile(join(dir, letterPdf), letter)
  return setExported(a.dataDir, a.id, { cvPdf, letterPdf }, a.now)
}
