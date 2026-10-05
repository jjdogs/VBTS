/**
 * "The floor is lava": a working device whose last `if (…) {}`, @editable numbers, divisions and
 * end-of-line comments used to stay raw Verse or get lost. They are blocks now, and come back as written.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { engine, generateFrom } from './helpers.ts';

function convert(src: string) {
  const parsed = engine.parseVerse(src);
  assert.ok(parsed.ok, parsed.ok ? '' : parsed.error);
  const r = generateFrom(parsed.state);
  return { ...r, report: parsed.report, blocks: JSON.stringify(parsed.state), errors: r.warnings.filter(w => w.level === 'error').map(w => w.msg) };
}
const device = (body: string, members = '') => `using { /Fortnite.com/Devices }
using { /Verse.org/Simulation }

my_device := class(creative_device):
${members}
    OnBegin<override>()<suspends>:void =
${body}
`;

describe('the floor is lava device', () => {
  const src = readFileSync(new URL('./fixtures/floor-is-lava.verse', import.meta.url), 'utf8');
  test('only Lerp (no block yet) stays raw Verse, and nothing needs fixing', () => {
    const r = convert(src);
    assert.deepEqual(r.report.raw, ['Lerp(StartPos, EndPos, Alpha)']);
    assert.deepEqual(r.errors, []);
  });
  test('every comment survives, on the line it was on', () => {
    const { code } = convert(src);
    for (const line of ['RaiseSpeed:float = 100.0 # Units per second', 'RaiseDistance:float = 1000.0 # Total distance to raise in units',
      'set Elapsed += 0.016 # ~60fps', '# Ensure final position']) assert.ok(code.includes(line), line);
    assert.ok(!convert(src).report.notes.some(n => /comment/.test(n)));
  });
  test('a second round trip changes nothing', () => {
    const once = convert(src).code;
    assert.equal(convert(once).code, once);
  });
});

describe('if (…) {}', () => {
  test('is an if block with nothing inside, written back the same way, with a tip instead of an error', () => {
    const r = convert(device('        if (Ready?) {}\n        Print("go")', '    var Ready:logic = false\n'));
    assert.ok(r.blocks.includes('"verse_if"'));
    assert.match(r.code, /^ {8}if \(Ready\?\) \{\}$/m);
    assert.deepEqual(r.errors, []);
    assert.ok(r.warnings.some(w => w.level === 'tip' && /Nothing runs when this succeeds/.test(w.msg)));
  });
});

describe('@editable numbers, text and logic', () => {
  test('become a variable block set to @editable', () => {
    const r = convert(device('        Print("{Speed}")', '    @editable\n    Speed:float = 2.5\n    @editable Name:string = "Lava"\n'));
    assert.equal(r.report.raw.length, 0);
    assert.match(r.code, /^ {4}@editable\n {4}Speed:float = 2\.5$/m);
    assert.match(r.code, /^ {4}@editable\n {4}Name:string = "Lava"$/m);
  });
  test('an @editable var stays raw Verse, word for word', () => {
    const r = convert(device('        Print("x")', '    @editable var Lives:int = 3\n'));
    assert.deepEqual(r.report.raw, ['@editable var Lives:int = 3']);
  });
});

describe('division', () => {
  test('floats divide anywhere; ints only where failure is handled', () => {
    const r = convert(device([
      '        Half := Total / 2.0',
      '        Bad := Count / 2',
      '        if (Ok := Count / 2):',
      '            Print("ok")',
    ].join('\n'), '    Total:float = 10.0\n    Count:int = 10\n'));
    assert.deepEqual(r.report.raw, []);
    assert.equal(r.errors.filter(e => /Dividing ints/.test(e)).length, 1, r.errors.join(' | '));
    assert.equal(convert(r.code).code, r.code);
  });
  test('brackets only where needed: (A + B) / C, A / (B * C), A * B / C', () => {
    const r = convert(device('        X := (A + B) / C\n        Y := A / (B * C)\n        Z := A * B / C', '    A:float = 1.0\n    B:float = 2.0\n    C:float = 4.0\n'));
    for (const line of ['X := (A + B) / C', 'Y := A / (B * C)', 'Z := A * B / C']) assert.ok(r.code.includes(line), line);
  });
});
