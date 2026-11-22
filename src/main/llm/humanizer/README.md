# Humanizer (vendored)

`SKILL.md` and `LICENSE` are copied unchanged from [blader/humanizer](https://github.com/blader/humanizer) v4.0.0 (MIT).
`../humanize.ts` imports `SKILL.md` as text, so it is built into the app; `LICENSE` ships with the installer
(see `extraResources` in `electron-builder.yml`).

To update: copy the new `SKILL.md` and `LICENSE` over these, bump the version above, and run the tests
(and `LIVE_CLI=1 npx vitest run tests/main/live-cli.test.ts -t humanize` against the real CLI).
