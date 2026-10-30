import { describe, expect, it } from 'vitest'
import {
  buildCvReviseInput,
  buildLetterInput,
  buildLetterReviseInput,
  buildTailorInput,
  fitOnePageInstruction,
  targetWordCount
} from '../../src/main/llm/prompts'
import { TailorOutputSchema, toCliSchema } from '../../src/main/llm/schemas'
import { SAMPLE_120_WORDS, sampleCv, sampleJob, sampleLetter, sampleProfile, sampleStyle } from '../fixtures/sample-data'

const JOB_TEXT = 'Acme is hiring a Data Engineer with Python and SQL.'

describe('buildTailorInput', () => {
  it('contains every profile item id and the job text, and omits nextIds', () => {
    const input = buildTailorInput({ profile: sampleProfile(), jobDescription: JOB_TEXT, instructions: '' })
    for (const id of ['exp_01', 'exp_02', 'edu_01', 'skill_01', 'skill_02']) {
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
    const letter = { ...sampleLetter(), greeting: 'UNIQUE-GREETING' }
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
    expect(input).toContain('UNIQUE-GREETING')
    expect(input).toContain('## Requested change\nMake it shorter')
  })

  it('buildCvReviseInput includes the current CV and the requested change', () => {
    const cv = { ...sampleCv(), summary: 'UNIQUE-SUMMARY' }
    const input = buildCvReviseInput({
      profile: sampleProfile(),
      jobDescription: JOB_TEXT,
      job: sampleJob(),
      cv,
      instruction: 'Add the SQL skill'
    })
    expect(input).toContain('## Current CV (JSON)')
    expect(input).toContain('UNIQUE-SUMMARY')
    expect(input).toContain('## Requested change\nAdd the SQL skill')
  })

  const highlight = { text: 'streaming pipelines', before: 'Built batch and ', after: ' in Python' }

  it('mark the highlighted passage in its context, before the requested change', () => {
    const letterInput = buildLetterReviseInput({
      profile: sampleProfile(),
      style: sampleStyle(),
      jobDescription: JOB_TEXT,
      job: sampleJob(),
      cv: sampleCv(),
      letter: sampleLetter(),
      instruction: 'Mention Kafka',
      highlight
    })
    const cvInput = buildCvReviseInput({
      profile: sampleProfile(),
      jobDescription: JOB_TEXT,
      job: sampleJob(),
      cv: sampleCv(),
      instruction: 'Mention Kafka',
      highlight
    })
    for (const input of [letterInput, cvInput]) {
      expect(input).toContain('## Highlighted passage\nBuilt batch and ⟦streaming pipelines⟧ in Python')
      expect(input.indexOf('## Highlighted passage')).toBeLessThan(input.indexOf('## Requested change'))
    }
  })

  it('leave out the highlight section when nothing is highlighted', () => {
    const input = buildCvReviseInput({
      profile: sampleProfile(),
      jobDescription: JOB_TEXT,
      job: sampleJob(),
      cv: sampleCv(),
      instruction: 'Shorter'
    })
    expect(input).not.toContain('Highlighted passage')
  })
})

describe("the candidate's own text", () => {
  const OWN = 'I have followed Acme since the Aarhus hackathon in 2024.'
  const letterArgs = {
    profile: sampleProfile(),
    style: sampleStyle(),
    jobDescription: JOB_TEXT,
    instructions: '',
    job: sampleJob(),
    cv: sampleCv()
  }

  it('is given to Claude in its own section when writing and when revising the letter', () => {
    const write = buildLetterInput({ ...letterArgs, ownText: OWN })
    const revise = buildLetterReviseInput({ ...letterArgs, letter: sampleLetter(), instruction: 'Shorter', ownText: OWN })
    for (const input of [write, revise]) {
      expect(input).toContain(`## Text the candidate wrote for this application\n${OWN}`)
    }
  })

  it('is left out when the candidate wrote nothing', () => {
    for (const ownText of [undefined, '', ' \n ']) {
      expect(buildLetterInput({ ...letterArgs, ownText })).not.toContain('Text the candidate wrote')
    }
  })
})

describe('CV-only applications', () => {
  it('ask for a longer, motivated summary instead of the usual 2-4 sentences', async () => {
    const { CV_ONLY_TAILOR_SYSTEM, CV_ONLY_REVISE_SYSTEM } = await import('../../src/main/llm/prompts')
    for (const prompt of [CV_ONLY_TAILOR_SYSTEM, CV_ONLY_REVISE_SYSTEM]) {
      expect(prompt).toMatch(/without an application letter/)
      expect(prompt).toMatch(/summary: .*6-8 sentences/)
      expect(prompt).toMatch(/why they want this job at this company/)
      expect(prompt).not.toMatch(/2-4 sentences/)
    }
  })

  it('give Claude the writing samples and the text the candidate wrote, but not the default instructions for letters', () => {
    const cvOnly = { style: sampleStyle(), ownText: 'OWN-TEXT' }
    const tailor = buildTailorInput({ profile: sampleProfile(), jobDescription: JOB_TEXT, instructions: '', cvOnly })
    const revise = buildCvReviseInput({
      profile: sampleProfile(),
      jobDescription: JOB_TEXT,
      job: sampleJob(),
      cv: sampleCv(),
      instruction: 'Shorter',
      cvOnly
    })
    for (const input of [tailor, revise]) {
      expect(input).toContain(SAMPLE_120_WORDS)
      expect(input).toContain('## Text the candidate wrote for this application\nOWN-TEXT')
      expect(input).not.toContain('Keep it under one page.')
    }
  })
})

describe('one-page CVs', () => {
  it('every CV prompt says the CV must fit on one A4 page', async () => {
    const prompts = await import('../../src/main/llm/prompts')
    for (const prompt of [prompts.TAILOR_SYSTEM, prompts.CV_REVISE_SYSTEM, prompts.CV_ONLY_TAILOR_SYSTEM, prompts.CV_ONLY_REVISE_SYSTEM]) {
      expect(prompt).toMatch(/fit on one A4 page/)
    }
  })

  it('the request to shorten says how far over the CV is and to leave out the least relevant first', () => {
    expect(fitOnePageInstruction(1)).toContain('about 1 line too long')
    expect(fitOnePageInstruction(9)).toContain('about 9 lines too long')
    expect(fitOnePageInstruction(9)).toMatch(/least relevant/)
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

describe('revise system prompts', () => {
  it('give the requested change priority over target length and samples, but not over facts', async () => {
    const { LETTER_REVISE_SYSTEM, CV_REVISE_SYSTEM } = await import('../../src/main/llm/prompts')
    expect(LETTER_REVISE_SYSTEM).toMatch(/requested change takes priority over the target length/i)
    expect(LETTER_REVISE_SYSTEM).toMatch(/never over rule 3/i)
    expect(CV_REVISE_SYSTEM).toMatch(/requested change takes priority/i)
  })

  it('limit a change to the highlighted passage, marked with ⟦ and ⟧', async () => {
    const { LETTER_REVISE_SYSTEM, CV_REVISE_SYSTEM } = await import('../../src/main/llm/prompts')
    for (const prompt of [LETTER_REVISE_SYSTEM, CV_REVISE_SYSTEM]) {
      expect(prompt).toMatch(/highlighted passage/i)
      expect(prompt).toContain('⟦')
      expect(prompt).toContain('⟧')
    }
  })
})

describe('CV prompts', () => {
  it('only ask for the summary and the sections on the CV', async () => {
    const { TAILOR_SYSTEM, CV_REVISE_SYSTEM } = await import('../../src/main/llm/prompts')
    for (const prompt of [TAILOR_SYSTEM, CV_REVISE_SYSTEM]) {
      expect(prompt).not.toMatch(/headline|language names|links/i)
      expect(prompt).toMatch(/summary: 2-4 sentences/)
    }
  })
})

describe('letter prompts', () => {
  it('ask for greeting, paragraphs and sign-off, but no subject line', async () => {
    const { LETTER_SYSTEM, LETTER_REVISE_SYSTEM } = await import('../../src/main/llm/prompts')
    for (const prompt of [LETTER_SYSTEM, LETTER_REVISE_SYSTEM]) {
      expect(prompt).not.toMatch(/subject/i)
      expect(prompt).toMatch(/greeting:/)
      expect(prompt).toMatch(/signOff:/)
    }
  })

  it("build the letter on the candidate's own text and accept the facts in it", async () => {
    const { LETTER_SYSTEM, LETTER_REVISE_SYSTEM } = await import('../../src/main/llm/prompts')
    for (const prompt of [LETTER_SYSTEM, LETTER_REVISE_SYSTEM]) {
      expect(prompt).toMatch(/text the candidate wrote for this application/i)
      expect(prompt).toMatch(/use only facts found in the profile, the tailored CV or the text the candidate wrote/i)
    }
    expect(LETTER_REVISE_SYSTEM).toMatch(/requested change takes priority over the target length, the writing samples and the text the candidate wrote/i)
  })
})
