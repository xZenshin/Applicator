import cabinRegular from '@fontsource/cabin/files/cabin-latin-400-normal.woff2?inline'
import cabinBold from '@fontsource/cabin/files/cabin-latin-700-normal.woff2?inline'
import smallCapsRegular from './font-files/cabin-small-caps-latin-400-normal.woff2?inline'
import smallCapsBold from './font-files/cabin-small-caps-latin-700-normal.woff2?inline'

const face = (family: string, src: string, weight: number, style: string): string =>
  `@font-face { font-family: '${family}'; font-style: ${style}; font-weight: ${weight}; src: url(${src}) format('woff2'); }`

// Embedded so the preview, the printed PDF and the one-page check (main process) render identically, with no file access.
// The CV and the letter share them.
export const FONT_CSS = [
  face('Cabin', cabinRegular, 400, 'normal'),
  face('Cabin', cabinBold, 700, 'normal'),
  face('Cabin Small Caps', smallCapsRegular, 400, 'normal'),
  face('Cabin Small Caps', smallCapsBold, 700, 'normal')
].join('\n')
