# Pizza lesson 1: Grand opening (draft, to test in UEFN)

Part of the [Pizza path](../../../docs/plans/pizza-path.md), chapter 1. Once it's been played in UEFN
and works, it goes into the app as a lesson.

| | |
|---|---|
| **You'll have** | A pizza clicker: bake pizzas at your shop's oven to earn coins. Reach 100 coins and your shop is famous. |
| **Publishable because** | One clear action, a score that goes up, and a goal to reach. |
| **New Verse** | `@editable` devices and an event handler; `var` and `set` for coins, and text with `{Coins}` in it. |
| **Basics it builds on** | *Wire up a button*, *Three strikes*. Skipped them? The "New to this?" notes explain. |
| **Time** | About 20 minutes. |
| **Your choice** | The shop's name. |
| **Next update** | Lesson 2: customers who want a specific pizza. |

The finished code is [`pizza_shop.verse`](pizza_shop.verse). Every line of it can be made with blocks.

## In UEFN

1. **Verse file**: Verse Explorer → right-click your project → *Add new Verse file to project* →
   *Verse Device*, name it `pizza_shop`. (In the app you'll build it with blocks; to test the
   lesson now, paste in `pizza_shop.verse`.) **Build Verse Code**.
2. **The shop**: a counter and an oven: any props you like.
3. **The oven button**: a **Button** device on the oven. In its options:
   - **Interaction Text**: `Bake pizza`
   - **Interaction Time**: `1.5` (holding E for a moment feels like baking)
4. **The sign**: a **HUD Message** device anywhere. In its options set **Display Time** to `0` (so
   the message stays on screen; if it disappears anyway, tell me).
5. **The device**: drag `pizza_shop` into the level. In its Details, set **OvenButton** and
   **ShopSign**.
6. **Launch Session**.

## Steps (each one testable)

1. **Link the devices.** Add two `@editable` devices: `OvenButton` (a `button_device`) and
   `ShopSign` (a `hud_message_device`).
   - *Try it*: Build Verse Code; the device's Details show both, and you can link them.
2. **Name your shop.** Add `ShopName:string = "…"` with your shop's name. In `OnBegin`, set the
   sign's text to `Welcome to {ShopName}!…` and show it.
   - *Try it*: the welcome message appears when the game starts.
   - *New to this?* `{ShopName}` inside text is replaced by the value: that's how text shows values.
3. **Bake.** Add a handler `OnPizzaBaked(Agent)` and subscribe it to
   `OvenButton.InteractedWithEvent`. Inside, `set Pizzas += 1` and show the count on the sign.
   - *Try it*: hold E at the oven; the pizza count goes up.
   - *New to this?* A `var` can change while the game runs; `set` changes it.
4. **Earn coins.** Add `PizzaPrice:int = 5` and `var Coins:int = 0`; each pizza adds `PizzaPrice`
   to `Coins`. Show both on the sign.
5. **Get famous.** Add `Goal:int = 100`. With `if (Coins >= Goal)`, show "{ShopName} is famous!"
   instead of the count.
   - *Try it*: bake 20 pizzas: the famous message appears.

## What to test, and tell me

| Test | Look for |
|---|---|
| 1. Start | Does the welcome message show with your shop's name? Does it stay on screen? |
| 2. Bake | Holding E at the oven: does the count go up by one pizza and 5 coins each time? |
| 3. Goal | At 100 coins (20 pizzas), does the famous message show? |
| 4. Feel | Is it fun for a minute? Is 1.5 s of holding right? Should the goal be lower? |
| 5. Steps | Following the steps above (not the finished file): is any step unclear or too big? |

If it doesn't build, paste the error list.
