import { mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { z } from 'zod'
import { DataFileError, readJsonFile, writeJsonAtomic } from '../../src/main/storage/atomic'
import { resolveDataDir } from '../../src/main/storage/paths'
import { loadProfile, saveProfile } from '../../src/main/storage/profile'
import { loadSettings, saveSettings } from '../../src/main/storage/settings'
import { loadStyle, saveStyle } from '../../src/main/storage/style'
import { defaultSettings, emptyProfile, emptyStyle } from '../../src/shared/types'
import { sampleProfile, sampleStyle } from '../fixtures/sample-data'

let dir: string
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'applicator-test-'))
})

describe('atomic JSON files', () => {
  it('writeJsonAtomic round-trips and leaves no .tmp- files', async () => {
    const file = join(dir, 'nested', 'data.json')
    await writeJsonAtomic(file, { a: 1, text: 'Ærø' })
    expect(await readJsonFile(file, z.object({ a: z.number(), text: z.string() }), () => ({ a: 0, text: '' }))).toEqual({
      a: 1,
      text: 'Ærø'
    })
    expect((await readdir(join(dir, 'nested'))).filter((f) => f.includes('.tmp-'))).toEqual([])
  })

  it('readJsonFile throws DataFileError when the shape is wrong', async () => {
    const file = join(dir, 'x.json')
    await writeFile(file, '{"a":"not a number"}')
    await expect(readJsonFile(file, z.object({ a: z.number() }), () => ({ a: 0 }))).rejects.toBeInstanceOf(
      DataFileError
    )
  })
})

describe('profile', () => {
  it('loadProfile returns emptyProfile() when the file is missing', async () => {
    expect(await loadProfile(dir)).toEqual(emptyProfile())
  })

  it('loadProfile throws DataFileError on invalid JSON and leaves the file untouched', async () => {
    const file = join(dir, 'profile.json')
    await writeFile(file, '{ broken')
    const err = await loadProfile(dir).catch((e) => e)
    expect(err).toBeInstanceOf(DataFileError)
    expect(err.kind).toBe('data_file')
    expect(err.message).toContain('profile.json')
    expect(await readFile(file, 'utf8')).toBe('{ broken')
  })

  it('saveProfile/loadProfile round-trips sampleProfile()', async () => {
    await saveProfile(dir, sampleProfile())
    expect(await loadProfile(dir)).toEqual(sampleProfile())
  })
})

describe('style', () => {
  it('returns emptyStyle() when missing and round-trips', async () => {
    expect(await loadStyle(dir)).toEqual(emptyStyle())
    await saveStyle(dir, sampleStyle())
    expect(await loadStyle(dir)).toEqual(sampleStyle())
  })
})

describe('settings', () => {
  it('loadSettings falls back to defaults on an invalid file', async () => {
    await writeFile(join(dir, 'settings.json'), 'nonsense')
    expect(await loadSettings(dir)).toEqual(defaultSettings())
  })

  it('round-trips', async () => {
    const s = { claudePath: 'C:\\claude.exe', model: 'opus' as const, dataDir: '' }
    await saveSettings(dir, s)
    expect(await loadSettings(dir)).toEqual(s)
  })
})

describe('resolveDataDir', () => {
  it('defaults to Documents\\Applicator and honours an override', () => {
    expect(resolveDataDir(defaultSettings(), 'C:\\Users\\x\\Documents')).toBe(
      join('C:\\Users\\x\\Documents', 'Applicator')
    )
    expect(resolveDataDir({ ...defaultSettings(), dataDir: 'D:\\Jobs' }, 'C:\\Docs')).toBe('D:\\Jobs')
  })
})
