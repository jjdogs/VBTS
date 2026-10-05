/**
 * Code that compiles in UEFN must not be reported as broken. The voice chat example is from Epic's
 * docs: it keeps most of its code in plain classes (not the device), declares members Verse Blocks
 * has no block for (raw Verse), and builds on Epic API types Verse Blocks doesn't know.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { engine, generateFrom } from './helpers.ts';

function convert(src: string) {
  const parsed = engine.parseVerse(src);
  assert.ok(parsed.ok, parsed.ok ? '' : parsed.error);
  const r = generateFrom(parsed.state);
  return { ...r, blocks: JSON.stringify(parsed.state), errors: r.warnings.filter(w => w.level === 'error').map(w => w.msg), tips: r.warnings.filter(w => w.level === 'tip').map(w => w.msg) };
}
const device = (body: string, members = '', extra = '') => `using { /Fortnite.com/Devices }
using { /Verse.org/Simulation }

my_device := class(creative_device):
${members}
    OnBegin<override>()<suspends>:void =
${body}
${extra}`;

describe("Epic's voice chat example", () => {
  test('has nothing to fix', () => {
    const r = convert(readFileSync(new URL('./fixtures/voice-chat.verse', import.meta.url), 'utf8'));
    assert.deepEqual(r.errors, []);
    assert.ok(!r.tips.some(t => /AgentGroup|Chat/.test(t)), 'modules Verse Blocks does not know are not called unused');
  });
});

describe('names declared in classes and raw Verse', () => {
  test('a method with one input is a fine handler, in a class too', () => {
    const r = convert(device('        Print("hi")', '', `
helper := class:
    Init():void =
        Channel := MakeChannel()
        Channel.BeginEvent().Subscribe(OnStart)

    OnStart(Agent:agent):void =
        Print("start")
`));
    assert.deepEqual(r.errors, []);
    assert.ok(r.blocks.includes('"verse_subscribe_event"'), 'the subscribe is a real block, so it is checked');
  });

  test('set on a var written as raw Verse, and an @editable written as raw Verse', () => {
    const r = convert(`using { /Fortnite.com/Devices }
using { /Verse.org/Simulation }

watcher := class:
    @editable Trigger:trigger_device = trigger_device{}
    var Seen:?tuple(int, int) = false
    Mark():void =
        set Seen = false
        Trigger.Trigger()

my_device := class(creative_device):
    OnBegin<override>()<suspends>:void =
        Print("ready")
`);
    assert.deepEqual(r.errors, []);
  });

  test('return and inputs inside a raw Verse function header', () => {
    const r = convert(`using { /Fortnite.com/Devices }
using { /Verse.org/Simulation }

handler := class<abstract>:
    Pick<public>()<transacts>:tuple(?int, ?int)

picker := class(handler):
    @editable Trigger:trigger_device = trigger_device{}
    Pick<override>()<transacts>:tuple(?int, ?int) =
        return (option{1}, false)
    Fire<override>(Agent:agent)<transacts>:tuple(?int, ?int) =
        Trigger.Trigger(Agent)
        return (false, false)

my_device := class(creative_device):
    OnBegin<override>()<suspends>:void =
        Print("ready")
`);
    assert.deepEqual(r.errors, []);
  });
});

describe('classes', () => {
  test('a class with an Epic parent may set fields we cannot see; one with only our classes is still checked', () => {
    const r = convert(device('        Print("hi")', '', `
member_info := class(has_voice_member_info){}
base := class:
    Name:string = ""
child := class(base){}
`).replace('        Print("hi")', '        X := member_info{CanBroadcast := true}\n        Y := child{Name := "a", Nope := 1}'));
    assert.deepEqual(r.errors, ['child has no field named Nope.']);
  });

  test('an empty class is written with { } and round-trips', () => {
    const r = convert(device('        Print("hi")', '', '\nmember_info := class(has_voice_member_info):\n'));
    assert.match(r.code, /^member_info := class\(has_voice_member_info\)\{\}$/m);
    assert.deepEqual(r.errors, []);
    assert.equal(convert(r.code).code, r.code);
  });
});

describe('Print', () => {
  test('needs no using line: it is part of Verse itself (/Verse.org/Verse)', () => {
    const r = convert(device('        Print("hi")'));
    assert.deepEqual(r.errors, []);
    assert.doesNotMatch(r.code, /Diagnostics/);
  });
});
