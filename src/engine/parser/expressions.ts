/**
 * Converts Verse values (right-hand sides, conditions, strings) into value blocks.
 *
 * Precedence, loosest first:  or  →  and  →  comparisons  →  + -  →  *  →  not  →  atoms
 * (as in Verse, `not` binds tighter than * and comparisons: not A = B means (not A) = B)
 * Anything without a block yet (calls, indexing, division…) becomes a raw value block.
 */
import { TEAM_OPS } from '../data/teams.ts';
import { matchCanvas } from '../data/ui.ts';
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
/** Built-in types a value can be cast to with Type[Value]. */
const CAST_TYPES = ['player', 'fort_character', 'team'];
/** Method blocks have one more slot than function call blocks. */
const MAX_METHOD_ARGS = 4;

export class ExpressionParser {
  private readonly b: BlockBuilder;
  private ctx: ExpressionContext = emptyContext();
  constructor(builder: BlockBuilder) { this.b = builder; }

  /** Sets the names of the device class currently being converted. */
  setContext(ctx: ExpressionContext): void { this.ctx = ctx; }

  /** A local value declared in a function: containers become known, so Items[0] reads as an item. */
  learnLocal(name: string, type: string): void {
    if (type.startsWith('[]')) this.ctx.arrays.add(name);
    else if (/^\[\w+\]/.test(type)) this.ctx.maps.add(name);
    else if (type.startsWith('?')) this.ctx.options.add(name);
  }

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
      if (inner[i] === '\\') {
        // Blocks write back only these escapes; any other (\n, \t, \<…) is kept word for word.
        if (!'\\"{}'.includes(inner[i + 1])) throw new NoBlocksFor('escape kept as written');
        i++;
        continue;
      }
      if (inner[i] === '{' || inner[i] === '}') braces.push(i);
    }
    if (!braces.length) return this.b.make('verse_text', { TEXT: unescapeString(inner) });
    // Pairs of { } (not nested): up to three values, with text before, between and after.
    if (braces.length % 2 || braces.length > 6 || braces.some((at, k) => inner[at] !== (k % 2 ? '}' : '{'))) {
      throw new NoBlocksFor('complex interpolation');
    }
    if (braces.length === 2 && braces[1] === inner.length - 1) { // "Label{Value}": the original block
      const value = this.parse(inner.slice(braces[0] + 1, braces[1]));
      return this.b.make('verse_text_join', { LABEL: unescapeString(inner.slice(0, braces[0])) }, value ? { V: { block: value } } : undefined);
    }
    const fields: Record<string, string> = { COUNT: String(braces.length / 2), T0: unescapeString(inner.slice(0, braces[0])) };
    const inputs: NonNullable<BlockState['inputs']> = {};
    for (let k = 0; k < braces.length; k += 2) {
      const n = k / 2 + 1;
      const code = inner.slice(braces[k] + 1, braces[k + 1]);
      if (!code.trim() || code.includes('"')) throw new NoBlocksFor('empty or nested value');
      inputs[`V${n}`] = { block: this.parse(code)! }; // a value with no block stays raw inside the text
      const after = unescapeString(inner.slice(braces[k + 1] + 1, braces[k + 2] ?? inner.length));
      fields[k + 2 < braces.length ? `T${n}` : 'TEND'] = after;
    }
    return this.b.make('verse_text_multi', fields, inputs);
  }

  private parseStrict(text: string): BlockState {
    const b = this.b;
    // A canvas with one widget at a preset position (Phase 5.3): read as a whole, widget inside.
    const canvas = matchCanvas(text);
    if (canvas) return b.make('verse_canvas', { POS: canvas.position }, { WIDGET: { block: this.parseStrict(canvas.widget) } });
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

    /** A call that can follow a value: .GetAgent[], .GetTeams(), or a team question like .GetTeam[Agent]. */
    const hasPostfix = (): boolean => {
      if (!is('.')) return false;
      const m = tokens[p + 1]?.text ?? '';
      return (m === 'GetAgent' && is('[', p + 2) && is(']', p + 3)) || (m === 'GetTeams' && is('(', p + 2) && is(')', p + 3))
        || (m in TEAM_OPS && is('[', p + 2))
        || (m === 'GetTransform' && is('(', p + 2) && is(')', p + 3)) || (m === 'TeleportTo' && is('[', p + 2))
        || (m === 'GetAnimationController' && is('[', p + 2) && is(']', p + 3));
    };
    /** Wraps a value in the calls that follow it: Eliminator.GetAgent[], Teams.GetTeam[Agent]… */
    const postfix = (block: BlockState): BlockState => {
      for (;;) {
        if (!hasPostfix()) {
          // Any other .Name, .Name(…) or .Name[…]: the general chain block
          if (!(is('.') && tokens[p + 1]?.kind === 'id')) return block;
          const member = tokens[p + 1].text; p += 2;
          const close = is('(') ? ')' : is('[') ? ']' : '';
          const inputs: NonNullable<BlockState['inputs']> = { OBJ: { block } };
          if (close) {
            p++;
            let n = 0;
            while (!is(close)) {
              if (n) expect(',');
              if (++n > 3) throw new NoBlocksFor('too many inputs');
              inputs[`A${n}`] = { block: or() };
            }
            expect(close);
          }
          block = b.make('verse_chain', { MEMBER: member, KIND: close === ')' ? 'call' : close === ']' ? 'try' : 'field' }, inputs);
          continue;
        }
        const m = tokens[p + 1].text;
        if (m === 'GetAgent') { p += 4; block = b.make('verse_char_agent', null, { CHAR: { block } }); continue; }
        if (m === 'GetTeams') { p += 4; block = b.make('verse_all_teams', null, { TEAMS: { block } }); continue; }
        if (m === 'GetAnimationController') { p += 4; block = b.make('verse_anim_controller', null, { PROP: { block } }); continue; }
        if (m === 'GetTransform') {
          p += 4;
          // .Translation / .Rotation / .Scale, then maybe .X / .Y / .Z of the position
          const part = is('.') && ['Translation', 'Rotation', 'Scale'].includes(tokens[p + 1]?.text) ? tokens[p + 1].text : '';
          if (part) p += 2;
          block = b.make('verse_transform_of', { PART: part }, { THING: { block } });
          if (part && part !== 'Rotation' && is('.') && ['X', 'Y', 'Z'].includes(tokens[p + 1]?.text)) {
            const axis = tokens[p + 1].text; p += 2;
            block = b.make('verse_vector_part', { AXIS: axis }, { VEC: { block } });
          }
          continue;
        }
        if (m === 'TeleportTo') {
          p += 3;
          const pos = or(); expect(','); const rot = or(); expect(']');
          block = b.make('verse_teleport', null, { THING: { block }, POS: { block: pos }, ROT: { block: rot } });
          continue;
        }
        p += 3;
        const values: BlockState[] = [];
        while (!is(']')) { if (values.length) expect(','); values.push(or()); }
        expect(']');
        const wanted = TEAM_OPS[m].inputs;
        if (values.length !== wanted.length) throw new NoBlocksFor('wrong number of team inputs');
        const inputs: NonNullable<BlockState['inputs']> = { TEAMS: { block } };
        wanted.forEach((input, i) => { inputs[input] = { block: values[i] }; });
        block = b.make('verse_team_op', { OP: m }, inputs);
      }
    };

    const or = (): BlockState => {
      let left = and();
      while (is('or')) { p++; left = b.make('verse_logic_op', { OP: 'or' }, { A: { block: left }, B: { block: and() } }); }
      return left;
    };
    const and = (): BlockState => {
      let left = compare();
      while (is('and')) { p++; left = b.make('verse_logic_op', { OP: 'and' }, { A: { block: left }, B: { block: compare() } }); }
      return left;
    };
    const not = (): BlockState => {
      if (is('not')) { p++; return b.make('verse_not', null, { A: { block: not() } }); }
      return atom();
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
      let left = not();
      while (is('*') || is('/')) { const op = tokens[p++].text; left = b.make('verse_arith', { OP: op }, { A: { block: left }, B: { block: not() } }); }
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
        if (tk.text === 'GetPlayspace' && is('(', p + 1) && is(')', p + 2)) {
          p += 3;
          const call = (method: string) => is('.') && tokens[p + 1]?.text === method && is('(', p + 2) && is(')', p + 3);
          if (call('GetPlayers')) { p += 4; return b.make('verse_players'); }
          if (call('GetTeamCollection')) { p += 4; return postfix(b.make('verse_team_collection')); }
          return b.make('verse_playspace');
        }
        // Phase 5.3: a player's UI, text and button widgets
        if (tk.text === 'GetPlayerUI' && is('[', p + 1)) {
          p += 2; const player = or(); expect(']');
          return b.make('verse_player_ui', null, { PLAYER: { block: player } });
        }
        if (['text_block', 'button_loud', 'button_regular', 'button_quiet'].includes(tk.text) && is('{', p + 1)) {
          const kind = tk.text; p += 2;
          expect('DefaultText'); expect(':='); expect('MakeMessage'); expect('(');
          const value = or(); expect(')'); expect('}');
          return kind === 'text_block'
            ? b.make('verse_text_widget', null, { TEXT: { block: value } })
            : b.make('verse_button_widget', { KIND: kind }, { TEXT: { block: value } });
        }
        if (tk.text === 'Message' && is('.', p + 1) && tokens[p + 2]?.text === 'Player' && !is('.', p + 3)) { p += 3; return b.make('verse_message_player'); }
        // Phase 5.2: positions, rotations and distances
        if (tk.text === 'vector3' && is('{', p + 1)) {
          p += 2;
          const parts: Record<string, { block: BlockState }> = {};
          for (const axis of ['X', 'Y', 'Z']) {
            if (axis !== 'X') expect(',');
            expect(axis); expect(':=');
            parts[axis] = { block: or() };
          }
          expect('}');
          return postfix(b.make('verse_vector', null, parts));
        }
        if (tk.text === 'IdentityRotation' && is('(', p + 1) && is(')', p + 2)) { p += 3; return b.make('verse_identity_rotation'); }
        if ((tk.text === 'MakeRotationFromYawPitchRollDegrees' || tk.text === 'Distance' || tk.text === 'DistanceXY') && is('(', p + 1)) {
          const fn = tk.text; p += 2;
          const values: BlockState[] = [];
          while (!is(')')) { if (values.length) expect(','); values.push(or()); }
          expect(')');
          if (fn === 'MakeRotationFromYawPitchRollDegrees') {
            if (values.length !== 3) throw new NoBlocksFor('a rotation takes three angles');
            return b.make('verse_rotation', null, { YAW: { block: values[0] }, PITCH: { block: values[1] }, ROLL: { block: values[2] } });
          }
          if (values.length !== 2) throw new NoBlocksFor('a distance takes two positions');
          return b.make('verse_distance', { KIND: fn }, { A: { block: values[0] }, B: { block: values[1] } });
        }
        // GetRandomFloat(1.0, 3.0) and Shuffle(Targets) (/Verse.org/Random)
        if (tk.text === 'GetRandomFloat' && is('(', p + 1)) {
          p += 2;
          const lo = or(); expect(','); const hi = or(); expect(')');
          return b.make('verse_random_float', null, { LO: { block: lo }, HI: { block: hi } });
        }
        if (tk.text === 'Shuffle' && is('(', p + 1)) {
          p += 2;
          const list = or(); expect(')');
          return postfix(b.make('verse_shuffle', null, { LIST: { block: list } }));
        }
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
        // Phase 5.1: elimination results, a character's health, and calls that follow a value
        if (name === 'Result' && is('.') && tokens[p + 1]?.text === 'EliminatingCharacter' && is('?', p + 2)) { p += 3; return b.make('verse_eliminator'); }
        if (name === 'Result' && is('.') && tokens[p + 1]?.text === 'EliminatedCharacter') { p += 2; return postfix(b.make('verse_eliminated')); }
        if (name === 'FortChar' && is('.') && ['GetHealth', 'GetShield'].includes(tokens[p + 1]?.text) && is('(', p + 2) && is(')', p + 3)) {
          const stat = tokens[p + 1].text; p += 4;
          return b.make('verse_char_stat', { STAT: stat });
        }
        if (hasPostfix()) return postfix(b.make('verse_get', { NAME: name }));
        /** Arguments up to the closing bracket, as A1, A2, A3 inputs. */
        const args = (close: string, max = MAX_ARGS): NonNullable<BlockState['inputs']> => {
          const inputs: NonNullable<BlockState['inputs']> = {};
          let n = 0;
          while (!is(close)) {
            if (n > 0) expect(',');
            if (++n > max) throw new NoBlocksFor('too many arguments');
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
        // player[Agent], cat[Pet]: a cast (can fail)
        if (is('[') && (CAST_TYPES.includes(name) || this.types.has(name))) {
          p++; const value = or(); expect(']');
          return b.make('verse_cast', { TYPE: name }, { VALUE: { block: value } });
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
          if (is('(', p + 2)) { p += 3; return postfix(b.make('verse_method_value', { OBJ: name, METHOD: member }, args(')', MAX_METHOD_ARGS))); }
          if (!is('.', p + 2) && !is('[', p + 2)) { p += 2; return b.make('verse_member_get', { OBJ: name, MEMBER: member }); }
        }
        if (name === 'Self') return b.make('verse_self');
        if (is('?')) { p++; return b.make(ctx.options.has(name) ? 'verse_option_value' : 'verse_is_true', { NAME: name }); }
        // Name.Member.More, Agent.GetFortCharacter[]…: the general chain, starting from the name
        if (is('.') && tokens[p + 1]?.kind === 'id') {
          return postfix(name === 'Agent' || name === 'Player' ? b.make('verse_agent_value', { WHO: name }) : b.make('verse_get', { NAME: name }));
        }
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
