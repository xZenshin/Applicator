import type { CvContent, Profile, SectionKey } from '../../../shared/types'
import { moveItem } from './profile-edit'

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
    case 'languages': {
      const p = find(profile.languages)
      return { id, name: p.name, level: p.level }
    }
    case 'projects': {
      const p = find(profile.projects)
      return { id, name: p.name, context: p.context, bullets: p.bullets }
    }
    case 'certifications': {
      const p = find(profile.certifications)
      return { id, name: p.name }
    }
  }
}

const entries = (cv: CvContent, section: SectionKey): CvEntry[] => cv[section] as CvEntry[]
const withEntries = (cv: CvContent, section: SectionKey, items: CvEntry[]): CvContent =>
  ({ ...cv, [section]: items }) as CvContent

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
