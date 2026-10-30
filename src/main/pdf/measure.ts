import { renderCvHtml } from '../../shared/templates/cv'
import { FONT_CSS } from '../../shared/templates/fonts'
import type { CvContent, Profile } from '../../shared/types'
import { withDocument } from './print'

/**
 * Renders the CV exactly as the preview and the PDF do and returns its height in pixels at 96 dpi.
 * On screen the page margins are padding, so the height only exceeds one A4 page when the CV does.
 */
export function measureCvHeight(profile: Profile, cv: CvContent, language: string): Promise<number> {
  const html = renderCvHtml(profile, cv, { language, fontCss: FONT_CSS })
  return withDocument(html, (window) => window.webContents.executeJavaScript('document.body.offsetHeight'))
}
