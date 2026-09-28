/**
 * Re-records tests/fixtures/golden.json from the current engine.
 *
 * Only run this after an INTENTIONAL change to what the engine outputs, then review the
 * differences (e.g. with `git diff tests/fixtures/golden.json`) before committing.
 *   npm run golden
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { engine, generateFrom, signature } from '../tests/helpers.ts';
import type { BlockState } from '../src/engine/types.ts';

const path = new URL('../tests/fixtures/golden.json', import.meta.url);
const golden = JSON.parse(readFileSync(path, 'utf8'));
const single = (b: BlockState) => ({ blocks: { languageVersion: 0 as const, blocks: [b] } });

for (const [name, block] of Object.entries(golden.solutions as Record<string, BlockState>)) {
  const r = generateFrom(single(block));
  golden.generated[name] = signature(r);
  if (name in golden.lessonChecks) golden.lessonChecks[name] = engine.LESSONS[Number(name.slice(1)) - 1].check(r.code, r);
}
golden.sources.template = engine.TEMPLATES[0].verse;
for (const [name, src] of Object.entries(golden.sources as Record<string, string>)) {
  const parsed = engine.parseVerse(src);
  if (!parsed.ok) throw new Error(`${name}: ${parsed.error}`);
  golden.parsed[name] = { report: parsed.report, gen: signature(generateFrom(parsed.state)) };
}
engine.LESSONS.forEach((lesson, i) => { if (lesson.start) golden.starters[`L${i + 1}`] = signature(generateFrom(lesson.start)); });
writeFileSync(path, JSON.stringify(golden, null, 1));
console.log('Re-recorded tests/fixtures/golden.json. Review the diff before committing.');
