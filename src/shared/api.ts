// Type-only imports: the sandboxed preload bundles this file and must not pull in runtime dependencies.
import type {
  ApplicationLetter,
  ApplicationMeta,
  ApplicationRecord,
  CvContent,
  Draft,
  Highlight,
  LocateResult,
  Profile,
  Settings,
  Style
} from './types'

export type IpcResult<T> = { ok: true; value: T } | { ok: false; error: { kind: string; message: string } }

export type GenerationStage = 'tailoring' | 'writing'

export interface SettingsView {
  settings: Settings
  claude: LocateResult
  dataDir: string
}

export interface ConnectionResult {
  ok: boolean
  message: string
}

export interface Api {
  settings: {
    get(): Promise<SettingsView>
    save(s: Settings): Promise<SettingsView>
    testConnection(): Promise<ConnectionResult>
    pickFile(): Promise<string | null>
    pickFolder(): Promise<string | null>
  }
  profile: {
    get(): Promise<Profile>
    save(p: Profile): Promise<void>
    /** Asks where to save, then writes the CV PDF there. Returns the path, or null if cancelled. */
    exportPdf(html: string): Promise<string | null>
    /** Open or reveal the PDF saved by the last exportPdf. */
    openPdf(): Promise<void>
    showPdf(): Promise<void>
  }
  style: {
    get(): Promise<Style>
    save(s: Style): Promise<void>
  }
  llm: {
    generate(i: { jobDescription: string; instructions: string }): Promise<ApplicationMeta>
    /** With a highlight, the instruction applies to that passage only. */
    reviseCv(i: {
      id: string
      cv: CvContent
      instruction: string
      highlight?: Highlight
    }): Promise<{ cv: CvContent; warnings: string[] }>
    reviseLetter(i: {
      id: string
      cv: CvContent
      letter: ApplicationLetter
      instruction: string
      highlight?: Highlight
    }): Promise<ApplicationLetter>
    cancel(): Promise<void>
    onProgress(cb: (s: GenerationStage) => void): () => void
  }
  applications: {
    list(): Promise<ApplicationMeta[]>
    get(id: string): Promise<ApplicationRecord>
    saveDraft(id: string, d: Draft): Promise<ApplicationMeta>
    exportPdfs(id: string, html: { cv: string; letter: string }): Promise<ApplicationMeta>
    openFile(id: string, fileName: string): Promise<void>
    showFolder(id: string): Promise<void>
    trash(id: string): Promise<void>
  }
}

/** Every invokable method; the IPC channel is "<group>:<method>". */
export const CHANNELS = {
  settings: ['get', 'save', 'testConnection', 'pickFile', 'pickFolder'],
  profile: ['get', 'save', 'exportPdf', 'openPdf', 'showPdf'],
  style: ['get', 'save'],
  llm: ['generate', 'reviseCv', 'reviseLetter', 'cancel'],
  applications: ['list', 'get', 'saveDraft', 'exportPdfs', 'openFile', 'showFolder', 'trash']
} as const

export const PROGRESS_CHANNEL = 'llm:progress'

export const ALL_CHANNELS: string[] = Object.entries(CHANNELS).flatMap(([group, methods]) =>
  methods.map((m) => `${group}:${m}`)
)

/** What the preload exposes as `window.bridge`; renderer/src/api.ts turns it into a typed Api. */
export interface Bridge {
  invoke(channel: string, ...args: unknown[]): Promise<IpcResult<unknown>>
  onProgress(cb: (stage: GenerationStage) => void): () => void
}
