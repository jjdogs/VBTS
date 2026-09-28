/**
 * Verse Blocks engine: the public front door.
 * The UI only talks to the engine through what this file exports.
 */
import { registerAllBlocks } from './blocks/index.ts';
import { CATALOG } from './catalog.ts';
import { LESSONS } from './content/lessons.ts';
import { TEMPLATES } from './content/templates/index.ts';
import { COLORS, DOCS, MODULES } from './data/modules.ts';
import { explainFor } from './explain.ts';
import { generate, snippetFor } from './generator/generate.ts';
import { parseVerse } from './parser/index.ts';
import { EXPLAIN, recolourBlocks, resolveColour, setColourOverrides } from './registry.ts';
import { renameEverywhere } from './style.ts';
import { setLabelStyle } from './code-labels.ts';
import { TOOLBOX } from './toolbox.ts';

export type * from './types.ts';

/** Registers every block with Blockly (safe to call more than once) and returns the engine. */
export function createEngine() {
  registerAllBlocks();
  return { setLabelStyle, snippetFor, generate, parseVerse, explainFor, renameEverywhere, setColourOverrides, recolourBlocks, resolveColour, TOOLBOX, LESSONS, TEMPLATES, EXPLAIN, CATALOG, MODULES, COLORS, DOCS };
}

export type Engine = ReturnType<typeof createEngine>;
