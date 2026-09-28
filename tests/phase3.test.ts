/**
 * Phase 3 (data): arrays, maps, options, function inputs/results, <decides>.
 * Each program is built from blocks; the tests check the Verse it writes and the warnings.
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { BlockState } from '../src/engine/types.ts';
import { generateFrom, reconvert } from './helpers.ts';

type Inputs = NonNullable<BlockState['inputs']>;
const B = (type: string, fields: BlockState['fields'] = {}, inputs?: Inputs): BlockState => ({ type, fields, ...(inputs ? { inputs } : {}) });
const stack = (...blocks: BlockState[]) => { blocks.forEach((b, i) => { if (blocks[i + 1]) b.next = { block: blocks[i + 1] }; }); return { block: blocks[0] }; };
const v = (block: BlockState) => ({ block });
const num = (n: number, type = 'int') => v(B('verse_number', { NUM: n, TYPE: type }));
const get = (name: string) => v(B('verse_get', { NAME: name }));
const text = (s: string) => v(B('verse_text', { TEXT: s }));
const print = (value: { block: BlockState }) => B('verse_print', {}, { TEXT: value });
const device = (inputs: Inputs) => ({ blocks: { languageVersion: 0 as const, blocks: [B('verse_device', { NAME: 'my_device' }, inputs)] } });
const button = B('verse_editable', { NAME: 'MyButton', DTYPE: 'button_device' });
const errors = (r: ReturnType<typeof generateFrom>) => r.warnings.filter(w => w.level === 'error').map(w => w.msg);

/** Generates, checks there are no errors, and checks it survives Verse → blocks → Verse unchanged. */
function clean(state: ReturnType<typeof device>) {
  const r = generateFrom(state);
  assert.deepEqual(errors(r), [], 'no errors');
  const again = reconvert(r.code);
  assert.equal(again.code, r.code, 'round trip');
  assert.deepEqual(again.raw, [], 'no raw blocks after converting back');
  return r.code;
}

describe('arrays', () => {
  test('declare, add, loop with index, read an item, length', () => {
    const code = clean(device({
      EDITABLES: stack(B('verse_array_field', { KIND: 'var', NAME: 'Scores', ELEM: 'int', VALUES: '3, 5, 8' })),
      ONBEGIN: stack(
        B('verse_array_add', { NAME: 'Scores' }, { VALUE: num(13) }),
        B('verse_for_each', { VAR: 'Score', KEYED: 'TRUE', KEY: 'Index' }, { COLLECTION: get('Scores'), DO: stack(print(get('Score'))) }),
        B('verse_if_bind', { VAR: 'First' }, { VALUE: v(B('verse_index', { NAME: 'Scores' }, { KEY: num(0) })), DO: stack(print(get('First'))) }),
        print(v(B('verse_length', { NAME: 'Scores' }))),
      ),
    }));
    assert.match(code, /^ {4}var Scores:\[\]int = array\{3, 5, 8\}$/m);
    assert.match(code, /^ {8}set Scores \+= array\{13\}$/m);
    assert.match(code, /^ {8}for \(Index -> Score : Scores\):\n {12}Print\("\{Score\}"\)$/m);
    assert.match(code, /^ {8}if \(First := Scores\[0\]\):\n {12}Print\("\{First\}"\)$/m);
    assert.match(code, /^ {8}Print\("\{Scores\.Length\}"\)$/m);
  });

  test('string arrays quote their values', () => {
    const r = generateFrom(device({ EDITABLES: stack(B('verse_array_field', { KIND: 'const', NAME: 'Names', ELEM: 'string', VALUES: 'Gold, "Silver, Bronze"' })) }));
    assert.match(r.code, /Names:\[\]string = array\{"Gold", "Silver, Bronze"\}/);
  });

  test('reading an item outside an if is an error', () => {
    const r = generateFrom(device({
      EDITABLES: stack(B('verse_array_field', { KIND: 'var', NAME: 'Scores', ELEM: 'int', VALUES: '' })),
      ONBEGIN: stack(print(v(B('verse_index', { NAME: 'Scores' }, { KEY: num(0) })))),
    }));
    assert.ok(errors(r).some(e => e.includes('can fail')), errors(r).join(' | '));
  });

  test('adding to a constant array is an error', () => {
    const r = generateFrom(device({
      EDITABLES: stack(B('verse_array_field', { KIND: 'const', NAME: 'Scores', ELEM: 'int', VALUES: '' })),
      ONBEGIN: stack(B('verse_array_add', { NAME: 'Scores' }, { VALUE: num(1) })),
    }));
    assert.ok(errors(r).some(e => e.includes('constant')));
  });
});

describe('maps (per-player scores)', () => {
  test('score each player who presses the button', () => {
    const scoreOf = v(B('verse_index', { NAME: 'PlayerScores' }, { KEY: v(B('verse_agent_value', { WHO: 'Agent' })) }));
    const code = clean(device({
      EDITABLES: stack(button, B('verse_map_field', { KIND: 'var', NAME: 'PlayerScores', KEY: 'agent', VAL: 'int' })),
      ONBEGIN: stack(B('verse_subscribe', { DEVICE: 'MyButton', EVENT: 'InteractedWithEvent', HANDLER: 'OnPressed' })),
      MEMBERS: stack(B('verse_handler', { NAME: 'OnPressed', PARAM: 'agent' }, {
        DO: stack(B('verse_if_bind', { VAR: 'Score' }, {
          VALUE: scoreOf,
          DO: stack(B('verse_set_index', { NAME: 'PlayerScores' }, {
            KEY: v(B('verse_agent_value', { WHO: 'Agent' })),
            VALUE: v(B('verse_arith', { OP: '+' }, { A: get('Score'), B: num(1) })),
          })),
          ELSE: stack(B('verse_set_index', { NAME: 'PlayerScores' }, { KEY: v(B('verse_agent_value', { WHO: 'Agent' })), VALUE: num(1) })),
        })),
      })),
    }));
    assert.match(code, /^ {4}var PlayerScores:\[agent\]int = map\{\}$/m);
    assert.match(code, /if \(Score := PlayerScores\[Agent\]\):\n {12}if \(set PlayerScores\[Agent\] = Score \+ 1\) \{\}\n {8}else:\n {12}if \(set PlayerScores\[Agent\] = 1\) \{\}/);
  });

  test('loop over a map with key and value', () => {
    const code = clean(device({
      EDITABLES: stack(B('verse_map_field', { KIND: 'var', NAME: 'Prices', KEY: 'string', VAL: 'int' })),
      ONBEGIN: stack(B('verse_for_each', { VAR: 'Price', KEYED: 'TRUE', KEY: 'Item' }, { COLLECTION: get('Prices'), DO: stack(print(get('Price'))) })),
    }));
    assert.match(code, /for \(Item -> Price : Prices\):/);
  });

  test('set with a body writes the if form', () => {
    const r = generateFrom(device({
      EDITABLES: stack(B('verse_map_field', { KIND: 'var', NAME: 'Prices', KEY: 'string', VAL: 'int' })),
      ONBEGIN: stack(B('verse_set_index', { NAME: 'Prices' }, { KEY: text('Gold'), VALUE: num(100), DO: stack(print(text('Added'))) })),
    }));
    assert.match(r.code, /if \(set Prices\["Gold"\] = 100\):\n {12}Print\("Added"\)/);
  });
});

describe('options', () => {
  test('remember a winner, then use them if there is one', () => {
    const code = clean(device({
      EDITABLES: stack(button, B('verse_option_field', { NAME: 'Winner', TYPE: 'agent' })),
      ONBEGIN: stack(
        B('verse_subscribe', { DEVICE: 'MyButton', EVENT: 'InteractedWithEvent', HANDLER: 'OnPressed' }),
        B('verse_if_bind', { VAR: 'W' }, { VALUE: v(B('verse_option_value', { NAME: 'Winner' })), DO: stack(print(text('We have a winner'))) }),
      ),
      MEMBERS: stack(B('verse_handler', { NAME: 'OnPressed', PARAM: 'agent' }, {
        DO: stack(B('verse_set', { NAME: 'Winner', OP: '=' }, { V: v(B('verse_make_option', {}, { VALUE: v(B('verse_agent_value', { WHO: 'Agent' })) })) })),
      })),
    }));
    assert.match(code, /^ {4}var Winner:\?agent = false$/m);
    assert.match(code, /set Winner = option\{Agent\}/);
    assert.match(code, /if \(W := Winner\?\):/);
  });
});

describe('functions with inputs and results', () => {
  const fns = () => stack(
    B('verse_function', { NAME: 'Double', PARAMS: 'X:int', RET: 'int' }, {
      DO: stack(B('verse_check', {}, { VALUE: v(B('verse_arith', { OP: '*' }, { A: get('X'), B: num(2) })) })),
    }),
    B('verse_function', { NAME: 'IsHighScore', PARAMS: 'Score:int', RET: 'void', DECIDES: 'TRUE' }, {
      DO: stack(B('verse_check', {}, { VALUE: v(B('verse_compare', { OP: '>=' }, { A: get('Score'), B: num(10) })) })),
    }),
    B('verse_function', { NAME: 'Half', PARAMS: 'X:float', RET: 'float' }, {
      DO: stack(B('verse_return', {}, { VALUE: v(B('verse_arith', { OP: '*' }, { A: get('X'), B: num(0.5, 'float') })) })),
    }),
  );

  test('inputs, implicit result, <decides>, return, and calls', () => {
    const code = clean(device({
      EDITABLES: stack(B('verse_field', { KIND: 'var', NAME: 'Hits', TYPE: 'int', VALUE: '12' })),
      ONBEGIN: stack(
        print(v(B('verse_call_value', { NAME: 'Double' }, { A1: get('Hits') }))),
        B('verse_if', {}, { COND: v(B('verse_call_decides', { NAME: 'IsHighScore' }, { A1: get('Hits') })), DO: stack(print(text('High score!'))) }),
      ),
      MEMBERS: fns(),
    }));
    assert.match(code, /^ {4}Double\(X:int\):int =\n {8}X \* 2$/m);
    assert.match(code, /^ {4}IsHighScore\(Score:int\)<decides><transacts>:void =\n {8}Score >= 10$/m);
    assert.match(code, /^ {4}Half\(X:float\):float =\n {8}return X \* 0\.5$/m);
    assert.match(code, /Print\("\{Double\(Hits\)\}"\)/);
    assert.match(code, /if \(IsHighScore\[Hits\]\):/);
  });

  test('wrong number of inputs, and calling <decides> without [ ], are errors', () => {
    const r = generateFrom(device({
      ONBEGIN: stack(
        B('verse_call_fn', { NAME: 'Double' }),
        print(v(B('verse_call_value', { NAME: 'IsHighScore' }, { A1: num(3) }))),
      ),
      MEMBERS: fns(),
    }));
    const e = errors(r).join(' | ');
    assert.match(e, /Double takes 1 input, but 0 are plugged in/);
    assert.match(e, /IsHighScore is <decides>.*square brackets/);
  });

  test('<decides> together with <suspends> is an error', () => {
    const r = generateFrom(device({ MEMBERS: stack(B('verse_function', { NAME: 'F', SUSPENDS: 'TRUE', DECIDES: 'TRUE' }, { DO: stack(print(text('x'))) })) }));
    assert.ok(errors(r).some(e => e.includes("can't be both")));
  });
});

describe('@editable device arrays', () => {
  test('loop over every target and use each one', () => {
    const code = clean(device({
      EDITABLES: stack(B('verse_editable_array', { NAME: 'Targets', DTYPE: 'shooting_range_target_device' })),
      ONBEGIN: stack(B('verse_for_each', { VAR: 'T', KEYED: 'FALSE', KEY: 'Key' }, {
        COLLECTION: get('Targets'),
        DO: stack(
          B('verse_call_device', { DEVICE: 'T', METHOD: 'PopDown()', WHO: 'Agent' }),
          B('verse_subscribe', { DEVICE: 'T', EVENT: 'KnockdownEvent', HANDLER: 'OnHit' }),
        ),
      })),
      MEMBERS: stack(B('verse_handler', { NAME: 'OnHit', PARAM: 'none' }, { DO: stack(print(text('Hit!'))) })),
    }));
    assert.match(code, /^ {4}@editable\n {4}Targets:\[\]shooting_range_target_device = array\{\}$/m);
    assert.match(code, /for \(T : Targets\):\n {12}T\.PopDown\(\)\n {12}T\.KnockdownEvent\.Subscribe\(OnHit\)/);
  });
});

// ---------------------------------------------------------------------------------------
import Blockly from '../src/engine/blockly.ts';
import { engine, workspace } from './helpers.ts';

describe('lessons 12–15 accept a model solution', () => {
  const lesson = (title: string) => engine.LESSONS.find(l => l.title === title)!;
  const pressed = (body: BlockState[]) => ({
    EDITABLES: undefined as unknown,
    ONBEGIN: stack(B('verse_subscribe', { DEVICE: 'MyButton', EVENT: 'InteractedWithEvent', HANDLER: 'OnPressed' })),
    MEMBERS: stack(B('verse_handler', { NAME: 'OnPressed', PARAM: 'agent' }, { DO: stack(...body) })),
  });
  const agentKey = () => v(B('verse_agent_value', { WHO: 'Agent' }));

  test('Lists of things', () => {
    const r = generateFrom(device({
      EDITABLES: stack(B('verse_array_field', { KIND: 'var', NAME: 'Scores', ELEM: 'int', VALUES: '3, 5, 8' })),
      ONBEGIN: stack(B('verse_array_add', { NAME: 'Scores' }, { VALUE: num(13) }),
        B('verse_for_each', { VAR: 'Item', KEYED: 'FALSE', KEY: 'Key' }, { COLLECTION: get('Scores'), DO: stack(print(get('Item'))) })),
    }));
    assert.ok(lesson('Lists of things').check(r.code, r), r.code);
  });

  test('Score every player', () => {
    const p = pressed([B('verse_if_bind', { VAR: 'Score' }, {
      VALUE: v(B('verse_index', { NAME: 'PlayerScores' }, { KEY: agentKey() })),
      DO: stack(B('verse_set_index', { NAME: 'PlayerScores' }, { KEY: agentKey(), VALUE: v(B('verse_arith', { OP: '+' }, { A: get('Score'), B: num(1) })) })),
      ELSE: stack(B('verse_set_index', { NAME: 'PlayerScores' }, { KEY: agentKey(), VALUE: num(1) })),
    })]);
    const r = generateFrom(device({ ...p, EDITABLES: stack(button, B('verse_map_field', { KIND: 'var', NAME: 'PlayerScores', KEY: 'agent', VAL: 'int' })) } as never));
    assert.deepEqual(errors(r), []);
    assert.ok(lesson('Score every player').check(r.code, r), r.code);
  });

  test('Maybe a winner', () => {
    const p = pressed([B('verse_if_bind', { VAR: 'W' }, {
      VALUE: v(B('verse_option_value', { NAME: 'Winner' })),
      DO: stack(print(text('We already have a winner'))),
      ELSE: stack(B('verse_set', { NAME: 'Winner', OP: '=' }, { V: v(B('verse_make_option', {}, { VALUE: agentKey() })) })),
    })]);
    const r = generateFrom(device({ ...p, EDITABLES: stack(button, B('verse_option_field', { NAME: 'Winner', TYPE: 'agent' })) } as never));
    assert.deepEqual(errors(r), []);
    assert.ok(lesson('Maybe a winner').check(r.code, r), r.code);
  });

  test('Functions that answer', () => {
    const r = generateFrom(device({
      ONBEGIN: stack(
        print(v(B('verse_call_value', { NAME: 'Double' }, { A1: num(21) }))),
        B('verse_if', {}, { COND: v(B('verse_call_decides', { NAME: 'IsHighScore' }, { A1: num(12) })), DO: stack(print(text('High score!'))) }),
      ),
      MEMBERS: stack(
        B('verse_function', { NAME: 'Double', PARAMS: 'X:int', RET: 'int' }, { DO: stack(B('verse_check', {}, { VALUE: v(B('verse_arith', { OP: '*' }, { A: get('X'), B: num(2) })) })) }),
        B('verse_function', { NAME: 'IsHighScore', PARAMS: 'Score:int', RET: 'void', DECIDES: 'TRUE' }, { DO: stack(B('verse_check', {}, { VALUE: v(B('verse_compare', { OP: '>=' }, { A: get('Score'), B: num(10) })) })) }),
      ),
    }));
    assert.deepEqual(errors(r), []);
    assert.ok(lesson('Functions that answer').check(r.code, r), r.code);
  });
});

describe('toolbox', () => {
  test('every toolbox block loads with the fields it is given', () => {
    const ws = workspace();
    for (const cat of engine.TOOLBOX.contents) {
      for (const item of cat.contents) {
        if (item.kind !== 'block') continue;
        const block = Blockly.serialization.blocks.append(item as never, ws);
        for (const [name, value] of Object.entries(item.fields ?? {})) {
          assert.ok(block.getField(name), `${cat.name}: ${item.type} has no field ${name}`);
          assert.equal(String(block.getFieldValue(name)), String(value), `${cat.name}: ${item.type}.${name}`);
        }
      }
    }
  });
});

describe('random item from a device array', () => {
  test('Targets[GetRandomInt(0, Targets.Length - 1)] becomes real blocks, and the item is usable as a device', () => {
    const src = `gallery := class(creative_device):

    @editable
    Targets:[]shooting_range_target_device = array{}

    OnBegin<override>()<suspends>:void=
        if (Target := Targets[GetRandomInt(0, Targets.Length - 1)]):
            Target.PopUp()
`;
    const parsed = engine.parseVerse(src);
    assert.ok(parsed.ok);
    assert.deepEqual(parsed.report.raw, []);
    const r = generateFrom(parsed.state);
    assert.deepEqual(errors(r), []);
    assert.match(r.code, /using \{ \/Verse\.org\/Random \}/);
    assert.match(r.code, /if \(Target := Targets\[GetRandomInt\(0, Targets\.Length - 1\)\]\):\n {12}Target\.PopUp\(\)/);
  });
});

describe('snippets (Text view palette)', () => {
  test('a block and what is inside it, without line markers', () => {
    const ws = workspace();
    const ifBlock = Blockly.serialization.blocks.append({
      type: 'verse_if', inputs: {
        COND: { block: { type: 'verse_compare', fields: { OP: '>=' }, inputs: { A: { block: { type: 'verse_get', fields: { NAME: 'Score' } } }, B: { block: { type: 'verse_number', fields: { NUM: 3, TYPE: 'int' } } } } } },
        DO: { block: { type: 'verse_print', inputs: { TEXT: { block: { type: 'verse_text', fields: { TEXT: 'Win' } } } } } },
      },
    } as never, ws);
    assert.equal(engine.snippetFor(ifBlock), 'if (Score >= 3):\n    Print("Win")');
    const value = Blockly.serialization.blocks.append({ type: 'verse_random', fields: { LO: 1, HI: 6 } } as never, ws);
    assert.equal(engine.snippetFor(value), 'GetRandomInt(1, 6)');
  });
});
