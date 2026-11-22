import { BrowserWindow, dialog, shell, type OpenDialogOptions } from 'electron'
import { existsSync } from 'node:fs'
import { AppError } from '../../shared/errors'
import { INTERVIEW_FEEDBACK, INTERVIEW_MODES, type NewInterviewSession } from '../../shared/types'
import { getDataDir, makeAppChatFn } from '../context'
import { sendInterviewMessage, writeInterviewReport } from '../interview'
import { loadApplication } from '../storage/applications'
import {
  addPdfs,
  createSession,
  listSessions,
  loadMaterials,
  loadSession,
  pdfPath,
  removePdf,
  saveMaterialsText,
  sessionPath
} from '../storage/interview'
import { withClaude } from './claude-lock'
import { handle } from './handle'
import { openPath } from './open-path'

async function pickPdfs(): Promise<string[]> {
  const options: OpenDialogOptions = {
    title: 'Add preparation material',
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'PDF documents', extensions: ['pdf'] }]
  }
  const window = BrowserWindow.getFocusedWindow()
  const result = window ? await dialog.showOpenDialog(window, options) : await dialog.showOpenDialog(options)
  return result.canceled ? [] : result.filePaths
}

function parseNewSession(input: Partial<NewInterviewSession> | undefined): NewInterviewSession {
  const mode = INTERVIEW_MODES.find((m) => m === input?.mode)
  const feedback = INTERVIEW_FEEDBACK.find((f) => f === input?.feedback)
  if (!mode || !feedback) throw new AppError('bad_input', 'Choose how the session should run.')
  return { mode, feedback, focus: String(input?.focus ?? '') }
}

export function registerInterviewIpc(): void {
  handle('interview:getMaterials', async (appId: string) => loadMaterials(await getDataDir(), appId))

  handle('interview:saveMaterialsText', async (appId: string, text: string) =>
    saveMaterialsText(await getDataDir(), appId, String(text ?? ''))
  )

  handle('interview:addPdfs', async (appId: string) => {
    const dataDir = await getDataDir()
    await loadApplication(dataDir, appId) // fails before the dialog opens if the application is gone
    const paths = await pickPdfs()
    return paths.length ? addPdfs(dataDir, appId, paths, new Date()) : loadMaterials(dataDir, appId)
  })

  handle('interview:removePdf', async (appId: string, fileId: string) => removePdf(await getDataDir(), appId, fileId))

  handle('interview:openPdf', async (appId: string, fileId: string) => openPath(pdfPath(await getDataDir(), appId, fileId)))

  handle('interview:listSessions', async (appId: string) => listSessions(await getDataDir(), appId))

  handle('interview:getSession', async (appId: string, sessionId: string) =>
    loadSession(await getDataDir(), appId, sessionId)
  )

  handle('interview:createSession', async (appId: string, input: Partial<NewInterviewSession>) => {
    const dataDir = await getDataDir()
    await loadApplication(dataDir, appId)
    return createSession(dataDir, appId, parseNewSession(input), new Date())
  })

  handle('interview:send', (appId: string, sessionId: string, text: string) =>
    withClaude(async (signal) =>
      sendInterviewMessage({
        chat: await makeAppChatFn(signal),
        dataDir: await getDataDir(),
        appId,
        sessionId,
        text: String(text ?? ''),
        now: () => new Date()
      })
    )
  )

  handle('interview:report', (appId: string, sessionId: string) =>
    withClaude(async (signal) =>
      writeInterviewReport({
        chat: await makeAppChatFn(signal),
        dataDir: await getDataDir(),
        appId,
        sessionId,
        now: () => new Date()
      })
    )
  )

  handle('interview:deleteSession', async (appId: string, sessionId: string) => {
    const path = sessionPath(await getDataDir(), appId, sessionId)
    if (existsSync(path)) await shell.trashItem(path)
  })
}
