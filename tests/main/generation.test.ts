import { existsSync, readdirSync } from 'node:fs'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { ClaudeError } from '../../src/main/claude/errors'
import { runCvRevision, runGeneration, runLetterRevision } from '../../src/main/generation'
import { CV_REVISE_SYSTEM, LETTER_REVISE_SYSTEM, LETTER_SYSTEM, TAILOR_SYSTEM } from '../../src/main/llm/prompts'
import type { RunFn } from '../../src/main/llm/run-fn'
import { loadApplication } from '../../src/main/storage/applications'
import { saveProfile } from '../../src/main/storage/profile'
import { saveStyle } from '../../src/main/storage/style'
import { isProfileUsable } from '../../src/shared/profile-checks'
import { emptyProfile } from '../../src/shared/types'
import { sampleCv, sampleJob, sampleLetter, sampleProfile, sampleStyle } from '../fixtures/sample-data'

const JOB_TEXT = 'Acme is hiring a Data Engineer. You know Python and SQL and like building pipelines.'
const NOW = new Date(2026, 9, 29, 10, 0)

let dataDir: string
beforeEach(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'applicator-gen-'))
})

function fakeRun(responses: Record<string, unknown | Error>) {
  const calls: { system: string; input: string }[] = []
  const run: RunFn = async (req) => {
    calls.push({ system: req.system, input: req.input })
    const r = responses[req.system]
    if (r instanceof Error) throw r
    return req.schema.parse(r)
  }
  return { run, calls }
}

const happy = () => fakeRun({ [TAILOR_SYSTEM]: { job: sampleJob(), cv: sampleCv() }, [LETTER_SYSTEM]: sampleLetter() })

async function seed(): Promise<void> {
  await saveProfile(dataDir, sampleProfile())
  await saveStyle(dataDir, sampleStyle())
}

describe('isProfileUsable', () => {
  it('needs a name and at least one experience, education or skill', () => {
    expect(isProfileUsable(emptyProfile())).toBe(false)
    const named = { ...emptyProfile(), personal: { ...emptyProfile().personal, fullName: 'Jane' } }
    expect(isProfileUsable(named)).toBe(false)
    expect(isProfileUsable({ ...named, skills: [{ id: 'skill_01', name: 'Python', category: '' }] })).toBe(true)
    expect(isProfileUsable(sampleProfile())).toBe(true)
  })
})

describe('runGeneration', () => {
  it('creates an application folder with the generated draft', async () => {
    await seed()
    const { run } = happy()
    const stages: string[] = []
    const meta = await runGeneration({ run, dataDir, jobDescription: JOB_TEXT, instructions: 'Mention relocation.', onStage: (s) => stages.push(s), now: NOW })
    expect(meta.id).toBe('2026-10-29_Acme_Data-Engineer')
    expect(stages).toEqual(['tailoring', 'writing'])
    const record = await loadApplication(dataDir, meta.id)
    expect(record.draft.letter).toEqual(sampleLetter())
    expect(record.draft.instructions).toBe('Mention relocation.')
    expect(record.draft.untranslatedIds).toEqual([])
    expect(record.jobDescription).toBe(JOB_TEXT)
  })

  it('leaves no application folder when the letter call fails', async () => {
    await seed()
    const { run } = fakeRun({
      [TAILOR_SYSTEM]: { job: sampleJob(), cv: sampleCv() },
      [LETTER_SYSTEM]: new ClaudeError('usage_limit', 'Limit reached.')
    })
    const e = await runGeneration({ run, dataDir, jobDescription: JOB_TEXT, instructions: '', onStage: () => {}, now: NOW }).catch((x) => x)
    expect(e).toBeInstanceOf(ClaudeError)
    expect(e.kind).toBe('usage_limit')
    const apps = join(dataDir, 'applications')
    expect(existsSync(apps) ? readdirSync(apps) : []).toEqual([])
  })

  it('refuses to generate with an empty profile', async () => {
    const { run, calls } = happy()
    const e = await runGeneration({ run, dataDir, jobDescription: JOB_TEXT, instructions: '', onStage: () => {}, now: NOW }).catch((x) => x)
    expect(e.kind).toBe('profile_empty')
    expect(calls).toHaveLength(0)
  })

  it('refuses a too-short job description', async () => {
    await seed()
    const { run, calls } = happy()
    const e = await runGeneration({ run, dataDir, jobDescription: '  Data engineer wanted  ', instructions: '', onStage: () => {}, now: NOW }).catch((x) => x)
    expect(e.kind).toBe('job_too_short')
    expect(calls).toHaveLength(0)
  })
})

describe('revisions', () => {
  it('runCvRevision uses the profile snapshot, not the current profile', async () => {
    await seed()
    const meta = await runGeneration({ run: happy().run, dataDir, jobDescription: JOB_TEXT, instructions: '', onStage: () => {}, now: NOW })
    const changed = sampleProfile()
    changed.experience[0].employer = 'Changed Corp'
    await saveProfile(dataDir, changed)

    const { run, calls } = fakeRun({ [CV_REVISE_SYSTEM]: sampleCv() })
    const out = await runCvRevision({ run, dataDir, id: meta.id, cv: sampleCv(), instruction: 'Shorter summary' })
    expect(out.cv).toEqual(sampleCv())
    expect(calls[0].input).toContain('Ørsted A/S')
    expect(calls[0].input).not.toContain('Changed Corp')
  })

  it('runLetterRevision passes the style and per-application instructions', async () => {
    await seed()
    const meta = await runGeneration({ run: happy().run, dataDir, jobDescription: JOB_TEXT, instructions: 'Mention relocation.', onStage: () => {}, now: NOW })
    const { run, calls } = fakeRun({ [LETTER_REVISE_SYSTEM]: sampleLetter() })
    await runLetterRevision({ run, dataDir, id: meta.id, cv: sampleCv(), letter: sampleLetter(), instruction: 'Warmer tone' })
    expect(calls[0].input).toContain('Mention relocation.')
    expect(calls[0].input).toContain('Keep it under one page.')
    expect(calls[0].input).toContain('Warmer tone')
  })

  it('revisions pass on the highlighted passage', async () => {
    await seed()
    const meta = await runGeneration({ run: happy().run, dataDir, jobDescription: JOB_TEXT, instructions: '', onStage: () => {}, now: NOW })
    const highlight = { text: 'HIGHLIGHTED', before: '', after: '' }
    const { run, calls } = fakeRun({ [CV_REVISE_SYSTEM]: sampleCv(), [LETTER_REVISE_SYSTEM]: sampleLetter() })
    await runCvRevision({ run, dataDir, id: meta.id, cv: sampleCv(), instruction: 'x', highlight })
    await runLetterRevision({ run, dataDir, id: meta.id, cv: sampleCv(), letter: sampleLetter(), instruction: 'x', highlight })
    for (const call of calls) expect(call.input).toContain('⟦HIGHLIGHTED⟧')
  })
})
