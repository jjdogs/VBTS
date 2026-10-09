# Scrub test: does "scrub the dish in circles" work and feel good in UEFN?
# Stand in the sink zone, hold left click (fire) and move the mouse in circles.
# Every full circle counts; every few circles one grime layer on the dish disappears.
# Setup and what to look for: README.md next to this file.

using { /Fortnite.com/Devices }
using { /Fortnite.com/Characters }
using { /Fortnite.com/Input/Character }  # for WeaponPrimary, RangedWeaponMapping
using { /Verse.org/Input }  # for GetPlayerInput
using { /Verse.org/Simulation }
using { /UnrealEngine.com/Temporary/SpatialMath }

scrub_test_device := class(creative_device):

    # Where the player stands to wash (a Mutator Zone around the sink)
    @editable
    SinkZone:mutator_zone_device = mutator_zone_device{}

    # Optional: a fixed camera looking at the dish (turn on UseCamera to try it)
    @editable
    Camera:gameplay_camera_fixed_point_device = gameplay_camera_fixed_point_device{}
    @editable
    UseCamera:logic = false

    # The dish: the sponge circles around its centre
    @editable
    Dish:creative_prop = creative_prop{}
    # The sponge: it moves around the dish while you scrub
    @editable
    Sponge:creative_prop = creative_prop{}
    # Grime props on the dish (thin, dirty-looking pieces). One disappears per stage.
    @editable
    GrimeLayers:[]creative_prop = array{}

    # Only scrub while holding fire (left click). Turn off if holding isn't detected.
    @editable
    RequireHold:logic = true
    # Full circles needed to clean one grime layer
    @editable
    CirclesPerLayer:int = 3
    # How far the view must turn (degrees) in one tick to count as moving
    @editable
    MinSpeed:float = 0.4
    # How far the sponge sits from the dish's centre (cm)
    @editable
    SpongeRadius:float = 20.0
    # Show numbers on screen while testing
    @editable
    ShowDebug:logic = true

    var Inside:logic = false
    var Holding:logic = false
    var Subscribed:logic = false
    var Circles:int = 0
    var LayersCleaned:int = 0
    # How far above the dish the sponge was placed (kept while it moves)
    var SpongeLift:float = 0.0
    var SpongeWarned:logic = false

    OnBegin<override>()<suspends>:void =
        set SpongeLift = Sponge.GetTransform().Translation.Z - Dish.GetTransform().Translation.Z
        SinkZone.AgentEntersEvent.Subscribe(OnEnterSink)
        SinkZone.AgentExitsEvent.Subscribe(OnExitSink)

    OnEnterSink(Agent:agent):void =
        set Inside = true
        if (UseCamera?):
            Camera.AddTo(Agent)
        ListenForFire(Agent)
        spawn{ScrubLoop(Agent)}
        Print("At the sink: hold left click and move the mouse in circles")

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
        if (ShowDebug?):
            Print("Fire held")

    OnFireReleased(Player:player, HeldFor:float):void =
        set Holding = false
        if (ShowDebug?):
            Print("Fire released after {HeldFor} s")

    # Reads where the player looks 20 times a second. Moving the mouse in a circle makes the
    # direction of that movement turn all the way round; each full turn is one scrub.
    ScrubLoop(Agent:agent)<suspends>:void =
        var LastYaw:float = 0.0
        var LastPitch:float = 0.0
        var HasLast:logic = false
        var LastDirection:float = 0.0
        var HasDirection:logic = false
        var Turned:float = 0.0
        var SlowTicks:int = 0
        var Ticks:int = 0
        loop:
            Sleep(0.05)
            if (not Inside?):
                break
            if (FortChar := Agent.GetFortCharacter[]):
                Angles := FortChar.GetViewRotation().GetYawPitchRollDegrees()
                if (Yaw := Angles[0], Pitch := Angles[1]):
                    if (HasLast?):
                        DYaw := WrapDegrees(Yaw - LastYaw)
                        DPitch := Pitch - LastPitch
                        Speed := Sqrt(DYaw * DYaw + DPitch * DPitch)
                        if (Speed > MinSpeed, (not RequireHold? or Holding?)):
                            set SlowTicks = 0
                            Direction := ArcTan(DPitch, DYaw)
                            if (HasDirection?):
                                set Turned += WrapRadians(Direction - LastDirection)
                            set LastDirection = Direction
                            set HasDirection = true
                            MoveSponge(Direction)
                            if (AbsF(Turned) >= 2.0 * PiFloat):
                                set Turned = 0.0
                                CircleDone()
                        else:
                            # Stopped (or let go) for a moment: start the circle again
                            set SlowTicks += 1
                            if (SlowTicks > 4):
                                set HasDirection = false
                                set Turned = 0.0
                        set Ticks += 1
                        if (ShowDebug?, Mod[Ticks, 10] = 0):
                            Print("speed {Speed}  circle {Turned * 100.0 / (2.0 * PiFloat)}%")
                    set LastYaw = Yaw
                    set LastPitch = Pitch
                    set HasLast = true

    CircleDone():void =
        set Circles += 1
        if (ShowDebug?):
            Print("Circle {Circles}")
        if (Mod[Circles, CirclesPerLayer] = 0, Layer := GrimeLayers[LayersCleaned]):
            Layer.Hide()
            set LayersCleaned += 1
            if (LayersCleaned = GrimeLayers.Length):
                Print("Sparkling clean!")
            else:
                Print("Cleaner... {GrimeLayers.Length - LayersCleaned} to go")

    # Puts the sponge on the dish, on the side the mouse is moving towards
    MoveSponge(Direction:float):void =
        Center := Dish.GetTransform().Translation
        # Same height above the dish as where you placed the sponge (so it doesn't end up inside it)
        Offset := vector3{X := Cos(Direction) * SpongeRadius, Y := Sin(Direction) * SpongeRadius, Z := SpongeLift}
        if (not Sponge.TeleportTo[Center + Offset, Sponge.GetTransform().Rotation]):
            if (not SpongeWarned?):
                set SpongeWarned = true
                Print("SPONGE: can't move there. Raise the sponge a little above the dish, or lower SpongeRadius.", ?Duration := 8.0)

    # Turning from 179° to -179° is a 2° turn, not 358°.
    # <transacts>: these can be used inside an if ( ) condition.
    WrapDegrees(D:float)<transacts>:float =
        var Result:float = D
        if (D > 180.0):
            set Result = D - 360.0
        if (D < -180.0):
            set Result = D + 360.0
        Result

    WrapRadians(R:float)<transacts>:float =
        var Result:float = R
        if (R > PiFloat):
            set Result = R - 2.0 * PiFloat
        if (R < -PiFloat):
            set Result = R + 2.0 * PiFloat
        Result

    AbsF(X:float)<transacts>:float =
        var Result:float = X
        if (X < 0.0):
            set Result = 0.0 - X
        Result
