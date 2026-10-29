import cabinRegular from '@fontsource/cabin/files/cabin-latin-400-normal.woff2?inline'
import cabinBold from '@fontsource/cabin/files/cabin-latin-700-normal.woff2?inline'
import regular from '@fontsource/source-sans-3/files/source-sans-3-latin-400-normal.woff2?inline'
import italic from '@fontsource/source-sans-3/files/source-sans-3-latin-400-italic.woff2?inline'
import semibold from '@fontsource/source-sans-3/files/source-sans-3-latin-600-normal.woff2?inline'
import smallCapsRegular from '../assets/fonts/cabin-small-caps-latin-400-normal.woff2?inline'
import smallCapsBold from '../assets/fonts/cabin-small-caps-latin-700-normal.woff2?inline'

const face = (family: string, src: string, weight: number, style: string): string =>
  `@font-face { font-family: '${family}'; font-style: ${style}; font-weight: ${weight}; src: url(${src}) format('woff2'); }`

// Embedded so the preview iframe and the printed PDF render identically, with no file access.
export const CV_FONT_CSS = [
  face('Cabin', cabinRegular, 400, 'normal'),
  face('Cabin', cabinBold, 700, 'normal'),
  face('Cabin Small Caps', smallCapsRegular, 400, 'normal'),
  face('Cabin Small Caps', smallCapsBold, 700, 'normal')
].join('\n')

export const LETTER_FONT_CSS = [
  face('Source Sans 3', regular, 400, 'normal'),
  face('Source Sans 3', italic, 400, 'italic'),
  face('Source Sans 3', semibold, 600, 'normal')
].join('\n')
