import { app, BrowserWindow, dialog, shell, type SaveDialogOptions } from 'electron'
import { join } from 'node:path'
import { cvPdfName } from '../../shared/filenames'
import type { Profile } from '../../shared/types'
import { getDataDir } from '../context'
import { saveCvPdf } from '../pdf/export'
import { htmlToPdf } from '../pdf/print'
import { loadProfile, saveProfile } from '../storage/profile'
import { handle } from './handle'
import { openPath } from './open-path'

async function chooseSavePath(defaultPath: string): Promise<string | null> {
  const options: SaveDialogOptions = { title: 'Save CV as PDF', defaultPath, filters: [{ name: 'PDF', extensions: ['pdf'] }] }
  const window = BrowserWindow.getFocusedWindow()
  const result = window ? await dialog.showSaveDialog(window, options) : await dialog.showSaveDialog(options)
  return result.canceled || !result.filePath ? null : result.filePath
}

export function registerProfileIpc(): void {
  // Kept here rather than taken from the renderer, so it can only open a file the user just saved.
  let lastPdf: string | null = null

  handle('profile:get', async () => loadProfile(await getDataDir()))
  handle('profile:save', async (profile: Profile) => saveProfile(await getDataDir(), profile))

  handle('profile:exportPdf', async (html: string) => {
    const { personal } = await loadProfile(await getDataDir())
    const defaultPath = join(app.getPath('downloads'), cvPdfName(personal.fullName))
    const saved = await saveCvPdf({ html, defaultPath, choosePath: chooseSavePath, toPdf: htmlToPdf })
    if (saved) lastPdf = saved
    return saved
  })

  handle('profile:openPdf', async () => {
    if (lastPdf) await openPath(lastPdf)
  })

  handle('profile:showPdf', async () => {
    if (lastPdf) shell.showItemInFolder(lastPdf)
  })
}
