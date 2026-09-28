/**
 * Game-mode template: shop menu (Phase 5.3).
 *
 * Pressing a button device opens a per-player menu (a canvas with a loud button, added with a
 * clickable slot so the mouse is free). Clicking Buy spends coins from a [player]int map and
 * grants an item; the menu then closes. It goes through the text → blocks converter like every
 * template, so it must convert without raw blocks.
 */
import type { Template } from '../../types.ts';

export const shopMenu: Template = {
  id: 'shop_menu',
  title: 'Shop menu',
  kind: 'UI & economy',
  summary: 'Press the shop button to open a menu on your screen. Click Buy to spend 25 of your 100 coins on an item; the menu closes after each purchase.',
  teaches: 'A player\'s own UI (GetPlayerUI), a button widget on a canvas, clicking (OnClick and Message.Player), casting an agent to a player, and per-player maps for coins and menus.',
  devices: [
    ['ShopButton', 'button_device', 'Button', 'Players press it to open the shop.'],
    ['Granter', 'item_granter_device', 'Item Granter', 'Add the item the shop sells to its item list.'],
  ],
  steps: [
    'Open Verse Explorer, create a new Verse file named shop_menu, paste your code (Copy Verse) and save.',
    'Build it: Verse menu → Build Verse Code. Fix anything it reports.',
    'Place the button and item granter listed above, and give the granter the item to sell.',
    'Drag shop_menu from the Content Browser into the level, select it and link ShopButton and Granter.',
    'Launch Session, press the button, and click Buy. Each player has their own coins and their own menu.',
  ],
  verse: `using { /Fortnite.com/Devices }  # for creative_device, button_device, item_granter_device
using { /Verse.org/Simulation }  # for @editable, player, agent
using { /Fortnite.com/UI }  # for button_loud
using { /UnrealEngine.com/Temporary/UI }  # for canvas, GetPlayerUI, player_ui_slot and 1 more
using { /UnrealEngine.com/Temporary/SpatialMath }  # for vector2

shop_menu := class(creative_device):

    @editable
    ShopButton:button_device = button_device{}
    @editable
    Granter:item_granter_device = item_granter_device{}
    var Coins:[player]int = map{}
    var Menus:[player]canvas = map{}
    Price:int = 25

    OnBegin<override>()<suspends>:void =
        ShopButton.InteractedWithEvent.Subscribe(OnShopOpened)

    # Shows this player's shop: one Buy button in the middle of their screen
    OnShopOpened(Agent:agent):void =
        if (Player := player[Agent]):
            if (UI := GetPlayerUI[Player]):
                BuyButton := button_loud{DefaultText := MakeMessage("Buy an item (25 coins)")}
                BuyButton.OnClick().Subscribe(OnBuy)
                Menu := canvas{Slots := array{canvas_slot{Anchors := anchors{Minimum := vector2{X := 0.5, Y := 0.5}, Maximum := vector2{X := 0.5, Y := 0.5}}, Alignment := vector2{X := 0.5, Y := 0.5}, SizeToContent := true, Widget := BuyButton}}}
                UI.AddWidget(Menu, player_ui_slot{InputMode := ui_input_mode.All})
                if (set Menus[Player] = Menu) {}

    # Everyone starts with 100 coins; each item costs Price. Then the shop closes.
    OnBuy(Message:widget_message):void =
        Player := Message.Player
        var Balance:int = 100
        if (Saved := Coins[Player]):
            set Balance = Saved
        if (Balance >= Price):
            set Balance -= Price
            Granter.GrantItem(Player)
        if (set Coins[Player] = Balance) {}
        if (UI := GetPlayerUI[Player]):
            if (Menu := Menus[Player]):
                UI.RemoveWidget(Menu)
`,
};
