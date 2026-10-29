import { app } from 'electron'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { SettingsSchema, type LocateResult, type Settings } from '../shared/types'
import { CLAUDE_MESSAGES, ClaudeError } from './claude/errors'
import { locateClaude, type LocateFs } from './claude/locate'
import type { ClaudeCommand } from './claude/run'
import { resolveDataDir } from './storage/paths'
import { loadSettings, saveSettings } from './storage/settings'

let cachedSettings: Settings | null = null

export async function getSettings(): Promise<Settings> {
  cachedSettings ??= await loadSettings(app.getPath('userData'))
  return cachedSettings
}

export async function updateSettings(settings: Settings): Promise<void> {
  const valid = SettingsSchema.parse(settings)
  await saveSettings(app.getPath('userData'), valid)
  cachedSettings = valid
}

export async function getDataDir(): Promise<string> {
  return resolveDataDir(await getSettings(), app.getPath('documents'))
}

const realFs: LocateFs = {
  exists: existsSync,
  listDir: (p) => {
    try {
      return readdirSync(p)
    } catch {
      return []
    }
  }
}

export async function locate(): Promise<LocateResult> {
  return locateClaude((await getSettings()).claudePath, process.env, realFs)
}

export async function requireClaudeCommand(): Promise<ClaudeCommand> {
  const found = await locate()
  if (found.path) return { file: found.path, prefixArgs: [] }
  if (found.shimOnly) {
    throw new ClaudeError(
      'not_found',
      'Only an npm shim of Claude Code was found. Run `claude install` in a terminal to get the native build, then restart Applicator.'
    )
  }
  throw new ClaudeError('not_found', CLAUDE_MESSAGES.not_found)
}

/** Empty working directory for CLI calls, so no project CLAUDE.md or settings get picked up. */
export function claudeWorkDir(): string {
  return join(app.getPath('userData'), 'claude-workdir')
}
