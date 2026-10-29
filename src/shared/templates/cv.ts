import { SECTION_KEYS, type CvContent, type Profile, type SectionKey } from '../types'
import { htmlDocument } from './document'
import { escapeHtml as e } from './escape'
import { formatRange, formatYearMonth } from './format'
import { safeHref } from './url'

const join = (parts: string[], sep: string): string => parts.filter(Boolean).join(sep)
function anchor(url: string, text: string): string {
  const href = safeHref(url)
  return href ? `<a href="${e(href)}">${e(text)}</a>` : e(text)
}

const bullets = (items: string[]): string =>
  items.length ? `<ul>${items.map((b) => `<li>${e(b)}</li>`).join('')}</ul>` : ''

function lookup<T extends { id: string }>(items: T[]): (id: string) => T | undefined {
  const map = new Map(items.map((i) => [i.id, i]))
  return (id) => map.get(id)
}

/** Renders one section's entries. Text comes from the CV; facts (dates, places, names) from the profile. */
function sectionBody(section: SectionKey, profile: Profile, cv: CvContent, language: string): string {
  const present = cv.labels.present
  switch (section) {
    case 'experience': {
      const find = lookup(profile.experience)
      return cv.experience
        .map((c) => {
          const p = find(c.id)
          if (!p) return ''
          const head = `<strong>${e(c.title)}</strong>${p.employer ? `, ${e(p.employer)}` : ''}${p.location ? ` · ${e(p.location)}` : ''}`
          return `<div class="entry"><div class="entry-head"><div>${head}</div><div class="dates">${e(formatRange(p.start, p.end, language, present))}</div></div>${bullets(c.bullets)}</div>`
        })
        .join('')
    }
    case 'education': {
      const find = lookup(profile.education)
      return cv.education
        .map((c) => {
          const p = find(c.id)
          if (!p) return ''
          const head = `<strong>${e(c.degree)}</strong>${p.institution ? `, ${e(p.institution)}` : ''}${p.location ? ` · ${e(p.location)}` : ''}`
          return `<div class="entry"><div class="entry-head"><div>${head}</div><div class="dates">${e(formatRange(p.start, p.end, language, present))}</div></div>${bullets(c.details)}</div>`
        })
        .join('')
    }
    case 'skills': {
      const find = lookup(profile.skills)
      const groups = new Map<string, string[]>()
      for (const c of cv.skills) {
        if (!find(c.id)) continue
        groups.set(c.category, [...(groups.get(c.category) ?? []), c.name])
      }
      return [...groups]
        .map(([category, names]) => `<p class="line">${category ? `<strong>${e(category)}:</strong> ` : ''}${e(names.join(', '))}</p>`)
        .join('')
    }
    case 'languages': {
      const find = lookup(profile.languages)
      const items = cv.languages.filter((c) => find(c.id)).map((c) => (c.level ? `${c.name} (${c.level})` : c.name))
      return items.length ? `<p class="line">${e(items.join(' · '))}</p>` : ''
    }
    case 'projects': {
      const find = lookup(profile.projects)
      return cv.projects
        .map((c) => {
          const p = find(c.id)
          if (!p) return ''
          const head = `<strong>${e(c.name)}</strong>${c.context ? ` — ${e(c.context)}` : ''}`
          const link = p.url ? `<div class="muted">${anchor(p.url, p.url)}</div>` : ''
          return `<div class="entry"><div class="entry-head"><div>${head}</div><div class="dates">${e(formatYearMonth(p.date, language))}</div></div>${link}${bullets(c.bullets)}</div>`
        })
        .join('')
    }
    case 'certifications': {
      const find = lookup(profile.certifications)
      return cv.certifications
        .map((c) => {
          const p = find(c.id)
          if (!p) return ''
          return `<p class="line">${e(c.name)}${p.issuer ? ` — ${e(p.issuer)}` : ''}${p.date ? `, ${e(formatYearMonth(p.date, language))}` : ''}</p>`
        })
        .join('')
    }
  }
}

export function renderCvHtml(profile: Profile, cv: CvContent, opts: { language: string; fontCss?: string }): string {
  const { personal } = profile
  const links = personal.links
    .filter((l) => l.url || l.label)
    .map((l) => anchor(l.url, l.label || l.url))
  const contact = join([e(personal.location), e(personal.email), e(personal.phone), ...links], ' · ')

  const parts = [
    `<header><h1>${e(personal.fullName)}</h1>`,
    cv.headline ? `<div class="headline">${e(cv.headline)}</div>` : '',
    contact ? `<div class="contact">${contact}</div>` : '',
    `</header>`,
    cv.summary ? `<h2>${e(cv.labels.profile)}</h2><p>${e(cv.summary)}</p>` : ''
  ]
  for (const section of SECTION_KEYS) {
    const body = cv[section].length ? sectionBody(section, profile, cv, opts.language) : ''
    if (body) parts.push(`<section><h2>${e(cv.labels[section])}</h2>${body}</section>`)
  }

  return htmlDocument({
    title: join(['CV', personal.fullName], ' – '),
    language: opts.language,
    bodyClass: 'cv',
    body: parts.join('\n'),
    fontCss: opts.fontCss
  })
}
