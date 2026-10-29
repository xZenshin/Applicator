# Applicator v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Windows 11 Electron app that takes a pasted job description and, using the Claude Code CLI, produces a tailored CV and application letter (as PDFs), and keeps a local history of everything it generated.

**Architecture:** The Electron main process owns four things: storage (JSON files in `Documents\Applicator`), the Claude CLI runner, the LLM pipeline, and PDF printing. A typed preload bridge (`window.api`) exposes them to a React/Mantine renderer. Pure logic (types, IDs, filenames, HTML templates, prompts, sanitizing, editor helpers) has no Electron imports, so Vitest can cover it. Electron-only glue is checked by hand in `npm run dev`.

**Tech Stack:** Electron via electron-vite (react-ts template), React, Mantine (core/hooks/notifications), react-router-dom (HashRouter), zod 4, Vitest, @fontsource/source-sans-3, electron-builder (NSIS).

**Spec:** `docs/superpowers/specs/2026-10-29-applicator-design.md`. CLI facts verified by the spike are in `docs/claude-cli-notes.md`. Read both before starting.

**Branch:** work on `feat/applicator-v1`. Every commit message ends with a blank line, then `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Global Constraints

- **Platform:** Windows 11 x64 only, Node 24. No native Node modules (nothing that needs electron-rebuild).
- **LLM access:** only through the Claude Code CLI in print mode. Never the Anthropic API or SDK, and never `--bare`.
- **CLI args, exactly:** `-p --output-format json --json-schema <schema> --system-prompt-file <file> --safe-mode --tools "" --no-session-persistence`. Add `--model <alias>` only when the model setting is non-empty.
- **Child process:**
  - All dynamic prompt content goes through stdin as UTF-8.
  - The child's env has `ANTHROPIC_API_KEY` and `ANTHROPIC_AUTH_TOKEN` removed.
  - cwd is `<userData>/claude-workdir`, an empty directory.
  - Only a native `claude.exe` is run.
- **Error checking:** always check `is_error` in the CLI result, whatever the exit code. Before the first LLM call of each app session, `claude auth status` must report `authMethod: "claude.ai"`.
- **Item IDs:** `exp_NN`, `edu_NN`, `skill_NN`, `lang_NN`, `proj_NN`, `cert_NN`, zero-padded to at least 2 digits. They come from per-section counters and are never reused.
- **No LLM-supplied facts:** dates, employer/institution/issuer names, locations, URLs and contact details always come from the profile by ID.
- **Output language:** the job posting's language (an ISO 639-1 code produced by the tailor call).
- **PDFs:** A4, single column, no photo, Source Sans 3 embedded.
- **Data locations:** the data root defaults to `<Documents>\Applicator` (`app.getPath('documents')`) and can be overridden in Settings. Settings live in `<userData>/settings.json`. All JSON writes are atomic (temp file, then rename).
- **Security:** `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`. Previews render in `<iframe sandbox="">`.
- **Scope:** core only. No CV import, status tracking, multiple templates, DOCX or photo.
- **Imports:** relative only. Don't add new path aliases.

## Review Focus

1. **Huge inputs** (a 15-page job ad, a long profile, several long samples) must reach the CLI intact. → Task 4 test `passes a 200 KB stdin payload intact`.
2. **Hand-edited or corrupt `profile.json`/`style.json`** must produce a visible error, and the file must never be overwritten with an empty default. → Task 3 test `loadProfile throws DataFileError on invalid JSON and leaves the file untouched`, plus the Task 6 page behaviour.
3. **Company or role names that are illegal or reserved in Windows paths** (`R&D: "Team" <A/S>`, `CON`, 300-character titles, empty strings) must still yield valid folder and PDF names. Ids passed over IPC can't escape the data folder. → Task 2 `filenames.test.ts`; Task 3 test `applicationDir rejects path traversal ids`.
4. **The CLI failing mid-generation** (logged out, usage limit, cancel during the 2nd call) must show a clear message and leave no half-written application folder. → Task 4 classification tests; Task 10 test `leaves no application folder when the letter call fails`.
5. **Schema-valid but off-contract LLM output** (unknown or duplicate IDs, an ID in the wrong section, a language word instead of a code) is cleaned up with warnings. → Task 8 tests `drops unknown, duplicate and wrong-section ids with warnings` and `normalizes language`.

## File Map

```
src/shared/            no Electron imports; used by main, renderer and tests
  types.ts             zod schemas + inferred types (Profile, Style, Settings, CvContent, Draft, …)
  errors.ts            AppError
  ids.ts               allocateId
  filenames.ts         sanitizeFileName, applicationFolderName, uniqueName, cvPdfName, letterPdfName
  text.ts              countWords
  profile-checks.ts    isProfileUsable
  api.ts               Api interface, IpcResult, channel names, view types
  templates/           escape.ts, format.ts, base-css.ts, cv.ts, letter.ts
src/main/
  index.ts             window + app lifecycle (scaffold)
  context.ts           settings/dataDir/claude lookups for handlers
  claude/              locate.ts, run.ts, errors.ts
  connection.ts        getAuth check + testConnection
  storage/             atomic.ts, paths.ts, settings.ts, profile.ts, style.ts, applications.ts
  llm/                 schemas.ts, prompts.ts, sanitize.ts, run-fn.ts, pipeline.ts
  generation.ts        runGeneration, runCvRevision, runLetterRevision
  pdf/                 print.ts (Electron), export.ts (orchestration)
  ipc/                 wrap.ts (pure), handle.ts, settings.ts, profile.ts, style.ts, llm.ts, applications.ts, index.ts
src/preload/           index.ts, index.d.ts
src/renderer/src/
  App.tsx, main.tsx, api.ts
  hooks/useAutosave.ts
  lib/                 text-lines.ts, profile-edit.ts, profile-sections.ts, cv-edit.ts, history-filter.ts, fonts.ts
  components/          SectionEditor.tsx, LinesInput.tsx, PreviewFrame.tsx, CvEditor.tsx, LetterEditor.tsx, RevisePanel.tsx
  pages/               NewApplicationPage, ReviewPage, HistoryPage, HistoryDetailPage, ProfilePage, StylePage, SettingsPage (.tsx)
tests/
  fixtures/            sample-data.ts, fake-claude.mjs
  shared/  main/  renderer/     *.test.ts
```

---

### Task 1: Scaffold the app shell

**Files:**
- Create (from scaffold): `package.json`, `electron.vite.config.ts`, `electron-builder.yml`, `tsconfig*.json`, `src/main/index.ts`, `src/preload/index.ts`, `src/renderer/index.html`, `src/renderer/src/main.tsx`, `src/renderer/src/App.tsx`
- Create: `vitest.config.ts`, `src/renderer/src/pages/*Page.tsx` (placeholders)
- Keep: `README.md`, `LICENSE`

**Interfaces:**
- Produces: the routes `/new` (default), `/review/:id`, `/history`, `/history/:id`, `/profile`, `/style`, `/settings`, and the npm scripts `dev`, `build`, `typecheck`, `build:win`, `test`.

- [ ] **Step 1:** Run `git checkout -b feat/applicator-v1`.
- [ ] **Step 2: Scaffold.** In the scratchpad, run `npm create @quick-start/electron@latest applicator-scaffold -- --template react-ts`. Answer *no* to the updater plugin and the download mirror. Copy everything except `.git` and `README.md` into the repo root. Delete the template demo (`Versions.tsx`, logo assets, demo CSS).
- [ ] **Step 3: Install dependencies.** Run `npm i @mantine/core @mantine/hooks @mantine/notifications react-router-dom zod@^4 @fontsource/source-sans-3` and `npm i -D vitest`.
- [ ] **Step 4: Configure tests and TypeScript.**
  - Add the script `"test": "vitest run"`.
  - Create `vitest.config.ts` with `test: { include: ['tests/**/*.test.ts'], environment: 'node', passWithNoTests: true }`.
  - Add `src/shared/**/*`, `tests/**/*` and `vitest.config.ts` to the `include` of `tsconfig.node.json`.
  - Add `src/shared/**/*` to `tsconfig.web.json`.
- [ ] **Step 5: CSP.** In the CSP meta of `src/renderer/index.html`, add `font-src 'self' data:`. Srcdoc preview iframes inherit this CSP, and the embedded fonts are data URLs.
- [ ] **Step 6: Main window.** In `src/main/index.ts`, create the window at 1280×860 (minimum 1024×700) with title "Applicator" and `webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }`.
- [ ] **Step 7: App shell.** In `App.tsx`, wrap everything in `MantineProvider`, `Notifications` and `HashRouter`, and use an `AppShell` with a left navbar. Nav labels in order: "New application" → `/new`, "History" → `/history`, "My CV" → `/profile`, "Writing style" → `/style`, "Settings" → `/settings`. `/` redirects to `/new`. Each placeholder page renders its title.
- [ ] **Step 8: Verify.** `npm run typecheck` exits 0. `npm test` exits 0. `npm run dev` opens the window, and every nav link shows its page.
- [ ] **Step 9: Commit.** `git add -A && git commit -m "chore: scaffold electron-vite React app shell"`

---

### Task 2: Shared domain types, IDs, filenames and test fixtures

**Files:**
- Create: `src/shared/types.ts`, `src/shared/errors.ts`, `src/shared/ids.ts`, `src/shared/filenames.ts`, `tests/fixtures/sample-data.ts`
- Test: `tests/shared/ids.test.ts`, `tests/shared/filenames.test.ts`

**Interfaces (Produces).** Each type has a zod schema `XSchema` and `type X = z.infer<…>`.

```ts
type SectionKey = 'experience' | 'education' | 'skills' | 'languages' | 'projects' | 'certifications'
const SECTION_KEYS: SectionKey[]            // the order above; also the CV render order
const SECTION_PREFIX: Record<SectionKey, string> // exp, edu, skill, lang, proj, cert
// YearMonth = 'YYYY-MM' (regex /^\d{4}-(0[1-9]|1[0-2])$/); '' = not set
Personal       { fullName, headline, email, phone, location: string; links: { label: string; url: string }[] }
ExperienceItem { id, title, employer, location: string; start: YearMonth | ''; end: YearMonth | '' | 'present'; bullets: string[] }
EducationItem  { id, degree, institution, location: string; start: YearMonth | ''; end: YearMonth | '' | 'present'; details: string[] }
SkillItem      { id, name, category: string }
LanguageItem   { id, name, level: string }
ProjectItem    { id, name, context, url: string; date: YearMonth | ''; bullets: string[] }
CertificationItem { id, name, issuer: string; date: YearMonth | '' }
Profile  { version: 1; personal: Personal; summary: string; experience: ExperienceItem[]; education: EducationItem[];
           skills: SkillItem[]; languages: LanguageItem[]; projects: ProjectItem[]; certifications: CertificationItem[];
           nextIds: Record<SectionKey, number> }
WritingSample { id: string; title: string; text: string; active: boolean }
Style    { version: 1; samples: WritingSample[]; defaultInstructions: string }
Settings { claudePath: string; model: '' | 'fable' | 'opus' | 'sonnet' | 'haiku'; dataDir: string }   // '' = auto/default
CvLabels { profile, experience, education, skills, languages, projects, certifications, present: string }
CvContent { headline: string; summary: string;
            experience: { id: string; title: string; bullets: string[] }[];
            education: { id: string; degree: string; details: string[] }[];
            skills: { id: string; name: string; category: string }[];
            languages: { id: string; name: string; level: string }[];
            projects: { id: string; name: string; context: string; bullets: string[] }[];
            certifications: { id: string; name: string }[];
            labels: CvLabels }
JobInfo  { company: string; role: string; language: string; keyRequirements: string[] }
ApplicationLetter { subject: string; greeting: string; paragraphs: string[]; signOff: string }
Draft    { version: 1; instructions: string; job: JobInfo; cv: CvContent; letter: ApplicationLetter;
           untranslatedIds: string[]; warnings: string[] }
ApplicationMeta { id: string /* folder name */; company: string; role: string; language: string;
                  createdAt: string; updatedAt: string; exportedAt: string | null;
                  cvPdf: string | null; letterPdf: string | null }
ApplicationRecord { meta: ApplicationMeta; jobDescription: string; draft: Draft; profile: Profile /* snapshot */ }
type ClaudeSource = 'settings' | 'path' | 'local-bin' | 'vscode'                         // plain TS types (no zod)
interface LocateResult { path: string | null; source: ClaudeSource | null; shimOnly: boolean }
emptyProfile(): Profile   // nextIds all 1
emptyStyle(): Style
defaultSettings(): Settings  // all ''
// errors.ts
class AppError extends Error { constructor(readonly kind: string, message: string) }
// ids.ts
allocateId(profile: Profile, section: SectionKey): { id: string; profile: Profile }   // pure; bumps nextIds[section]
// filenames.ts
sanitizeFileName(name: string, maxLength = 80): string
applicationFolderName(date: Date, company: string, role: string): string   // local date
uniqueName(base: string, exists: (name: string) => boolean): string
cvPdfName(fullName: string, company: string): string
letterPdfName(company: string, role: string): string
```

`CvContent`'s six arrays are keyed by `SectionKey`, so `cv[section]` works for every section.

**`sanitizeFileName` rules:**
- Replace each of `<>:"/\|?*` and control characters with a space, collapse whitespace, and trim spaces and dots from both ends.
- Cut to `maxLength`, then trim again.
- Append `_` to a case-insensitive reserved name (CON, PRN, AUX, NUL, COM1–9, LPT1–9).
- If the result is empty, return `Untitled`.

**`applicationFolderName`:** `YYYY-MM-DD_<company>_<role>`. Each part is `sanitizeFileName(x, 40)` with spaces turned into `-`.

**`tests/fixtures/sample-data.ts`** exports `sampleProfile()`, `sampleStyle()`, `sampleCv()`, `sampleJob()`, `sampleLetter()` and `sampleDraft()`. Later tasks rely on these exact values:
- **Profile:** Jane Doe.
  - `exp_01`: Data Engineer, employer `Ørsted A/S`, start `2021-03`, end `present`, 2 bullets.
  - `exp_02`: Junior Developer, employer `Contoso ApS`, 2018-08 to 2021-02.
  - `edu_01`: MSc Computer Science, institution `DTU`.
  - `skill_01`: Python (category "Programming"); `skill_02`: SQL (category "Programming").
  - `lang_01`: Danish (Native); `lang_02`: English (Fluent).
  - `proj_01` and `cert_01` exist.
  - `nextIds` is set to the next free numbers.
- **Style:**
  - sample `s1`, active, exactly 120 words;
  - sample `s2`, inactive, text contains `INACTIVE-MARKER`;
  - `defaultInstructions` set to `Keep it under one page.`.
- **Job:** `{ company: 'Acme', role: 'Data Engineer', language: 'en', keyRequirements: ['Python', 'SQL'] }`.
- **CV:** English. Selects `exp_01`, `edu_01`, `skill_01` and `lang_01`, with English labels (`present: 'Present'`, `projects: 'Projects'`).
- **Letter:** 3 paragraphs.

- [ ] **Step 1: Write failing tests.**

```ts
// tests/shared/ids.test.ts
it('allocates zero-padded ids per section', () => {
  let p = emptyProfile()
  const a = allocateId(p, 'experience'); p = a.profile
  const b = allocateId(p, 'experience'); p = b.profile
  expect([a.id, b.id, allocateId(p, 'skills').id]).toEqual(['exp_01', 'exp_02', 'skill_01'])
})
it('never reuses ids after deletion', () => { /* allocate exp_01, exp_02; drop exp_02 from experience; next is 'exp_03' */ })
it('grows past 99', () => { /* nextIds.experience = 100 → 'exp_100' */ })

// tests/shared/filenames.test.ts
expect(sanitizeFileName('R&D: "Team" <A/S>')).toBe('R&D Team A S')
expect(sanitizeFileName('CON')).toBe('CON_')
expect(sanitizeFileName('lpt1')).toBe('lpt1_')
expect(sanitizeFileName('a'.repeat(300))).toHaveLength(80)
expect(sanitizeFileName('  ...  ')).toBe('Untitled')
expect(sanitizeFileName('Report.')).toBe('Report')
expect(applicationFolderName(new Date(2026, 9, 29), 'Acme', 'Data Engineer')).toBe('2026-10-29_Acme_Data-Engineer')
expect(applicationFolderName(new Date(2026, 9, 29), 'Ørsted A/S', 'Senior Data Engineer (m/f)'))
  .toBe('2026-10-29_Ørsted-A-S_Senior-Data-Engineer-(m-f)')
expect(applicationFolderName(new Date(2026, 9, 29), '', '')).toBe('2026-10-29_Untitled_Untitled')
expect(uniqueName('x', n => n === 'x' || n === 'x-2')).toBe('x-3')
expect(cvPdfName('Jane Doe', 'Acme')).toBe('CV - Jane Doe - Acme.pdf')
expect(letterPdfName('Acme', 'Data/ML Engineer')).toBe('Application - Acme - Data ML Engineer.pdf')
```

- [ ] **Step 2: Run them.** `npx vitest run tests/shared`. Expected: FAIL (modules missing).
- [ ] **Step 3: Implement** `types.ts`, `errors.ts`, `ids.ts`, `filenames.ts` and `sample-data.ts` per the interfaces above. Parse each fixture with its schema so a bad fixture fails loudly.
- [ ] **Step 4: Rerun.** `npx vitest run tests/shared`. Expected: PASS. Then `npm run typecheck` passes.
- [ ] **Step 5: Commit.** `git add src/shared tests && git commit -m "feat: shared domain types, id allocation, filename rules"`

---

### Task 3: Local storage

**Files:**
- Create: `src/main/storage/atomic.ts`, `paths.ts`, `settings.ts`, `profile.ts`, `style.ts`, `applications.ts`
- Test: `tests/main/storage.test.ts`, `tests/main/applications.test.ts` (each test in a fresh `fs.mkdtemp(os.tmpdir())` dir)

**Interfaces:**
- Consumes: Task 2 schemas, `applicationFolderName`, `uniqueName`, `AppError`.
- Produces:

```ts
class DataFileError extends AppError   // kind 'data_file'; message includes the file path
writeTextAtomic(filePath: string, text: string): Promise<void>   // mkdir -p; write `${filePath}.tmp-<random>`; rename
writeJsonAtomic(filePath: string, data: unknown): Promise<void>  // JSON.stringify(data, null, 2)
readJsonFile<T>(filePath: string, schema: z.ZodType<T>, fallback: () => T): Promise<T> // ENOENT → fallback(); bad JSON/schema → DataFileError
resolveDataDir(settings: Settings, documentsDir: string): string // settings.dataDir || join(documentsDir, 'Applicator')
loadSettings(userDataDir: string): Promise<Settings>   // invalid file → defaultSettings() (app-owned file)
saveSettings(userDataDir: string, s: Settings): Promise<void>
loadProfile(dataDir: string): Promise<Profile>;  saveProfile(dataDir: string, p: Profile): Promise<void>  // profile.json
loadStyle(dataDir: string): Promise<Style>;      saveStyle(dataDir: string, s: Style): Promise<void>      // style.json
applicationDir(dataDir: string, id: string): string   // throws AppError('bad_id') if id is empty or contains / \ or '..'
createApplication(dataDir: string, a: { jobDescription: string; draft: Draft; profile: Profile; now: Date }): Promise<ApplicationMeta>
listApplications(dataDir: string): Promise<ApplicationMeta[]>    // newest createdAt first; skips folders without a valid meta.json
loadApplication(dataDir: string, id: string): Promise<ApplicationRecord>
saveDraft(dataDir: string, id: string, draft: Draft, now: Date): Promise<ApplicationMeta>        // bumps updatedAt
setExported(dataDir: string, id: string, files: { cvPdf: string; letterPdf: string }, now: Date): Promise<ApplicationMeta>
```

**Folder layout:** `<dataDir>/applications/<id>/` holds `meta.json`, `job-description.txt`, `draft.json` and `profile-snapshot.json`. The id comes from `uniqueName(applicationFolderName(now, job.company, job.role), exists)`, and meta takes company, role and language from `draft.job`.

- [ ] **Step 1: Write failing tests.**
  - `writeJsonAtomic round-trips and leaves no .tmp- files`
  - `loadProfile returns emptyProfile() when the file is missing`
  - `loadProfile throws DataFileError on invalid JSON and leaves the file untouched`. Write `{ broken`, expect a rejection with `DataFileError`, then check the file still reads `{ broken`.
  - `saveProfile/loadProfile round-trips sampleProfile()`
  - `loadSettings falls back to defaults on an invalid file`
  - `createApplication writes meta, job description, draft and profile snapshot`. With `now = new Date(2026, 9, 29)`, the id is `2026-10-29_Acme_Data-Engineer`, all 4 files exist and `exportedAt` is null.
  - `createApplication suffixes colliding folder names`. The second id ends in `-2`.
  - `listApplications returns newest first and skips broken folders`
  - `saveDraft updates draft and updatedAt`
  - `setExported records file names and time`
  - `applicationDir rejects path traversal ids`. `'..\\x'`, `'a/b'` and `''` all throw `AppError` with kind `bad_id`.
- [ ] **Step 2: Run.** `npx vitest run tests/main`. Expected: FAIL.
- [ ] **Step 3: Implement** the storage modules per the interfaces.
- [ ] **Step 4: Run.** `npx vitest run tests/main`. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat: atomic JSON storage for settings, profile, style, applications"`

---

### Task 4: Claude CLI locator and runner

**Files:**
- Create: `src/main/claude/errors.ts`, `src/main/claude/locate.ts`, `src/main/claude/run.ts`, `tests/fixtures/fake-claude.mjs`
- Test: `tests/main/claude-locate.test.ts`, `tests/main/claude-run.test.ts`

**Interfaces (Produces):**

```ts
type ClaudeErrorKind = 'not_found' | 'not_logged_in' | 'not_subscription' | 'usage_limit' | 'api_error'
                     | 'invalid_output' | 'timeout' | 'cancelled' | 'process_failed'
class ClaudeError extends AppError { readonly kind: ClaudeErrorKind }
classifyResultError(r: { result?: string; api_error_status?: number | null }): ClaudeError
interface ClaudeCommand { file: string; prefixArgs: string[] }   // real: { file: exe, prefixArgs: [] }
// ClaudeSource + LocateResult are declared in src/shared/types.ts (the renderer's Settings page needs them):
type ClaudeSource = 'settings' | 'path' | 'local-bin' | 'vscode'
interface LocateResult { path: string | null; source: ClaudeSource | null; shimOnly: boolean }
interface LocateFs { exists(p: string): boolean; listDir(p: string): string[] }
locateClaude(override: string, env: NodeJS.ProcessEnv, fs: LocateFs): LocateResult
interface ClaudeRunRequest { command: ClaudeCommand; systemPrompt: string; input: string; jsonSchema: object;
  model: string; cwd: string; timeoutMs?: number /* default 300_000 */; signal?: AbortSignal; env?: NodeJS.ProcessEnv }
buildClaudeArgs(jsonSchema: object, systemPromptFile: string, model: string): string[]
runClaude(req: ClaudeRunRequest): Promise<unknown>   // returns structured_output
interface AuthStatus { loggedIn: boolean; authMethod?: string; subscriptionType?: string }
getAuthStatus(command: ClaudeCommand, env?: NodeJS.ProcessEnv): Promise<AuthStatus>   // runs `<cmd> auth status`, parses JSON
```

**Locate order** (build paths with `path.win32`):
1. If `override` is non-empty: return it if it exists; otherwise return `{ path: null, source: 'settings' }`.
2. Each `env.PATH` entry (split on `;`): use `claude.exe` if present. If a dir only has `claude.cmd` or `claude.ps1`, set `shimOnly = true` and keep looking.
3. `%USERPROFILE%\.local\bin\claude.exe`.
4. Among `%USERPROFILE%\.vscode\extensions\anthropic.claude-code-<x.y.z>-win32-x64\resources\native-binary\claude.exe`, pick the highest version by numeric comparison.

**Runner behaviour:**
- Write the system prompt to `os.tmpdir()/applicator-sys-<random>.txt` and always delete it afterwards.
- `mkdir -p cwd`. Spawn with `shell: false, windowsHide: true` and the env without the two keys.
- Write `input` to stdin as UTF-8, then close stdin. Decode stdout as UTF-8.
- On `signal` abort or timeout, kill the child.
- Parse stdout as JSON:
  - `is_error: true` → `classifyResultError`.
  - Otherwise, if `structured_output` is present, return it.
  - Otherwise return `JSON.parse(result)`; if that fails → `invalid_output`.
- If stdout isn't JSON → `process_failed`.
- Spawn `ENOENT` → `not_found`.

**Classification:**
- `not_logged_in`: status 401 or `/log ?in|\/login|not logged|invalid api key|authenticat/i`.
- `usage_limit`: status 429 or `/usage limit|rate limit|limit reached/i`.
- Anything else: `api_error`.

**Messages (exact):**
- `not_found`: "Claude Code CLI was not found. Install it (see README) or set its path in Settings."
- `not_logged_in`: "Claude Code is not logged in. Open a terminal, run `claude`, and log in with /login."
- `usage_limit`: "Your Claude usage limit has been reached. Try again later. (CLI: <result>)"
- `timeout`: "Claude did not answer within 5 minutes."
- `cancelled`: "Cancelled."
- `invalid_output`: "Claude returned an answer in an unexpected format. Please try again."
- `api_error`: the CLI's `result` text, verbatim.
- `process_failed`: "Claude Code exited with code <n>: <last 500 chars of stderr>".

**`fake-claude.mjs`** (run as `{ file: process.execPath, prefixArgs: [fakePath] }`):
- With args `auth status`, it prints `process.env.FAKE_CLAUDE_AUTH ?? '{"loggedIn":true,"authMethod":"claude.ai","subscriptionType":"pro"}'`.
- Otherwise it reads all of stdin and switches on `FAKE_CLAUDE_MODE`:
  - `ok`: `structured_output` is `JSON.parse(FAKE_CLAUDE_OUTPUT)`.
  - `result-only`: no `structured_output`; `result` is `FAKE_CLAUDE_OUTPUT`.
  - `echo`: `structured_output` is `{ stdin, args, systemPrompt: <contents of the --system-prompt-file>, systemPromptFile, apiKey, authToken }`, where `apiKey` and `authToken` are the env values or null.
  - `error`: `is_error: true`, `api_error_status: Number(FAKE_CLAUDE_STATUS)`, `result: FAKE_CLAUDE_MESSAGE`.
  - `crash`: stderr `boom`, stdout `not json`, exit code 1.
  - `hang`: never exits.

- [ ] **Step 1: Write failing tests.**
  - **Locate** (fake `LocateFs`):
    - `override wins when it exists`
    - `missing override returns null with source settings`
    - `finds claude.exe on PATH`
    - `cmd shim on PATH sets shimOnly and keeps searching`
    - `falls back to ~/.local/bin`
    - `picks the highest VS Code extension version`. Given `2.1.9` and `2.1.312`, it picks `2.1.312`.
  - **Run:**
    - `buildClaudeArgs` exact array: `['-p','--output-format','json','--json-schema',JSON.stringify(schema),'--system-prompt-file',file,'--safe-mode','--tools','','--no-session-persistence']`. With model `'opus'`, `'--model','opus'` is appended.
    - `returns structured_output`
    - `falls back to parsing result`
    - `passes a 200 KB stdin payload intact`. Use echo mode with Danish text repeated; `stdin` must equal the input.
    - `passes the system prompt via file and deletes the file afterwards`
    - `strips ANTHROPIC_API_KEY and ANTHROPIC_AUTH_TOKEN`
    - `classifies 401 as not_logged_in`
    - `classifies 429 as usage_limit`
    - `classifies other is_error as api_error with the CLI message`
    - `crash → process_failed including stderr`
    - `hang + timeoutMs 300 → timeout`
    - `abort → cancelled`
    - `missing executable → not_found`
    - `getAuthStatus parses auth status JSON`
- [ ] **Step 2: Run.** `npx vitest run tests/main/claude-*`. Expected: FAIL.
- [ ] **Step 3: Implement** `errors.ts`, `locate.ts` and `run.ts` per the above.
- [ ] **Step 4: Run.** `npx vitest run tests/main/claude-*`. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat: locate and run Claude Code CLI headlessly"`

---

### Task 5: IPC bridge and Settings page

**Files:**
- Create: `src/shared/api.ts`, `src/main/context.ts`, `src/main/connection.ts`, `src/main/ipc/wrap.ts` (pure, no Electron import), `src/main/ipc/handle.ts`, `src/main/ipc/settings.ts`, `src/main/ipc/index.ts`, `src/renderer/src/api.ts`, `src/renderer/src/pages/SettingsPage.tsx`
- Modify: `src/main/index.ts` (call `registerIpc()` in `whenReady`), `src/preload/index.ts`, `src/preload/index.d.ts`
- Test: `tests/main/ipc-wrap.test.ts`, `tests/main/connection.test.ts`

**Interfaces (Produces).** The whole `Api` is defined here, and later tasks only add handlers.

```ts
// shared/api.ts
type IpcResult<T> = { ok: true; value: T } | { ok: false; error: { kind: string; message: string } }
type GenerationStage = 'tailoring' | 'writing'
interface SettingsView { settings: Settings; claude: LocateResult; dataDir: string }
interface ConnectionResult { ok: boolean; message: string }
interface Api {
  settings: { get(): Promise<SettingsView>; save(s: Settings): Promise<SettingsView>; testConnection(): Promise<ConnectionResult>;
              pickFile(): Promise<string | null>; pickFolder(): Promise<string | null> }
  profile:  { get(): Promise<Profile>; save(p: Profile): Promise<void> }
  style:    { get(): Promise<Style>; save(s: Style): Promise<void> }
  llm: { generate(i: { jobDescription: string; instructions: string }): Promise<ApplicationMeta>
         reviseCv(i: { id: string; cv: CvContent; instruction: string }): Promise<{ cv: CvContent; warnings: string[] }>
         reviseLetter(i: { id: string; cv: CvContent; letter: ApplicationLetter; instruction: string }): Promise<ApplicationLetter>
         cancel(): Promise<void>; onProgress(cb: (s: GenerationStage) => void): () => void }
  applications: { list(): Promise<ApplicationMeta[]>; get(id: string): Promise<ApplicationRecord>
         saveDraft(id: string, d: Draft): Promise<ApplicationMeta>
         exportPdfs(id: string, html: { cv: string; letter: string }): Promise<ApplicationMeta>
         openFile(id: string, fileName: string): Promise<void>; showFolder(id: string): Promise<void>; trash(id: string): Promise<void> }
}
// Channels are '<group>:<method>' (e.g. 'settings:get'); the progress event is 'llm:progress'.
// main/ipc/wrap.ts
wrap<T>(fn: () => Promise<T>): Promise<IpcResult<T>>  // AppError → its kind/message; anything else → kind 'unknown'
// main/ipc/handle.ts
handle(channel: string, fn: (...args: any[]) => Promise<unknown>): void   // ipcMain.handle + wrap; used by every ipc/<group>.ts
// main/context.ts (Electron glue, not unit-tested)
getSettings(): Promise<Settings>; getDataDir(): Promise<string>; locate(): Promise<LocateResult>
requireClaudeCommand(): Promise<ClaudeCommand>   // not found → ClaudeError('not_found'); when shimOnly the message becomes
  // "Only an npm shim of Claude Code was found. Run `claude install` in a terminal to get the native build, then restart Applicator."
claudeWorkDir(): string                          // join(app.getPath('userData'), 'claude-workdir')
// main/connection.ts
assertSubscriptionAuth(command: ClaudeCommand, env?: NodeJS.ProcessEnv): Promise<AuthStatus>
  // !loggedIn → ClaudeError('not_logged_in'); authMethod !== 'claude.ai' →
  // ClaudeError('not_subscription', "Claude Code is logged in with <method>, not a claude.ai subscription. Applicator only uses your subscription — run /login in Claude Code and choose your claude.ai account.")
testConnection(a: { command: ClaudeCommand; cwd: string; model: string; env?: NodeJS.ProcessEnv }): Promise<ConnectionResult>
  // assertSubscriptionAuth, then runClaude with schema { reply: string } and the input "Reply with OK."
  // success message: "Connected via claude.ai (<subscriptionType>). Claude replied in <s.s> s."; on AppError → { ok: false, message }
```

The preload builds `window.api` by mapping each method to `ipcRenderer.invoke(channel, ...args)`. It unwraps `IpcResult` and throws an `Error` whose `message` is the error message, with a `kind` property attached. `onProgress` subscribes to `'llm:progress'` and returns an unsubscribe function.

- [ ] **Step 1: Write failing tests.**
  - `wrap returns ok value`
  - `wrap keeps AppError kind and message`
  - `wrap maps unknown errors to kind unknown`
  - `testConnection succeeds against fake claude`. Uses `FAKE_CLAUDE_MODE=ok` and `FAKE_CLAUDE_OUTPUT={"reply":"OK"}`; `ok` is true and the message contains `claude.ai (pro)`.
  - `assertSubscriptionAuth rejects non-subscription auth`. With `FAKE_CLAUDE_AUTH={"loggedIn":true,"authMethod":"console"}`, it fails with kind `not_subscription`.
  - `assertSubscriptionAuth rejects logged-out`
- [ ] **Step 2: Run.** `npx vitest run tests/main/ipc-wrap.test.ts tests/main/connection.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `api.ts`, `wrap.ts`, `connection.ts`, `context.ts`, the settings handlers (`pickFile` filters to `*.exe`) and the preload.
- [ ] **Step 4: Settings page.** All changes save immediately via `settings.save`.
  - **"Claude Code CLI" card:**
    - Shows the detected path, with a source badge: "Settings", "PATH", "~/.local/bin" or "VS Code extension".
    - If nothing is found, a red Alert shows the not-found or shim message.
    - A TextInput for the override path, with "Browse…" and "Clear" buttons.
  - **"Model" Select:**
    - Options: "CLI default" (`''`), "Fable", "Opus", "Sonnet", "Haiku".
    - Helper text: "Larger models write better but use more of your plan's usage."
  - **"Data folder" card:**
    - Shows the resolved path, with "Change…" and "Reset to default" buttons.
    - Helper text: "Existing files are not moved."
  - **"Test connection" button:** shows a green or red Alert with the `ConnectionResult` message.
- [ ] **Step 5: Verify.**
  - `npm test` and `npm run typecheck` pass.
  - In `npm run dev`, Settings shows the VS Code `claude.exe` with the badge "VS Code extension".
  - Test connection reports "Connected via claude.ai (pro)…".
- [ ] **Step 6: Commit.** `git commit -m "feat: typed IPC bridge and Settings page with connection test"`

---

### Task 6: My CV page

**Files:**
- Create: `src/renderer/src/lib/text-lines.ts`, `lib/profile-edit.ts`, `lib/profile-sections.ts`, `hooks/useAutosave.ts`, `components/SectionEditor.tsx`, `components/LinesInput.tsx`, `src/main/ipc/profile.ts`
- Modify: `src/renderer/src/pages/ProfilePage.tsx`, `src/main/ipc/index.ts`
- Test: `tests/renderer/profile-edit.test.ts`

**Interfaces:**
- Consumes: `allocateId`, `Profile`, `SectionKey`, `loadProfile`/`saveProfile`.
- Produces:

```ts
// lib/text-lines.ts
textToLines(text: string): string[]          // split on \n, trim, drop empty
linesToText(lines: string[]): string         // join '\n'
// lib/profile-edit.ts (pure)
addItem(profile: Profile, section: SectionKey): { profile: Profile; id: string }   // blank item, appended
updateItem(profile: Profile, section: SectionKey, id: string, patch: Record<string, unknown>): Profile
removeItem(profile: Profile, section: SectionKey, id: string): Profile             // leaves nextIds alone
moveItem<T extends { id: string }>(items: T[], id: string, delta: -1 | 1): T[]     // no-op at bounds; reused by cv-edit
// lib/profile-sections.ts
type FieldKind = 'text' | 'textarea' | 'month' | 'monthOrPresent' | 'lines'
SECTION_FIELDS: Record<SectionKey, { key: string; label: string; kind: FieldKind }[]>
SECTION_TITLES: Record<SectionKey, string>   // Experience, Education, Skills, Languages, Projects, Certifications & courses
// hooks/useAutosave.ts
useAutosave<T>(value: T | null, save: (v: T) => Promise<void>, delayMs = 800):
  { status: 'idle' | 'saving' | 'saved' | 'error'; error: string | null; flush(): Promise<void> }
  // skips the first non-null value (initial load); debounces later changes
```

**Fields per section:**
- Experience: title, employer, location (text); start (month); end (monthOrPresent); bullets (lines, "Bullet points, one per line").
- Education: degree, institution, location; start; end (monthOrPresent); details (lines).
- Skills: name, category.
- Languages: name, level.
- Projects: name, context, url; date (month); bullets (lines).
- Certifications: name, issuer; date (month).

`month` is a Mantine `TextInput type="month"`. `monthOrPresent` adds a "Current" checkbox, which stores `'present'`. `LinesInput` keeps its own text state (so blank lines survive while typing), calls `onChange(textToLines(text))`, and only re-syncs from props when the item `id` changes.

**Page layout:**
- A "Personal details" card with fullName, headline, email, phone and location, plus a links editor (rows of label and url with remove, and an "Add link" button).
- A "Profile summary" textarea, with the description "Your base summary; Claude tailors it per job."
- One `SectionEditor` per section, in `SECTION_KEYS` order. Each item is a card showing its main line, with the ID as a dimmed badge, up/down buttons, and a delete button that confirms first. Each section has an "Add …" button.
- An autosave indicator ("Saving…" / "Saved") in the page header.
- If `profile.get` fails (e.g. `data_file`), show a red Alert with the message and **don't render the editor**, so a broken file is never overwritten.

- [ ] **Step 1: Write failing tests.**
  - `addItem appends blank items with exp_01 then exp_02`
  - `removeItem then addItem yields exp_03`
  - `updateItem patches only the target item`
  - `moveItem swaps neighbours and is a no-op at bounds`
  - `textToLines trims and drops empty lines`. `'a\n\n  b  \n'` gives `['a','b']`.
- [ ] **Step 2: Run.** `npx vitest run tests/renderer/profile-edit.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the helpers, the hook, the components, the page, and the IPC handlers `profile:get`/`profile:save`.
- [ ] **Step 4: Verify.**
  - Tests and typecheck pass.
  - In `npm run dev`, add 2 experiences, a skill and a language, then restart the app. Everything persists, and `Documents\Applicator\profile.json` shows `exp_01`, `exp_02`, `skill_01` and `lang_01`.
  - Corrupt `profile.json` by hand: the page shows the error and the file stays unchanged.
- [ ] **Step 5: Commit.** `git commit -m "feat: My CV editor with stable item ids and autosave"`

---

### Task 7: Writing style page

**Files:**
- Create: `src/shared/text.ts`, `src/main/ipc/style.ts`
- Modify: `src/renderer/src/pages/StylePage.tsx`, `src/main/ipc/index.ts`
- Test: `tests/shared/text.test.ts`

**Interfaces:**
- Produces: `countWords(text: string): number`. It splits on whitespace and counts tokens that contain a letter or digit.

**Page:**
- A "Default instructions" textarea. Placeholder: "e.g. Keep it under one page. Warm but professional. Mention I can start immediately."
- Hint: "Paste 2–3 applications you wrote yourself. Active samples are used to match your tone and length."
- Each sample card has a title input, an "Active" switch, "~N words", an autosize textarea (min 8 rows), and a delete button that confirms first.
- An "Add previous application" button creates a sample with `id: crypto.randomUUID()` and `active: true`.
- The page autosaves via `useAutosave` and uses the same load-error Alert behaviour as Task 6.

- [ ] **Step 1: Failing test.** `expect(countWords('Hej  med\ndig – 2026')).toBe(4)` and `expect(countWords('')).toBe(0)`.
- [ ] **Step 2: Run.** `npx vitest run tests/shared/text.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `countWords`, the `style:get`/`style:save` handlers and the page.
- [ ] **Step 4: Verify.** Tests and typecheck pass. In dev, samples persist across a restart in `style.json`.
- [ ] **Step 5: Commit.** `git commit -m "feat: writing style page with sample applications"`

---

### Task 8: LLM schemas, prompts, sanitizing and pipeline

**Files:**
- Create: `src/main/llm/schemas.ts`, `prompts.ts`, `sanitize.ts`, `run-fn.ts`, `pipeline.ts`
- Test: `tests/main/llm-prompts.test.ts`, `tests/main/llm-sanitize.test.ts`, `tests/main/llm-pipeline.test.ts`

**Interfaces:**
- Consumes: Task 2 schemas, `runClaude`/`ClaudeError`, `countWords`.
- Produces:

```ts
// schemas.ts
TailorOutputSchema = z.object({ job: JobInfoSchema, cv: CvContentSchema })
toCliSchema(schema: z.ZodType): object      // z.toJSONSchema(schema) without the top-level "$schema" key
// run-fn.ts
type RunFn = <T>(req: { system: string; input: string; schema: z.ZodType<T> }) => Promise<T>
makeRunFn(base: Omit<ClaudeRunRequest, 'systemPrompt' | 'input' | 'jsonSchema'>): RunFn   // schema.safeParse failure → ClaudeError('invalid_output')
// prompts.ts
TAILOR_SYSTEM, LETTER_SYSTEM, CV_REVISE_SYSTEM, LETTER_REVISE_SYSTEM: string
targetWordCount(style: Style): number   // mean countWords of active samples rounded to nearest 10; 350 if none active
buildTailorInput(a: { profile: Profile; jobDescription: string; instructions: string }): string
buildLetterInput(a: { profile: Profile; style: Style; jobDescription: string; instructions: string; job: JobInfo; cv: CvContent }): string
buildCvReviseInput(a: { profile: Profile; jobDescription: string; job: JobInfo; cv: CvContent; instruction: string }): string
buildLetterReviseInput(a: { profile: Profile; style: Style; jobDescription: string; job: JobInfo; cv: CvContent; letter: ApplicationLetter; instruction: string }): string
// sanitize.ts
sanitizeCv(profile: Profile, cv: CvContent): { cv: CvContent; warnings: string[] }   // per section: keep ids present in that profile section, first occurrence only
normalizeLanguage(code: string): { language: string; warning?: string }             // /^[a-z]{2,3}(-[a-z0-9]+)*$/i → base subtag lowercased; else 'en' + warning
// pipeline.ts
generateApplication(a: { run: RunFn; profile: Profile; style: Style; jobDescription: string; instructions: string;
  onStage: (s: GenerationStage) => void }): Promise<{ job: JobInfo; cv: CvContent; letter: ApplicationLetter; warnings: string[] }>
reviseCv(a: { run: RunFn; profile: Profile; jobDescription: string; job: JobInfo; cv: CvContent; instruction: string }): Promise<{ cv: CvContent; warnings: string[] }>
reviseLetter(a: { run: RunFn; profile: Profile; style: Style; jobDescription: string; job: JobInfo; cv: CvContent; letter: ApplicationLetter; instruction: string }): Promise<ApplicationLetter>
```

**Input format.** Every builder emits Markdown sections in this order, using `(none)` for empty text:
- **Tailor input:** `## Job posting`, `## Candidate profile (JSON)` (the profile without `version` and `nextIds`), `## Extra instructions`.
- **Letter input:** `## Job posting`, `## Job analysis (JSON)`, `## Candidate profile (JSON)`, `## Tailored CV (JSON)`, `## Writing samples` (one `### Sample: <title>` per **active** sample), `## Target length` with `About <N> words.`, `## Default instructions`, `## Instructions for this application`.
- **Revise inputs:** the matching generation input, plus `## Current CV (JSON)` or `## Current letter (JSON)`, plus `## Requested change`.

**System prompt rules.** The implementer writes the prose, but these points must all be stated.
- **TAILOR_SYSTEM:**
  - Tailor the candidate's CV to the posting, using only the profile.
  - Reference items by their exact `id`, and never output an id not in the profile.
  - Include only items relevant to the posting, ordered most relevant first within each section.
  - Light rewording only: rephrase, shorten, translate or drop bullets, and echo the posting's terminology. Never add skills, tools, employers, numbers, achievements or responsibilities that aren't in the profile.
  - Write all text, including `labels` and the word for "present", in the posting's language. Set `job.language` to its ISO 639-1 code.
  - `headline` is one line. `summary` is 2–4 sentences.
  - `job.company` and `job.role` come from the posting, or are `""` if absent.
  - Follow the extra instructions unless they conflict with these rules.
- **LETTER_SYSTEM:**
  - Write the application letter in `job.language`.
  - Mirror the samples' tone, formality, structure, paragraph count and greeting/sign-off conventions. Aim for the target length. Never copy sentences from the samples.
  - Use only facts from the profile and the tailored CV, and connect them to the posting's key requirements.
  - `paragraphs` is the body only. `signOff` is the closing phrase without the name (the template adds the name).
  - Follow the default and per-application instructions.
- **CV_REVISE_SYSTEM / LETTER_REVISE_SYSTEM:** the same rules as above, plus "Apply the requested change; keep everything else as it is."

**Pipeline:**
- `generateApplication` calls `onStage('tailoring')`, runs the tailor step, sanitizes the CV and normalizes `job.language`. It then calls `onStage('writing')` and runs the letter step with the sanitized CV and normalized job. All warnings are concatenated.
- `reviseCv` sanitizes its result the same way.

- [ ] **Step 1: Write failing tests.**
  - **Prompts:**
    - `buildTailorInput contains every profile item id and the job text, and omits nextIds`
    - `buildLetterInput includes only active samples and the target length`. Contains `s1`'s text and `About 120 words.`; does not contain `INACTIVE-MARKER`.
    - `targetWordCount averages active samples and defaults to 350`
    - `buildLetterReviseInput includes the current letter and the requested change`
    - `toCliSchema has no $schema and describes job and cv`
  - **Sanitize:**
    - `drops unknown, duplicate and wrong-section ids with warnings`. Experience `[exp_01, exp_01, exp_99, skill_01]` becomes `[exp_01]`, and there are 3 warnings mentioning `exp_01`, `exp_99` and `skill_01`.
    - `normalizes language`: `'DA'` → `'da'`, `'da-DK'` → `'da'`, `'Danish'` → `'en'` with a warning, `''` → `'en'` with a warning.
  - **Pipeline** (fake `RunFn` that records each request and returns fixtures keyed by `req.system`):
    - `generateApplication runs tailor then letter and reports stages in order`
    - `letter input contains the sanitized tailored CV`
    - `generateApplication returns sanitized cv and normalized language`
    - `reviseCv sanitizes the revised cv`
    - `makeRunFn throws invalid_output when the CLI output fails the schema`. Uses fake-claude `ok` mode with `{"nope":1}`.
- [ ] **Step 2: Run.** `npx vitest run tests/main/llm-*`. Expected: FAIL.
- [ ] **Step 3: Implement** the five modules per the interfaces and rules.
- [ ] **Step 4: Run.** `npx vitest run tests/main/llm-*`. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat: LLM prompts, schemas, guardrails and generation pipeline"`

---

### Task 9: CV and letter HTML templates

**Files:**
- Create: `src/shared/templates/escape.ts`, `format.ts`, `base-css.ts`, `cv.ts`, `letter.ts`, `src/renderer/src/lib/fonts.ts`
- Test: `tests/shared/templates.test.ts`

**Interfaces (Produces):**

```ts
escapeHtml(s: string): string
formatYearMonth(ym: string, language: string): string   // Intl { month: 'short', year: 'numeric' }; '' → ''
formatRange(start: string, end: string, language: string, presentLabel: string): string   // `${start} – ${end}`; 'present' → presentLabel; omits missing side
formatLetterDate(date: Date, language: string): string   // Intl { dateStyle: 'long' }
renderCvHtml(profile: Profile, cv: CvContent, opts: { language: string; fontCss?: string }): string
renderLetterHtml(profile: Profile, letter: ApplicationLetter, opts: { language: string; company: string; date: Date; fontCss?: string }): string
// renderer lib/fonts.ts
FONT_CSS: string   // @font-face for 'Source Sans 3' 400 normal, 400 italic, 600 normal, from
                   // '@fontsource/source-sans-3/files/source-sans-3-latin-<w>-<style>.woff2?inline'
```

**Template rules:**
- **Document:** a full HTML document (`<!doctype html><html lang="<language>">`). All text goes through `escapeHtml`. `fontCss`, then `BASE_CSS`, go in `<style>`.
- **BASE_CSS:**
  - `@page { size: A4; margin: 16mm 18mm }`.
  - Body: `'Source Sans 3', sans-serif`, 10.5pt, line-height 1.35, `#1f2328`. h1 is 22pt.
  - Section headings: 11pt uppercase, letter-spacing .06em, colour `#2b5797`, a 1px `#c9ced6` bottom border, and `break-after: avoid`.
  - Entries: `break-inside: avoid`.
  - `@media screen`: body is 210mm wide, min-height 297mm, padding 16mm 18mm, white, centered.
- **CV:**
  - Header: h1 with `fullName`, then `cv.headline`, then a contact line joined with ` · ` (location, email, phone, link labels as `<a>`).
  - `labels.profile` with the summary (omitted if empty).
  - Then each section in `SECTION_KEYS` order, **only if** `cv[section]` is non-empty. Each entry is resolved by id from the profile, and ids missing from the profile are skipped.
    - Experience: "**title**, employer · location", with `formatRange` right-aligned and the bullets below.
    - Education: "**degree**, institution · location", the range, and details.
    - Skills: grouped by `category` in order of first appearance, as "**Category:** a, b". There's no prefix when the category is empty.
    - Languages: "name (level)" joined with ` · `.
    - Projects: "**name** — context", the date, the url and the bullets.
    - Certifications: "name — issuer, date".
- **Letter:**
  - A sender block (name in bold, location, email, phone), then `formatLetterDate`, then `company`.
  - `subject` in bold, `greeting`, each paragraph as `<p>`, `signOff`, and finally `fullName`.

- [ ] **Step 1: Write failing tests** (use `sampleProfile()`).
  - `CV takes employer and dates from the profile and text from the cv`. With cv experience `[{ id: 'exp_01', title: 'Dataingeniør', bullets: ['Byggede pipelines'] }]`, `labels.present: 'nu'` and `language: 'da'`, the HTML contains `Ørsted A/S`, `Dataingeniør`, `Byggede pipelines`, `nu` and `2021`.
  - `CV only shows selected items`. `Contoso ApS` is absent.
  - `CV escapes HTML`. A bullet of `<script>alert(1)</script>` shows up as `&lt;script&gt;`.
  - `CV omits empty sections`. With `projects: []`, the `labels.projects` text is absent.
  - `CV sets html lang and injects fontCss`
  - `formatRange('2021-03', 'present', 'en', 'Present')` is `'Mar 2021 – Present'`.
  - `letter renders localized date, paragraphs and signature`. With `language: 'da'` and `new Date(2026, 9, 29)`, it contains `29. oktober 2026`, each paragraph inside `<p>`, and `Jane Doe` after the signOff.
- [ ] **Step 2: Run.** `npx vitest run tests/shared/templates.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the templates and `fonts.ts` (check the fontsource file names in `node_modules`).
- [ ] **Step 4: Run.** `npx vitest run tests/shared/templates.test.ts`. Expected: PASS. `npm run typecheck` passes.
- [ ] **Step 5: Commit.** `git commit -m "feat: A4 HTML templates for CV and application letter"`

---

### Task 10: Generation flow and New application page

**Files:**
- Create: `src/shared/profile-checks.ts`, `src/main/generation.ts`, `src/main/ipc/llm.ts`
- Modify: `src/renderer/src/pages/NewApplicationPage.tsx`, `src/main/ipc/index.ts`, `src/main/context.ts` (add `makeAppRunFn`)
- Test: `tests/main/generation.test.ts`

**Interfaces:**
- Consumes: the Task 8 pipeline, Task 3 storage, `assertSubscriptionAuth`, `makeRunFn`.
- Produces:

```ts
isProfileUsable(profile: Profile): boolean   // fullName non-empty AND ≥1 item in experience, education or skills
runGeneration(a: { run: RunFn; dataDir: string; jobDescription: string; instructions: string;
  onStage: (s: GenerationStage) => void; now: Date }): Promise<ApplicationMeta>
runCvRevision(a: { run: RunFn; dataDir: string; id: string; cv: CvContent; instruction: string }): Promise<{ cv: CvContent; warnings: string[] }>
runLetterRevision(a: { run: RunFn; dataDir: string; id: string; cv: CvContent; letter: ApplicationLetter; instruction: string }): Promise<ApplicationLetter>
makeAppRunFn(signal: AbortSignal): Promise<RunFn>   // context.ts: settings model, requireClaudeCommand, claudeWorkDir
```

**`runGeneration`:**
- It loads the profile and style first, then checks two things:
  - If `!isProfileUsable`, it throws `AppError('profile_empty', 'Add your name and at least one experience, education or skill on the My CV page first.')`.
  - If `jobDescription.trim().length < 50`, it throws `AppError('job_too_short', 'The job description looks too short — paste the full posting.')`.
- Next it calls `generateApplication`.
- **Only after that succeeds** does it call `createApplication`, with `draft = { version: 1, instructions, job, cv, letter, untranslatedIds: [], warnings }`.
- **Revisions** load the record and use **`record.profile` (the snapshot)**, `record.jobDescription` and `record.draft.job`. `runLetterRevision` also uses `loadStyle(dataDir)`. Revisions don't save anything; the renderer applies the result and autosaves.

**`ipc/llm.ts`:**
- Only one LLM operation runs at a time. A second call throws `AppError('busy', 'Claude is already working on something. Wait or cancel it first.')`.
- Each operation creates an `AbortController`, and `llm:cancel` aborts it.
- The first operation in an app session awaits `assertSubscriptionAuth`, and the result is cached after success.
- Stages are sent to the calling window as `'llm:progress'`.

- [ ] **Step 1: Write failing tests** (temp dataDir; fake `RunFn` returning fixtures).
  - `creates an application folder with the generated draft`. The id is `2026-10-29_Acme_Data-Engineer`, and `loadApplication(...).draft.letter` equals the fixture.
  - `leaves no application folder when the letter call fails`. The 2nd run throws `ClaudeError('usage_limit', …)`, the call rejects with kind `usage_limit`, and `<dataDir>/applications` is missing or empty.
  - `refuses to generate with an empty profile`. Kind `profile_empty`, and run is never called.
  - `refuses a too-short job description`
  - `runCvRevision uses the profile snapshot, not the current profile`. After creation, save a profile whose `exp_01.employer` is `Changed Corp`. The captured revise input contains `Ørsted A/S`, not `Changed Corp`.
- [ ] **Step 2: Run.** `npx vitest run tests/main/generation.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `profile-checks.ts`, `generation.ts`, `makeAppRunFn` and the `llm:*` handlers.
- [ ] **Step 4: New application page.**
  - **Inputs:**
    - "Job description" Textarea (autosize, minRows 14, placeholder "Paste the full job posting here…").
    - "Extra instructions for this application (optional)" Textarea.
    - Both are mirrored into `sessionStorage` (`new.jobDescription`, `new.instructions`), so navigating away keeps them.
  - **Profile check:** if `isProfileUsable(await api.profile.get())` is false, show a yellow Alert linking to My CV and disable Generate.
  - **While generating:**
    - Show a progress card with "Analyzing the job and tailoring your CV…" (tailoring) or "Writing your application…" (writing).
    - Show elapsed seconds and a Cancel button that calls `llm.cancel`.
  - **When generation finishes:**
    - On success: clear the `sessionStorage` keys and navigate to `/review/<meta.id>`.
    - On error: show a red Alert with the message. `cancelled` gets a neutral notification instead.
- [ ] **Step 5: Verify.** Tests and typecheck pass. In dev, with a filled profile, paste a real English job ad and Generate: both stages show, and the app lands on `/review/<id>` (the page can still be a placeholder). The folder exists in `Documents\Applicator\applications`. Then start another generation and press Cancel during "Writing…": no new folder appears.
- [ ] **Step 6: Commit.** `git commit -m "feat: generate tailored CV and letter from a job description"`

---

### Task 11: Review page, live preview and PDF export

**Files:**
- Create: `src/main/pdf/print.ts`, `src/main/pdf/export.ts`, `src/main/ipc/applications.ts`, `src/renderer/src/lib/cv-edit.ts`, `components/PreviewFrame.tsx`, `components/CvEditor.tsx`, `components/LetterEditor.tsx`, `components/RevisePanel.tsx`
- Modify: `src/renderer/src/pages/ReviewPage.tsx`, `src/main/ipc/index.ts`
- Test: `tests/renderer/cv-edit.test.ts`, `tests/main/export.test.ts`

**Interfaces:**
- Consumes: the templates, `FONT_CSS`, `moveItem`, `textToLines`, `useAutosave`, Task 3 storage, `cvPdfName`/`letterPdfName`.
- Produces:

```ts
// pdf/print.ts (Electron)
htmlToPdf(html: string): Promise<Buffer>
  // hidden BrowserWindow { show: false, webPreferences: { javascript: false, sandbox: true } }; write html to a temp .html,
  // loadFile, printToPDF({ pageSize: 'A4', printBackground: true, preferCSSPageSize: true }); always destroy window + delete temp file
// pdf/export.ts
exportApplicationPdfs(a: { dataDir: string; id: string; html: { cv: string; letter: string };
  toPdf: (html: string) => Promise<Buffer>; now: Date }): Promise<ApplicationMeta>
  // names: cvPdfName(record.profile.personal.fullName, meta.company), letterPdfName(meta.company, meta.role); overwrite; setExported
// lib/cv-edit.ts (pure)
entryFromProfile(profile: Profile, section: SectionKey, id: string): CvContent[SectionKey][number]   // original text, CvContent shape
toggleCvItem(cv: CvContent, profile: Profile, section: SectionKey, id: string): { cv: CvContent; added: boolean }   // add appends
moveCvItem(cv: CvContent, section: SectionKey, id: string, delta: -1 | 1): CvContent                                // uses moveItem
textToParagraphs(text: string): string[]     // split on /\n\s*\n/, trim, drop empty
paragraphsToText(paragraphs: string[]): string   // join '\n\n'
```

**IPC handlers:**
- `applications:get`, `applications:saveDraft`, `applications:exportPdfs` (with `toPdf: htmlToPdf` and `now: new Date()`).
- `applications:openFile`: `fileName` must equal `path.basename(fileName)`, otherwise `AppError('bad_id')`. Then `shell.openPath`.
- `applications:showFolder`: `shell.openPath(applicationDir(...))`.

**Review page (`/review/:id`):**
- **Header:**
  - Shows "company — role", a language badge and an **Export PDFs** button.
  - "Show folder", "Open CV" and "Open application" buttons (the two Open buttons appear once `meta.cvPdf` is set).
  - `draft.warnings` appear in a dismissible yellow Alert.
- **Tabs and layout:** "Application" | "CV". Each tab has the editor on the left (scrolls) and a `PreviewFrame` on the right.
  - `PreviewFrame` is an `<iframe sandbox="" srcDoc>` at 210mm × 297mm, scaled to the column width.
  - The preview HTML is `renderLetterHtml(record.profile, letter, { language: draft.job.language, company: meta.company, date: new Date(), fontCss: FONT_CSS })` or `renderCvHtml(record.profile, cv, { language, fontCss: FONT_CSS })`.
- **LetterEditor:** Subject and Greeting inputs, a Body Textarea (local text state, using `textToParagraphs`/`paragraphsToText`), and a Sign-off input.
- **CvEditor:**
  - Headline and Summary inputs.
  - For each section in `SECTION_KEYS` order: the selected items in cv order, then the unselected profile items in profile order. Each has a Checkbox (`toggleCvItem`) labelled from the profile (e.g. "Data Engineer @ Ørsted A/S").
  - Selected items show editable CV fields (`LinesInput` for bullets/details) and up/down buttons.
  - A newly ticked item's id is pushed onto `draft.untranslatedIds`, and it shows a badge "original text" with the tooltip "Added by you: not tailored or translated. Use Revise to adapt it."
- **RevisePanel** (one per tab):
  - A TextInput ("Tell Claude what to change…") with **Revise** and **Undo** buttons. Undo restores the version from before the last revise.
  - While running, it shows a Loader and a Cancel button.
  - A CV revise sets `untranslatedIds: []` and appends any warnings.
- **Saving and export:**
  - The draft autosaves through `useAutosave(draft, d => api.applications.saveDraft(id, d))`.
  - **Export PDFs** first calls `flush()`, then sends both preview HTML strings to `exportPdfs`, updates `meta`, and shows a notification "PDFs saved" with Open buttons.

- [ ] **Step 1: Write failing tests.**
  - **cv-edit:**
    - `toggleCvItem adds the profile entry with original text at the end, and removes it on second toggle`
    - `entryFromProfile maps each section to the CvContent shape`. Experience gives `{id,title,bullets}`, skills `{id,name,category}`, languages `{id,name,level}`, certifications `{id,name}`, education `{id,degree,details}`, projects `{id,name,context,bullets}`.
    - `moveCvItem swaps and is a no-op at bounds`
    - `textToParagraphs('First para.\n\n\n  Second para.  \n')` is `['First para.', 'Second para.']`, and `paragraphsToText(['a','b'])` is `'a\n\nb'`.
  - **export** (`toPdf = async html => Buffer.from(html)`):
    - `writes both PDFs with the expected names and marks exported`. The files are `CV - Jane Doe - Acme.pdf` and `Application - Acme - Data Engineer.pdf` with the given HTML, and `meta.exportedAt === now.toISOString()`.
    - `re-export overwrites the same files`. The file count is unchanged and the content is updated.
- [ ] **Step 2: Run.** `npx vitest run tests/renderer/cv-edit.test.ts tests/main/export.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the helpers, the export orchestration, `htmlToPdf`, the handlers, the components and the page.
- [ ] **Step 4: Verify.**
  - Tests and typecheck pass.
  - In dev, open the application from Task 10. Edit the letter, and the preview updates.
  - Revise with "Make it shorter": the letter gets shorter, and Undo restores it.
  - Untick an experience and tick another, then Export.
  - Both PDFs open as A4, æøå render in Source Sans 3, entries aren't split across pages, and the folder holds both PDFs next to `draft.json`.
- [ ] **Step 5: Commit.** `git commit -m "feat: review, revise and export application PDFs"`

---

### Task 12: History browser

**Files:**
- Create: `src/renderer/src/lib/history-filter.ts`
- Modify: `src/renderer/src/pages/HistoryPage.tsx`, `src/renderer/src/pages/HistoryDetailPage.tsx`, `src/main/ipc/applications.ts` (`list`, `trash`)
- Test: `tests/renderer/history-filter.test.ts`

**Interfaces:**
- Produces: `filterApplications(list: ApplicationMeta[], query: string): ApplicationMeta[]`. It splits the query on whitespace; every lower-cased token must appear in `` `${company} ${role} ${id}` `` (lower-cased). An empty query returns the whole list.
- `applications:trash`: `shell.trashItem(applicationDir(dataDir, id))`.

**History page:**
- A search TextInput.
- A table with columns: Date (local date of `createdAt`), Company, Role, Language (uppercase badge), and Status ("Exported" in green if `exportedAt` is set, otherwise "Draft" in gray).
- Clicking a row opens `/history/:id`.
- Empty state: "No applications yet. Start with New application." (with a link).

**Detail page:**
- **Header:** "company — role" and the created date.
- **Buttons:**
  - "Open in editor" (goes to `/review/:id`) and "Show folder".
  - "Open CV PDF" and "Open application PDF", shown only when exported.
  - "Delete": a confirm modal asks "Move this application to the Recycle Bin?", then calls `trash` and navigates to `/history`.
- **Tabs:**
  - "Job description": the text with `white-space: pre-wrap`.
  - "Application" and "CV": a `PreviewFrame` with the same render calls as Task 11.

- [ ] **Step 1: Failing tests.**
  - `empty query returns all`
  - `matches case-insensitively across company and role`. `'ørsted data'` matches company `Ørsted A/S` with role `Data Engineer`.
  - `all tokens must match`. `'ørsted novo'` matches nothing.
- [ ] **Step 2: Run.** `npx vitest run tests/renderer/history-filter.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the filter, the handlers and both pages.
- [ ] **Step 4: Verify.**
  - Tests and typecheck pass.
  - In dev, History lists the applications newest first, and search narrows the list.
  - In the detail view, all three tabs render, and Open PDF works.
  - Delete moves the folder to the Recycle Bin.
- [ ] **Step 5: Commit.** `git commit -m "feat: history browser for saved applications"`

---

### Task 13: Packaging, README and end-to-end pass

**Files:**
- Modify: `electron-builder.yml`, `package.json` (name `applicator`, productName `Applicator`), `README.md`

**electron-builder:**
- `appId: com.applicator.app`, `productName: Applicator`.
- `win.target: nsis` (x64), with `nsis: { oneClick: false, perMachine: false, allowToChangeInstallationDirectory: true }`.
- Keep the template's `build/icon.ico`.

**README sections:**
1. What Applicator does.
2. Requirements: Windows 11; Claude Code **native** CLI installed and logged in with a claude.ai subscription.
   - Install with `irm https://claude.ai/install.ps1 | iex` (or `claude install` if you have the npm version), then run `claude` and `/login`.
   - Settings shows which `claude.exe` is used.
3. Using the app: fill in My CV → Writing style → New application → Review → Export.
4. Where data lives: `Documents\Applicator`, with the folder layout.
5. How the LLM is called: the CLI in print mode, no API key, `--safe-mode`. Link `docs/claude-cli-notes.md`.
6. Development: `npm install`, `npm run dev`, `npm test`, `npm run typecheck`.
7. Build: `npm run build:win` → `dist\applicator-<version>-setup.exe`. The installer is unsigned, so SmartScreen will warn: choose "More info → Run anyway".

- [ ] **Step 1: Packaging.** Update the config and README as above.
- [ ] **Step 2: Checks.** Run `npm test` and `npm run typecheck`. Expected: all pass.
- [ ] **Step 3: Build.** Run `npm run build:win`. Expected: the setup .exe is in `dist\`. Install it and launch it from the Start menu.
- [ ] **Step 4: End-to-end pass in the installed app** (spec → Verification):
  1. Test connection succeeds.
  2. Fill in a realistic profile and 2 writing samples.
  3. **English** job ad: the selected IDs exist, the bullets add no new facts, and tone and length resemble the samples.
  4. Revise with "make it shorter" and confirm it gets shorter.
  5. Export: A4, æøå correct, no awkward breaks.
  6. History: the list, detail, reopen, edit and re-export all work.
  7. **Danish** job ad: all text and headings are in Danish, while dates and employer names are unchanged.
  8. A bad Claude path in Settings gives a clear message, and Cancel stops a running generation.

  Note any defect, fix it in its own commit, and re-run the affected step.
- [ ] **Step 5: Commit.** `git commit -m "chore: Windows installer config and README"`
