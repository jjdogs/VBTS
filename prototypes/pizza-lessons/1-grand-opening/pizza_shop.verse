# Pizza path, lesson 1: Grand opening. A pizza clicker: bake at the oven, earn coins.
# Your shop's HUD is a widget you design in UEFN's widget editor (WBP_ShopHUD).
# Setup and the lesson steps: README.md next to this file.

using { /Fortnite.com/Devices }
using { /Verse.org/Simulation }
using { /UnrealEngine.com/Temporary/UI }  # for GetPlayerUI

pizza_shop := class(creative_device):

    # The Button on the oven: interacting with it bakes a pizza
    @editable
    OvenButton:button_device = button_device{}

    # Your choice: your shop's name
    ShopName:string = "Slice of Heaven"

    # Coins for each pizza, and the coins that make the shop famous (the goal)
    PizzaPrice:int = 5

    Goal:int = 100

    # What changes as you play
    var Coins:int = 0

    var Pizzas:int = 0

    # The shop HUD on each player's screen. WBP_ShopHUD is the widget you made in the widget
    # editor: its message variables (ShopName and Coins) are the text Verse can change.
    var ShopHUDs:[]WBP_ShopHUD = array{}

    OnBegin<override>()<suspends>:void =
        Print("Welcome to {ShopName}!")
        for (Player : GetPlayspace().GetPlayers()):
            ShowShopHUD(Player)
        OvenButton.InteractedWithEvent.Subscribe(OnPizzaBaked)

    # Puts a new shop HUD on this player's screen
    ShowShopHUD(Player:player):void =
        if (PlayerUI := GetPlayerUI[Player]):
            ShopHUD := WBP_ShopHUD{}
            PlayerUI.AddWidget(ShopHUD)
            set ShopHUDs += array{ShopHUD}
        UpdateShopHUDs()

    # Runs every time someone finishes baking at the oven
    OnPizzaBaked(Agent:agent):void =
        set Pizzas += 1
        set Coins += PizzaPrice
        UpdateShopHUDs()

    # Writes the shop's name and coins into every shop HUD
    UpdateShopHUDs():void =
        for (ShopHUD : ShopHUDs):
            set ShopHUD.ShopName = MakeMessage(ShopName)
            if (Coins >= Goal):
                set ShopHUD.Coins = MakeMessage("Famous! {Pizzas} pizzas baked")
            else:
                set ShopHUD.Coins = MakeMessage("{Coins} coins")

    # Turns a string into a message (widget text needs a message)
    MakeMessage<localizes>(Text:string):message = "{Text}"
