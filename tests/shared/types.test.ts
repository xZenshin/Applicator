import { describe, expect, it } from 'vitest'
import { DraftSchema, ProfileSchema, SECTION_KEYS } from '../../src/shared/types'
import { sampleDraft, sampleProfile } from '../fixtures/sample-data'

describe('data shapes', () => {
  it('lists the sections in the order they appear on the CV', () => {
    expect(SECTION_KEYS).toEqual(['skills', 'education', 'experience'])
  })

  it('drops headline, languages, projects and certifications from a profile saved by an earlier version', () => {
    const current = sampleProfile()
    const old = {
      ...current,
      personal: { ...current.personal, headline: 'Data Engineer' },
      languages: [{ id: 'lang_01', name: 'Danish', level: 'Native' }],
      projects: [{ id: 'proj_01', name: 'ETL', context: '', url: '', date: '', bullets: [] }],
      certifications: [],
      nextIds: { ...current.nextIds, languages: 2, projects: 2, certifications: 1 }
    }
    const parsed = ProfileSchema.parse(old)
    expect(parsed).toEqual(current)
    expect(parsed.personal).not.toHaveProperty('headline')
    expect(parsed).not.toHaveProperty('languages')
  })

  it('drops the removed fields from a draft saved by an earlier version', () => {
    const current = sampleDraft()
    const old = {
      ...current,
      cv: {
        ...current.cv,
        headline: 'Data Engineer',
        languages: [{ id: 'lang_01', name: 'Danish', level: 'Native' }],
        projects: [],
        certifications: [],
        labels: { ...current.cv.labels, profile: 'Profile', languages: 'Languages', projects: 'Projects', certifications: 'Certifications' }
      }
    }
    expect(DraftSchema.parse(old)).toEqual(current)
  })
})
