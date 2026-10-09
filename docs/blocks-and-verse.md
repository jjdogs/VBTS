# Blocks and Verse

[← Back to the README](../README.md)

What the blocks cover, how the Verse they write is checked, and what the Text view turns back
into blocks.

- [Verse style](#verse-style)
- [Your own types](#your-own-types)
- [Players, movement and UI](#players-movement-and-ui)
- [Devices](#devices)
- [What text → blocks understands](#what-text--blocks-understands)
- [Known quirks](#known-quirks)

## Verse style

Generated code follows Epic's Verse style guide ("Programming with Verse", sections 0–12):
four-space indents, `Name:type = value`, a space before `=` in signatures (`Sqr(X:int):int =`),
`@editable` on its own line, `<decides><transacts>` for failable functions, and lower_snake_case
type names with PascalCase for everything else.

`src/engine/style.ts` checks the names you type and shows gentle **Style** notices (never errors),
each citing its guide section: PascalCase names (2.3), a lower_snake_case device class (2.1),
`IsX` logic variables (1.1), `OnX` handlers (7.1), no `Async` suffix (8.1), no `_type` / `_class`
/ `_t` decorations (1.2, 2.4), not mixing `return` with an implicit result (4.1), and `<private>`
for members nothing outside their class uses (6.2). Naming notices offer **Rename everywhere**.

## Your own types

The **Types** category makes classes (`pet := class:`, with a parent: `cat := class(pet):`,
specifiers `<concrete>` `<unique>` `<final>` `<abstract>`), structs and enums. They sit next to the
device (they're file-level) and are written before it. Fields can be any type with an optional
starting value (`var MyPet:pet = pet{Name := "Scout"}`); methods are functions inside the class.
Blocks make objects (`pet{Name := …}`, checked against the class's fields), read and set fields,
call methods, use enum values (`game_state.Playing`) and `Self`. Members and functions can be
`<private>`, `<protected>`, `<internal>` or `<public>`. Style rule 6.2 suggests `<private>` only
for members nothing outside the class uses, with a one-click fix.

## Players, movement and UI

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
  player, elimination results and a character's agent, health and shield.
- **Players**: respawning an agent at a position (`Agent.Respawn(…)`) and sending a player to the
  lobby (`Player.SendToLobby()`).
- **Movement**: positions (`vector3`), rotations, where things are (`GetTransform()`), distances,
  teleporting and moving props over time; `creative_prop` can be linked. Prop animation
  (CreativeAnimation): a prop's animation controller, a keyframe move played once or back and
  forth, and play / pause / stop.
- **Random**: random whole numbers and decimals (`GetRandomFloat`), and shuffling an array.
- **UI**: a player's UI, text and button widgets on a canvas at a preset position, clickable
  widgets, changing text, hiding, and who clicked.

Each has a toolbox category (Teams, Movement, UI, plus additions to Player, Math and Events),
lessons 18–26 and a template (team elimination, moving-platform parkour, shop menu). The plan they
were built from is in [Phase 5 plan](plans/phase-5.md).

## Devices

Linked devices (`@editable`) can be any of the 203 Creative devices, with their events and actions.
Picking a device fills the event and action dropdowns, and a handler's input is checked against
what the event sends. Patchwork music devices add their own `using` line. Where this data comes
from, and how it is kept current: [Verse API data](verse-api.md).

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
- **Handler inputs** are renamed to the names blocks use (`OnChoice(Who:agent, Button:int)` becomes
  `OnChoice(Agent:agent, Value:int)`), and the conversion report says so.

Anything else is kept word for word in a raw Verse block, so nothing is lost.

## Known quirks

Left as-is during the TypeScript move, to be fixed deliberately later:

- When a value can't be converted and falls back to raw Verse, part of it can appear twice in the
  conversion report's raw list. Harmless; the generated code is unaffected.
- A comment at the end of a code line is kept on that line's block (its comment bubble) and written
  back at the end of the line. Only one on a line with no block of its own (like a class's first
  line) is dropped, and the conversion report says so.
- The Sleep block takes a typed number, so `Sleep(GetRandomFloat(1.0, 3.0))` stays raw Verse (it
  still works).
