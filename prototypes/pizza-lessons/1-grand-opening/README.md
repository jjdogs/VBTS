# Pizza lesson 1: Grand opening (draft, to test in UEFN)

Part of the [Pizza path](../../../docs/plans/pizza-path.md), chapter 1. Once it's been played in UEFN
and works, it goes into the app as a lesson.

| | |
|---|---|
| **You'll have** | A pizza clicker with your own shop HUD: bake pizzas at the oven to earn coins. Reach 100 coins and your shop is famous. |
| **Publishable because** | One clear action, a score that goes up, a goal to reach, and a HUD you designed. |
| **New Verse** | `@editable` devices and an event handler; `var` and `set` for coins. **New in UEFN**: a HUD made in the widget editor, whose text Verse changes. |
| **Basics it builds on** | *Wire up a button*, *Three strikes*, *Your own HUD*. Skipped them? The "New to this?" notes explain. |
| **Time** | About 30 minutes (10 of them designing the HUD). |
| **Your choice** | The shop's name, and how the HUD looks. |
| **Next update** | Lesson 2: customers who want a specific pizza. |

The finished code is [`pizza_shop.verse`](pizza_shop.verse). (Verse Blocks can't make every line of
it yet: the app needs blocks for your own widgets. That's planned once this works in UEFN.)

The HUD part follows the usual UEFN way of doing it: a widget blueprint with **message variables**,
each **bound** to a Text Block, set from Verse.

## In UEFN

### The shop HUD (the widget editor)

1. In the **Content Browser**, make a folder called `UI` in your project's Content folder. In it,
   right-click → **User Interface → Widget Blueprint** → **User Widget**. Name it exactly `WBP_ShopHUD`.
   - *The folder is part of its Verse name*: in `UI`, Verse calls it `UI.WBP_ShopHUD`. (In another
     folder it's `FolderName.WBP_ShopHUD`; the build error says "Did you mean …" with the right name.)
2. Double-click it. Drag a **Canvas Panel** in, then two **Text Blocks** onto the canvas: one for the
   shop's name (big) and one under it for the coins. Put them where you like, e.g. top middle, and set
   each one's **Anchors** to match (top middle) so they stay put on any screen size.
3. Style them as you like: font size, colour, an outline. You can add an **Image** behind them as a
   panel. (Placeholder text like "Shop name" and "0 coins" helps you see the layout.)
4. Open **Window → Variables**. Add a variable `ShopName` of type **message**, and another one `Coins`,
   also **message**.
5. Select the name Text Block. In Details, next to **Text**, click the **chain-link icon** and pick
   `ShopName`. Do the same for the coins Text Block with `Coins`.
6. **Compile** and **Save**.

### The shop

1. A counter and an oven: any props you like.
2. A **Button** device on the oven. In its options: **Interaction Text** `Bake pizza`, **Interaction
   Time** `1.5` (holding E for a moment feels like baking).
3. **Verse file**: Verse Explorer → right-click your project → *Add new Verse file to project* →
   *Verse Device*, name it `pizza_shop`, and paste in `pizza_shop.verse`. **Build Verse Code**.
4. Drag `pizza_shop` into the level and set **OvenButton** in its Details.
5. **Launch Session**.

(The HUD Message device from the first draft isn't used any more; you can delete it.)

## Steps (each one testable)

1. **Say hello.** `Print("Welcome to {ShopName}!")` in `OnBegin`.
   - *Try it*: the welcome shows at the top left when the game starts. (If it doesn't, the device
     isn't running: check it's in the level and the build worked.)
2. **Show your HUD.** For each player, create a `UI.WBP_ShopHUD{}` and add it to their screen with
   `GetPlayerUI` and `AddWidget`. Keep it in the `ShopHUDs` array to change it later.
   - *Try it*: your HUD shows, with its placeholder text.
   - *New to this?* Your widget blueprint becomes a Verse type when you build. `UI.WBP_ShopHUD{}` makes a
     new one, like `button_device{}` does.
3. **Fill it in.** Set each HUD's `ShopName` and `Coins` (its message variables).
   - *Try it*: your shop's name and "0 coins" show.
4. **Bake.** Subscribe `OnPizzaBaked` to the oven button: add a pizza and `PizzaPrice` coins, then
   update the HUDs.
   - *Try it*: holding E at the oven adds 5 coins each time.
5. **Get famous.** With `if (Coins >= Goal)`, show "Famous!" instead of the coins.
   - *Try it*: after 20 pizzas, the HUD says Famous!

## What to test, and tell me

| Test | Look for |
|---|---|
| 1. Build | Does it build? If `UI.WBP_ShopHUD` is "unknown", check the widget's name and folder (the error's "Did you mean" gives the right name). |
| 2. Start | Does "Welcome to …" show at the top left? Does your HUD show, with your shop's name and "0 coins"? |
| 3. Bake | Holding E at the oven: do the coins go up by 5 each time? |
| 4. Goal | After 20 pizzas, does it say Famous? |
| 5. Feel | Is it fun for a minute? Is 1.5 s of holding right? |
| 6. Widget steps | Were the widget editor steps clear? Anything missing or named differently in your UEFN? |

If it doesn't build, paste the error list.
