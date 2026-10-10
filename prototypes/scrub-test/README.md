# Scrub test

A UEFN test for the Pizza path's dish-washing minigame. At the sink the player sees through a
**first-person camera**, looking at the dish. While they hold left click, the sponge follows the mouse
across the dish like a cursor (mouse up moves it up the dish, mouse right moves it right), and the
view turns with it. Without left click, the mouse looks around as usual. Rubbing the sponge over a
grime spot cleans it. Everything it uses is in the Fortnite 42.30 digests, and none of it is
experimental.

**How it works.** Verse can't attach a prop to the player's hand or read the mouse directly, but it
can read where the player is looking (`GetViewRotation`) and whether fire (left click) is held (the
`WeaponPrimary` input events). Moving the mouse turns the view, so every frame the device checks how
far it turned and moves the sponge by that much, in the direction the player faces. Each grime spot
keeps count of how much it has been rubbed.

**Results so far**

| Version | Result |
|---|---|
| Draw circles, no camera | ✅ Holding fire and moving the mouse cleaned the grime |
| Sponge as a cursor, no camera | ✅ Sponge moves, cleaning works |
| Sponge as a cursor, **fixed** camera | ❌ The fixed camera locks the view, so the mouse can't move the sponge |
| Sponge as a cursor, **first-person** camera | To test: the view can turn, so the sponge should move |

## Set up (about 10 minutes)

1. **Verse file**: in UEFN, **Verse → Verse Explorer**, right-click your project → *Add new Verse
   file to project* → *Verse Device*, name it `scrub_test_device`, and replace its contents with
   [`scrub_test_device.verse`](scrub_test_device.verse). **Verse → Build Verse Code**.
2. **The sink**: place a counter or sink, and a **Mutator Zone** covering where the player stands
   in front of it.
3. **The dish**: place something flat (a plate, tray or small table top) on the sink.
4. **The sponge**: place a small prop just *above* the dish, not touching it. It keeps that height
   while it moves; if it touches the dish it can't move.
5. **Grime**: place 3 small, flat, dirty-looking props on the dish in different places (squash
   them with the Scale tool, R).
6. **The camera**: place a **First Person Camera** device (Fortnite → Devices) anywhere; where it
   sits doesn't matter, it uses the player's eyes.
7. **The device**: drag `scrub_test_device` into the level. In its Details panel set **SinkZone**,
   **Camera**, **Dish**, **Sponge**, and add the 3 grime props to **GrimeLayers** (+, then pick each).
   If you placed the Fixed Point Camera before, swap it for the First Person Camera.
8. **Launch Session**, walk into the zone, look down at the dish, hold left click and move the mouse.

## What to try, and what to tell me

| Test | What to look for |
|---|---|
| 1. Camera | Does the view switch to first person when you walk into the zone ("First person camera added to you")? |
| 2. Sponge moves | Holding left click and moving the mouse: does the sponge move? The debug line shows `view turned …°`: is it above 0 while you move? |
| 3. Directions | Does mouse up move the sponge away from you, and mouse right move it right? If not, tick **InvertUpDown** / **InvertLeftRight**. |
| 4. Cleaning | Rub over a grime spot: does it disappear after a while? Does "Sparkling clean!" appear at the end? |
| 5. Feel | Try **Sensitivity** (1 to 6) and **RubNeeded** (50 to 300). Too fast, too slow, too much rubbing? Does the view turning while you scrub feel good? |

**If it doesn't build**, copy the whole error list from the Output Log and send it to me.

## What it decides

- Whether prop minigames use a close-up first-person view at a "station".
- Whether the sponge-as-cursor feels good enough to reuse for spreading sauce, placing toppings and
  stirring dough.
