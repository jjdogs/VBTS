# Plan: the Pizza path

[← Back to the roadmap](../roadmap.md)

A second learning path after Basics. Over the whole path the learner builds one game, a **Pizza
Restaurant Simulator**, that grows from a small shop into a franchise. Each chapter is a release
of that game, and each lesson ends on a version that could be published as it is; what the next
lesson adds is an "update".

Status: **chapter 1 in progress.** Lessons 1 and 2 are drafted for testing in UEFN (lesson 1 now uses a widget HUD; lesson 2 will follow once it works) ([lesson 1](../../prototypes/pizza-lessons/1-grand-opening/README.md), [lesson 2](../../prototypes/pizza-lessons/2-customer-orders/README.md)); nothing is in the app yet.

## Rules for every lesson

Each lesson is written to this contract, and is not shipped until it's been played in UEFN.

| Part | What it says |
|---|---|
| **You'll have** | The game at the end, in one sentence a player would understand |
| **Publishable because** | Why it's a whole game on its own: a goal, a way to play it, and an end or a loop |
| **New Verse** | The ideas taught (at most 2 new ones), with the blocks for them |
| **In UEFN** | Every device and prop to place, and every option to set, in order |
| **Steps** | Small steps, each one testable: "Launch Session: you should see…" |
| **Time** | How long it takes, aimed at 20–40 minutes |
| **Next update** | One line: what the next lesson adds, and why players would want it |

- **Choices**: learners pick the shop name, the menu names and the toppings. Everything else is
  set, so every lesson's steps work for everyone.
- **Basics first, but not required**: each lesson lists the Basics lessons it builds on. If a
  learner skipped them, the lesson teaches the idea itself, in the pizza theme, in a "New to
  this?" box.
- **Blocks only**: every step can be done with blocks. Where a lesson needs a block Verse Blocks
  doesn't have yet, it's listed under *New blocks needed*, and the lesson waits for them.

## Chapter 1: The little shop (a medium release)

One player, one counter, one oven. By the end it's a short round-based game: serve as many correct
pizzas as you can before closing time.

### 1. Grand opening

- **You'll have**: a pizza clicker. Press the oven to bake a pizza; each pizza earns coins, shown on
  screen with your shop's name.
- **Publishable because**: it's a complete clicker: one action, a score that goes up.
- **New Verse**: a device with `@editable` buttons; a `var` for coins, `set` and text with `{Coins}`
  in it. (Basics: *Wire up a button*, *Three strikes*.) **New in UEFN**: a shop HUD designed in the
  widget editor (`WBP_ShopHUD`, with message variables bound to its Text Blocks), shown and
  updated from Verse.
- **In UEFN**: a counter and an oven (any props), a **Button** on the oven ("Bake"), the
  `WBP_ShopHUD` widget blueprint.
- **Choice**: the shop's name, and how the HUD looks.
- **Why a widget, not a HUD Message device**: the first draft's HUD Message device showed nothing,
  and widgets are how UEFN games really build HUDs, so learners get used to the widget editor early.
- **Next update**: customers who want something specific.

### 2. Customers have orders

- **You'll have**: a customer order appears ("Pepperoni, please!"). Topping buttons add toppings;
  baking at the oven serves it. Right: coins and a tip. Wrong: no coins, and the order stays.
- **Publishable because**: it's a matching game with a goal for every order.
- **New Verse**: an array of toppings and a random pick from it; comparing and `if`/`else`.
  (Basics: *Lists of things*, *Target timer*.)
- **In UEFN**: one **Button** per topping (3); the oven's Button now serves.
- **Choice**: the three toppings. (Menu names, like "The Classic", come in a later lesson: one
  more array to keep in step would make this one too big.)
- **Next update**: you can see the pizza you're building.

### 3. Build the Pizza

- **You'll have**: the pizza on the counter shows each topping as you add it (topping props
  appear on it), in order: dough, sauce, cheese, then toppings. Serving clears it for the next one.
- **Publishable because**: the same game, now something you can see and get right step by step.
- **New Verse**: an enum for the pizza's stage (`dough`, `sauce`, `cheese`, `toppings`); showing and
  hiding props. (Basics: *Game states*.)
- **In UEFN**: a pizza base prop, and one prop per topping placed on it (hidden at the start).
- **Next update**: a clock, so there's pressure.

### 4. Rush hour

- **You'll have**: a round. The shop opens, orders come in faster and faster, each one with a
  timer; closing time ends the round and shows how many pizzas you served. Play again from the
  start.
- **Publishable because**: it now has a start, rising difficulty and an end screen: a full
  arcade round.
- **New Verse**: `spawn`, `loop` and `Sleep` for the order clock; `race` for "served before the
  timer runs out". (Basics: *Take a breath*, *Target timer*.)
- **In UEFN**: a **Timer** device for closing time, an **End Game** device (or a scoreboard).
- **Next update** (chapter 2): coins that buy upgrades, and coins that are still there next time.

**Chapter 1 release** = these 4 lessons and a **Little Shop** template (the finished lesson 4).

## Later chapters (outline, planned in detail one chapter at a time)

| Chapter | The game grows into | Minigames | Needs (roadmap) |
|---|---|---|---|
| 2. Busy shop | Upgrades (faster oven, more toppings), dirty dishes to wash before plates run out, coins kept between games | **Wash up** (the scrub test), **Organize the shelves** (sorting) | Saving progress (9), the cursor-and-camera minigame blocks |
| 3. Restaurant | A bigger room, tables, customers who wait and leave, a second player as a helper | **Timing** (pull it out of the oven at the right moment), **Rush** (several orders at once) | Props and spawning (10), Waiting for things (8) |
| 4. Franchise | Several shops, managers, a menu board you design | Menu design (choices), a delivery run | More UI (11) |

## New blocks needed

What chapter 2's minigames need, proven in the [scrub test](../../prototypes/scrub-test/README.md):

- Show the mouse cursor (a widget added with `InputMode := ui_input_mode.All`) and remove it again.
- Player input: add and remove an input mapping; react to `PointerSelect` (pressed, dragged, let go).
- Turn a point on the screen into the world (`DeprojectViewportToWorld`).
- Add and remove a camera (`AddTo`, `RemoveFrom`, `Enable`).

For chapter 1, **your own widgets** (lesson 1 onwards): a widget blueprint's type (an array of
them, `WBP_ShopHUD{}` to make one) and setting one of its message variables
(`set ShopHUD.Coins = MakeMessage(…)`). Everything else in chapter 1 has blocks today.

## Basics: trimmed to about 15

To plan after chapter 1, so Basics teaches exactly what the Pizza path builds on. Each Basics lesson
will follow the same contract, ending on a small game of its own.
