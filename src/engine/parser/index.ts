/**
 * Text → blocks. Reads a Verse file and produces Blockly JSON.
 * Anything without a matching block is kept as raw Verse, so nothing is lost.
 *
 *   tree.ts         lines → indentation tree
 *   expressions.ts  values and conditions
 *   statements.ts   lines inside functions (a list of rules)
 *   members.ts      what's inside a device class
 */
import { MODULE_PATHS } from '../data/modules.ts';
import { emptyProject, type ProjectContext } from '../project.ts';
import type { BlockState, ParseResult } from '../types.ts';
import { BlockBuilder } from './builder.ts';
import { ExpressionParser } from './expressions.ts';
import { DeviceParser } from './members.ts';
import { buildTree, countTrailingComments, lastLineOf, splitLines, stripComment } from './tree.ts';

const DEVICE_CLASS = /^(\w+)\s*:=\s*class(?:<\w+>)*\s*\(\s*creative_device\s*\)\s*:$/;
/** name := class<spec>(parent):  or  name := struct:  (or with {} for one with no members of its own) */
const TYPE_DECL = /^(\w+)\s*:=\s*(class|struct)(?:<(concrete|unique|final|abstract)>)?(?:\((\w+)\))?\s*(?::|\{\s*\})$/;
const ENUM_DECL = /^(\w+)\s*:=\s*enum\s*\{\s*([A-Za-z_]\w*(?:\s*,\s*[A-Za-z_]\w*)*)\s*\}$/;
const USING_LINE = /^using\s*\{\s*([^\s{}]+)\s*\}$/;

/** `project` describes the project's other files, so their classes and enums are recognised here too. */
export function parseVerse(src: string, project: ProjectContext = emptyProject()): ParseResult {
  const b = new BlockBuilder();
  const expr = new ExpressionParser(b);
  const lines = splitLines(src);

  const trailing = countTrailingComments(lines);
  if (trailing) {
    b.report.notes.push(`${trailing} comment${trailing > 1 ? 's' : ''} at the end of a code line ${trailing > 1 ? 'were' : 'was'} dropped. Comments on their own line are kept as comment blocks.`);
  }
  const subscribed = new Set([...src.matchAll(/\.Subscribe\(\s*(\w+)\s*\)/g)].map(m => m[1]));
  const deviceParser = new DeviceParser(b, expr, subscribed);

  // First pass: your own types, so obj{…} and type.Value can become blocks anywhere in the file.
  const tree = buildTree(lines);
  const typeNames = new Set<string>(project.types.keys());
  const enums = new Map<string, string[]>(project.enums);
  for (const node of tree) {
    const t = stripComment(node.text);
    if (DEVICE_CLASS.test(t)) continue;
    const td = t.match(TYPE_DECL); if (td) typeNames.add(td[1]);
    const en = t.match(ENUM_DECL); if (en) enums.set(en[1], en[2].split(',').map(v => v.trim()));
  }
  expr.setTypes(typeNames, enums);

  const usingLines: Array<{ path: string; auto: boolean }> = [];
  const devices: BlockState[] = [];
  const types: BlockState[] = [];
  for (const node of tree) {
    if (node.text.startsWith('#')) continue;
    const text = stripComment(node.text);
    let m = text.match(USING_LINE);
    if (m) { usingLines.push({ path: m[1], auto: /#\s*for\s/.test(node.text) }); continue; }
    m = text.match(DEVICE_CLASS);
    if (m) { const d = deviceParser.parse(node, m[1]); b.track(d, node.line - 1, lastLineOf(node) - 1); devices.push(d); continue; }
    m = text.match(TYPE_DECL);
    if (m && (m[2] === 'class' || !m[4])) {
      const t = deviceParser.parseType(node, m[1], m[2], m[3] ?? '', m[4] ?? '');
      b.track(t, node.line - 1, lastLineOf(node) - 1);
      types.push(t);
      continue;
    }
    m = text.match(ENUM_DECL);
    if (m && !node.children.length) {
      const e = b.make('verse_enum', { NAME: m[1], VALUES: m[2].split(',').map(v => v.trim()).join(', ') });
      b.track(e, node.line - 1, node.line - 1);
      types.push(e);
      continue;
    }
    b.report.skipped.push(node.text + (node.children.length ? ` (+${node.children.length} indented lines)` : ''));
  }

  if (!devices.length && !types.length) {
    return { ok: false, report: b.report, error: 'No device found. Verse Blocks looks for a line like: my_device := class(creative_device):' };
  }

  // Using lines written by auto mode (they end in "# for …") mean: keep auto mode on.
  const allAuto = usingLines.every(u => u.auto);
  devices.forEach((d, i) => {
    d.x = 30 + i * 40;
    d.y = 30 + i * 60;
    d.fields!.AUTO = allAuto ? 'TRUE' : 'FALSE';
  });
  // Above the devices, top to bottom in file order (blocks are written in top-to-bottom order).
  types.forEach((t, i) => { t.x = 30; t.y = -300 * (types.length - i); });
  if (!allAuto && devices.length) {
    const usings = b.chain(usingLines.map(u => MODULE_PATHS.includes(u.path)
      ? b.make('verse_using', { MODULE: u.path })
      : b.make('verse_using_custom', { PATH: u.path })));
    if (usings) devices[0].inputs!.USINGS = usings;
  }
  if (b.report.skipped.length) b.report.notes.push('Code outside a creative_device class was left out. Custom classes arrive in Phase 4.');
  return { ok: true, state: { blocks: { languageVersion: 0, blocks: [...types, ...devices] } }, report: b.report, sourceSpans: b.spans };
}
