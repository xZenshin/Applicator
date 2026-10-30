import type { Highlight } from '../../../shared/types'

/** How much text on each side of a highlight is sent along, so Claude can tell which occurrence is meant. */
export const HIGHLIGHT_CONTEXT_CHARS = 200

/** A highlight from the selected text and the text before and after it. Null if nothing but whitespace is selected. */
export function makeHighlight(before: string, selected: string, after: string): Highlight | null {
  const text = selected.trim()
  if (!text) return null
  const leading = selected.slice(0, selected.length - selected.trimStart().length)
  const trailing = selected.slice(selected.trimEnd().length)
  return {
    text,
    before: (before + leading).slice(-HIGHLIGHT_CONTEXT_CHARS),
    after: (trailing + after).slice(0, HIGHLIGHT_CONTEXT_CHARS)
  }
}

/** The highlight in a text field, from its selectionStart and selectionEnd. */
export function highlightInField(value: string, start: number | null, end: number | null): Highlight | null {
  if (start === null || end === null || start === end) return null
  return makeHighlight(value.slice(0, start), value.slice(start, end), value.slice(end))
}
