import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ClaudeError } from '../../src/main/claude/errors'
import { generateApplication, reviseCv, reviseLetter } from '../../src/main/llm/pipeline'
import {
  CV_ONLY_REVISE_SYSTEM,
  CV_ONLY_TAILOR_SYSTEM,
  CV_REVISE_SYSTEM,
  LETTER_REVISE_SYSTEM,
  LETTER_SYSTEM,
  TAILOR_SYSTEM
} from '../../src/main/llm/prompts'
import { makeRunFn, type RunFn } from '../../src/main/llm/run-fn'
import { ApplicationLetterSchema } from '../../src/shared/types'
import type { GenerationStage } from '../../src/shared/api'
import { sampleCv, sampleJob, sampleLetter, sampleProfile, sampleStyle } from '../fixtures/sample-data'

const JOB_TEXT = 'Acme is hiring a Data Engineer with Python and SQL.'

function fakeRun(responses: Record<string, unknown>) {
  const calls: { system: string; input: string }[] = []
  const run: RunFn = async (req) => {
    calls.push({ system: req.system, input: req.input })
    return req.schema.parse(responses[req.system])
  }
  return { run, calls }
}

const tailorResponse = () => ({
  job: { ...sampleJob(), language: 'EN' },
  cv: { ...sampleCv(), experience: [...sampleCv().experience, { id: 'exp_99', title: 'Invented', bullets: [] }] }
})

describe('generateApplication', () => {
  it('runs tailor then letter and reports stages in order', async () => {
    const { run, calls } = fakeRun({ [TAILOR_SYSTEM]: tailorResponse(), [LETTER_SYSTEM]: sampleLetter() })
    const stages: GenerationStage[] = []
    await generateApplication({
      run,
      profile: sampleProfile(),
      style: sampleStyle(),
      jobDescription: JOB_TEXT,
      instructions: '',
      onStage: (s) => stages.push(s)
    })
    expect(stages).toEqual(['tailoring', 'writing'])
    expect(calls.map((c) => c.system)).toEqual([TAILOR_SYSTEM, LETTER_SYSTEM])
  })

  it('letter input contains the sanitized tailored CV', async () => {
    const { run, calls } = fakeRun({ [TAILOR_SYSTEM]: tailorResponse(), [LETTER_SYSTEM]: sampleLetter() })
    await generateApplication({ run, profile: sampleProfile(), style: sampleStyle(), jobDescription: JOB_TEXT, instructions: '', onStage: () => {} })
    expect(calls[1].input).toContain('Built batch and streaming pipelines in Python')
    expect(calls[1].input).not.toContain('exp_99')
    expect(calls[1].input).toContain('"language": "en"')
  })

  it('tailors a CV-only application with the motivated-summary prompt and writes no letter', async () => {
    const { run, calls } = fakeRun({ [CV_ONLY_TAILOR_SYSTEM]: tailorResponse() })
    const stages: GenerationStage[] = []
    const out = await generateApplication({
      run,
      profile: sampleProfile(),
      style: sampleStyle(),
      jobDescription: JOB_TEXT,
      instructions: '',
      ownText: 'OWN-TEXT',
      cvOnly: true,
      onStage: (s) => stages.push(s)
    })
    expect(calls.map((c) => c.system)).toEqual([CV_ONLY_TAILOR_SYSTEM])
    expect(calls[0].input).toContain('OWN-TEXT')
    expect(stages).toEqual(['tailoring'])
    expect(out.letter).toBeNull()
    expect(out.cv.experience.map((e) => e.id)).toEqual(['exp_01'])
  })

  it('returns sanitized cv and normalized language', async () => {
    const { run } = fakeRun({ [TAILOR_SYSTEM]: tailorResponse(), [LETTER_SYSTEM]: sampleLetter() })
    const out = await generateApplication({ run, profile: sampleProfile(), style: sampleStyle(), jobDescription: JOB_TEXT, instructions: '', onStage: () => {} })
    expect(out.job.language).toBe('en')
    expect(out.cv.experience.map((e) => e.id)).toEqual(['exp_01'])
    expect(out.letter).toEqual(sampleLetter())
    expect(out.warnings.join(' ')).toContain('exp_99')
  })
})

describe('revisions', () => {
  it('reviseCv sanitizes the revised cv', async () => {
    const revised = { ...sampleCv(), skills: [{ id: 'skill_77', name: 'Rust', category: '' }] }
    const { run, calls } = fakeRun({ [CV_REVISE_SYSTEM]: revised })
    const out = await reviseCv({ run, profile: sampleProfile(), jobDescription: JOB_TEXT, job: sampleJob(), cv: sampleCv(), instruction: 'Add Rust' })
    expect(out.cv.skills).toEqual([])
    expect(out.warnings.join(' ')).toContain('skill_77')
    expect(calls[0].input).toContain('Add Rust')
  })

  it('reviseCv keeps the motivated-summary prompt for a CV-only application', async () => {
    const { run, calls } = fakeRun({ [CV_ONLY_REVISE_SYSTEM]: sampleCv() })
    await reviseCv({
      run,
      profile: sampleProfile(),
      jobDescription: JOB_TEXT,
      job: sampleJob(),
      cv: sampleCv(),
      instruction: 'Shorter',
      cvOnly: { style: sampleStyle(), ownText: 'OWN-TEXT' }
    })
    expect(calls.map((c) => c.system)).toEqual([CV_ONLY_REVISE_SYSTEM])
    expect(calls[0].input).toContain('OWN-TEXT')
  })

  it('reviseLetter returns the revised letter', async () => {
    const shorter = { ...sampleLetter(), paragraphs: ['Short.'] }
    const { run, calls } = fakeRun({ [LETTER_REVISE_SYSTEM]: shorter })
    const out = await reviseLetter({
      run,
      profile: sampleProfile(),
      style: sampleStyle(),
      jobDescription: JOB_TEXT,
      job: sampleJob(),
      cv: sampleCv(),
      letter: sampleLetter(),
      instruction: 'Make it shorter'
    })
    expect(out).toEqual(shorter)
    expect(calls[0].input).toContain('Make it shorter')
  })

  it('both revisions pass the highlighted passage to Claude', async () => {
    const highlight = { text: 'HIGHLIGHTED', before: 'BEFORE ', after: ' AFTER' }
    const { run, calls } = fakeRun({ [CV_REVISE_SYSTEM]: sampleCv(), [LETTER_REVISE_SYSTEM]: sampleLetter() })
    await reviseCv({ run, profile: sampleProfile(), jobDescription: JOB_TEXT, job: sampleJob(), cv: sampleCv(), instruction: 'x', highlight })
    await reviseLetter({
      run,
      profile: sampleProfile(),
      style: sampleStyle(),
      jobDescription: JOB_TEXT,
      job: sampleJob(),
      cv: sampleCv(),
      letter: sampleLetter(),
      instruction: 'x',
      highlight
    })
    for (const call of calls) expect(call.input).toContain('BEFORE ⟦HIGHLIGHTED⟧ AFTER')
  })

  it('removes highlight markers that Claude copied into its answer', async () => {
    const highlight = { text: 'pipelines', before: '', after: '' }
    const marked = { ...sampleLetter(), paragraphs: ['I built ⟦streaming pipelines⟧.'] }
    const markedCv = { ...sampleCv(), summary: '⟦Data engineer⟧ with five years.' }
    const { run } = fakeRun({ [CV_REVISE_SYSTEM]: markedCv, [LETTER_REVISE_SYSTEM]: marked })
    const cv = await reviseCv({ run, profile: sampleProfile(), jobDescription: JOB_TEXT, job: sampleJob(), cv: sampleCv(), instruction: 'x', highlight })
    const letter = await reviseLetter({
      run,
      profile: sampleProfile(),
      style: sampleStyle(),
      jobDescription: JOB_TEXT,
      job: sampleJob(),
      cv: sampleCv(),
      letter: sampleLetter(),
      instruction: 'x',
      highlight
    })
    expect(letter.paragraphs).toEqual(['I built streaming pipelines.'])
    expect(cv.cv.summary).toBe('Data engineer with five years.')
  })
})

describe('makeRunFn', () => {
  it('throws invalid_output when the CLI output fails the schema', async () => {
    const run = makeRunFn({
      command: { file: process.execPath, prefixArgs: [resolve(__dirname, '../fixtures/fake-claude.mjs')] },
      model: '',
      cwd: join(tmpdir(), 'applicator-runfn-test'),
      env: { ...process.env, FAKE_CLAUDE_MODE: 'ok', FAKE_CLAUDE_OUTPUT: '{"nope":1}' }
    })
    const e = await run({ system: 's', input: 'i', schema: ApplicationLetterSchema }).catch((x) => x)
    expect(e).toBeInstanceOf(ClaudeError)
    expect(e.kind).toBe('invalid_output')
  })

  it('returns parsed output when it matches', async () => {
    const run = makeRunFn({
      command: { file: process.execPath, prefixArgs: [resolve(__dirname, '../fixtures/fake-claude.mjs')] },
      model: '',
      cwd: join(tmpdir(), 'applicator-runfn-test'),
      env: { ...process.env, FAKE_CLAUDE_MODE: 'ok', FAKE_CLAUDE_OUTPUT: JSON.stringify(sampleLetter()) }
    })
    expect(await run({ system: 's', input: 'i', schema: ApplicationLetterSchema })).toEqual(sampleLetter())
  })
})
