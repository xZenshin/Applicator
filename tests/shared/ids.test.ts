import { describe, expect, it } from 'vitest'
import { allocateId } from '../../src/shared/ids'
import { emptyProfile } from '../../src/shared/types'

describe('allocateId', () => {
  it('allocates zero-padded ids per section', () => {
    let p = emptyProfile()
    const a = allocateId(p, 'experience')
    p = a.profile
    const b = allocateId(p, 'experience')
    p = b.profile
    expect([a.id, b.id, allocateId(p, 'skills').id]).toEqual(['exp_01', 'exp_02', 'skill_01'])
  })

  it('never reuses ids after deletion', () => {
    let p = emptyProfile()
    for (const _ of [1, 2]) {
      const r = allocateId(p, 'experience')
      p = {
        ...r.profile,
        experience: [
          ...r.profile.experience,
          { id: r.id, title: '', employer: '', location: '', start: '', end: '', bullets: [] }
        ]
      }
    }
    p = { ...p, experience: p.experience.filter((e) => e.id !== 'exp_02') }
    expect(allocateId(p, 'experience').id).toBe('exp_03')
  })

  it('grows past 99', () => {
    const p = emptyProfile()
    p.nextIds.experience = 100
    expect(allocateId(p, 'experience').id).toBe('exp_100')
  })

  it('does not mutate the input profile', () => {
    const p = emptyProfile()
    allocateId(p, 'skills')
    expect(p.nextIds.skills).toBe(1)
  })
})
