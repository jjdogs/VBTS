/**
 * Style checks from Epic's Verse style guide ("Programming with Verse", sections 1–12).
 *
 * These are "style" notices, not errors: the code still compiles. Each message names the guide
 * section it comes from, and naming problems offer a one-click "rename everywhere" fix.
 *
 *   1.1  logic variables are usually named IsX
 *   1.2  don't decorate type names (…_type, …_class)
 *   2.1  types (the device class) use lower_snake_case
 *   2.3  everything else uses PascalCase: variables, parameters, functions…
 *   2.4  never use a _t suffix
 *   4.1  implicit return by default; if a function uses return anywhere, use it for every result
 *   7.1  event handlers are prefixed with On
 *   8.1  don't decorate <suspends> functions with Async
 *
 * Generated code already follows the formatting rules (3.x: four-space indents, spaces around
 * = and :=, braces only for single-line expressions like array{…}), 4.2 (<decides><transacts>)
 * and 9.1 (@editable on its own line).
 */
import type { Block, Workspace } from './blockly.ts';
import type { VerseGenerator } from './generator/verse-generator.ts';
import { parseParams } from './data/verse-types.ts';

const isPascal = (s: string) => /^[A-Z][A-Za-z0-9]*$/.test(s);
const isSnake = (s: string) => /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/.test(s);

/** my_score / myScore / score → MyScore */
export const toPascal = (s: string): string =>
  s.split(/_+/).filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1)).join('') || s;

/** MyDevice / myDevice / My_Device → my_device */
export const toSnake = (s: string): string =>
  s.replace(/([a-z0-9])([A-Z])/g, '$1_$2').replace(/_+/g, '_').replace(/^_|_$/g, '').toLowerCase();

const field = (b: Block, n: string) => String(b.getFieldValue(n) ?? '');

/** Where names are declared, and which field holds the name. */
const DECLARATIONS: Array<[type: string, fieldName: string, what: string]> = [
  ['verse_editable', 'NAME', 'Linked device'],
  ['verse_member_field', 'NAME', 'Field'],
  ['verse_editable_array', 'NAME', 'Device array'],
  ['verse_field', 'NAME', 'Variable'],
  ['verse_local', 'NAME', 'Local value'],
  ['verse_array_field', 'NAME', 'Array'],
  ['verse_map_field', 'NAME', 'Map'],
  ['verse_option_field', 'NAME', 'Option'],
  ['verse_handler', 'NAME', 'Handler'],
  ['verse_function', 'NAME', 'Function'],
  ['verse_for_each', 'VAR', 'Loop variable'],
  ['verse_for_range', 'VAR', 'Loop variable'],
  ['verse_if_bind', 'VAR', 'Name'],
];

/** Every name used in the workspace (to avoid renaming onto an existing name). */
function allNames(ws: Workspace): Set<string> {
  const names = new Set<string>();
  for (const b of ws.getAllBlocks(false)) {
    for (const n of ['NAME', 'VAR', 'KEY']) { const v = b.getField(n) ? field(b, n) : ''; if (v) names.add(v); }
  }
  return names;
}

export function checkStyle(ws: Workspace, g: VerseGenerator): void {
  const taken = allNames(ws);
  /** Adds a style notice, with a rename fix when the new name is free. Renames only reach this
   *  file, so names other files use (or define) are left for you to rename. */
  const notice = (b: Block, msg: string, from?: string, to?: string) => {
    const fix = from && to && to !== from && !taken.has(to) && !g.project.references.has(from) && !g.project.definitions.has(to)
      ? { label: `Rename to ${to} everywhere`, kind: 'rename' as const, from, to } : null;
    g.warn(b, msg, 'style', fix);
  };

  // 2.1 / 1.2 / 2.4 — the device class, your classes/structs and enums are types
  for (const d of [...ws.getBlocksByType('verse_device', false), ...ws.getBlocksByType('verse_class', false), ...ws.getBlocksByType('verse_enum', false)]) {
    const name = field(d, 'NAME');
    if (!isSnake(name)) notice(d, `Style (guide 2.1): type names use lower_snake_case, so ${name} should be ${toSnake(name)}.`, name, toSnake(name));
    else if (/_(type|class|t)$/.test(name)) notice(d, `Style (guide 1.2, 2.4): don't decorate type names with _type, _class or _t. Just call it ${name.replace(/_(type|class|t)$/, '')}.`, name, name.replace(/_(type|class|t)$/, ''));
  }

  // 2.3 — PascalCase for every other name
  for (const [type, fieldName, what] of DECLARATIONS) {
    for (const b of ws.getBlocksByType(type, false)) {
      const name = field(b, fieldName);
      if (name && !isPascal(name)) notice(b, `Style (guide 2.3): names use PascalCase, so ${what.toLowerCase()} ${name} should be ${toPascal(name)}.`, name, toPascal(name));
      if (type === 'verse_for_each' && field(b, 'KEYED') === 'TRUE') {
        const key = field(b, 'KEY');
        if (key && !isPascal(key)) notice(b, `Style (guide 2.3): names use PascalCase, so ${key} should be ${toPascal(key)}.`, key, toPascal(key));
      }
    }
  }

  // 2.3 — function parameters
  for (const b of ws.getBlocksByType('verse_function', false)) {
    for (const p of parseParams(field(b, 'PARAMS')) ?? []) {
      if (!isPascal(p.name)) notice(b, `Style (guide 2.3): parameters use PascalCase, so ${p.name} should be ${toPascal(p.name)}.`, p.name, toPascal(p.name));
    }
  }

  // 2.3 — enum values are PascalCase too (1.2: and not decorated, e.g. Red not COLOR_Red)
  for (const e of ws.getBlocksByType('verse_enum', false)) {
    for (const v of field(e, 'VALUES').split(',').map(x => x.trim()).filter(Boolean)) {
      if (!isPascal(v)) g.warn(e, `Style (guide 2.3): enum values use PascalCase, so ${v} should be ${toPascal(v.toLowerCase())}.`, 'style');
    }
  }

  // 6.2 — class members should be <private> in most cases. Only suggested for members that
  // nothing outside the class uses (a private field read from outside would not compile).
  const classes = ws.getBlocksByType('verse_class', false);
  /** Classes that inherit from cls, directly or further down (private members aren't visible there). */
  const subclassesOf = (cls: Block): Block[] => {
    const out: Block[] = [];
    const walk = (parent: string) => {
      for (const c of classes) {
        if (field(c, 'PARENT') === parent && !out.includes(c)) { out.push(c); walk(field(c, 'NAME')); }
      }
    };
    walk(field(cls, 'NAME'));
    return out;
  };
  const usedOutside = (cls: Block, name: string) => {
    const subs = subclassesOf(cls);
    const word = new RegExp(`\\b${name}\\b`);
    // Another file of the project might use it (checked loosely: any mention of the name counts).
    if (g.project.references.has(name) || g.project.texts.some(t => word.test(t))) return true;
    return ws.getAllBlocks(false).some(b => {
      const root = b.getRootBlock();
      if (root === cls) return false;
      // Inside a subclass, any reference by name counts: a plain get or call, or an override.
      if (subs.includes(root)) {
        if (['NAME', 'VAR', 'MEMBER', 'METHOD', 'HANDLER'].some(n => b.getField(n) && field(b, n) === name)) return true;
        if (b.type.startsWith('verse_raw') && word.test(field(b, 'CODE'))) return true;
      }
      if (['verse_member_get', 'verse_member_set'].includes(b.type) && field(b, 'MEMBER') === name) return true;
      if (['verse_method_call', 'verse_method_value'].includes(b.type) && field(b, 'METHOD') === name) return true;
      if (b.type === 'verse_construct') return [1, 2, 3, 4].some(i => field(b, `F${i}`) === name);
      // Starting values and raw Verse are text: look for Name := … or .Name in them.
      const text = b.type === 'verse_member_field' ? field(b, 'DEFAULT') : b.type.startsWith('verse_raw') ? field(b, 'CODE') : '';
      return !!text && new RegExp(`(\\.${name}\\b|\\b${name}\\s*:=)`).test(text);
    });
  };
  for (const cls of classes) {
    for (let m = cls.getInputTargetBlock('MEMBERS'); m; m = m.getNextBlock()) {
      if (!['verse_member_field', 'verse_function'].includes(m.type) || field(m, 'VIS') !== 'none') continue;
      const name = field(m, 'NAME');
      if (usedOutside(cls, name)) continue;
      g.warn(m, `Style (guide 6.2): ${name} is only used inside ${field(cls, 'NAME')}, so it can be <private>.`, 'style',
        { label: `Make ${name} <private>`, kind: 'setBlockField', id: m.id, field: 'VIS', value: 'private' });
    }
  }

  // 1.1 — logic variables ask a question: IsX
  for (const b of ws.getBlocksByType('verse_field', false)) {
    const name = field(b, 'NAME');
    if (field(b, 'TYPE') === 'logic' && isPascal(name) && !/^Is[A-Z0-9]/.test(name)) {
      notice(b, `Style (guide 1.1): logic variables are usually named like a question, e.g. Is${name}.`, name, `Is${name}`);
    }
  }

  // 7.1 — handlers start with On
  for (const b of ws.getBlocksByType('verse_handler', false)) {
    const name = field(b, 'NAME');
    if (isPascal(name) && !/^On[A-Z0-9]/.test(name)) notice(b, `Style (guide 7.1): event handlers start with On, e.g. On${name}.`, name, `On${name}`);
  }

  for (const b of ws.getBlocksByType('verse_function', false)) {
    const name = field(b, 'NAME');
    // 8.1 — no Async suffix on <suspends> functions
    if (field(b, 'SUSPENDS') === 'TRUE' && /.Async$/.test(name)) {
      notice(b, `Style (guide 8.1): don't add Async to <suspends> functions. Call it ${name.replace(/Async$/, '')}.`, name, name.replace(/Async$/, ''));
    }
    // 4.1 — don't mix an implicit result line with explicit returns
    const stack: Block[] = [];
    for (let s = b.getInputTargetBlock('DO'); s; s = s.getNextBlock()) stack.push(s);
    const usesReturn = b.getDescendants(false).some(d => d.type === 'verse_return');
    const last = stack[stack.length - 1];
    if (usesReturn && last && last.type === 'verse_check' && field(b, 'DECIDES') !== 'TRUE' && (field(b, 'RET') || 'void') !== 'void') {
      notice(last, `Style (guide 4.1): ${name} uses return elsewhere, so give this result an explicit return too (or use no return at all).`);
    }
  }
}

/** Fields that refer to a name, per block type (so a rename reaches every use). */
const REFERENCE_FIELDS = ['NAME', 'VAR', 'HANDLER', 'DEVICE', 'OBJ', 'MEMBER', 'METHOD', 'TYPE', 'PARENT', 'F1', 'F2', 'F3', 'F4'];

/**
 * Renames a name everywhere blocks refer to it: declarations, gets/sets, calls, subscribes,
 * loop variables and function parameter lists. Raw Verse blocks are left as typed.
 */
export function renameEverywhere(ws: Workspace, from: string, to: string): number {
  let changed = 0;
  const word = new RegExp(`\\b${from}\\b`, 'g');
  for (const b of ws.getAllBlocks(false)) {
    for (const n of REFERENCE_FIELDS) {
      if (b.getField(n) && field(b, n) === from) { b.setFieldValue(to, n); changed++; }
    }
    if (b.type === 'verse_for_each' && field(b, 'KEY') === from) { b.setFieldValue(to, 'KEY'); changed++; }
    if (b.type === 'verse_function' && word.test(field(b, 'PARAMS'))) {
      b.setFieldValue(field(b, 'PARAMS').replace(word, to), 'PARAMS'); changed++;
    }
    word.lastIndex = 0;
  }
  return changed;
}
