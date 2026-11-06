import { describe, expect, it } from 'vitest'
import {
  applicationFolderName,
  cvPdfName,
  letterPdfName,
  sanitizeFileName,
  uniqueName
} from '../../src/shared/filenames'

describe('sanitizeFileName', () => {
  it('replaces characters Windows forbids and collapses whitespace', () => {
    expect(sanitizeFileName('R&D: "Team" <A/S>')).toBe('R&D Team A S')
  })

  it('suffixes reserved device names', () => {
    expect(sanitizeFileName('CON')).toBe('CON_')
    expect(sanitizeFileName('lpt1')).toBe('lpt1_')
  })

  it('caps the length', () => {
    expect(sanitizeFileName('a'.repeat(300))).toHaveLength(80)
  })

  it('falls back to Untitled when nothing is left', () => {
    expect(sanitizeFileName('  ...  ')).toBe('Untitled')
  })

  it('trims trailing dots', () => {
    expect(sanitizeFileName('Report.')).toBe('Report')
  })
})

describe('applicationFolderName', () => {
  it('joins date, company and role with dashes for spaces', () => {
    expect(applicationFolderName(new Date(2026, 9, 29), 'Acme', 'Data Engineer')).toBe(
      '2026-10-29_Acme_Data-Engineer'
    )
  })

  it('handles illegal characters and non-ASCII letters', () => {
    expect(
      applicationFolderName(new Date(2026, 9, 29), 'Ørsted A/S', 'Senior Data Engineer (m/f)')
    ).toBe('2026-10-29_Ørsted-A-S_Senior-Data-Engineer-(m-f)')
  })

  it('uses Untitled for empty parts', () => {
    expect(applicationFolderName(new Date(2026, 9, 29), '', '')).toBe(
      '2026-10-29_Untitled_Untitled'
    )
  })
})

describe('uniqueName', () => {
  it('appends -2, -3 … until the name is free', () => {
    expect(uniqueName('x', (n) => n === 'x' || n === 'x-2')).toBe('x-3')
    expect(uniqueName('y', () => false)).toBe('y')
  })
})

describe('pdf names', () => {
  it('builds the CV file name', () => {
    expect(cvPdfName('Jane Doe', 'Acme')).toBe('CV - Jane Doe - Acme.pdf')
  })

  it('leaves out a missing company or name from the CV file name', () => {
    expect(cvPdfName('Jane Doe')).toBe('CV - Jane Doe.pdf')
    expect(cvPdfName('')).toBe('CV.pdf')
  })

  it('builds the application file name and sanitizes it', () => {
    expect(letterPdfName('Acme', 'Data/ML Engineer')).toBe(
      'Application - Acme - Data ML Engineer.pdf'
    )
  })
})
