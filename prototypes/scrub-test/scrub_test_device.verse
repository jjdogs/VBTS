# Scrub test: at the sink, a fixed camera looks down at the dish and the mouse cursor appears.
# Click and drag: the sponge goes wherever the cursor points on the dish.
# Rub the sponge over a grime spot to clean it; when every spot is gone, the dish is clean.
# Setup and what to look for: README.md next to this file.

using { /Fortnite.com/Devices }
using { /Fortnite.com/UI }  # for text_block
using { /Verse.org/Input }  # for GetPlayerInput, DeprojectViewportToWorld
using { /Verse.org/Input/UI }  # for TouchMapping, PointerSelect (the cursor while clicking)
using { /Verse.org/Simulation }
using { /UnrealEngine.com/Temporary/SpatialMath }
using { /UnrealEngine.com/Temporary/UI }  # for GetPlayerUI, canvas, player_ui_slot

scrub_test_device := class(creative_device):

    # Where the player stands to wash (a Mutator Zone in front of the sink)
    @editable
    SinkZone:mutator_zone_device = mutator_zone_device{}

    # A Fixed Point Camera looking down at the dish (aim it with right-click → Pilot)
    @editable
    Camera:gameplay_camera_fixed_point_device = gameplay_camera_fixed_point_device{}

    # The dish: the sponge stays on it
    @editable
    Dish:creative_prop = creative_prop{}
    # The sponge: place it just above the dish (not touching it)
    @editable
    Sponge:creative_prop = creative_prop{}
    # Grime spots on the dish. Rub the sponge over each one to clean it.
    @editable
    GrimeLayers:[]creative_prop = array{}

    # How far from the dish's centre the sponge can go (cm)
    @editable
    DishRadius:float = 40.0
    # How close (cm) the sponge must be to a grime spot to rub it
    @editable
    RubReach:float = 15.0
    # How much rubbing (cm of sponge movement) cleans one spot
    @editable
    RubNeeded:float = 150.0
    # Show what's happening on screen while testing
    @editable
    ShowDebug:logic = true

    var Inside:logic = false
    var Subscribed:logic = false
    # The on-screen layer that shows the mouse cursor while at the sink
    var CursorLayer:?canvas = false
    # Where the sponge is, relative to the dish's centre, and how high above it
    var SpongeX:float = 0.0
    var SpongeY:float = 0.0
    var SpongeLift:float = 0.0
    # How much each grime spot has been rubbed (-1.0 once it's clean)
    var Rubbed:[]float = array{}
    var SpotsLeft:int = 0
    var SpongeWarned:logic = false
    var PointerEvents:int = 0

    OnBegin<override>()<suspends>:void =
        DishSpot := Dish.GetTransform().Translation
        SpongeSpot := Sponge.GetTransform().Translation
        set SpongeX = SpongeSpot.X - DishSpot.X
        set SpongeY = SpongeSpot.Y - DishSpot.Y
        set SpongeLift = SpongeSpot.Z - DishSpot.Z
        set Rubbed = for (Grime : GrimeLayers):
            0.0
        set SpotsLeft = GrimeLayers.Length
        SinkZone.AgentEntersEvent.Subscribe(OnEnterSink)
        SinkZone.AgentExitsEvent.Subscribe(OnExitSink)

    OnEnterSink(Agent:agent):void =
        set Inside = true
        # A camera only works while it's enabled (its "enabled at game start" option may be off)
        Camera.Enable()
        Camera.AddTo(Agent)
        if (Player := player[Agent]):
            ShowCursor(Player)
            ListenForPointer(Player)
        Print("At the sink: click and drag on the dish to scrub")

    OnExitSink(Agent:agent):void =
        set Inside = false
        Camera.RemoveFrom(Agent)
        if (Player := player[Agent], UI := GetPlayerUI[Player], Layer := CursorLayer?):
            UI.RemoveWidget(Layer)
            set CursorLayer = false

    # A small hint on screen, added in UI mode so the mouse cursor shows and clicks reach Verse
    ShowCursor(Player:player):void =
        if (UI := GetPlayerUI[Player]):
            Hint := text_block{DefaultText := MakeMessage("Drag on the dish to scrub. Walk away to stop.")}
            Spot := vector2{X := 0.5, Y := 0.9}
            Layer := canvas{Slots := array{canvas_slot{Anchors := anchors{Minimum := Spot, Maximum := Spot}, Alignment := vector2{X := 0.5, Y := 0.5}, SizeToContent := true, Widget := Hint}}}
            UI.AddWidget(Layer, player_ui_slot{InputMode := ui_input_mode.All})
            set CursorLayer = option{Layer}

    # The pointer (mouse cursor or finger) while it's pressed: where it is on the screen
    ListenForPointer(Player:player):void =
        if (not Subscribed?, PlayerInput := GetPlayerInput[Player]):
            set Subscribed = true
            PlayerInput.AddInputMapping(TouchMapping)
            Pointer := PlayerInput.GetInputEvents(PointerSelect)
            Pointer.BeginDetectEvent.Subscribe(OnPointerDown)
            Pointer.DetectionOngoingEvent.Subscribe(OnPointerDrag)
            Pointer.TriggerActivationEvent.Subscribe(OnPointerDown)

    OnPointerDown(Player:player, ScreenSpot:(/Verse.org/SpatialMath:)vector3):void =
        ScrubAt(Player, ScreenSpot)

    OnPointerDrag(Player:player, ScreenSpot:(/Verse.org/SpatialMath:)vector3, Seconds:float):void =
        ScrubAt(Player, ScreenSpot)

    # Turns the cursor's spot on the screen into a spot on the dish, and moves the sponge there
    ScrubAt(Player:player, ScreenSpot:(/Verse.org/SpatialMath:)vector3):void =
        if (Inside?):
            set PointerEvents += 1
            if (ShowDebug?, Mod[PointerEvents, 20] = 1):
                Print("pointer at ({ScreenSpot.Left}, {ScreenSpot.Up})  events {PointerEvents}  spots left {SpotsLeft}")
            # A ray from the camera through the cursor…
            Ray := Player.DeprojectViewportToWorld(ScreenSpot)
            From := FromVector3(Ray.Origin)
            Towards := FromVector3(Ray.Direction)
            # …and where it reaches the sponge's height above the dish
            DishSpot := Dish.GetTransform().Translation
            Height := DishSpot.Z + SpongeLift
            if (Towards.Z < 0.0):
                Steps := (Height - From.Z) / Towards.Z
                HitX := From.X + Towards.X * Steps
                HitY := From.Y + Towards.Y * Steps
                OldX := SpongeX
                OldY := SpongeY
                MoveSponge(HitX - DishSpot.X, HitY - DishSpot.Y)
                Moved := Sqrt((SpongeX - OldX) * (SpongeX - OldX) + (SpongeY - OldY) * (SpongeY - OldY))
                if (Moved > 0.0):
                    RubGrime(Moved)

    # Moves the sponge to (X, Y) from the dish's centre, kept inside the dish
    MoveSponge(X:float, Y:float):void =
        var NewX:float = X
        var NewY:float = Y
        FromCentre := Sqrt(X * X + Y * Y)
        if (FromCentre > DishRadius):
            set NewX = X * DishRadius / FromCentre
            set NewY = Y * DishRadius / FromCentre
        DishSpot := Dish.GetTransform().Translation
        Target := vector3{X := DishSpot.X + NewX, Y := DishSpot.Y + NewY, Z := DishSpot.Z + SpongeLift}
        if (Sponge.TeleportTo[Target, Sponge.GetTransform().Rotation]):
            set SpongeX = NewX
            set SpongeY = NewY
        else if (not SpongeWarned?):
            set SpongeWarned = true
            Print("SPONGE: can't move there. Raise the sponge a little above the dish.", ?Duration := 8.0)

    # Rubs every grime spot the sponge is over; a spot rubbed enough disappears
    RubGrime(Moved:float):void =
        SpongeSpot := Sponge.GetTransform().Translation
        for (Index -> Grime : GrimeLayers):
            if (Old := Rubbed[Index], Old >= 0.0, DistanceXY(SpongeSpot, Grime.GetTransform().Translation) <= RubReach, set Rubbed[Index] = Old + Moved):
                if (Old + Moved >= RubNeeded, set Rubbed[Index] = -1.0):
                    Grime.Hide()
                    set SpotsLeft -= 1
                    if (SpotsLeft = 0):
                        Print("Sparkling clean!")
                    else:
                        Print("Spot clean! {SpotsLeft} to go")

    # Turns text into a message (on-screen text needs a message)
    MakeMessage<localizes>(Text:string):message = "{Text}"
