/**
 * Round trips: blocks → Verse → blocks → Verse must come back identical.
 * This is what makes "Edit as text" safe.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import golden from './fixtures/golden.json' with { type: 'json' };
import type { BlockState } from '../src/engine/types.ts';
import { engine, generateFrom, reconvert } from './helpers.ts';

const solutions = (golden as unknown as { solutions: Record<string, BlockState> }).solutions;

for (const [name, block] of Object.entries(solutions)) {
  if (name === 'MISTAKES') continue; // contains a raw block on purpose
  test(`round trip: ${name}`, () => {
    const code = generateFrom({ blocks: { languageVersion: 0, blocks: [block] } }).code;
    const again = reconvert(code);
    assert.equal(again.code, code);
    assert.deepEqual(again.raw, [], 'everything became real blocks');
  });
}

for (const template of engine.TEMPLATES) {
  test(`template "${template.title}" converts fully and round-trips`, () => {
    const first = reconvert(template.verse);
    assert.deepEqual(first.raw, [], 'no raw blocks');
    assert.equal(reconvert(first.code).code, first.code);
  });
}
