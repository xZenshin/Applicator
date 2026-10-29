import type { ApplicationLetter, Profile } from '../types'
import { LETTER_CSS } from './base-css'
import { htmlDocument } from './document'
import { escapeHtml as e } from './escape'
import { formatLetterDate } from './format'

export function renderLetterHtml(
  profile: Profile,
  letter: ApplicationLetter,
  opts: { language: string; company: string; date: Date; fontCss?: string }
): string {
  const { personal } = profile
  const sender = [
    `<strong>${e(personal.fullName)}</strong>`,
    ...[personal.location, personal.email, personal.phone].filter(Boolean).map(e)
  ].join('<br>')

  const body = [
    `<div class="sender">${sender}</div>`,
    `<div class="date">${e(formatLetterDate(opts.date, opts.language))}</div>`,
    opts.company ? `<div class="recipient">${e(opts.company)}</div>` : '',
    letter.subject ? `<p class="subject">${e(letter.subject)}</p>` : '',
    letter.greeting ? `<p>${e(letter.greeting)}</p>` : '',
    ...letter.paragraphs.map((p) => `<p>${e(p)}</p>`),
    `<p class="signoff">${e(letter.signOff)}<br>${e(personal.fullName)}</p>`
  ]

  return htmlDocument({
    title: letter.subject || 'Application',
    language: opts.language,
    bodyClass: 'letter',
    body: body.filter(Boolean).join('\n'),
    css: LETTER_CSS,
    fontCss: opts.fontCss
  })
}
