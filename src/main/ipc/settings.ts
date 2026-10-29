import { BrowserWindow, dialog, type OpenDialogOptions } from 'electron'
import type { ConnectionResult, SettingsView } from '../../shared/api'
import { AppError } from '../../shared/errors'
import type { Settings } from '../../shared/types'
import { testConnection } from '../connection'
import {
  claudeWorkDir,
  getDataDir,
  getSettings,
  locate,
  requireClaudeCommand,
  updateSettings
} from '../context'
import { handle } from './handle'

async function settingsView(): Promise<SettingsView> {
  return { settings: await getSettings(), claude: await locate(), dataDir: await getDataDir() }
}

async function pick(options: OpenDialogOptions): Promise<string | null> {
  const window = BrowserWindow.getFocusedWindow()
  const result = window ? await dialog.showOpenDialog(window, options) : await dialog.showOpenDialog(options)
  return result.canceled ? null : (result.filePaths[0] ?? null)
}

export function registerSettingsIpc(): void {
  handle('settings:get', settingsView)

  handle('settings:save', async (settings: Settings) => {
    await updateSettings(settings)
    return settingsView()
  })

  handle('settings:testConnection', async (): Promise<ConnectionResult> => {
    try {
      const command = await requireClaudeCommand()
      return await testConnection({ command, cwd: claudeWorkDir(), model: (await getSettings()).model })
    } catch (e) {
      if (e instanceof AppError) return { ok: false, message: e.message }
      throw e
    }
  })

  handle('settings:pickFile', () =>
    pick({
      title: 'Select claude.exe',
      properties: ['openFile'],
      filters: [{ name: 'Claude Code', extensions: ['exe'] }]
    })
  )

  handle('settings:pickFolder', () =>
    pick({ title: 'Select data folder', properties: ['openDirectory', 'createDirectory'] })
  )
}
