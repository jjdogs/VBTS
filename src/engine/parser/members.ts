/**
 * Converts one `name := class(creative_device):` and everything inside it into a device block:
 * @editable devices and variables, OnBegin, handlers and functions.
 */
import { CATALOG } from '../catalog.ts';
import { handlerParamFor, HANDLER_INPUTS } from '../data/handlers.ts';
import { hasLiteral, KEY_TYPES, parseParams, RETURN_TYPES, splitList, VALUE_TYPES } from '../data/verse-types.ts';
import type { BlockState } from '../types.ts';
import type { BlockBuilder } from './builder.ts';
import type { ExpressionParser } from './expressions.ts';
import { StatementParser, type StatementContext } from './statements.ts';
import { lastLineOf, stripComment, trailingComment, unescapeString, type LineNode } from './tree.ts';

const FIELD_TYPES = ['int', 'float', 'logic', 'string'];
const EDITABLE_DEVICE = /^(\w+)\s*:\s*(\w+)\s*=\s*(\w+)\{\}$/;
/** Name(params)<effects>:ReturnType= */
const FUNCTION_HEADER = /^(\w+)(?:<(\w+)>)?\(([^)]*)\)((?:<\w+>)*)\s*:\s*(\??\w+)\s*=$/;
/** Any field: [var] Name[<vis>] : type [= default] (types and defaults kept as written). */
const ANY_FIELD = /^(var\s+)?(\w+)(?:<(\w+)>)?\s*:\s*(\??(?:\[\w*\])*[A-Za-z_]\w*)\s*(?:=\s*(.+))?$/;
const VISIBILITIES = ['private', 'protected', 'internal', 'public'];
const EDITABLE_ARRAY = /^(\w+)\s*:\s*\[\]\s*(\w+)\s*=\s*array\{\s*\}$/;
const ARRAY_FIELD = /^(var\s+)?(\w+)\s*:\s*\[\]\s*(\w+)\s*=\s*array\{(.*)\}$/;
const MAP_FIELD = /^(var\s+)?(\w+)\s*:\s*\[(\w+)\]\s*(\w+)\s*=\s*map\{\s*\}$/;
const OPTION_FIELD = /^var\s+(\w+)\s*:\s*\?(\w+)\s*=\s*false$/;
/** Effects Verse Blocks can write (in the order it writes them). */
const EFFECTS = ['', '<suspends>', '<decides><transacts>', '<decides><transacts><suspends>'];

/** True if every array item is a literal of the element type that round-trips exactly. */
function simpleItems(type: string, items: string[]): boolean {
  if (!hasLiteral(type)) return items.length === 0;
  return items.every(v =>
    type === 'string' ? /^"[^"\\{}]*"$/.test(v)
      : type === 'logic' ? /^(true|false)$/.test(v)
        : type === 'float' ? /^-?\d+\.\d+$/.test(v) && String(Number(v)) === v.replace(/\.0$/, '') || /^-?\d+\.0$/.test(v)
          : /^-?\d+$/.test(v));
}

interface Header { name: string; vis: string; params: Array<{ name: string; type: string }>; effects: string; returns: string }
function readHeader(text: string): Header | null {
  const m = text.match(FUNCTION_HEADER);
  if (!m) return null;
  const params = parseParams(m[3]);
  return params ? { name: m[1], vis: m[2] ?? '', params, effects: m[4], returns: m[5] } : null;
}

/** Renames a word everywhere in a tree of lines (used to rename handler inputs). */
function renameIn(lines: LineNode[], from: string, to: string): LineNode[] {
  const word = new RegExp('\\b' + from + '\\b', 'g');
  const rename = (list: LineNode[]): LineNode[] =>
    list.map(k => ({ ...k, text: k.text.replace(word, to), children: rename(k.children) }));
  return rename(lines);
}

export class DeviceParser {
  private readonly b: BlockBuilder;
  private readonly expr: ExpressionParser;
  /** Handlers named in any .Subscribe(…) in the file. */
  private readonly subscribed: Set<string>;

  constructor(builder: BlockBuilder, expr: ExpressionParser, subscribed: Set<string>) {
    this.b = builder;
    this.expr = expr;
    this.subscribed = subscribed;
  }

  parse(node: LineNode, name: string): BlockState {
    const members = node.children;
    const ctx = this.learnNames(members);
    const statements = new StatementParser(this.b, this.expr, ctx);
    const stack = (lines: LineNode[]) => this.b.chain(statements.parse(lines));

    const edits: BlockState[] = [];
    const fns: BlockState[] = [];
    let begin: ReturnType<typeof stack> = undefined;

    // Source lines: blocks made while handling members[from..to] came from those lines.
    let from = 0, editsBefore = 0, fnsBefore = 0;
    const settle = (to: number) => {
      if (to < from) return;
      const first = members[from].line - 1, last = lastLineOf(members[to]) - 1;
      const made = [...edits.slice(editsBefore), ...fns.slice(fnsBefore)];
      for (const blk of made) this.b.track(blk, first, last);
      // A comment at the end of the member's line (`RaiseSpeed : float = 100.0 # Units per second`)
      for (let k = from; k <= to; k++) { const c = trailingComment(members[k].text); if (c) { this.b.note(made[0], c); break; } }
    };
    for (let i = 0; i < members.length; i++) {
      settle(i - 1);
      from = i; editsBefore = edits.length; fnsBefore = fns.length;
      const nd = members[i];
      let text = stripComment(nd.text);

      // Comments stay with the member that follows them.
      if (nd.text.startsWith('#')) {
        if (/^# Turns a string into a message/.test(nd.text)) continue; // our own helper's comment
        let k = i + 1;
        while (members[k] && members[k].text.startsWith('#')) k++;
        const following = members[k] ? stripComment(members[k].text) : '';
        const beforeVariable = /^@editable|^(var\s+)?\w+\s*:\s*[\w[\]?]+\s*=/.test(following) && !/\)\s*(<\w+>)*\s*:/.test(following);
        (beforeVariable ? edits : fns).push(this.b.make('verse_comment', { TEXT: nd.text.replace(/^#\s?/, '') }));
        continue;
      }

      // @editable on its own line, or in front of the field.
      let editable = false;
      if (text === '@editable' && members[i + 1]) { editable = true; i++; text = stripComment(members[i].text); }
      else if (text.startsWith('@editable ')) { editable = true; text = text.slice(10).trim(); }

      let m = text.match(EDITABLE_DEVICE);
      if (editable && m && m[2] === m[3] && CATALOG[m[2]]) {
        edits.push(this.b.make('verse_editable', { NAME: m[1], DTYPE: m[2] }));
        continue;
      }
      const da = text.match(EDITABLE_ARRAY);
      if (editable && da && CATALOG[da[2]]) { edits.push(this.b.make('verse_editable_array', { NAME: da[1], DTYPE: da[2] })); continue; }
      if (editable) {
        const field = this.valueField(text, true);
        edits.push(field ?? this.b.raw('verse_raw_member', '@editable ' + text));
        continue;
      }

      // Arrays, maps and options
      const arr = text.match(ARRAY_FIELD);
      if (arr && (VALUE_TYPES as readonly string[]).includes(arr[3])) {
        const items = splitList(arr[4]);
        if (simpleItems(arr[3], items)) {
          edits.push(this.b.make('verse_array_field', { KIND: arr[1] ? 'var' : 'const', NAME: arr[2], ELEM: arr[3], VALUES: items.join(', ') }));
          continue;
        }
      }
      const map = text.match(MAP_FIELD);
      if (map && (KEY_TYPES as readonly string[]).includes(map[3]) && (VALUE_TYPES as readonly string[]).includes(map[4])) {
        edits.push(this.b.make('verse_map_field', { KIND: map[1] ? 'var' : 'const', NAME: map[2], KEY: map[3], VAL: map[4] }));
        continue;
      }
      const opt = text.match(OPTION_FIELD);
      if (opt && (VALUE_TYPES as readonly string[]).includes(opt[2])) { edits.push(this.b.make('verse_option_field', { NAME: opt[1], TYPE: opt[2] })); continue; }

      // var Score:int = 0   /   MaxScore:int = 10
      const field = this.valueField(text, false);
      if (field) { edits.push(field); continue; }

      const anyField = this.anyField(text);
      if (anyField) { edits.push(anyField); continue; }

      if (/^OnBegin<override>\(\)<suspends>\s*:\s*void\s*=$/.test(text)) { begin = stack(nd.children); continue; }
      if (/^MakeMessage<localizes>\(Text:string\)\s*:\s*message\s*=\s*"\{Text\}"$/.test(text)) continue; // re-added automatically

      const header = readHeader(text);
      if (header) {
        fns.push(this.functionBlock(header, nd, text, statements));
        continue;
      }

      // Anything else is kept word for word.
      if (nd.children.length) fns.push(this.b.raw('verse_raw_member_wrap', text, { DO: stack(nd.children)! }));
      else fns.push(this.b.raw('verse_raw_member', text));
    }

    settle(members.length - 1);
    const inputs: NonNullable<BlockState['inputs']> = {};
    const e = this.b.chain(edits); if (e) inputs.EDITABLES = e;
    if (begin) inputs.ONBEGIN = begin;
    const f = this.b.chain(fns); if (f) inputs.MEMBERS = f;
    return this.b.make('verse_device', { NAME: name }, inputs);
  }

  /** var Score:int = 0  /  MaxScore:int = 10  (and @editable RaiseSpeed:float = 100.0): a field block, or null. */
  private valueField(text: string, editable: boolean): BlockState | null {
    const m = text.match(/^(var\s+)?(\w+)\s*:\s*(\w+)\s*=\s*(.+)$/);
    if (!m || !FIELD_TYPES.includes(m[3])) return null;
    let value = m[4].trim();
    const type = m[3];
    const simple = type === 'string' ? /^"(?:[^"\\{}]|\\[\\"{}])*"$/.test(value)
      : type === 'logic' ? /^(true|false)$/.test(value)
        : /^-?\d+(\.\d+)?$/.test(value);
    if (!simple) return null;
    if (type === 'string') value = unescapeString(value.slice(1, -1));
    if (editable && m[1]) return null; // @editable var: kept as raw Verse
    return this.b.make('verse_field', { KIND: editable ? 'editable' : m[1] ? 'var' : 'const', NAME: m[2], TYPE: type, VALUE: value });
  }

  /** A field of any type (custom types, containers with values…), or null. */
  private anyField(text: string): BlockState | null {
    const m = text.match(ANY_FIELD);
    if (!m || (m[3] && !VISIBILITIES.includes(m[3]))) return null;
    return this.b.make('verse_member_field', { KIND: m[1] ? 'var' : 'const', NAME: m[2], VIS: m[3] || 'none', TYPE: m[4], DEFAULT: (m[5] ?? '').trim() });
  }

  /** name := class<spec>(parent):  /  name := struct:  and its fields and methods. */
  parseType(node: LineNode, name: string, kind: string, spec: string, parent: string): BlockState {
    const ctx = this.learnNames(node.children);
    const statements = new StatementParser(this.b, this.expr, ctx);
    const members: BlockState[] = [];
    for (const nd of node.children) {
      const text = stripComment(nd.text);
      let made: BlockState | null = null;
      if (nd.text.startsWith('#')) made = this.b.make('verse_comment', { TEXT: nd.text.replace(/^#\s?/, '') });
      else if (!made) made = this.anyField(text);
      if (!made) {
        const h = readHeader(text);
        if (h && (!h.vis || VISIBILITIES.includes(h.vis))) made = this.functionBlock(h, nd, text, statements, true);
      }
      if (!made) made = nd.children.length
        ? this.b.raw('verse_raw_member_wrap', text, { DO: this.b.chain(statements.parse(nd.children))! })
        : this.b.raw('verse_raw_member', text);
      this.b.track(made, nd.line - 1, lastLineOf(nd) - 1);
      this.b.note(made, trailingComment(nd.text));
      members.push(made);
    }
    const inputs: NonNullable<BlockState['inputs']> = {};
    const chain = this.b.chain(members); if (chain) inputs.MEMBERS = chain;
    return this.b.make('verse_class', { NAME: name, KIND: kind, SPEC: spec || 'none', PARENT: parent }, inputs);
  }

  /** First pass: devices, containers and functions, so statements and values can refer to them. */
  private learnNames(members: LineNode[]): StatementContext {
    const ctx: StatementContext = { devices: {}, deviceArrays: {}, functions: new Map() };
    const exprCtx = { arrays: new Set<string>(), maps: new Set<string>(), options: new Set<string>(), functions: ctx.functions };
    members.forEach((member, i) => {
      let text = stripComment(member.text);
      if (text === '@editable' && members[i + 1]) text = stripComment(members[i + 1].text);
      text = text.replace(/^@editable\s+/, '');
      const d = text.match(EDITABLE_DEVICE);
      if (d && d[2] === d[3] && CATALOG[d[2]]) ctx.devices[d[1]] = d[2];
      const da = text.match(EDITABLE_ARRAY);
      if (da && CATALOG[da[2]]) { ctx.deviceArrays[da[1]] = da[2]; exprCtx.arrays.add(da[1]); }
      const arr = text.match(ARRAY_FIELD); if (arr) exprCtx.arrays.add(arr[2]);
      const map = text.match(MAP_FIELD); if (map) exprCtx.maps.add(map[2]);
      const opt = text.match(OPTION_FIELD); if (opt) exprCtx.options.add(opt[1]);
      const h = readHeader(text);
      if (h && h.name !== 'OnBegin') ctx.functions.set(h.name, { decides: h.effects.startsWith('<decides>'), returns: h.returns, params: h.params.length });
    });
    this.expr.setContext(exprCtx);
    return ctx;
  }

  /**
   * A handler or one of your functions. Handlers: one agent or ?agent input; or subscribed
   * somewhere with no input or one input of a type events send (player, elimination_result…).
   */
  private functionBlock(h: Header, nd: LineNode, text: string, statements: StatementParser, inClass = false): BlockState {
    const { name, params, effects, returns } = h;
    const input = params.length === 1 ? params[0] : null;
    const typed = input ? handlerParamFor(input.type) : undefined; // e.g. 'agent', 'player'
    const isHandler = !inClass && returns === 'void' && effects === '' && !h.vis &&
      (typed === 'agent' || typed === 'maybe' || ((typed !== undefined || params.length === 0) && this.subscribed.has(name)));

    if (isHandler) {
      let lines = nd.children;
      if (input && typed) {
        const want = HANDLER_INPUTS[typed].name; // the names blocks use
        if (input.name !== want) {
          this.b.report.notes.push(`Renamed ${name}'s input from ${input.name} to ${want} (the name blocks use).`);
          lines = renameIn(lines, input.name, want);
        }
      }
      const body = this.b.chain(statements.parse(lines));
      return this.b.make('verse_handler', { NAME: name, PARAM: typed ?? 'none' }, body ? { DO: body } : undefined);
    }

    const writable = EFFECTS.includes(effects) && (RETURN_TYPES as readonly string[]).includes(returns) && (!h.vis || VISIBILITIES.includes(h.vis));
    const decides = effects.startsWith('<decides>');
    const inner = new StatementParser(this.b, this.expr, { ...statements.context, inFunction: { decides, returns } });
    const body = this.b.chain(inner.parse(nd.children));
    if (!writable) return this.b.raw('verse_raw_member_wrap', text, body ? { DO: body } : undefined);
    return this.b.make('verse_function', {
      NAME: name, VIS: h.vis || 'none', PARAMS: params.map(p => `${p.name}:${p.type}`).join(', '), RET: returns,
      SUSPENDS: effects.endsWith('<suspends>') ? 'TRUE' : 'FALSE', DECIDES: decides ? 'TRUE' : 'FALSE',
    }, body ? { DO: body } : undefined);
  }
}
