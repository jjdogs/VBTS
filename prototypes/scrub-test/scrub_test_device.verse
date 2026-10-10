# Scrub test: at the sink, a fixed camera looks down at the dish and the mouse cursor appears.
# Click and drag: the sponge goes wherever the cursor points on the dish.
# Rub the sponge over a grime spot to clean it; when every spot is gone, the dish is clean.
# Setup and what to look for: README.md next to this file.

using { /Fortnite.com/Devices }
using { /Fortnite.com/UI }  # for text_block
using { /Verse.org/Input }  # for GetPlayerInput, DeprojectViewportToWorld
using { /Verse.org/Input/UI }  # for TouchMapping, PointerSelect (the cursor while clicking)
using { /Verse.org/Simulation }
using { /Verse.org/SpatialMath }  # the pointer's position uses this vector3
using { /UnrealEngine.com/Temporary/SpatialMath }  # props and DistanceXY use this one
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

    # How far the sponge can go from where you placed it (cm). Place it in the middle of the dish.
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
    # Where the sponge started (the middle of where it can move)
    var HomeX:float = 0.0
    var HomeY:float = 0.0
    var HomeZ:float = 0.0
    # How far the sponge is from there now
    var OffsetX:float = 0.0
    var OffsetY:float = 0.0
    var OffsetZ:float = 0.0
    # The direction from the camera to the sponge's start. The sponge moves across the flat
    # surface that faces the camera (screen up/down and left/right), never towards or away from it.
    var FacingX:float = 0.0
    var FacingY:float = 0.0
    var FacingZ:float = 0.0
    # How much each grime spot has been rubbed (-1.0 once it's clean)
    var Rubbed:[]float = array{}
    var SpotsLeft:int = 0
    var SpongeWarned:logic = false
    var PointerEvents:int = 0

    OnBegin<override>()<suspends>:void =
        SpongeSpot := Sponge.GetTransform().Translation
        set HomeX = SpongeSpot.X
        set HomeY = SpongeSpot.Y
        set HomeZ = SpongeSpot.Z
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
        if (Player := player[Agent], PlayerUI := GetPlayerUI[Player], Layer := CursorLayer?):
            PlayerUI.RemoveWidget(Layer)
            set CursorLayer = false

    # A small hint on screen, added in UI mode so the mouse cursor shows and clicks reach Verse
    ShowCursor(Player:player):void =
        if (PlayerUI := GetPlayerUI[Player]):
            Hint := text_block{DefaultText := MakeMessage("Drag on the dish to scrub. Walk away to stop.")}
            Spot := vector2{X := 0.5, Y := 0.9}
            Layer := canvas{Slots := array{canvas_slot{Anchors := anchors{Minimum := Spot, Maximum := Spot}, Alignment := vector2{X := 0.5, Y := 0.5}, SizeToContent := true, Widget := Hint}}}
            PlayerUI.AddWidget(Layer, player_ui_slot{InputMode := ui_input_mode.All})
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

    # Turns the cursor's spot on the screen into a spot in front of the dish, and moves the sponge there
    ScrubAt(Player:player, ScreenSpot:(/Verse.org/SpatialMath:)vector3):void =
        if (Inside?):
            set PointerEvents += 1
            if (ShowDebug?, Mod[PointerEvents, 20] = 1):
                Print("pointer at ({ScreenSpot.Left}, {ScreenSpot.Up})  events {PointerEvents}  spots left {SpotsLeft}")
            # A ray from the camera through the cursor…
            Ray := Player.DeprojectViewportToWorld(ScreenSpot)
            From := FromVector3(Ray.Origin)
            Towards := FromVector3(Ray.Direction)
            # …facing the camera: the direction from the camera to the sponge's start
            set FacingX = HomeX - From.X
            set FacingY = HomeY - From.Y
            set FacingZ = HomeZ - From.Z
            Facing := FacingX * FacingX + FacingY * FacingY + FacingZ * FacingZ
            # …and where the ray crosses the flat surface through the sponge's start that faces the camera
            Across := Towards.X * FacingX + Towards.Y * FacingY + Towards.Z * FacingZ
            if (Across > 0.0):
                Steps := Facing / Across
                OldX := OffsetX
                OldY := OffsetY
                OldZ := OffsetZ
                MoveSponge(From.X + Towards.X * Steps - HomeX, From.Y + Towards.Y * Steps - HomeY, From.Z + Towards.Z * Steps - HomeZ)
                Moved := Sqrt((OffsetX - OldX) * (OffsetX - OldX) + (OffsetY - OldY) * (OffsetY - OldY) + (OffsetZ - OldZ) * (OffsetZ - OldZ))
                if (Moved > 0.0):
                    RubGrime(Moved)

    # Moves the sponge to (X, Y, Z) from where it started, no further than DishRadius
    MoveSponge(X:float, Y:float, Z:float):void =
        var NewX:float = X
        var NewY:float = Y
        var NewZ:float = Z
        FromHome := Sqrt(X * X + Y * Y + Z * Z)
        if (FromHome > DishRadius):
            set NewX = X * DishRadius / FromHome
            set NewY = Y * DishRadius / FromHome
            set NewZ = Z * DishRadius / FromHome
        # Both SpatialMath modules have a vector3, so this one says which (the one props use)
        Target := (/UnrealEngine.com/Temporary/SpatialMath:)vector3{X := HomeX + NewX, Y := HomeY + NewY, Z := HomeZ + NewZ}
        if (Sponge.TeleportTo[Target, Sponge.GetTransform().Rotation]):
            set OffsetX = NewX
            set OffsetY = NewY
            set OffsetZ = NewZ
        else if (not SpongeWarned?):
            set SpongeWarned = true
            Print("SPONGE: can't move there. Move the sponge a little further from the dish.", ?Duration := 8.0)

    # Rubs every grime spot the sponge is over (as seen from the camera); a spot rubbed enough disappears
    RubGrime(Moved:float):void =
        SpongeSpot := Sponge.GetTransform().Translation
        Facing := FacingX * FacingX + FacingY * FacingY + FacingZ * FacingZ
        for (Index -> Grime : GrimeLayers):
            GrimeSpot := Grime.GetTransform().Translation
            # From the grime to the sponge, ignoring the part towards the camera (the sponge sits in front)
            DX := SpongeSpot.X - GrimeSpot.X
            DY := SpongeSpot.Y - GrimeSpot.Y
            DZ := SpongeSpot.Z - GrimeSpot.Z
            Towards := (DX * FacingX + DY * FacingY + DZ * FacingZ) / Facing
            SX := DX - FacingX * Towards
            SY := DY - FacingY * Towards
            SZ := DZ - FacingZ * Towards
            if (Old := Rubbed[Index], Old >= 0.0, SX * SX + SY * SY + SZ * SZ <= RubReach * RubReach, set Rubbed[Index] = Old + Moved):
                if (Old + Moved >= RubNeeded, set Rubbed[Index] = -1.0):
                    Grime.Hide()
                    set SpotsLeft -= 1
                    if (SpotsLeft = 0):
                        Print("Sparkling clean!")
                    else:
                        Print("Spot clean! {SpotsLeft} to go")

    # Turns text into a message (on-screen text needs a message)
    MakeMessage<localizes>(Text:string):message = "{Text}"
