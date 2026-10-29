import { allocateId } from '../../../shared/ids'
import type { Profile, SectionKey } from '../../../shared/types'

export type ProfileItem<S extends SectionKey = SectionKey> = Profile[S][number]

function blankItem(section: SectionKey, id: string): ProfileItem {
  switch (section) {
    case 'experience':
      return { id, title: '', employer: '', location: '', start: '', end: '', bullets: [] }
    case 'education':
      return { id, degree: '', institution: '', location: '', start: '', end: '', details: [] }
    case 'skills':
      return { id, name: '', category: '' }
  }
}

export function addItem(profile: Profile, section: SectionKey): { profile: Profile; id: string } {
  const { id, profile: next } = allocateId(profile, section)
  return { id, profile: { ...next, [section]: [...next[section], blankItem(section, id)] } }
}

export function updateItem(
  profile: Profile,
  section: SectionKey,
  id: string,
  patch: Record<string, unknown>
): Profile {
  const items = (profile[section] as ProfileItem[]).map((item) =>
    item.id === id ? { ...item, ...patch } : item
  )
  return { ...profile, [section]: items }
}

/** Removes an item; nextIds stays as is so the id is never handed out again. */
export function removeItem(profile: Profile, section: SectionKey, id: string): Profile {
  return { ...profile, [section]: (profile[section] as ProfileItem[]).filter((item) => item.id !== id) }
}

export function moveItem<T extends { id: string }>(items: T[], id: string, delta: -1 | 1): T[] {
  const from = items.findIndex((item) => item.id === id)
  const to = from + delta
  if (from < 0 || to < 0 || to >= items.length) return items
  const next = [...items]
  ;[next[from], next[to]] = [next[to], next[from]]
  return next
}
