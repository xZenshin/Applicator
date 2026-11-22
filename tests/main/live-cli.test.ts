// Live smoke test against the real Claude Code CLI. Skipped unless LIVE_CLI=1.
// Run: LIVE_CLI=1 npx vitest run tests/main/live-cli.test.ts   (optional LIVE_MODEL=sonnet)
import { existsSync, readdirSync } from 'node:fs'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { locateClaude } from '../../src/main/claude/locate'
import { generateApplication } from '../../src/main/llm/pipeline'
import { sendInterviewMessage, writeInterviewReport } from '../../src/main/interview'
import { humanizePieces } from '../../src/main/llm/humanize'
import { makeChatFn, makeRunFn } from '../../src/main/llm/run-fn'
import { createApplication } from '../../src/main/storage/applications'
import { addPdfs, createSession, saveMaterialsText } from '../../src/main/storage/interview'
import { SECTION_KEYS } from '../../src/shared/types'
import { sampleDraft, sampleProfile, sampleStyle } from '../fixtures/sample-data'

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

/** A one-page PDF with the given line of text (Helvetica, ASCII only). */
function tinyPdf(line: string): Buffer {
  const stream = `BT /F1 14 Tf 20 70 Td (${line}) Tj ET`
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 500 144] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
  ]
  let out = '%PDF-1.4\n'
  const offsets: number[] = []
  objects.forEach((o, i) => {
    offsets.push(out.length)
    out += `${i + 1} 0 obj\n${o}\nendobj\n`
  })
  const xref = out.length
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(out, 'latin1')
}

describe.skipIf(process.env.LIVE_CLI !== '1')('live Claude CLI: interview practice', () => {
  it('interviews, reads the prep PDF and writes a report', async () => {
    const found = locateClaude('', process.env, { exists: existsSync, listDir: (p) => (existsSync(p) ? readdirSync(p) : []) })
    const chat = makeChatFn({
      command: { file: found.path!, prefixArgs: [] },
      model: process.env.LIVE_MODEL ?? 'haiku',
      cwd: join(tmpdir(), 'applicator-live-workdir')
    })
    const dataDir = await mkdtemp(join(tmpdir(), 'applicator-live-interview-'))
    const { id: appId } = await createApplication(dataDir, {
      jobDescription: DANISH_POSTING,
      draft: sampleDraft(),
      profile: sampleProfile(),
      now: new Date()
    })
    const pdfFile = join(dataDir, 'case.pdf')
    await writeFile(pdfFile, tinyPdf('Case for the interview: forecasting output from the Hvide Sande wind farm.'))
    await addPdfs(dataDir, appId, [pdfFile], new Date())
    await saveMaterialsText(dataDir, appId, 'The interview is 45 minutes with Mette Hansen and a senior engineer.')
    const now = (): Date => new Date()
    const log: string[] = []

    const interview = await createSession(dataDir, appId, { mode: 'interviewer', feedback: 'end', focus: '' }, now())
    let s = await sendInterviewMessage({ chat, dataDir, appId, sessionId: interview.id, text: '', now })
    log.push(`INTERVIEWER: ${s.messages.at(-1)!.text}`)
    expect(s.messages.at(-1)!.text).toContain('?')
    s = await sendInterviewMessage({
      chat,
      dataDir,
      appId,
      sessionId: interview.id,
      text: 'I have built data pipelines in Python for a few years, mostly batch jobs.',
      now
    })
    log.push(`INTERVIEWER: ${s.messages.at(-1)!.text}`)
    s = await writeInterviewReport({ chat, dataDir, appId, sessionId: interview.id, now })
    log.push(`REPORT: ${s.report!.text}`)
    expect(s.report!.text).toContain('## ')

    const free = await createSession(dataDir, appId, { mode: 'free', feedback: 'end', focus: '' }, now())
    const f = await sendInterviewMessage({
      chat,
      dataDir,
      appId,
      sessionId: free.id,
      text: 'Which wind farm is the case in the PDF about? Answer with its name only.',
      now
    })
    log.push(`FREE: ${f.messages.at(-1)!.text}`)
    await writeFile(join(tmpdir(), 'applicator-live-interview.txt'), log.join('\n\n'), 'utf8')
    expect(f.messages.at(-1)!.text).toMatch(/Hvide Sande/i)
  }, 600_000)
})

describe.skipIf(process.env.LIVE_CLI !== '1')('live Claude CLI: humanize', () => {
  it('polishes AI-sounding Danish text without adding facts or length', async () => {
    const found = locateClaude('', process.env, { exists: existsSync, listDir: (p) => (existsSync(p) ? readdirSync(p) : []) })
    const run = makeRunFn({
      command: { file: found.path!, prefixArgs: [] },
      model: process.env.LIVE_MODEL ?? 'haiku',
      cwd: join(tmpdir(), 'applicator-live-workdir')
    })
    const pieces = [
      {
        key: 'summary',
        kind: 'CV summary',
        text: 'Passioneret og resultatorienteret dataingeniør, der ikke bare bygger pipelines – men skaber værdi. Med solid erfaring i Python, SQL og cloud brænder jeg for at levere robuste, skalerbare og innovative løsninger.'
      },
      { key: 'exp:exp_01:0', kind: 'CV bullet (Data Engineer)', text: 'Spillede en afgørende rolle i at bygge batch- og streaming-pipelines i Python, hvilket understregede min dedikation.' },
      {
        key: 'letter:0',
        kind: 'Application letter, paragraph 1',
        text: 'I en verden, hvor data er den nye olie, er det ikke kun et job – det er en mission. Derfor søger jeg med stor begejstring stillingen som Data Engineer hos Nordlys Energi.'
      }
    ]
    const out = await humanizePieces({ run, pieces, language: 'da', style: { ...sampleStyle(), samples: [] } })
    const report = pieces.map((p) => `${p.key}\n  BEFORE: ${p.text}\n  AFTER:  ${out.get(p.key) ?? '(kept)'}`).join('\n\n')
    await writeFile(join(tmpdir(), 'applicator-live-humanize.txt'), report, 'utf8')
    expect(out.size).toBeGreaterThan(0)
    for (const [key, text] of out) {
      expect(text.length).toBeLessThanOrEqual(pieces.find((p) => p.key === key)!.text.length * 1.1 + 20)
      expect(text).toMatch(/[æøå]|\b(og|jeg|med|til)\b/i) // still Danish
    }
  }, 300_000)
})
