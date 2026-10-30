import { describe, expect, it } from 'vitest'
import { HIGHLIGHT_CONTEXT_CHARS, highlightInField, makeHighlight } from '../../src/renderer/src/lib/highlight'

describe('makeHighlight', () => {
  it('keeps the text and the text around it', () => {
    expect(makeHighlight('I built ', 'data pipelines', ' in Python.')).toEqual({
      text: 'data pipelines',
      before: 'I built ',
      after: ' in Python.'
    })
  })

  it('moves whitespace at the edges of the selection into the context', () => {
    expect(makeHighlight('First.', '\n\nSecond paragraph. ', 'Third.')).toEqual({
      text: 'Second paragraph.',
      before: 'First.\n\n',
      after: ' Third.'
    })
  })

  it('returns null for an empty or whitespace-only selection', () => {
    expect(makeHighlight('a', '', 'b')).toBeNull()
    expect(makeHighlight('a', ' \n ', 'b')).toBeNull()
  })

  it('keeps only the context closest to the selection', () => {
    const before = 'x'.repeat(HIGHLIGHT_CONTEXT_CHARS) + 'BEFORE'
    const after = 'AFTER' + 'y'.repeat(HIGHLIGHT_CONTEXT_CHARS)
    const h = makeHighlight(before, 'text', after)
    expect(h?.before).toHaveLength(HIGHLIGHT_CONTEXT_CHARS)
    expect(h?.before.endsWith('BEFORE')).toBe(true)
    expect(h?.after).toHaveLength(HIGHLIGHT_CONTEXT_CHARS)
    expect(h?.after.startsWith('AFTER')).toBe(true)
  })
})

describe('highlightInField', () => {
  it('splits a field value at the selection offsets', () => {
    expect(highlightInField('Hello big world', 6, 9)).toEqual({ text: 'big', before: 'Hello ', after: ' world' })
  })

  it('returns null when nothing is selected', () => {
    expect(highlightInField('Hello', 2, 2)).toBeNull()
    expect(highlightInField('Hello', null, null)).toBeNull()
  })
})
