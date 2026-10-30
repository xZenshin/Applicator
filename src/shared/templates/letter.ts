import type { ApplicationLetter, Profile } from '../types'
import { LETTER_CSS } from './base-css'
import { htmlDocument } from './document'
import { escapeHtml as e } from './escape'
import { formatLetterDate } from './format'
import { renderHeader } from './header'

/** The CV's header, then the date, greeting, body, sign-off and the applicant's name. */
export function renderLetterHtml(
  profile: Profile,
  letter: ApplicationLetter,
  opts: { language: string; date: Date; fontCss?: string }
): string {
  const { personal } = profile
  const body = [
    renderHeader(personal),
    `<div class="date">${e(formatLetterDate(opts.date, opts.language))}</div>`,
    letter.greeting ? `<p>${e(letter.greeting)}</p>` : '',
    ...letter.paragraphs.map((p) => `<p>${e(p)}</p>`),
    letter.signOff ? `<p>${e(letter.signOff)}</p>` : '',
    personal.fullName.trim() ? `<p>${e(personal.fullName.trim())}</p>` : ''
  ]

  return htmlDocument({
    title: ['Application', personal.fullName.trim()].filter(Boolean).join(' – '),
    language: opts.language,
    bodyClass: 'letter',
    body: body.filter(Boolean).join('\n'),
    css: LETTER_CSS,
    fontCss: opts.fontCss
  })
}
