# Using the app

[← Back to the README](../README.md)

- [One editor, two views](#one-editor-two-views)
- [Layout](#layout)
- [Several files](#several-files)
- [Look (appearance settings)](#look-appearance-settings)
- [Phones, tablets and big screens](#phones-tablets-and-big-screens)

## One editor, two views

**The Text view is a real code editor** (CodeMirror 6, `src/ui/text-editor.ts`): type in it
directly. A moment after you pause, your text becomes blocks and the Learn panel's checks update;
your text isn't rewritten while you type. Leaving the Text view tidies it into the standard format.
Changing blocks (in Blocks or Split view) updates the text. Moving the cursor onto a line selects
its block, so Learn explains that line. The status bar shows the sync status ("In sync",
"In sync · 2 pieces kept as raw Verse", or why it can't make blocks yet). The three icons at the
right of the tabs switch between **Blocks**, **Text** and **Split**.

Blocks and Text are two ways of showing the same code in the same place (Split puts them side by
side). With the default **"Like text"** blocks layout (`src/ui/unified.ts`), blocks line up in one
column from the top-left and are tidied after every drop, the background doesn't drag around like
a map, and the mouse wheel scrolls like a text editor (Ctrl + wheel zooms). Switching
Blocks ⇄ Text keeps your place: the block at the top of one view is the line at the top of the
other. The tabs above both views work for either. "Free canvas" (Look) brings back the open
workspace.

## Layout

Like a code editor (`src/ui/layout.ts`):

- **Top bar**: the project's name, **Share** (copy a share code, load one, or start a blank
  project) and **⋯** (templates, copy or save the Verse, new file, blank project, reset layout).
- **Activity bars** on the left (Files, Toolbox, Learn) and right (Look). Each side shows one
  panel at a time; click the open panel's icon to hide it. A panel's **⋯** menu moves it to the
  other side (also in Look → Layout and panels).
- **Editor**: the open files as tabs, then the Blocks / Text / Split icons. Drag panel edges and the
  blocks/code divider to resize; double-click a divider to reset. In the Blocks view, a small bar in
  the bottom-right corner zooms, goes back to the start, and holds the trash can.
- **Status bar**: sync status, "Saved on this device", the problem count (click it to see what
  needs fixing), and buttons to copy the Verse or save it as a `.verse` file.

The **Toolbox** is like Code.org's App Lab: a two-column category grid and, below it, the chosen
category's blocks, always visible. In Blocks view, drag a block from there into the workspace (it
snaps like any block); in Text view the Toolbox shows each block's Verse, which you can drag into
the editor or click to insert at the cursor.

The layout is saved in the browser; **⋯ → Reset panel layout** restores the default.

## Several files

A project can hold several `.verse` files (`src/ui/files.ts`). The **Files** panel lists them all;
the tabs above the editor are the files you have open. Click a file or tab to open it, double-click
(or use its ⋯ menu) to rename it, × closes a tab (the file stays in the project), and **+** adds a
file that starts with a device named after it. Names are linked: renaming a file renames the device
or class inside it that has the file's name. A red dot marks a file with something to fix, an amber
dot one with style notes. The project's name sits in the top bar (click to rename).

All files are in the same Verse module, like `.verse` files in one UEFN folder: a class, struct or
enum made in one file can be used in another without a `using` line. Only the open file is on the
workspace; the engine gets a summary of the others (`src/engine/project.ts`, `projectContext`), so:

- `pet{…}` and `game_state.Playing` from another file become blocks and are checked;
- a name defined in two files is an error (they share one module);
- style rule 6.2 doesn't suggest `<private>` for members another file uses, and
  "Rename everywhere" isn't offered for names other files use (it would only reach this file).

Leaving a file works like leaving the Text view: typed text is turned into blocks first, and if it
can't be, you're asked before it is replaced. Undo history is per visit to a file. Templates open as
their own file.

**Share codes** (`VB3:…`) hold every file, the open tabs and the project's name; older `VB2:` codes
still load as a one-file project, and older saved work becomes the project's first file.

## Look (appearance settings)

**Block look → Like text** (the default) makes blocks look like the Text view: the code font at the
code size, compact rows, blocks drawn as tinted outlines in their category colour, a line-number
gutter beside the blocks that matches the Text view's line numbers, and the same left and top edges.
**Classic** gives solid blocks. **Block words** can switch from the friendly wording (default) to
Verse wording (`src/engine/code-labels.ts`); both look and words apply after a reload, and neither
changes the generated code.

The palette icon on the right activity bar opens the **Look** panel (`src/ui/appearance.ts`).
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
changed, **JSON** edits every setting as JSON, and **Inspect** lets you click any part of the app
(a block, a word of code, a bar) to jump to the colour that paints it.

Settings become CSS variables (`src/styles/appearance.css`: `--ui-scale`, `--code-size`,
`--code-lh`, `--radius-scale`, `--space`, colours) and a Blockly theme; block colours go through
the engine's `setColourOverrides`.

## Phones, tablets and big screens

- **Making room** (`src/ui/layout.ts`): the editor needs at least 720 px in Split view (420 px in
  Blocks or Text). If the open panels leave less, the right panel floats over the editor (and the
  left one too if even 420 px is not left). Your saved layout isn't changed; widen the window and
  they dock again.
- **Split direction** follows the workspace's shape: blocks and code stack only when the workspace
  is narrow *and* tall (so phones in landscape get them side by side).
- **Tablets and phones** (≤ 900 px): the activity bars become a bottom tab bar (Files, Toolbox,
  Learn, Look) and a panel opens as a sheet from the bottom; tap outside it or its tab to close.
  The top bar keeps the logo, Share and ⋯; the status bar keeps its icons.
- **Touch screens**: buttons, tabs, categories and dividers are at least 44 px.
- **Short screens** (≤ 500 px tall, e.g. landscape or 200% zoom): tighter spacing, taller sheets.
- `src/styles/responsive.css` holds the size and input rules.

To check every size after a change, see *Checking every screen size* in
[Development](development.md#checking-every-screen-size).
