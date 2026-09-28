/**
 * Epic's Verse style guide: generated code follows the formatting rules, and names that don't
 * follow the naming rules get a "style" notice with a rename-everywhere fix.
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import Blockly from '../src/engine/blockly.ts';
import { toPascal, toSnake } from '../src/engine/style.ts';
import type { BlockState } from '../src/engine/types.ts';
import { engine, generateFrom, workspace } from './helpers.ts';

type Inputs = NonNullable<BlockState['inputs']>;
const B = (type: string, fields: BlockState['fields'] = {}, inputs?: Inputs): BlockState => ({ type, fields, ...(inputs ? { inputs } : {}) });
const stack = (...blocks: BlockState[]) => { blocks.forEach((b, i) => { if (blocks[i + 1]) b.next = { block: blocks[i + 1] }; }); return { block: blocks[0] }; };
const device = (inputs: Inputs, name = 'my_device') => ({ blocks: { languageVersion: 0 as const, blocks: [B('verse_device', { NAME: name }, inputs)] } });
const style = (r: ReturnType<typeof generateFrom>) => r.warnings.filter(w => w.level === 'style');

describe('formatting (guide section 3)', () => {
  test('function signatures have a space before = (3.2)', () => {
    const r = generateFrom(device({
      MEMBERS: stack(
        B('verse_handler', { NAME: 'OnPressed', PARAM: 'agent' }, { DO: stack(B('verse_comment', { TEXT: 'x' })) }),
        B('verse_function', { NAME: 'Double', PARAMS: 'X:int', RET: 'int' }, { DO: stack(B('verse_comment', { TEXT: 'x' })) }),
      ),
    }));
    assert.match(r.code, /^ {4}OnBegin<override>\(\)<suspends>:void =$/m);
    assert.match(r.code, /^ {4}OnPressed\(Agent:agent\):void =$/m);
    assert.match(r.code, /^ {4}Double\(X:int\):int =$/m);
    assert.doesNotMatch(r.code, /\S=$/m, 'no signature ends without a space before =');
  });

  test('attributes sit on their own line (9.1) and declarations keep identifier:type together (3.2)', () => {
    const r = generateFrom(device({ EDITABLES: stack(B('verse_editable', { NAME: 'MyButton', DTYPE: 'button_device' }), B('verse_field', { KIND: 'var', NAME: 'Score', TYPE: 'int', VALUE: '5' })) }));
    assert.match(r.code, /^ {4}@editable\n {4}MyButton:button_device = button_device\{\}$/m);
    assert.match(r.code, /^ {4}var Score:int = 5$/m);
  });

  test('every lesson starter and the template produce no style notices', () => {
    for (const l of engine.LESSONS) if (l.start) assert.deepEqual(style(generateFrom(l.start)), [], l.title);
    for (const t of engine.TEMPLATES) {
      const p = engine.parseVerse(t.verse);
      assert.ok(p.ok);
      assert.deepEqual(style(generateFrom(p.state)).map(w => w.msg), [], t.title);
    }
  });
});

describe('naming (guide sections 1, 2, 7, 8)', () => {
  test('case conversions', () => {
    assert.equal(toPascal('my_score'), 'MyScore');
    assert.equal(toPascal('score'), 'Score');
    assert.equal(toPascal('hitCount'), 'HitCount');
    assert.equal(toSnake('MyDevice'), 'my_device');
    assert.equal(toSnake('targetGallery'), 'target_gallery');
  });

  test('each rule fires with its guide section', () => {
    const r = generateFrom(device({
      EDITABLES: stack(B('verse_field', { KIND: 'var', NAME: 'score', TYPE: 'int', VALUE: '0' }), B('verse_field', { KIND: 'var', NAME: 'Ready', TYPE: 'logic', VALUE: 'false' })),
      MEMBERS: stack(
        B('verse_handler', { NAME: 'ButtonPressed', PARAM: 'agent' }, { DO: stack(B('verse_comment', { TEXT: 'x' })) }),
        B('verse_function', { NAME: 'WaitAsync', SUSPENDS: 'TRUE', PARAMS: 'amount:int' }, { DO: stack(B('verse_comment', { TEXT: 'x' })) }),
      ),
    }, 'ScoreDevice'));
    const msgs = style(r).map(w => w.msg).join('\n');
    assert.match(msgs, /guide 2\.1.*ScoreDevice should be score_device/);
    assert.match(msgs, /guide 2\.3.*variable score should be Score/);
    assert.match(msgs, /guide 1\.1.*IsReady/);
    assert.match(msgs, /guide 7\.1.*OnButtonPressed/);
    assert.match(msgs, /guide 8\.1.*Call it Wait/);
    assert.match(msgs, /guide 2\.3.*parameters.*amount should be Amount/);
    assert.equal(r.warnings.filter(w => w.level === 'error').length, 0, 'style problems are never errors');
  });

  test('decorated type names (1.2 / 2.4)', () => {
    const msgs = style(generateFrom(device({}, 'score_class'))).map(w => w.msg).join();
    assert.match(msgs, /guide 1\.2, 2\.4.*Just call it score/);
  });

  test('mixing return with an implicit result line (4.1)', () => {
    const r = generateFrom(device({
      MEMBERS: stack(B('verse_function', { NAME: 'Pick', PARAMS: 'X:int', RET: 'int' }, {
        DO: stack(
          B('verse_if', {}, { COND: { block: B('verse_compare', { OP: '>' }, { A: { block: B('verse_get', { NAME: 'X' }) }, B: { block: B('verse_number', { NUM: 3, TYPE: 'int' }) } }) }, DO: stack(B('verse_return', {}, { VALUE: { block: B('verse_number', { NUM: 1, TYPE: 'int' }) } })) }),
          B('verse_check', {}, { VALUE: { block: B('verse_number', { NUM: 0, TYPE: 'int' }) } }),
        ),
      })),
    }));
    assert.ok(style(r).some(w => w.msg.includes('guide 4.1')));
  });
});

describe('rename everywhere fix', () => {
  test('renames the declaration and every use, and fixes the notice', () => {
    const ws = workspace();
    Blockly.serialization.workspaces.load(device({
      EDITABLES: stack(B('verse_editable', { NAME: 'my_button', DTYPE: 'button_device' }), B('verse_field', { KIND: 'var', NAME: 'hits', TYPE: 'int', VALUE: '0' })),
      ONBEGIN: stack(B('verse_subscribe', { DEVICE: 'my_button', EVENT: 'InteractedWithEvent', HANDLER: 'OnPressed' })),
      MEMBERS: stack(
        B('verse_handler', { NAME: 'OnPressed', PARAM: 'agent' }, { DO: stack(B('verse_set', { NAME: 'hits', OP: '+=' }, { V: { block: B('verse_number', { NUM: 1, TYPE: 'int' }) } }), B('verse_call_fn', { NAME: 'Report' }, { A1: { block: B('verse_get', { NAME: 'hits' }) } })) }),
        B('verse_function', { NAME: 'Report', PARAMS: 'hits:int' }, { DO: stack(B('verse_print', {}, { TEXT: { block: B('verse_get', { NAME: 'hits' }) } })) }),
      ),
    }) as never, ws);
    let r = engine.generate(ws);
    for (let i = 0; i < 5; i++) {
      const fix = r.warnings.find(w => w.fix?.kind === 'rename')?.fix;
      if (!fix || fix.kind !== 'rename') break;
      engine.renameEverywhere(ws, fix.from, fix.to);
      r = engine.generate(ws);
    }
    assert.deepEqual(style(r).map(w => w.msg), []);
    assert.deepEqual(r.warnings.filter(w => w.level === 'error').map(w => w.msg), [], 'renaming breaks nothing');
    assert.match(r.code, /MyButton:button_device/);
    assert.match(r.code, /MyButton\.InteractedWithEvent\.Subscribe\(OnPressed\)/);
    assert.match(r.code, /set Hits \+= 1/);
    assert.match(r.code, /Report\(Hits:int\):void =\n {8}Print\("\{Hits\}"\)/);
  });
});
