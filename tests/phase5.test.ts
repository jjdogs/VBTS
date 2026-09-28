/**
 * Phase 5.0 foundations: local values, new value types, casts, handlers that receive other
 * types, events of values (GetPlayspace()…), and device actions with inputs.
 * Each program is written as Verse, converted to blocks and back.
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { engine, generateFrom } from './helpers.ts';

/** Verse → blocks → Verse, with the raw pieces, notes and warnings. */
function convert(src: string) {
  const parsed = engine.parseVerse(src);
  assert.ok(parsed.ok, parsed.ok ? '' : parsed.error);
  const r = generateFrom(parsed.state);
  return { ...r, raw: parsed.report.raw, notes: parsed.report.notes, blocks: JSON.stringify(parsed.state), errors: r.warnings.filter(w => w.level === 'error').map(w => w.msg) };
}
/** A device with these members, and these lines in OnBegin. */
const device = (members: string[], begin: string[], extra = '') =>
  `my_device := class(creative_device):\n${members.map(l => `    ${l}\n`).join('')}\n    OnBegin<override>()<suspends>:void =\n${begin.map(l => `        ${l}\n`).join('')}${extra}`;
/** Converting the generated code again gives the same code. */
const stable = (code: string) => assert.equal(convert(code).code, code, 'round trip');

describe('local values', () => {
  test('Name := value, typed constants and vars become blocks', () => {
    const r = convert(device([], ['Bonus := 10', 'Speed:float = 2.5', 'var Count:int = 0', 'set Count += Bonus', 'Print("{Count}")']));
    assert.deepEqual(r.raw, []);
    assert.match(r.code, /^ {8}Bonus := 10$/m);
    assert.match(r.code, /^ {8}Speed:float = 2\.5$/m);
    assert.match(r.code, /^ {8}var Count:int = 0$/m);
    assert.deepEqual(r.errors, []);
    stable(r.code);
  });

  test('setting a local constant is an error; a var without a type gets a warning', () => {
    const r = convert(device([], ['Bonus := 10', 'set Bonus = 3']));
    assert.ok(r.errors.some(e => e.includes('Bonus is a constant')), r.errors.join(' | '));
    const noType = generateFrom({ blocks: { languageVersion: 0, blocks: [{ type: 'verse_device', fields: { NAME: 'my_device' }, inputs: {
      ONBEGIN: { block: { type: 'verse_local', fields: { KIND: 'var', NAME: 'Count', TYPE: '' }, inputs: { VALUE: { block: { type: 'verse_number', fields: { NUM: 0, TYPE: 'int' } } } } } },
    } }] } });
    assert.ok(noType.warnings.some(w => w.msg.includes('A var needs its type written out')));
  });

  test('a local array can be read with "if it exists"', () => {
    const r = convert(device([], ['var Items:[]int = array{1, 2}', 'if (First := Items[0]):', '    Print("{First}")']));
    assert.ok(r.blocks.includes('"verse_index"'), 'Items[0] is a block');
    assert.deepEqual(r.errors, []);
    stable(r.code);
  });
});

describe('new value types', () => {
  test('fields of new types add their using lines', () => {
    const r = convert(device(['var Home:vector3 = vector3{}', 'var Squad:[]team = array{}', 'var Checkpoints:[player]vector3 = map{}'], ['Print("ready")']));
    assert.deepEqual(r.raw, []);
    assert.ok(r.blocks.includes('"verse_array_field"') && r.blocks.includes('"verse_map_field"'));
    assert.match(r.code, /using \{ \/UnrealEngine\.com\/Temporary\/SpatialMath \}/);
    assert.match(r.code, /using \{ \/Fortnite\.com\/Teams \}/);
    stable(r.code);
  });
});

describe('casts', () => {
  const src = device(['@editable', 'MyGranter:item_granter_device = item_granter_device{}', '@editable', 'MyButton:button_device = button_device{}'],
    ['MyButton.InteractedWithEvent.Subscribe(OnPressed)'], `
    OnPressed(Agent:agent):void =
        if (Player := player[Agent]):
            MyGranter.GrantItem(Player)
`);

  test('player[Agent] is a block, and names Player inside "if it exists"', () => {
    const r = convert(src);
    assert.deepEqual(r.raw, []);
    assert.ok(r.blocks.includes('"verse_cast"'));
    assert.deepEqual(r.errors, []);
    stable(r.code);
  });

  test('a cast outside a failure context is an error', () => {
    const r = convert(device([], ['Print("{player[Agent]}")']));
    assert.ok(r.errors.some(e => e.includes('player[…] can fail')), r.errors.join(' | '));
  });
});

describe('handlers that receive other types', () => {
  const src = device([], ['GetPlayspace().PlayerAddedEvent().Subscribe(OnPlayerAdded)'], `
    OnPlayerAdded(NewPlayer:player):void =
        Print("Welcome!")

    OnEliminated(Result:elimination_result):void =
        Print("Out!")
`);

  test('a subscribed player handler and its value event become blocks', () => {
    const r = convert(src);
    assert.deepEqual(r.raw, []);
    assert.ok(r.blocks.includes('"verse_subscribe_event"') && r.blocks.includes('"verse_playspace"'));
    assert.ok(r.blocks.includes('"PARAM":"player"'));
    assert.match(r.code, /OnPlayerAdded\(Player:player\):void =/);
    assert.ok(r.notes.some(n => n.includes('from NewPlayer to Player')));
    assert.deepEqual(r.errors, []);
    stable(r.code);
  });

  test('a function with an input of an event type that nothing subscribes stays a function', () => {
    const r = convert(src);
    assert.match(r.code, /OnEliminated\(Result:elimination_result\):void =/);
    assert.ok(!r.blocks.includes('"PARAM":"elimination"'));
  });

  test('the handler must receive what the event sends, with a one-click fix', () => {
    const r = convert(device([], ['GetPlayspace().PlayerAddedEvent().Subscribe(OnJoin)'], `
    OnJoin(Agent:agent):void =
        Print("hi")
`));
    const w = r.warnings.find(x => x.msg.includes('PlayerAddedEvent sends player'));
    assert.ok(w, r.warnings.map(x => x.msg).join(' | '));
    assert.equal(w!.fix?.label, 'Make OnJoin receive player (Player)');
  });

  test('an elimination handler adds its using line', () => {
    const r = convert(device(['@editable', 'Zone:mutator_zone_device = mutator_zone_device{}'], ['Zone.AgentEntersEvent.Subscribe(OnEnter)'], `
    OnEnter(Agent:agent):void =
        if (FortChar := Agent.GetFortCharacter[]):
            FortChar.EliminatedEvent().Subscribe(OnEliminated)

    OnEliminated(Result:elimination_result):void =
        Print("Out!")
`));
    assert.deepEqual(r.raw, []);
    assert.ok(r.blocks.includes('"PARAM":"elimination"'));
    assert.match(r.code, /using \{ \/Fortnite\.com\/Game \}/);
    assert.deepEqual(r.errors, []);
    stable(r.code);
  });
});

describe('device actions with inputs', () => {
  const members = ['@editable', 'Score:score_manager_device = score_manager_device{}', '@editable', 'Clock:timer_device = timer_device{}'];

  test('actions with values become blocks; overloads are picked by their number of inputs', () => {
    const r = convert(device(members, ['Score.SetScoreAward(10)', 'Clock.SetActiveDuration(30.0)'], `
    OnPressed(Agent:agent):void =
        Clock.SetActiveDuration(5.0, Agent)
`));
    assert.deepEqual(r.raw, []);
    assert.ok(r.blocks.includes('"ACTION":"SetScoreAward(Value:int)"'));
    assert.ok(r.blocks.includes('"ACTION":"SetActiveDuration(Time:float, Agent:agent)"'));
    assert.ok(r.blocks.includes('"ACTION":"SetActiveDuration(Time:float)"'));
    assert.deepEqual(r.errors, []);
    stable(r.code);
  });

  test('a missing value and a wrong device are reported', () => {
    const state = { blocks: { languageVersion: 0 as const, blocks: [{ type: 'verse_device', fields: { NAME: 'my_device' }, inputs: {
      EDITABLES: { block: { type: 'verse_editable', fields: { NAME: 'Btn', DTYPE: 'button_device' } } },
      ONBEGIN: { block: { type: 'verse_device_action', fields: { DEVICE: 'Btn', ACTION: 'SetScoreAward(Value:int)' } } },
    } }] } };
    const r = generateFrom(state);
    const msgs = r.warnings.map(w => w.msg);
    assert.ok(msgs.some(m => m.includes('Btn is a button_device, which has no action SetScoreAward')), msgs.join(' | '));
    assert.ok(msgs.some(m => m.includes('Plug in Value (an int) for SetScoreAward')), msgs.join(' | '));
    assert.match(r.code, /Btn\.SetScoreAward\(0\)/);
  });
});
