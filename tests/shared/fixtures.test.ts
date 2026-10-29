import { expect, it } from 'vitest'
import * as f from '../fixtures/sample-data'

it('fixtures satisfy their schemas', () => {
  expect(() => [f.sampleProfile(), f.sampleStyle(), f.sampleJob(), f.sampleCv(), f.sampleLetter(), f.sampleDraft()]).not.toThrow()
})
