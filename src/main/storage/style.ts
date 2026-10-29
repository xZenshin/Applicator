import { join } from 'node:path'
import { emptyStyle, StyleSchema, type Style } from '../../shared/types'
import { readJsonFile, writeJsonAtomic } from './atomic'

const file = (dataDir: string): string => join(dataDir, 'style.json')

export function loadStyle(dataDir: string): Promise<Style> {
  return readJsonFile(file(dataDir), StyleSchema, emptyStyle)
}

export async function saveStyle(dataDir: string, style: Style): Promise<void> {
  await writeJsonAtomic(file(dataDir), StyleSchema.parse(style))
}
