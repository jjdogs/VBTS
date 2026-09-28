/**
 * Small helpers shared by block definitions.
 */
import Blockly from '../blockly.ts';
import type { Block } from '../blockly.ts';
import type { VerseGenerator } from '../generator/verse-generator.ts';
import { EXPLAIN } from '../registry.ts';
import { hasInScope } from '../workspace.ts';

/** Connection types: which slots a block can snap into. */
export const Slot = {
  STATEMENT: 'stmt',   // inside OnBegin, handlers, ifs, loops…
  MEMBER: 'member',    // "linked devices & variables"
  FUNCTION: 'fn',      // "functions & event handlers"
  USING: 'using',      // the using slot at the top of a device
} as const;

/** Makes a block stack like a normal statement (snaps above and below). */
export function asStatement(block: Block): void {
  block.setPreviousStatement(true, Slot.STATEMENT);
  block.setNextStatement(true, Slot.STATEMENT);
}

/** Makes a block stack in one kind of slot (or several). */
export function stacksIn(block: Block, slot: string | string[]): void {
  block.setPreviousStatement(true, slot);
  block.setNextStatement(true, slot);
}

/** Code for a block's inner stack. Verse needs at least one line there, so empty bodies warn. */
export function body(gen: VerseGenerator, block: Block, input: string): string {
  const code = gen.statementToCode(block, input);
  if (!code.trim()) {
    const title = EXPLAIN[block.type]?.title ?? block.type;
    gen.warn(block, `"${title}" has an empty ${input === 'DO' ? 'body' : input.toLowerCase()} — Verse needs at least one expression there.`);
    return gen.INDENT + '# (empty — drag blocks here)\n';
  }
  return code;
}

/** Warns when Agent or Player is used somewhere it doesn't exist. */
export function checkAgent(gen: VerseGenerator, block: Block, who: string): void {
  if (who !== 'Agent' && who !== 'Player') return;
  if (!hasInScope(block, who)) {
    gen.warn(block, who === 'Agent'
      ? 'No Agent here. Put this inside a handler that receives an agent, or inside "if there is an agent".'
      : 'No Player here. Put this inside "for each Player in the game".');
  }
}

/** Reads a field as a string. */
export const f = (block: Block, name: string): string => String(block.getFieldValue(name) ?? '');

/** Access specifiers for members (Verse style guide 6.2: prefer <private> where you can). */
export const VISIBILITY = ['none', 'private', 'protected', 'internal', 'public'] as const;
export const visibilityDropdown = () =>
  new Blockly.FieldDropdown(VISIBILITY.map(v => [v === 'none' ? '(any)' : `<${v}>`, v]));
/** "<private>" etc. for a block's VIS field, or "" when none is chosen. */
export const visibility = (b: Block): string => {
  const v = String(b.getFieldValue('VIS') ?? 'none');
  return v && v !== 'none' ? `<${v}>` : '';
};
