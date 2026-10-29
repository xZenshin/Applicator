import { describe, expect, it } from 'vitest'
import { filterApplications } from '../../src/renderer/src/lib/history-filter'
import type { ApplicationMeta } from '../../src/shared/types'

const meta = (id: string, company: string, role: string): ApplicationMeta => ({
  id,
  company,
  role,
  language: 'da',
  createdAt: '2026-10-29T10:00:00.000Z',
  updatedAt: '2026-10-29T10:00:00.000Z',
  exportedAt: null,
  cvPdf: null,
  letterPdf: null
})

const list = [
  meta('2026-10-29_Ørsted-A-S_Data-Engineer', 'Ørsted A/S', 'Data Engineer'),
  meta('2026-10-20_Novo_Analyst', 'Novo', 'Analyst')
]

describe('filterApplications', () => {
  it('empty query returns all', () => {
    expect(filterApplications(list, '   ')).toEqual(list)
  })

  it('matches case-insensitively across company and role', () => {
    expect(filterApplications(list, 'ørsted DATA').map((m) => m.company)).toEqual(['Ørsted A/S'])
    expect(filterApplications(list, 'analyst').map((m) => m.company)).toEqual(['Novo'])
  })

  it('all tokens must match', () => {
    expect(filterApplications(list, 'ørsted novo')).toEqual([])
  })

  it('matches the date in the id', () => {
    expect(filterApplications(list, '2026-10-20').map((m) => m.company)).toEqual(['Novo'])
  })
})
