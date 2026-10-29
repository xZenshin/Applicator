import { renderCvHtml } from '../../../shared/templates/cv'
import { renderLetterHtml } from '../../../shared/templates/letter'
import type { Draft, Profile } from '../../../shared/types'
import { cvFromProfile } from './cv-edit'
import { CV_FONT_CSS, LETTER_FONT_CSS } from './fonts'

/** Everything in the profile, untailored, in the same template as the exported CV. */
export function profileCvHtml(profile: Profile): string {
  return renderCvHtml(profile, cvFromProfile(profile), { language: 'en', fontCss: CV_FONT_CSS })
}

/** The exact HTML shown in previews and sent for PDF export. */
export function cvHtml(profile: Profile, draft: Draft): string {
  return renderCvHtml(profile, draft.cv, { language: draft.job.language, fontCss: CV_FONT_CSS })
}

export function letterHtml(profile: Profile, draft: Draft, date = new Date()): string {
  return renderLetterHtml(profile, draft.letter, {
    language: draft.job.language,
    company: draft.job.company,
    date,
    fontCss: LETTER_FONT_CSS
  })
}
