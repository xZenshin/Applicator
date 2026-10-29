import { describe, expect, it } from 'vitest'
import {
  buildCvReviseInput,
  buildLetterInput,
  buildLetterReviseInput,
  buildTailorInput,
  targetWordCount
} from '../../src/main/llm/prompts'
import { TailorOutputSchema, toCliSchema } from '../../src/main/llm/schemas'
import { SAMPLE_120_WORDS, sampleCv, sampleJob, sampleLetter, sampleProfile, sampleStyle } from '../fixtures/sample-data'

const JOB_TEXT = 'Acme is hiring a Data Engineer with Python and SQL.'

describe('buildTailorInput', () => {
  it('contains every profile item id and the job text, and omits nextIds', () => {
    const input = buildTailorInput({ profile: sampleProfile(), jobDescription: JOB_TEXT, instructions: '' })
    for (const id of ['exp_01', 'exp_02', 'edu_01', 'skill_01', 'skill_02', 'lang_01', 'lang_02', 'proj_01', 'cert_01']) {
      expect(input).toContain(id)
    }
    expect(input).toContain(JOB_TEXT)
    expect(input).toContain('## Job posting')
    expect(input).toContain('## Candidate profile (JSON)')
    expect(input).toContain('## Extra instructions\n(none)')
    expect(input).not.toContain('nextIds')
  })
})

describe('targetWordCount', () => {
  it('averages active samples and defaults to 350', () => {
    expect(targetWordCount(sampleStyle())).toBe(120)
    expect(targetWordCount({ ...sampleStyle(), samples: [] })).toBe(350)
    const words = (n: number): string => Array(n).fill('word').join(' ')
    const style = {
      ...sampleStyle(),
      samples: [
        { id: 'a', title: 'a', text: words(100), active: true },
        { id: 'b', title: 'b', text: words(125), active: true },
        { id: 'c', title: 'c', text: words(900), active: false }
      ]
    }
    expect(targetWordCount(style)).toBe(110)
  })
})

describe('buildLetterInput', () => {
  it('includes only active samples and the target length', () => {
    const input = buildLetterInput({
      profile: sampleProfile(),
      style: sampleStyle(),
      jobDescription: JOB_TEXT,
      instructions: 'Mention relocation.',
      job: sampleJob(),
      cv: sampleCv()
    })
    expect(input).toContain(SAMPLE_120_WORDS)
    expect(input).toContain('### Sample: Application to Contoso')
    expect(input).not.toContain('INACTIVE-MARKER')
    expect(input).toContain('About 120 words.')
    expect(input).toContain('Keep it under one page.')
    expect(input).toContain('Mention relocation.')
    expect(input).toContain('## Tailored CV (JSON)')
    expect(input).toContain('## Job analysis (JSON)')
  })
})

describe('revise inputs', () => {
  it('buildLetterReviseInput includes the current letter and the requested change', () => {
    const letter = { ...sampleLetter(), subject: 'UNIQUE-SUBJECT' }
    const input = buildLetterReviseInput({
      profile: sampleProfile(),
      style: sampleStyle(),
      jobDescription: JOB_TEXT,
      job: sampleJob(),
      cv: sampleCv(),
      letter,
      instruction: 'Make it shorter'
    })
    expect(input).toContain('## Current letter (JSON)')
    expect(input).toContain('UNIQUE-SUBJECT')
    expect(input).toContain('## Requested change\nMake it shorter')
  })

  it('buildCvReviseInput includes the current CV and the requested change', () => {
    const cv = { ...sampleCv(), headline: 'UNIQUE-HEADLINE' }
    const input = buildCvReviseInput({
      profile: sampleProfile(),
      jobDescription: JOB_TEXT,
      job: sampleJob(),
      cv,
      instruction: 'Add the SQL skill'
    })
    expect(input).toContain('## Current CV (JSON)')
    expect(input).toContain('UNIQUE-HEADLINE')
    expect(input).toContain('## Requested change\nAdd the SQL skill')
  })
})

describe('toCliSchema', () => {
  it('has no $schema and describes job and cv', () => {
    const schema = toCliSchema(TailorOutputSchema) as Record<string, unknown> & {
      properties: Record<string, unknown>
    }
    expect(schema.$schema).toBeUndefined()
    expect(schema.type).toBe('object')
    expect(Object.keys(schema.properties)).toEqual(['job', 'cv'])
  })
})
