import { expect, it } from 'vitest'
import { countWordsForTest } from './word-count-helper'
import * as f from '../fixtures/sample-data'

it('fixtures satisfy their schemas', () => {
  expect(() => [f.sampleProfile(), f.sampleStyle(), f.sampleJob(), f.sampleCv(), f.sampleLetter(), f.sampleDraft()]).not.toThrow()
  expect(countWordsForTest(f.SAMPLE_120_WORDS)).toBe(120)
})
