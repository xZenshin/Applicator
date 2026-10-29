import { shell } from 'electron'
import { basename, join } from 'node:path'
import { AppError } from '../../shared/errors'
import type { Draft } from '../../shared/types'
import { getDataDir } from '../context'
import { exportApplicationPdfs } from '../pdf/export'
import { htmlToPdf } from '../pdf/print'
import { applicationDir, listApplications, loadApplication, saveDraft } from '../storage/applications'
import { handle } from './handle'
import { openPath } from './open-path'

export function registerApplicationsIpc(): void {
  handle('applications:list', async () => listApplications(await getDataDir()))

  handle('applications:get', async (id: string) => loadApplication(await getDataDir(), id))

  handle('applications:saveDraft', async (id: string, draft: Draft) =>
    saveDraft(await getDataDir(), id, draft, new Date())
  )

  handle('applications:exportPdfs', async (id: string, html: { cv: string; letter: string }) =>
    exportApplicationPdfs({ dataDir: await getDataDir(), id, html, toPdf: htmlToPdf, now: new Date() })
  )

  handle('applications:openFile', async (id: string, fileName: string) => {
    if (!fileName || basename(fileName) !== fileName) throw new AppError('bad_id', `Invalid file name: "${fileName}"`)
    await openPath(join(applicationDir(await getDataDir(), id), fileName))
  })

  handle('applications:showFolder', async (id: string) => openPath(applicationDir(await getDataDir(), id)))

  handle('applications:trash', async (id: string) => shell.trashItem(applicationDir(await getDataDir(), id)))
}
