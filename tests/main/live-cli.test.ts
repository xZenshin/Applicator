// Live smoke test against the real Claude Code CLI. Skipped unless LIVE_CLI=1.
// Run: LIVE_CLI=1 npx vitest run tests/main/live-cli.test.ts   (optional LIVE_MODEL=sonnet)
import { existsSync, readdirSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { locateClaude } from '../../src/main/claude/locate'
import { generateApplication } from '../../src/main/llm/pipeline'
import { makeRunFn } from '../../src/main/llm/run-fn'
import { SECTION_KEYS } from '../../src/shared/types'
import { sampleProfile, sampleStyle } from '../fixtures/sample-data'

const DANISH_POSTING = `Nordlys Energi A/S søger en Data Engineer til vores analyseteam i København.

Du skal bygge og vedligeholde dataplatformen, der samler produktionsdata fra vores vindparker.

Vi forventer:
- Erfaring med Python og SQL
- Erfaring med batch- og streaming-pipelines
- Gode samarbejdsevner og flydende dansk

Send din ansøgning til Mette Hansen senest 15. november.`

describe.skipIf(process.env.LIVE_CLI !== '1')('live Claude CLI', () => {
  it('generates a Danish CV and letter that pass the schemas and guardrails', async () => {
    const found = locateClaude('', process.env, {
      exists: existsSync,
      listDir: (p) => (existsSync(p) ? readdirSync(p) : [])
    })
    expect(found.path).toBeTruthy()
    const run = makeRunFn({
      command: { file: found.path!, prefixArgs: [] },
      model: process.env.LIVE_MODEL ?? 'haiku',
      cwd: join(tmpdir(), 'applicator-live-workdir')
    })
    const profile = sampleProfile()
    const out = await generateApplication({
      run,
      profile,
      style: sampleStyle(),
      jobDescription: DANISH_POSTING,
      instructions: '',
      onStage: () => {}
    })
    await writeFile(join(tmpdir(), 'applicator-live-output.json'), JSON.stringify(out, null, 2), 'utf8')

    expect(out.job.language).toBe('da')
    expect(out.job.company).toContain('Nordlys')
    expect(out.cv.experience.map((e) => e.id)).toContain('exp_01')
    const known = new Set(Object.values(profile).flatMap((v) => (Array.isArray(v) ? v.map((i: { id?: string }) => i.id) : [])))
    for (const section of SECTION_KEYS) {
      for (const item of out.cv[section]) expect(known.has(item.id)).toBe(true)
    }
    expect(out.letter?.paragraphs.length).toBeGreaterThan(0)
  }, 300_000)
})
