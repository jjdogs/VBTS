/**
 * Phase 4.2: projects with several files. Each file is generated on its own, with a summary of
 * the other files (engine.projectContext) so checks and the converter can see across them.
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { WorkspaceState } from '../src/engine/types.ts';
import { engine, generateFrom } from './helpers.ts';

/** Verse text → a file's saved blocks. */
const file = (name: string, src: string, others: Array<{ name: string; state: WorkspaceState }> = []) => {
  const parsed = engine.parseVerse(src, engine.projectContext(others));
  assert.ok(parsed.ok, `${name}: ${parsed.ok ? '' : parsed.error}`);
  return { name, state: parsed.state };
};
const errors = (r: ReturnType<typeof generateFrom>) => r.warnings.filter(w => w.level === 'error').map(w => w.msg);

const pets = file('pets', `pet := class:
    Name:string
    var Age:int = 0

game_state := enum{Waiting, Playing, Over}
`);

describe('projects with several files', () => {
  test('a file summary lists what it defines and uses', () => {
    const ctx = engine.projectContext([pets]);
    assert.equal(ctx.definitions.get('pet'), 'pets');
    assert.equal(ctx.definitions.get('game_state'), 'pets');
    assert.deepEqual(ctx.types.get('pet')!.fields.map(f => f.name), ['Name', 'Age']);
    assert.deepEqual(ctx.enums.get('game_state'), ['Waiting', 'Playing', 'Over']);
  });

  test('classes and enums from another file become blocks and are checked', () => {
    const main = file('main', `my_device := class(creative_device):
    var State:game_state = game_state.Waiting
    var MyPet:pet = pet{Name := "Scout"}

    OnBegin<override>()<suspends>:void =
        set MyPet = pet{Age := 3}
        set State = game_state.Paused
`, [pets]);
    const blocks = JSON.stringify(main.state);
    assert.ok(blocks.includes('"verse_construct"'), 'pet{…} is a block');
    assert.ok(blocks.includes('"verse_enum_value"'), 'game_state.Waiting is a block');
    const r = generateFrom(main.state, undefined, engine.projectContext([pets]));
    assert.ok(errors(r).some(e => e.includes('pet{…} needs a value for Name')), errors(r).join(' | '));
    assert.ok(errors(r).some(e => e.includes('game_state has no value Paused')), errors(r).join(' | '));
  });

  test('without the other file, the same code has no cross-file errors', () => {
    const lone = file('main', `my_device := class(creative_device):
    OnBegin<override>()<suspends>:void =
        set MyPet = pet{Age := 3}
`);
    assert.deepEqual(errors(generateFrom(lone.state)).filter(e => e.includes('pet')), []);
  });

  test('a name defined in two files is an error', () => {
    const again = file('again', `pet := class:
    Nickname:string = "x"
`);
    const r = generateFrom(again.state, undefined, engine.projectContext([pets]));
    assert.ok(errors(r).some(e => e.includes('pet is also defined in pets.verse')), errors(r).join(' | '));
  });

  test('style 6.2 does not suggest <private> for a member another file uses', () => {
    const user = file('user', `my_device := class(creative_device):
    OnBegin<override>()<suspends>:void =
        set MyPet = pet{Name := "Scout"}
        Print("{MyPet.Age}")
`, [pets]);
    const alone = generateFrom(pets.state);
    assert.ok(alone.warnings.some(w => w.msg.includes('Age is only used inside pet')), 'on its own, Age could be private');
    const together = generateFrom(pets.state, undefined, engine.projectContext([user]));
    assert.ok(!together.warnings.some(w => w.msg.includes('Age is only used inside pet')), together.warnings.map(w => w.msg).join(' | '));
  });

  test('rename fixes are not offered for names other files use', () => {
    const other = file('other', `my_device := class(creative_device):
    OnBegin<override>()<suspends>:void =
        Print("{high_score}")
`);
    const main = file('main', `my_device2 := class(creative_device):
    var high_score:int = 0
`);
    const style = (ctx?: ReturnType<typeof engine.projectContext>) =>
      generateFrom(main.state, undefined, ctx).warnings.find(w => w.msg.includes('high_score should be HighScore'));
    assert.ok(style()?.fix, 'rename offered for a file on its own');
    assert.equal(style(engine.projectContext([other]))?.fix, null);
  });
});
