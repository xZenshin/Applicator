import { describe, expect, it } from 'vitest'
import { locateClaude, type LocateFs } from '../../src/main/claude/locate'

const HOME = 'C:\\Users\\x'
const LOCAL_BIN = 'C:\\Users\\x\\.local\\bin\\claude.exe'
const EXT_DIR = 'C:\\Users\\x\\.vscode\\extensions'
const vscodeExe = (v: string): string =>
  `${EXT_DIR}\\anthropic.claude-code-${v}-win32-x64\\resources\\native-binary\\claude.exe`

function fakeFs(files: string[], dirs: Record<string, string[]> = {}): LocateFs {
  const set = new Set(files.map((f) => f.toLowerCase()))
  return { exists: (p) => set.has(p.toLowerCase()), listDir: (p) => dirs[p] ?? [] }
}

const env = (path = ''): NodeJS.ProcessEnv => ({ PATH: path, USERPROFILE: HOME })

describe('locateClaude', () => {
  it('override wins when it exists', () => {
    expect(locateClaude('D:\\tools\\claude.exe', env('C:\\b'), fakeFs(['D:\\tools\\claude.exe', 'C:\\b\\claude.exe']))).toEqual({
      path: 'D:\\tools\\claude.exe',
      source: 'settings',
      shimOnly: false
    })
  })

  it('missing override returns null with source settings', () => {
    expect(locateClaude('D:\\nope.exe', env('C:\\b'), fakeFs(['C:\\b\\claude.exe']))).toEqual({
      path: null,
      source: 'settings',
      shimOnly: false
    })
  })

  it('finds claude.exe on PATH', () => {
    expect(locateClaude('', env('C:\\a;C:\\b'), fakeFs(['C:\\b\\claude.exe']))).toEqual({
      path: 'C:\\b\\claude.exe',
      source: 'path',
      shimOnly: false
    })
  })

  it('reads PATH case-insensitively (Windows uses "Path")', () => {
    const e = { Path: 'C:\\b', USERPROFILE: HOME }
    expect(locateClaude('', e, fakeFs(['C:\\b\\claude.exe'])).path).toBe('C:\\b\\claude.exe')
  })

  it('cmd shim on PATH sets shimOnly and keeps searching', () => {
    expect(locateClaude('', env('C:\\npm'), fakeFs(['C:\\npm\\claude.cmd', LOCAL_BIN]))).toEqual({
      path: LOCAL_BIN,
      source: 'local-bin',
      shimOnly: true
    })
    expect(locateClaude('', env('C:\\npm'), fakeFs(['C:\\npm\\claude.cmd']))).toEqual({
      path: null,
      source: null,
      shimOnly: true
    })
  })

  it('falls back to ~/.local/bin', () => {
    expect(locateClaude('', env('C:\\a'), fakeFs([LOCAL_BIN]))).toEqual({
      path: LOCAL_BIN,
      source: 'local-bin',
      shimOnly: false
    })
  })

  it('picks the highest VS Code extension version', () => {
    const fs = fakeFs([vscodeExe('2.1.9'), vscodeExe('2.1.312')], {
      [EXT_DIR]: [
        'anthropic.claude-code-2.1.9-win32-x64',
        'anthropic.claude-code-2.1.312-win32-x64',
        'ms-python.python-2026.1.0'
      ]
    })
    expect(locateClaude('', env(''), fs)).toEqual({
      path: vscodeExe('2.1.312'),
      source: 'vscode',
      shimOnly: false
    })
  })

  it('returns nothing when no claude is installed', () => {
    expect(locateClaude('', env('C:\\a'), fakeFs([]))).toEqual({ path: null, source: null, shimOnly: false })
  })
})
