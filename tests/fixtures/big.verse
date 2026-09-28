using { /Fortnite.com/Devices }  # for creative_device
using { /Verse.org/Simulation }  # for @editable, agent
using { /UnrealEngine.com/Temporary/Diagnostics }  # for Print

target_gallery := class(creative_device):

    @editable
    StartButton:button_device = button_device{}
    @editable
    RoundTimer:timer_device = timer_device{}
    @editable
    Target1:shooting_range_target_device = shooting_range_target_device{}
    @editable
    Target2:shooting_range_target_device = shooting_range_target_device{}
    @editable
    Target3:shooting_range_target_device = shooting_range_target_device{}
    @editable
    Hud:hud_message_device = hud_message_device{}
    var Hits:int = 0
    var Pick:int = 0
    var RoundActive:logic = false

    OnBegin<override>()<suspends>:void=
        # Connect every device event to the function that handles it
        StartButton.InteractedWithEvent.Subscribe(OnStart)
        RoundTimer.SuccessEvent.Subscribe(OnRoundOver)
        Target1.KnockdownEvent.Subscribe(OnTargetHit)
        Target2.KnockdownEvent.Subscribe(OnTargetHit)
        Target3.KnockdownEvent.Subscribe(OnTargetHit)
        Target1.PopDown()
        Target2.PopDown()
        Target3.PopDown()
        Print("Target gallery ready")

    OnStart(Agent:agent):void=
        if (not RoundActive?):
            set Hits = 0
            set RoundActive = true
            StartButton.Disable()
            RoundTimer.Start()
            Hud.SetText(MakeMessage("Go! Knock down as many targets as you can."))
            Hud.Show()
            spawn{PopTargets()}

    # KnockdownEvent sends nothing, so this handler receives nothing
    OnTargetHit():void=
        if (RoundActive?):
            set Hits += 1
            Hud.SetText(MakeMessage("Hits: {Hits}"))
            Hud.Show()

    # SuccessEvent sends ?agent: the timer may finish with nobody attached
    OnRoundOver(MaybeAgent:?agent):void=
        set RoundActive = false
        Target1.PopDown()
        Target2.PopDown()
        Target3.PopDown()
        StartButton.Enable()
        Hud.SetText(MakeMessage("Time! Total hits: {Hits}"))
        Hud.Show()

    # Runs in the background during a round, popping up a random target
    PopTargets()<suspends>:void=
        loop:
            if (not RoundActive?):
                break
            set Pick = GetRandomInt(1, 3)
            if (Pick = 1):
                Target1.PopUp()
            if (Pick = 2):
                Target2.PopUp()
            if (Pick = 3):
                Target3.PopUp()
            Sleep(1.2)

    OnStart0(Agent:agent):void=
        if (not RoundActive?):
            set Hits = 0
            set RoundActive = true
            StartButton.Disable()
            RoundTimer.Start()
            Hud.SetText(MakeMessage("Go! Knock down as many targets as you can."))
            Hud.Show()
            spawn{PopTargets0()}

    # KnockdownEvent sends nothing, so this handler receives nothing
    OnTargetHit0():void=
        if (RoundActive?):
            set Hits += 1
            Hud.SetText(MakeMessage("Hits: {Hits}"))
            Hud.Show()

    # SuccessEvent sends ?agent: the timer may finish with nobody attached
    OnRoundOver0(MaybeAgent:?agent):void=
        set RoundActive = false
        Target1.PopDown()
        Target2.PopDown()
        Target3.PopDown()
        StartButton.Enable()
        Hud.SetText(MakeMessage("Time! Total hits: {Hits}"))
        Hud.Show()

    # Runs in the background during a round, popping up a random target
    PopTargets0()<suspends>:void=
        loop:
            if (not RoundActive?):
                break
            set Pick = GetRandomInt(1, 3)
            if (Pick = 1):
                Target1.PopUp()
            if (Pick = 2):
                Target2.PopUp()
            if (Pick = 3):
                Target3.PopUp()
            Sleep(1.2)

    OnStart1(Agent:agent):void=
        if (not RoundActive?):
            set Hits = 0
            set RoundActive = true
            StartButton.Disable()
            RoundTimer.Start()
            Hud.SetText(MakeMessage("Go! Knock down as many targets as you can."))
            Hud.Show()
            spawn{PopTargets1()}

    # KnockdownEvent sends nothing, so this handler receives nothing
    OnTargetHit1():void=
        if (RoundActive?):
            set Hits += 1
            Hud.SetText(MakeMessage("Hits: {Hits}"))
            Hud.Show()

    # SuccessEvent sends ?agent: the timer may finish with nobody attached
    OnRoundOver1(MaybeAgent:?agent):void=
        set RoundActive = false
        Target1.PopDown()
        Target2.PopDown()
        Target3.PopDown()
        StartButton.Enable()
        Hud.SetText(MakeMessage("Time! Total hits: {Hits}"))
        Hud.Show()

    # Runs in the background during a round, popping up a random target
    PopTargets1()<suspends>:void=
        loop:
            if (not RoundActive?):
                break
            set Pick = GetRandomInt(1, 3)
            if (Pick = 1):
                Target1.PopUp()
            if (Pick = 2):
                Target2.PopUp()
            if (Pick = 3):
                Target3.PopUp()
            Sleep(1.2)

    OnStart2(Agent:agent):void=
        if (not RoundActive?):
            set Hits = 0
            set RoundActive = true
            StartButton.Disable()
            RoundTimer.Start()
            Hud.SetText(MakeMessage("Go! Knock down as many targets as you can."))
            Hud.Show()
            spawn{PopTargets2()}

    # KnockdownEvent sends nothing, so this handler receives nothing
    OnTargetHit2():void=
        if (RoundActive?):
            set Hits += 1
            Hud.SetText(MakeMessage("Hits: {Hits}"))
            Hud.Show()

    # SuccessEvent sends ?agent: the timer may finish with nobody attached
    OnRoundOver2(MaybeAgent:?agent):void=
        set RoundActive = false
        Target1.PopDown()
        Target2.PopDown()
        Target3.PopDown()
        StartButton.Enable()
        Hud.SetText(MakeMessage("Time! Total hits: {Hits}"))
        Hud.Show()

    # Runs in the background during a round, popping up a random target
    PopTargets2()<suspends>:void=
        loop:
            if (not RoundActive?):
                break
            set Pick = GetRandomInt(1, 3)
            if (Pick = 1):
                Target1.PopUp()
            if (Pick = 2):
                Target2.PopUp()
            if (Pick = 3):
                Target3.PopUp()
            Sleep(1.2)

    OnStart3(Agent:agent):void=
        if (not RoundActive?):
            set Hits = 0
            set RoundActive = true
            StartButton.Disable()
            RoundTimer.Start()
            Hud.SetText(MakeMessage("Go! Knock down as many targets as you can."))
            Hud.Show()
            spawn{PopTargets3()}

    # KnockdownEvent sends nothing, so this handler receives nothing
    OnTargetHit3():void=
        if (RoundActive?):
            set Hits += 1
            Hud.SetText(MakeMessage("Hits: {Hits}"))
            Hud.Show()

    # SuccessEvent sends ?agent: the timer may finish with nobody attached
    OnRoundOver3(MaybeAgent:?agent):void=
        set RoundActive = false
        Target1.PopDown()
        Target2.PopDown()
        Target3.PopDown()
        StartButton.Enable()
        Hud.SetText(MakeMessage("Time! Total hits: {Hits}"))
        Hud.Show()

    # Runs in the background during a round, popping up a random target
    PopTargets3()<suspends>:void=
        loop:
            if (not RoundActive?):
                break
            set Pick = GetRandomInt(1, 3)
            if (Pick = 1):
                Target1.PopUp()
            if (Pick = 2):
                Target2.PopUp()
            if (Pick = 3):
                Target3.PopUp()
            Sleep(1.2)

    OnStart4(Agent:agent):void=
        if (not RoundActive?):
            set Hits = 0
            set RoundActive = true
            StartButton.Disable()
            RoundTimer.Start()
            Hud.SetText(MakeMessage("Go! Knock down as many targets as you can."))
            Hud.Show()
            spawn{PopTargets4()}

    # KnockdownEvent sends nothing, so this handler receives nothing
    OnTargetHit4():void=
        if (RoundActive?):
            set Hits += 1
            Hud.SetText(MakeMessage("Hits: {Hits}"))
            Hud.Show()

    # SuccessEvent sends ?agent: the timer may finish with nobody attached
    OnRoundOver4(MaybeAgent:?agent):void=
        set RoundActive = false
        Target1.PopDown()
        Target2.PopDown()
        Target3.PopDown()
        StartButton.Enable()
        Hud.SetText(MakeMessage("Time! Total hits: {Hits}"))
        Hud.Show()

    # Runs in the background during a round, popping up a random target
    PopTargets4()<suspends>:void=
        loop:
            if (not RoundActive?):
                break
            set Pick = GetRandomInt(1, 3)
            if (Pick = 1):
                Target1.PopUp()
            if (Pick = 2):
                Target2.PopUp()
            if (Pick = 3):
                Target3.PopUp()
            Sleep(1.2)

    OnStart5(Agent:agent):void=
        if (not RoundActive?):
            set Hits = 0
            set RoundActive = true
            StartButton.Disable()
            RoundTimer.Start()
            Hud.SetText(MakeMessage("Go! Knock down as many targets as you can."))
            Hud.Show()
            spawn{PopTargets5()}

    # KnockdownEvent sends nothing, so this handler receives nothing
    OnTargetHit5():void=
        if (RoundActive?):
            set Hits += 1
            Hud.SetText(MakeMessage("Hits: {Hits}"))
            Hud.Show()

    # SuccessEvent sends ?agent: the timer may finish with nobody attached
    OnRoundOver5(MaybeAgent:?agent):void=
        set RoundActive = false
        Target1.PopDown()
        Target2.PopDown()
        Target3.PopDown()
        StartButton.Enable()
        Hud.SetText(MakeMessage("Time! Total hits: {Hits}"))
        Hud.Show()

    # Runs in the background during a round, popping up a random target
    PopTargets5()<suspends>:void=
        loop:
            if (not RoundActive?):
                break
            set Pick = GetRandomInt(1, 3)
            if (Pick = 1):
                Target1.PopUp()
            if (Pick = 2):
                Target2.PopUp()
            if (Pick = 3):
                Target3.PopUp()
            Sleep(1.2)

    OnStart6(Agent:agent):void=
        if (not RoundActive?):
            set Hits = 0
            set RoundActive = true
            StartButton.Disable()
            RoundTimer.Start()
            Hud.SetText(MakeMessage("Go! Knock down as many targets as you can."))
            Hud.Show()
            spawn{PopTargets6()}

    # KnockdownEvent sends nothing, so this handler receives nothing
    OnTargetHit6():void=
        if (RoundActive?):
            set Hits += 1
            Hud.SetText(MakeMessage("Hits: {Hits}"))
            Hud.Show()

    # SuccessEvent sends ?agent: the timer may finish with nobody attached
    OnRoundOver6(MaybeAgent:?agent):void=
        set RoundActive = false
        Target1.PopDown()
        Target2.PopDown()
        Target3.PopDown()
        StartButton.Enable()
        Hud.SetText(MakeMessage("Time! Total hits: {Hits}"))
        Hud.Show()

    # Runs in the background during a round, popping up a random target
    PopTargets6()<suspends>:void=
        loop:
            if (not RoundActive?):
                break
            set Pick = GetRandomInt(1, 3)
            if (Pick = 1):
                Target1.PopUp()
            if (Pick = 2):
                Target2.PopUp()
            if (Pick = 3):
                Target3.PopUp()
            Sleep(1.2)

    OnStart7(Agent:agent):void=
        if (not RoundActive?):
            set Hits = 0
            set RoundActive = true
            StartButton.Disable()
            RoundTimer.Start()
            Hud.SetText(MakeMessage("Go! Knock down as many targets as you can."))
            Hud.Show()
            spawn{PopTargets7()}

    # KnockdownEvent sends nothing, so this handler receives nothing
    OnTargetHit7():void=
        if (RoundActive?):
            set Hits += 1
            Hud.SetText(MakeMessage("Hits: {Hits}"))
            Hud.Show()

    # SuccessEvent sends ?agent: the timer may finish with nobody attached
    OnRoundOver7(MaybeAgent:?agent):void=
        set RoundActive = false
        Target1.PopDown()
        Target2.PopDown()
        Target3.PopDown()
        StartButton.Enable()
        Hud.SetText(MakeMessage("Time! Total hits: {Hits}"))
        Hud.Show()

    # Runs in the background during a round, popping up a random target
    PopTargets7()<suspends>:void=
        loop:
            if (not RoundActive?):
                break
            set Pick = GetRandomInt(1, 3)
            if (Pick = 1):
                Target1.PopUp()
            if (Pick = 2):
                Target2.PopUp()
            if (Pick = 3):
                Target3.PopUp()
            Sleep(1.2)

    OnStart8(Agent:agent):void=
        if (not RoundActive?):
            set Hits = 0
            set RoundActive = true
            StartButton.Disable()
            RoundTimer.Start()
            Hud.SetText(MakeMessage("Go! Knock down as many targets as you can."))
            Hud.Show()
            spawn{PopTargets8()}

    # KnockdownEvent sends nothing, so this handler receives nothing
    OnTargetHit8():void=
        if (RoundActive?):
            set Hits += 1
            Hud.SetText(MakeMessage("Hits: {Hits}"))
            Hud.Show()

    # SuccessEvent sends ?agent: the timer may finish with nobody attached
    OnRoundOver8(MaybeAgent:?agent):void=
        set RoundActive = false
        Target1.PopDown()
        Target2.PopDown()
        Target3.PopDown()
        StartButton.Enable()
        Hud.SetText(MakeMessage("Time! Total hits: {Hits}"))
        Hud.Show()

    # Runs in the background during a round, popping up a random target
    PopTargets8()<suspends>:void=
        loop:
            if (not RoundActive?):
                break
            set Pick = GetRandomInt(1, 3)
            if (Pick = 1):
                Target1.PopUp()
            if (Pick = 2):
                Target2.PopUp()
            if (Pick = 3):
                Target3.PopUp()
            Sleep(1.2)

    OnStart9(Agent:agent):void=
        if (not RoundActive?):
            set Hits = 0
            set RoundActive = true
            StartButton.Disable()
            RoundTimer.Start()
            Hud.SetText(MakeMessage("Go! Knock down as many targets as you can."))
            Hud.Show()
            spawn{PopTargets9()}

    # KnockdownEvent sends nothing, so this handler receives nothing
    OnTargetHit9():void=
        if (RoundActive?):
            set Hits += 1
            Hud.SetText(MakeMessage("Hits: {Hits}"))
            Hud.Show()

    # SuccessEvent sends ?agent: the timer may finish with nobody attached
    OnRoundOver9(MaybeAgent:?agent):void=
        set RoundActive = false
        Target1.PopDown()
        Target2.PopDown()
        Target3.PopDown()
        StartButton.Enable()
        Hud.SetText(MakeMessage("Time! Total hits: {Hits}"))
        Hud.Show()

    # Runs in the background during a round, popping up a random target
    PopTargets9()<suspends>:void=
        loop:
            if (not RoundActive?):
                break
            set Pick = GetRandomInt(1, 3)
            if (Pick = 1):
                Target1.PopUp()
            if (Pick = 2):
                Target2.PopUp()
            if (Pick = 3):
                Target3.PopUp()
            Sleep(1.2)

    OnStart10(Agent:agent):void=
        if (not RoundActive?):
            set Hits = 0
            set RoundActive = true
            StartButton.Disable()
            RoundTimer.Start()
            Hud.SetText(MakeMessage("Go! Knock down as many targets as you can."))
            Hud.Show()
            spawn{PopTargets10()}

    # KnockdownEvent sends nothing, so this handler receives nothing
    OnTargetHit10():void=
        if (RoundActive?):
            set Hits += 1
            Hud.SetText(MakeMessage("Hits: {Hits}"))
            Hud.Show()

    # SuccessEvent sends ?agent: the timer may finish with nobody attached
    OnRoundOver10(MaybeAgent:?agent):void=
        set RoundActive = false
        Target1.PopDown()
        Target2.PopDown()
        Target3.PopDown()
        StartButton.Enable()
        Hud.SetText(MakeMessage("Time! Total hits: {Hits}"))
        Hud.Show()

    # Runs in the background during a round, popping up a random target
    PopTargets10()<suspends>:void=
        loop:
            if (not RoundActive?):
                break
            set Pick = GetRandomInt(1, 3)
            if (Pick = 1):
                Target1.PopUp()
            if (Pick = 2):
                Target2.PopUp()
            if (Pick = 3):
                Target3.PopUp()
            Sleep(1.2)

    OnStart11(Agent:agent):void=
        if (not RoundActive?):
            set Hits = 0
            set RoundActive = true
            StartButton.Disable()
            RoundTimer.Start()
            Hud.SetText(MakeMessage("Go! Knock down as many targets as you can."))
            Hud.Show()
            spawn{PopTargets11()}

    # KnockdownEvent sends nothing, so this handler receives nothing
    OnTargetHit11():void=
        if (RoundActive?):
            set Hits += 1
            Hud.SetText(MakeMessage("Hits: {Hits}"))
            Hud.Show()

    # SuccessEvent sends ?agent: the timer may finish with nobody attached
    OnRoundOver11(MaybeAgent:?agent):void=
        set RoundActive = false
        Target1.PopDown()
        Target2.PopDown()
        Target3.PopDown()
        StartButton.Enable()
        Hud.SetText(MakeMessage("Time! Total hits: {Hits}"))
        Hud.Show()

    # Runs in the background during a round, popping up a random target
    PopTargets11()<suspends>:void=
        loop:
            if (not RoundActive?):
                break
            set Pick = GetRandomInt(1, 3)
            if (Pick = 1):
                Target1.PopUp()
            if (Pick = 2):
                Target2.PopUp()
            if (Pick = 3):
                Target3.PopUp()
            Sleep(1.2)
