/** One entry per non-empty line, trimmed. */
export function textToLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
}

export function linesToText(lines: string[]): string {
  return lines.join('\n')
}
