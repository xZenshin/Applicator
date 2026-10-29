import { describe, expect, it } from 'vitest'
import { renderCvHtml } from '../../src/shared/templates/cv'
import {
  cvFromProfile,
  entryFromProfile,
  moveCvItem,
  paragraphsToText,
  textToParagraphs,
  toggleCvItem
} from '../../src/renderer/src/lib/cv-edit'
import { addItem } from '../../src/renderer/src/lib/profile-edit'
import { sampleCv, sampleProfile } from '../fixtures/sample-data'

describe('entryFromProfile', () => {
  it('maps each section to the CvContent shape', () => {
    const p = sampleProfile()
    expect(entryFromProfile(p, 'experience', 'exp_02')).toEqual({
      id: 'exp_02',
      title: 'Junior Developer',
      bullets: ['Maintained internal web tools']
    })
    expect(entryFromProfile(p, 'education', 'edu_01')).toEqual({
      id: 'edu_01',
      degree: 'MSc Computer Science',
      details: ['Thesis on stream processing']
    })
    expect(entryFromProfile(p, 'skills', 'skill_02')).toEqual({ id: 'skill_02', name: 'SQL', category: 'Programming' })
  })
})

describe('toggleCvItem', () => {
  it('adds the profile entry with original text at the end, and removes it on second toggle', () => {
    const added = toggleCvItem(sampleCv(), sampleProfile(), 'experience', 'exp_02')
    expect(added.added).toBe(true)
    expect(added.cv.experience.map((e) => e.id)).toEqual(['exp_01', 'exp_02'])
    expect(added.cv.experience[1].title).toBe('Junior Developer')

    const removed = toggleCvItem(added.cv, sampleProfile(), 'experience', 'exp_02')
    expect(removed.added).toBe(false)
    expect(removed.cv.experience.map((e) => e.id)).toEqual(['exp_01'])
  })

  it('does not touch other sections', () => {
    const { cv } = toggleCvItem(sampleCv(), sampleProfile(), 'skills', 'skill_02')
    expect(cv.experience).toEqual(sampleCv().experience)
    expect(cv.skills.map((s) => s.id)).toEqual(['skill_01', 'skill_02'])
  })
})

describe('moveCvItem', () => {
  it('swaps and is a no-op at bounds', () => {
    const cv = toggleCvItem(sampleCv(), sampleProfile(), 'skills', 'skill_02').cv
    expect(moveCvItem(cv, 'skills', 'skill_02', -1).skills.map((s) => s.id)).toEqual(['skill_02', 'skill_01'])
    expect(moveCvItem(cv, 'skills', 'skill_01', -1).skills.map((s) => s.id)).toEqual(['skill_01', 'skill_02'])
  })
})

describe('paragraphs', () => {
  it('splits on blank lines and joins with one blank line', () => {
    expect(textToParagraphs('First para.\n\n\n  Second para.  \n')).toEqual(['First para.', 'Second para.'])
    expect(textToParagraphs('Line one\nline two\n\nNext')).toEqual(['Line one\nline two', 'Next'])
    expect(paragraphsToText(['a', 'b'])).toBe('a\n\nb')
  })
})

describe('cvFromProfile', () => {
  it('includes every profile item in profile order, with the original text', () => {
    const p = sampleProfile()
    const cv = cvFromProfile(p)
    expect(cv).not.toHaveProperty('headline')
    expect(cv.summary).toBe(p.summary)
    expect(cv.experience).toEqual([entryFromProfile(p, 'experience', 'exp_01'), entryFromProfile(p, 'experience', 'exp_02')])
    expect(cv.skills.map((s) => s.id)).toEqual(['skill_01', 'skill_02'])
    expect(cv.education).toEqual([entryFromProfile(p, 'education', 'edu_01')])
  })

  it('uses English headings', () => {
    expect(cvFromProfile(sampleProfile()).labels).toEqual({
      skills: 'Technical Skills',
      education: 'Education',
      experience: 'Experience',
      present: 'Present'
    })
  })

  it('leaves out items that have nothing entered yet', () => {
    const { profile } = addItem(sampleProfile(), 'experience')
    expect(cvFromProfile(profile).experience.map((e) => e.id)).toEqual(['exp_01', 'exp_02'])
  })

  it('renders every employer and section through the CV template', () => {
    const html = renderCvHtml(sampleProfile(), cvFromProfile(sampleProfile()), { language: 'en' })
    for (const text of ['Ørsted A/S', 'Contoso ApS', 'DTU', 'Python, SQL', 'Present']) {
      expect(html).toContain(text)
    }
  })
})
