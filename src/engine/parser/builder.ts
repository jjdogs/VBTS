/**
 * Builds Blockly JSON for the converter and keeps the conversion report.
 */
import type { BlockState, LineSpan, ParseReport } from '../types.ts';

type Inputs = NonNullable<BlockState['inputs']>;
type Fields = NonNullable<BlockState['fields']>;
export type NextLink = { block: BlockState };

export class BlockBuilder {
  report: ParseReport = { blocks: 0, raw: [], skipped: [], notes: [] };
  /** How many end-of-line comments were kept on blocks (the rest are reported as dropped). */
  notesKept = 0;
  /** Block id → lines of the original text it came from. */
  spans: Record<string, LineSpan> = {};
  private nextId = 0;

  /** Remembers which source lines (0-based, inclusive) a block came from. */
  track(block: BlockState, first: number, last: number): void {
    block.id ??= `src${++this.nextId}`;
    this.spans[block.id] = [first, Math.max(first, last)];
  }

  /** Makes one block. */
  make(type: string, fields?: Fields | null, inputs?: Inputs): BlockState {
    this.report.blocks++;
    const block: BlockState = { type };
    if (fields) block.fields = fields;
    if (inputs) block.inputs = inputs;
    return block;
  }

  /** Keeps a comment from the end of a line on the block made from it (shown as its comment bubble). */
  note(block: BlockState | null | undefined, text: string | null): void {
    if (!block || !text || block.type === 'verse_comment') return;
    (block as BlockState & { icons?: Record<string, unknown> }).icons = { comment: { text, pinned: false } };
    this.notesKept++;
  }

  /** Makes a raw Verse block that keeps `code` word for word. */
  raw(type: string, code: string, inputs?: Inputs): BlockState {
    this.report.raw.push(code);
    return this.make(type, { CODE: code }, inputs);
  }

  /** Links blocks into a stack (each one's `next` is the one after). */
  chain(blocks: Array<BlockState | null | undefined>): NextLink | undefined {
    const list = blocks.filter((b): b is BlockState => !!b);
    for (let i = 0; i < list.length - 1; i++) list[i].next = { block: list[i + 1] };
    return list.length ? { block: list[0] } : undefined;
  }
}

/** Wraps a child block for an input slot. */
export const slot = (block: BlockState | null | undefined): { block: BlockState } | undefined =>
  block ? { block } : undefined;
