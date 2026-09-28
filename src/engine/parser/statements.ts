/**
 * Converts the lines inside a function (OnBegin, handlers, ifs, loops…) into statement blocks.
 *
 * Each line is tried against RULES, in order. The first rule that matches makes the block.
 * If none match, the line is kept as raw Verse (with its indented lines still converted inside).
 * To support a new kind of line, add a rule.
 */
import { deviceInfo, parseAction } from '../catalog.ts';
import type { BlockState } from '../types.ts';
import type { BlockBuilder, NextLink } from './builder.ts';
import type { ExpressionParser } from './expressions.ts';
import { lastLineOf, stripComment, type LineNode } from './tree.ts';

/** What statements can refer to: the device's linked devices, containers and functions. */
export interface StatementContext {
  /** @editable slot name (or a loop variable holding one device) → device type */
  devices: Record<string, string>;
  /** @editable device arrays: name → device type */
  deviceArrays: Record<string, string>;
  functions: Map<string, { decides: boolean; returns: string; params: number }>;
  /** The function whose body is being converted (for check / result lines). */
  inFunction?: { decides: boolean; returns: string };
}

/** Splits "a, f(b, c), \"d, e\"" at top-level commas. */
function splitArgs(text: string): string[] {
  const out: string[] = []; let depth = 0, cur = '', inString = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '\\' && inString) { cur += c + (text[i + 1] ?? ''); i++; continue; }
    if (c === '"') inString = !inString;
    if (!inString && '([{'.includes(c)) depth++;
    if (!inString && ')]}'.includes(c)) depth--;
    if (c === ',' && depth === 0 && !inString) { out.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/** True if every bracket in the text closes in order (strings aside). */
function balanced(text: string): boolean {
  let depth = 0, inString = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '\\' && inString) { i++; continue; }
    if (c === '"') inString = !inString;
    if (inString) continue;
    if ('([{'.includes(c)) depth++;
    if (')]}'.includes(c) && --depth < 0) return false;
  }
  return depth === 0 && !inString;
}

/** True if the next line is else: or else if (…): (without converting anything). */
const hasElse = (rest: LineNode[]): boolean => !!rest[0] && /^else(\s+if\s*\(.*\))?\s*:$/.test(stripComment(rest[0].text));

interface RuleInput {
  /** The line with any trailing comment removed. */
  text: string;
  node: LineNode;
  /** The line after this one at the same indent, if any (for else:). */
  next: LineNode | undefined;
  /** Every line after this one at the same indent (for else if chains). */
  rest: LineNode[];
  /** Converts indented lines (this line's children by default) into a stack. */
  body: (lines?: LineNode[]) => NextLink | undefined;
}

/** A rule returns the block it made (and how many following lines it also used), or null to pass. */
type Rule = (input: RuleInput) => { block: BlockState; usedNext?: boolean | number } | BlockState | null;

export class StatementParser {
  private readonly b: BlockBuilder;
  private readonly expr: ExpressionParser;
  private readonly ctx: StatementContext;
  /** The names this parser knows (for making parsers of nested bodies). */
  get context(): StatementContext { return this.ctx; }

  constructor(builder: BlockBuilder, expr: ExpressionParser, ctx: StatementContext) {
    this.b = builder;
    this.expr = expr;
    this.ctx = ctx;
  }

  parse(nodes: LineNode[]): BlockState[] {
    const out: BlockState[] = [];
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      if (node.text.startsWith('#')) {
        const comment = this.b.make('verse_comment', { TEXT: node.text.replace(/^#\s?/, '') });
        this.b.track(comment, node.line - 1, node.line - 1);
        out.push(comment);
        continue;
      }
      const input: RuleInput = {
        text: stripComment(node.text),
        node,
        next: nodes[i + 1],
        rest: nodes.slice(i + 1),
        body: (lines = node.children) => this.b.chain(this.parse(lines)),
      };
      let made: ReturnType<Rule> = null;
      for (const rule of this.rules) {
        made = rule(input);
        if (made) break;
      }
      if (!made) made = this.keepRaw(input);
      if ('block' in made && typeof made.block === 'object') {
        const used = made.usedNext === true ? 1 : made.usedNext || 0;
        this.b.track(made.block, node.line - 1, lastLineOf(nodes[i + used]) - 1);
        out.push(made.block);
        i += used;
      } else {
        this.b.track(made as BlockState, node.line - 1, lastLineOf(node) - 1);
        out.push(made as BlockState);
      }
    }
    return out;
  }

  /**
   * The else part after an if: `else:` (its lines), or `else if (…):` (another if, which takes
   * the rest of the chain). Returns the stack and how many lines it used, or null.
   */
  private elseOf(rest: LineNode[]): { stack: NextLink | undefined; used: number } | null {
    const first = rest[0] ? stripComment(rest[0].text) : '';
    if (first === 'else:') return { stack: this.b.chain(this.parse(rest[0].children)), used: 1 };
    if (!/^else\s+if\s*\(.*\)\s*:$/.test(first)) return null;
    // The chain: this else if, then any further else if lines, ending at an else:
    let used = 1;
    while (rest[used] && /^else\s+if\s*\(.*\)\s*:$/.test(stripComment(rest[used].text))) used++;
    if (rest[used] && stripComment(rest[used].text) === 'else:') used++;
    const chain = [{ ...rest[0], text: rest[0].text.replace(/^else\s+/, '') }, ...rest.slice(1, used)];
    return { stack: this.b.chain(this.parse(chain)), used };
  }

  /** A parser for a body where `name` holds one device of `type` (loop variable, bound item). */
  private scoped(name: string, type: string | undefined): StatementParser {
    if (!type) return this;
    return new StatementParser(this.b, this.expr, { ...this.ctx, devices: { ...this.ctx.devices, [name]: type } });
  }

  /** Arguments text → A1..A3 inputs (or null if there are too many). */
  private argInputs(text: string): NonNullable<BlockState['inputs']> | null {
    const parts = splitArgs(text);
    if (parts.length > 3) return null;
    const inputs: NonNullable<BlockState['inputs']> = {};
    parts.forEach((part, i) => { const v = this.expr.parse(part); if (v) inputs[`A${i + 1}`] = { block: v }; });
    return inputs;
  }

  /** Nothing matched: keep the line word for word, still converting its indented lines. */
  private keepRaw({ text, node, body }: RuleInput): BlockState {
    return node.children.length ? this.b.raw('verse_raw_wrap', text, { DO: body() }) : this.b.raw('verse_raw', text);
  }

  private readonly knownDevice = (name: string): string | undefined => this.ctx.devices[name];

  /** Wraps a value block for an input, or leaves the input empty. */
  private value(key: string, block: BlockState | null) {
    return block ? { [key]: { block } } : undefined;
  }

  // ---------------------------------------------------------------------------------
  // The rules, tried top to bottom.
  // ---------------------------------------------------------------------------------
  private readonly rules: Rule[] = [
    // Print(...) — "{X}" around a non-string value becomes the value itself (the block re-adds it)
    ({ text }) => {
      const m = text.match(/^Print\((.*)\)$/);
      if (!m) return null;
      const arg = m[1].trim();
      const wrapped = arg.match(/^"\{([^{}"]*)\}"$/);
      const v = wrapped ? this.expr.parse(wrapped[1]) : this.expr.parse(arg);
      if (wrapped && v && v.type === 'verse_raw_expr') {
        return this.b.make('verse_print', null, { TEXT: { block: this.expr.parse(arg)! } });
      }
      return this.b.make('verse_print', null, this.value('TEXT', v));
    },

    // Sleep(2.0)
    ({ text }) => {
      const m = text.match(/^Sleep\((-?\d+(?:\.\d+)?)\)$/);
      return m ? this.b.make('verse_sleep', { SECS: Number(m[1]) }) : null;
    },

    // Device.SomeEvent.Subscribe(Handler)
    ({ text }) => {
      const m = text.match(/^(\w+)\.(\w+Event)\.Subscribe\((\w+)\)$/);
      return m && this.knownDevice(m[1]) ? this.b.make('verse_subscribe', { DEVICE: m[1], EVENT: m[2], HANDLER: m[3] }) : null;
    },

    // GetPlayspace().PlayerAddedEvent().Subscribe(OnPlayerAdded) — an event that belongs to a value
    ({ text }) => {
      const m = text.match(/^(.+)\.(\w+)\(\)\.Subscribe\((\w+)\)$/);
      if (!m) return null;
      return this.b.make('verse_subscribe_event', { EVENT: m[2], HANDLER: m[3] }, this.value('SOURCE', this.expr.parse(m[1])));
    },

    // Hud.SetText(MakeMessage(...))
    ({ text }) => {
      const m = text.match(/^(\w+)\.SetText\(MakeMessage\((.*)\)\)$/);
      if (!m || !this.knownDevice(m[1])) return null;
      return this.b.make('verse_hud_text', { DEVICE: m[1] }, this.value('TEXT', this.expr.parse(m[2])));
    },

    // Device.Action() / Device.Action(Agent) / Device.Action(Player) — only actions the device really has
    ({ text }) => {
      const m = text.match(/^(\w+)\.(\w+)\((|Agent|Player)\)$/);
      const type = m ? this.knownDevice(m[1]) : undefined;
      if (!m || !type) return null;
      const signature = m[2] + (m[3] ? '(Agent)' : '()');
      if (!(deviceInfo(type)?.methods ?? []).includes(signature)) return null;
      return this.b.make('verse_call_device', { DEVICE: m[1], METHOD: signature, WHO: m[3] || 'Agent' });
    },

    // UI.AddWidget(Canvas) / UI.RemoveWidget(Canvas) — Phase 5.3
    ({ text }) => {
      const m = text.match(/^(.+?)\.(AddWidget|RemoveWidget)\((.+)\)$/);
      if (!m) return null;
      const args = splitArgs(m[3]);
      const clickable = m[2] === 'AddWidget' && args.length === 2 && /^player_ui_slot\s*\{\s*InputMode\s*:=\s*ui_input_mode\.All\s*\}$/.test(args[1]);
      if (args.length !== 1 && !clickable) return null;
      return this.b.make('verse_ui_widget', { ACTION: clickable ? 'AddWidgetClick' : m[2] },
        { UI: { block: this.expr.parse(m[1])! }, WIDGET: { block: this.expr.parse(args[0])! } });
    },

    // Widget.SetText(MakeMessage(…)) on something that isn't a linked device (a text widget or button)
    ({ text }) => {
      const m = text.match(/^(.+?)\.SetText\(MakeMessage\((.*)\)\)$/);
      if (!m || this.knownDevice(m[1])) return null;
      return this.b.make('verse_widget_text', null, { WIDGET: { block: this.expr.parse(m[1])! }, TEXT: { block: this.expr.parse(m[2])! } });
    },

    // Prop.MoveTo(Position, Rotation, Seconds) — moving over time (Phase 5.2)
    ({ text }) => {
      const m = text.match(/^(.+)\.MoveTo\((.+)\)$/);
      if (!m) return null;
      const parts = splitArgs(m[2]);
      if (parts.length !== 3) return null;
      const [thing, pos, rot, time] = [m[1], ...parts].map(t => this.expr.parse(t));
      return this.b.make('verse_move_to', null, { THING: { block: thing! }, POS: { block: pos! }, ROT: { block: rot! }, TIME: { block: time! } });
    },

    // Device.Action(values) — a device action with inputs, matched by its number of inputs
    ({ text }) => {
      const m = text.match(/^(\w+)\.(\w+)\((.+)\)$/);
      const type = m ? this.knownDevice(m[1]) : undefined;
      if (!m || !type) return null;
      const parts = splitArgs(m[3]);
      const sig = (deviceInfo(type)?.actions ?? []).find(a => { const p = parseAction(a); return p.name === m[2] && p.params.length === parts.length; });
      if (!sig) return null;
      const inputs: NonNullable<BlockState['inputs']> = {};
      parts.forEach((part, i) => { const v = this.expr.parse(part); if (v) inputs[`A${i + 1}`] = { block: v }; });
      return this.b.make('verse_device_action', { DEVICE: m[1], ACTION: sig }, inputs);
    },

    // FortChar.Damage(25.0)
    ({ text }) => {
      const m = text.match(/^FortChar\.(Damage|Heal|SetHealth|SetShield)\((\d+(?:\.\d+)?)\)$/);
      return m ? this.b.make('verse_char_action', { ACTION: m[1], AMOUNT: Number(m[2]) }) : null;
    },

    // set Scores += array{Value}
    ({ text }) => {
      const m = text.match(/^set\s+(\w+)\s*\+=\s*array\{(.*)\}$/);
      if (!m) return null;
      return this.b.make('verse_array_add', { NAME: m[1] }, this.value('VALUE', this.expr.parse(m[2])));
    },

    // if (set Name[Key] = Value) {}   or   if (set Name[Key] = Value): …
    ({ text, body }) => {
      const m = text.match(/^if\s*\(\s*set\s+(\w+)\[(.+?)\]\s*=\s*(.+)\)\s*(\{\s*\}|:)$/);
      if (!m) return null;
      const key = this.expr.parse(m[2]), value = this.expr.parse(m[3]);
      const inside = m[4] === ':' ? body() : undefined;
      return this.b.make('verse_set_index', { NAME: m[1] }, { KEY: { block: key! }, VALUE: { block: value! }, ...(inside ? { DO: inside } : {}) });
    },

    // set Pet.Age += 1  (a field of an object)
    ({ text }) => {
      const m = text.match(/^set\s+(\w+)\.(\w+)\s*(\+=|-=|=)\s*(.+)$/);
      if (!m) return null;
      return this.b.make('verse_member_set', { OBJ: m[1], MEMBER: m[2], OP: m[3] }, this.value('V', this.expr.parse(m[4])));
    },

    // set Name += value
    ({ text }) => {
      const m = text.match(/^set\s+(\w+)\s*(\+=|-=|=)\s*(.+)$/);
      if (!m) return null;
      return this.b.make('verse_set', { NAME: m[1], OP: m[2] }, this.value('V', this.expr.parse(m[3])));
    },

    // if (Agent := MaybeAgent?):  (these two blocks have no else; with one, "if it exists" takes the line)
    ({ text, body, rest }) =>
      /^if\s*\(\s*Agent\s*:=\s*MaybeAgent\?\s*\)\s*:$/.test(text) && !hasElse(rest) ? this.b.make('verse_unwrap_agent', null, { DO: body()! }) : null,

    // if (FortChar := Agent.GetFortCharacter[]):
    ({ text, body, rest }) => {
      const m = text.match(/^if\s*\(\s*FortChar\s*:=\s*(Agent|Player)\.GetFortCharacter\[\]\s*\)\s*:$/);
      return m && !hasElse(rest) ? this.b.make('verse_fort_character', { WHO: m[1] }, { DO: body()! }) : null;
    },

    // if (A := X, B := Y, …): several parts that must all succeed — "all of" with bindings
    ({ text, node, rest }) => {
      const m = text.match(/^if\s*\((.*)\)\s*:$/);
      const parts = m ? splitArgs(m[1]) : [];
      if (parts.length < 2 || parts.length > 4) return null;
      const inputs: NonNullable<BlockState['inputs']> = {};
      parts.forEach((part, i) => {
        const bind = part.match(/^([A-Za-z_]\w*)\s*:=\s*(.+)$/);
        inputs['ABCD'[i]] = { block: bind
          ? this.b.make('verse_bind', { VAR: bind[1] }, { VALUE: { block: this.expr.parse(bind[2])! } })
          : this.expr.parse(part)! };
      });
      const all = this.b.make('verse_all', null, inputs);
      const thenPart = this.b.chain(this.parse(node.children));
      const otherwise = this.elseOf(rest);
      if (otherwise) return { block: this.b.make('verse_if_else', null, { COND: { block: all }, DO: thenPart!, ELSE: otherwise.stack! }), usedNext: otherwise.used };
      return this.b.make('verse_if', null, { COND: { block: all }, DO: thenPart! });
    },

    // if (Name := something that can fail): … with an optional else: (or else if)
    ({ text, node, rest }) => {
      const m = text.match(/^if\s*\(\s*(\w+)\s*:=\s*(.+)\)\s*:$/);
      if (!m) return null;
      const value = this.expr.parse(m[2]);
      // Binding an item of a device array makes the name usable as that device inside.
      const item = m[2].match(/^(\w+)\[/);
      const inner = this.scoped(m[1], item ? this.ctx.deviceArrays[item[1]] : undefined);
      const thenPart = this.b.chain(inner.parse(node.children));
      const otherwise = this.elseOf(rest);
      if (otherwise) {
        return { block: this.b.make('verse_if_bind', { VAR: m[1] }, { VALUE: { block: value! }, DO: thenPart!, ELSE: otherwise.stack! }), usedNext: otherwise.used };
      }
      return this.b.make('verse_if_bind', { VAR: m[1] }, { VALUE: { block: value! }, DO: thenPart! });
    },

    // if (condition): … with an optional else: (or else if) after it
    ({ text, rest, body }) => {
      const m = text.match(/^if\s*\((.*)\)\s*:$/);
      // if (X := …) is "if it exists" (the rule above); := elsewhere, like vector3{X := 1.0…}, is fine.
      if (!m || /^\s*\w+\s*:=/.test(m[1])) return null;
      const cond = this.expr.parse(m[1]);
      const otherwise = this.elseOf(rest);
      if (otherwise) {
        return { block: this.b.make('verse_if_else', null, { COND: { block: cond! }, DO: body()!, ELSE: otherwise.stack! }), usedNext: otherwise.used };
      }
      return this.b.make('verse_if', null, { COND: { block: cond! }, DO: body()! });
    },

    // for (Player : GetPlayspace().GetPlayers()):
    ({ text, body }) =>
      /^for\s*\(\s*Player\s*:\s*GetPlayspace\(\)\.GetPlayers\(\)\s*\)\s*:$/.test(text) ? this.b.make('verse_for_players', null, { DO: body()! }) : null,

    // for (I := 1..5):
    ({ text, body }) => {
      const m = text.match(/^for\s*\(\s*(\w+)\s*:=\s*(-?\d+)\s*\.\.\s*(-?\d+)\s*\)\s*:$/);
      return m ? this.b.make('verse_for_range', { VAR: m[1], FROM: Number(m[2]), TO: Number(m[3]) }, { DO: body()! }) : null;
    },

    // for (Item : Items):   /   for (Key -> Item : Items):
    ({ text, node }) => {
      const m = text.match(/^for\s*\(\s*(?:(\w+)\s*->\s*)?(\w+)\s*:(?!=)\s*(.+)\)\s*:$/);
      if (!m) return null;
      const collection = this.expr.parse(m[3]);
      const inner = this.scoped(m[2], this.ctx.deviceArrays[m[3].trim()]);
      const loopBody = this.b.chain(inner.parse(node.children));
      return this.b.make('verse_for_each', { VAR: m[2], KEYED: m[1] ? 'TRUE' : 'FALSE', KEY: m[1] || 'Key' },
        { COLLECTION: { block: collection! }, DO: loopBody! });
    },

    // return / return Value
    ({ text }) => {
      const m = text.match(/^return(?:\s+(.+))?$/);
      if (!m) return null;
      return this.b.make('verse_return', null, m[1] ? this.value('VALUE', this.expr.parse(m[1])) : undefined);
    },

    ({ text, body }) => (text === 'loop:' ? this.b.make('verse_loop', null, { DO: body()! }) : null),
    ({ text }) => (text === 'break' ? this.b.make('verse_break') : null),

    // spawn{MyFunction()}
    ({ text }) => {
      const m = text.match(/^spawn\s*\{\s*(\w+)\(\)\s*\}$/);
      return m ? this.b.make('verse_spawn', { NAME: m[1] }) : null;
    },

    // race: / sync: with exactly two block: branches
    ({ text, node, body }) => {
      const m = text.match(/^(race|sync):$/);
      const kids = node.children;
      if (!m || kids.length !== 2 || !kids.every(k => stripComment(k.text) === 'block:')) return null;
      const a = body(kids[0].children), b = body(kids[1].children);
      return this.b.make('verse_race', { KIND: m[1] }, { A: a!, B: b! });
    },

    // Local values: Name := value   /   Name:type = value   /   var Name:type = value
    ({ text }) => {
      const m = text.match(/^(var\s+)?([A-Za-z_]\w*)\s*(?::\s*(\??(?:\[\w*\])*[A-Za-z_]\w*)\s*=|:=)\s*(.+)$/);
      if (!m || (m[1] && !m[3])) return null;
      const [, isVar, name, type = '', value] = m;
      this.expr.learnLocal(name, type);
      return this.b.make('verse_local', { KIND: isVar ? 'var' : 'const', NAME: name, TYPE: type }, this.value('VALUE', this.expr.parse(value)));
    },

    // MyFunction() / MyFunction(a, b) — only functions defined in this device
    ({ text }) => {
      const m = text.match(/^(\w+)\((.*)\)$/);
      const fn = m ? this.ctx.functions.get(m[1]) : undefined;
      if (!m || !fn || fn.decides) return null;
      const inputs = this.argInputs(m[2]);
      if (!inputs) return null;
      return this.b.make('verse_call_fn', { NAME: m[1] }, Object.keys(inputs).length ? inputs : undefined);
    },

    // OldCat.Meow() / Obj.Method(a, b) — any method that isn't a known device action
    ({ text }) => {
      const m = text.match(/^(\w+)\.(\w+)\((.*)\)$/);
      if (!m || !balanced(m[3])) return null; // A.B().C() is a chain (below), not one call
      const parts = splitArgs(m[3]);
      if (parts.length > 4) return null;
      const inputs: NonNullable<BlockState['inputs']> = {};
      parts.forEach((part, i) => { const v = this.expr.parse(part); if (v) inputs[`A${i + 1}`] = { block: v }; });
      return this.b.make('verse_method_call', { OBJ: m[1], METHOD: m[2] }, Object.keys(inputs).length ? inputs : undefined);
    },

    // A.B().C(…) — a chain that ends in a call, as a line of its own: "do"
    ({ text }) => {
      const before = this.b.report.blocks, rawBefore = this.b.report.raw.length;
      const value = this.expr.tryParse(text);
      if (value?.type === 'verse_chain' && value.fields?.KIND !== 'field') return this.b.make('verse_do', null, { VALUE: { block: value } });
      this.b.report.blocks = before; this.b.report.raw.length = rawBefore; // not one: leave no trace
      return null;
    },

    // A line that is just a value, inside a <decides> function or one with a result: check / result
    ({ text }) => {
      const fn = this.ctx.inFunction;
      if (!fn || (!fn.decides && fn.returns === 'void')) return null;
      const value = this.expr.tryParse(text);
      return value ? this.b.make('verse_check', null, { VALUE: { block: value } }) : null;
    },
  ];
}
