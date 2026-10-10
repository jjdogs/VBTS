# Development

[← Back to the README](../README.md)

- [Setup and commands](#setup-and-commands)
- [How the code is organised](#how-the-code-is-organised)
- [Common changes](#common-changes)
- [Tests](#tests)
- [Checking every screen size](#checking-every-screen-size)

## Setup and commands

You need **Node.js 22.18 or newer** (the current LTS works): https://nodejs.org. The Verse API
scripts and the screen-size check also need Python 3.

```bash
npm install
npm run dev        # opens the app at http://localhost:5173 and reloads as you edit
```

| Command | What it does |
|---|---|
| `npm run dev` | Runs the app locally with live reload |
| `npm test` | Runs all the tests (a few seconds) |
| `npm run check` | TypeScript type-check |
| `npm run build` | Builds the whole app into one file: `dist/index.html` |
| `npm run preview` | Serves the built file to try it |
| `npm run golden` | Re-records the golden test outputs (see [Tests](#tests)) |
| `npm run api` | Reads Epic's Verse API reference into `scripts/data/verse-api-devices.json` (pages are cached in `.cache/`) |
| `npm run devices` | Rebuilds the device list from that snapshot and the digests, and prints what changed |

Before sharing changes: `npm run check && npm test && npm run build`. Work goes on the `dev`
branch; see [Releasing](releasing.md).

## How the code is organised

```
index.html                 the page's markup
src/
  main.ts                  starts everything: Blockly, the engine, then the UI
  ui/                      the interface (uses only what engine/index.ts exports)
    app.js                 Learn panel, code view, dialogs, lessons, templates (app.d.ts: its types)
    layout.ts              side panels: one per side, chosen from the activity bars; resize; phones' sheets
    menu.ts                popup menus (⋯ menus, the top bar's menu, a file's menu)
    icons.ts               the line icons used in the chrome
    toolbox-panel.ts       the Toolbox: category grid + always-visible palette
    workspace-controls.ts  the Blocks view's zoom / back-to-start / trash bar
    document-metrics.ts    scroll limits so "like text" blocks scroll like a document
    unified.ts             one editor: "like text" blocks layout, keeping your place between views
    text-editor.ts         the Text view editor: Verse highlighting, typing → blocks, blocks → text
    files.ts               several files per project: Files panel, tabs, problem dots, share codes (VB3)
    appearance.ts          Look: settings, themes, the Look panel (search, JSON, Changed only, Inspect)
    blockly-media/         Blockly's control icons, embedded so they work on published pages (see its README)
  styles/
    app.css                main styles
    layout.css             the chrome: top bar, activity bars, panels, tabs, status bar, phone sheets
    appearance.css         appearance variables, the one-window editor, "like text" blocks
    responsive.css         size- and touch-based styles
  engine/                  everything about Verse and blocks; no UI code in here
    index.ts               the engine's front door: the only thing the UI imports
    types.ts               shared data shapes (warnings, lessons, templates…)
    blockly.ts             one Blockly import that works in the browser and in tests
    registry.ts            defineBlock(): registers a block's shape, output and help together
    toolbox.ts             the categories and blocks in the toolbox
    catalog.ts             device lookups
    workspace.ts           questions about the workspace ("is Agent available here?")
    fields.ts              custom fields (smart dropdowns, name boxes)
    explain.ts             the "Selected block" explanation
    style.ts               style checks from Epic's Verse style guide
    code-labels.ts         optional Verse wording on blocks (Look → Block words)
    project.ts             what a project's other files define and use (for checks across files)
    blocks/                one file per toolbox category (logic.ts, devices.ts, movement.ts…)
    generator/             blocks → Verse
      generate.ts            a whole workspace → a Verse file
      verse-generator.ts     the generator: using lines, warnings, helper functions
    parser/                Verse → blocks
      tree.ts                lines → indentation tree
      expressions.ts         values and conditions
      statements.ts          lines inside functions (a list of rules)
      members.ts             what's inside a device class
      builder.ts             makes block states and the conversion report
      index.ts               parseVerse(): runs the steps above
    content/
      lessons.ts           the 26 guided lessons
      templates/           one file per game-mode template (index.ts lists them)
    data/
      devices.json         203 Creative devices' events and actions (generated; see verse-api.md)
      handlers.ts          what event handlers can receive, and value events
      modules.ts           using-modules, doc links, category colours
      verse-types.ts       value types, their modules, literals, parameter lists
      teams.ts             the team collection's questions
      ui.ts                canvas position presets
tests/                     automated tests; fixtures/ holds golden.json and sample .verse files
prototypes/                Verse to try in UEFN before building blocks or lessons on it (scrub-test/, and pizza-lessons/: Pizza path lesson drafts)
scripts/
  fetch-verse-api.py       reads Epic's Verse API reference (npm run api)
  extract-devices.py       builds devices.json (npm run devices)
  data/                    the reference snapshot and Epic's API digests
  record-golden.ts         re-records tests/fixtures/golden.json (npm run golden)
  responsive-audit.py      checks every screen size
.github/workflows/         CI, publishing, and the weekly Verse API sync (see releasing.md)
```

The one rule: **`src/engine` never touches the page**, and the UI only uses what
`engine/index.ts` exports. That keeps the engine testable without a browser, and lets the UI be
rebuilt (for example in Svelte) without touching the engine.

TypeScript must be **type-strippable** (Node runs the tests directly): no `enum` or `namespace`;
the compiler enforces this.

## Common changes

**Add a block**: open the category file in `src/engine/blocks/` and add a `defineBlock({...})`:
its `explain` text, `init()` (shape), and `generate()` (the Verse it writes). Then list it in
`src/engine/toolbox.ts`. If Verse text should convert back into it, add a rule in
`src/engine/parser/statements.ts` (or `expressions.ts` for values), and a round-trip test. If it
calls Epic's API, add the call to `tests/digest.test.ts` so its signature is checked.

**Add a lesson**: add an entry to `src/engine/content/lessons.ts`: goal, steps, a `check` that
looks at the generated code, and a `start` workspace (or `null` to continue from the last one).

**Add a game-mode template**: copy `src/engine/content/templates/target-gallery.ts`, change the
Verse, devices and steps, and add it to `src/engine/content/templates/index.ts`. The round-trip test
automatically checks that every template converts into real blocks.

**Add a panel**: add a `<section class="panel" id="panel-NAME">` inside `#sheetHost` in
`index.html`, then add its id, title, icon and default side in `src/ui/layout.ts` (`PanelId`,
`PANEL_TITLES`, `PANEL_ICONS`, `DEFAULTS`).

**Update device data or the digests**: see [Verse API data](verse-api.md).

## Tests

`npm test` runs every file in `tests/` with Node's built-in test runner. `tests/helpers.ts` sets up
a headless Blockly workspace and the engine.

**The engine's output**
- `golden.test.ts` compares the engine's output with `fixtures/golden.json`, recorded from the
  original version: generated Verse, warnings, fixes, conversion reports and lesson checks must
  match exactly.
- `roundtrip.test.ts` checks blocks → Verse → blocks → Verse comes back identical.
- `parser.test.ts` has small focused converter tests (including which source lines each block came
  from, used to link the cursor to blocks).
- `converter-gaps.test.ts` covers text with values anywhere, several parts in one if, else if
  chains and general chains: each round-trips exactly.
- `false-errors.test.ts` checks that code which compiles in UEFN (Epic's voice chat example) isn't
  reported as broken.
- `lava-device.test.ts` round-trips a full "floor is lava" device.
- `style.test.ts` covers the style guide's formatting and naming rules.
- `code-labels.test.ts` checks that Verse wording on blocks never changes the code.
- `bugfixes.test.ts` holds regression tests for bugs found in review.

**Features**
- `phase3.test.ts` covers arrays, maps, options and functions: the Verse each program writes, its
  warnings, the lesson checks, and that every toolbox block loads.
- `types.test.ts` covers classes, structs and enums: a full program round-trips, object fields are
  checked, and the naming and 6.2 style rules.
- `project.test.ts` covers projects with several files: classes and enums across files, duplicate
  names, and the cross-file style rules. `files.test.ts` covers share codes, older saves and file
  names.
- `phase5.test.ts` covers the Phase 5.0 foundations: local values, new types, casts, handlers that
  receive other types, value events and device actions with inputs.
- `teams.test.ts` covers Phase 5.1: team questions, elimination results, a character's agent,
  health and shield, lessons 18–20 and the team elimination template.
- `movement-ui.test.ts` covers Phases 5.2 and 5.3: positions, teleporting and MoveTo; UI widgets,
  canvases, clicks; lessons 21–26 and the parkour and shop templates.
- `api-blocks.test.ts` covers respawning, the lobby, random decimals, shuffling and prop animation.

**Epic's API**
- `device-catalog.test.ts` covers the device list: inherited members, which devices are listed,
  event types from the digest, and events that send several values.
- `digest.test.ts` checks the Verse the blocks write against Epic's API digests: every type's
  module, the using list, value events, and each function's signature. After copying in a newer
  digest, it says what moved or changed.

If you change the output **on purpose**, run `npm run golden`, then review the changes to
`fixtures/golden.json` (e.g. `git diff`) before committing; otherwise golden output must not change.

## Checking every screen size

Needs Python and Playwright (`pip install playwright && playwright install chromium`):

```bash
npm run build
python3 scripts/responsive-audit.py dist/index.html
```

It checks phone, phone landscape, tablet, tablet landscape, laptop, laptop at 200% zoom, desktop
and ultrawide for page scrolling, header wrapping, small touch targets, cramped blocks/code and
dialogs that don't fit, plus floating panels, docking again on widen and rotating a phone. Set
`CHROMIUM_PATH` to use a Chromium you already have.
