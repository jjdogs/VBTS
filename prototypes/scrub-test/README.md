# Scrub test

A UEFN test for the Pizza path's dish-washing minigame. A fixed camera looks at the dish; while the
player holds left click, the sponge follows the mouse across the dish like a cursor (mouse up moves
it up the dish, mouse right moves it right), and the camera drifts a little with the sponge, like
your head following your hand. Rubbing the sponge over a grime spot cleans it. Everything
it uses is in the Fortnite 42.30 digests, and none of it is experimental.

**How it works.** Verse can't attach a prop to the player's hand or read the mouse directly, but it
can read where the player is looking (`GetViewRotation`) and whether fire (left click) is held (the
`WeaponPrimary` input events). Moving the mouse turns the view, so every frame the device checks how
far it turned and moves the sponge by that much, using the camera's direction so that "up" on the
screen is "up" on the dish. Each grime spot keeps count of how much it has been rubbed.

**Results so far:** holding fire and moving the mouse works (the circle version cleaned the grime).
The sponge didn't move in that version because it was teleported inside the dish (fixed). The fixed
camera wasn't tested properly yet; this version needs it.

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
6. **The camera**: place a **Fixed Point Camera** (Fortnite → Devices) where the player's head
   would be, looking down at the dish. Right-click it → *Pilot* to aim it, then *Eject*.
7. **The device**: drag `scrub_test_device` into the level. In its Details panel set **SinkZone**,
   **Camera**, **Dish**, **Sponge**, and add the 3 grime props to **GrimeLayers** (+, then pick each).
8. **Launch Session**, walk into the zone, hold left click and move the mouse.

## What to try, and what to tell me

| Test | What to look for |
|---|---|
| 1. Camera | Does your view switch to the camera when you walk into the zone? |
| 2. Sponge moves | Holding left click and moving the mouse: does the sponge move? The debug line shows `view turned …°`: is it above 0 while you move? |
| 3. Directions | Does mouse up move the sponge away from you, and mouse right move it right? If not, tick **InvertUpDown** / **InvertLeftRight**. |
| 4. Cleaning | Rub over a grime spot: does it disappear after a while? Does "Sparkling clean!" appear at the end? |
| 5. Camera drift | Does the camera ease along with the sponge, leaning a little towards wherever the sponge is? Try **CameraFollow** (0.1 to 0.4) and **CameraSmoothing** (0.05 to 0.5). Set CameraFollow to 0.0 to compare with a still camera. |
| 6. Feel | Try **Sensitivity** (1 to 6) and **RubNeeded** (50 to 300). Too fast, too slow, too much rubbing? |

**If the view doesn't switch to the camera:** when the game starts, the device prints "Camera found
at (…)". If that says (0, 0, 0), the **Camera** slot isn't linked to the camera you placed: pick it
again in the device's Details panel. If it shows a real position but the view still doesn't switch,
open the camera's own Details panel and look for a priority option (raise it) or options about which
players it applies to, and tell me what's there.

**With the camera on, the mouse doesn't move the sponge** (tested): the fixed camera locks the
player's view, so the mouse no longer turns it. Two ways round it; the debug line shows `mouse …`
and `walk …` so you can see which one is working:

1. **Walking** (on by default, **MoveByWalking**): hold left click and walk (WASD or the stick). The
   sponge moves the way you walk; your character stays on its spot. Let go and walk away to leave.
   Tune **WalkSensitivity** (0.2 to 1.0).
2. **Mouse, through Third Person Controls**: place a **Third Person Controls** device, set it as
   **Controls** on `scrub_test_device` and tick **UseControls**. In its own Details panel, look for
   a setting that makes the character face or aim at the mouse cursor, and turn it on. If the
   `mouse` number goes above 0 while you move the mouse, the mouse works with the camera.

**If it doesn't build**, copy the whole error list from the Output Log and send it to me.

## What it decides

- Whether close-up "station" minigames (a fixed camera on the work) are possible, or minigames use
  the player's own view.
- Whether the sponge-as-cursor feels good enough to reuse for spreading sauce, placing toppings and
  stirring dough.
