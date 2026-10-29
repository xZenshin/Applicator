import { SECTION_KEYS, type CvContent, type Profile, type SectionKey } from '../../shared/types'

/** Keeps only ids that exist in the matching profile section, first occurrence only. */
export function sanitizeCv(profile: Profile, cv: CvContent): { cv: CvContent; warnings: string[] } {
  const warnings: string[] = []
  const clean = { ...cv } as CvContent
  for (const section of SECTION_KEYS) {
    const known = new Set((profile[section] as { id: string }[]).map((item) => item.id))
    const seen = new Set<string>()
    const kept = (cv[section] as { id: string }[]).filter((item) => {
      if (!known.has(item.id)) {
        warnings.push(`Left out "${item.id}": Claude listed it under ${section}, but it is not in that section of your CV data.`)
        return false
      }
      if (seen.has(item.id)) {
        warnings.push(`Left out a duplicate of "${item.id}" in ${section}.`)
        return false
      }
      seen.add(item.id)
      return true
    })
    ;(clean as unknown as Record<SectionKey, unknown[]>)[section] = kept
  }
  return { cv: clean, warnings }
}

/** "da-DK" → "da". Anything that isn't a language code becomes "en" with a warning. */
export function normalizeLanguage(code: string): { language: string; warning?: string } {
  const match = /^([a-z]{2,3})(-[a-z0-9]+)*$/i.exec(code.trim())
  if (match) return { language: match[1].toLowerCase() }
  return {
    language: 'en',
    warning: `Claude reported the posting's language as "${code}", which is not a language code; dates are formatted in English.`
  }
}
