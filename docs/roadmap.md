# Roadmap

[← Back to the README](../README.md)

Every phase ships the same way: blocks that write real Verse, a Learn explanation for each, text →
blocks conversion, plain-English warnings, tests, and **lessons and a template** that use them.

## Where it stands

| | Phase | What it added |
|---|---|---|
| ✅ | 1. Core | Blocks, split view, the first lessons |
| ✅ | 2. Devices | `using` and modules, every Creative device, one-click fixes, share codes |
| ✅ | 3. Data | Arrays, maps, options, function inputs and results, `<decides>`; responsive UI; Look panel and the one-window editor |
| ✅ | 4. Structure | Your own classes, structs and enums, access specifiers; several files per project |
| ✅ | 5. Game mechanics | Players and teams, eliminations, positions and movement, UI widgets ([plan](plans/phase-5.md)) |
| ✅ | 6. Text ⇄ blocks | Type directly in the Text view; it becomes blocks as you go |
| ✅ | API upkeep | Device data from Epic's reference every week; checked against Epic's API digests ([Verse API data](verse-api.md)); respawn, lobby, random decimals, shuffle, prop animation, events that send several values |

Today: 203 devices, 26 lessons, 4 templates (pop-up target gallery, team elimination,
moving-platform parkour, shop menu).

## Learning: the Pizza path (planning)

A second path after Basics: one **Pizza Restaurant Simulator** that grows from a small shop to a
franchise, chapter by chapter, with prop minigames. Every lesson ends on a publishable game. Chapter
1 is planned in [plans/pizza-path.md](plans/pizza-path.md); the phases below supply the blocks later
chapters need.

## Next

In the suggested order. Each is sized so it can be released on its own.

### 7. Lessons for the newest blocks (small)

The blocks added from the digests have no lessons yet, so learners only find them in the toolbox.

- Lessons: respawning at a checkpoint, a button popup with choices (events that send two values),
  a prop animated back and forth, random waits and shuffled targets.
- A **deathrun / obby** template: checkpoints, respawning, animated obstacles.

### 8. Waiting for things (small to medium)

Verse often *waits* for an event instead of subscribing to it, and blocks can't do that yet.

- **Await an event**: `Button.InteractedWithEvent.Await()` (and getting what it sent:
  `Agent := Button.InteractedWithEvent.Await()`).
- **Sleep for any value**: `Sleep(GetRandomFloat(1.0, 3.0))` (today it only takes a typed number).
- **More concurrency**: `rush` and `branch`, and `race` / `sync` with more than two branches.
- Lessons: "first to press wins" (race + Await), a countdown that waits for players.

### 9. Saving progress (medium to large)

What creators ask for most after the basics: keeping a player's stats between games.

- **Persistent data**: a `<persistable>` class or struct of stats, and a module-level
  `var PlayerData:weak_map(player, player_stats) = map{}`, read and updated per player.
- **Round-wide values** with `session` (`GetSession()`), Verse's way of making global variables.
- Clear warnings for the rules UEFN enforces (only persistable types, update by replacing).
- Template: a small **tycoon / clicker** that remembers each player's coins.

### 10. Props and spawning (medium)

- **Spawn props** from an `@editable` `creative_prop_asset` (`SpawnProp`, which can fail and
  returns why), and remove them (`Dispose`).
- **Change props**: show and hide, swap the mesh or material, and turn damage on or off
  (`CanBeDamaged`).
- **Physics**: velocity, impulses and forces on physics props.
- Template: a **target range** that spawns targets at random spots.

### 11. More UI (medium)

- **Layouts**: `stack_box` (a row or column of widgets) and `overlay` (widgets on top of each other).
- **More widgets**: `slider_regular`, `color_block`, `texture_block` (images), `button_quiet`.
- Updating and removing widgets, and a per-player **scoreboard** pattern.
- Template: a **round HUD** with a timer and team scores.

## Later

- **Scene Graph**: Epic's newer entities and components (`/Verse.org/SceneGraph`). Worth adding once
  learners' projects use it; it changes how props are moved and built.
- **`/Verse.org/SpatialMath`**: Epic is moving `vector3` and `rotation` here from
  `/UnrealEngine.com/Temporary/SpatialMath`. Switch when devices take the new types (the digest test
  will show it).
- **VS Code extension**: on hold; web-only for now.

## Small fixes

- The [known quirks](blocks-and-verse.md#known-quirks): duplicate pieces in the conversion report's
  raw list, and a lone end-of-line comment on a class's first line being dropped.
