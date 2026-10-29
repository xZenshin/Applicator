import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ClaudeError } from '../../src/main/claude/errors'
import type { ClaudeCommand } from '../../src/main/claude/run'
import { assertSubscriptionAuth, testConnection } from '../../src/main/connection'

const command: ClaudeCommand = {
  file: process.execPath,
  prefixArgs: [resolve(__dirname, '../fixtures/fake-claude.mjs')]
}
const cwd = join(tmpdir(), 'applicator-connection-test')
const env = (extra: Record<string, string>): NodeJS.ProcessEnv => ({ ...process.env, ...extra })

describe('assertSubscriptionAuth', () => {
  it('accepts a claude.ai login', async () => {
    expect(await assertSubscriptionAuth(command, env({}))).toMatchObject({ authMethod: 'claude.ai' })
  })

  it('rejects non-subscription auth', async () => {
    const e = await assertSubscriptionAuth(
      command,
      env({ FAKE_CLAUDE_AUTH: '{"loggedIn":true,"authMethod":"console"}' })
    ).catch((x) => x)
    expect(e).toBeInstanceOf(ClaudeError)
    expect(e.kind).toBe('not_subscription')
    expect(e.message).toContain('console')
  })

  it('rejects logged-out', async () => {
    const e = await assertSubscriptionAuth(command, env({ FAKE_CLAUDE_AUTH: '{"loggedIn":false}' })).catch((x) => x)
    expect(e).toBeInstanceOf(ClaudeError)
    expect(e.kind).toBe('not_logged_in')
  })
})

describe('testConnection', () => {
  it('succeeds against fake claude', async () => {
    const r = await testConnection({
      command,
      cwd,
      model: '',
      env: env({ FAKE_CLAUDE_MODE: 'ok', FAKE_CLAUDE_OUTPUT: '{"reply":"OK"}' })
    })
    expect(r.ok).toBe(true)
    expect(r.message).toContain('claude.ai (pro)')
  })

  it('reports failures as ok: false instead of throwing', async () => {
    const r = await testConnection({ command, cwd, model: '', env: env({ FAKE_CLAUDE_AUTH: '{"loggedIn":false}' }) })
    expect(r.ok).toBe(false)
    expect(r.message).toContain('/login')
  })
})
