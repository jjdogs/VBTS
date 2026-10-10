# Pizza lesson 3: Build the Pizza (draft, to test in UEFN)

Part of the [Pizza path](../../../docs/plans/pizza-path.md), chapter 1. It's an update to
[lesson 2](../2-customer-orders/README.md): the same shop, buttons and shop HUD.

| | |
|---|---|
| **You'll have** | The pizza on the counter is built in front of you, in order: dough, sauce, cheese, then the topping the customer wants. The HUD says what to do next. Bake it when it's finished. |
| **Publishable because** | The same order game, now something you can see and build step by step, with a clear next step at all times. |
| **New Verse** | An enum for the pizza's stage (`pizza_stage`); showing and hiding props. (Also: a function with inputs, `AddTopping(Topping, Prop)`, so the three toppings share one function.) |
| **Basics it builds on** | *Game states* (enums), *Functions that answer* (inputs). Skipped them? The "New to this?" notes explain. |
| **Time** | About 35 minutes. |
| **Your choice** | What your pizza parts look like: any props for the dough, sauce, cheese and toppings. |
| **Next update** | Lesson 4: a clock, so there's pressure. |

The finished code is [`pizza_shop.verse`](pizza_shop.verse).

## In UEFN

Start from your lesson 2 level.

1. **The HUD**: open `WBP_ShopHUD`. Add a Text Block for the next step (smaller, under the order).
   In **Window → Variables** add `Step`, type **message**, and bind the new Text Block's **Text** to
   it. **Compile** and **Save**.
2. **The pizza props**: on the counter, stack six props on the same spot, like a pizza being built:
   - **Dough**: something flat and round (a plate or a round tile works).
   - **Sauce**: something flat and red, just on top of the dough.
   - **Cheese**: something flat and yellow, on top of the sauce.
   - **Pepperoni, Mushroom, Pineapple**: one small prop each, on top of the cheese.

   They can overlap: only the right ones show at a time. (Placeholder props are fine; the look
   comes later.)
3. **Two more buttons**: a **Button** for `Add sauce` and one for `Add cheese`, next to the topping
   buttons. **Interaction Time** `0`.
4. **Verse**: replace the contents of `pizza_shop` with `pizza_shop.verse` (keep your shop's name),
   then **Build Verse Code**.
5. **The device**: in `pizza_shop`'s Details, link **SauceButton**, **CheeseButton**, and the six
   props: **DoughProp**, **SauceProp**, **CheeseProp**, **PepperoniProp**, **MushroomProp**,
   **PineappleProp**.
6. **Launch Session**.

## Steps (each one testable)

1. **The stages.** Above your device, add `pizza_stage := enum{NeedsSauce, NeedsCheese, NeedsTopping, Ready}`
   and `var Stage:pizza_stage = pizza_stage.NeedsSauce`.
   - *New to this?* An enum is a short list of named choices. A variable of that type is always
     exactly one of them, so the pizza can't be "half sauced".
2. **A fresh pizza.** Add the six props and a `NewPizza()` function: hide every part but the dough,
   set `Stage` back to `NeedsSauce`, and show "Next: add the sauce". `NewOrder()` calls it.
   - *Try it*: at the start only the dough shows.
   - *New to this?* `Prop.Hide()` and `Prop.Show()` make a prop disappear and come back. It's
     still there, just not seen.
3. **Sauce, then cheese.** `OnSauce`: if `Stage = pizza_stage.NeedsSauce`, show the sauce and move
   to `NeedsCheese`. `OnCheese` does the same for the cheese. Otherwise, say what's wrong.
   - *Try it*: cheese before sauce says "Sauce first, then cheese!".
4. **One topping function.** `AddTopping(Topping:string, Prop:creative_prop)` puts any topping on,
   once the cheese is on. Each topping button just calls it with its own topping and prop.
   - *Try it*: the topping appears, and the HUD says "Ready! Bake it in the oven".
5. **Bake only a finished pizza.** In `OnPizzaBaked`, if `Stage <> pizza_stage.Ready`, say it isn't
   finished. The right pizza earns coins and brings a new order; the wrong one starts the pizza
   again.

## What to test, and tell me

| Test | Look for |
|---|---|
| 1. Start | Only the dough shows, and the HUD says "Next: add the sauce"? |
| 2. In order | Sauce, cheese, topping: each prop appears and the next step shows? |
| 3. Out of order | Cheese or a topping too early, or baking too early: a helpful message, and nothing changes? |
| 4. Serve | Right pizza: coins, and a fresh dough for the next order. Wrong topping: the complaint, and a fresh dough for the same order? |
| 5. Feel | Is building the pizza more fun than lesson 2? Is it clear what to do next? |

If it doesn't build, paste the error list.
