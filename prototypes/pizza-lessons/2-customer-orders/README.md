# Pizza lesson 2: Customers have orders (draft, to test in UEFN)

Part of the [Pizza path](../../../docs/plans/pizza-path.md), chapter 1. It's an update to
[lesson 1](../1-grand-opening/README.md): the same shop, oven and sign.

| | |
|---|---|
| **You'll have** | Customers order a pizza ("one Mushroom pizza, please!"). Press a topping button, then bake: the right pizza earns coins and a tip; the wrong one earns nothing and the customer asks again. |
| **Publishable because** | Every order is a small goal you can get right or wrong, and the shop still has its famous goal. |
| **New Verse** | An array (`Toppings`) and a random pick from it; comparing two values with `if`/`else`. |
| **Basics it builds on** | *Lists of things*, *Target timer* (random). Skipped them? The "New to this?" notes explain. |
| **Time** | About 30 minutes. |
| **Your choice** | Your three toppings (change the names in `Toppings` and on the buttons). |
| **Next update** | Lesson 3: see the pizza you're building, step by step. |

The finished code is [`pizza_shop.verse`](pizza_shop.verse). Every line of it can be made with blocks.

## In UEFN

Start from your lesson 1 level.

1. **Verse**: replace the contents of `pizza_shop` with `pizza_shop.verse` (keep your shop's name),
   then **Build Verse Code**.
2. **Topping buttons**: three **Button** devices on the counter, one per topping. Set each one's
   **Interaction Text** to `Add Pepperoni` (and Mushroom, Pineapple), and **Interaction Time** to `0`.
3. **The oven button**: change its **Interaction Text** to `Bake and serve`.
4. **The device**: in `pizza_shop`'s Details, link **PepperoniButton**, **MushroomButton** and
   **PineappleButton** (OvenButton and ShopSign are still linked from lesson 1).
5. **Launch Session**.

## Steps (each one testable)

1. **Your toppings.** Add `Toppings:[]string = array{"Pepperoni", "Mushroom", "Pineapple"}`.
   - *New to this?* An array is a list of values in order. `Toppings[0]` is the first one, and
     `Toppings.Length` is how many there are.
2. **A customer orders.** Add `var Order:string = ""` and a function `NewOrder()` that picks a random
   topping with `Toppings[GetRandomInt(0, Toppings.Length - 1)]`, puts it in `Order`, and shows
   "one {Order} pizza, please!". Call it at the end of `OnBegin`.
   - *Try it*: each time you launch, the customer may ask for a different pizza.
   - *New to this?* Getting an item from an array can fail (the spot might be empty), so it goes in
     an `if`: `if (Pick := Toppings[…]):` only runs if it worked.
3. **Topping buttons.** Add the three buttons and `var OnPizza:string = ""`. Each button's handler
   sets `OnPizza` to its topping.
4. **Serve.** In `OnPizzaBaked`, check `if (OnPizza = Order)`: earn `PizzaPrice + Tip` and call
   `NewOrder()`. `else`: show "That's not a {Order} pizza!" and clear `OnPizza`.
   - *Try it*: add the right topping and bake: coins, and a new order. Add the wrong one: the
     customer complains.
5. **Still famous.** Keep the goal from lesson 1: at 100 coins, show the famous message instead of
   a new order.

## What to test, and tell me

| Test | Look for |
|---|---|
| 1. Orders | Does an order show at the start? Over a few pizzas, do all three toppings get ordered? |
| 2. Right pizza | Right topping, then bake: new order, and 7 coins (5 + 2 tip)? |
| 3. Wrong pizza | Wrong topping (or none), then bake: the complaint, and the same order stays? |
| 4. Goal | At 100 coins (15 right pizzas) does the famous message show? |
| 5. Feel | Is matching fun? Is the sign easy to read (shop, coins and order on one line)? |

If it doesn't build, paste the error list.
