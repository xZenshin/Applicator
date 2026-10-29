/**
 * Link target for the documents: http(s) and mailto are kept, a scheme-less address gets https://,
 * and anything else (javascript:, file:, …) returns null so it is rendered as plain text.
 * Without this, "linkedin.com/in/x" would resolve against the temp file the PDF is printed from.
 */
export function safeHref(url: string): string | null {
  const u = url.trim()
  if (!u) return null
  if (/^(https?:\/\/|mailto:)/i.test(u)) return u
  if (/^[a-z][a-z0-9+.-]*:/i.test(u)) return null
  return `https://${u.replace(/^\/+/, '')}`
}
