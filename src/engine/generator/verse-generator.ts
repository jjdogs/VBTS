/**
 * The Verse code generator: Blockly's CodeGenerator plus the bookkeeping Verse Blocks needs
 * while it writes code (which modules are used, warnings, helper functions).
 */
import Blockly from '../blockly.ts';
import type { Block } from '../blockly.ts';
import type { Fix, Warning, WarningLevel } from '../types.ts';

/**
 * Operator precedence for value blocks, lowest number binds tightest.
 * Blockly adds parentheses when an inner value binds looser than where it is used.
 */
export const Order = {
  ATOMIC: 0, UNARY: 2, MUL: 3, ADD: 4, CMP: 5, NOT: 6, AND: 7, OR: 8, NONE: 99,
} as const;

/** Marks the start of a block's code so the UI can map lines back to blocks. See generate.ts. */
export const MARK_START = '\u0001';
export const MARK_COUNT = '\u0002';

/** Blocks that start a new function; a blank line is written before them. */
const FUNCTION_BLOCKS = ['verse_handler', 'verse_function', 'verse_raw_member_wrap'];

/** Counts the real code lines in generated text (ignoring markers and the final newline). */
export const countLines = (code: string): number =>
  code.split('\n').filter(l => !l.includes(MARK_START)).length - (code.endsWith('\n') ? 1 : 0);

export class VerseGenerator extends Blockly.CodeGenerator {
  /** Module path → names in the code that need it (shown as the reason next to using lines). */
  needs = new Map<string, Set<string>>();
  /** Extra definitions the code needs, e.g. 'msg' for the MakeMessage helper. */
  helpers = new Set<string>();
  warnings: Warning[] = [];

  constructor() {
    super('Verse');
    this.INDENT = '    ';
  }

  override init(): void {
    this.needs = new Map();
    this.helpers = new Set();
    this.warnings = [];
  }

  /** Adds a coach-panel message for a block. */
  warn(block: Block, msg: string, level: WarningLevel = 'error', fix: Fix | null = null): void {
    this.warnings.push({ id: block.id, msg, level, fix });
  }

  /** Records that the code needs a module, and which name needs it. */
  need(path: string, why: string): void {
    if (!this.needs.has(path)) this.needs.set(path, new Set());
    this.needs.get(path)!.add(why);
  }

  /**
   * Runs after each block's code is made. Adds the line-mapping marker, puts blank lines
   * between functions, then continues down the stack to the next block.
   */
  override scrub_(block: Block, code: string, thisOnly?: boolean): string {
    const next = block.nextConnection?.targetBlock() ?? null;
    let mark = '';
    if (block.previousConnection) {
      mark = MARK_START + block.id + MARK_COUNT + countLines(code) + '\n';
      const prev = block.getPreviousBlock();
      const follows = !!prev && prev.getNextBlock() === block;
      if (FUNCTION_BLOCKS.includes(block.type) && follows && prev!.type !== 'verse_comment') mark = '\n' + mark;
      // A comment right above a function takes the function's blank line.
      if (block.type === 'verse_comment' && follows && prev!.type !== 'verse_comment') {
        let after = next;
        while (after && after.type === 'verse_comment') after = after.getNextBlock();
        if (after && FUNCTION_BLOCKS.includes(after.type)) mark = '\n' + mark;
      }
    }
    return mark + code + (next && !thisOnly ? this.blockToCode(next) : '');
  }
}

/** The one generator instance used by every block. */
export const verse = new VerseGenerator();

// ---------- formatting helpers ----------

/** Escapes text for a Verse string literal. */
export const escapeString = (s: unknown): string =>
  String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\{/g, '\\{').replace(/\}/g, '\\}');

/** Writes a number as a Verse float: 2 → "2.0", 1.5 → "1.5". */
export const formatFloat = (n: unknown): string => {
  const v = Number(n) || 0;
  return Number.isInteger(v) ? v.toFixed(1) : String(v);
};
