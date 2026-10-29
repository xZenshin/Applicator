import { describe, expect, it } from 'vitest'
import { ClaudeError } from '../../src/main/claude/errors'
import { wrap } from '../../src/main/ipc/wrap'
import { DataFileError } from '../../src/main/storage/atomic'
import { AppError } from '../../src/shared/errors'

describe('wrap', () => {
  it('returns ok value', async () => {
    expect(await wrap(async () => 42)).toEqual({ ok: true, value: 42 })
  })

  it('keeps AppError kind and message', async () => {
    expect(await wrap(async () => Promise.reject(new AppError('busy', 'Wait.')))).toEqual({
      ok: false,
      error: { kind: 'busy', message: 'Wait.' }
    })
  })

  it('keeps subclass kinds (ClaudeError, DataFileError)', async () => {
    const claude = await wrap(async () => Promise.reject(new ClaudeError('usage_limit', 'Limit.')))
    expect(claude).toEqual({ ok: false, error: { kind: 'usage_limit', message: 'Limit.' } })
    const data = await wrap(async () => Promise.reject(new DataFileError('C:\\x\\profile.json', 'bad')))
    expect(data.ok).toBe(false)
    if (!data.ok) {
      expect(data.error.kind).toBe('data_file')
      expect(data.error.message).toContain('profile.json')
    }
  })

  it('maps unknown errors to kind unknown', async () => {
    expect(await wrap(async () => Promise.reject(new Error('kaboom')))).toEqual({
      ok: false,
      error: { kind: 'unknown', message: 'kaboom' }
    })
  })
})
