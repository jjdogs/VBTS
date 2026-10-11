# Pizza lesson 4: Rush hour (draft, to test in UEFN)

Part of the [Pizza path](../../../docs/plans/pizza-path.md), chapter 1, and its last lesson. It's an
update to [lesson 3](../3-build-the-pizza/README.md): the same kitchen and shop HUD.

| | |
|---|---|
| **You'll have** | A full arcade round. Press **Open** to start a day: serve as many pizzas as you can before closing time. Every pizza makes the next customer less patient, and a customer who waits too long leaves. At closing time you see your score and your best day; press Open to play again. |
| **Publishable because** | It has a start, rising difficulty, an end with a score, and a reason to play again (beat your best day). |
| **New Verse** | `spawn` (run something on its own) and a `loop` with `Sleep` and `break` (a clock that ticks every second). Also: turning devices on and off (`Enable` / `Disable`). |
| **Basics it builds on** | *Take a breath* (Sleep), *Target timer* (spawn, loops). Skipped them? The "New to this?" notes explain. |
| **Time** | About 35 minutes. |
| **Your choice** | How long a day is and how patient customers are (`DayLength`, `StartPatience`, `MinPatience`). |
| **Next update** | Chapter 2: coins that buy upgrades, dishes to wash, and progress that's still there next time. |

The finished code is [`pizza_shop.verse`](pizza_shop.verse).

## In UEFN

Start from your lesson 3 level.

1. **The HUD**: open `WBP_ShopHUD`. Add a Text Block for the clock (e.g. top right). In **Window →
   Variables** add `Clock`, type **message**, and bind the new Text Block's **Text** to it.
   **Compile** and **Save**.
2. **The Open button**: a **Button** device by the shop's door. **Interaction Text** `Open the shop`,
   **Interaction Time** `0`.
3. **Verse**: replace the contents of `pizza_shop` with `pizza_shop.verse` (keep your shop's name),
   then **Build Verse Code**.
4. **The device**: in `pizza_shop`'s Details, link **OpenButton**.
5. **Launch Session**.

## Steps (each one testable)

1. **Closed until you open.** Add `OpenButton`, `var IsOpen:logic = false`, and two functions:
   `OpenKitchen()` enables the kitchen's buttons (and disables Open), `CloseKitchen()` does the
   opposite. Call `CloseKitchen()` in `OnBegin` and say "Press Open to start the day!".
   - *Try it*: before opening, the kitchen buttons don't respond.
2. **A day.** Add `RunDay()<suspends>`: set `IsOpen`, reset `Pizzas`, open the kitchen and take the
   first order. `OnOpen` starts it with `spawn{RunDay()}`.
   - *New to this?* A handler can't wait (it has no `<suspends>`), but a day takes two minutes.
     `spawn` starts `RunDay` running on its own, and the handler finishes straight away.
3. **The clock.** In `RunDay`, a `loop`: `Sleep(1.0)`, take a second off `TimeLeft`, show it, and
   `break` out of the loop when it reaches 0. Then close the shop: the kitchen closes and the score
   shows.
   - *Try it* (set `DayLength` to 20 to test quickly): the clock counts down, and at 0 the day ends.
   - *New to this?* `loop` repeats forever; `break` is the way out.
4. **Impatient customers.** Each order gets `Patience` seconds (fewer for each pizza served today,
   never under `MinPatience`). The clock takes a second off it too; at 0 the customer leaves and a
   new one comes.
   - *Try it*: wait without making the pizza: "Too slow! That customer left."
5. **Best day.** At closing time, keep `BestDay` if today beat it, and show both.
   - *Try it*: play two days: the best one shows.

## What to test, and tell me

| Test | Look for |
|---|---|
| 1. Before opening | "Press Open to start the day!", and the kitchen buttons don't work? |
| 2. A day | Open starts the clock; it counts down; pizzas served today starts at 0? |
| 3. Customers leave | Wait too long: the customer leaves and a new order comes? |
| 4. Harder | After several pizzas, do customers wait less? |
| 5. Closing | At 0: the kitchen stops, and "You served N pizzas" with your best day? Open works again? |
| 6. Feel | Is 120 seconds right? 30 s patience to start, 10 s at least? Is it fun to replay? |

If it doesn't build, paste the error list.
