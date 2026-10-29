import { win32 } from 'node:path'
import type { LocateResult } from '../../shared/types'

export interface LocateFs {
  exists(p: string): boolean
  listDir(p: string): string[]
}

const VSCODE_EXT = /^anthropic\.claude-code-(\d+)\.(\d+)\.(\d+)-win32-x64$/

// A copied env object is case-sensitive even on Windows, where PATH is usually spelled "Path".
function getEnv(env: NodeJS.ProcessEnv, name: string): string {
  const key = Object.keys(env).find((k) => k.toUpperCase() === name)
  return (key && env[key]) || ''
}

/** Finds a native claude.exe: Settings override → PATH → ~/.local/bin → newest VS Code extension. */
export function locateClaude(override: string, env: NodeJS.ProcessEnv, fs: LocateFs): LocateResult {
  if (override) {
    return { path: fs.exists(override) ? override : null, source: 'settings', shimOnly: false }
  }

  let shimOnly = false
  const pathDirs = getEnv(env, 'PATH')
    .split(';')
    .map((d) => d.trim().replace(/^"(.*)"$/, '$1'))
    .filter(Boolean)
  for (const dir of pathDirs) {
    const exe = win32.join(dir, 'claude.exe')
    if (fs.exists(exe)) return { path: exe, source: 'path', shimOnly }
    if (fs.exists(win32.join(dir, 'claude.cmd')) || fs.exists(win32.join(dir, 'claude.ps1'))) {
      shimOnly = true
    }
  }

  const home = getEnv(env, 'USERPROFILE')
  if (home) {
    const localBin = win32.join(home, '.local', 'bin', 'claude.exe')
    if (fs.exists(localBin)) return { path: localBin, source: 'local-bin', shimOnly }

    const extDir = win32.join(home, '.vscode', 'extensions')
    const candidates = fs
      .listDir(extDir)
      .map((name) => ({ name, m: VSCODE_EXT.exec(name) }))
      .filter((c): c is { name: string; m: RegExpExecArray } => c.m !== null)
      .map((c) => ({ name: c.name, version: [1, 2, 3].map((i) => Number(c.m[i])) }))
      .sort((a, b) => b.version[0] - a.version[0] || b.version[1] - a.version[1] || b.version[2] - a.version[2])
    for (const c of candidates) {
      const exe = win32.join(extDir, c.name, 'resources', 'native-binary', 'claude.exe')
      if (fs.exists(exe)) return { path: exe, source: 'vscode', shimOnly }
    }
  }

  return { path: null, source: null, shimOnly }
}
