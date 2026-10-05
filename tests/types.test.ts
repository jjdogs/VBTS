/**
 * Phase 4.1: your own classes, structs and enums.
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { engine, generateFrom, reconvert } from './helpers.ts';

const PROGRAM = `using { /Fortnite.com/Devices }  # for creative_device, button_device
using { /Verse.org/Simulation }  # for @editable, agent

game_state := enum{Waiting, Playing, Over}

pet := class:
    Name:string
    var Age<private>:int = 0

    Birthday():void =
        set Age += 1

    GetAge():int =
        Age

cat := class(pet):
    Sound:string = "Meow"

point := struct:
    X:float = 0.0
    Y:float = 0.0

pet_device := class(creative_device):

    @editable
    MyButton:button_device = button_device{}
    var MyPet:pet = pet{Name := "Scout"}
    var State:game_state = game_state.Waiting

    OnBegin<override>()<suspends>:void =
        MyButton.InteractedWithEvent.Subscribe(OnPressed)
        set State = game_state.Playing
        if (State = game_state.Playing):
            Print("Playing!")

    OnPressed(Agent:agent):void =
        MyPet.Birthday()
        Print("{MyPet.GetAge()}")
        Print("{MyPet.Name}")
`;

describe('classes, structs and enums', () => {
  test('a whole program converts into real blocks and back unchanged', () => {
    const parsed = engine.parseVerse(PROGRAM);
    assert.ok(parsed.ok);
    if (!parsed.ok) return;
    assert.deepEqual(parsed.report.raw, [], 'everything became real blocks');
    assert.deepEqual(parsed.report.skipped, []);
    const r = generateFrom(parsed.state);
    assert.equal(r.code, PROGRAM);
    assert.deepEqual(r.warnings.filter(w => w.level === 'error').map(w => w.msg), []);
    assert.equal(reconvert(r.code).code, r.code);
  });

  test('which block each piece became', () => {
    const parsed = engine.parseVerse(PROGRAM);
    if (!parsed.ok) throw new Error();
    const types: string[] = [];
    const walk = (b: { type: string; inputs?: Record<string, { block?: unknown } | undefined>; next?: { block: unknown } }) => {
      types.push(b.type);
      for (const i of Object.values(b.inputs ?? {})) if (i?.block) walk(i.block as never);
      if (b.next) walk(b.next.block as never);
    };
    parsed.state.blocks.blocks.forEach(b => walk(b as never));
    for (const t of ['verse_enum', 'verse_class', 'verse_member_field', 'verse_enum_value', 'verse_method_call', 'verse_method_value', 'verse_member_get', 'verse_function']) {
      assert.ok(types.includes(t), t);
    }
  });

  test('making an object checks its fields', () => {
    const r = generateFrom({ blocks: { languageVersion: 0, blocks: [
      { type: 'verse_class', fields: { NAME: 'pet', KIND: 'class', SPEC: 'none', PARENT: '' }, inputs: { MEMBERS: { block: { type: 'verse_member_field', fields: { KIND: 'const', NAME: 'Name', VIS: 'none', TYPE: 'string', DEFAULT: '' } } } } },
      { type: 'verse_device', fields: { NAME: 'd' }, inputs: { ONBEGIN: { block: { type: 'verse_print', inputs: { TEXT: { block: { type: 'verse_member_get', fields: { OBJ: 'X', MEMBER: 'Y' } } } } } },
        EDITABLES: { block: { type: 'verse_member_field', fields: { KIND: 'const', NAME: 'P', VIS: 'none', TYPE: 'pet', DEFAULT: '' } } } } },
    ] } });
    assert.match(r.code, /^pet := class:\n {4}Name:string\n\nd := class\(creative_device\):/m, 'types come before devices');
    const r2 = generateFrom({ blocks: { languageVersion: 0, blocks: [
      { type: 'verse_class', fields: { NAME: 'pet', KIND: 'class', SPEC: 'none', PARENT: '' }, inputs: { MEMBERS: { block: { type: 'verse_member_field', fields: { KIND: 'const', NAME: 'Name', VIS: 'none', TYPE: 'string', DEFAULT: '' } } } } },
      { type: 'verse_device', fields: { NAME: 'd' }, inputs: { ONBEGIN: { block: { type: 'verse_print', inputs: { TEXT: { block: { type: 'verse_construct', fields: { TYPE: 'pet', F1: 'Nmae', F2: '', F3: '', F4: '' }, inputs: { V1: { block: { type: 'verse_text', fields: { TEXT: 'x' } } } } } } } } } } },
    ] } });
    const errs = r2.warnings.filter(w => w.level === 'error').map(w => w.msg).join(' | ');
    assert.match(errs, /needs a value for Name/);
    assert.match(errs, /pet has no field named Nmae/);
  });
});

describe('style for types', () => {
  test('type names snake_case (2.1), members PascalCase (2.3), enum values PascalCase', () => {
    const p = engine.parseVerse('MyPet := class:\n    name:string\n\nMode := enum{on_state, Off}\n');
    if (!p.ok) throw new Error(p.error);
    const msgs = generateFrom(p.state).warnings.filter(w => w.level === 'style').map(w => w.msg).join('\n');
    assert.match(msgs, /guide 2\.1.*MyPet should be my_pet/);
    assert.match(msgs, /guide 2\.1.*Mode should be mode/);
    assert.match(msgs, /guide 2\.3.*field name should be Name/);
    assert.match(msgs, /guide 2\.3.*enum values.*on_state should be OnState/);
  });

  test('6.2: <private> is suggested only for members nothing outside uses', () => {
    const p = engine.parseVerse(PROGRAM);
    if (!p.ok) throw new Error();
    const msgs = generateFrom(p.state).warnings.filter(w => w.msg.includes('6.2')).map(w => w.msg);
    // Name is used from the device (MyPet.Name, pet{Name := …}); Birthday and GetAge are called from it.
    assert.ok(!msgs.some(m => /\bName is only used/.test(m)), msgs.join(' | '));
    assert.ok(!msgs.some(m => /Birthday|GetAge/.test(m)), msgs.join(' | '));
    // Sound (in cat) is used by nothing outside: suggested. Age is already <private>: not suggested.
    assert.ok(msgs.some(m => /Sound is only used inside cat/.test(m)), msgs.join(' | '));
    assert.ok(!msgs.some(m => /\bAge is only used/.test(m)));
  });
});

describe('lessons 16–17 accept a model solution', () => {
  test('Your own class', () => {
    const src = `pet := class:
    Name:string
    var Age:int = 0

    Birthday():void =
        set Age += 1

my_device := class(creative_device):

    var MyPet:pet = pet{Name := "Scout"}

    OnBegin<override>()<suspends>:void =
        MyPet.Birthday()
        Print("{MyPet.Age}")
`;
    const p = engine.parseVerse(src); if (!p.ok) throw new Error(p.error);
    const r = generateFrom(p.state);
    assert.deepEqual(r.warnings.filter(w => w.level === 'error').map(w => w.msg), []);
    assert.ok(engine.LESSONS.find(l => l.title === 'Your own class')!.check(r.code, r), r.code);
  });

  test('Game states', () => {
    const src = `game_state := enum{Waiting, Playing, Over}

my_device := class(creative_device):

    var State:game_state = game_state.Waiting

    OnBegin<override>()<suspends>:void =
        set State = game_state.Playing
        if (State = game_state.Playing):
            Print("Playing!")
`;
    const p = engine.parseVerse(src); if (!p.ok) throw new Error(p.error);
    const r = generateFrom(p.state);
    assert.deepEqual(r.warnings.filter(w => w.level === 'error').map(w => w.msg), []);
    assert.ok(engine.LESSONS.find(l => l.title === 'Game states')!.check(r.code, r), r.code);
  });
});
