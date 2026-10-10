# Scrub test: interact with the sink to start. A fixed camera looks at the dish and the mouse
# cursor appears. Grab the sponge with the cursor and drag it over the dish.
# Rub the sponge over a grime spot to clean it; when every spot is gone, the dish is clean.
# Leave with the Done button (or it ends by itself once the dish is clean).
# Setup and what to look for: README.md next to this file.

using { /Fortnite.com/Devices }
using { /Fortnite.com/UI }  # for text_block, button_quiet
using { /Verse.org/Input }  # for GetPlayerInput, DeprojectViewportToWorld
using { /Verse.org/Input/UI }  # for TouchMapping, PointerSelect (the cursor)
using { /Verse.org/Simulation }
using { /Verse.org/SpatialMath }  # the pointer's position uses this vector3
using { /UnrealEngine.com/Temporary/SpatialMath }  # props and DistanceXY use this one
using { /UnrealEngine.com/Temporary/UI }  # for GetPlayerUI, canvas, player_ui_slot

scrub_test_device := class(creative_device):

    # A Button on the sink: interact with it to start washing (set its text to e.g. "Wash dishes")
    @editable
    SinkButton:button_device = button_device{}

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
    # How close (cm) the cursor must be to the sponge to pick it up. The sponge's spot is its
    # pivot, which may be a corner of the prop: raise this if grabbing is hard.
    @editable
    GrabReach:float = 25.0
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
    # Who is washing (to end the minigame for them when the dish is clean)
    var Washer:?agent = false
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
    # Whether the sponge is held, and where it is from the cursor while held
    var Grabbing:logic = false
    var GrabX:float = 0.0
    var GrabY:float = 0.0
    var GrabZ:float = 0.0
    # Where the cursor last pointed (from the sponge's start)
    var HitX:float = 0.0
    var HitY:float = 0.0
    var HitZ:float = 0.0
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
        SinkButton.InteractedWithEvent.Subscribe(StartWashing)

    # Interacting with the sink starts the minigame
    StartWashing(Agent:agent):void =
        if (not Inside?, Player := player[Agent]):
            set Inside = true
            set Washer = option{Agent}
            if (SpotsLeft = 0):
                ResetDish()
            # A camera only works while it's enabled (its "enabled at game start" option may be off)
            Camera.Enable()
            Camera.AddTo(Agent)
            ShowControls(Player)
            ListenForInput(Player)

    # The Done button or a clean dish: back to the normal view
    StopWashing(Agent:agent):void =
        if (Inside?):
            set Inside = false
            set Washer = false
            set Grabbing = false
            Camera.RemoveFrom(Agent)
            if (Player := player[Agent]):
                # Turn off the pointer input that washing turned on. Only remove mappings you added
                # yourself: the player's own ones (like TraversalMapping, for moving) must stay.
                if (PlayerInput := GetPlayerInput[Player]):
                    PlayerInput.RemoveInputMapping(TouchMapping)
                if (PlayerUI := GetPlayerUI[Player], Layer := CursorLayer?):
                    PlayerUI.RemoveWidget(Layer)
                    set CursorLayer = false

    # Puts the grime back and the sponge in the middle, to wash again
    ResetDish():void =
        for (Grime : GrimeLayers):
            Grime.Show()
        set Rubbed = for (Grime : GrimeLayers):
            0.0
        set SpotsLeft = GrimeLayers.Length
        MoveSponge(0.0, 0.0, 0.0)

    # A hint and a Done button, added in UI mode so the mouse cursor shows and clicks reach Verse
    ShowControls(Player:player):void =
        if (PlayerUI := GetPlayerUI[Player]):
            Hint := text_block{DefaultText := MakeMessage("Grab the sponge and drag it over the dish to scrub.")}
            Done := button_quiet{DefaultText := MakeMessage("Done")}
            Done.OnClick().Subscribe(OnDoneClicked)
            Bottom := vector2{X := 0.5, Y := 0.9}
            TopRight := vector2{X := 0.95, Y := 0.08}
            Layer := canvas{Slots := array{
                canvas_slot{Anchors := anchors{Minimum := Bottom, Maximum := Bottom}, Alignment := vector2{X := 0.5, Y := 0.5}, SizeToContent := true, Widget := Hint},
                canvas_slot{Anchors := anchors{Minimum := TopRight, Maximum := TopRight}, Alignment := vector2{X := 1.0, Y := 0.0}, SizeToContent := true, Widget := Done}}}
            PlayerUI.AddWidget(Layer, player_ui_slot{InputMode := ui_input_mode.All})
            set CursorLayer = option{Layer}

    OnDoneClicked(Message:widget_message):void =
        StopWashing(Message.Player)

    # The pointer (mouse cursor or finger): pressed, dragged, and let go
    ListenForInput(Player:player):void =
        if (PlayerInput := GetPlayerInput[Player]):
            # Turned on every time washing starts, and off again in StopWashing
            PlayerInput.AddInputMapping(TouchMapping)
            # Subscribe only once: events only arrive while their mapping is on
            if (not Subscribed?):
                set Subscribed = true
                Pointer := PlayerInput.GetInputEvents(PointerSelect)
                Pointer.BeginDetectEvent.Subscribe(OnPointerDown)
                Pointer.DetectionOngoingEvent.Subscribe(OnPointerDrag)
                Pointer.TriggerActivationEvent.Subscribe(OnPointerHeld)
                Pointer.EndDetectEvent.Subscribe(OnPointerUp)

    # Once the dish is clean, a moment to enjoy it, then back to the normal view
    FinishSoon(Agent:agent)<suspends>:void =
        Sleep(1.5)
        StopWashing(Agent)

    # Pressing picks the sponge up, but only if the cursor is on (or near) it
    OnPointerDown(Player:player, ScreenSpot:(/Verse.org/SpatialMath:)vector3):void =
        if (Inside?, FindCursorSpot[Player, ScreenSpot]):
            DX := HitX - OffsetX
            DY := HitY - OffsetY
            DZ := HitZ - OffsetZ
            if (DX * DX + DY * DY + DZ * DZ <= GrabReach * GrabReach):
                set Grabbing = true
                # Keep the sponge where it is under the cursor, wherever on it you grabbed
                set GrabX = OffsetX - HitX
                set GrabY = OffsetY - HitY
                set GrabZ = OffsetZ - HitZ
            else if (ShowDebug?):
                Print("Missed the sponge: click on it to pick it up")

    OnPointerDrag(Player:player, ScreenSpot:(/Verse.org/SpatialMath:)vector3, Seconds:float):void =
        DragTo(Player, ScreenSpot)

    OnPointerHeld(Player:player, ScreenSpot:(/Verse.org/SpatialMath:)vector3):void =
        DragTo(Player, ScreenSpot)

    # Letting go drops the sponge
    OnPointerUp(Player:player, Seconds:float):void =
        set Grabbing = false

    # While the sponge is held, it follows the cursor and rubs any grime it passes over
    DragTo(Player:player, ScreenSpot:(/Verse.org/SpatialMath:)vector3):void =
        if (Inside?, Grabbing?, FindCursorSpot[Player, ScreenSpot]):
            set PointerEvents += 1
            if (ShowDebug?, Mod[PointerEvents, 20] = 1):
                Print("pointer at ({ScreenSpot.Left}, {ScreenSpot.Up})  events {PointerEvents}  spots left {SpotsLeft}")
            OldX := OffsetX
            OldY := OffsetY
            OldZ := OffsetZ
            MoveSponge(HitX + GrabX, HitY + GrabY, HitZ + GrabZ)
            Moved := Sqrt((OffsetX - OldX) * (OffsetX - OldX) + (OffsetY - OldY) * (OffsetY - OldY) + (OffsetZ - OldZ) * (OffsetZ - OldZ))
            if (Moved > 0.0):
                RubGrime(Moved)

    # Finds where the cursor points, on the flat surface through the sponge's start that faces
    # the camera, and puts it in HitX/HitY/HitZ (from the sponge's start). Fails if it points away.
    FindCursorSpot(Player:player, ScreenSpot:(/Verse.org/SpatialMath:)vector3)<transacts><decides>:void =
        # A ray from the camera through the cursor…
        Ray := Player.DeprojectViewportToWorld(ScreenSpot)
        From := FromVector3(Ray.Origin)
        Towards := FromVector3(Ray.Direction)
        # …facing the camera: the direction from the camera to the sponge's start
        set FacingX = HomeX - From.X
        set FacingY = HomeY - From.Y
        set FacingZ = HomeZ - From.Z
        Facing := FacingX * FacingX + FacingY * FacingY + FacingZ * FacingZ
        # …and where the ray crosses that surface
        Across := Towards.X * FacingX + Towards.Y * FacingY + Towards.Z * FacingZ
        Across > 0.0
        Steps := Facing / Across
        set HitX = From.X + Towards.X * Steps - HomeX
        set HitY = From.Y + Towards.Y * Steps - HomeY
        set HitZ = From.Z + Towards.Z * Steps - HomeZ

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
                        if (Agent := Washer?):
                            spawn{FinishSoon(Agent)}
                    else:
                        Print("Spot clean! {SpotsLeft} to go")

    # Turns text into a message (on-screen text needs a message)
    MakeMessage<localizes>(Text:string):message = "{Text}"
