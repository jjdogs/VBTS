/**
 * Game-mode template: moving-platform parkour (Phase 5.2).
 *
 * A prop platform glides up and down forever (MoveTo in a spawned <suspends> loop). Touching the
 * checkpoint trigger saves where you are, in a [player]vector3 map; falling below FallHeight
 * teleports you back there. Like every template, it goes through the text → blocks converter.
 */
import type { Template } from '../../types.ts';

export const platformParkour: Template = {
  id: 'platform_parkour',
  title: 'Moving-platform parkour',
  kind: 'Obstacle course',
  summary: 'A platform rides up and down on its own. Touch the checkpoint to save your spot; fall off the course and you are teleported back to it.',
  teaches: 'Positions (vector3), where things are (GetTransform), moving a prop over time (MoveTo in a spawned loop), a [player]vector3 map of checkpoints, and teleporting (TeleportTo).',
  devices: [
    ['Platform', 'creative_prop', 'Any prop (a floor tile works well)', 'Place it where the ride starts; it moves 6 metres up from there.'],
    ['Checkpoint', 'trigger_device', 'Trigger', 'Put it on top of the platform\'s highest point, so players save their spot there.'],
  ],
  steps: [
    'Build a short course with a gap that needs the moving platform, above a drop (anything under Z = -500 counts as falling off).',
    'Open Verse Explorer, create a new Verse file named platform_parkour, paste your code (Copy Verse) and save.',
    'Build it: Verse menu → Build Verse Code. Fix anything it reports.',
    'Place the prop and trigger listed above, then drag platform_parkour from the Content Browser into the level.',
    'Select the platform_parkour device and link Platform and Checkpoint in the Details panel.',
    'Launch Session: ride the platform, touch the checkpoint, then jump off to test the teleport.',
  ],
  verse: `using { /Fortnite.com/Devices }  # for creative_device, creative_prop, trigger_device
using { /Verse.org/Simulation }  # for @editable, player, Sleep and 1 more
using { /UnrealEngine.com/Temporary/Diagnostics }  # for Print
using { /Fortnite.com/Characters }  # for GetFortCharacter
using { /UnrealEngine.com/Temporary/SpatialMath }  # for vector3, transform, IdentityRotation

platform_parkour := class(creative_device):

    @editable
    Platform:creative_prop = creative_prop{}
    @editable
    Checkpoint:trigger_device = trigger_device{}
    var Checkpoints:[player]vector3 = map{}
    FallHeight:float = -500.0

    OnBegin<override>()<suspends>:void =
        Checkpoint.TriggeredEvent.Subscribe(OnCheckpoint)
        spawn{MovePlatform()}
        loop:
            Sleep(0.5)
            for (Player : GetPlayspace().GetPlayers()):
                CheckFall(Player)

    # Moves the platform up and back down, forever
    MovePlatform()<suspends>:void =
        Start := Platform.GetTransform().Translation
        Top := vector3{X := Start.X, Y := Start.Y, Z := Start.Z + 600.0}
        loop:
            Platform.MoveTo(Top, IdentityRotation(), 3.0)
            Platform.MoveTo(Start, IdentityRotation(), 3.0)

    # Remembers where the player touched the checkpoint
    OnCheckpoint(MaybeAgent:?agent):void =
        if (Agent := MaybeAgent?):
            if (Player := player[Agent]):
                if (FortChar := Player.GetFortCharacter[]):
                    if (set Checkpoints[Player] = FortChar.GetTransform().Translation) {}

    # Fell below the course? Back to the last checkpoint
    CheckFall(Player:player):void =
        if (FortChar := Player.GetFortCharacter[]):
            if (FortChar.GetTransform().Translation.Z < FallHeight):
                if (Saved := Checkpoints[Player]):
                    if (FortChar.TeleportTo[Saved, IdentityRotation()]):
                        Print("Back to your checkpoint")
`,
};
