# Pizza path, lesson 4: Rush hour. Press Open to start a day: serve as many pizzas as you can
# before closing time. Customers wait less and less, and leave if you're too slow.
# Each day ends with your score; press Open again to beat your best day.
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

    # The Button by the door: opens the shop and starts a day
    @editable
    OpenButton:button_device = button_device{}

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

    # Each topping can be several props (every slice of pepperoni): add them all to its list
    @editable
    PepperoniProps:[]creative_prop = array{}

    @editable
    MushroomProps:[]creative_prop = array{}

    @editable
    PineappleProps:[]creative_prop = array{}

    # Your choices: your shop's name and your toppings
    ShopName:string = "Slice of Heaven"

    Toppings:[]string = array{"Pepperoni", "Mushroom", "Pineapple"}

    # Coins for each right pizza, the tip on top, and the coins that make the shop famous
    PizzaPrice:int = 5

    Tip:int = 2

    Goal:int = 100

    # How long a day lasts, how long the first customer waits, and the shortest wait (seconds)
    DayLength:int = 120

    StartPatience:int = 30

    MinPatience:int = 10

    # What changes as you play
    var Coins:int = 0

    var Pizzas:int = 0

    # What the customer wants, what's on the pizza, and what the pizza needs next
    var Order:string = ""

    var OnPizza:string = ""

    var Stage:pizza_stage = pizza_stage.NeedsSauce

    # The day: is the shop open, seconds until closing, seconds this customer will still wait,
    # and the most pizzas served in one day
    var IsOpen:logic = false

    var TimeLeft:int = 0

    var Patience:int = 0

    var BestDay:int = 0

    # The shop HUD on each player's screen (UI.WBP_ShopHUD, made in the widget editor).
    # This lesson adds a Clock message variable to it.
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
        OpenButton.InteractedWithEvent.Subscribe(OnOpen)
        CloseKitchen()
        ShowOrder("{ShopName} is closed.")
        ShowStep("Press Open to start the day!")
        ShowClock("")

    # Opening the shop starts a day. The day runs on its own (spawn), so this handler can finish.
    OnOpen(Agent:agent):void =
        if (not IsOpen?):
            spawn{RunDay()}

    # One day: a clock that ticks every second until closing time
    RunDay()<suspends>:void =
        set IsOpen = true
        set Pizzas = 0
        set TimeLeft = DayLength
        UpdateShopHUDs()
        OpenKitchen()
        NewOrder()
        loop:
            Sleep(1.0)
            set TimeLeft -= 1
            set Patience -= 1
            if (TimeLeft <= 0):
                break
            if (Patience <= 0):
                NewOrder()
                ShowStep("Too slow! That customer left.")
            ShowClock("Closing in {TimeLeft}s    Customer waits {Patience}s")
        CloseShop()

    # Closing time: the kitchen stops, and the day's score shows
    CloseShop():void =
        set IsOpen = false
        CloseKitchen()
        if (Pizzas > BestDay):
            set BestDay = Pizzas
        ShowOrder("Closed! You served {Pizzas} pizzas today.")
        ShowStep("Best day: {BestDay}. Press Open for another day!")
        ShowClock("")

    # The kitchen's buttons only work while the shop is open
    OpenKitchen():void =
        OpenButton.Disable()
        SauceButton.Enable()
        CheeseButton.Enable()
        PepperoniButton.Enable()
        MushroomButton.Enable()
        PineappleButton.Enable()
        OvenButton.Enable()

    CloseKitchen():void =
        OpenButton.Enable()
        SauceButton.Disable()
        CheeseButton.Disable()
        PepperoniButton.Disable()
        MushroomButton.Disable()
        PineappleButton.Disable()
        OvenButton.Disable()

    # Puts a new shop HUD on this player's screen
    ShowShopHUD(Player:player):void =
        if (PlayerUI := GetPlayerUI[Player]):
            ShopHUD := UI.WBP_ShopHUD{}
            PlayerUI.AddWidget(ShopHUD)
            set ShopHUDs += array{ShopHUD}
        UpdateShopHUDs()

    # A new customer: pick a topping at random, and start a new pizza. Each pizza served today
    # makes the next customer a second less patient, down to MinPatience.
    NewOrder():void =
        if (Pick := Toppings[GetRandomInt(0, Toppings.Length - 1)]):
            set Order = Pick
        set Patience = StartPatience - Pizzas
        if (Patience < MinPatience):
            set Patience = MinPatience
        ShowOrder("One {Order} pizza, please!")
        NewPizza()

    # A fresh pizza: only the dough shows, and it needs sauce next
    NewPizza():void =
        SauceProp.Hide()
        CheeseProp.Hide()
        HideAll(PepperoniProps)
        HideAll(MushroomProps)
        HideAll(PineappleProps)
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

    # Each topping button calls AddTopping with its topping and its props
    OnPepperoni(Agent:agent):void =
        AddTopping("Pepperoni", PepperoniProps)

    OnMushroom(Agent:agent):void =
        AddTopping("Mushroom", MushroomProps)

    OnPineapple(Agent:agent):void =
        AddTopping("Pineapple", PineappleProps)

    # A topping goes on last, once the cheese is on
    AddTopping(Topping:string, Props:[]creative_prop):void =
        if (Stage = pizza_stage.NeedsTopping):
            for (Prop : Props):
                Prop.Show()
            set OnPizza = Topping
            set Stage = pizza_stage.Ready
            ShowStep("Ready! Bake it in the oven")
        else if (Stage = pizza_stage.Ready):
            ShowStep("It already has a topping. Bake it!")
        else:
            ShowStep("Sauce and cheese first!")

    # Hides every prop in a list (all the slices of one topping)
    HideAll(Props:[]creative_prop):void =
        for (Prop : Props):
            Prop.Hide()

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
            set ShopHUD.Pizzas = MakeMessage("{Pizzas} pizzas served today")
            set ShopHUD.Coins = MakeMessage("{Coins} coins")

    # Writes what the customer says into every shop HUD
    ShowOrder(Text:string):void =
        for (ShopHUD : ShopHUDs):
            set ShopHUD.Order = MakeMessage(Text)

    # Writes what to do next into every shop HUD
    ShowStep(Text:string):void =
        for (ShopHUD : ShopHUDs):
            set ShopHUD.Step = MakeMessage(Text)

    # Writes the clock into every shop HUD
    ShowClock(Text:string):void =
        for (ShopHUD : ShopHUDs):
            set ShopHUD.Clock = MakeMessage(Text)

    # Turns a string into a message (widget text needs a message)
    MakeMessage<localizes>(Text:string):message = "{Text}"
