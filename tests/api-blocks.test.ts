/**
 * Blocks for API from the Fortnite 42.30 digests: respawning, the lobby, random decimals,
 * shuffling, and prop animation (CreativeAnimation).
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { engine, generateFrom } from './helpers.ts';

function convert(src: string) {
  const parsed = engine.parseVerse(src);
  assert.ok(parsed.ok, parsed.ok ? '' : parsed.error);
  const r = generateFrom(parsed.state);
  return { ...r, blocks: JSON.stringify(parsed.state), errors: r.warnings.filter(w => w.level === 'error').map(w => w.msg) };
}

const src = `using { /Fortnite.com/Devices }
using { /Fortnite.com/Devices/CreativeAnimation }
using { /Fortnite.com/FortPlayerUtilities }
using { /Verse.org/Random }
using { /Verse.org/Simulation }
using { /UnrealEngine.com/Temporary/SpatialMath }

arena_device := class(creative_device):

    @editable
    Platform:creative_prop = creative_prop{}
    @editable
    StartPad:player_spawner_device = player_spawner_device{}
    @editable
    Exit:button_device = button_device{}
    var Targets:[]int = array{1, 2, 3}

    OnBegin<override>()<suspends>:void =
        Exit.InteractedWithEvent.Subscribe(OnExit)
        set Targets = Shuffle(Targets)
        Delay := GetRandomFloat(1.0, 3.0)
        Print("{Delay}")
        if (Animation := Platform.GetAnimationController[]):
            Animation.SetAnimation(array{keyframe_delta{DeltaLocation := vector3{X := 0.0, Y := 0.0, Z := 300.0}, DeltaRotation := IdentityRotation(), Time := 2.0}}, ?Mode := animation_mode.PingPong)
            Animation.Play()
            Sleep(10.0)
            Animation.Pause()

    OnExit(Agent:agent):void =
        Agent.Respawn(StartPad.GetTransform().Translation, IdentityRotation())
        if (Player := player[Agent]):
            Player.SendToLobby()
`;

describe('blocks for the digest API', () => {
  test('a program using all of them converts to blocks and back exactly', () => {
    const r = convert(src);
    assert.deepEqual(r.warnings.map(w => w.msg), []);
    assert.ok(!r.blocks.includes('verse_raw'), 'no raw Verse blocks');
    for (const type of ['verse_respawn', 'verse_send_to_lobby', 'verse_random_float', 'verse_shuffle', 'verse_anim_controller', 'verse_anim_set', 'verse_anim_control']) {
      assert.ok(r.blocks.includes(`"type":"${type}"`), type);
    }
    assert.equal(r.code, src);
  });

  for (const [module, why] of [
    ['/Fortnite.com/FortPlayerUtilities', 'Respawn'],
    ['/Fortnite.com/Devices/CreativeAnimation', 'GetAnimationController'],
    ['/Verse.org/Random', 'GetRandomFloat'],
  ]) {
    test(`without using { ${module} } there is an error that names it (${why})`, () => {
      const r = convert(src.replace(`using { ${module} }\n`, ''));
      assert.ok(r.errors.some(e => e.includes(`using { ${module} }`)), r.errors.join('\n'));
    });
  }

  test('play / pause / stop only become animation blocks on an animation controller', () => {
    const r = convert(src.replace('Exit.InteractedWithEvent.Subscribe(OnExit)', 'Exit.InteractedWithEvent.Subscribe(OnExit)\n        Music.Play()'));
    assert.equal((r.blocks.match(/"type":"verse_anim_control"/g) ?? []).length, 2, 'Music.Play() is not one');
  });

  test('SendToLobby on an agent is flagged: it needs a player', () => {
    const r = convert(src.replace('        if (Player := player[Agent]):\n            Player.SendToLobby()', '        Agent.SendToLobby()'));
    assert.ok(r.warnings.some(w => w.msg.includes('SendToLobby needs a player')), r.warnings.map(w => w.msg).join('\n'));
  });
});
