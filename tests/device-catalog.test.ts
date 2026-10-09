/**
 * The device catalog (scripts/extract-devices.py): devices get what they inherit, the digest's
 * misplaced members land on the right device, and only devices you can place are listed.
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { engine, generateFrom } from './helpers.ts';

const cat = engine.CATALOG;

function convert(src: string) {
  const parsed = engine.parseVerse(src);
  assert.ok(parsed.ok, parsed.ok ? '' : parsed.error);
  const r = generateFrom(parsed.state);
  return { ...r, blocks: JSON.stringify(parsed.state), errors: r.warnings.filter(w => w.level === 'error').map(w => w.msg) };
}

describe('device catalog', () => {
  test('devices get the members of their parent devices', () => {
    assert.ok(cat.trigger_device.methods.includes('Enable()'), 'trigger_device inherits Enable from trigger_base_device');
    assert.ok(cat.trigger_device.methods.includes('Reset()'));
    assert.ok(cat.trigger_device.actions.includes('SetMaxTriggerCount(MaxCount:int)'));
    assert.ok(cat.damage_volume_device.methods.includes('Enable()'), 'from effect_volume_device');
    assert.ok(cat.health_powerup_device.methods.includes('Spawn()'), 'from powerup_device');
  });

  test('devices that only inherit are listed', () => {
    for (const d of ['visual_effect_powerup_device', 'basic_storm_controller_device', 'speaker_device', 'gameplay_camera_fixed_point_device'])
      assert.ok(cat[d], d);
  });

  test('vehicle spawners are listed, with the members they share', () => {
    const boat = cat.vehicle_spawner_boat_device;
    assert.equal(boat.events.SpawnedEvent, 'fort_vehicle');
    assert.ok(boat.methods.includes('AssignDriver(Agent)'));
    assert.ok(cat.vehicle_spawner_baller_device.methods.includes('RefillEnergy()'));
    assert.ok(!cat.vehicle_spawner_boat_device.methods.includes('RefillEnergy()'));
  });

  test('members the digest left nameless go to the right device', () => {
    assert.ok(!('PrimarySignalEvent' in cat.bouncer_device.events));
    assert.equal(cat.signal_remote_manager_device.events.PrimarySignalEvent, 'agent');
    assert.ok(!cat.dance_mannequin_device.methods.includes('ShowProps()'));
    assert.ok(cat.prop_manipulator_device.methods.includes('ShowProps()'));
  });

  test('devices newer than the 2024 digest are listed (from Epic\'s live reference)', () => {
    assert.equal(cat.vehicle_spawner_xwing_device.events.SpawnedEvent, 'fort_vehicle');
    assert.ok(cat.carryable_spawner_device, 'carryable_spawner_device');
  });

  test("events that send two values aren't offered with the wrong input", () => {
    assert.ok(!('ReleasedEvent' in cat.input_trigger_device.events), 'sends (agent, float)');
    assert.ok(!('RespondingButtonEvent' in cat.popup_dialog_device.events), 'sends (agent, int)');
  });

  test("events send what Epic's API digest declares", () => {
    assert.equal(cat.channel_device.events.ReceivedTransmitEvent, '?agent', 'was: nothing');
    assert.equal(cat.hud_message_device.events.ShowMessageEvent, 'agent', 'was: ?agent');
    assert.equal(cat.bank_vault_device.events.OpenEvent, '?agent', 'was: agent');
    assert.equal(cat.conversation_device.events.CancelEvent, 'agent', 'was: nothing');
    assert.equal(cat.disguise_device.events.ApplyDisguiseEvent, 'player');
    assert.ok(!('OnConversationEvent' in cat.conversation_device.events), 'sends (agent, int)');
  });

  test('a device stays listed when nothing is left to offer (saved projects may use it)', () => {
    assert.ok(cat.stat_creator_device);
  });

  test("abstract base devices aren't offered (they can't be placed)", () => {
    for (const d of ['trigger_base_device', 'vehicle_spawner_device', 'powerup_device', 'effect_volume_device', 'patchwork_device'])
      assert.ok(!(d in cat), d);
  });
});

describe('using the new catalog entries', () => {
  test('Enable on a trigger and a vehicle handler convert to blocks with no errors', () => {
    const src = `using { /Fortnite.com/Devices }
using { /Fortnite.com/Vehicles }
using { /Verse.org/Simulation }

garage_device := class(creative_device):
    @editable
    Gate : trigger_device = trigger_device{}
    @editable
    Boat : vehicle_spawner_boat_device = vehicle_spawner_boat_device{}

    OnBegin<override>()<suspends>:void =
        Gate.Enable()
        Boat.SpawnedEvent.Subscribe(OnBoat)

    OnBoat(Vehicle:fort_vehicle):void =
        Gate.Disable()
`;
    const r = convert(src);
    assert.deepEqual(r.errors, []);
    assert.ok(!r.blocks.includes('verse_raw'), 'no raw Verse blocks');
    assert.ok(r.code.includes('OnBoat(Vehicle:fort_vehicle):void ='));
    assert.ok(r.code.includes('using { /Fortnite.com/Vehicles }'));
  });
});

describe('value events from the digest', () => {
  test('participants joining, a character jumping and being healed convert to blocks and back', () => {
    const src = `using { /Fortnite.com/Devices }
using { /Fortnite.com/Characters }
using { /Fortnite.com/Game }
using { /Verse.org/Simulation }

jump_device := class(creative_device):

    OnBegin<override>()<suspends>:void =
        GetPlayspace().ParticipantAddedEvent().Subscribe(OnJoined)

    OnJoined(Agent:agent):void =
        if (FortChar := Agent.GetFortCharacter[]):
            FortChar.JumpedEvent().Subscribe(OnJumped)
            FortChar.HealedEvent().Subscribe(OnHealed)

    OnJumped(Character:fort_character):void =
        Print("jump")

    OnHealed(Result:healing_result):void =
        Print("healed")
`;
    const r = convert(src);
    assert.deepEqual(r.errors, []);
    assert.ok(!r.blocks.includes('verse_raw'), 'no raw Verse blocks');
    assert.ok(r.blocks.includes('"PARAM":"character"') && r.blocks.includes('"PARAM":"healing"'), 'event handler blocks, not plain functions');
    assert.equal(r.code, src);
  });

  test('a handler with the wrong input is flagged', () => {
    const r = convert(`using { /Fortnite.com/Devices }
using { /Fortnite.com/Characters }
using { /Verse.org/Simulation }

jump_device := class(creative_device):

    OnBegin<override>()<suspends>:void =
        GetPlayspace().PlayerAddedEvent().Subscribe(OnJoined)

    OnJoined(Player:player):void =
        if (FortChar := Player.GetFortCharacter[]):
            FortChar.JumpedEvent().Subscribe(OnJoined)
`);
    assert.ok(r.errors.some(e => e.includes('JumpedEvent')), r.errors.join('\n'));
  });
});

describe('device modules', () => {
  const band = (usings: string) => `${usings}
using { /Verse.org/Simulation }

band_device := class(creative_device):
    @editable
    Speaker : speaker_device = speaker_device{}

    OnBegin<override>()<suspends>:void =
        Speaker.Enable()
`;

  test('a Patchwork device needs its own using line', () => {
    const r = convert(band('using { /Fortnite.com/Devices }'));
    assert.ok(r.errors.some(e => e.includes('using { /Fortnite.com/Devices/Patchwork }')), r.errors.join('\n'));
  });

  test('with it, there is nothing to fix', () => {
    const r = convert(band('using { /Fortnite.com/Devices }\nusing { /Fortnite.com/Devices/Patchwork }'));
    assert.deepEqual(r.errors, []);
    assert.ok(!r.blocks.includes('verse_raw'), 'no raw Verse blocks');
  });
});
