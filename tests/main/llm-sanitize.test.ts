import { describe, expect, it } from 'vitest'
import { normalizeLanguage, sanitizeCv } from '../../src/main/llm/sanitize'
import { sampleCv, sampleProfile } from '../fixtures/sample-data'

describe('sanitizeCv', () => {
  it('drops unknown, duplicate and wrong-section ids with warnings', () => {
    const cv = sampleCv()
    cv.experience = [
      { id: 'exp_01', title: 'First', bullets: [] },
      { id: 'exp_01', title: 'Duplicate', bullets: [] },
      { id: 'exp_99', title: 'Invented', bullets: [] },
      { id: 'skill_01', title: 'Wrong section', bullets: [] }
    ]
    const { cv: clean, warnings } = sanitizeCv(sampleProfile(), cv)
    expect(clean.experience).toEqual([{ id: 'exp_01', title: 'First', bullets: [] }])
    expect(warnings).toHaveLength(3)
    expect(warnings.join(' ')).toContain('exp_99')
    expect(warnings.join(' ')).toContain('skill_01')
    expect(warnings.filter((w) => w.includes('exp_01'))).toHaveLength(1)
  })

  it('keeps a valid cv unchanged with no warnings', () => {
    expect(sanitizeCv(sampleProfile(), sampleCv())).toEqual({ cv: sampleCv(), warnings: [] })
  })
})

describe('normalizeLanguage', () => {
  it('normalizes language', () => {
    expect(normalizeLanguage('DA')).toEqual({ language: 'da' })
    expect(normalizeLanguage('da-DK')).toEqual({ language: 'da' })
    expect(normalizeLanguage('en')).toEqual({ language: 'en' })
    const word = normalizeLanguage('Danish')
    expect(word.language).toBe('en')
    expect(word.warning).toContain('Danish')
    expect(normalizeLanguage('').language).toBe('en')
    expect(normalizeLanguage('').warning).toBeDefined()
  })
})
