/**
 * Where blocks are registered. `defineBlock` keeps everything about a block together:
 * its shape (init), the Verse it writes (generate) and its explanation.
 */
import Blockly from './blockly.ts';
import type { Block, Workspace } from './blockly.ts';
import { beginLabels, endLabels } from './code-labels.ts';
import { verse, type VerseGenerator } from './generator/verse-generator.ts';
import type { Explain } from './types.ts';

/** Statement blocks return a string; value blocks return [code, precedence]. */
export type GenerateFn = (block: Block, gen: VerseGenerator) => string | [string, number];

export interface BlockDefinition {
  type: string;
  colour: string;
  explain: Explain;
  /** Builds the block's inputs and fields. `this` is the block. */
  init: (this: Block) => void;
  generate: GenerateFn;
}

/** Explanations for every block type, used by tooltips and the coach panel. */
export const EXPLAIN: Record<string, Explain> = {};

/** Each block type's default colour, so colours can be changed later (Appearance panel). */
const TYPE_COLOUR: Record<string, string> = {};
/** Default colour → user's chosen colour. */
let colourOverrides: Record<string, string> = {};

/** The colour to use for a default colour, after the user's changes. */
export const resolveColour = (defaultColour: string): string => colourOverrides[defaultColour.toLowerCase()] ?? defaultColour;

/** Sets custom block colours (default colour → new colour) for blocks made from now on. */
export function setColourOverrides(map: Record<string, string>): void {
  colourOverrides = Object.fromEntries(Object.entries(map).map(([k, v]) => [k.toLowerCase(), v]));
}

/** Recolours existing blocks in a workspace to match the current overrides. */
export function recolourBlocks(ws: Workspace): void {
  for (const b of ws.getAllBlocks(false)) {
    const base = TYPE_COLOUR[b.type];
    if (base) b.setColour(resolveColour(base));
  }
}

export function defineBlock(def: BlockDefinition): void {
  EXPLAIN[def.type] = def.explain;
  TYPE_COLOUR[def.type] = def.colour;
  Blockly.Blocks[def.type] = {
    init(this: Block) {
      this.setColour(resolveColour(def.colour));
      beginLabels(def.type);
      def.init.call(this);
      endLabels(this); // code-style labels, when turned on (code-labels.ts)
      this.setTooltip(def.explain.tip);
      this.setHelpUrl(def.explain.doc);
    },
  };
  verse.forBlock[def.type] = def.generate;
}
