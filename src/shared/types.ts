import { z } from 'zod'

/** In the order the sections appear on the CV. */
export const SECTION_KEYS = ['skills', 'education', 'experience'] as const
export type SectionKey = (typeof SECTION_KEYS)[number]

export const SECTION_PREFIX: Record<SectionKey, string> = {
  skills: 'skill',
  education: 'edu',
  experience: 'exp'
}

const YearMonth = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/)
const OptionalYearMonth = z.union([YearMonth, z.literal('')])
const EndDate = z.union([YearMonth, z.literal(''), z.literal('present')])

// ---------- Profile (the user's CV master data) ----------

export const PersonalSchema = z.object({
  fullName: z.string(),
  email: z.string(),
  phone: z.string(),
  location: z.string(),
  links: z.array(z.object({ label: z.string(), url: z.string() }))
})
export type Personal = z.infer<typeof PersonalSchema>

export const ExperienceItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  employer: z.string(),
  location: z.string(),
  start: OptionalYearMonth,
  end: EndDate,
  bullets: z.array(z.string())
})
export type ExperienceItem = z.infer<typeof ExperienceItemSchema>

export const EducationItemSchema = z.object({
  id: z.string(),
  degree: z.string(),
  institution: z.string(),
  location: z.string(),
  start: OptionalYearMonth,
  end: EndDate,
  details: z.array(z.string())
})
export type EducationItem = z.infer<typeof EducationItemSchema>

export const SkillItemSchema = z.object({ id: z.string(), name: z.string(), category: z.string() })
export type SkillItem = z.infer<typeof SkillItemSchema>

const Counter = z.number().int().min(1)

export const ProfileSchema = z.object({
  version: z.literal(1),
  personal: PersonalSchema,
  summary: z.string(),
  experience: z.array(ExperienceItemSchema),
  education: z.array(EducationItemSchema),
  skills: z.array(SkillItemSchema),
  nextIds: z.object({
    skills: Counter,
    education: Counter,
    experience: Counter
  })
})
export type Profile = z.infer<typeof ProfileSchema>

export function emptyProfile(): Profile {
  return {
    version: 1,
    personal: { fullName: '', email: '', phone: '', location: '', links: [] },
    summary: '',
    experience: [],
    education: [],
    skills: [],
    nextIds: {
      skills: 1,
      education: 1,
      experience: 1
    }
  }
}

// ---------- Writing style ----------

export const WritingSampleSchema = z.object({
  id: z.string(),
  title: z.string(),
  text: z.string(),
  active: z.boolean()
})
export type WritingSample = z.infer<typeof WritingSampleSchema>

export const StyleSchema = z.object({
  version: z.literal(1),
  samples: z.array(WritingSampleSchema),
  defaultInstructions: z.string()
})
export type Style = z.infer<typeof StyleSchema>

export function emptyStyle(): Style {
  return { version: 1, samples: [], defaultInstructions: '' }
}

// ---------- Settings ----------

export const MODEL_OPTIONS = ['', 'fable', 'opus', 'sonnet', 'haiku'] as const

export const SettingsSchema = z.object({
  claudePath: z.string(),
  model: z.enum(MODEL_OPTIONS),
  dataDir: z.string()
})
export type Settings = z.infer<typeof SettingsSchema>

export function defaultSettings(): Settings {
  return { claudePath: '', model: '', dataDir: '' }
}

export type ClaudeSource = 'settings' | 'path' | 'local-bin' | 'vscode'
export interface LocateResult {
  path: string | null
  source: ClaudeSource | null
  shimOnly: boolean
}

// ---------- Generated content (also the LLM output contract) ----------

const ItemId = z.string().describe('Exact id of the item in the candidate profile, e.g. "exp_01"')

export const CvLabelsSchema = z
  .object({
    skills: z.string(),
    education: z.string(),
    experience: z.string(),
    present: z.string().describe('Word used for an ongoing period, e.g. "Present" or "nu"')
  })
  .describe("Section headings in the job posting's language")
export type CvLabels = z.infer<typeof CvLabelsSchema>

export const CvContentSchema = z.object({
  summary: z.string(),
  skills: z.array(z.object({ id: ItemId, name: z.string(), category: z.string() })),
  education: z.array(z.object({ id: ItemId, degree: z.string(), details: z.array(z.string()) })),
  experience: z.array(z.object({ id: ItemId, title: z.string(), bullets: z.array(z.string()) })),
  labels: CvLabelsSchema
})
export type CvContent = z.infer<typeof CvContentSchema>

export const JobInfoSchema = z.object({
  company: z.string(),
  role: z.string(),
  language: z.string().describe('ISO 639-1 code of the job posting language, e.g. "da" or "en"'),
  keyRequirements: z.array(z.string())
})
export type JobInfo = z.infer<typeof JobInfoSchema>

export const ApplicationLetterSchema = z.object({
  greeting: z.string(),
  paragraphs: z.array(z.string()).describe('Body paragraphs only, without greeting or sign-off'),
  signOff: z.string().describe('Closing phrase without the name, e.g. "Kind regards,"')
})
export type ApplicationLetter = z.infer<typeof ApplicationLetterSchema>

/** Text the user highlighted for a revision, with some of the text around it so Claude can tell which occurrence is meant. */
export interface Highlight {
  text: string
  before: string
  after: string
}

// ---------- Stored applications ----------

export const DraftSchema = z.object({
  version: z.literal(1),
  instructions: z.string(),
  job: JobInfoSchema,
  cv: CvContentSchema,
  letter: ApplicationLetterSchema,
  untranslatedIds: z.array(z.string()),
  warnings: z.array(z.string())
})
export type Draft = z.infer<typeof DraftSchema>

export const ApplicationMetaSchema = z.object({
  id: z.string(),
  company: z.string(),
  role: z.string(),
  language: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  exportedAt: z.string().nullable(),
  cvPdf: z.string().nullable(),
  letterPdf: z.string().nullable()
})
export type ApplicationMeta = z.infer<typeof ApplicationMetaSchema>

export interface ApplicationRecord {
  meta: ApplicationMeta
  jobDescription: string
  draft: Draft
  profile: Profile
}
