const SHARED_CSS = `
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
@media screen {
  html { background: #e9ecef; }
  body { width: 210mm; min-height: 297mm; margin: 0 auto; background: #fff; }
}
a { color: inherit; text-decoration: none; }
`

/** A4 page margins, repeated as screen padding so the preview matches the printed page. */
const page = (vertical: string, horizontal: string): string => `
@page { size: A4; margin: ${vertical} ${horizontal}; }
@media screen { body { padding: ${vertical} ${horizontal}; } }
`

/**
 * Small caps come from a font of their own (scripts/make-small-caps-font.py): faked small caps mix two
 * font sizes in each word, which PDF viewers then treat as two words.
 */
const SMALL_CAPS = `'Cabin Small Caps', 'Cabin', 'Segoe UI', sans-serif`

/** The CV's typeface and its header (name, contact line and rule), which the letter shares. */
const CABIN_CSS = `
body { font-family: 'Cabin', 'Segoe UI', sans-serif; color: #404040; }
header { display: flex; justify-content: space-between; align-items: flex-end; gap: 12pt; padding-bottom: 8pt; border-bottom: 2.25pt solid #aca8aa; }
h1 { font-family: ${SMALL_CAPS}; margin: 0; font-size: 23pt; line-height: 1.05; font-weight: 400; color: #575455; }
.contact { color: #000; font-size: 10pt; line-height: 1.3; text-align: right; padding-bottom: 3pt; }
`

export const CV_CSS =
  SHARED_CSS +
  page('15mm', '16mm') +
  CABIN_CSS +
  `
body { font-size: 10pt; line-height: 1.3; }
p { margin: 0; }
ul { margin: 2pt 0 0; padding-left: 11pt; list-style-type: '●'; }
li { margin: 1pt 0; padding-left: 9pt; }
/* Cabin has no ●; Arial ships with Windows. */
li::marker { color: #000; font-family: Arial, sans-serif; }
section { padding: 9pt 0 11pt; border-bottom: 2.25pt solid #aca8aa; }
h2, .entry-title strong { font-family: ${SMALL_CAPS}; }
h2 { margin: 0 0 5pt; font-size: 16pt; line-height: 1.1; font-weight: 400; color: #575455; break-after: avoid; }
.entry { break-inside: avoid; }
.entry + .entry { margin-top: 9pt; }
.entry-title { color: #000; }
.dates { color: #595959; }
.entry-place { color: #000; margin: 2pt 0 3pt; }
`

/** Margins, text size and spacing follow the user's own letter, written in Google Docs: 1-inch margins, 11pt text, 12pt between paragraphs. */
export const LETTER_CSS =
  SHARED_CSS +
  page('25.4mm', '25.4mm') +
  CABIN_CSS +
  `
body { font-size: 11pt; line-height: 1.38; }
p { margin: 0 0 12pt; }
.date { text-align: right; margin: 14pt 0 20pt; }
`
