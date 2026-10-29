import { randomBytes } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { z } from 'zod'
import { AppError } from '../../shared/errors'

/** A data file exists but can't be used. The app must not overwrite it. */
export class DataFileError extends AppError {
  constructor(
    readonly filePath: string,
    detail: string
  ) {
    super('data_file', `Could not read ${filePath}: ${detail}. Fix or remove the file, then reload.`)
    this.name = 'DataFileError'
  }
}

const RETRYABLE = new Set(['EPERM', 'EBUSY', 'EACCES'])

// On Windows, replacing a file can briefly fail while another process (antivirus, an editor) holds it.
async function renameWithRetry(from: string, to: string): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await rename(from, to)
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code ?? ''
      if (!RETRYABLE.has(code) || attempt >= 4) throw e
      await new Promise((r) => setTimeout(r, 50 * (attempt + 1)))
    }
  }
}

export async function writeTextAtomic(filePath: string, text: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true })
  const tmp = `${filePath}.tmp-${randomBytes(6).toString('hex')}`
  await writeFile(tmp, text, 'utf8')
  try {
    await renameWithRetry(tmp, filePath)
  } catch (e) {
    await rm(tmp, { force: true })
    throw e
  }
}

export async function writeJsonAtomic(filePath: string, data: unknown): Promise<void> {
  await writeTextAtomic(filePath, JSON.stringify(data, null, 2) + '\n')
}

/** Missing file → `fallback()`. Unparseable or wrong shape → DataFileError. */
export async function readJsonFile<T>(
  filePath: string,
  schema: z.ZodType<T>,
  fallback: () => T
): Promise<T> {
  let text: string
  try {
    text = await readFile(filePath, 'utf8')
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return fallback()
    throw e
  }
  let data: unknown
  try {
    data = JSON.parse(text.replace(/^﻿/, ''))
  } catch {
    throw new DataFileError(filePath, 'it is not valid JSON')
  }
  const result = schema.safeParse(data)
  if (!result.success) {
    const issue = result.error.issues[0]
    throw new DataFileError(filePath, `unexpected content at "${issue?.path.join('.')}" (${issue?.message})`)
  }
  return result.data
}
