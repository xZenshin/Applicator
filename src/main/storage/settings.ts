import { join } from 'node:path'
import { defaultSettings, SettingsSchema, type Settings } from '../../shared/types'
import { DataFileError, readJsonFile, writeJsonAtomic } from './atomic'

const file = (userDataDir: string): string => join(userDataDir, 'settings.json')

/** The settings file is owned by the app, so an unreadable one just falls back to defaults. */
export async function loadSettings(userDataDir: string): Promise<Settings> {
  try {
    return await readJsonFile(file(userDataDir), SettingsSchema, defaultSettings)
  } catch (e) {
    if (e instanceof DataFileError) return defaultSettings()
    throw e
  }
}

export async function saveSettings(userDataDir: string, settings: Settings): Promise<void> {
  await writeJsonAtomic(file(userDataDir), settings)
}
