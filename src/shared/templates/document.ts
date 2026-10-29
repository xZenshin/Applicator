import { BASE_CSS } from './base-css'
import { escapeHtml } from './escape'

/** A self-contained HTML document; `fontCss` is trusted CSS (embedded @font-face rules). */
export function htmlDocument(a: {
  title: string
  language: string
  bodyClass: string
  body: string
  fontCss?: string
}): string {
  return `<!doctype html>
<html lang="${escapeHtml(a.language)}">
<head>
<meta charset="utf-8">
<title>${escapeHtml(a.title)}</title>
<style>${a.fontCss ?? ''}
${BASE_CSS}</style>
</head>
<body class="${a.bodyClass}">
${a.body}
</body>
</html>`
}
