import type { ApplicationMeta } from '../../../shared/types'

/** Every whitespace-separated query token must appear in company, role or id (case-insensitive). */
export function filterApplications(list: ApplicationMeta[], query: string): ApplicationMeta[] {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return list
  return list.filter((m) => {
    const haystack = `${m.company} ${m.role} ${m.id}`.toLowerCase()
    return tokens.every((t) => haystack.includes(t))
  })
}
