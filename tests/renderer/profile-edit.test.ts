import { describe, expect, it } from 'vitest'
import { addItem, moveItem, removeItem, updateItem } from '../../src/renderer/src/lib/profile-edit'
import { linesToText, textToLines } from '../../src/renderer/src/lib/text-lines'
import { emptyProfile } from '../../src/shared/types'
import { sampleProfile } from '../fixtures/sample-data'

describe('addItem', () => {
  it('appends blank items with exp_01 then exp_02', () => {
    const first = addItem(emptyProfile(), 'experience')
    const second = addItem(first.profile, 'experience')
    expect([first.id, second.id]).toEqual(['exp_01', 'exp_02'])
    expect(second.profile.experience).toEqual([
      { id: 'exp_01', title: '', employer: '', location: '', start: '', end: '', bullets: [] },
      { id: 'exp_02', title: '', employer: '', location: '', start: '', end: '', bullets: [] }
    ])
  })

  it('creates the right blank shape for every section', () => {
    let p = emptyProfile()
    for (const s of ['education', 'skills', 'languages', 'projects', 'certifications'] as const) {
      p = addItem(p, s).profile
    }
    expect(p.education[0]).toEqual({ id: 'edu_01', degree: '', institution: '', location: '', start: '', end: '', details: [] })
    expect(p.skills[0]).toEqual({ id: 'skill_01', name: '', category: '' })
    expect(p.languages[0]).toEqual({ id: 'lang_01', name: '', level: '' })
    expect(p.projects[0]).toEqual({ id: 'proj_01', name: '', context: '', url: '', date: '', bullets: [] })
    expect(p.certifications[0]).toEqual({ id: 'cert_01', name: '', issuer: '', date: '' })
  })
})

describe('removeItem', () => {
  it('removeItem then addItem yields exp_03', () => {
    let p = addItem(addItem(emptyProfile(), 'experience').profile, 'experience').profile
    p = removeItem(p, 'experience', 'exp_02')
    expect(p.experience.map((e) => e.id)).toEqual(['exp_01'])
    expect(addItem(p, 'experience').id).toBe('exp_03')
  })
})

describe('updateItem', () => {
  it('patches only the target item', () => {
    const p = updateItem(sampleProfile(), 'experience', 'exp_02', { title: 'Developer' })
    expect(p.experience[1].title).toBe('Developer')
    expect(p.experience[1].employer).toBe('Contoso ApS')
    expect(p.experience[0]).toEqual(sampleProfile().experience[0])
  })
})

describe('moveItem', () => {
  const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]

  it('swaps neighbours', () => {
    expect(moveItem(items, 'b', -1).map((i) => i.id)).toEqual(['b', 'a', 'c'])
    expect(moveItem(items, 'b', 1).map((i) => i.id)).toEqual(['a', 'c', 'b'])
  })

  it('is a no-op at bounds', () => {
    expect(moveItem(items, 'a', -1)).toEqual(items)
    expect(moveItem(items, 'c', 1)).toEqual(items)
  })
})

describe('text lines', () => {
  it('textToLines trims and drops empty lines', () => {
    expect(textToLines('a\n\n  b  \n')).toEqual(['a', 'b'])
    expect(textToLines('one\r\ntwo')).toEqual(['one', 'two'])
  })

  it('linesToText joins with newlines', () => {
    expect(linesToText(['a', 'b'])).toBe('a\nb')
  })
})
