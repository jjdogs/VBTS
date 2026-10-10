# Scrub test: at the sink, a first-person camera looks at the dish. Holding left click turns the
# sponge into a cursor: move the mouse and the sponge moves across the dish (up = away from you).
# Without left click, the mouse looks around as usual.
# Rub the sponge over a grime spot to clean it; when every spot is gone, the dish is clean.
# Setup and what to look for: README.md next to this file.

using { /Fortnite.com/Devices }
using { /Fortnite.com/Characters }
using { /Fortnite.com/Input/Character }  # for WeaponPrimary, RangedWeaponMapping
using { /Verse.org/Input }  # for GetPlayerInput
using { /Verse.org/Simulation }
using { /UnrealEngine.com/Temporary/SpatialMath }

scrub_test_device := class(creative_device):

    # Where the player stands to wash (a Mutator Zone in front of the sink)
    @editable
    SinkZone:mutator_zone_device = mutator_zone_device{}

    # A First Person Camera: the player sees through their own eyes and can look around
    @editable
    Camera:gameplay_camera_first_person_device = gameplay_camera_first_person_device{}
    @editable
    UseCamera:logic = true

    # The dish: the sponge stays on it
    @editable
    Dish:creative_prop = creative_prop{}
    # The sponge: place it just above the dish (not touching it)
    @editable
    Sponge:creative_prop = creative_prop{}
    # Grime spots on the dish. Rub the sponge over each one to clean it.
    @editable
    GrimeLayers:[]creative_prop = array{}

    # How far the sponge moves (cm) for each degree the mouse turns the view
    @editable
    Sensitivity:float = 3.0
    # How far from the dish's centre the sponge can go (cm)
    @editable
    DishRadius:float = 40.0
    # How close (cm) the sponge must be to a grime spot to rub it
    @editable
    RubReach:float = 15.0
    # How much rubbing (cm of sponge movement) cleans one spot
    @editable
    RubNeeded:float = 150.0
    # Flip the directions if the sponge moves the wrong way
    @editable
    InvertUpDown:logic = false
    @editable
    InvertLeftRight:logic = false
    # Show what's happening on screen while testing
    @editable
    ShowDebug:logic = true

    var Inside:logic = false
    var Holding:logic = false
    var Subscribed:logic = false
    # Where the sponge is, relative to the dish's centre, and how high above it
    var SpongeX:float = 0.0
    var SpongeY:float = 0.0
    var SpongeLift:float = 0.0
    # How much each grime spot has been rubbed (-1.0 once it's clean)
    var Rubbed:[]float = array{}
    var SpotsLeft:int = 0
    var SpongeWarned:logic = false

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
        if (UseCamera?):
            # A camera only works while it's enabled (its "enabled at game start" option may be off)
            Camera.Enable()
            Camera.AddTo(Agent)
            if (ShowDebug?):
                Print("First person camera added to you")
        ListenForFire(Agent)
        spawn{ScrubLoop(Agent)}
        Print("At the sink: look at the dish, hold left click and move the mouse to scrub")

    OnExitSink(Agent:agent):void =
        set Inside = false
        set Holding = false
        if (UseCamera?):
            Camera.RemoveFrom(Agent)

    # Holding detection: the fire button's input events (they need a player)
    ListenForFire(Agent:agent):void =
        if (not Subscribed?, Player := player[Agent], PlayerInput := GetPlayerInput[Player]):
            set Subscribed = true
            PlayerInput.AddInputMapping(RangedWeaponMapping)
            FireEvents := PlayerInput.GetInputEvents(WeaponPrimary)
            FireEvents.BeginDetectEvent.Subscribe(OnFirePressed)
            FireEvents.EndDetectEvent.Subscribe(OnFireReleased)

    OnFirePressed(Player:player, Value:logic):void =
        set Holding = true

    OnFireReleased(Player:player, HeldFor:float):void =
        set Holding = false

    # Every frame: how far did the view turn? While holding, move the sponge that much.
    ScrubLoop(Agent:agent)<suspends>:void =
        var LastYaw:float = 0.0
        var LastPitch:float = 0.0
        var HasLast:logic = false
        var Frames:int = 0
        # "Up" on the screen as a direction across the dish, from the way the player faces
        # when they start holding left click ("right" is a quarter turn from it)
        var UpX:float = 1.0
        var UpY:float = 0.0
        loop:
            Sleep(0.0)
            if (not Inside?):
                break
            if (FortChar := Agent.GetFortCharacter[], Angles := FortChar.GetViewRotation().GetYawPitchRollDegrees(), Yaw := Angles[0], Pitch := Angles[1]):
                if (HasLast?, Holding?):
                    var Across:float = WrapDegrees(Yaw - LastYaw) * Sensitivity
                    var Along:float = (Pitch - LastPitch) * Sensitivity
                    if (InvertLeftRight?):
                        set Across = 0.0 - Across
                    if (InvertUpDown?):
                        set Along = 0.0 - Along
                    Moved := Sqrt(Across * Across + Along * Along)
                    if (Moved > 0.0):
                        # Right is (-UpY, UpX)
                        MoveSponge(SpongeX - UpY * Across + UpX * Along, SpongeY + UpX * Across + UpY * Along)
                        RubGrime(Moved)
                    set Frames += 1
                    if (ShowDebug?, Mod[Frames, 30] = 0):
                        Print("view turned {Moved / Sensitivity}°  spots left {SpotsLeft}")
                else:
                    # Not scrubbing: remember which way the player faces
                    Radians := Yaw * PiFloat / 180.0
                    set UpX = Cos(Radians)
                    set UpY = Sin(Radians)
                set LastYaw = Yaw
                set LastPitch = Pitch
                set HasLast = true

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

    # Turning from 179° to -179° is a 2° turn, not 358°
    WrapDegrees(D:float)<transacts>:float =
        var Result:float = D
        if (D > 180.0):
            set Result = D - 360.0
        if (D < -180.0):
            set Result = D + 360.0
        Result
