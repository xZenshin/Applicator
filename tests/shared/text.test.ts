import { expect, it } from 'vitest'
import { countWords } from '../../src/shared/text'
import { SAMPLE_120_WORDS } from '../fixtures/sample-data'

it('counts words containing letters or digits', () => {
  expect(countWords('Hej  med\ndig – 2026')).toBe(4)
  expect(countWords('')).toBe(0)
  expect(countWords(SAMPLE_120_WORDS)).toBe(120)
})
