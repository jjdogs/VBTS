/**
 * Questions the engine asks about the blocks on the workspace:
 * which devices are linked, which handlers exist, and what is "in scope" where a block sits.
 * These rules power the warnings (e.g. "No Agent here") and the smart dropdowns.
 */
import type { Block, Workspace } from './blockly.ts';
import { handlerInputs } from './data/handlers.ts';

export interface PlacedDevice { name: string; type: string }
/** param: a HANDLER_INPUTS key (agent, maybe, none, player, elimination…). */
export interface PlacedHandler { name: string; param: string }
export interface PlacedFunction { name: string; suspends: boolean; decides: boolean; returns: string; params: number }
export interface PlacedField { name: string; type: string; mutable: boolean; kind: 'value' | 'array' | 'map' | 'option' }

/**
 * The workspace a block's dropdowns should look at. Blocks in the toolbox flyout
 * live in their own little workspace, so they look at the main one instead.
 */
export function liveWorkspace(block: Block | null | undefined): Workspace | null {
  if (!block || !block.workspace) return null;
  const ws = block.workspace;
  const target = (ws as Workspace & { targetWorkspace?: Workspace }).targetWorkspace;
  return ws.isFlyout && target ? target : ws;
}

const field = (b: Block, name: string): string => String(b.getFieldValue(name) ?? '');

export const devicesIn = (ws: Workspace | null): PlacedDevice[] =>
  ws ? ws.getBlocksByType('verse_editable', false).filter(b => b.isEnabled())
    .map(b => ({ name: field(b, 'NAME'), type: field(b, 'DTYPE') })) : [];

export const handlersIn = (ws: Workspace | null): PlacedHandler[] =>
  ws ? ws.getBlocksByType('verse_handler', false)
    .map(b => ({ name: field(b, 'NAME'), param: field(b, 'PARAM') })) : [];

/** Your functions, plus handlers (a handler is a plain function too, so it can be called directly). */
export const functionsIn = (ws: Workspace | null): PlacedFunction[] =>
  ws ? [
    ...ws.getBlocksByType('verse_function', false).map(b => ({
      name: field(b, 'NAME'),
      suspends: field(b, 'SUSPENDS') === 'TRUE',
      decides: field(b, 'DECIDES') === 'TRUE',
      returns: field(b, 'RET') || 'void',
      params: countParams(field(b, 'PARAMS')),
    })),
    ...handlersIn(ws).map(h => ({ name: h.name, suspends: false, decides: false, returns: 'void', params: handlerInputs(h.param).length })),
  ] : [];

/** How many inputs a function's parameter text declares ("A:int, B:int" → 2). */
export const countParams = (text: string): number => (text.trim() ? text.split(',').filter(p => p.trim()).length : 0);

/** Every declared variable: plain fields and containers (arrays, maps, options). */
export const fieldsIn = (ws: Workspace | null): PlacedField[] => {
  if (!ws) return [];
  const kinds: Array<[string, PlacedField['kind']]> = [
    ['verse_field', 'value'], ['verse_member_field', 'value'], ['verse_array_field', 'array'], ['verse_map_field', 'map'], ['verse_option_field', 'option'],
  ];
  const declared = kinds.flatMap(([type, kind]) => ws.getBlocksByType(type, false).map(b => ({
    name: field(b, 'NAME'), type: field(b, 'TYPE') || field(b, 'ELEM') || field(b, 'VAL'),
    mutable: kind === 'option' || field(b, 'KIND') === 'var', kind, // options are always var
  })));
  // Local values in functions: the kind comes from the type written (none for Name := value).
  const locals = ws.getBlocksByType('verse_local', false).map((b): PlacedField => {
    const type = field(b, 'TYPE');
    const kind = type.startsWith('[]') ? 'array' : /^\[\w+\]/.test(type) ? 'map' : type.startsWith('?') ? 'option' : 'value';
    return { name: field(b, 'NAME'), type, mutable: field(b, 'KIND') === 'var', kind };
  });
  return [...declared, ...locals];
};

/**
 * Names declared in raw Verse member lines (types blocks can't show yet), read from the line:
 * `var Score:int = 0`, `@editable Trigger:trigger_device = …`, `OnJoin(Agent:agent):void = …`.
 * The checks count them, so code that only exists as raw Verse isn't reported as missing.
 */
export interface RawDeclaration { name: string; editable: boolean; mutable: boolean; isFunction: boolean; params: string }
const RAW_MEMBERS = ['verse_raw_member', 'verse_raw_member_wrap'];
export function parseRawDeclaration(code: string): RawDeclaration | null {
  const line = code.split('\n')[0];
  // Parameters may hold brackets of their own: ScreenSpot:(/Verse.org/SpatialMath:)vector3
  const m = line.match(/^\s*((?:@\w+\s+)*)(var\s+)?([A-Za-z_]\w*)\s*((?:<\w+>\s*)*)(\(((?:[^()]|\([^()]*\))*)\))?\s*(?:<\w+>\s*)*(?::|=)/);
  if (!m) return null;
  return { name: m[3], editable: /@editable\b/.test(m[1]), mutable: !!m[2], isFunction: m[5] !== undefined, params: m[6] ?? '' };
}
export const rawDeclarationsIn = (ws: Workspace | null): RawDeclaration[] =>
  ws ? RAW_MEMBERS.flatMap(t => ws.getBlocksByType(t, false)).filter(b => b.isEnabled())
    .map(b => parseRawDeclaration(field(b, 'CODE'))).filter((d): d is RawDeclaration => d !== null) : [];
export const rawDeclared = (ws: Workspace | null, name: string): RawDeclaration | undefined =>
  rawDeclarationsIn(ws).find(d => d.name === name);

/** Raw Verse blocks that wrap other blocks (the first line is written as typed). */
const RAW_WRAPS = ['verse_raw_wrap', 'verse_raw_member_wrap'];
/** A raw wrapper that defines a function: `GetSubscribe<override>()<transacts>:tuple(…) =`. */
const rawFunctionHeader = (b: Block): string | null => {
  if (!RAW_WRAPS.includes(b.type)) return null;
  const head = field(b, 'CODE').split('\n')[0];
  return parseRawDeclaration(head)?.isFunction ? head : null;
};

/** @editable device arrays: name → device type. */
export const deviceArraysIn = (ws: Workspace | null): PlacedDevice[] =>
  ws ? ws.getBlocksByType('verse_editable_array', false).filter(b => b.isEnabled())
    .map(b => ({ name: field(b, 'NAME'), type: field(b, 'DTYPE') })) : [];

/** The device type of an @editable slot, looked up by its name. */
export const deviceTypeOf = (ws: Workspace | null, name: string): string | undefined =>
  devicesIn(ws).find(d => d.name === name)?.type;

/**
 * Devices a block can use by name: @editable slots, plus loop variables and "if it exists"
 * names that hold one device from an @editable device array (e.g. `for (T : Targets)`).
 */
export function devicesInScope(block: Block | null): PlacedDevice[] {
  const ws = liveWorkspace(block);
  const found = devicesIn(ws);
  if (!block) return found;
  const arrays = deviceArraysIn(ws);
  const arrayType = (b: Block | null): string | undefined => {
    // `Targets` (for each) or `Targets[…]` (if it exists) where Targets is a device array
    if (!b) return undefined;
    if (b.type === 'verse_get' || b.type === 'verse_index') return arrays.find(a => a.name === field(b, 'NAME'))?.type;
    return undefined;
  };
  for (const e of enclosing(block)) {
    const t = e.block.type;
    if (t === 'verse_for_each' && e.input === 'DO') {
      const type = arrayType(e.block.getInputTargetBlock('COLLECTION'));
      if (type) found.push({ name: field(e.block, 'VAR'), type });
    }
    if (t === 'verse_if_bind' && e.input === 'DO') {
      const v = e.block.getInputTargetBlock('VALUE');
      if (v?.type === 'verse_index') { const type = arrayType(v); if (type) found.push({ name: field(e.block, 'VAR'), type }); }
    }
  }
  return found;
}

/** Device type for a name as seen from where a block sits (see devicesInScope). */
export const deviceTypeFor = (block: Block, name: string): string | undefined =>
  devicesInScope(block).find(d => d.name === name)?.type;

/**
 * True if a value block sits somewhere Verse allows failure: an if condition,
 * "if it exists", setting a container entry, or a check line in a <decides> function.
 */
export function inFailureContext(block: Block): boolean {
  let child: Block = block;
  let parent = block.getParent();
  while (parent && parent.outputConnection) { child = parent; parent = parent.getParent(); }
  if (!parent) return false;
  const input = parent.getInputWithBlock(child)?.name;
  if ((parent.type === 'verse_if' || parent.type === 'verse_if_else') && input === 'COND') return true;
  if (parent.type === 'verse_if_bind' && input === 'VALUE') return true;
  if (parent.type === 'verse_set_index') return true;
  if (parent.type === 'verse_check') return inDecides(parent);
  return false;
}

/** True if a block is inside a function marked <decides>. */
export function inDecides(block: Block): boolean {
  for (const e of enclosing(block)) {
    if (e.block.type === 'verse_function') return field(e.block, 'DECIDES') === 'TRUE';
    const raw = rawFunctionHeader(e.block);
    if (raw !== null) return /<decides>/.test(raw);
    if (e.block.type === 'verse_handler' || e.block.type === 'verse_device') return false;
  }
  return false;
}

/** The function block a block sits in, if any (a raw Verse function header counts too). */
export function enclosingFunction(block: Block): Block | null {
  for (const e of enclosing(block)) if (e.block.type === 'verse_function' || rawFunctionHeader(e.block) !== null) return e.block;
  return null;
}

// ---------- scope ----------

/** Walks outward through the blocks that contain this one, and which input it sits in. */
function* enclosing(block: Block): Generator<{ block: Block; input: string | null }> {
  let cur = block;
  let parent = cur.getSurroundParent();
  while (parent) {
    let child: Block = cur;
    while (child.getParent() && child.getParent() !== parent) child = child.getParent()!;
    const input = parent.getInputWithBlock(child);
    yield { block: parent, input: input ? input.name : null };
    cur = parent;
    parent = cur.getSurroundParent();
  }
}

/** True if the block runs in <suspends> code (OnBegin, or a function with <suspends> ticked). */
export function inSuspends(block: Block): boolean {
  for (const e of enclosing(block)) {
    if (e.block.type === 'verse_device') return e.input === 'ONBEGIN';
    if (e.block.type === 'verse_function') return field(e.block, 'SUSPENDS') === 'TRUE';
    if (e.block.type === 'verse_handler') return false;
    const raw = rawFunctionHeader(e.block);
    if (raw !== null) return /<suspends>/.test(raw);
  }
  return false;
}

/** Names a block can use because an enclosing block provides them. */
export type ScopeName = 'Agent' | 'MaybeAgent' | 'Player' | 'FortChar' | 'Result' | 'Message';

/** Names made by "name := value" parts of a condition (verse_bind blocks). */
const bindsIn = (cond: Block | null): string[] =>
  cond ? [cond, ...cond.getDescendants(false)].filter(b => b.type === 'verse_bind').map(b => field(b, 'VAR')) : [];

/** A local value with this name above the block in its function (Player := Message.Player). */
function localAbove(block: Block, name: string): boolean {
  let cur: Block | null = block;
  while (cur && cur.outputConnection) cur = cur.getParent(); // from a value up to its statement
  // Previous statements, then the block holding them, then its previous statements…
  for (let b = cur?.getPreviousBlock() ?? null; b; b = b.getPreviousBlock()) {
    if (b.type === 'verse_function' || b.type === 'verse_handler' || b.type === 'verse_device') return false;
    if (b.type === 'verse_local' && field(b, 'NAME') === name) return true;
  }
  return false;
}

export function hasInScope(block: Block, name: ScopeName): boolean {
  if (localAbove(block, name)) return true;
  for (const e of enclosing(block)) {
    const t = e.block.type;
    // A handler's Agent, MaybeAgent or Player input (including handlers of events that send several values)
    if (['Agent', 'MaybeAgent', 'Player'].includes(name) && t === 'verse_handler' && handlerInputs(field(e.block, 'PARAM')).some(i => i.name === name)) return true;
    if (name === 'Agent' && t === 'verse_unwrap_agent') return true;
    if (name === 'Player' && t === 'verse_for_players') return true;
    // if (Player := player[Agent]):  — any "if it exists" that names the value
    if (t === 'verse_if_bind' && e.input === 'DO' && field(e.block, 'VAR') === name) return true;
    // if (Player := player[Agent], …):  — a name made in the condition, used in the then part
    if ((t === 'verse_if' || t === 'verse_if_else') && e.input === 'DO' && bindsIn(e.block.getInputTargetBlock('COND')).includes(name)) return true;
    // …or in a later part of the same "all of": Player := player[Agent], UI := GetPlayerUI[Player]
    if (t === 'verse_all' && e.input) {
      const earlier = ['A', 'B', 'C', 'D'].slice(0, ['A', 'B', 'C', 'D'].indexOf(e.input));
      if (earlier.some(p => bindsIn(e.block.getInputTargetBlock(p)).includes(name))) return true;
    }
    if (name === 'FortChar' && t === 'verse_fort_character') return true;
    if (name === 'Result' && t === 'verse_handler' && ['elimination', 'damage', 'ai'].includes(field(e.block, 'PARAM'))) return true;
    if (name === 'Message' && t === 'verse_handler' && field(e.block, 'PARAM') === 'widget') return true;
    // A function input with that name: WatchPlayer(Player:player), AddPoint(Agent:agent, Team:team)
    if (t === 'verse_function' && new RegExp(`(^|,)\\s*${name}\\s*:`).test(field(e.block, 'PARAMS'))) return true;
    // …or in a raw Verse function header: Signal<override>(Agent:agent):void =
    const raw = rawFunctionHeader(e.block);
    if (raw !== null && new RegExp(`(^|,)\\s*${name}\\s*:`).test(parseRawDeclaration(raw)!.params)) return true;
  }
  return false;
}
