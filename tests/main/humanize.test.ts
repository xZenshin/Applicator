import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { ClaudeError } from '../../src/main/claude/errors'
import { runCvRevision, runGeneration, runLetterRevision } from '../../src/main/generation'
import {
  HUMANIZE_SYSTEM,
  changedPieces,
  cvPieces,
  humanizePieces,
  letterPieces,
  type Piece
} from '../../src/main/llm/humanize'
import { CV_REVISE_SYSTEM, LETTER_REVISE_SYSTEM, LETTER_SYSTEM, TAILOR_SYSTEM } from '../../src/main/llm/prompts'
import type { RunFn } from '../../src/main/llm/run-fn'
import { createApplication, loadApplication } from '../../src/main/storage/applications'
import { saveProfile } from '../../src/main/storage/profile'
import { saveStyle } from '../../src/main/storage/style'
import type { CvContent } from '../../src/shared/types'
import { sampleCv, sampleDraft, sampleJob, sampleLetter, sampleProfile, sampleStyle } from '../fixtures/sample-data'

const JOB_TEXT = 'Acme is hiring a Data Engineer. You know Python and SQL and like building pipelines.'

let dataDir: string
beforeEach(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'applicator-humanize-'))
})

type Responses = Record<string, unknown | Error | ((input: string) => unknown)>

/** Answers by system prompt. The humanize answer may be a function of the input, to echo back the pieces it got. */
function fakeRun(responses: Responses): { run: RunFn; calls: { system: string; input: string }[] } {
  const calls: { system: string; input: string }[] = []
  const run: RunFn = async (req) => {
    calls.push({ system: req.system, input: req.input })
    const r = responses[req.system]
    if (r instanceof Error) throw r
    return req.schema.parse(typeof r === 'function' ? r(req.input) : r)
  }
  return { run, calls }
}

/** The pieces sent in a humanize input. */
function sentPieces(input: string): Piece[] {
  return JSON.parse(input.slice(input.indexOf('## Pieces to edit (JSON)\n') + '## Pieces to edit (JSON)\n'.length))
}

/** A humanize answer that upper-cases the first word of every piece, so changes are easy to spot. */
const shout = (input: string): unknown => ({
  pieces: sentPieces(input).map((p) => ({ key: p.key, text: p.text.replace(/^\S+/, (w) => w.toUpperCase()) }))
})

async function seed(): Promise<void> {
  await saveProfile(dataDir, sampleProfile())
  await saveStyle(dataDir, sampleStyle())
}

describe('HUMANIZE_SYSTEM', () => {
  it('embeds the vendored guide without its front matter, and the app rules come first', () => {
    expect(HUMANIZE_SYSTEM).toContain('# Humanizer: remove AI writing patterns')
    expect(HUMANIZE_SYSTEM).toContain('### 1. Not X but Y')
    expect(HUMANIZE_SYSTEM).not.toMatch(/^name: humanizer$/m)
    expect(HUMANIZE_SYSTEM.indexOf('Keep every fact')).toBeLessThan(HUMANIZE_SYSTEM.indexOf('<guide>'))
  })
})

describe('pieces', () => {
  it('takes the prose from the CV and the letter, not names or titles', () => {
    const cv: CvContent = {
      ...sampleCv(),
      projects: [{ id: 'proj_01', name: 'Wind', description: 'A forecast model.', technologies: 'Python' }]
    }
    expect(cvPieces(cv).map((p) => p.key)).toEqual(['summary', 'exp:exp_01:0', 'proj:proj_01'])
    expect(letterPieces(sampleLetter()).map((p) => p.key)).toEqual(['letter:0', 'letter:1', 'letter:2'])
  })

  it('finds only the text a revision wrote, even when the rest moved', () => {
    const before = letterPieces(sampleLetter())
    const after = letterPieces({
      ...sampleLetter(),
      paragraphs: ['A brand new opening.', sampleLetter().paragraphs[2], sampleLetter().paragraphs[1]]
    })
    expect(changedPieces(before, after).map((p) => p.text)).toEqual(['A brand new opening.'])
  })
})

describe('humanizePieces', () => {
  const pieces: Piece[] = [
    { key: 'summary', kind: 'CV summary', text: 'A rather long summary text.' },
    { key: 'exp:exp_01:0', kind: 'CV bullet', text: 'Another short text.' },
    { key: 'letter:0', kind: 'Application letter, paragraph 1', text: 'A letter paragraph.' }
  ]

  it('makes no call without pieces', async () => {
    const { run, calls } = fakeRun({})
    expect((await humanizePieces({ run, pieces: [], language: 'en', style: sampleStyle() })).size).toBe(0)
    expect(calls).toHaveLength(0)
  })

  it('sends the language and the writing samples, and drops unknown, empty or much longer rewrites', async () => {
    const { run, calls } = fakeRun({
      [HUMANIZE_SYSTEM]: {
        pieces: [
          { key: 'summary', text: 'A ⟦shorter⟧ summary.' },
          { key: 'exp:exp_01:0', text: 'Another short text!!' }, // one character longer: a CV piece may not grow
          { key: 'letter:0', text: 'A letter paragraph, a bit longer.' }, // a letter paragraph may grow a little
          { key: 'zzz', text: 'Not asked for.' }
        ]
      }
    })
    const out = await humanizePieces({ run, pieces, language: 'da', style: sampleStyle() })
    expect([...out]).toEqual([
      ['summary', 'A shorter summary.'],
      ['letter:0', 'A letter paragraph, a bit longer.']
    ])
    expect(calls[0].input).toContain('## Language of the posting\nda')
    expect(calls[0].input).toContain(sampleStyle().samples[0].text.slice(0, 40))
  })
})

describe('polish in generation', () => {
  it('polishes the CV and the letter in one call, after the letter is written', async () => {
    await seed()
    const { run, calls } = fakeRun({
      [TAILOR_SYSTEM]: { job: sampleJob(), cv: sampleCv() },
      [LETTER_SYSTEM]: sampleLetter(),
      [HUMANIZE_SYSTEM]: shout
    })
    const stages: string[] = []
    const meta = await runGeneration({ humanize: true, run, dataDir, jobDescription: JOB_TEXT, instructions: '', onStage: (s) => stages.push(s), now: new Date() })
    expect(stages).toEqual(['tailoring', 'writing', 'polishing'])
    expect(calls.map((c) => c.system)).toEqual([TAILOR_SYSTEM, LETTER_SYSTEM, HUMANIZE_SYSTEM])

    const { draft } = await loadApplication(dataDir, meta.id)
    expect(draft.cv.summary.startsWith('DATA ')).toBe(true)
    expect(draft.cv.experience[0].bullets[0].startsWith('BUILT ')).toBe(true)
    expect(draft.letter?.paragraphs.every((p) => /^[A-Z]+ /.test(p))).toBe(true)
    expect(draft.letter?.greeting).toBe(sampleLetter().greeting)
    expect(draft.cv.experience[0].id).toBe('exp_01')
  })

  it('skips the polish when it is turned off', async () => {
    await seed()
    const { run, calls } = fakeRun({ [TAILOR_SYSTEM]: { job: sampleJob(), cv: sampleCv() }, [LETTER_SYSTEM]: sampleLetter() })
    await runGeneration({ humanize: false, run, dataDir, jobDescription: JOB_TEXT, instructions: '', onStage: () => {}, now: new Date() })
    expect(calls.map((c) => c.system)).not.toContain(HUMANIZE_SYSTEM)
  })

  it('keeps the unpolished text with a warning when the answer is malformed', async () => {
    await seed()
    const { run } = fakeRun({
      [TAILOR_SYSTEM]: { job: sampleJob(), cv: sampleCv() },
      [LETTER_SYSTEM]: sampleLetter(),
      [HUMANIZE_SYSTEM]: new ClaudeError('invalid_output', 'bad')
    })
    const meta = await runGeneration({ humanize: true, run, dataDir, jobDescription: JOB_TEXT, instructions: '', onStage: () => {}, now: new Date() })
    const { draft } = await loadApplication(dataDir, meta.id)
    expect(draft.letter).toEqual(sampleLetter())
    expect(draft.warnings.some((w) => w.includes('could not be polished'))).toBe(true)
  })

  it('keeps the written application when the polish times out', async () => {
    await seed()
    const { run } = fakeRun({
      [TAILOR_SYSTEM]: { job: sampleJob(), cv: sampleCv() },
      [LETTER_SYSTEM]: sampleLetter(),
      [HUMANIZE_SYSTEM]: new ClaudeError('timeout', 'Claude did not answer within 5 minutes.')
    })
    const meta = await runGeneration({ humanize: true, run, dataDir, jobDescription: JOB_TEXT, instructions: '', onStage: () => {}, now: new Date() })
    const { draft } = await loadApplication(dataDir, meta.id)
    expect(draft.letter).toEqual(sampleLetter())
    expect(draft.warnings.some((w) => w.includes('could not be polished'))).toBe(true)
  })

  it('still stops when the user has to log in again', async () => {
    await seed()
    const { run } = fakeRun({
      [TAILOR_SYSTEM]: { job: sampleJob(), cv: sampleCv() },
      [LETTER_SYSTEM]: sampleLetter(),
      [HUMANIZE_SYSTEM]: new ClaudeError('not_logged_in', 'Log in.')
    })
    const err = await runGeneration({ humanize: true, run, dataDir, jobDescription: JOB_TEXT, instructions: '', onStage: () => {}, now: new Date() }).catch((e) => e)
    expect(err.kind).toBe('not_logged_in')
  })

  it('keeps the fitted CV, without shortening again, when the polished one runs over the page', async () => {
    await seed()
    const { run, calls } = fakeRun({
      [TAILOR_SYSTEM]: { job: sampleJob(), cv: sampleCv() },
      [LETTER_SYSTEM]: sampleLetter(),
      [HUMANIZE_SYSTEM]: shout
    })
    // Pretend the polished summary (upper-cased first word) wraps onto a second page.
    const measureCv = async (_p: unknown, cv: CvContent): Promise<number> => (cv.summary.startsWith('DATA ') ? 5000 : 500)
    const meta = await runGeneration({ humanize: true, run, dataDir, jobDescription: JOB_TEXT, instructions: '', measureCv, onStage: () => {}, now: new Date() })
    const { draft } = await loadApplication(dataDir, meta.id)
    expect(draft.cv).toEqual(sampleCv())
    expect(draft.letter?.paragraphs[0].startsWith('I ')).toBe(true) // the letter keeps its polish ("I" stays "I")
    expect(calls.map((c) => c.system)).toEqual([TAILOR_SYSTEM, LETTER_SYSTEM, HUMANIZE_SYSTEM]) // no shortening calls
  })

  it('still stops when the polish is cancelled', async () => {
    await seed()
    const { run } = fakeRun({
      [TAILOR_SYSTEM]: { job: sampleJob(), cv: sampleCv() },
      [LETTER_SYSTEM]: sampleLetter(),
      [HUMANIZE_SYSTEM]: new ClaudeError('cancelled', 'Cancelled.')
    })
    const err = await runGeneration({ humanize: true, run, dataDir, jobDescription: JOB_TEXT, instructions: '', onStage: () => {}, now: new Date() }).catch((e) => e)
    expect(err).toBeInstanceOf(ClaudeError)
    expect(err.kind).toBe('cancelled')
  })
})

describe('polish in revisions', () => {
  async function app(): Promise<string> {
    const meta = await createApplication(dataDir, { jobDescription: JOB_TEXT, draft: sampleDraft(), profile: sampleProfile(), now: new Date() })
    return meta.id
  }

  it('polishes only the letter paragraph the revision wrote, keeping hand edits elsewhere', async () => {
    await seed()
    const id = await app()
    // The user edited the first paragraph by hand before asking for a change to the last one.
    const current = { ...sampleLetter(), paragraphs: ['my own edited opening.', ...sampleLetter().paragraphs.slice(1)] }
    const revised = { ...current, paragraphs: [...current.paragraphs.slice(0, 2), 'leaning in, I would love to talk.'] }
    const { run, calls } = fakeRun({ [LETTER_REVISE_SYSTEM]: revised, [HUMANIZE_SYSTEM]: shout })

    const out = await runLetterRevision({ humanize: true, run, dataDir, id, cv: sampleCv(), letter: current, instruction: 'Warmer ending' })
    expect(sentPieces(calls[1].input).map((p) => p.key)).toEqual(['letter:2'])
    expect(out.letter.paragraphs).toEqual(['my own edited opening.', sampleLetter().paragraphs[1], 'LEANING in, I would love to talk.'])
    expect(out.warnings).toEqual([])
  })

  it('polishes only the CV text the revision wrote, and makes no call when it wrote none', async () => {
    await seed()
    const id = await app()
    const revised = { ...sampleCv(), summary: 'new summary that the revision wrote.' }
    const { run, calls } = fakeRun({ [CV_REVISE_SYSTEM]: revised, [HUMANIZE_SYSTEM]: shout })
    const out = await runCvRevision({ humanize: true, run, dataDir, id, cv: sampleCv(), instruction: 'Rewrite the summary' })
    expect(sentPieces(calls[1].input).map((p) => p.key)).toEqual(['summary'])
    expect(out.cv.summary).toBe('NEW summary that the revision wrote.')
    expect(out.cv.experience).toEqual(sampleCv().experience)

    const unchanged = fakeRun({ [CV_REVISE_SYSTEM]: sampleCv() })
    await runCvRevision({ humanize: true, run: unchanged.run, dataDir, id, cv: sampleCv(), instruction: 'Reorder skills' })
    expect(unchanged.calls.map((c) => c.system)).toEqual([CV_REVISE_SYSTEM])
  })

  it('leaves revisions alone when the polish is off', async () => {
    await seed()
    const id = await app()
    const revised = { ...sampleLetter(), paragraphs: ['changed.', ...sampleLetter().paragraphs.slice(1)] }
    const { run, calls } = fakeRun({ [LETTER_REVISE_SYSTEM]: revised })
    expect(await runLetterRevision({ humanize: false, run, dataDir, id, cv: sampleCv(), letter: sampleLetter(), instruction: 'x' })).toEqual({ letter: revised, warnings: [] })
    expect(calls).toHaveLength(1)
  })
})
