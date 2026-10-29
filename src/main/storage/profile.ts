import { join } from 'node:path'
import { emptyProfile, ProfileSchema, type Profile } from '../../shared/types'
import { readJsonFile, writeJsonAtomic } from './atomic'

const file = (dataDir: string): string => join(dataDir, 'profile.json')

export function loadProfile(dataDir: string): Promise<Profile> {
  return readJsonFile(file(dataDir), ProfileSchema, emptyProfile)
}

export async function saveProfile(dataDir: string, profile: Profile): Promise<void> {
  await writeJsonAtomic(file(dataDir), ProfileSchema.parse(profile))
}
