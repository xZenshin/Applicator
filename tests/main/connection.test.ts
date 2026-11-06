import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ClaudeError } from '../../src/main/claude/errors'
import type { ClaudeCommand } from '../../src/main/claude/run'
import { assertSubscriptionAuth, claudeStatus, testConnection } from '../../src/main/connection'

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

describe('claudeStatus', () => {
  const found = async (): Promise<ClaudeCommand> => command

  // In 'hang' mode a prompt would never return, so passing shows the check sends Claude no message.
  it('says connected for a claude.ai login, without sending Claude a message', async () => {
    const s = await claudeStatus(found, env({ FAKE_CLAUDE_MODE: 'hang' }))
    expect(s).toMatchObject({ ok: true, label: 'Claude connected' })
  })

  it('names the problem in a short label and explains it in detail', async () => {
    const loggedOut = await claudeStatus(found, env({ FAKE_CLAUDE_AUTH: '{"loggedIn":false}' }))
    expect(loggedOut).toMatchObject({ ok: false, label: 'Not logged in' })
    expect(loggedOut.detail).toContain('/login')

    const console = await claudeStatus(found, env({ FAKE_CLAUDE_AUTH: '{"loggedIn":true,"authMethod":"console"}' }))
    expect(console).toMatchObject({ ok: false, label: 'Not on subscription' })

    const missing = async (): Promise<ClaudeCommand> => {
      throw new ClaudeError('not_found', 'Claude Code was not found.')
    }
    expect(await claudeStatus(missing, env({}))).toEqual({
      ok: false,
      label: 'Claude not found',
      detail: 'Claude Code was not found.'
    })
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
