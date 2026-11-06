import { describe, expect, it } from 'vitest'
import { DraftSchema, ProfileSchema, SECTION_KEYS } from '../../src/shared/types'
import { sampleDraft, sampleProfile } from '../fixtures/sample-data'

describe('data shapes', () => {
  it('lists the sections in the order they appear on the CV', () => {
    expect(SECTION_KEYS).toEqual(['skills', 'education', 'experience', 'projects'])
  })

  it('drops headline, languages and certifications from a profile saved by an earlier version', () => {
    const current = sampleProfile()
    const old = {
      ...current,
      personal: { ...current.personal, headline: 'Data Engineer' },
      languages: [{ id: 'lang_01', name: 'Danish', level: 'Native' }],
      certifications: [],
      nextIds: { ...current.nextIds, languages: 2, certifications: 1 }
    }
    const parsed = ProfileSchema.parse(old)
    expect(parsed).toEqual(current)
    expect(parsed.personal).not.toHaveProperty('headline')
    expect(parsed).not.toHaveProperty('languages')
  })

  it('reads a profile saved before the single website link, dropping the old list of links', () => {
    const current = sampleProfile()
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { website, ...oldPersonal } = current.personal
    const parsed = ProfileSchema.parse({ ...current, personal: { ...oldPersonal, links: [{ label: 'LinkedIn', url: 'https://x.dk' }] } })
    expect(parsed.personal.website).toBe('')
    expect(parsed.personal).not.toHaveProperty('links')
  })

  it('reads a job saved before it could be marked to always include as not marked', () => {
    const current = sampleProfile()
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { alwaysInclude, ...oldJob } = current.experience[0]
    expect(ProfileSchema.parse({ ...current, experience: [oldJob] }).experience[0].alwaysInclude).toBe(false)
  })

  it('reads a profile saved before projects and the shorter education entries', () => {
    const current = sampleProfile()
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { projects, ...withoutProjects } = current
    const old = {
      ...withoutProjects,
      education: [{ id: 'edu_01', degree: 'MSc', institution: 'DTU', location: 'Lyngby', start: '2016-09', end: '2018-06', details: ['Thesis'] }],
      nextIds: { skills: 3, education: 2, experience: 3 }
    }
    const parsed = ProfileSchema.parse(old)
    expect(parsed.projects).toEqual([])
    expect(parsed.nextIds.projects).toBe(1)
    expect(parsed.education).toEqual([{ id: 'edu_01', degree: 'MSc', gpa: '', institution: 'DTU', start: '2016-09', end: '2018-06' }])
  })

  it('keeps the name of a project saved by a much earlier version, which had other fields', () => {
    const old = { ...sampleProfile(), projects: [{ id: 'proj_01', name: 'ETL', context: '', url: '', date: '', bullets: [] }] }
    expect(ProfileSchema.parse(old).projects).toEqual([{ id: 'proj_01', name: 'ETL', description: '', technologies: '' }])
  })

  it('reads a draft saved before projects, with English headings for what it lacks', () => {
    const current = sampleDraft()
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { projects, ...oldCv } = current.cv
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { projects: projectsLabel, gpa, ...oldLabels } = current.cv.labels
    const old = {
      ...current,
      cv: { ...oldCv, labels: oldLabels, education: [{ id: 'edu_01', degree: 'MSc in Computer Science', details: ['Thesis'] }] }
    }
    expect(DraftSchema.parse(old)).toEqual(current)
  })

  it('drops the removed fields from a draft saved by an earlier version', () => {
    const current = sampleDraft()
    const old = {
      ...current,
      cv: {
        ...current.cv,
        headline: 'Data Engineer',
        languages: [{ id: 'lang_01', name: 'Danish', level: 'Native' }],
        certifications: [],
        labels: { ...current.cv.labels, profile: 'Profile', languages: 'Languages', certifications: 'Certifications' }
      },
      letter: { ...current.letter, subject: 'Application for Data Engineer' }
    }
    const parsed = DraftSchema.parse(old)
    expect(parsed).toEqual(current)
    expect(parsed.letter).not.toHaveProperty('subject')
  })

  it("reads a draft saved before the candidate's own text was stored", () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { ownText, ...old } = { ...sampleDraft(), ownText: 'x' }
    expect(DraftSchema.parse(old).ownText).toBe('')
  })
})
