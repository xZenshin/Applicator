import { BrowserWindow } from 'electron'
import { randomBytes } from 'node:crypto'
import { rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/** Prints a self-contained HTML document to an A4 PDF using Chromium. */
export async function htmlToPdf(html: string): Promise<Buffer> {
  const file = join(tmpdir(), `applicator-print-${randomBytes(6).toString('hex')}.html`)
  await writeFile(file, html, 'utf8')
  // JavaScript is only used to wait for the embedded fonts; the document itself contains no scripts.
  const window = new BrowserWindow({ show: false, webPreferences: { sandbox: true, javascript: true } })
  try {
    await window.loadFile(file)
    await window.webContents.executeJavaScript('document.fonts.ready.then(() => true)')
    return await window.webContents.printToPDF({ pageSize: 'A4', printBackground: true, preferCSSPageSize: true })
  } finally {
    window.destroy()
    await rm(file, { force: true }).catch(() => {})
  }
}
