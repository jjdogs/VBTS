/**
 * Questions the engine asks about the blocks on the workspace:
 * which devices are linked, which handlers exist, and what is "in scope" where a block sits.
 * These rules power the warnings (e.g. "No Agent here") and the smart dropdowns.
 */
import type { Block, Workspace } from './blockly.ts';

export interface PlacedDevice { name: string; type: string }
export interface PlacedHandler { name: string; param: 'agent' | 'maybe' | 'none' }
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
    .map(b => ({ name: field(b, 'NAME'), param: field(b, 'PARAM') as PlacedHandler['param'] })) : [];

export const functionsIn = (ws: Workspace | null): PlacedFunction[] =>
  ws ? ws.getBlocksByType('verse_function', false).map(b => ({
    name: field(b, 'NAME'),
    suspends: field(b, 'SUSPENDS') === 'TRUE',
    decides: field(b, 'DECIDES') === 'TRUE',
    returns: field(b, 'RET') || 'void',
    params: countParams(field(b, 'PARAMS')),
  })) : [];

/** How many inputs a function's parameter text declares ("A:int, B:int" → 2). */
export const countParams = (text: string): number => (text.trim() ? text.split(',').filter(p => p.trim()).length : 0);

/** Every declared variable: plain fields and containers (arrays, maps, options). */
export const fieldsIn = (ws: Workspace | null): PlacedField[] => {
  if (!ws) return [];
  const kinds: Array<[string, PlacedField['kind']]> = [
    ['verse_field', 'value'], ['verse_member_field', 'value'], ['verse_array_field', 'array'], ['verse_map_field', 'map'], ['verse_option_field', 'option'],
  ];
  return kinds.flatMap(([type, kind]) => ws.getBlocksByType(type, false).map(b => ({
    name: field(b, 'NAME'), type: field(b, 'TYPE') || field(b, 'ELEM') || field(b, 'VAL'),
    mutable: kind === 'option' || field(b, 'KIND') === 'var', kind, // options are always var
  })));
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
    if (e.block.type === 'verse_handler' || e.block.type === 'verse_device') return false;
  }
  return false;
}

/** The function block a block sits in, if any. */
export function enclosingFunction(block: Block): Block | null {
  for (const e of enclosing(block)) if (e.block.type === 'verse_function') return e.block;
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
  }
  return false;
}

/** Names a block can use because an enclosing block provides them. */
export type ScopeName = 'Agent' | 'MaybeAgent' | 'Player' | 'FortChar';

export function hasInScope(block: Block, name: ScopeName): boolean {
  for (const e of enclosing(block)) {
    const t = e.block.type;
    if (name === 'Agent' && t === 'verse_handler' && field(e.block, 'PARAM') === 'agent') return true;
    if (name === 'Agent' && t === 'verse_unwrap_agent') return true;
    if (name === 'MaybeAgent' && t === 'verse_handler' && field(e.block, 'PARAM') === 'maybe') return true;
    if (name === 'Player' && t === 'verse_for_players') return true;
    if (name === 'FortChar' && t === 'verse_fort_character') return true;
  }
  return false;
}
