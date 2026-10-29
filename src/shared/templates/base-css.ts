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

export const CV_CSS =
  SHARED_CSS +
  page('15mm', '16mm') +
  `
body {
  font-family: 'Cabin', 'Segoe UI', sans-serif;
  font-size: 10pt;
  line-height: 1.3;
  color: #404040;
}
p { margin: 0; }
ul { margin: 2pt 0 0; padding-left: 11pt; list-style-type: '●'; }
li { margin: 1pt 0; padding-left: 9pt; }
/* Cabin has no ●; Arial ships with Windows. */
li::marker { color: #000; font-family: Arial, sans-serif; }
header, section { border-bottom: 2.25pt solid #aca8aa; }
header { display: flex; justify-content: space-between; align-items: flex-end; gap: 12pt; padding-bottom: 8pt; }
/*
 * Small caps come from a font of their own (scripts/make-small-caps-font.py): faked small caps mix two
 * font sizes in each word, which PDF viewers then treat as two words.
 */
h1, h2, .entry-title strong { font-family: 'Cabin Small Caps', 'Cabin', 'Segoe UI', sans-serif; }
h1, h2 { font-weight: 400; color: #575455; }
h1 { margin: 0; font-size: 23pt; line-height: 1.05; }
.contact { color: #000; text-align: right; padding-bottom: 3pt; }
section { padding: 9pt 0 11pt; }
h2 { margin: 0 0 5pt; font-size: 16pt; line-height: 1.1; break-after: avoid; }
.entry { break-inside: avoid; }
.entry + .entry { margin-top: 9pt; }
.entry-title { color: #000; }
.dates { color: #595959; }
.entry-place { color: #000; margin: 2pt 0 3pt; }
`

export const LETTER_CSS =
  SHARED_CSS +
  page('16mm', '18mm') +
  `
body {
  font-family: 'Source Sans 3', 'Segoe UI', sans-serif;
  font-size: 10.5pt;
  line-height: 1.35;
  color: #1f2328;
}
p { margin: 0 0 0.7em; }
.letter .sender { text-align: right; font-size: 9.5pt; line-height: 1.4; }
.letter .sender strong { font-size: 11pt; }
.letter .date { text-align: right; margin: 10pt 0 22pt; }
.letter .recipient { margin-bottom: 18pt; }
.letter .subject { font-weight: 600; font-size: 12pt; margin-bottom: 12pt; }
.letter .signoff { margin-top: 14pt; }
`
