/**
 * Converter gaps closed after Phase 5: text with values anywhere, several conditions in one if,
 * else if chains, and general chains (.Field, .Call(), .Try[]). Each round-trips unchanged and
 * becomes blocks instead of raw Verse.
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { BlockState } from '../src/engine/types.ts';
import { engine, generateFrom } from './helpers.ts';

function convert(src: string) {
  const parsed = engine.parseVerse(src);
  assert.ok(parsed.ok, parsed.ok ? '' : parsed.error);
  const r = generateFrom(parsed.state);
  return { ...r, raw: parsed.report.raw, blocks: JSON.stringify(parsed.state), errors: r.warnings.filter(w => w.level === 'error').map(w => w.msg) };
}
/** OnPressed(Agent) holding these lines; the lines must come back exactly as written. */
function unchanged(lines: string[], members: string[] = []) {
  const body = lines.map(l => `        ${l}\n`).join('');
  const src = `my_device := class(creative_device):
    @editable
    MyButton:button_device = button_device{}
${members.map(l => `    ${l}\n`).join('')}
    OnBegin<override>()<suspends>:void =
        MyButton.InteractedWithEvent.Subscribe(OnPressed)

    OnPressed(Agent:agent):void =
${body}`;
  const r = convert(src);
  assert.ok(r.code.includes(body.trimEnd()), `unchanged:\n${r.code}`);
  assert.equal(convert(r.code).code, r.code, 'round trip');
  return r;
}

describe('text with values anywhere', () => {
  test('values at the start, middle and end, up to three', () => {
    const r = unchanged([
      'Print("You have {Coins} coins")',
      'Print("{Coins} vs {Coins}")',
      'Print("Round {Coins} of {Coins + 1}, go!")',
      'Print("Score: {Coins}")',
    ], ['var Coins:int = 0']);
    assert.deepEqual(r.raw, []);
    assert.ok(r.blocks.includes('"verse_text_multi"') && r.blocks.includes('"verse_text_join"'));
  });

  test('four values stay raw Verse, word for word', () => {
    const r = unchanged(['Print("{A}{B}{C}{D}")']);
    assert.deepEqual(r.raw, ['"{A}{B}{C}{D}"']);
  });

  test('an empty value slot is reported', () => {
    const state = { blocks: { languageVersion: 0 as const, blocks: [{ type: 'verse_device', fields: { NAME: 'my_device' }, inputs: {
      ONBEGIN: { block: { type: 'verse_print', inputs: { TEXT: { block: { type: 'verse_text_multi', fields: { COUNT: '2', T0: 'A ', T1: ' B ', TEND: '' } } } } } },
    } }] } };
    assert.ok(generateFrom(state).warnings.some(w => w.msg.includes('Plug in value 1 of the text')));
  });
});

describe('several conditions in one if', () => {
  test('bindings and conditions together, with else; names count inside', () => {
    const r = unchanged([
      'if (Player := player[Agent], UI := GetPlayerUI[Player]):',
      '    MyGranter.GrantItem(Player)',
      'else:',
      '    Print("no UI")',
      'if (Score > 1, Char := Agent.GetFortCharacter[]):',
      '    Char.Heal(5.0)',
    ], ['@editable', 'MyGranter:item_granter_device = item_granter_device{}', 'var Score:int = 0']);
    assert.deepEqual(r.raw, []);
    assert.ok(r.blocks.includes('"verse_all"') && r.blocks.includes('"verse_bind"'));
    assert.deepEqual(r.errors, [], 'Player made in the condition counts, even for a later part');
  });
});

describe('else if', () => {
  test('a chain of else if, ending with else, stays a chain', () => {
    const r = unchanged([
      'if (Score > 10):',
      '    Print("big")',
      'else if (Score > 5):',
      '    Print("medium")',
      'else if (FortChar := Agent.GetFortCharacter[]):',
      '    Print("has a character")',
      'else:',
      '    Print("small")',
      'if (Winner := MaybeWinner?):',
      '    Print("won")',
      'else if (Score = 0):',
      '    Print("no score")',
    ], ['var Score:int = 0', 'var MaybeWinner:?agent = false']);
    assert.deepEqual(r.raw, []);
  });

  test('an if alone inside an else is written as else if', () => {
    const inner: BlockState = { type: 'verse_if', inputs: { COND: { block: { type: 'verse_bool', fields: { V: 'true' } } }, DO: { block: { type: 'verse_print', inputs: { TEXT: { block: { type: 'verse_text', fields: { TEXT: 'b' } } } } } } } };
    const outer: BlockState = { type: 'verse_if_else', inputs: {
      COND: { block: { type: 'verse_bool', fields: { V: 'false' } } },
      DO: { block: { type: 'verse_print', inputs: { TEXT: { block: { type: 'verse_text', fields: { TEXT: 'a' } } } } } },
      ELSE: { block: inner } } };
    const r = generateFrom({ blocks: { languageVersion: 0, blocks: [{ type: 'verse_device', fields: { NAME: 'my_device' }, inputs: { ONBEGIN: { block: outer } } }] } });
    assert.match(r.code, /^ {8}else if \(true\):\n {12}Print\("b"\)$/m);
    // The else if line still maps to the inner if block (the Text view uses this to link lines and blocks).
    const line = r.lines.findIndex(l => l.trim() === 'else if (true):');
    assert.ok(Object.values(r.spans).some(([first]) => first === line), 'a block starts on the else if line');
  });
});

describe('chains', () => {
  test('fields, calls and failable calls after any value become blocks', () => {
    const r = unchanged([
      'Turned := Platform.GetTransform().Rotation.ApplyYaw(1.5)',
      'Platform.GetTransform().Rotation.ApplyYaw(1.5)',
      'if (Char := Agent.GetFortCharacter[]):',
      '    Print("{Char.GetHealth()}")',
      'Size := Platform.GetTransform().Scale.Z',
    ], ['@editable', 'Platform:creative_prop = creative_prop{}']);
    assert.deepEqual(r.raw, []);
    assert.ok(r.blocks.includes('"verse_chain"') && r.blocks.includes('"verse_do"'));
  });

  test('a failable chain outside an if is reported', () => {
    const r = unchanged(['Char := Agent.GetFortCharacter[]']);
    assert.ok(r.errors.some(e => e.includes('GetFortCharacter[…] can fail')), r.errors.join(' | '));
  });

  test('A.B().C() is not mistaken for one call to B', () => {
    const r = unchanged(['Platform.GetTransform().Rotation.ApplyYaw(1.5)'], ['@editable', 'Platform:creative_prop = creative_prop{}']);
    assert.ok(!r.blocks.includes('"verse_method_call"'));
  });
});
