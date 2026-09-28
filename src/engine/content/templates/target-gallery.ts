/**
 * Game-mode template: pop-up target gallery (aim trainer).
 *
 * The Verse below is loaded through the text → blocks converter, so this file also
 * works as a converter test. Shooting range targets send nothing when hit
 * (listenable(tuple()) in Epic's API), so the template counts hits in a variable.
 */
import type { Template } from '../../types.ts';

export const targetGallery: Template = {
  id: 'target_gallery',
  title: 'Pop-up target gallery',
  kind: 'Aim trainer',
  summary: 'Press a button to start a timed round. Targets pop up at random; knock down as many as you can before the timer runs out. Your hit count shows on screen.',
  teaches: 'Several devices working together, a round state (IsRoundActive), a background loop with spawn, and events that send nothing.',
  devices: [
    ['StartButton', 'button_device', 'Button', 'Put it where the player starts.'],
    ['RoundTimer', 'timer_device', 'Timer', 'Set the duration to 30 seconds and make sure it does not start by itself at game start.'],
    ['Target1', 'shooting_range_target_device', 'Shooting Range Target', 'Place in front of the player.'],
    ['Target2', 'shooting_range_target_device', 'Shooting Range Target', 'Spread them out, left and right.'],
    ['Target3', 'shooting_range_target_device', 'Shooting Range Target', 'Try one farther away for a harder shot.'],
    ['Hud', 'hud_message_device', 'HUD Message', 'Shows the instructions and hit count.'],
  ],
  steps: [
    'In UEFN, open Verse Explorer, right-click your project and create a new Verse file named target_gallery.',
    'Replace everything in the new file with your code (Copy Verse), then save.',
    'Build it: Verse menu → Build Verse Code. Fix anything it reports.',
    'Place the devices listed above in your level and set them up as described.',
    'Find target_gallery in the Content Browser (your project’s Creative Devices folder) and drag it into the level.',
    'Select the target_gallery device. In Details, link each slot (StartButton, RoundTimer, Target1–3, Hud) to the device you placed.',
    'Give players a weapon, for example with an Item Granter or your island’s starting inventory.',
    'Launch Session, press the button, and start shooting. After code changes, use Push Verse Changes.',
  ],
  verse: `using { /Fortnite.com/Devices }  # for creative_device
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
    var IsRoundActive:logic = false

    OnBegin<override>()<suspends>:void =
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

    OnStart(Agent:agent):void =
        if (not IsRoundActive?):
            set Hits = 0
            set IsRoundActive = true
            StartButton.Disable()
            RoundTimer.Start()
            Hud.SetText(MakeMessage("Go! Knock down as many targets as you can."))
            Hud.Show()
            spawn{PopTargets()}

    # KnockdownEvent sends nothing, so this handler receives nothing
    OnTargetHit():void =
        if (IsRoundActive?):
            set Hits += 1
            Hud.SetText(MakeMessage("Hits: {Hits}"))
            Hud.Show()

    # SuccessEvent sends ?agent: the timer may finish with nobody attached
    OnRoundOver(MaybeAgent:?agent):void =
        set IsRoundActive = false
        Target1.PopDown()
        Target2.PopDown()
        Target3.PopDown()
        StartButton.Enable()
        Hud.SetText(MakeMessage("Time! Total hits: {Hits}"))
        Hud.Show()

    # Runs in the background during a round, popping up a random target
    PopTargets()<suspends>:void =
        loop:
            if (not IsRoundActive?):
                break
            set Pick = GetRandomInt(1, 3)
            if (Pick = 1):
                Target1.PopUp()
            if (Pick = 2):
                Target2.PopUp()
            if (Pick = 3):
                Target3.PopUp()
            Sleep(1.2)
`,
};
