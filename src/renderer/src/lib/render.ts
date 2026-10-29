import { renderCvHtml } from '../../../shared/templates/cv'
import { renderLetterHtml } from '../../../shared/templates/letter'
import type { ApplicationMeta, Draft, Profile } from '../../../shared/types'
import { FONT_CSS } from './fonts'

/** The exact HTML shown in previews and sent for PDF export. */
export function cvHtml(profile: Profile, draft: Draft): string {
  return renderCvHtml(profile, draft.cv, { language: draft.job.language, fontCss: FONT_CSS })
}

export function letterHtml(profile: Profile, draft: Draft, meta: ApplicationMeta, date = new Date()): string {
  return renderLetterHtml(profile, draft.letter, {
    language: draft.job.language,
    company: meta.company,
    date,
    fontCss: FONT_CSS
  })
}
