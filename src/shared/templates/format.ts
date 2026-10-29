function locale(language: string): string {
  try {
    return Intl.getCanonicalLocales(language)[0] ?? 'en'
  } catch {
    return 'en'
  }
}

/** "2021-03" → "Mar 2021" (en) / "mar. 2021" (da). Anything else → "". */
export function formatYearMonth(ym: string, language: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(ym)
  if (!m) return ''
  const date = new Date(Number(m[1]), Number(m[2]) - 1, 1)
  return new Intl.DateTimeFormat(locale(language), { month: 'short', year: 'numeric' }).format(date)
}

export function formatRange(start: string, end: string, language: string, presentLabel: string): string {
  const from = formatYearMonth(start, language)
  const to = end === 'present' ? presentLabel : formatYearMonth(end, language)
  return [from, to].filter(Boolean).join(' – ')
}

export function formatLetterDate(date: Date, language: string): string {
  return new Intl.DateTimeFormat(locale(language), { dateStyle: 'long' }).format(date)
}
