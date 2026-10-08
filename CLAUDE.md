# Verse Blocks — notes for Claude

## Branches (the repo owner's workflow)

- **Develop on `dev` and push there.** The owner has asked for all work to go to `dev`, even
  when a session is set up with a `claude/…` branch. Start from the latest `dev`
  (`git fetch origin dev && git checkout -B dev origin/dev`).
- **`main` is for releases**: every push to `main` rebuilds and publishes the live site
  (GitHub Pages, `.github/workflows/pages.yml`). Never push to `main` directly.
- **Releasing** = a pull request from `dev` into `main`, merged with **"Create a merge commit"**
  (not squash, so the two branches don't drift apart). Open one only when the owner asks.
- If `main` ever gets a commit that `dev` doesn't have, merge `main` into `dev` before the next
  release.
- CI (`.github/workflows/ci.yml`) type-checks, tests and builds every push to `dev` and every PR.
- **Preview of `dev`**: when the owner asks, build and republish `dist/index.html` to the claude.ai
  artifact https://claude.ai/artifact/8fhKrUyeQKGS67sYM1JnDC (it is not updated automatically).

## Before every push

```bash
npm run check && npm test && npm run build
```

If you change the engine's output on purpose, run `npm run golden` and review the diff of
`tests/fixtures/golden.json`; otherwise golden output must not change.

## Code rules

- `src/engine` never touches the page; the UI only uses what `src/engine/index.ts` exports.
- TypeScript must be type-strippable (Node runs the tests directly): no `enum`, no `namespace`.
- New block: `defineBlock` in `src/engine/blocks/<category>.ts`, list it in `src/engine/toolbox.ts`,
  add a converter rule in `src/engine/parser/` and a round-trip test. See README → *Common changes*.
- Device data comes from Epic's live Verse API reference
  (https://dev.epicgames.com/documentation/fortnite/verse-api): `scripts/fetch-verse-api.py` writes
  `scripts/data/verse-api-devices.json`, then `scripts/extract-devices.py` builds `devices.json`, taking
  event types from the API digests in `scripts/data/digest/` (the owner copies them from UEFN).
  The weekly *Verse API sync* workflow does both and opens a PR into `dev`. Check signatures there;
  the digests have every signature (`UnrealEngine.digest.verse` for SpatialMath); the Verse book
  (verselang.github.io/book) covers the language itself.

## Where things are

- README: how the app is organised, every feature, tests.
- `docs/phase-5-plan.md`: the current roadmap work (5.0 done; 5.1 teams, 5.2 movement, 5.3 UI next).
