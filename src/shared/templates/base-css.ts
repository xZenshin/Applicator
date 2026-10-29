export const BASE_CSS = `
@page { size: A4; margin: 16mm 18mm; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  font-family: 'Source Sans 3', 'Segoe UI', sans-serif;
  font-size: 10.5pt;
  line-height: 1.35;
  color: #1f2328;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
@media screen {
  html { background: #e9ecef; }
  body { width: 210mm; min-height: 297mm; padding: 16mm 18mm; margin: 0 auto; background: #fff; }
}
a { color: inherit; text-decoration: none; }
p { margin: 0 0 0.7em; }
ul { margin: 0.2em 0 0; padding-left: 1.2em; }
li { margin: 0.1em 0; }
h1 { font-size: 22pt; font-weight: 600; margin: 0; line-height: 1.15; }
h2 {
  font-size: 11pt;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #2b5797;
  border-bottom: 1px solid #c9ced6;
  padding-bottom: 2px;
  margin: 14pt 0 6pt;
  break-after: avoid;
}
.headline { font-size: 12pt; color: #2b5797; margin-top: 2pt; }
.contact { font-size: 9.5pt; color: #4a515a; margin-top: 4pt; }
.entry { break-inside: avoid; margin-bottom: 7pt; }
.entry-head { display: flex; justify-content: space-between; gap: 12pt; }
.dates { white-space: nowrap; color: #4a515a; font-size: 9.5pt; }
.muted { color: #4a515a; font-size: 9.5pt; }
.line { margin: 0 0 3pt; }

.letter .sender { text-align: right; font-size: 9.5pt; line-height: 1.4; }
.letter .sender strong { font-size: 11pt; }
.letter .date { text-align: right; margin: 10pt 0 22pt; }
.letter .recipient { margin-bottom: 18pt; }
.letter .subject { font-weight: 600; font-size: 12pt; margin-bottom: 12pt; }
.letter .signoff { margin-top: 14pt; }
`
