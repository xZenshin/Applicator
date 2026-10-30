import { SECTION_KEYS, type CvContent, type Profile, type SectionKey } from '../types'
import { CV_CSS } from './base-css'
import { htmlDocument } from './document'
import { escapeHtml as e } from './escape'
import { formatYearRange } from './format'
import { renderHeader } from './header'

const join = (parts: string[], sep: string): string => parts.filter(Boolean).join(sep)

/** A single line reads as a paragraph; several become a bulleted list. */
function text(lines: string[]): string {
  if (lines.length === 0) return ''
  if (lines.length === 1) return `<p>${e(lines[0])}</p>`
  return `<ul>${lines.map((l) => `<li>${e(l)}</li>`).join('')}</ul>`
}

function lookup<T extends { id: string }>(items: T[]): (id: string) => T | undefined {
  const map = new Map(items.map((i) => [i.id, i]))
  return (id) => map.get(id)
}

function entry(title: string, dates: string, place: string, body: string): string {
  const head = `<strong>${e(title)}</strong>${dates ? ` <span class="dates">${e(dates)}</span>` : ''}`
  return `<div class="entry"><div class="entry-title">${head}</div>${place ? `<div class="entry-place">${e(place)}</div>` : ''}${body}</div>`
}

/** Renders one section's entries. Text comes from the CV; facts (dates, places, names) from the profile. */
function sectionBody(section: SectionKey, profile: Profile, cv: CvContent): string {
  const present = cv.labels.present
  switch (section) {
    case 'skills': {
      const find = lookup(profile.skills)
      const groups = new Map<string, string[]>()
      for (const c of cv.skills) {
        if (!find(c.id)) continue
        groups.set(c.category, [...(groups.get(c.category) ?? []), c.name])
      }
      if (groups.size === 0) return ''
      const items = [...groups].map(
        ([category, names]) => `<li>${category ? `<strong>${e(category)}</strong>: ` : ''}${e(names.join(', '))}</li>`
      )
      return `<ul>${items.join('')}</ul>`
    }
    case 'education': {
      const find = lookup(profile.education)
      return cv.education
        .map((c) => {
          const p = find(c.id)
          if (!p) return ''
          return entry(c.degree, formatYearRange(p.start, p.end, present), join([p.institution, p.location], ' | '), text(c.details))
        })
        .join('')
    }
    case 'experience': {
      const find = lookup(profile.experience)
      return cv.experience
        .map((c) => {
          const p = find(c.id)
          if (!p) return ''
          return entry(c.title, formatYearRange(p.start, p.end, present), join([p.employer, p.location], ' | '), text(c.bullets))
        })
        .join('')
    }
  }
}

export function renderCvHtml(profile: Profile, cv: CvContent, opts: { language: string; fontCss?: string }): string {
  const { personal } = profile
  const parts = [renderHeader(personal), cv.summary ? `<section class="intro"><p>${e(cv.summary)}</p></section>` : '']
  for (const section of SECTION_KEYS) {
    const body = cv[section].length ? sectionBody(section, profile, cv) : ''
    if (body) parts.push(`<section><h2>${e(cv.labels[section])}</h2>${body}</section>`)
  }

  return htmlDocument({
    title: join(['CV', personal.fullName], ' – '),
    language: opts.language,
    bodyClass: 'cv',
    body: parts.join('\n'),
    css: CV_CSS,
    fontCss: opts.fontCss
  })
}
