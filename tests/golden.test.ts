/**
 * Golden tests: the engine must produce exactly what the original (pre-TypeScript) version did.
 * tests/fixtures/golden.json was recorded from that version. If you change the engine's output
 * on purpose, re-record it and review the differences.
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import golden from './fixtures/golden.json' with { type: 'json' };
import type { BlockState, WorkspaceState } from '../src/engine/types.ts';
import { engine, generateFrom, signature } from './helpers.ts';

const G = golden as unknown as {
  solutions: Record<string, BlockState>;
  generated: Record<string, unknown>;
  lessonChecks: Record<string, boolean>;
  parsed: Record<string, { report: unknown; gen: unknown }>;
  starters: Record<string, unknown>;
  sources: Record<string, string>;
};
const single = (block: BlockState): WorkspaceState => ({ blocks: { languageVersion: 0, blocks: [block] } });

describe('blocks → Verse matches the original', () => {
  for (const [name, block] of Object.entries(G.solutions)) {
    test(name, () => {
      const result = generateFrom(single(block));
      assert.deepEqual(signature(result), G.generated[name]);
      if (name in G.lessonChecks) {
        const lesson = engine.LESSONS[Number(name.slice(1)) - 1];
        assert.equal(lesson.check(result.code, result), G.lessonChecks[name], 'lesson check');
      }
    });
  }
});

describe('Verse → blocks matches the original', () => {
  for (const [name, source] of Object.entries(G.sources)) {
    test(name, () => {
      const parsed = engine.parseVerse(source);
      assert.ok(parsed.ok);
      assert.deepEqual(parsed.report, G.parsed[name].report, 'conversion report');
      assert.deepEqual(signature(generateFrom(parsed.state)), G.parsed[name].gen, 'regenerated Verse');
    });
  }
});

describe('lesson starters match the original', () => {
  engine.LESSONS.forEach((lesson, i) => {
    if (!lesson.start) return;
    test(`L${i + 1} ${lesson.title}`, () => {
      assert.deepEqual(signature(generateFrom(lesson.start!)), G.starters[`L${i + 1}`]);
    });
  });
});
