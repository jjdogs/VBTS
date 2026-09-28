# Verse Blocks

Learn UEFN's Verse language with snap-together blocks, code.org style, with the real Verse
written alongside. Blocks, text, or both side by side; guided lessons; game-mode templates;
and a text → blocks converter.

Live version: https://claude.ai/artifact/8fhKrUyeQKGS67sYM1JnDC

## Setup

You need **Node.js 22.18 or newer** (the current LTS works) — https://nodejs.org

```bash
npm install
npm run dev        # opens the app at http://localhost:5173 and reloads as you edit
```

| Command | What it does |
|---|---|
| `npm run dev` | Runs the app locally with live reload |
| `npm test` | Runs all 43 tests (about a second) |
| `npm run check` | TypeScript type-check |
| `npm run build` | Builds the whole app into one file: `dist/index.html` |
| `npm run preview` | Serves the built file to try it |
| `npm run golden` | Re-records the golden test outputs (see *Tests*) |
| `npm run devices -- digest.md` | Regenerates the device list from Epic's docs (needs Python) |

Before sharing changes: `npm run check && npm test && npm run build`.

## How it's organized

```
index.html              the page's markup
src/
  main.ts               starts everything: Blockly, the engine, then the UI
  styles/app.css        main styles
  styles/layout.css     panels, side bar, dividers
  ui/app.js             the interface (Learn panel, code view, dialogs, lessons, templates)
  ui/layout.ts          movable panels: pin/unpin, drag to rearrange, resize, saved layout
  ui/toolbox-panel.ts   the Toolbox: category grid + always-visible palette (drag into the workspace,
                        or in Text view drag/click code into the editor)
  ui/document-metrics.ts scroll limits so "like text" blocks scroll like a document
  ui/responsive.ts      the small-screen header's More menu
  ui/appearance.ts      Edit Mode: appearance settings, presets, the Appearance panel
  ui/unified.ts         one editor: "like text" blocks layout, keeping your place between views
  ui/text-editor.ts     the Text view editor: Verse highlighting, typing → blocks, blocks → text
  engine/code-labels.ts optional Verse wording on blocks (Appearance → Block words)
  styles/appearance.css appearance variables and the Appearance panel
  styles/responsive.css size- and touch-based styles
  ui/blockly-media/     Blockly's control icons, embedded so they work on published pages
  engine/               everything about Verse and blocks — no UI code in here
    index.ts            the engine's front door: the only thing the UI imports
    types.ts            shared data shapes (warnings, lessons, templates…)
    blockly.ts          one Blockly import that works in the browser and in tests
    catalog.ts          device lookups
    workspace.ts        questions about the workspace ("is Agent available here?")
    fields.ts           custom fields (smart dropdowns, name boxes)
    registry.ts         defineBlock(): registers a block's shape, output and help together
    explain.ts          the "Selected block" explanation
    toolbox.ts          the categories and blocks in the toolbox
    blocks/             one file per toolbox category (logic.ts, devices.ts, data.ts, types.ts…)
    generator/          blocks → Verse: the generator, using lines, warnings, line map
    parser/             Verse → blocks
      tree.ts             lines → indentation tree
      expressions.ts      values and conditions
      statements.ts       lines inside functions (a list of rules)
      members.ts          what's inside a device class
    content/
      lessons.ts        the guided lessons
      templates/        one file per game-mode template
    data/
      devices.json      115 Creative devices' events and actions (from Epic's docs)
      modules.ts        using-modules, doc links, category colors
      verse-types.ts    value types, literals, parameter lists
tests/                  automated tests + fixtures
scripts/                device-list and golden-output generators
```

The one rule: **`src/engine` never touches the page**, and the UI only uses what
`engine/index.ts` exports. That keeps the engine testable without a browser, and lets the UI be
rebuilt (for example in Svelte) without touching the engine.

## Roadmap

1. ✅ Core blocks, split view, lessons
2. ✅ using & modules, all official devices, one-click fixes, share codes
3. ✅ Data: arrays, maps, options, function inputs and results, `<decides>`
3.5. ✅ Responsive UI: phones, tablets, laptops, big screens, touch
3.6. ✅ Edit Mode (Appearance panel) and the one-window editor
4.1. ✅ Your own classes, structs and enums; access specifiers; style rule 6.2
4.2. Multiple files (next)
5. Players & teams, UI widgets, positions and movement
6. ✅ Text ⇄ blocks: type directly in the Text view
7. VS Code extension (on hold: web-only for now)
8. Game-mode templates (first one done: pop-up target gallery)

## One editor, two views

**The Text view is a real code editor** (CodeMirror 6, `ui/text-editor.ts`): type in it directly.
A moment after you pause, your text becomes blocks and the Learn panel's checks update; your
text isn't rewritten while you type. Leaving the Text view tidies it into the standard format.
Changing blocks (in Blocks or Split view) updates the text. Moving the cursor onto a line
selects its block, so Learn explains that line. The file bar shows the sync status ("In sync",
"2 pieces kept as raw Verse · details", or why it can't make blocks yet). **Show Text / Show
Blocks** switches views in place.

Blocks and Text are two ways of showing the same code in the same place (Split puts them
side by side). With the default **"Like text"** blocks layout (`ui/unified.ts`), blocks line up
in one column from the top-left and are tidied after every drop, the background doesn't drag
around like a map, and the mouse wheel scrolls like a text editor (Ctrl + wheel zooms).
Switching Blocks ⇄ Text keeps your place: the block at the top of one view is the line at the
top of the other. The file bar above both views works for either. "Free canvas" (Appearance)
brings back the open workspace.

## Appearance (Edit Mode)

**Block look → Like text** (the default) makes blocks look like the Text view: the code font
at the code size, compact rows, blocks drawn as tinted outlines in their category colour, a
line-number gutter beside the blocks that matches the Text view's line numbers, and the same
left and top edges. **Classic** gives solid blocks. **Block words** can switch from the friendly
wording (default) to Verse wording (`src/engine/code-labels.ts`); both look and words apply
after a reload, and neither changes the generated code.

**Customize** (or the palette icon on the side bar) opens the Appearance panel
(`ui/appearance.ts`). Everything applies live and is saved on the device:
- themes: Follow system, Midnight, Daylight, High contrast, Warm; then any colour individually
  (interface, code highlighting, and each block category, with ↺ to undo one);
- fonts and sizes for the interface, code and blocks; line spacing; block size;
- blocks layout (like text / free canvas), block shape (rounded / classic / simple; applies
  after a reload), dot grid, corner roundness, spacing density, animations;
- export / import your look as a code, and reset.

Settings become CSS variables (`styles/appearance.css`: `--ui-scale`, `--code-size`,
`--code-lh`, `--radius-scale`, `--space`, colours) and a Blockly theme; block colours go through
the engine's `setColourOverrides`.

## Responsive design

- **Making room** (`ui/layout.ts`): the workspace needs at least 720 px in Split view (420 px in
  Blocks or Text). If pinned panels leave less, the Toolbox collapses to chips, then panels tuck
  into the side bar (marked with a dot). Your saved layout isn't changed; widen the window and
  they return.
- **Split direction** follows the workspace's shape: blocks and code stack only when the
  workspace is narrow *and* tall (so phones in landscape get them side by side).
- **Tablets and phones** (≤ 900 px): a one-row header; Customize, Templates and Project move
  into **More** (≤ 640 px the name shrinks to the logo).
- **Touch screens**: buttons, tabs, categories and dividers are at least 44 px.
- **Short screens** (≤ 500 px tall, e.g. landscape or 200% zoom): tighter spacing, no legend.
- `styles/responsive.css` holds the size and input rules.

To check every size after a change (needs Python and Playwright:
`pip install playwright && playwright install chromium`):

```bash
npm run build
python3 scripts/responsive-audit.py dist/index.html
```

It checks phone, phone landscape, tablet, tablet landscape, laptop, laptop at 200% zoom, desktop
and ultrawide for page scrolling, header wrapping, small touch targets, cramped blocks/code and
dialogs that don't fit, plus make-room, restore-on-widen and rotating a phone.

## Verse style

Generated code follows Epic's Verse style guide ("Programming with Verse", sections 0–12):
four-space indents, `Name:type = value`, a space before `=` in signatures (`Sqr(X:int):int =`),
`@editable` on its own line, `<decides><transacts>` for failable functions, and lower_snake_case
type names with PascalCase for everything else.

`src/engine/style.ts` checks the names you type and shows gentle **Style** notices (never errors),
each citing its guide section: PascalCase names (2.3), a lower_snake_case device class (2.1),
`IsX` logic variables (1.1), `OnX` handlers (7.1), no `Async` suffix (8.1), no `_type` / `_class`
/ `_t` decorations (1.2, 2.4), and not mixing `return` with an implicit result (4.1). Naming notices
offer **Rename everywhere**. Section 6.2 (private members) is planned for Phase 4 with custom classes.

## Your own types

The **Types** category makes classes (`pet := class:`, with a parent: `cat := class(pet):`,
specifiers `<concrete>` `<unique>` `<final>` `<abstract>`), structs and enums. They sit next to the
device (they're file-level) and are written before it. Fields can be any type with an optional
starting value (`var MyPet:pet = pet{Name := "Scout"}`); methods are functions inside the class.
Blocks make objects (`pet{Name := …}`, checked against the class's fields), read and set fields,
call methods, use enum values (`game_state.Playing`) and `Self`. Members and functions can be
`<private>`, `<protected>`, `<internal>` or `<public>`. Style rule 6.2 suggests `<private>` only
for members nothing outside the class uses, with a one-click fix.

## Layout

Like Code.org's App Lab: the **Toolbox** on the left has a two-column category grid and, below
it, the chosen category's blocks, always visible. In Blocks view, drag a block from there into
the workspace (it snaps like any block); in Text view the Toolbox shows each block's Verse, which
you can drag into the editor or click to insert at the cursor. The **Workspace** header has the
file name in the middle and the view and save buttons on the right, and **Learn** sits on the
right. Collapsing the Toolbox (☰) leaves just the colour chips, which open Blockly's tray.

The **Learn** and **Toolbox** panels can each be pinned (a column on the left or right) or
unpinned (an icon on the side bar that slides the panel out when clicked). Drag a panel's
header to reorder it or move it to the other side, or use its **⋯** menu (works on touch
screens). **☰** collapses the Toolbox to color chips. Drag panel edges and the blocks/code
divider to resize; double-click a divider to reset. The layout is saved in the browser;
**⋯ → Reset layout** restores the default. On narrow screens every panel uses the side bar.

To add another panel: add a `<section class="panel" id="panel-NAME">` to `index.html`, then
add its id, title and icon in `src/ui/layout.ts` (`PanelId`, `TITLES`, `ICONS`, `DEFAULTS`).

## Common changes

**Add a block** — open the category file in `src/engine/blocks/` and add a `defineBlock({...})`:
its `explain` text, `init()` (shape), and `generate()` (the Verse it writes). Then list it in
`src/engine/toolbox.ts`. If Verse text should convert back into it, add a rule in
`src/engine/parser/statements.ts` (or `expressions.ts` for values), and a test.

**Add a lesson** — add an entry to `src/engine/content/lessons.ts`: goal, steps, a `check`
that looks at the generated code, and a `start` workspace (or `null` to continue from the last one).

**Add a game-mode template** — copy `content/templates/target-gallery.ts`, change the Verse,
devices and steps, and add it to `content/templates/index.ts`. The round-trip test automatically
checks that every template converts into real blocks.

## Tests

- `tests/golden.test.ts` compares the engine's output with `tests/fixtures/golden.json`,
  recorded from the original version: generated Verse, warnings, fixes, conversion reports and
  lesson checks must match exactly.
- `tests/roundtrip.test.ts` checks blocks → Verse → blocks → Verse comes back identical.
- `tests/parser.test.ts` has small focused converter tests (including which source lines each
  block came from, used to link the cursor to blocks).
- `tests/types.test.ts` covers classes, structs and enums: a full program round-trips, object
  fields are checked, and the naming and 6.2 style rules.
- `tests/phase3.test.ts` covers arrays, maps, options and functions: the Verse each program
  writes, its warnings, the lesson checks, and that every toolbox block loads.

If you change the output **on purpose**, run `npm run golden`, then review the changes to
`golden.json` (e.g. `git diff`) before committing. Tests use Node's built-in test runner,
which runs TypeScript directly, so the code uses only "type-strippable" TypeScript
(no `enum` or `namespace`; the compiler enforces this).

## Known quirks (left as-is during the TypeScript move, to be fixed deliberately later)

- When a value can't be converted and falls back to raw Verse, part of it can appear twice in
  the conversion report's raw list. Harmless; the generated code is unaffected.
- Comments at the end of a code line are dropped by the converter (the report says so).
  Comments on their own line are kept.
