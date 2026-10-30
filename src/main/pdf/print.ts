import { BrowserWindow } from 'electron'
import { randomBytes } from 'node:crypto'
import { rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/** Loads a self-contained HTML document in a hidden window, waits for its embedded fonts, and runs `task` on it. */
export async function withDocument<T>(html: string, task: (window: BrowserWindow) => Promise<T>): Promise<T> {
  const file = join(tmpdir(), `applicator-print-${randomBytes(6).toString('hex')}.html`)
  await writeFile(file, html, 'utf8')
  // JavaScript is only used to wait for the fonts and to measure; the document itself contains no scripts.
  const window = new BrowserWindow({ show: false, webPreferences: { sandbox: true, javascript: true } })
  try {
    await window.loadFile(file)
    await window.webContents.executeJavaScript('document.fonts.ready.then(() => true)')
    return await task(window)
  } finally {
    window.destroy()
    await rm(file, { force: true }).catch(() => {})
  }
}

/** Prints a self-contained HTML document to an A4 PDF using Chromium. */
export function htmlToPdf(html: string): Promise<Buffer> {
  return withDocument(html, (window) =>
    window.webContents.printToPDF({ pageSize: 'A4', printBackground: true, preferCSSPageSize: true })
  )
}
