using { /Fortnite.com/Devices }
using { /Verse.org/Simulation }
using { /UnrealEngine.com/Temporary/SpatialMath }

floor_is_lava_device := class(creative_device):

    @editable
    LavaProp : creative_prop = creative_prop{}

    @editable
    Timer : timer_device = timer_device{}

    @editable
    RaiseSpeed : float = 100.0 # Units per second

    @editable
    RaiseDistance : float = 1000.0 # Total distance to raise in units

    var IsMoving : logic = false

    OnBegin<override>()<suspends>:void=
        Timer.SuccessEvent.Subscribe(OnTimerComplete)

    OnTimerComplete(Agent:?agent):void =
        if (IsMoving = false):
            set IsMoving = true
            spawn{MoveLavaProp()}

    MoveLavaProp()<suspends>:void=
        StartTransform := LavaProp.GetTransform()
        StartPos := StartTransform.Translation
        EndPos := StartPos + vector3{X := 0.0, Y := 0.0, Z := RaiseDistance}
        Duration := RaiseDistance / RaiseSpeed

        var Elapsed : float = 0.0

        loop:
            if (Elapsed >= Duration):
                break
            Alpha := Elapsed / Duration
            NewPos := Lerp(StartPos, EndPos, Alpha)
            if (LavaProp.TeleportTo[NewPos, StartTransform.Rotation]):
                Sleep(0.0)
            set Elapsed += 0.016 # ~60fps

        # Ensure final position
        if (LavaProp.TeleportTo[EndPos, StartTransform.Rotation]) {}
        set IsMoving = false
