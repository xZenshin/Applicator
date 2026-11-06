import { writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { AppError } from '../../shared/errors'
import { cvPdfName, letterPdfName } from '../../shared/filenames'
import type { ApplicationMeta } from '../../shared/types'
import { applicationDir, loadApplication, setExported } from '../storage/applications'

async function writePdf(dir: string, name: string, data: Buffer): Promise<void> {
  try {
    await writeFile(join(dir, name), data)
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code ?? String(e)
    throw new AppError(
      'export_failed',
      `Could not save "${name}". If it is open in a PDF viewer, close it and export again. (${code})`
    )
  }
}

/**
 * Prints the CV and letter HTML (exactly what the preview shows) to PDFs in the application's folder.
 * A CV-only application has no letter (null). Re-exporting overwrites the same files.
 */
export async function exportApplicationPdfs(a: {
  dataDir: string
  id: string
  html: { cv: string; letter: string | null }
  toPdf: (html: string) => Promise<Buffer>
  now: Date
}): Promise<ApplicationMeta> {
  const { meta, profile } = await loadApplication(a.dataDir, a.id)
  const dir = applicationDir(a.dataDir, a.id)
  const cvPdf = cvPdfName(profile.personal.fullName, meta.company)
  const letterPdf = a.html.letter === null ? null : letterPdfName(meta.company, meta.role)
  const cv = await a.toPdf(a.html.cv)
  const letter = a.html.letter === null ? null : await a.toPdf(a.html.letter)
  await writePdf(dir, cvPdf, cv)
  if (letterPdf && letter) await writePdf(dir, letterPdf, letter)
  return setExported(a.dataDir, a.id, { cvPdf, letterPdf }, a.now)
}

/**
 * Asks where to save, then prints the CV HTML (exactly what the preview shows) there.
 * Returns the saved path, or null if the user cancelled.
 */
export async function saveCvPdf(a: {
  html: string
  defaultPath: string
  choosePath: (defaultPath: string) => Promise<string | null>
  toPdf: (html: string) => Promise<Buffer>
}): Promise<string | null> {
  const path = await a.choosePath(a.defaultPath)
  if (!path) return null
  await writePdf(dirname(path), basename(path), await a.toPdf(a.html))
  return path
}
