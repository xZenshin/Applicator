import type { Personal } from '../types'
import { escapeHtml as e } from './escape'
import { safeHref } from './url'

/** Links to the website, showing "https://www.jane.dev/" as "jane.dev". An address that can't be linked is left out. */
function websiteLink(url: string): string {
  const href = safeHref(url)
  if (!href) return ''
  const shown = href.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '')
  return `<a href="${e(href)}">${e(shown)}</a>`
}

/** "Anna Marie Jensen" → "Anna Marie<br>Jensen": the last name gets its own line. */
function nameLines(fullName: string): string {
  const m = /^(.*\S)\s+(\S+)$/.exec(fullName.trim())
  return m ? `${e(m[1])}<br>${e(m[2])}` : e(fullName.trim())
}

/** The name, with the contact line to its right: the top of both the CV and the letter. */
export function renderHeader(personal: Personal): string {
  const contact = [e(personal.location), e(personal.phone), e(personal.email), websiteLink(personal.website)].filter(Boolean).join(' | ')
  return `<header><h1>${nameLines(personal.fullName)}</h1>${contact ? `<div class="contact">${contact}</div>` : ''}</header>`
}
