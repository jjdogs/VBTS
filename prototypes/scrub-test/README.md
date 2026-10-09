# Scrub test

A quick UEFN test for the Pizza path's dish-washing minigame: can a player "scrub" a dish by moving
the mouse in circles, and does it feel good? Everything it uses is in the Fortnite 42.30 digests,
and none of it is experimental, so it would also work in a published island.

**How it works.** Verse can't attach a prop to the player's hand or read the mouse directly, but it
can read where the player is looking (`GetViewRotation`) and whether fire (left click) is held (the
`WeaponPrimary` input events). Moving the mouse turns the view, so 20 times a second the device
checks which way the view moved. Moving in a circle makes that direction turn all the way round:
each full turn is one scrub. Every few scrubs, one grime prop on the dish disappears, and the
sponge prop moves around the dish as you scrub.

## Set up (about 10 minutes)

1. **Verse file**: in UEFN, **Verse → Verse Explorer**, right-click your project → *Add new Verse
   file to project* → *Verse Device*, name it `scrub_test_device`, and replace its contents with
   [`scrub_test_device.verse`](scrub_test_device.verse). **Verse → Build Verse Code**.
2. **The sink**: place a counter or sink, and a **Mutator Zone** covering where the player stands
   in front of it.
3. **The dish**: place a plate (any gallery prop, e.g. a round table top or plate) on the sink.
4. **The sponge**: place a small prop (a cube scaled down, or a bar of soap) just *above* the dish,
   not touching it. It keeps that height while it moves; if it touches the dish it can't move.
5. **Grime**: place 3 thin, dirty-looking props on the dish (e.g. flattened brown or green
   shapes from the galleries).
6. **The device**: drag `scrub_test_device` from the Content Browser into the level. In its
   Details panel set **SinkZone**, **Dish**, **Sponge**, and add the 3 grime props to
   **GrimeLayers** (+ button, then pick each one).
7. Optional: place a **Fixed Point Camera** looking down at the dish and set it as **Camera**.
8. **Launch Session**, walk into the zone, hold left click and move the mouse in circles.

## What to try, and what to tell me

| Test | Settings | What to look for |
|---|---|---|
| 1. Basic | defaults | Do "Circle 1, 2, 3…" messages appear when you circle? Does a grime layer vanish every 3 circles? |
| 2. Holding | defaults | Does "Fire held" appear when you hold left click? If it never does, set **RequireHold** off and try again. |
| 3. Camera | **UseCamera** on | With the fixed camera, do circles still count? (The camera may stop the view from turning.) |
| 4. Feel | try **MinSpeed** 0.2 to 1.0, **CirclesPerLayer** 1 to 5 | Which numbers feel best? Too easy, too hard, too slow? |
| 5. Sponge | defaults | Does the sponge follow the scrubbing in a way that looks right? |

The on-screen numbers (`speed …  circle …%`) show how fast you're moving and how far round the
current circle you are; turn **ShowDebug** off to hide them.

**If it doesn't build**, copy the error from the Output Log (the line number and message) and send
it to me.

## What it decides

- If circles are detected reliably, the Pizza path can have prop minigames that use the mouse:
  scrubbing dishes, spreading sauce, stirring dough.
- Whether holding fire works decides if minigames can use "hold to do it".
- Whether the fixed camera keeps turning decides if minigames get a close-up camera, or use the
  player's own view.
