import type { SectionKey } from '../../../shared/types'
import type { ProfileItem } from './profile-edit'

export type FieldKind = 'text' | 'textarea' | 'month' | 'monthOrPresent' | 'lines'
export interface FieldDescriptor {
  key: string
  label: string
  kind: FieldKind
}

export const SECTION_TITLES: Record<SectionKey, string> = {
  experience: 'Experience',
  education: 'Education',
  skills: 'Skills',
  languages: 'Languages',
  projects: 'Projects',
  certifications: 'Certifications & courses'
}

/** Singular nouns for "Add …" buttons. */
export const SECTION_ITEM_NAMES: Record<SectionKey, string> = {
  experience: 'experience',
  education: 'education',
  skills: 'skill',
  languages: 'language',
  projects: 'project',
  certifications: 'certification or course'
}

export const SECTION_FIELDS: Record<SectionKey, FieldDescriptor[]> = {
  experience: [
    { key: 'title', label: 'Job title', kind: 'text' },
    { key: 'employer', label: 'Employer', kind: 'text' },
    { key: 'location', label: 'Location', kind: 'text' },
    { key: 'start', label: 'Start', kind: 'month' },
    { key: 'end', label: 'End', kind: 'monthOrPresent' },
    { key: 'bullets', label: 'Bullet points, one per line', kind: 'lines' }
  ],
  education: [
    { key: 'degree', label: 'Degree', kind: 'text' },
    { key: 'institution', label: 'Institution', kind: 'text' },
    { key: 'location', label: 'Location', kind: 'text' },
    { key: 'start', label: 'Start', kind: 'month' },
    { key: 'end', label: 'End', kind: 'monthOrPresent' },
    { key: 'details', label: 'Details, one per line', kind: 'lines' }
  ],
  skills: [
    { key: 'name', label: 'Skill', kind: 'text' },
    { key: 'category', label: 'Category', kind: 'text' }
  ],
  languages: [
    { key: 'name', label: 'Language', kind: 'text' },
    { key: 'level', label: 'Level', kind: 'text' }
  ],
  projects: [
    { key: 'name', label: 'Project name', kind: 'text' },
    { key: 'context', label: 'Context (e.g. side project, course)', kind: 'text' },
    { key: 'url', label: 'Link', kind: 'text' },
    { key: 'date', label: 'Date', kind: 'month' },
    { key: 'bullets', label: 'Bullet points, one per line', kind: 'lines' }
  ],
  certifications: [
    { key: 'name', label: 'Name', kind: 'text' },
    { key: 'issuer', label: 'Issuer', kind: 'text' },
    { key: 'date', label: 'Date', kind: 'month' }
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
    case 'languages':
      return join(i.name, ' · ', i.level) || 'New language'
    case 'projects':
      return join(i.name, ' — ', i.context) || 'New project'
    case 'certifications':
      return join(i.name, ' — ', i.issuer) || 'New certification'
  }
}
