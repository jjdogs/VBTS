# Pizza path, lesson 2: Customers have orders. A customer asks for a pizza; put the right
# topping on and bake it to earn coins (and a tip). The wrong pizza earns nothing.
# Setup and the lesson steps: README.md next to this file.

using { /Fortnite.com/Devices }
using { /Verse.org/Random }  # for GetRandomInt
using { /Verse.org/Simulation }
using { /UnrealEngine.com/Temporary/UI }  # for GetPlayerUI

pizza_shop := class(creative_device):

    # The Button on the oven: baking now serves the pizza to the customer
    @editable
    OvenButton:button_device = button_device{}

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

    # The shop HUD on each player's screen (UI.WBP_ShopHUD, made in the widget editor).
    # This lesson adds an Order message variable to it.
    var ShopHUDs:[]UI.WBP_ShopHUD = array{}

    OnBegin<override>()<suspends>:void =
        Print("Welcome to {ShopName}!")
        for (Player : GetPlayspace().GetPlayers()):
            ShowShopHUD(Player)
        PepperoniButton.InteractedWithEvent.Subscribe(OnPepperoni)
        MushroomButton.InteractedWithEvent.Subscribe(OnMushroom)
        PineappleButton.InteractedWithEvent.Subscribe(OnPineapple)
        OvenButton.InteractedWithEvent.Subscribe(OnPizzaBaked)
        NewOrder()

    # Puts a new shop HUD on this player's screen
    ShowShopHUD(Player:player):void =
        if (PlayerUI := GetPlayerUI[Player]):
            ShopHUD := UI.WBP_ShopHUD{}
            PlayerUI.AddWidget(ShopHUD)
            set ShopHUDs += array{ShopHUD}
        UpdateShopHUDs()

    # A new customer: pick a topping at random
    NewOrder():void =
        if (Pick := Toppings[GetRandomInt(0, Toppings.Length - 1)]):
            set Order = Pick
        set OnPizza = ""
        ShowOrder("One {Order} pizza, please!")

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
            UpdateShopHUDs()
            NewOrder()
        else:
            ShowOrder("That's not a {Order} pizza! Try again.")
            set OnPizza = ""

    # Writes the shop's name, pizzas served and coins into every shop HUD
    UpdateShopHUDs():void =
        for (ShopHUD : ShopHUDs):
            if (Coins >= Goal):
                set ShopHUD.ShopName = MakeMessage("{ShopName} is famous!")
            else:
                set ShopHUD.ShopName = MakeMessage(ShopName)
            set ShopHUD.Pizzas = MakeMessage("{Pizzas} pizzas served")
            set ShopHUD.Coins = MakeMessage("{Coins} coins")

    # Writes what the customer says into every shop HUD
    ShowOrder(Text:string):void =
        for (ShopHUD : ShopHUDs):
            set ShopHUD.Order = MakeMessage(Text)

    # Turns a string into a message (widget text needs a message)
    MakeMessage<localizes>(Text:string):message = "{Text}"
