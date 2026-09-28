/**
 * Converts Verse values (right-hand sides, conditions, strings) into value blocks.
 *
 * Precedence, loosest first:  or  →  and  →  not  →  comparisons  →  + -  →  *  →  atoms
 * Anything without a block yet (calls, indexing, division…) becomes a raw value block.
 */
import type { BlockState } from '../types.ts';
import type { BlockBuilder } from './builder.ts';
import { unescapeString } from './tree.ts';

interface Token { kind: 'str' | 'num' | 'id' | 'op'; text: string }

/** Thrown when a value has no matching blocks; the caller falls back to a raw block. */
class NoBlocksFor extends Error {}

const COMPARISONS = ['=', '<>', '<', '<=', '>', '>='];

function tokenize(text: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === '"') {
      let j = i + 1;
      while (j < text.length && text[j] !== '"') { if (text[j] === '\\') j++; j++; }
      if (j >= text.length) throw new NoBlocksFor('unterminated string');
      out.push({ kind: 'str', text: text.slice(i, j + 1) });
      i = j + 1;
      continue;
    }
    const rest = text.slice(i);
    const m = rest.match(/^\d+(\.\d+)?/) ?? rest.match(/^[A-Za-z_]\w*/) ?? rest.match(/^(<>|<=|>=|:=|\.\.|[=<>+\-*/(),?[\].{}:])/);
    if (!m) throw new NoBlocksFor('unknown character');
    const kind: Token['kind'] = /^\d/.test(m[0]) ? 'num' : /^[A-Za-z_]/.test(m[0]) ? 'id' : 'op';
    out.push({ kind, text: m[0] });
    i += m[0].length;
  }
  return out;
}

/** Names the expression parser needs to tell apart (e.g. Scores[0] vs IsReady[X]). */
export interface ExpressionContext {
  arrays: Set<string>;
  maps: Set<string>;
  options: Set<string>;
  /** Your functions: name → whether it is <decides> and what it returns. */
  functions: Map<string, { decides: boolean; returns: string; params: number }>;
}
const emptyContext = (): ExpressionContext => ({ arrays: new Set(), maps: new Set(), options: new Set(), functions: new Map() });
const MAX_ARGS = 3;

export class ExpressionParser {
  private readonly b: BlockBuilder;
  private ctx: ExpressionContext = emptyContext();
  constructor(builder: BlockBuilder) { this.b = builder; }

  /** Sets the names of the device class currently being converted. */
  setContext(ctx: ExpressionContext): void { this.ctx = ctx; }

  /** Your own types in the file: classes/structs (for obj{…}) and enums (for type.Value). */
  private types = new Set<string>();
  private enums = new Map<string, string[]>();
  setTypes(types: Set<string>, enums: Map<string, string[]>): void { this.types = types; this.enums = enums; }

  /** Parses a value only if it becomes real blocks (no raw); otherwise returns null and leaves no trace. */
  tryParse(text: string): BlockState | null {
    const before = this.b.report.blocks;
    try { return this.parseStrict(text.trim()); }
    catch (e) { if (!(e instanceof NoBlocksFor)) throw e; this.b.report.blocks = before; return null; }
  }

  /** Parses a value, or keeps it as a raw value block if it has no blocks yet. */
  parse(text: string): BlockState | null {
    text = text.trim();
    if (!text) return null;
    const before = this.b.report.blocks;
    try {
      return this.parseStrict(text);
    } catch (e) {
      if (!(e instanceof NoBlocksFor)) throw e;
      this.b.report.blocks = before; // blocks made during the failed attempt don't count
      return this.b.raw('verse_raw_expr', text);
    }
  }

  /** A string literal: plain text, or "Label{Value}" with one value at the end. */
  private stringBlock(literal: string): BlockState {
    const inner = literal.slice(1, -1);
    const braces: number[] = [];
    for (let i = 0; i < inner.length; i++) {
      if (inner[i] === '\\') { i++; continue; }
      if (inner[i] === '{' || inner[i] === '}') braces.push(i);
    }
    if (!braces.length) return this.b.make('verse_text', { TEXT: unescapeString(inner) });
    if (braces.length === 2 && inner[braces[0]] === '{' && braces[1] === inner.length - 1) {
      const value = this.parse(inner.slice(braces[0] + 1, braces[1]));
      return this.b.make('verse_text_join', { LABEL: unescapeString(inner.slice(0, braces[0])) }, value ? { V: { block: value } } : undefined);
    }
    throw new NoBlocksFor('complex interpolation');
  }

  private parseStrict(text: string): BlockState {
    const b = this.b;
    const tokens = tokenize(text);
    let p = 0;
    const is = (t: string, at = p) => tokens[at]?.text === t;
    const expect = (t: string) => { if (!is(t)) throw new NoBlocksFor(`expected ${t}`); p++; };
    const integer = (): number => {
      const negative = is('-') ? (p++, true) : false;
      const tk = tokens[p++];
      if (!tk || tk.kind !== 'num' || tk.text.includes('.')) throw new NoBlocksFor('expected a whole number');
      return (negative ? -1 : 1) * Number(tk.text);
    };

    const or = (): BlockState => {
      let left = and();
      while (is('or')) { p++; left = b.make('verse_logic_op', { OP: 'or' }, { A: { block: left }, B: { block: and() } }); }
      return left;
    };
    const and = (): BlockState => {
      let left = not();
      while (is('and')) { p++; left = b.make('verse_logic_op', { OP: 'and' }, { A: { block: left }, B: { block: not() } }); }
      return left;
    };
    const not = (): BlockState => {
      if (is('not')) { p++; return b.make('verse_not', null, { A: { block: not() } }); }
      return compare();
    };
    const compare = (): BlockState => {
      const left = add();
      if (tokens[p] && COMPARISONS.includes(tokens[p].text)) {
        const op = tokens[p++].text;
        return b.make('verse_compare', { OP: op }, { A: { block: left }, B: { block: add() } });
      }
      return left;
    };
    const add = (): BlockState => {
      let left = multiply();
      while (is('+') || is('-')) {
        const op = tokens[p++].text;
        left = b.make('verse_arith', { OP: op }, { A: { block: left }, B: { block: multiply() } });
      }
      return left;
    };
    const multiply = (): BlockState => {
      let left = atom();
      while (is('*')) { p++; left = b.make('verse_arith', { OP: '*' }, { A: { block: left }, B: { block: atom() } }); }
      return left;
    };
    const atom = (): BlockState => {
      const tk = tokens[p];
      if (!tk) throw new NoBlocksFor('unexpected end');
      if (tk.text === '-' && tokens[p + 1]?.kind === 'num') {
        p += 2;
        const v = tokens[p - 1].text;
        return b.make('verse_number', { NUM: -Number(v), TYPE: v.includes('.') ? 'float' : 'int' });
      }
      if (tk.kind === 'num') { p++; return b.make('verse_number', { NUM: Number(tk.text), TYPE: tk.text.includes('.') ? 'float' : 'int' }); }
      if (tk.kind === 'str') { p++; return this.stringBlock(tk.text); }
      if (tk.text === '(') { p++; const inner = or(); expect(')'); return inner; }
      if (tk.kind === 'id') {
        if (tk.text === 'true' || tk.text === 'false') { p++; return b.make('verse_bool', { V: tk.text }); }
        if (tk.text === 'GetRandomInt' && is('(', p + 1)) {
          p += 2;
          const start = p;
          try {
            // Plain numbers: the simple "random int from 1 to 10" block.
            const lo = integer(); expect(','); const hi = integer(); expect(')');
            return b.make('verse_random', { LO: lo, HI: hi });
          } catch (e) {
            if (!(e instanceof NoBlocksFor)) throw e;
            p = start; // Values like Targets.Length - 1: the block with slots.
            const lo = or(); expect(','); const hi = or(); expect(')');
            return b.make('verse_random_range', null, { LO: { block: lo }, HI: { block: hi } });
          }
        }
        if (['and', 'or', 'not'].includes(tk.text)) throw new NoBlocksFor('misplaced keyword');
        const ctx = this.ctx;
        // option{Value}
        if (tk.text === 'option' && is('{', p + 1)) {
          p += 2; const inner = or(); expect('}');
          return b.make('verse_make_option', null, { VALUE: { block: inner } });
        }
        p++;
        const name = tk.text;
        /** Arguments up to the closing bracket, as A1, A2, A3 inputs. */
        const args = (close: string): NonNullable<BlockState['inputs']> => {
          const inputs: NonNullable<BlockState['inputs']> = {};
          let n = 0;
          while (!is(close)) {
            if (n > 0) expect(',');
            if (++n > (close === ')' && tokens[p - 1]?.text === '(' ? 4 : MAX_ARGS)) throw new NoBlocksFor('too many arguments');
            inputs[`A${n}`] = { block: or() };
          }
          expect(close);
          return inputs;
        };
        const fn = ctx.functions.get(name);
        if (is('(') && fn && !fn.decides) { p++; return b.make('verse_call_value', { NAME: name }, args(')')); }
        if (is('[') && fn && fn.decides) { p++; return b.make('verse_call_decides', { NAME: name }, args(']')); }
        if (is('[') && (ctx.arrays.has(name) || ctx.maps.has(name))) {
          p++; const key = or(); expect(']');
          return b.make('verse_index', { NAME: name }, { KEY: { block: key } });
        }
        if (is('.') && tokens[p + 1]?.text === 'Length' && tokens[p + 2]?.text !== '(') { p += 2; return b.make('verse_length', { NAME: name }); }
        // cat{Name := "Percy", Age := 3}
        if (is('{') && this.types.has(name)) {
          p++;
          const fields: Record<string, string> = { TYPE: name };
          const inputs: NonNullable<BlockState['inputs']> = {};
          let n = 0;
          while (!is('}')) {
            if (n > 0) expect(',');
            if (++n > 4) throw new NoBlocksFor('too many fields');
            const field = tokens[p++];
            if (field?.kind !== 'id') throw new NoBlocksFor('expected a field name');
            expect(':=');
            fields[`F${n}`] = field.text;
            inputs[`V${n}`] = { block: or() };
          }
          expect('}');
          for (let i = n + 1; i <= 4; i++) fields[`F${i}`] = '';
          return b.make('verse_construct', fields, inputs);
        }
        // game_state.Playing  /  OldCat.Name  /  OldCat.GetName(…)
        if (is('.') && tokens[p + 1]?.kind === 'id') {
          const member = tokens[p + 1].text;
          if (this.enums.has(name)) { p += 2; return b.make('verse_enum_value', { TYPE: name, VALUE: member }); }
          if (is('(', p + 2)) { p += 3; return b.make('verse_method_value', { OBJ: name, METHOD: member }, args(')')); }
          if (!is('.', p + 2) && !is('[', p + 2)) { p += 2; return b.make('verse_member_get', { OBJ: name, MEMBER: member }); }
        }
        if (name === 'Self') return b.make('verse_self');
        if (is('?')) { p++; return b.make(ctx.options.has(name) ? 'verse_option_value' : 'verse_is_true', { NAME: name }); }
        if (is('(') || is('.') || is('[')) throw new NoBlocksFor('calls have no value block yet');
        if (name === 'Agent' || name === 'Player') return b.make('verse_agent_value', { WHO: name });
        return b.make('verse_get', { NAME: name });
      }
      throw new NoBlocksFor('unexpected token');
    };

    const result = or();
    if (p !== tokens.length) throw new NoBlocksFor('extra text after the value');
    return result;
  }
}
