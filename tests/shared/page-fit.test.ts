import { describe, expect, it } from 'vitest'
import { overflowLines } from '../../src/shared/templates/page-fit'

describe('overflowLines', () => {
  it('is 0 for a CV that fits on one A4 page (1123px at 96 dpi)', () => {
    expect(overflowLines(900)).toBe(0)
    expect(overflowLines(1123)).toBe(0)
  })

  it('counts the 10pt CV lines (17.33px) that run past the page, rounding up', () => {
    expect(overflowLines(1124)).toBe(1)
    expect(overflowLines(1123 + 150)).toBe(9)
  })
})
