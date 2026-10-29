import type { SectionKey } from '../../../shared/types'
import type { ProfileItem } from './profile-edit'

export type FieldKind = 'text' | 'textarea' | 'month' | 'monthOrPresent' | 'lines'
export interface FieldDescriptor {
  key: string
  label: string
  kind: FieldKind
}

export const SECTION_TITLES: Record<SectionKey, string> = {
  skills: 'Technical skills',
  education: 'Education',
  experience: 'Experience'
}

/** Singular nouns for "Add …" buttons. */
export const SECTION_ITEM_NAMES: Record<SectionKey, string> = {
  skills: 'skill',
  education: 'education',
  experience: 'experience'
}

export const SECTION_FIELDS: Record<SectionKey, FieldDescriptor[]> = {
  experience: [
    { key: 'title', label: 'Job title', kind: 'text' },
    { key: 'employer', label: 'Employer', kind: 'text' },
    { key: 'location', label: 'Location', kind: 'text' },
    { key: 'start', label: 'Start', kind: 'month' },
    { key: 'end', label: 'End', kind: 'monthOrPresent' },
    { key: 'bullets', label: 'Description: one line shows as a paragraph, several as bullet points', kind: 'lines' }
  ],
  education: [
    { key: 'degree', label: 'Degree', kind: 'text' },
    { key: 'institution', label: 'Institution', kind: 'text' },
    { key: 'location', label: 'Location', kind: 'text' },
    { key: 'start', label: 'Start', kind: 'month' },
    { key: 'end', label: 'End', kind: 'monthOrPresent' },
    { key: 'details', label: 'Details: one line shows as a paragraph, several as bullet points', kind: 'lines' }
  ],
  skills: [
    { key: 'name', label: 'Skill', kind: 'text' },
    { key: 'category', label: 'Category', kind: 'text' }
  ]
}

/** One-line description of a profile item, e.g. "Data Engineer @ Ørsted A/S". */
export function itemLabel(section: SectionKey, item: ProfileItem): string {
  const i = item as Record<string, string>
  const join = (a: string, sep: string, b: string): string => [a, b].filter(Boolean).join(sep)
  switch (section) {
    case 'experience':
      return join(i.title, ' @ ', i.employer) || 'New experience'
    case 'education':
      return join(i.degree, ', ', i.institution) || 'New education'
    case 'skills':
      return join(i.name, ' · ', i.category) || 'New skill'
  }
}
