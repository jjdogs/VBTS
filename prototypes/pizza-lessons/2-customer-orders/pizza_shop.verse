# Pizza path, lesson 2: Customers have orders. A customer asks for a pizza; put the right
# topping on and bake it to earn coins (and a tip). The wrong pizza earns nothing.
# Setup and the lesson steps: README.md next to this file.

using { /Fortnite.com/Devices }
using { /Verse.org/Random }
using { /Verse.org/Simulation }

pizza_shop := class(creative_device):

    # The Button on the oven: baking now serves the pizza to the customer
    @editable
    OvenButton:button_device = button_device{}

    # The HUD Message device that shows the order, pizzas and coins
    @editable
    ShopSign:hud_message_device = hud_message_device{}

    # One Button for each topping, in the same order as Toppings below
    @editable
    PepperoniButton:button_device = button_device{}

    @editable
    MushroomButton:button_device = button_device{}

    @editable
    PineappleButton:button_device = button_device{}

    # Your choices: your shop's name and your toppings
    ShopName:string = "Slice of Heaven"

    Toppings:[]string = array{"Pepperoni", "Mushroom", "Pineapple"}

    # Coins for each right pizza, the tip on top, and the coins that make the shop famous
    PizzaPrice:int = 5

    Tip:int = 2

    Goal:int = 100

    # What changes as you play
    var Coins:int = 0

    var Pizzas:int = 0

    # What the customer wants, and what's on the pizza now
    var Order:string = ""

    var OnPizza:string = ""

    OnBegin<override>()<suspends>:void =
        PepperoniButton.InteractedWithEvent.Subscribe(OnPepperoni)
        MushroomButton.InteractedWithEvent.Subscribe(OnMushroom)
        PineappleButton.InteractedWithEvent.Subscribe(OnPineapple)
        OvenButton.InteractedWithEvent.Subscribe(OnPizzaBaked)
        NewOrder()

    # A new customer: pick a topping at random and show the order
    NewOrder():void =
        if (Pick := Toppings[GetRandomInt(0, Toppings.Length - 1)]):
            set Order = Pick
        set OnPizza = ""
        ShopSign.SetText(MakeMessage("{ShopName} ({Coins} coins): one {Order} pizza, please!"))
        ShopSign.Show()

    # Each topping button puts its topping on the pizza (replacing the one there)
    OnPepperoni(Agent:agent):void =
        set OnPizza = "Pepperoni"

    OnMushroom(Agent:agent):void =
        set OnPizza = "Mushroom"

    OnPineapple(Agent:agent):void =
        set OnPizza = "Pineapple"

    # Baking serves the pizza: the right one earns coins and a tip, then the next customer comes
    OnPizzaBaked(Agent:agent):void =
        if (OnPizza = Order):
            set Pizzas += 1
            set Coins += PizzaPrice + Tip
            if (Coins >= Goal):
                ShopSign.SetText(MakeMessage("{ShopName} is famous! {Pizzas} pizzas served."))
                ShopSign.Show()
            else:
                NewOrder()
        else:
            ShopSign.SetText(MakeMessage("That's not a {Order} pizza! Try again."))
            ShopSign.Show()
            set OnPizza = ""

    # Turns a string into a message (HUD text needs a message)
    MakeMessage<localizes>(Text:string):message = "{Text}"
