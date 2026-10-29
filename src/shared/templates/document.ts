import { escapeHtml } from './escape'

/** A self-contained HTML document; `css` and `fontCss` (embedded @font-face rules) are trusted. */
export function htmlDocument(a: {
  title: string
  language: string
  bodyClass: string
  body: string
  css: string
  fontCss?: string
}): string {
  return `<!doctype html>
<html lang="${escapeHtml(a.language)}">
<head>
<meta charset="utf-8">
<title>${escapeHtml(a.title)}</title>
<style>${a.fontCss ?? ''}
${a.css}</style>
</head>
<body class="${a.bodyClass}">
${a.body}
</body>
</html>`
}
