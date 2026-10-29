import { SECTION_KEYS, type CvLabels, type CvContent, type Profile, type SectionKey } from '../../../shared/types'
import { moveItem, type ProfileItem } from './profile-edit'

export type CvEntry<S extends SectionKey = SectionKey> = CvContent[S][number]

/** The CV entry for a profile item, using its original (untailored) text. */
export function entryFromProfile(profile: Profile, section: SectionKey, id: string): CvEntry {
  const find = <T extends { id: string }>(items: T[]): T => {
    const item = items.find((i) => i.id === id)
    if (!item) throw new Error(`No ${section} item with id ${id}`)
    return item
  }
  switch (section) {
    case 'experience': {
      const p = find(profile.experience)
      return { id, title: p.title, bullets: p.bullets }
    }
    case 'education': {
      const p = find(profile.education)
      return { id, degree: p.degree, details: p.details }
    }
    case 'skills': {
      const p = find(profile.skills)
      return { id, name: p.name, category: p.category }
    }
  }
}

const ENGLISH_LABELS: CvLabels = {
  skills: 'Technical Skills',
  education: 'Education',
  experience: 'Experience',
  present: 'Present'
}

const isBlank = (item: ProfileItem): boolean =>
  Object.entries(item).every(([key, value]) => key === 'id' || value === '' || (Array.isArray(value) && value.length === 0))

const entries = (cv: CvContent, section: SectionKey): CvEntry[] => cv[section] as CvEntry[]
const withEntries = (cv: CvContent, section: SectionKey, items: CvEntry[]): CvContent =>
  ({ ...cv, [section]: items }) as CvContent

/** The whole profile as an untailored CV, for previewing everything entered so far. */
export function cvFromProfile(profile: Profile): CvContent {
  const empty: CvContent = { summary: profile.summary, skills: [], education: [], experience: [], labels: ENGLISH_LABELS }
  return SECTION_KEYS.reduce((cv, section) => {
    const items = (profile[section] as ProfileItem[]).filter((item) => !isBlank(item))
    return withEntries(cv, section, items.map((item) => entryFromProfile(profile, section, item.id)))
  }, empty)
}

/** Removes the item if it's in the CV; otherwise appends it with its original text. */
export function toggleCvItem(
  cv: CvContent,
  profile: Profile,
  section: SectionKey,
  id: string
): { cv: CvContent; added: boolean } {
  const current = entries(cv, section)
  if (current.some((e) => e.id === id)) {
    return { cv: withEntries(cv, section, current.filter((e) => e.id !== id)), added: false }
  }
  return { cv: withEntries(cv, section, [...current, entryFromProfile(profile, section, id)]), added: true }
}

export function moveCvItem(cv: CvContent, section: SectionKey, id: string, delta: -1 | 1): CvContent {
  return withEntries(cv, section, moveItem(entries(cv, section), id, delta))
}

export function updateCvItem(cv: CvContent, section: SectionKey, id: string, patch: Record<string, unknown>): CvContent {
  return withEntries(
    cv,
    section,
    entries(cv, section).map((e) => (e.id === id ? ({ ...e, ...patch } as CvEntry) : e))
  )
}

/** Paragraphs are separated by blank lines; single line breaks stay inside a paragraph. */
export function textToParagraphs(text: string): string[] {
  return text
    .split(/\r?\n\s*\r?\n/)
    .map((p) => p.trim())
    .filter(Boolean)
}

export function paragraphsToText(paragraphs: string[]): string {
  return paragraphs.join('\n\n')
}
