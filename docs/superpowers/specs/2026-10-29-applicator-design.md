# Applicator: local job-application generator (implementation plan)

## Context

Job hunting means rewriting the same CV and cover letter over and over for each posting. Applicator is a Windows 11 desktop app for one user. You paste a job description, and the app uses Claude to:

1. pick and lightly reword the most relevant parts of your stored CV data,
2. write an application that matches your own writing style,
3. let you review, edit and revise both,
4. export both as PDFs and save everything locally so you can browse it later.

The app gets all LLM output by calling the **Claude Code CLI in non-interactive mode** (`claude -p`) on your subscription. It never uses the Anthropic API.

The repo is empty (README and LICENSE only). On this machine: Node 24, Python 3.14 and Edge are installed. `claude` is **not on PATH**. The only copy is the VS Code extension's bundled binary (`%USERPROFILE%\.vscode\extensions\anthropic.claude-code-2.1.312-win32-x64\resources\native-binary\claude.exe`). Its `--help` confirms that `-p`, `--output-format json`, `--json-schema`, `--system-prompt`, `--tools`, `--model`, `--safe-mode` and `--no-session-persistence` are available.

### Decisions you made
- **Stack:** Electron + React + TypeScript.
- **CV tailoring:** the LLM selects items by ID and may lightly reword them (summary and bullets) to echo the posting. It never invents facts.
- **Language:** output matches the posting's language. Profile data is stored once and translated as needed.
- **Review step:** an editable preview, plus instruction-based revisions ("make it shorter"), then PDF export.
- **Scope:** core only. No CV import, no status tracking, no multiple templates, no DOCX, no photo.

---

## Architecture

**Tooling:** `electron-vite` (React-TS template), Mantine UI (it's form-heavy), React Router (HashRouter), zod v4 for all data shapes (`z.toJSONSchema()` produces the `--json-schema` input, so there's one source of truth), Vitest, and electron-builder (NSIS per-user installer).

**Processes:**
- **main:** storage, Claude CLI runner, LLM pipeline, PDF export, and IPC handlers.
- **preload:** a typed `window.api` exposed through `contextBridge` (contextIsolation on, nodeIntegration off).
- **renderer:** the React pages.
- **shared:** zod types, ID allocation and the HTML templates, used by both the preview and the PDF export.

```
src/
  main/      index.ts, ipc.ts
             claude/locate.ts, claude/run.ts
             llm/prompts.ts, llm/schemas.ts, llm/pipeline.ts
             storage/{paths,atomic,settings,profile,style,applications}.ts
             pdf/export.ts
  preload/   index.ts
  shared/    types.ts, ids.ts, filenames.ts
             templates/{cv.ts, letter.ts, base.css, fonts/}
  renderer/  App.tsx, pages/{Profile,Style,NewApplication,Review,History,HistoryDetail,Settings}Page.tsx
tests/       vitest specs + fixtures + fake-claude.js
```

### 1. Claude CLI runner (`main/claude/`)
- **Locate** the binary, checking in this order: the Settings override, then `where claude` (prefer `.exe`), then `%USERPROFILE%\.local\bin\claude.exe`, then the newest `…\.vscode\extensions\anthropic.claude-code-*\resources\native-binary\claude.exe`. Settings shows the path it found. The README recommends installing the standalone CLI so the path stays stable.
- **Invoke** with `spawn(exe, args, { cwd: <userData>/claude-workdir (empty), windowsHide: true, shell: false })`, using these args:
  `-p --output-format json --json-schema <schema> --system-prompt-file <tmp> --safe-mode --tools "" --no-session-persistence [--model <setting>]`
  - All dynamic content (profile, samples, job description) goes in through **stdin** as UTF-8. This avoids the 32K Windows command-line limit and quoting problems.
  - `--safe-mode` together with the empty cwd keeps your plugins, hooks, CLAUDE.md and MCP servers out of the generation calls. This matters because you have SessionStart hooks installed.
  - **Remove `ANTHROPIC_API_KEY` from the child's environment** so the call always uses the subscription login. Never use `--bare`, because it skips OAuth.
  - Only a native `claude.exe` is supported. *(Changed after the spike: `--json-schema` passes JSON containing quotes, which cmd.exe cannot quote safely. If PATH has only an npm `.cmd`/`.ps1` shim, Settings tells the user to run `claude install` to get the native build.)*
  - **Spike results (2026-10-29, CLI 2.1.312):** see `docs/claude-cli-notes.md`.
- **Parse** the stdout JSON result. The structured payload is expected in `structured_output`, with a fallback that parses `result`. It is validated with zod.
- **Map errors** to friendly messages for: binary not found, not logged in, usage limit hit, non-zero exit, invalid output, and timeout (5 min default). A cancel button kills the child process.
- **Settings → "Test connection"** runs a tiny schema-constrained prompt and shows the result.

### 2. Data and storage (`main/storage/`)
- Data lives as JSON files under `Documents\Applicator\` (via `app.getPath('documents')`, so OneDrive redirection works), with the root configurable in Settings. Settings themselves live in Electron's `userData`. All writes are atomic (write to a temp file, then rename). I chose JSON over SQLite so you can read the data directly and there are no native modules to rebuild for Electron.

```
Documents\Applicator\
  profile.json                 CV master data
  style.json                   writing samples + default instructions
  applications\
    2026-10-29_Acme_Data-Engineer\
      meta.json                id, company, role, language, created/updated, exported flag
      job-description.txt
      draft.json               tailored CV (resolved) + application text + per-job instructions
      profile-snapshot.json    profile as it was at generation time
      CV - <Name> - <Company>.pdf
      Application - <Company> - <Role>.pdf
```

- **Profile sections:** personal info (name, headline, email, phone, location, links), base summary, experience, education, skills (name and category), languages (and level), projects, and certifications/courses.
- **Item IDs:** `exp_01`, `edu_01`, `skill_01`, `lang_01`, `proj_01`, `cert_01`. They are allocated from per-prefix counters stored in `profile.json` and never reused, so references in old applications stay valid.
- **Filenames:** sanitized for Windows (`<>:"/\|?*`, trailing dots, length cap) and suffixed on collisions.

### 3. LLM pipeline (`main/llm/`)
There are two sequential calls per generation, plus revisions.

1. **Analyze and tailor the CV.** Input: the job description and the full profile with IDs. Output:
   - job metadata: company, role, language as an ISO code, key requirements;
   - a tailored headline and summary;
   - the selected items in order, with reworded bullets and text fields in the target language;
   - the skills to show;
   - section heading labels in the target language.
2. **Write the application.** Input: the job description, the job analysis from call 1, the tailored CV, your active writing samples, your default instructions and the per-job instructions. Output: `{ subject, greeting, paragraphs[], signOff }`. The prompt states a target word count computed from the samples' average length. It mirrors their tone, structure and greeting/sign-off conventions without copying sentences.
3. **Revise** (on either the CV or the application). Input: the current edited draft, your instruction and the same context. Output uses the same schema as the original call.

**Truthfulness guardrails:**
- The system prompt forbids facts that aren't in the profile.
- Unknown IDs in the output are dropped, with a warning.
- Dates, employer and institution names and contact details are always taken from the profile by ID, never from LLM text.

### 4. Templates, preview and PDF (`shared/templates/`, `main/pdf/`)
- Templates are plain TypeScript functions that return a self-contained HTML string. They escape all text and embed an OFL font as base64 that covers æøå. **The same HTML** feeds the live preview (`<iframe sandbox srcdoc>`) and the export.
- **CV layout:** single column, A4, no photo. Name, headline and contact line, then summary → experience → education → skills → languages → projects → certifications. Empty sections are skipped.
- **Letter layout:** sender block, localized date (`Intl.DateTimeFormat(lang)`), company, subject, body, sign-off with your name.
- **Export:** a hidden `BrowserWindow` loads the HTML, then `webContents.printToPDF({ pageSize: 'A4', printBackground: true })` writes both PDFs to the application folder. Buttons let you open the PDF or show the folder.

### 5. Pages (`renderer/pages/`)
- **My CV:** an editor for each section (add, edit, delete with confirm, reorder) with auto-save. Item IDs are shown discreetly.
- **Writing style:** previous applications (title plus pasted text, each with an active toggle) and a default instruction prompt.
- **New application:** paste the job description, add optional extra instructions, then Generate. Progress shows "Analyzing job & tailoring CV…" and then "Writing application…", with a cancel button.
- **Review:**
  - Two tabs, each an editor next to a live preview, with a revise-instruction box, one-level undo and **Export PDFs**.
  - The CV tab lists all profile items with checkboxes (the LLM's selection is pre-checked), editable tailored text and up/down ordering. Items you add by hand that haven't been translated get a flag.
  - The application tab has fields for the subject and sign-off and a body textarea.
- **History:** a searchable list of company, role, date, language and an "exported" badge. The detail view has tabs for the job description, application and CV. From there you can reopen it in Review (edits and re-exports overwrite that application's files), open the PDFs or folder, or delete it (moved to the Recycle Bin via `shell.trashItem`).
- **Settings:** the Claude binary path (auto-detected, can be overridden), the model (CLI default / opus / sonnet / fable), the data folder, and Test connection.

---

## Build order

0. **CLI spike: DONE 2026-10-29. All checks passed; see `docs/claude-cli-notes.md`.** From Node, run the exact invocation above against the bundled `claude.exe` and confirm:
   - the JSON result shape (`structured_output`);
   - that `--json-schema` works together with `--tools ""` (if not, drop `--tools ""` and use `--disallowedTools` for all built-ins instead);
   - that `--safe-mode` suppresses your hooks and plugins;
   - that the call uses the subscription login;
   - that UTF-8 Danish text survives the round trip;
   - typical latency.

   Record the findings in `docs/claude-cli-notes.md`.
1. Scaffold electron-vite + Mantine + router, the settings store, the CLI locator and runner, and the Test connection button.
2. Shared zod types, ID allocation, atomic storage, and the My CV page.
3. The Writing style page.
4. LLM prompts, schemas and pipeline (tailor, write, revise) plus guardrail validation.
5. Templates, preview iframe and PDF export.
6. The New application → Review → Export flow, persisting to the application folder.
7. The History list and detail pages.
8. electron-builder Windows installer, plus a README with setup steps (install and log in to the Claude CLI, run, build).

After approval, each phase gets broken into small test-first tasks before coding.

## Verification

- **Unit tests (`npm test`, Vitest):**
  - ID allocation never reuses IDs;
  - storage round-trips in a temp directory, with atomic writes;
  - filename sanitization;
  - prompt builders include the IDs, samples and target word count;
  - response validation drops unknown IDs, and the merge takes dates and names from the profile;
  - the CLI runner, tested against `tests/fake-claude.js` (fixture JSON, non-zero exit, malformed output, timeout/cancel, `ANTHROPIC_API_KEY` stripped);
  - templates escape HTML.
- **Manual end-to-end (`npm run dev`) with the real CLI:**
  1. Test connection succeeds.
  2. Fill in a sample profile and add 2 previous applications.
  3. Paste an **English** job ad and generate. Check that the selected IDs exist, the reworded bullets add no new facts, and the application's tone and length resemble the samples.
  4. Revise with "make it shorter" and confirm it gets shorter.
  5. Export. Open both PDFs: A4, æøå render correctly, nothing awkwardly cut across pages. Check the folder contents.
  6. Check the History list and detail, then reopen, edit and re-export.
  7. Paste a **Danish** job ad and confirm the output is in Danish (including headings), while dates and employer names are unchanged.
  8. Error paths: a bad binary path gives a clear message, and Cancel stops the child process.
- **Packaging:** `npm run build:win` produces an installer, and the installed app launches from the Start menu and runs the full flow.

## Calls I made (please check)
- **JSON files instead of a database.** Data lives in `Documents\Applicator`, and each application gets its own readable folder.
- **Two LLM calls per generation** (tailor the CV, then write the letter), so the letter can build on the chosen highlights. Expect roughly 1–2 minutes per generation.
- **Model:** the CLI's default model, unless you pick one in Settings.
- **CV design:** A4 pages and one clean single-column template.
- **Re-exporting from History overwrites** that application's PDFs (no version history).
- **Job metadata:** company, role and language are extracted by the LLM, not entered by you.
