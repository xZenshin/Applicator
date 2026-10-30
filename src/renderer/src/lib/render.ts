import { renderCvHtml } from '../../../shared/templates/cv'
import { FONT_CSS } from '../../../shared/templates/fonts'
import { renderLetterHtml } from '../../../shared/templates/letter'
import type { Draft, Profile } from '../../../shared/types'
import { cvFromProfile } from './cv-edit'

/** Everything in the profile, untailored, in the same template as the exported CV. */
export function profileCvHtml(profile: Profile): string {
  return renderCvHtml(profile, cvFromProfile(profile), { language: 'en', fontCss: FONT_CSS })
}

/** The exact HTML shown in previews and sent for PDF export. */
export function cvHtml(profile: Profile, draft: Draft): string {
  return renderCvHtml(profile, draft.cv, { language: draft.job.language, fontCss: FONT_CSS })
}

/** null for a CV-only application, which has no letter. */
export function letterHtml(profile: Profile, draft: Draft, date = new Date()): string | null {
  if (!draft.letter) return null
  return renderLetterHtml(profile, draft.letter, { language: draft.job.language, date, fontCss: FONT_CSS })
}
