# Claude Code CLI: headless usage notes

Verified on 2026-10-29 against Claude Code 2.1.312 (the binary bundled with the VS Code extension), on Windows 11 and Node 24. The calls were made from Node with `child_process.spawn` (`shell: false`).

## Invocation that works

```
claude.exe -p --output-format json --json-schema <schema-json> --system-prompt-file <file>
           --safe-mode --tools "" --no-session-persistence [--model <alias>]
```

- The user prompt is written to **stdin** as UTF-8, then stdin is closed.
- cwd is an empty directory.
- `ANTHROPIC_API_KEY` is removed from the child's environment.
- `--tools ""` (the empty string passed as a real argv entry) works together with `--json-schema`. Structured output uses an internal mechanism (`stop_reason: "tool_use"`, `num_turns: 2`), and disabling the built-in tools doesn't break it.
- `--safe-mode` keeps user plugins and hooks out. Input was about 1.5k tokens in total; with the SessionStart hooks active it would have been far more.
- Danish text (æ ø å, en dash) round-trips intact through stdin and stdout.
- Latency for a tiny prompt on `haiku`: about 2.7 s wall clock.
- **Do not use `--bare`.** It ignores OAuth/subscription login.
- PowerShell 5.1 drops empty-string arguments to native commands, so test `--tools ""` from Node or Git Bash, not PowerShell.

## Success output (stdout, a single JSON object)

These are the fields we rely on:

```json
{
  "type": "result",
  "subtype": "success",
  "is_error": false,
  "api_error_status": null,
  "result": "{\"echo\":\"Søg jobbet hos Ærø Øl – vi glæder os!\",\"language\":\"da\"}",
  "structured_output": { "echo": "Søg jobbet hos Ærø Øl – vi glæder os!", "language": "da" },
  "total_cost_usd": 0.0003576,
  "duration_ms": 1435
}
```

`structured_output` is the parsed object. `result` holds the same thing as a JSON string, which we use as a fallback.

## Error output

A bad model name gives exit code 0 (in this case), plus a stderr line `[claude-code:unrecognized_model] …` and this on stdout:

```json
{ "type": "result", "subtype": "success", "is_error": true, "api_error_status": 404,
  "terminal_reason": "api_error",
  "result": "There's an issue with the selected model (not-a-real-model). It may not exist or you may not have access to it." }
```

So **always check `is_error`, not just the exit code**. `result` carries a message a person can read. Use `api_error_status` to classify the error: 401 means not logged in, 429 means usage or rate limit.

## Auth check

`claude.exe auth status` prints JSON:

```json
{ "loggedIn": true, "authMethod": "claude.ai", "apiProvider": "firstParty", "subscriptionType": "pro" }
```

`authMethod: "claude.ai"` confirms that calls run on the subscription, not on API billing.
