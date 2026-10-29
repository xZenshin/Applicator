import { z } from 'zod'
import { CvContentSchema, JobInfoSchema } from '../../shared/types'

export const TailorOutputSchema = z.object({ job: JobInfoSchema, cv: CvContentSchema })

/** JSON Schema for the CLI's --json-schema flag. */
export function toCliSchema(schema: z.ZodType): object {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { $schema, ...rest } = z.toJSONSchema(schema) as Record<string, unknown>
  return rest
}
