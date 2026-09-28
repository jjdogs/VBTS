using { /Fortnite.com/Devices }
using { /Verse.org/Simulation }
using { /UnrealEngine.com/Temporary/Diagnostics }

# A device that rewards players
reward_device := class(creative_device):

    @editable
    RewardButton : button_device = button_device{}
    @editable Granter:item_granter_device = item_granter_device{}
    @editable
    Spawners:[]player_spawner_device = array{}
    var PressCount : int = 0
    MaxPresses:int = 5
    var Greeting:string = "Welcome!"

    OnBegin<override>()<suspends>:void=
        Print("Device started")   # log it
        RewardButton.InteractedWithEvent.Subscribe(HandlePress)
        for (Index := 0..2):
            Print("Warmup {Index}")
        Sleep(1.5)

    HandlePress(InAgent:agent):void=
        set PressCount += 1
        if (PressCount > MaxPresses):
            Print("Too many presses")
        else:
            Granter.GrantItem(InAgent)
            if (FortChar := InAgent.GetFortCharacter[]):
                FortChar.Heal(10.0)
        Print("Presses: {PressCount}")

    IsLucky()<decides><transacts>:void=
        GetRandomInt(1, 6) = 6

    Countdown()<suspends>:void=
        loop:
            Sleep(1.0)
            if (PressCount >= 3 and not PressCount = 4):
                break

helper_class := class:
    Value:int = 3
