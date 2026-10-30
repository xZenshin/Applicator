import type { Personal } from '../types'
import { escapeHtml as e } from './escape'
import { safeHref } from './url'

function anchor(url: string, text: string): string {
  const href = safeHref(url)
  return href ? `<a href="${e(href)}">${e(text)}</a>` : e(text)
}

/** "Anna Marie Jensen" → "Anna Marie<br>Jensen": the last name gets its own line. */
function nameLines(fullName: string): string {
  const m = /^(.*\S)\s+(\S+)$/.exec(fullName.trim())
  return m ? `${e(m[1])}<br>${e(m[2])}` : e(fullName.trim())
}

/** The name, with the contact line to its right: the top of both the CV and the letter. */
export function renderHeader(personal: Personal): string {
  const links = personal.links.filter((l) => l.url || l.label).map((l) => anchor(l.url, l.label || l.url))
  const contact = [e(personal.location), e(personal.phone), e(personal.email), ...links].filter(Boolean).join(' | ')
  return `<header><h1>${nameLines(personal.fullName)}</h1>${contact ? `<div class="contact">${contact}</div>` : ''}</header>`
}
