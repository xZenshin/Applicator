import type { Profile } from '../../shared/types'
import { getDataDir } from '../context'
import { loadProfile, saveProfile } from '../storage/profile'
import { handle } from './handle'

export function registerProfileIpc(): void {
  handle('profile:get', async () => loadProfile(await getDataDir()))
  handle('profile:save', async (profile: Profile) => saveProfile(await getDataDir(), profile))
}
