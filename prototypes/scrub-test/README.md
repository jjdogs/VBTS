# Scrub test

A UEFN test for the Pizza path's dish-washing minigame. At the sink a **fixed camera looks straight
down at the dish** and the mouse cursor appears. **Grab the sponge** with the cursor and drag it
over the dish. Rubbing the sponge over a grime spot cleans it. Everything it uses is in
the Fortnite 42.30 digests, and none of it is experimental.

**How it works.** A small hint is added to the player's screen in UI mode, which shows the mouse
cursor and sends pointer input to Verse. While the player clicks or drags, the `PointerSelect` input
gives the cursor's position on the screen. Pressing only picks the sponge up if the cursor is on (or
near) it, and the sponge keeps the spot you grabbed it by under the cursor. `DeprojectViewportToWorld` turns that into a ray from the
camera through the cursor, and the device finds where the ray crosses the flat surface that faces the
camera through the sponge's starting spot: that's where the sponge goes, so it moves up/down and
left/right on screen whatever angle the camera and dish are at. Each grime spot keeps count of how much it has been rubbed.

**Results so far**

| Version | Result |
|---|---|
| Draw circles, no camera | ✅ Holding fire and moving the mouse cleaned the grime |
| Sponge follows the view, no camera | ✅ Sponge moves, cleaning works |
| Sponge follows the view, fixed camera | ❌ The fixed camera locks the view, so the sponge can't follow it |
| Drag with the cursor, fixed camera | ✅ Pointer reaches Verse and moves the sponge, but across the floor (forward/back), not up/down |
| Drag with the cursor, sponge moves across the screen | ✅ Works: the sponge follows the cursor up/down and left/right, and cleaning works |
| Leaving | ❌ Cursor stuck after leaving; then, after removing the mappings, you could look but not move |
| **Grab the sponge to drag it, Done to leave** (this version) | ✅ Works: grab and drag, leaving with Done, and moving again afterwards. **Done: this is the dish-washing pattern.** |

## Set up (about 10 minutes)

1. **Verse file**: in UEFN, **Verse → Verse Explorer**, right-click your project → *Add new Verse
   file to project* → *Verse Device*, name it `scrub_test_device`, and replace its contents with
   [`scrub_test_device.verse`](scrub_test_device.verse). **Verse → Build Verse Code**.
2. **The sink**: place a counter or sink, and a **Button** device on it (Fortnite → Devices). In
   the Button's options, set its interaction text to something like "Wash dishes".
3. **The dish**: place something flat (a plate, tray or small table top) on the sink.
4. **The sponge**: place a small prop in the **middle** of the dish, just in front of it (on the
   camera's side), not touching it. It moves across the screen from there: cursor up/down moves it
   up/down, left/right moves it left/right, never towards or away from the camera.
5. **Grime**: place a few small, flat, dirty-looking props on the dish in different places.
6. **The camera**: place a **Fixed Point Camera** (Fortnite → Devices) above the dish, looking
   straight down at it. Right-click it → *Pilot* to aim it, then *Eject*.
7. **The device**: drag `scrub_test_device` into the level. In its Details panel set **SinkButton**,
   **Camera**, **Dish**, **Sponge**, and add the grime props to **GrimeLayers** (+, then pick each).
8. **Launch Session**, interact with the sink button (E), then press on the sponge and drag it.

**Leaving**: click **Done** (top right). It also ends by itself a moment after the dish is sparkling
clean. (Esc and Space didn't work while the cursor shows, so they're gone.) Interacting again on a clean dish puts the grime back.

## What to try, and what to tell me

| Test | What to look for |
|---|---|
| 1. Camera and cursor | Does the view switch to the camera, and does the mouse cursor appear with the hint at the bottom? |
| 2. Pointer | When you click or drag, does `pointer at (…, …)` appear? Do the numbers change as you drag? |
| 3. Sponge | Does pressing on the sponge pick it up, and pressing away from it do nothing? Does it stay under the cursor where you grabbed it? If grabbing is hard, raise **GrabReach**. |
| 4. Cleaning | Rub over a grime spot: does it disappear after a while? Does "Sparkling clean!" appear at the end? |
| 5. Feel | Try **RubNeeded** (50 to 300) and **DishRadius**. Too much rubbing, too little? |
| 6. Leaving | After **Done**, and after finishing a dish: can you look around **and move and jump**? Can you wash again? |

If `pointer at` never appears when you click, the pointer input isn't reaching Verse: tell me, and
what (if anything) happens on screen when you click.

**If it doesn't build**, copy the whole error list from the Output Log and send it to me.

## What we learned

- **Close-up minigames work.** A fixed camera on the work, the mouse cursor shown (a widget added
  with `InputMode := ui_input_mode.All`), and `PointerSelect` + `DeprojectViewportToWorld` let the
  player drag a prop exactly under the cursor. This is the pattern for the Pizza path's prop
  minigames (scrubbing, spreading sauce, placing toppings, stirring).
- A **fixed camera locks the player's view**, so anything that reads `GetViewRotation` stops
  working under it. Without a camera, holding fire and turning the view works too.
- A camera device must be **enabled** (`Enable()`) before `AddTo` does anything.
- **Undo everything when the minigame ends**: the camera, the widget *and* the input mappings
  (`RemoveInputMapping`). Leaving the mappings on kept the cursor stuck after leaving. But only
  remove mappings you added: `TraversalMapping` is the player's own (moving, jumping), and adding
  then removing it left the player unable to move.
- While the cursor shows (`ui_input_mode.All`), **Esc and Space don't reach Verse**: use a button.
- Verse **can't change the cursor's look or position** (nothing in the digests does). A prop's spot
  is its **pivot**, which may be a corner of the mesh, not its middle.
- A prop **can't be teleported into another prop**: keep the moving prop a little in front.
- Verse gotchas met on the way (worth warnings in Verse Blocks): a local named like an imported
  module (`UI`), `vector3` being ambiguous once both SpatialMath modules are imported, and a
  function without `<transacts>` used inside an `if` condition.

## What it decided

- Whether prop minigames can use a close-up camera with the mouse cursor (drag to act): scrubbing,
  spreading sauce, placing toppings, stirring dough.
