import type { Profile } from './types'

/** Enough data to generate from: a name and at least one experience, education or skill. */
export function isProfileUsable(profile: Profile): boolean {
  return (
    profile.personal.fullName.trim().length > 0 &&
    profile.experience.length + profile.education.length + profile.skills.length > 0
  )
}
