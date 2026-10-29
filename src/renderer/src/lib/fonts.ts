import regular from '@fontsource/source-sans-3/files/source-sans-3-latin-400-normal.woff2?inline'
import italic from '@fontsource/source-sans-3/files/source-sans-3-latin-400-italic.woff2?inline'
import semibold from '@fontsource/source-sans-3/files/source-sans-3-latin-600-normal.woff2?inline'

const face = (src: string, weight: number, style: string): string =>
  `@font-face { font-family: 'Source Sans 3'; font-style: ${style}; font-weight: ${weight}; src: url(${src}) format('woff2'); }`

/** Embedded so the preview iframe and the printed PDF render identically, with no file access. */
export const FONT_CSS = [face(regular, 400, 'normal'), face(italic, 400, 'italic'), face(semibold, 600, 'normal')].join('\n')
