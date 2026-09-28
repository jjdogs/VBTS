/**
 * Turns a whole workspace into a Verse file.
 *
 * Steps:
 *   1. Generate each device class (blocks add warnings and "needs" as they go).
 *   2. Work out the using lines: the user's own, plus any missing ones (auto mode),
 *      or warnings with one-click fixes (manual mode).
 *   3. Strip the hidden line markers, keeping a map of which lines each block wrote.
 */
import type { Block, Workspace } from '../blockly.ts';
import { MODULE_PATHS } from '../data/modules.ts';
import { DEFINING_BLOCKS, emptyProject, type ProjectContext } from '../project.ts';
import type { GenerateResult, LineSpan } from '../types.ts';
import { checkStyle } from '../style.ts';
import { countLines, MARK_COUNT, MARK_START, verse } from './verse-generator.ts';

const USING_BLOCKS = ['verse_using', 'verse_using_custom'];
const TYPE_BLOCKS = ['verse_class', 'verse_enum'];

const usingPathOf = (u: Block): string =>
  String(u.getFieldValue(u.type === 'verse_using' ? 'MODULE' : 'PATH') ?? '');

/** "a, b, c and 2 more" */
const summarize = (names: string[]): string =>
  names.length > 3 ? `${names.slice(0, 3).join(', ')} and ${names.length - 3} more` : names.join(', ');

/** Writes one file. `project` describes the project's other files (see project.ts). */
export function generate(ws: Workspace, project: ProjectContext = emptyProject()): GenerateResult {
  const g = verse;
  g.init();
  g.project = project;

  // ---- 1. device classes ----
  const tops = ws.getTopBlocks(true).filter(b => b.isEnabled());
  const devices = tops.filter(b => b.type === 'verse_device');
  const parts = devices.map(d => {
    const code = g.blockToCode(d) as string;
    return MARK_START + d.id + MARK_COUNT + countLines(code) + '\n' + code;
  });
  // Your own types (classes, structs, enums) are file-level too; they're written before the devices.
  const typeParts = tops.filter(b => TYPE_BLOCKS.includes(b.type)).map(t => {
    const code = g.blockToCode(t) as string;
    return MARK_START + t.id + MARK_COUNT + countLines(code) + '\n' + code;
  });
  tops.filter(b => b.type !== 'verse_device' && !USING_BLOCKS.includes(b.type) && !TYPE_BLOCKS.includes(b.type))
    .forEach(b => g.warn(b, 'This block is not inside a device, so it is not part of the code.'));
  tops.filter(b => USING_BLOCKS.includes(b.type))
    .forEach(b => g.warn(b, 'using blocks go in the "using" slot at the top of a device.'));
  // Files in a project share one module, so each name can only be defined once across them.
  for (const b of tops.filter(t => DEFINING_BLOCKS.includes(t.type))) {
    const name = String(b.getFieldValue('NAME') ?? '');
    const other = project.definitions.get(name);
    if (other) g.warn(b, `${name} is also defined in ${other}.verse. Files in a project share their names, so each name can only be made once. Rename one of them.`);
  }

  // ---- 2. using lines (they belong to the whole file, shared by every device) ----
  const manual: Block[] = [];
  for (const d of devices) {
    for (let u = d.getInputTargetBlock('USINGS'); u; u = u.getNextBlock()) if (u.isEnabled()) manual.push(u);
  }
  const auto = devices.length ? devices.some(d => d.getFieldValue('AUTO') === 'TRUE') : true;
  const seen = new Set<string>();
  const headLines: string[] = [];
  for (const u of manual) {
    const path = usingPathOf(u);
    if (seen.has(path)) {
      g.warn(u, `${path} is already imported above. One using line per module is enough.`, 'tip', { label: 'Remove duplicate', kind: 'delete' });
      continue;
    }
    seen.add(path);
    if (!g.needs.has(path)) {
      g.warn(u, `Nothing here uses ${path} yet. Unused using lines are harmless, but you can remove it.`, 'tip', { label: 'Remove it', kind: 'delete' });
    }
    headLines.push(MARK_START + u.id + MARK_COUNT + '1\n' + `using { ${path} }`);
  }
  const missing = [...g.needs.keys()].filter(p => !seen.has(p))
    .sort((a, b) => MODULE_PATHS.indexOf(a) - MODULE_PATHS.indexOf(b));
  for (const path of missing) {
    const why = summarize([...g.needs.get(path)!]);
    if (auto) {
      headLines.push(`using { ${path} }  # for ${why}`);
    } else if (devices[0]) {
      g.warn(devices[0], `Your code uses ${why}, which lives in ${path}. Add: using { ${path} }`, 'error',
        { label: `Add using { ${path} }`, kind: 'addUsing', path });
    }
  }
  // Epic's Verse style guide (naming, returns, …) — gentle "style" notices, never errors.
  checkStyle(ws, g);

  const head = headLines.join('\n') || '# (no using lines)';
  const code = devices.length || typeParts.length
    ? `${head}\n\n${[...typeParts, ...parts].join('\n')}`
    : `${head}\n\n# Drag a "device" block onto the workspace to start.\n`;

  // ---- 3. strip markers, remembering which lines each block produced ----
  const lines: string[] = [];
  const spans: Record<string, LineSpan> = {};
  const marker = new RegExp(`^\\s*${MARK_START}(.+)${MARK_COUNT}(\\d+)$`);
  for (const line of code.split('\n')) {
    const m = line.match(marker);
    if (m) spans[m[1]] = [lines.length, lines.length + Math.max(1, Number(m[2])) - 1];
    else lines.push(line.trim() ? line : '');
  }

  return {
    code: lines.join('\n'),
    lines,
    spans,
    warnings: g.warnings.slice(),
    autoUsing: auto,
    needs: Object.fromEntries([...g.needs].map(([k, v]) => [k, [...v]])),
  };
}

/**
 * The Verse for one block on its own (and anything inside it), e.g. for the Text view's
 * palette: "Print(\"Hello, world!\")", "if (Score >= 3):\n    …". Warnings are not collected.
 */
export function snippetFor(block: Block): string {
  const g = verse;
  g.init();
  g.project = emptyProject();
  const out = g.blockToCode(block, true);
  const code = Array.isArray(out) ? out[0] : out;
  return code.split('\n').filter(l => !l.includes(MARK_START)).join('\n').replace(/\n+$/, '');
}
