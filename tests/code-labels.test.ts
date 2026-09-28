/**
 * Code labels (blocks that read like Verse) only change what blocks show, never the code.
 * This file turns code labels on for the whole test process.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import Blockly from '../src/engine/blockly.ts';
import golden from './fixtures/golden.json' with { type: 'json' };
import type { BlockState } from '../src/engine/types.ts';
import { engine, generateFrom, signature, workspace } from './helpers.ts';

engine.setLabelStyle('code');

const labelsOf = (b: InstanceType<typeof Blockly.Block>) =>
  b.inputList.flatMap(i => i.fieldRow).filter(f => f instanceof Blockly.FieldLabel).map(f => String(f.getValue())).join(' ');

test('every toolbox block still loads', () => {
  const ws = workspace();
  for (const cat of engine.TOOLBOX.contents) for (const item of cat.contents) {
    if (item.kind === 'block') Blockly.serialization.blocks.append(item as never, ws);
  }
  assert.ok(ws.getAllBlocks(false).length > 40);
});

test('generated Verse is identical to the golden outputs', () => {
  const G = golden as unknown as { solutions: Record<string, BlockState>; generated: Record<string, unknown> };
  for (const [name, block] of Object.entries(G.solutions)) {
    assert.deepEqual(signature(generateFrom({ blocks: { languageVersion: 0, blocks: [block] } })), G.generated[name], name);
  }
});

test('blocks read like Verse', () => {
  const ws = workspace();
  const make = (type: string) => { const b = ws.newBlock(type); return labelsOf(b); };
  assert.match(make('verse_print'), /^Print\( \)$/);
  assert.match(make('verse_if'), /^if \( \):$/);
  assert.match(make('verse_handler'), /\( \):void =$/);
  assert.match(make('verse_device'), /OnBegin<override>\(\)<suspends>:void =/);
  assert.match(make('verse_sleep'), /Sleep\( \)/);
  assert.match(make('verse_loop'), /^loop:$/);
});
