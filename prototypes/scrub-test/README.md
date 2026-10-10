# Scrub test

A UEFN test for the Pizza path's dish-washing minigame. At the sink a **fixed camera looks straight
down at the dish** and the mouse cursor appears. **Click and drag**: the sponge goes wherever the
cursor points on the dish. Rubbing the sponge over a grime spot cleans it. Everything it uses is in
the Fortnite 42.30 digests, and none of it is experimental.

**How it works.** A small hint is added to the player's screen in UI mode, which shows the mouse
cursor and sends pointer input to Verse. While the player clicks or drags, the `PointerSelect` input
gives the cursor's position on the screen. `DeprojectViewportToWorld` turns that into a ray from the
camera through the cursor, and the device finds where the ray reaches the dish: that's where the
sponge goes. Each grime spot keeps count of how much it has been rubbed.

**Results so far**

| Version | Result |
|---|---|
| Draw circles, no camera | ✅ Holding fire and moving the mouse cleaned the grime |
| Sponge follows the view, no camera | ✅ Sponge moves, cleaning works |
| Sponge follows the view, fixed camera | ❌ The fixed camera locks the view, so the sponge can't follow it |
| **Drag with the cursor, fixed camera** (this version) | To test |

## Set up (about 10 minutes)

1. **Verse file**: in UEFN, **Verse → Verse Explorer**, right-click your project → *Add new Verse
   file to project* → *Verse Device*, name it `scrub_test_device`, and replace its contents with
   [`scrub_test_device.verse`](scrub_test_device.verse). **Verse → Build Verse Code**.
2. **The sink**: place a counter or sink, and a **Mutator Zone** covering where the player stands
   in front of it.
3. **The dish**: place something flat (a plate, tray or small table top) on the sink.
4. **The sponge**: place a small prop just *above* the dish, not touching it. It keeps that height
   while it moves; if it touches the dish it can't move.
5. **Grime**: place a few small, flat, dirty-looking props on the dish in different places.
6. **The camera**: place a **Fixed Point Camera** (Fortnite → Devices) above the dish, looking
   straight down at it. Right-click it → *Pilot* to aim it, then *Eject*.
7. **The device**: drag `scrub_test_device` into the level. In its Details panel set **SinkZone**,
   **Camera**, **Dish**, **Sponge**, and add the grime props to **GrimeLayers** (+, then pick each).
8. **Launch Session**, walk into the zone, then click and drag on the dish.

## What to try, and what to tell me

| Test | What to look for |
|---|---|
| 1. Camera and cursor | Does the view switch to the camera, and does the mouse cursor appear with the hint at the bottom? |
| 2. Pointer | When you click or drag, does `pointer at (…, …)` appear? Do the numbers change as you drag? |
| 3. Sponge | Does the sponge go to where the cursor is on the dish? Is it under the cursor, or off to one side? |
| 4. Cleaning | Rub over a grime spot: does it disappear after a while? Does "Sparkling clean!" appear at the end? |
| 5. Feel | Try **RubNeeded** (50 to 300) and **DishRadius**. Too much rubbing, too little? |

If `pointer at` never appears when you click, the pointer input isn't reaching Verse: tell me, and
what (if anything) happens on screen when you click.

**If it doesn't build**, copy the whole error list from the Output Log and send it to me.

## What it decides

- Whether prop minigames can use a close-up camera with the mouse cursor (drag to act): scrubbing,
  spreading sauce, placing toppings, stirring dough.
