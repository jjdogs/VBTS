# Verse Blocks

Learn UEFN's Verse language with snap-together blocks, code.org style, with the real Verse
written alongside. Blocks, text, or both side by side; guided lessons; game-mode templates;
and a text → blocks converter.

**Live version: https://jjdogs.github.io/VBTS/** (published from `main` automatically)

## What it does

- **Blocks that write real Verse.** Every block writes the Verse UEFN compiles, following Epic's
  style guide, and explains itself in the Learn panel. Mistakes get a plain-English warning, often
  with a one-click fix.
- **Text ⇄ blocks.** Type Verse in the Text view and it becomes blocks; change blocks and the text
  follows. Anything without a block is kept word for word, so nothing is lost.
- **Every Creative device.** 203 devices with their events and actions, kept current from Epic's
  Verse API reference every week.
- **Players, teams, movement, UI and more**: events, eliminations, teleporting, moving and
  animating props, on-screen widgets, your own classes and enums, and several files per project.
- **26 lessons and 4 templates** (pop-up target gallery, team elimination, moving-platform
  parkour, shop menu).

## Quick start

You need **Node.js 22.18 or newer** (https://nodejs.org).

```bash
npm install
npm run dev        # opens the app at http://localhost:5173 and reloads as you edit
npm test           # runs all the tests (a few seconds)
```

Before sharing changes: `npm run check && npm test && npm run build`.

## Documentation

| Guide | What's in it |
|---|---|
| [Using the app](docs/using-the-app.md) | The editor and its views, the layout, several files, share codes, Look settings, phones and tablets |
| [Blocks and Verse](docs/blocks-and-verse.md) | What the blocks cover, Verse style checks, your own types, what text → blocks understands |
| [Development](docs/development.md) | Commands, how the code is organised, adding blocks, lessons and templates, tests |
| [Verse API data](docs/verse-api.md) | Where device data comes from, Epic's API digests, the weekly Verse API sync |
| [Releasing](docs/releasing.md) | Branches, CI, publishing to GitHub Pages, the preview |
| [Roadmap](docs/roadmap.md) | Where it stands and what's next: lessons for the newest blocks, waiting for events, saving progress, props, more UI |

The one rule for the code: **`src/engine` never touches the page**, and the UI only uses what
`src/engine/index.ts` exports. See [Development](docs/development.md).
