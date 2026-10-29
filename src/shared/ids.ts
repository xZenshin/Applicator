import { SECTION_PREFIX, type Profile, type SectionKey } from './types'

/** Returns the next id for a section ("exp_01", …) and a profile with that section's counter bumped. */
export function allocateId(profile: Profile, section: SectionKey): { id: string; profile: Profile } {
  const n = profile.nextIds[section]
  const id = `${SECTION_PREFIX[section]}_${String(n).padStart(2, '0')}`
  return { id, profile: { ...profile, nextIds: { ...profile.nextIds, [section]: n + 1 } } }
}
