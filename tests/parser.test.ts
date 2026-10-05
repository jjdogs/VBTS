/**
 * Focused converter tests: small inputs with one behavior each.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { engine, generateFrom } from './helpers.ts';

const wrap = (body: string, members = '') =>
  `my_device := class(creative_device):\n${members}\n    OnBegin<override>()<suspends>:void=\n${body.split('\n').map(l => '        ' + l).join('\n')}\n`;

const convert = (src: string) => {
  const r = engine.parseVerse(src);
  assert.ok(r.ok, 'parsed');
  return { report: r.report, code: generateFrom(r.state).code };
};

test('no device class gives a helpful error', () => {
  const r = engine.parseVerse('Print("hi")');
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.error, /class\(creative_device\)/);
});

test('unknown lines are kept word for word', () => {
  const { report, code } = convert(wrap('Frobnicate(1, 2)'));
  assert.deepEqual(report.raw, ['Frobnicate(1, 2)']);
  assert.match(code, /^ {8}Frobnicate\(1, 2\)$/m);
});

test('unknown line with a body keeps converting inside', () => {
  const { report, code } = convert(wrap('defer:\n    Print("x")'));
  assert.deepEqual(report.raw, ['defer:']);
  assert.match(code, /defer:\n {12}Print\("x"\)/);
});

test('an unknown value inside a known line only keeps that value raw', () => {
  const { report, code } = convert(wrap('if (P := Maybe.Value?):\n    Print("x")'));
  assert.deepEqual(report.raw, ['Maybe.Value?']);
  assert.match(code, /if \(P := Maybe\.Value\?\):\n {12}Print\("x"\)/);
});

test('operator precedence and parentheses survive', () => {
  const { code, report } = convert(wrap('if ((A + B) * 2 > 3 and not C?):\n    Print("ok")'));
  assert.deepEqual(report.raw, []);
  assert.match(code, /if \(\(A \+ B\) \* 2 > 3 and not C\?\):/);
});

test('handler input names are renamed and reported', () => {
  const src = wrap('B.InteractedWithEvent.Subscribe(H)', '    @editable\n    B:button_device = button_device{}') +
    '\n    H(Who:agent):void=\n        Print("{Who}")\n';
  const { report, code } = convert(src);
  assert.ok(report.notes.some(n => n.includes('from Who to Agent')));
  assert.match(code, /H\(Agent:agent\):void =\n {8}Print\("\{Agent\}"\)/);
});

test('comments are kept: on their own line, and at the end of a line (on that line\'s block)', () => {
  const { report, code } = convert(wrap('# keep me\nPrint("a")  # keep me too'));
  assert.ok(!report.notes.some(n => /comment/.test(n)), 'nothing was dropped');
  assert.match(code, /^ *# keep me$/m);
  assert.match(code, /^ *Print\("a"\) # keep me too$/m);
});

test('code outside the device and your types is skipped and reported', () => {
  const { report } = convert(wrap('Print("a")') + 'Helper():void =\n    Print("x")\n');
  assert.equal(report.skipped.length, 1);
});

test('each block knows which lines of the original text it came from', () => {
  // Messy on purpose: tab-free but odd spacing, a comment, no using lines.
  const src = [
    'my_device := class(creative_device):',      // 0
    '',                                          // 1
    '    var Hits : int = 0',                    // 2
    '',                                          // 3
    '    OnBegin<override>()<suspends>:void=',   // 4
    '        # say hi',                          // 5
    '        Print("hi")',                       // 6
    '        if (Hits > 2):',                    // 7
    '            set Hits = 0',                  // 8
    '        else:',                             // 9
    '            Print("low")',                  // 10
  ].join('\n');
  const r = engine.parseVerse(src);
  assert.ok(r.ok);
  if (!r.ok) return;
  const byType = (type: string, n = 0) => {
    const found: Array<[string, [number, number]]> = [];
    const walk = (b: { type: string; id?: string; inputs?: Record<string, { block?: unknown } | undefined>; next?: { block: unknown } }) => {
      if (b.type === type && b.id) found.push([b.id, r.sourceSpans[b.id]]);
      for (const i of Object.values(b.inputs ?? {})) if (i?.block) walk(i.block as never);
      if (b.next) walk(b.next.block as never);
    };
    r.state.blocks.blocks.forEach(b => walk(b as never));
    return found[n][1];
  };
  assert.deepEqual(byType('verse_device'), [0, 10]);
  assert.deepEqual(byType('verse_field'), [2, 2]);
  assert.deepEqual(byType('verse_comment'), [5, 5]);
  assert.deepEqual(byType('verse_print'), [6, 6]);
  assert.deepEqual(byType('verse_if_else'), [7, 10]);
  assert.deepEqual(byType('verse_set'), [8, 8]);
  assert.deepEqual(byType('verse_print', 1), [10, 10]);
});
