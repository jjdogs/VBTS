/**
 * Regression tests for bugs found in a review of the engine. Each test names what used to go wrong.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { BlockState } from '../src/engine/types.ts';
import { engine, generateFrom, reconvert } from './helpers.ts';

type Inputs = NonNullable<BlockState['inputs']>;
const B = (type: string, fields: BlockState['fields'] = {}, inputs?: Inputs): BlockState => ({ type, fields, ...(inputs ? { inputs } : {}) });
const v = (block: BlockState) => ({ block });
const workspace = (...blocks: BlockState[]) => ({ blocks: { languageVersion: 0 as const, blocks } });
const errors = (r: ReturnType<typeof generateFrom>) => r.warnings.filter(w => w.level === 'error').map(w => w.msg);
const fromText = (src: string) => {
  const parsed = engine.parseVerse(src);
  assert.ok(parsed.ok);
  return generateFrom(parsed.state);
};
/** A device whose OnBegin holds these lines (indented 8 spaces), with optional members. */
const device = (body: string[], members: string[] = []) =>
  `my_device := class(creative_device):\n${members.map(l => `    ${l}\n`).join('')}\n    OnBegin<override>()<suspends>:void =\n${body.map(l => `        ${l}\n`).join('')}`;

test('lesson 9 accepts a correct solution (its check used to match a literal backslash)', () => {
  const lesson = engine.LESSONS.find(l => l.title === 'Target timer')!;
  const code = 'SpawnTargets()<suspends>:void =\n    loop:\n        Print("Target {GetRandomInt(1, 8)}")\n        Sleep(2.0)\nspawn{SpawnTargets()}';
  assert.ok(lesson.check(code));
});

test('calling a function that takes one agent (and is never subscribed) is not an error', () => {
  const r = fromText(`${device(['for (P : GetPlayspace().GetPlayers()):', '    Greet(P)'])}
    Greet(Who:agent):void =
        Print("hi")
`);
  assert.deepEqual(errors(r).filter(e => e.includes('Greet')), []);
});

test('style 6.2 does not suggest <private> for a field a subclass uses', () => {
  const r = fromText(`pet := class:
    Name:string = "x"

cat := class(pet):
    Speak():void =
        Print(Name)

${device(['C := cat{}'])}`);
  assert.ok(!r.warnings.some(w => w.msg.includes('Name is only used inside pet')), r.warnings.map(w => w.msg).join(' | '));
});

test('the HUD text block warns about a missing or non-HUD device', () => {
  const hud = (name: string) => B('verse_hud_text', { DEVICE: name }, { TEXT: v(B('verse_text', { TEXT: 'hi' })) });
  const missing = generateFrom(workspace(B('verse_device', { NAME: 'my_device' }, { ONBEGIN: v(hud('Nope')) })));
  assert.ok(errors(missing).some(e => e.includes('No @editable device named Nope')));
  const button = B('verse_editable', { NAME: 'Board', DTYPE: 'button_device' });
  const wrong = generateFrom(workspace(B('verse_device', { NAME: 'my_device' }, { EDITABLES: v(button), ONBEGIN: v(hud('Board')) })));
  assert.ok(errors(wrong).some(e => e.includes('Board is a button_device')));
});

test('the MakeMessage helper is only written into the device that uses it', () => {
  const hud = B('verse_editable', { NAME: 'Hud', DTYPE: 'hud_message_device' });
  const set = B('verse_hud_text', { DEVICE: 'Hud' }, { TEXT: v(B('verse_text', { TEXT: 'hi' })) });
  const r = generateFrom(workspace(
    B('verse_device', { NAME: 'dev_a' }, { EDITABLES: v(hud), ONBEGIN: v(set) }),
    B('verse_device', { NAME: 'dev_b' }),
  ));
  assert.equal(r.code.match(/MakeMessage<localizes>/g)?.length, 1);
});

test('string escapes blocks cannot write back are kept word for word', () => {
  const src = device(['Print("Line 1\\nLine 2")', 'Print("Braces \\{ok\\}")'], ['var Motto:string = "a\\tb"']);
  const r = reconvert(src);
  assert.match(r.code, /Print\("Line 1\\nLine 2"\)/);
  assert.match(r.code, /Print\("Braces \\\{ok\\\}"\)/);
  assert.match(r.code, /var Motto:string = "a\\tb"/);
  assert.equal(reconvert(r.code).code, r.code);
});

test('math only adds the parentheses it needs', () => {
  const r = reconvert(device(['set Score = A + B + C', 'set Score = A - (B - C)', 'set Score = (A + B) * C', 'set Score = A * B * C'], ['var Score:int = 0']));
  assert.match(r.code, /set Score = A \+ B \+ C$/m);
  assert.match(r.code, /set Score = A - \(B - C\)$/m);
  assert.match(r.code, /set Score = \(A \+ B\) \* C$/m);
  assert.match(r.code, /set Score = A \* B \* C$/m);
});

test('not follows Verse precedence: it binds tighter than a comparison', () => {
  // Verse reads `not A = B` as `(not A) = B`, so the converter keeps that meaning…
  const r = reconvert(device(['if (not A = B):', '    Print("x")', 'if (not (A = B)):', '    Print("y")', 'if (not IsReady?):', '    Print("z")']));
  assert.match(r.code, /if \(not A = B\):/);
  assert.match(r.code, /if \(not \(A = B\)\):/);
  assert.match(r.code, /if \(not IsReady\?\):/);
  assert.equal(reconvert(r.code).code, r.code);
  // …and "not" around a comparison block is written with the parentheses it needs.
  const cmp = B('verse_compare', { OP: '=' }, { A: v(B('verse_get', { NAME: 'A' })), B: v(B('verse_get', { NAME: 'B' })) });
  const blocks = generateFrom(workspace(B('verse_device', { NAME: 'my_device' }, {
    ONBEGIN: v(B('verse_if', {}, { COND: v(B('verse_not', {}, { A: v(cmp) })), DO: v(B('verse_print', {}, { TEXT: v(B('verse_text', { TEXT: 'x' })) })) })),
  })));
  assert.match(blocks.code, /if \(not \(A = B\)\):/);
});

test('a method result with four inputs becomes blocks', () => {
  const r = reconvert(device(['X := Pet.Pick(1, 2, 3, 4)']));
  const parsed = engine.parseVerse(device(['Print(Pet.Pick(1, 2, 3, 4))']));
  assert.ok(parsed.ok);
  assert.deepEqual(parsed.report.raw, []);
  assert.ok(r.code.includes('Pet.Pick(1, 2, 3, 4)'));
});

test('calling a function kept as raw Verse is not reported as missing', () => {
  // Function blocks have no <transacts> option, so this helper stays raw Verse; calls to it are fine in UEFN.
  const src = `using { /Fortnite.com/Devices }
using { /Verse.org/Simulation }

helper_device := class(creative_device):

    OnBegin<override>()<suspends>:void =
        if (AbsF(-2.0) > 1.0):
            Print("big")
        spawn{Wait()}

    Wait()<suspends><transacts>:void =
        Sleep(1.0)

    AbsF(X:float)<transacts>:float =
        var Result:float = X
        if (X < 0.0):
            set Result = 0.0 - X
        Result
`;
  const parsed = engine.parseVerse(src);
  assert.ok(parsed.ok);
  const r = generateFrom(parsed.state);
  assert.deepEqual(r.warnings.filter(w => w.msg.startsWith('No function named')).map(w => w.msg), []);
  assert.equal(r.code, src);
});

test('a raw function whose inputs use a qualified type is still a function', () => {
  // (/Verse.org/SpatialMath:)vector3 has brackets of its own; return inside it is fine.
  const src = `using { /Fortnite.com/Devices }
using { /Verse.org/Simulation }

pointer_device := class(creative_device):

    OnBegin<override>()<suspends>:void =
        Print("ready")

    OnPointer(Player:player, ScreenSpot:(/Verse.org/SpatialMath:)vector3):void =
        if (ScreenSpot.Left < 0.0):
            return
        Print("pointer")
`;
  const parsed = engine.parseVerse(src);
  assert.ok(parsed.ok);
  const r = generateFrom(parsed.state);
  assert.deepEqual(r.warnings.filter(w => w.msg.includes('return only works')).map(w => w.msg), []);
  assert.equal(r.code, src);
});
