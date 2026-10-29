# Applicator

A Windows desktop app that turns a job posting into a tailored CV and application letter. You keep all your CV data in one place, paste a job description, and Applicator uses Claude to:

1. pick the most relevant items from your CV data and lightly reword them to match the posting (it never adds facts you didn't enter),
2. write an application letter in your own voice, based on applications you've written before,
3. let you review, edit and ask for revisions,
4. export both as PDFs and keep everything locally, so you can look back at what you sent.

Output is written in the language of the job posting (e.g. Danish or English).

## Requirements

- Windows 11 (x64)
- **Claude Code CLI, native build**, logged in with your claude.ai subscription:
  1. Install it in PowerShell: `irm https://claude.ai/install.ps1 | iex`
     (If you installed Claude Code with npm, run `claude install` to get the native build.)
  2. Run `claude` once and log in with `/login`, choosing your claude.ai account.

Applicator finds `claude.exe` automatically (on `PATH`, in `%USERPROFILE%\.local\bin`, or inside the VS Code extension). **Settings** shows which one it uses and has a **Test connection** button.

## Using the app

1. **My CV**: enter your personal details, an intro summary and everything you might want on a CV: technical skills, education and experience. A live preview next to the form shows how the CV looks, and **Download PDF** saves it as a PDF wherever you choose. Each item gets a permanent id (`exp_01`, `skill_03`, …) that Claude uses to refer to it.
2. **Writing style**: paste 2–3 applications you wrote yourself and, optionally, default instructions (e.g. "Keep it under one page").
3. **New application**: paste the full job posting (plus optional extra instructions) and click **Generate**. This usually takes 1–2 minutes.
4. **Review**: edit the letter and CV next to a live preview, tick or untick CV items, or ask Claude for changes ("Make it shorter"), with one-step Undo. Click **Export PDFs** when you're happy.
5. **History**: browse, search, reopen, or delete earlier applications.

## Where your data lives

Everything is stored as plain files in `Documents\Applicator` (you can change this in **Settings**):

```
Documents\Applicator\
  profile.json                 your CV data
  style.json                   writing samples + default instructions
  applications\
    2026-10-29_Acme_Data-Engineer\
      meta.json                company, role, language, dates
      job-description.txt      the posting you pasted
      draft.json               the tailored CV and the letter
      profile-snapshot.json    your CV data as it was when generated
      CV - <Name> - <Company>.pdf
      Application - <Company> - <Role>.pdf
```

Settings are kept in `%APPDATA%\applicator\settings.json`.

## How Claude is used

Applicator runs the Claude Code CLI in print mode (`claude -p`) with structured JSON output. It never calls the Anthropic API directly and never uses an API key:

- Calls run with `--safe-mode`, all tools disabled, and no session history, from an empty working folder, so your own Claude Code plugins, hooks and `CLAUDE.md` files are not involved.
- `ANTHROPIC_API_KEY` and `ANTHROPIC_AUTH_TOKEN` are removed from the CLI's environment, and the app checks that the CLI is logged in with a claude.ai account before the first call.
- Everything you enter is sent to Claude through stdin.

See [docs/claude-cli-notes.md](docs/claude-cli-notes.md) for the exact invocation and output format.

## Development

```powershell
npm install
npm run dev          # start the app with hot reload
npm test             # unit tests (Vitest)
npm run typecheck
```

A live smoke test against the real CLI is skipped by default. Run it with `$env:LIVE_CLI = '1'; npx vitest run tests/main/live-cli.test.ts` (optionally set `LIVE_MODEL`).

The CV's small-caps headings use "Cabin Small Caps", a font generated from Cabin by `scripts/make-small-caps-font.py` (needs Python with `pip install fonttools brotli`). The generated fonts are committed in `src/renderer/src/assets/fonts`, so you only need to run it again if Cabin is updated.

If `npm run dev` exits with `Cannot read properties of undefined (reading 'isPackaged')`, your shell has `ELECTRON_RUN_AS_NODE` set (some editors and tools set it). Clear it first: `Remove-Item Env:ELECTRON_RUN_AS_NODE`.

## Building the installer

```powershell
npm run build:win
```

This produces `dist\applicator-<version>-setup.exe`. The installer isn't code-signed, so Windows SmartScreen will warn the first time: choose **More info → Run anyway**.

Design and plan documents are in [docs/superpowers](docs/superpowers).
