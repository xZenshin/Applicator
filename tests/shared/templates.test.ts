import { describe, expect, it } from 'vitest'
import { renderCvHtml } from '../../src/shared/templates/cv'
import { escapeHtml } from '../../src/shared/templates/escape'
import { formatLetterDate, formatYearRange } from '../../src/shared/templates/format'
import { renderLetterHtml } from '../../src/shared/templates/letter'
import { sampleCv, sampleLetter, sampleProfile } from '../fixtures/sample-data'

const danishCv = () => ({
  ...sampleCv(),
  experience: [{ id: 'exp_01', title: 'Dataingeniør', bullets: ['Byggede pipelines'] }],
  labels: { ...sampleCv().labels, present: 'nu' }
})

const contactLine = (html: string): string => /<div class="contact">(.*?)<\/div>/.exec(html)?.[1] ?? ''
/** The text a reader sees: markup removed (line breaks kept as <br>). */
const visible = (html: string): string => html.replace(/<(?!br>)[^>]+>/g, '')

describe('renderCvHtml', () => {
  it('takes employer, location and years from the profile and text from the cv', () => {
    const html = visible(renderCvHtml(sampleProfile(), danishCv(), { language: 'da' }))
    for (const text of ['Ørsted A/S | Copenhagen', 'Dataingeniør', 'Byggede pipelines', '2021 – nu', 'jane@example.com']) {
      expect(html).toContain(text)
    }
  })

  it('puts the last word of the name on its own line', () => {
    const named = (fullName: string): string => {
      const profile = sampleProfile()
      profile.personal.fullName = fullName
      const html = renderCvHtml(profile, sampleCv(), { language: 'en' })
      return visible(/<h1>(.*?)<\/h1>/.exec(html)?.[1] ?? '')
    }
    expect(named('Jane Doe')).toBe('Jane<br>Doe')
    expect(named('Anna Marie Jensen')).toBe('Anna Marie<br>Jensen')
    expect(named('Cher')).toBe('Cher')
  })

  it('lists location, phone, email and links separated by bars', () => {
    const html = renderCvHtml(sampleProfile(), sampleCv(), { language: 'en' })
    expect(contactLine(html)).toBe(
      'Copenhagen, Denmark | +45 12 34 56 78 | jane@example.com | <a href="https://linkedin.com/in/janedoe">LinkedIn</a>'
    )
  })

  it('shows the summary without a heading, then skills, education and experience', () => {
    const html = renderCvHtml(sampleProfile(), sampleCv(), { language: 'en' })
    expect(html).toContain(`<section class="intro"><p>${sampleCv().summary}</p></section>`)
    const order = [sampleCv().summary, 'Technical Skills', 'Education', 'Experience'].map((text) =>
      visible(html).indexOf(text)
    )
    expect(order.every((at) => at > -1)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
  })

  it('only shows selected items', () => {
    const html = renderCvHtml(sampleProfile(), sampleCv(), { language: 'en' })
    expect(html).not.toContain('Contoso ApS')
  })

  it('escapes HTML', () => {
    const cv = { ...sampleCv(), experience: [{ id: 'exp_01', title: 'A & B', bullets: ['<script>alert(1)</script>'] }] }
    const html = renderCvHtml(sampleProfile(), cv, { language: 'en' })
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(html).not.toContain('<script>')
    expect(html).toContain('A &amp; B')
  })

  it('omits empty sections', () => {
    const html = visible(renderCvHtml(sampleProfile(), { ...sampleCv(), education: [] }, { language: 'en' }))
    expect(html).not.toContain('Education')
    expect(html).toContain('Experience')
  })

  it('sets html lang and injects fontCss', () => {
    const html = renderCvHtml(sampleProfile(), sampleCv(), { language: 'da', fontCss: '/*FONT-CSS*/' })
    expect(html).toContain('<html lang="da">')
    expect(html).toContain('/*FONT-CSS*/')
  })

  it('lists skills as one bullet per category, in order of first appearance', () => {
    const profile = sampleProfile()
    profile.skills.push({ id: 'skill_03', name: 'Git', category: '' })
    const cv = {
      ...sampleCv(),
      skills: [
        { id: 'skill_01', name: 'Python', category: 'Programming' },
        { id: 'skill_03', name: 'Git', category: '' },
        { id: 'skill_02', name: 'SQL', category: 'Programming' }
      ]
    }
    const html = renderCvHtml(profile, cv, { language: 'en' })
    expect(html).toContain('<ul><li><strong>Programming</strong>: Python, SQL</li><li>Git</li></ul>')
  })

  it('shows a single line of text as a paragraph and several as bullets', () => {
    const cv = {
      ...sampleCv(),
      experience: [
        { id: 'exp_01', title: 'Data Engineer', bullets: ['Built pipelines end-to-end.'] },
        { id: 'exp_02', title: 'Junior Developer', bullets: ['Maintained tools', 'Fixed bugs'] }
      ]
    }
    const html = renderCvHtml(sampleProfile(), cv, { language: 'en' })
    expect(html).toContain('<p>Built pipelines end-to-end.</p>')
    expect(html).toContain('<ul><li>Maintained tools</li><li>Fixed bugs</li></ul>')
  })

  it('sets small caps in a small-caps font, so each word stays one piece of text in the PDF', () => {
    // Small caps drawn at two font sizes (font-variant, or capitals in two sizes) split every word in two
    // in the PDF, so viewers select "ducation" when "Education" is double-clicked.
    const profile = sampleProfile()
    profile.personal.fullName = 'Jane Skou-Doe'
    const cv = { ...sampleCv(), experience: [{ id: 'exp_01', title: 'R&D engineer', bullets: [] }] }
    const html = renderCvHtml(profile, cv, { language: 'en' })
    expect(html).toContain('<h1>Jane<br>Skou-Doe</h1>')
    expect(html).toContain('<h2>Technical Skills</h2>')
    expect(html).toContain('<strong>R&amp;D engineer</strong>')
    expect(html).toMatch(/h1, h2, \.entry-title strong \{ font-family: 'Cabin Small Caps'/)
    expect(html).not.toContain('font-variant')
    expect(html).not.toContain('class="sc"')
  })

  it('uses Cabin, while the letter keeps Source Sans 3', () => {
    const cv = renderCvHtml(sampleProfile(), sampleCv(), { language: 'en' })
    const letter = renderLetterHtml(sampleProfile(), sampleLetter(), { language: 'en', company: '', date: new Date() })
    expect(cv).toContain("font-family: 'Cabin'")
    expect(cv).not.toContain('Source Sans 3')
    expect(letter).toContain("font-family: 'Source Sans 3'")
    expect(letter).not.toContain('Cabin')
  })
})

describe('format', () => {
  it('formats ranges as years with a present label', () => {
    expect(formatYearRange('2021-03', 'present', 'Present')).toBe('2021 – Present')
    expect(formatYearRange('2018-08', '2021-02', 'Present')).toBe('2018 – 2021')
    expect(formatYearRange('', '2021-02', 'Present')).toBe('2021')
    expect(formatYearRange('2021-03', '', 'Present')).toBe('2021')
    expect(formatYearRange('', '', 'Present')).toBe('')
  })

  it('formats letter dates in the given language, falling back to English', () => {
    expect(formatLetterDate(new Date(2026, 9, 29), 'da')).toBe('29. oktober 2026')
    expect(formatLetterDate(new Date(2026, 9, 29), 'en')).toBe('October 29, 2026')
    expect(formatLetterDate(new Date(2026, 9, 29), 'not a tag')).toBe('October 29, 2026')
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
    const html = renderCvHtml(profile, sampleCv(), { language: 'en' })
    expect(html).toContain('href="https://linkedin.com/in/jane"')
    expect(html).toContain('href="mailto:jane@example.com"')
    expect(html).toContain('href="https://jane.dev"')
    expect(html).not.toContain('javascript:')
    expect(html).toContain('Evil')
  })
})
