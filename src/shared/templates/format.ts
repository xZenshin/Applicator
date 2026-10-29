function locale(language: string): string {
  try {
    return Intl.getCanonicalLocales(language)[0] ?? 'en'
  } catch {
    return 'en'
  }
}

const year = (ym: string): string => /^(\d{4})-\d{2}$/.exec(ym)?.[1] ?? ''

/** "2021-03", "present" → "2021 – Present". A missing start or end is left out. */
export function formatYearRange(start: string, end: string, presentLabel: string): string {
  const to = end === 'present' ? presentLabel : year(end)
  return [year(start), to].filter(Boolean).join(' – ')
}

export function formatLetterDate(date: Date, language: string): string {
  return new Intl.DateTimeFormat(locale(language), { dateStyle: 'long' }).format(date)
}
