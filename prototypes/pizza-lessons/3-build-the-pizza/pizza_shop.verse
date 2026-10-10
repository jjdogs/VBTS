# Pizza path, lesson 3: Build the Pizza. The pizza on the counter is built from props you can
# see, in order: dough, sauce, cheese, then a topping. Bake it when it's finished.
# Setup and the lesson steps: README.md next to this file.

using { /Fortnite.com/Devices }
using { /Verse.org/Random }  # for GetRandomInt
using { /Verse.org/Simulation }
using { /UnrealEngine.com/Temporary/UI }  # for GetPlayerUI

# What the pizza needs next. Each step moves it to the next one.
pizza_stage := enum{NeedsSauce, NeedsCheese, NeedsTopping, Ready}

pizza_shop := class(creative_device):

    # The Button on the oven: baking serves the pizza to the customer
    @editable
    OvenButton:button_device = button_device{}

    # Buttons for the sauce and the cheese
    @editable
    SauceButton:button_device = button_device{}

    @editable
    CheeseButton:button_device = button_device{}

    # One Button for each topping, in the same order as Toppings below
    @editable
    PepperoniButton:button_device = button_device{}

    @editable
    MushroomButton:button_device = button_device{}

    @editable
    PineappleButton:button_device = button_device{}

    # The pizza you see on the counter: one prop for each part, placed on top of each other
    @editable
    DoughProp:creative_prop = creative_prop{}

    @editable
    SauceProp:creative_prop = creative_prop{}

    @editable
    CheeseProp:creative_prop = creative_prop{}

    @editable
    PepperoniProp:creative_prop = creative_prop{}

    @editable
    MushroomProp:creative_prop = creative_prop{}

    @editable
    PineappleProp:creative_prop = creative_prop{}

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

    # What the customer wants, what's on the pizza, and what the pizza needs next
    var Order:string = ""

    var OnPizza:string = ""

    var Stage:pizza_stage = pizza_stage.NeedsSauce

    # The shop HUD on each player's screen (UI.WBP_ShopHUD, made in the widget editor).
    # This lesson adds a Step message variable to it.
    var ShopHUDs:[]UI.WBP_ShopHUD = array{}

    OnBegin<override>()<suspends>:void =
        Print("Welcome to {ShopName}!")
        for (Player : GetPlayspace().GetPlayers()):
            ShowShopHUD(Player)
        SauceButton.InteractedWithEvent.Subscribe(OnSauce)
        CheeseButton.InteractedWithEvent.Subscribe(OnCheese)
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

    # A new customer: pick a topping at random, and start a new pizza
    NewOrder():void =
        if (Pick := Toppings[GetRandomInt(0, Toppings.Length - 1)]):
            set Order = Pick
        ShowOrder("One {Order} pizza, please!")
        NewPizza()

    # A fresh pizza: only the dough shows, and it needs sauce next
    NewPizza():void =
        SauceProp.Hide()
        CheeseProp.Hide()
        PepperoniProp.Hide()
        MushroomProp.Hide()
        PineappleProp.Hide()
        DoughProp.Show()
        set OnPizza = ""
        set Stage = pizza_stage.NeedsSauce
        ShowStep("Next: add the sauce")

    OnSauce(Agent:agent):void =
        if (Stage = pizza_stage.NeedsSauce):
            SauceProp.Show()
            set Stage = pizza_stage.NeedsCheese
            ShowStep("Next: add the cheese")
        else:
            ShowStep("The sauce is already on!")

    OnCheese(Agent:agent):void =
        if (Stage = pizza_stage.NeedsCheese):
            CheeseProp.Show()
            set Stage = pizza_stage.NeedsTopping
            ShowStep("Next: add a topping")
        else if (Stage = pizza_stage.NeedsSauce):
            ShowStep("Sauce first, then cheese!")
        else:
            ShowStep("The cheese is already on!")

    # Each topping button calls AddTopping with its topping and its prop
    OnPepperoni(Agent:agent):void =
        AddTopping("Pepperoni", PepperoniProp)

    OnMushroom(Agent:agent):void =
        AddTopping("Mushroom", MushroomProp)

    OnPineapple(Agent:agent):void =
        AddTopping("Pineapple", PineappleProp)

    # A topping goes on last, once the cheese is on
    AddTopping(Topping:string, Prop:creative_prop):void =
        if (Stage = pizza_stage.NeedsTopping):
            Prop.Show()
            set OnPizza = Topping
            set Stage = pizza_stage.Ready
            ShowStep("Ready! Bake it in the oven")
        else if (Stage = pizza_stage.Ready):
            ShowStep("It already has a topping. Bake it!")
        else:
            ShowStep("Sauce and cheese first!")

    # Baking serves the pizza, if it's finished: the right one earns coins and a tip
    OnPizzaBaked(Agent:agent):void =
        if (Stage <> pizza_stage.Ready):
            ShowStep("The pizza isn't finished yet!")
        else if (OnPizza = Order):
            set Pizzas += 1
            set Coins += PizzaPrice + Tip
            UpdateShopHUDs()
            NewOrder()
        else:
            ShowOrder("That's not a {Order} pizza! Make it again.")
            NewPizza()

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

    # Writes what to do next into every shop HUD
    ShowStep(Text:string):void =
        for (ShopHUD : ShopHUDs):
            set ShopHUD.Step = MakeMessage(Text)

    # Turns a string into a message (widget text needs a message)
    MakeMessage<localizes>(Text:string):message = "{Text}"
