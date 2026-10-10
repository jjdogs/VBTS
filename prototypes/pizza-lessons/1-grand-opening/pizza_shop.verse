# Pizza path, lesson 1: Grand opening. A pizza clicker: bake at the oven, earn coins.
# Setup and the lesson steps: README.md next to this file.

using { /Fortnite.com/Devices }
using { /Verse.org/Simulation }

pizza_shop := class(creative_device):

    # The Button on the oven: interacting with it bakes a pizza
    @editable
    OvenButton:button_device = button_device{}

    # The HUD Message device that shows the shop's name, pizzas and coins
    @editable
    ShopSign:hud_message_device = hud_message_device{}

    # Your choice: your shop's name
    ShopName:string = "Slice of Heaven"

    # Coins for each pizza, and the coins that make the shop famous (the goal)
    PizzaPrice:int = 5

    Goal:int = 100

    # What changes as you play
    var Coins:int = 0

    var Pizzas:int = 0

    OnBegin<override>()<suspends>:void =
        ShopSign.SetText(MakeMessage("Welcome to {ShopName}! Bake a pizza at the oven."))
        ShopSign.Show()
        OvenButton.InteractedWithEvent.Subscribe(OnPizzaBaked)

    # Runs every time someone finishes baking at the oven
    OnPizzaBaked(Agent:agent):void =
        set Pizzas += 1
        set Coins += PizzaPrice
        if (Coins >= Goal):
            ShopSign.SetText(MakeMessage("{ShopName} is famous! {Pizzas} pizzas baked."))
        else:
            ShopSign.SetText(MakeMessage("{ShopName}: {Pizzas} pizzas, {Coins} coins"))
        ShopSign.Show()

    # Turns a string into a message (HUD text needs a message)
    MakeMessage<localizes>(Text:string):message = "{Text}"
