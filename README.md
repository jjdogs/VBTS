# Verse Blocks

Learn UEFN's Verse language with snap-together blocks, code.org style, with the real Verse
written alongside. Blocks, text, or both side by side; guided lessons; game-mode templates;
and a text → blocks converter.

Live version: https://jjdogs.github.io/VBTS/ (rebuilt and published from `main` automatically; see *Publishing*)

## Setup

You need **Node.js 22.18 or newer** (the current LTS works) — https://nodejs.org

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
| `npm run golden` | Re-records the golden test outputs (see *Tests*) |
| `npm run api` | Reads Epic's Verse API reference into `scripts/data/verse-api-devices.json` (needs Python; pages are cached in `.cache/`) |
| `npm run devices` | Rebuilds the device list from that snapshot and prints what changed |

Before sharing changes: `npm run check && npm test && npm run build`.

**Keeping up with Verse.** Every Monday the *Verse API sync* workflow (`.github/workflows/verse-api.yml`)
runs both scripts. When Epic's reference changed, it opens a pull request into `dev` listing new
devices, actions and events. Epic's reference doesn't show what an event sends, so event types come
from Epic's API digest in `scripts/data/digest/` (copied from a UEFN project; currently Fortnite 42.30).
Events newer than the digest have their type read from their description, and the pull request says
so: check those, and copy in a newer `Fortnite.digest.verse` after big Fortnite updates. You can also
run it by hand from the Actions tab.

## Publishing

The site is hosted on GitHub Pages. `.github/workflows/pages.yml` runs on every push to `main`: it
type-checks, runs the tests, builds `dist/index.html` and publishes it. If the checks fail, nothing is
published. Watch a deploy in the repository's **Actions** tab.

One-time setup: **Settings → Pages → Build and deployment → Source: GitHub Actions**. On a free
GitHub plan, Pages needs the repository to be public.

**Branches.** Work happens on `dev`; `main` is what's live. `.github/workflows/ci.yml` type-checks,
tests and builds every push to `dev` (and every pull request), so the Actions tab shows whether
`dev` is healthy. To release, open a pull request from `dev` into `main` and merge it with
**Create a merge commit** (not squash, so the branches stay in step); the site then rebuilds.
A preview of `dev` can be published to the older claude.ai artifact
(https://claude.ai/artifact/8fhKrUyeQKGS67sYM1JnDC) to try changes before a release.

## How it's organized

```
index.html              the page's markup
src/
  main.ts               starts everything: Blockly, the engine, then the UI
  styles/app.css        main styles
  styles/layout.css     the chrome: top bar, activity bars, panels, tabs, status bar, phone sheets
  ui/app.js             the interface (Learn panel, code view, dialogs, lessons, templates)
  ui/layout.ts          side panels: one per side, chosen from the activity bars; resize; phones' sheets
  ui/menu.ts            popup menus (⋯ menus, the top bar's menu, a file's menu)
  ui/icons.ts           the line icons used in the chrome
  ui/toolbox-panel.ts   the Toolbox: category grid + always-visible palette (drag into the workspace,
                        or in Text view drag/click code into the editor)
  ui/document-metrics.ts scroll limits so "like text" blocks scroll like a document
  ui/appearance.ts      Look: settings, themes, the Look panel (search, JSON, Changed only, Inspect)
  ui/unified.ts         one editor: "like text" blocks layout, keeping your place between views
  ui/text-editor.ts     the Text view editor: Verse highlighting, typing → blocks, blocks → text
  ui/files.ts           several files per project: Files panel, tabs, problem dots, share codes (VB3)
  engine/code-labels.ts optional Verse wording on blocks (Appearance → Block words)
  styles/appearance.css appearance variables, the one-window editor, "like text" blocks
  styles/responsive.css size- and touch-based styles
  ui/blockly-media/     Blockly's control icons, embedded so they work on published pages
  engine/               everything about Verse and blocks — no UI code in here
    index.ts            the engine's front door: the only thing the UI imports
    project.ts          what a project's other files define and use (for checks across files)
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
      devices.json      203 Creative devices' events and actions (from Epic's docs)
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
4.2. ✅ Multiple files: file tabs, classes and enums shared across files, whole-project share codes
5. ✅ Players & teams, UI widgets, positions and movement (see `docs/phase-5-plan.md`)
6. ✅ Text ⇄ blocks: type directly in the Text view
7. VS Code extension (on hold: web-only for now)
8. Game-mode templates (done so far: pop-up target gallery, team elimination, moving-platform parkour, shop menu)

## One editor, two views

**The Text view is a real code editor** (CodeMirror 6, `ui/text-editor.ts`): type in it directly.
A moment after you pause, your text becomes blocks and the Learn panel's checks update; your
text isn't rewritten while you type. Leaving the Text view tidies it into the standard format.
Changing blocks (in Blocks or Split view) updates the text. Moving the cursor onto a line
selects its block, so Learn explains that line. The status bar shows the sync status ("In sync",
"In sync · 2 pieces kept as raw Verse", or why it can't make blocks yet). The three icons at the
right of the tabs switch between **Blocks**, **Text** and **Split**.

Blocks and Text are two ways of showing the same code in the same place (Split puts them
side by side). With the default **"Like text"** blocks layout (`ui/unified.ts`), blocks line up
in one column from the top-left and are tidied after every drop, the background doesn't drag
around like a map, and the mouse wheel scrolls like a text editor (Ctrl + wheel zooms).
Switching Blocks ⇄ Text keeps your place: the block at the top of one view is the line at the
top of the other. The tabs above both views work for either. "Free canvas" (Look) brings back
the open workspace.

## Look (appearance settings)

**Block look → Like text** (the default) makes blocks look like the Text view: the code font
at the code size, compact rows, blocks drawn as tinted outlines in their category colour, a
line-number gutter beside the blocks that matches the Text view's line numbers, and the same
left and top edges. **Classic** gives solid blocks. **Block words** can switch from the friendly
wording (default) to Verse wording (`src/engine/code-labels.ts`); both look and words apply
after a reload, and neither changes the generated code.

The palette icon on the right activity bar opens the **Look** panel (`ui/appearance.ts`).
Everything applies live and is saved on the device:
- **Theme and accent**: Graphite (the default), Midnight, Daylight, Warm, High contrast, or
  "Match my device"; six accent colours or any colour;
- **Layout and panels**: blocks layout (like text / free canvas), block look and words, block size
  and shape, dot grid, and which side each panel sits on;
- **Tabs and files**: problem dots on files, ".verse" after tab names;
- **Feel**: corner roundness, spacing, animations; **Text and fonts**: fonts, sizes, line spacing;
- **App chrome colors**, **Code colors**, **Block colors**: any colour individually (↺ undoes one);
- **Save and share**: export / import your look as a code, and reset.

At the top: **Search settings** filters every section, **Changed only** shows just what you have
changed, **JSON** edits every setting as JSON, and **Inspect** lets you click any part of the
app (a block, a word of code, a bar) to jump to the colour that paints it.

Settings become CSS variables (`styles/appearance.css`: `--ui-scale`, `--code-size`,
`--code-lh`, `--radius-scale`, `--space`, colours) and a Blockly theme; block colours go through
the engine's `setColourOverrides`.

## Responsive design

- **Making room** (`ui/layout.ts`): the editor needs at least 720 px in Split view (420 px in
  Blocks or Text). If the open panels leave less, the right panel floats over the editor (and the
  left one too if even 420 px is not left). Your saved layout isn't changed; widen the window and
  they dock again.
- **Split direction** follows the workspace's shape: blocks and code stack only when the
  workspace is narrow *and* tall (so phones in landscape get them side by side).
- **Tablets and phones** (≤ 900 px): the activity bars become a bottom tab bar (Files, Toolbox,
  Learn, Look) and a panel opens as a sheet from the bottom; tap outside it or its tab to close.
  The top bar keeps the logo, Share and ⋯; the status bar keeps its icons.
- **Touch screens**: buttons, tabs, categories and dividers are at least 44 px.
- **Short screens** (≤ 500 px tall, e.g. landscape or 200% zoom): tighter spacing, taller sheets.
- `styles/responsive.css` holds the size and input rules.

To check every size after a change (needs Python and Playwright:
`pip install playwright && playwright install chromium`):

```bash
npm run build
python3 scripts/responsive-audit.py dist/index.html
```

It checks phone, phone landscape, tablet, tablet landscape, laptop, laptop at 200% zoom, desktop
and ultrawide for page scrolling, header wrapping, small touch targets, cramped blocks/code and
dialogs that don't fit, plus floating panels, docking again on widen and rotating a phone. Set
`CHROMIUM_PATH` to use a Chromium you already have.

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

## Players, movement and UI (Phase 5)

- **Events of values**: a player joining (`GetPlayspace().PlayerAddedEvent()`), a character being
  eliminated (`FortChar.EliminatedEvent()`), jumping, crouching, sprinting, healing and shield
  events, AI participants joining, a button clicked (`Button.OnClick()`); handlers can receive a
  player, an agent, a character, an elimination, damage or healing Result, a button click Message
  or an AI result.
- **Events that send several values** (the Popup Dialog's button, the Input Trigger's hold time, a
  stat's new value…): the handler gets one input per value, `OnChoice(Agent:agent, Value:int)`.
- **Local values** in functions (`Name := value`, `var Name:type = value`), casts
  (`player[Agent]`), and device actions with inputs (`Score.SetScoreAward(10)`).
- **Teams**: the team collection's GetTeam / GetAgents / IsOnTeam / AddToTeam (failable), every
  player, elimination results and a character's agent, health and shield. Respawning an agent at a
  position (`Agent.Respawn(…)`) and sending a player to the lobby (`Player.SendToLobby()`).
- **Movement**: positions (`vector3`), rotations, where things are (`GetTransform()`), distances,
  teleporting and moving props over time; `creative_prop` can be linked. Prop animation
  (CreativeAnimation): a prop's animation controller, a keyframe move played once or back and
  forth, and play / pause / stop.
- **Random**: random whole numbers and decimals (`GetRandomFloat`), and shuffling an array.
- **UI**: a player's UI, text and button widgets on a canvas at a preset position, clickable
  widgets, changing text, hiding, and who clicked.

Each has a toolbox category (Teams, Movement, UI, plus additions to Player and Events), lessons
18–26 and a template (team elimination, moving-platform parkour, shop menu).

## What text → blocks understands

Besides one block per Verse feature above, the converter keeps these shapes as blocks (and writes
them back exactly as typed):

- **Text with values anywhere**: `"You have {Coins} coins"`, up to three values (Text: "text with
  values"). `"Score: {Score}"` keeps its original block.
- **Several parts in one if**: `if (Player := player[Agent], UI := GetPlayerUI[Player]):` (Logic:
  "all of" with "name := value" parts). A name made in the condition can be used in later parts
  and in the then part.
- **else if chains**: `else if (…):` stays a chain; in blocks it is an if inside the else, and any
  lone if inside an else is written as `else if`.
- **Chains on any value**: `.Field`, `.Call(…)` and `.Try[…]` after a value (Functions: "part of a
  value"), and a call chain as its own line ("do"), e.g. `Platform.GetTransform().Rotation`.

Anything else is kept word for word in a raw Verse block, so nothing is lost.

## Several files

A project can hold several `.verse` files (`ui/files.ts`). The **Files** panel lists them all; the
tabs above the editor are the files you have open. Click a file or tab to open it, double-click
(or use its ⋯ menu) to rename it, × closes a tab (the file stays in the project), and **+** adds a
file that starts with a device named after it. Names are linked: renaming a file renames the
device or class inside it that has the file's name. A red dot marks a file with something to
fix, an amber dot one with style notes. The project's name sits in the top bar (click to rename).

All files are in the same Verse module, like `.verse` files in one UEFN folder: a class, struct
or enum made in one file can be used in another without a `using` line. Only the open file is on
the workspace; the engine gets a summary of the others (`engine/project.ts`, `projectContext`), so:

- `pet{…}` and `game_state.Playing` from another file become blocks and are checked;
- a name defined in two files is an error (they share one module);
- style rule 6.2 doesn't suggest `<private>` for members another file uses, and
  "Rename everywhere" isn't offered for names other files use (it would only reach this file).

Leaving a file works like leaving the Text view: typed text is turned into blocks first, and if
it can't be, you're asked before it is replaced. Undo history is per visit to a file. Templates
open as their own file. **Share** codes (`VB3:…`) hold every file, the open tabs and the
project's name; older `VB2:` codes still load as a one-file project, and older saved work becomes
the project's first file.

## Layout

Like a code editor (`ui/layout.ts`):

- **Top bar**: the project's name, **Share** (copy a share code, load one, or start a blank
  project) and **⋯** (templates, copy or save the Verse, new file, blank project, reset layout).
- **Activity bars** on the left (Files, Toolbox, Learn) and right (Look). Each side shows one
  panel at a time; click the open panel's icon to hide it. A panel's **⋯** menu moves it to the
  other side (also in Look → Layout and panels).
- **Editor**: the open files as tabs, then the Blocks / Text / Split icons. Drag panel edges and the
  blocks/code divider to resize; double-click a divider to reset.
- **Status bar**: sync status, "Saved on this device", the problem count (click it to see what
  needs fixing), and buttons to copy the Verse or save it as a `.verse` file.

The **Toolbox** is like Code.org's App Lab: a two-column category grid and, below it, the chosen
category's blocks, always visible. In Blocks view, drag a block from there into the workspace (it
snaps like any block); in Text view the Toolbox shows each block's Verse, which you can drag into
the editor or click to insert at the cursor.

The layout is saved in the browser; **⋯ → Reset panel layout** restores the default. To add
another panel: add a `<section class="panel" id="panel-NAME">` inside `#sheetHost` in
`index.html`, then add its id, title, icon and default side in `src/ui/layout.ts` (`PanelId`,
`PANEL_TITLES`, `PANEL_ICONS`, `DEFAULTS`).

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
- `tests/project.test.ts` covers projects with several files: classes and enums across files,
  duplicate names, and the cross-file style rules. `tests/files.test.ts` covers share codes,
  older saves and file names.
- `tests/phase5.test.ts` covers the Phase 5.0 foundations: local values, new types, casts,
  handlers that receive other types, value events and device actions with inputs.
- `tests/teams.test.ts` covers Phase 5.1: team questions, elimination results, a character's agent,
  health and shield, lessons 18–20 and the team elimination template.
- `tests/movement-ui.test.ts` covers Phases 5.2 and 5.3: positions, teleporting and MoveTo; UI
  widgets, canvases, clicks; lessons 21–26 and the parkour and shop templates.
- `tests/converter-gaps.test.ts` covers text with values anywhere, several parts in one if,
  else if chains and general chains: each round-trips exactly.
- `tests/bugfixes.test.ts` holds regression tests for bugs found in review.
- `tests/api-blocks.test.ts` covers respawning, the lobby, random decimals, shuffling and prop
  animation; `tests/device-catalog.test.ts` covers the device list and events that send several values.
- `tests/digest.test.ts` checks the Verse the blocks write against Epic's API digests
  (`scripts/data/digest/`): every type's module, the using list, value events, and each function's
  signature. After copying in a newer digest, it says what moved or changed.

If you change the output **on purpose**, run `npm run golden`, then review the changes to
`golden.json` (e.g. `git diff`) before committing. Tests use Node's built-in test runner,
which runs TypeScript directly, so the code uses only "type-strippable" TypeScript
(no `enum` or `namespace`; the compiler enforces this).

## Known quirks (left as-is during the TypeScript move, to be fixed deliberately later)

- When a value can't be converted and falls back to raw Verse, part of it can appear twice in
  the conversion report's raw list. Harmless; the generated code is unaffected.
- A comment at the end of a code line is kept on that line's block (its comment bubble) and
  written back at the end of the line. Only one on a line with no block of its own (like a class's
  first line) is dropped, and the conversion report says so.
