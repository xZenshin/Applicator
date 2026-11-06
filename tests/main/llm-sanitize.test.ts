import { describe, expect, it } from 'vitest'
import { normalizeLanguage, restoreAlwaysIncluded, sanitizeCv } from '../../src/main/llm/sanitize'
import type { Profile } from '../../src/shared/types'
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

  it('drops a project that is not in the profile', () => {
    const cv = {
      ...sampleCv(),
      projects: [
        { id: 'proj_01', name: 'Real', description: '', technologies: '' },
        { id: 'proj_99', name: 'Invented', description: '', technologies: '' }
      ]
    }
    const { cv: clean, warnings } = sanitizeCv(sampleProfile(), cv)
    expect(clean.projects.map((p) => p.id)).toEqual(['proj_01'])
    expect(warnings.join(' ')).toContain('proj_99')
  })

  it('keeps a valid cv unchanged with no warnings', () => {
    expect(sanitizeCv(sampleProfile(), sampleCv())).toEqual({ cv: sampleCv(), warnings: [] })
  })
})

describe('restoreAlwaysIncluded', () => {
  const marked = (): Profile => {
    const profile = sampleProfile()
    profile.experience[1].alwaysInclude = true
    return profile
  }

  it('adds a marked job that is missing, with its original text, and warns', () => {
    const { cv, warnings } = restoreAlwaysIncluded(marked(), sampleCv())
    expect(cv.experience.map((e) => e.id)).toEqual(['exp_01', 'exp_02'])
    expect(cv.experience[1]).toEqual({ id: 'exp_02', title: 'Junior Developer', bullets: ['Maintained internal web tools'] })
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain('Junior Developer @ Contoso ApS')
  })

  it('leaves a marked job that is present untouched', () => {
    const present = { ...sampleCv(), experience: [{ id: 'exp_02', title: 'Udvikler', bullets: ['Kort'] }] }
    expect(restoreAlwaysIncluded(marked(), present)).toEqual({ cv: present, warnings: [] })
  })

  it('leaves out jobs that are not marked', () => {
    expect(restoreAlwaysIncluded(sampleProfile(), sampleCv())).toEqual({ cv: sampleCv(), warnings: [] })
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
