import { describe, expect, it } from 'vitest'
import { renderCvHtml } from '../../src/shared/templates/cv'
import { escapeHtml } from '../../src/shared/templates/escape'
import { formatLetterDate, formatRange, formatYearMonth } from '../../src/shared/templates/format'
import { renderLetterHtml } from '../../src/shared/templates/letter'
import { sampleCv, sampleLetter, sampleProfile } from '../fixtures/sample-data'

const danishCv = () => ({
  ...sampleCv(),
  experience: [{ id: 'exp_01', title: 'Dataingeniør', bullets: ['Byggede pipelines'] }],
  labels: { ...sampleCv().labels, present: 'nu' }
})

describe('renderCvHtml', () => {
  it('takes employer and dates from the profile and text from the cv', () => {
    const html = renderCvHtml(sampleProfile(), danishCv(), { language: 'da' })
    for (const text of ['Ørsted A/S', 'Dataingeniør', 'Byggede pipelines', 'nu', '2021', 'Jane Doe', 'jane@example.com']) {
      expect(html).toContain(text)
    }
  })

  it('only shows selected items', () => {
    const html = renderCvHtml(sampleProfile(), sampleCv(), { language: 'en' })
    expect(html).not.toContain('Contoso ApS')
    expect(html).not.toContain('Azure Data Engineer Associate')
  })

  it('escapes HTML', () => {
    const cv = { ...sampleCv(), experience: [{ id: 'exp_01', title: 'A & B', bullets: ['<script>alert(1)</script>'] }] }
    const html = renderCvHtml(sampleProfile(), cv, { language: 'en' })
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(html).not.toContain('<script>')
    expect(html).toContain('A &amp; B')
  })

  it('omits empty sections', () => {
    const html = renderCvHtml(sampleProfile(), sampleCv(), { language: 'en' })
    expect(html).not.toContain('Projects')
    expect(html).not.toContain('Certifications')
    expect(html).toContain('Experience')
  })

  it('sets html lang and injects fontCss', () => {
    const html = renderCvHtml(sampleProfile(), sampleCv(), { language: 'da', fontCss: '/*FONT-CSS*/' })
    expect(html).toContain('<html lang="da">')
    expect(html).toContain('/*FONT-CSS*/')
  })

  it('groups skills by category in order of first appearance', () => {
    const cv = {
      ...sampleCv(),
      skills: [
        { id: 'skill_01', name: 'Python', category: 'Programming' },
        { id: 'skill_02', name: 'SQL', category: 'Programming' }
      ]
    }
    const html = renderCvHtml(sampleProfile(), cv, { language: 'en' })
    expect(html.match(/Programming:/g)).toHaveLength(1)
    expect(html).toContain('Python, SQL')
  })
})

describe('format', () => {
  it('formats ranges with a present label', () => {
    expect(formatRange('2021-03', 'present', 'en', 'Present')).toBe('Mar 2021 – Present')
    expect(formatRange('2018-08', '2021-02', 'en', 'Present')).toBe('Aug 2018 – Feb 2021')
    expect(formatRange('', '2021-02', 'en', 'Present')).toBe('Feb 2021')
    expect(formatYearMonth('', 'en')).toBe('')
  })

  it('falls back to English for an invalid language tag', () => {
    expect(formatYearMonth('2021-03', 'not a tag')).toBe('Mar 2021')
  })

  it('formats letter dates in the given language', () => {
    expect(formatLetterDate(new Date(2026, 9, 29), 'da')).toBe('29. oktober 2026')
    expect(formatLetterDate(new Date(2026, 9, 29), 'en')).toBe('October 29, 2026')
  })

  it('escapeHtml escapes quotes too', () => {
    expect(escapeHtml(`"a" & 'b' <c>`)).toBe('&quot;a&quot; &amp; &#39;b&#39; &lt;c&gt;')
  })
})

describe('renderLetterHtml', () => {
  it('renders localized date, paragraphs and signature', () => {
    const letter = sampleLetter()
    const html = renderLetterHtml(sampleProfile(), letter, { language: 'da', company: 'Acme', date: new Date(2026, 9, 29) })
    expect(html).toContain('29. oktober 2026')
    expect(html).toContain('<html lang="da">')
    expect(html).toContain(escapeHtml(letter.subject))
    for (const p of letter.paragraphs) expect(html).toContain(`<p>${escapeHtml(p)}</p>`)
    const signOffAt = html.indexOf('Kind regards,')
    expect(signOffAt).toBeGreaterThan(-1)
    expect(html.indexOf('Jane Doe', signOffAt)).toBeGreaterThan(signOffAt)
    expect(html).toContain('Acme')
  })
})

describe('links in the CV', () => {
  it('adds https:// to scheme-less links and never emits other schemes', () => {
    const profile = sampleProfile()
    profile.personal.links = [
      { label: 'LinkedIn', url: 'linkedin.com/in/jane' },
      { label: 'Evil', url: 'javascript:alert(1)' },
      { label: 'Mail', url: 'mailto:jane@example.com' },
      { label: 'Site', url: 'https://jane.dev' }
    ]
    profile.projects[0].url = 'github.com/janedoe/etl'
    const cv = { ...sampleCv(), projects: [{ id: 'proj_01', name: 'ETL', context: '', bullets: [] }] }
    const html = renderCvHtml(profile, cv, { language: 'en' })
    expect(html).toContain('href="https://linkedin.com/in/jane"')
    expect(html).toContain('href="mailto:jane@example.com"')
    expect(html).toContain('href="https://jane.dev"')
    expect(html).toContain('href="https://github.com/janedoe/etl"')
    expect(html).not.toContain('javascript:')
    expect(html).toContain('Evil')
  })
})
