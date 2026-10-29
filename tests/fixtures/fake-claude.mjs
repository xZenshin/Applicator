// Stand-in for claude.exe in tests. Behaviour is selected with FAKE_CLAUDE_* environment variables.
import { readFileSync } from 'node:fs'

const args = process.argv.slice(2)
const env = process.env

if (args[0] === 'auth' && args[1] === 'status') {
  process.stdout.write(env.FAKE_CLAUDE_AUTH ?? '{"loggedIn":true,"authMethod":"claude.ai","subscriptionType":"pro"}')
  process.exit(0)
}

const chunks = []
process.stdin.on('data', (c) => chunks.push(c))
process.stdin.on('end', () => {
  const stdin = Buffer.concat(chunks).toString('utf8')
  const mode = env.FAKE_CLAUDE_MODE ?? 'ok'
  const result = (extra) =>
    process.stdout.write(JSON.stringify({ type: 'result', subtype: 'success', is_error: false, ...extra }))

  switch (mode) {
    case 'ok': {
      const output = env.FAKE_CLAUDE_OUTPUT ?? '{}'
      result({ result: output, structured_output: JSON.parse(output) })
      break
    }
    case 'result-only':
      result({ result: env.FAKE_CLAUDE_OUTPUT ?? '{}' })
      break
    case 'echo': {
      const i = args.indexOf('--system-prompt-file')
      const systemPromptFile = i >= 0 ? args[i + 1] : null
      result({
        result: '',
        structured_output: {
          stdin,
          args,
          systemPromptFile,
          systemPrompt: systemPromptFile ? readFileSync(systemPromptFile, 'utf8') : null,
          apiKey: env.ANTHROPIC_API_KEY ?? null,
          authToken: env.ANTHROPIC_AUTH_TOKEN ?? null
        }
      })
      break
    }
    case 'error':
      result({
        is_error: true,
        api_error_status: env.FAKE_CLAUDE_STATUS ? Number(env.FAKE_CLAUDE_STATUS) : null,
        result: env.FAKE_CLAUDE_MESSAGE ?? 'Something went wrong'
      })
      break
    case 'crash':
      process.stderr.write('boom')
      process.stdout.write('not json')
      process.exit(1)
      break
    case 'hang':
      setInterval(() => {}, 1000)
      return
  }
})
