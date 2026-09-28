# Phase 5 plan: players & teams, UI widgets, positions and movement

Status: **5.0 foundations done**; 5.1–5.3 next, in the order below.

## Goal

After Phase 5, a learner can build the kinds of game modes UEFN creators actually make:
- react to players joining, leaving and being eliminated;
- split players into teams and score per team;
- show their own on-screen UI (text and buttons, per player);
- read and change positions: teleport players, move props, measure distances.

Everything stays in the Verse Blocks style: each block writes real Verse, each has a Learn
explanation, text converts back into blocks, and mistakes get a plain-English warning.

The API names below come from Epic's Verse API digest (the mirror that
`scripts/extract-devices.py` already uses). Module paths are the ones in that digest; recheck
them against UEFN when building, because Epic moves modules between versions. For example,
SpatialMath may move from `/UnrealEngine.com/Temporary/SpatialMath` to `/Verse.org/SpatialMath`.

## What's missing today (and blocks all three areas)

Phase 5 needs a few general features first. Without them most new code would end up as
raw Verse.

| Gap | Today | Needed for |
|---|---|---|
| **Local values** inside functions: `Position := Char.GetTransform().Translation`, `var Count:int = 0` | kept as raw Verse | everything: positions, UI widgets, teams |
| **Handlers that receive other types**: `player`, `elimination_result`, `widget_message`, `damage_result` | a handler receives only `agent`, `?agent` or nothing | playspace, elimination and button events |
| **Events that aren't device fields**: `GetPlayspace().PlayerAddedEvent().Subscribe(…)`, `Char.EliminatedEvent().Subscribe(…)`, `Button.OnClick().Subscribe(…)` | only `Device.SomeEvent.Subscribe(…)` | the same |
| **More value types**: `player`, `team`, `fort_character`, `vector3`, `rotation`, `transform`, widgets | int, float, logic, string, agent, player | fields, maps, options, function inputs |
| **Failable casts**: `player[Agent]`, `fort_character[…]` | none | turning an agent into a player (needed for UI) |
| **Method chains on values**: `Char.GetTransform().Translation` | kept as raw Verse | positions |
| **Device actions with inputs**: `SetTextSize(Size:int)`, `Teleport(Agent)` | only actions with no inputs or one agent | many devices |

## Milestones

### 5.0 Foundations — ✅ done

What was built (tests in `tests/phase5.test.ts`):
- `verse_local` (Variables): `Name := value`, `Name:type = value`, `var Name:type = value`, with
  `set` checks and container reads for locals.
- New value types (`team`, `fort_character`, `vector3`, `rotation`, `transform`, plus handler and
  UI types) with their using lines, also inside containers and function inputs. Maps can hold
  any value type.
- `verse_cast` (Player): `player[Agent]`; "if it exists" makes the name (e.g. `Player`)
  available inside.
- Handlers receive agent, ?agent, nothing, player, elimination, damage, button click or AI result
  (`data/handlers.ts`). Subscribed handlers of the new types are converted and their input renamed.
- `verse_subscribe_event` + `verse_playspace` (Events): `GetPlayspace().PlayerAddedEvent()`,
  `FortChar.EliminatedEvent()`, `Button.OnClick()`…, with the same handler checks and fix.
- `verse_device_action` (Devices): 56 device actions with simple inputs from the regenerated
  catalog (`extract-devices.py` now keeps them, and every event payload type).

The original plan for 5.0:

1. **Local value block**: `Name := value` and `var Name:type = value` as statements. It
   declares a name for the rest of its stack. It's a new block in `blocks/variables.ts`, and
   `workspace.ts` learns block-scoped names so `verse_get`/`verse_set` checks and dropdowns see
   them. Parser rule in `parser/statements.ts`. *This alone turns a lot of today's raw Verse into
   blocks.*
2. **Typed handlers**: `verse_handler`'s PARAM becomes a type list: agent, ?agent, nothing,
   player, elimination_result, widget_message, damage_result.
   - The input name follows the type (`Agent`, `MaybeAgent`, `Player`, `Result`, `Message`).
   - `hasInScope` in `workspace.ts` grows accordingly.
   - The subscribe check (`PARAM_FOR` in `blocks/events.ts`) maps each event's payload type to
     the handler type.
   - The device catalog already records payloads; extend `extract-devices.py` to keep all of
     them, not just agent/?agent/tuple.
3. **Event sources**: one "subscribe" block whose source can be a linked device (as today), the
   playspace, a character value or a widget value. It writes `Source.Event().Subscribe(Handler)`
   for function-style events and `Source.Event.Subscribe(Handler)` for field-style ones. Keep
   the current block's saved format so old projects load.
4. **Value types and modules**: add the new types to `data/verse-types.ts`
   (`VALUE_TYPES`, `moduleForType`), so declaring them adds the right `using` line:
   - `team` → `/Fortnite.com/Teams`
   - `fort_character` → `/Fortnite.com/Characters`
   - `vector3`, `rotation`, `transform` → SpatialMath
   - `canvas`, `widget` → `/UnrealEngine.com/Temporary/UI`
   - `text_block`, `button_loud` → `/Fortnite.com/UI`
5. **Cast block** "if Agent is a player": `if (Player := player[Agent]):`. This is a failable
   value that fits the existing "if it exists" rules (`inFailureContext`).
6. **Device actions with inputs**: extend `extract-devices.py` to keep actions with simple
   inputs (int, float, logic, string, agent). `verse_call_device` then shows one value slot per
   input, reusing the argument-slot code from `blocks/functions.ts` (`callInputs` /
   `updateArgs`).

Tests: each foundation gets a round-trip test (text → blocks → text unchanged) and a
warnings test. Golden output for existing projects must not change.

### 5.1 Players & teams

| Block | Verse | Notes |
|---|---|---|
| when a player joins / leaves | `GetPlayspace().PlayerAddedEvent().Subscribe(OnPlayerAdded)` | handler receives `player` |
| all players (value) | `GetPlayspace().GetPlayers()` | `[]player`, works with "for each" |
| team collection | `GetPlayspace().GetTeamCollection()` | usually stored in a local value |
| all teams | `Teams.GetTeams()` | `[]team` |
| player's team | `Teams.GetTeam[Agent]` | failable, so it goes in "if it exists" |
| players on a team | `Teams.GetAgents[Team]` | failable, `[]agent` |
| is on team | `Teams.IsOnTeam[Agent, Team]` | failable condition |
| move to team | `Teams.AddToTeam[Agent, Team]` | failable, so written as `if (…)` |
| when a character is eliminated | `Char.EliminatedEvent().Subscribe(OnEliminated)` | handler receives `elimination_result` |
| who was eliminated / who did it | `Result.EliminatedCharacter`, `Result.EliminatingCharacter?` | the second is an option |
| character health / shield | `GetHealth()`, `SetHealth(…)`, `GetShield()`, `SetShield(…)` | extends today's damage/heal block |

Checks: `GetTeam` and friends outside a failure context. A handler whose input doesn't match
the event (the existing rule, now for every type). Forgetting to subscribe each player's
character when they join (a tip).

Lesson ideas: "Welcome message for every player who joins", "Two teams: score per team with
a `[team]int` map", "Knockout counter using EliminatedEvent".

Template: **Team elimination**. Two teams; each elimination scores for the eliminator's team;
the first team to N wins (end_game_device).

### 5.2 Positions & movement

| Block | Verse | Notes |
|---|---|---|
| position value | `vector3{X := 0.0, Y := 0.0, Z := 0.0}` | the existing "make an object" block already builds structs; add a friendly preset |
| rotation from degrees | `MakeRotationFromYawPitchRollDegrees(Yaw, Pitch, Roll)` | |
| where is it | `Char.GetTransform().Translation`, `Prop.GetTransform()` | `transform` fields: Translation, Rotation, Scale |
| distance | `Distance(A, B)`, `DistanceXY(A, B)` | float |
| teleport a character | `if (Char.TeleportTo[Position, Rotation]):` | failable |
| move a prop over time | `Prop.MoveTo(Position, Rotation, Seconds)` | `<suspends>`, so it gets the existing Sleep-style check |
| linked prop | `@editable Door:creative_prop = creative_prop{}` | `creative_prop` joins the device list |

Checks: `MoveTo` outside suspending code (reuse `inSuspends`), TeleportTo outside a failure
context, and int/float mixing in vector parts (Verse needs `1.0`, not `1`).

Lesson ideas: "Teleport to the start pad" (position from a linked device's transform),
"Moving platform" (a loop of MoveTo), "Close enough" (Distance under 500.0 gives an item).

Template: **Moving-platform parkour**: props that move on loops, checkpoints that save each
player's position in a `[player]vector3` map, and falling below a Z height teleports you back.

### 5.3 UI widgets

UI is per player: `GetPlayerUI[Player]` is failable and needs a `player`, not an `agent`. That's
why the cast block from 5.0 comes first.

| Block | Verse | Notes |
|---|---|---|
| player's UI | `if (UI := GetPlayerUI[Player]):` | failable |
| text widget | `text_block{DefaultText := MakeMessage("…")}` | reuses the existing `MakeMessage` helper |
| button | `button_loud{DefaultText := MakeMessage("…")}` | also `button_regular` |
| canvas with slots | `canvas{Slots := array{canvas_slot{Widget := W, …}}}` | start with a few layout presets (top-left, centre, bottom) instead of raw anchors |
| show / hide | `UI.AddWidget(W)`, `UI.RemoveWidget(W)` | |
| change text | `W.SetText(MakeMessage(…))` | |
| when clicked | `Button.OnClick().Subscribe(OnClicked)` | handler receives `widget_message`; `Message.Player` is who clicked |

Checks: widgets stored per player (a `[player]canvas` map) instead of one shared field (a
tip), GetPlayerUI with an agent instead of a player (an error with a one-click "cast to player"
fix), and a missing `MakeMessage` (the generator already adds the helper).

Lesson ideas: "Show a HUD message only you can see", "A button that gives you an item",
"Live score text per player".

Template: **Shop menu**: a button opens a per-player canvas with buy buttons that use
item_granter devices and a coins map.

## Across all milestones

- **Toolbox**: new categories *Teams*, *Movement* and *UI*, each with its own colour (add to
  `COLORS`, the Appearance `BLOCK_CATEGORIES` and the code-view legend).
- **Explain panel**: every block gets `explain` text and a doc link, like today.
- **Parser**: every new block gets a statement or expression rule, and the round-trip test
  covers it automatically once it's in a template.
- **Multiple files (4.2)**: helper classes (e.g. a `player_data` class) can live in their own
  file. The templates above should show that: one file for the device, one for the data classes.
- **Style guide**: new names follow the existing checks (PascalCase handlers with `On…`, and
  so on). `OnPlayerAdded` and `OnEliminated` are the defaults.

## Order of work and size

| Step | Size | Why first |
|---|---|---|
| 5.0 local values | M | unlocks the most, and is useful already today |
| 5.0 typed handlers + event sources | L | needed by all three areas; saved-project compatibility matters here |
| 5.0 types, cast, device actions with inputs | M | |
| 5.1 players & teams + lesson + template | M | smallest area once the foundations exist |
| 5.2 positions & movement + lessons + template | M | |
| 5.3 UI widgets + lessons + template | L | most new concepts (per-player UI, messages, layout) |

Each step lands as its own PR with tests, and the site redeploys on merge.

## Open questions

1. **Canvas layout**: offer a few presets (top-left, centre, bottom) or full anchors and
   offsets? Presets are friendlier; raw Verse remains for anything else.
2. **Which SpatialMath module** to target, if Epic has moved it by the time we build: follow
   what UEFN's current template files use.
3. **Order of 5.2 and 5.3**: UI is the most requested for game modes but also the biggest; doing
   positions first keeps each step smaller.
