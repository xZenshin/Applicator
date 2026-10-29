// eslint-disable-next-line no-control-regex
const ILLEGAL_CHARS = /[<>:"/\\|?*\u0000-\u001f]/g
const RESERVED_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i

const trimEnds = (s: string): string => s.replace(/^[\s.]+|[\s.]+$/g, '')

/** Makes a string safe to use as a Windows file or folder name. */
export function sanitizeFileName(name: string, maxLength = 80): string {
  let s = trimEnds(name.replace(ILLEGAL_CHARS, ' ').replace(/\s+/g, ' '))
  s = trimEnds(s.slice(0, maxLength))
  if (!s) return 'Untitled'
  return RESERVED_NAMES.test(s) ? `${s}_` : s
}

const pad = (n: number): string => String(n).padStart(2, '0')
const folderPart = (s: string): string => sanitizeFileName(s, 40).replace(/ /g, '-')

/** "2026-10-29_Acme_Data-Engineer" (local date). */
export function applicationFolderName(date: Date, company: string, role: string): string {
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  return `${day}_${folderPart(company)}_${folderPart(role)}`
}

/** Returns `base`, or `base-2`, `base-3`, … — the first one `exists` says is free. */
export function uniqueName(base: string, exists: (name: string) => boolean): string {
  if (!exists(base)) return base
  let n = 2
  while (exists(`${base}-${n}`)) n++
  return `${base}-${n}`
}

function pdfName(parts: string[]): string {
  const stem = parts
    .map((p) => p.trim())
    .filter(Boolean)
    .join(' - ')
  return `${sanitizeFileName(stem, 150)}.pdf`
}

export function cvPdfName(fullName: string, company: string): string {
  return pdfName(['CV', fullName, company])
}

export function letterPdfName(company: string, role: string): string {
  return pdfName(['Application', company, role])
}
