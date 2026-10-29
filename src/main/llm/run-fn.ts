import type { z } from 'zod'
import { CLAUDE_MESSAGES, ClaudeError } from '../claude/errors'
import { runClaude, type ClaudeRunRequest } from '../claude/run'
import { toCliSchema } from './schemas'

/** One structured LLM call: system prompt + stdin input in, schema-validated value out. */
export type RunFn = <T>(req: { system: string; input: string; schema: z.ZodType<T> }) => Promise<T>

export function makeRunFn(base: Omit<ClaudeRunRequest, 'systemPrompt' | 'input' | 'jsonSchema'>): RunFn {
  return async <T>(req: { system: string; input: string; schema: z.ZodType<T> }): Promise<T> => {
    const raw = await runClaude({
      ...base,
      systemPrompt: req.system,
      input: req.input,
      jsonSchema: toCliSchema(req.schema)
    })
    const parsed = req.schema.safeParse(raw)
    if (!parsed.success) throw new ClaudeError('invalid_output', CLAUDE_MESSAGES.invalid_output)
    return parsed.data
  }
}
