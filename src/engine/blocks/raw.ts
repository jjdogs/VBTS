/**
 * Raw Verse blocks: Verse text kept word for word. The text → blocks converter uses these
 * for anything that has no block yet, so nothing is ever lost.
 */
import Blockly from '../blockly.ts';
import type { Block } from '../blockly.ts';
import { COLORS, DOCS } from '../data/modules.ts';
import type { VerseGenerator } from '../generator/verse-generator.ts';
import { Order } from '../generator/verse-generator.ts';
import { defineBlock } from '../registry.ts';
import type { Explain } from '../types.ts';
import { asStatement, body, f, Slot, stacksIn } from './shared.ts';

const explain: Explain = {
  title: 'Raw Verse', doc: DOCS.quick,
  tip: 'Verse text kept exactly as written. Verse Blocks does not check it.',
  text: 'When you convert text to blocks, anything Verse Blocks does not have a block for yet is kept here word for word, so nothing is lost. It is written back out exactly as it is. Because it is not checked, the UEFN compiler is the judge for these lines.',
};

const codeField = (block: Block) =>
  block.appendDummyInput().appendField('Verse').appendField(new Blockly.FieldTextInput(''), 'CODE');

const noteRaw = (b: Block, g: VerseGenerator) => g.warn(b, 'Raw Verse is written out exactly as typed and is not checked here.', 'tip');

export function registerRawBlocks(): void {
  defineBlock({
    type: 'verse_raw', colour: COLORS.raw, explain,
    init() { codeField(this); asStatement(this); },
    generate: (b, g) => (noteRaw(b, g), `${f(b, 'CODE')}\n`),
  });

  defineBlock({
    type: 'verse_raw_wrap', colour: COLORS.raw, explain,
    init() {
      codeField(this);
      this.appendStatementInput('DO').setCheck(Slot.STATEMENT);
      asStatement(this);
    },
    generate: (b, g) => (noteRaw(b, g), `${f(b, 'CODE')}\n${body(g, b, 'DO')}`),
  });

  defineBlock({
    type: 'verse_raw_member', colour: COLORS.raw, explain,
    init() { codeField(this); stacksIn(this, [Slot.MEMBER, Slot.FUNCTION]); },
    generate: (b, g) => (noteRaw(b, g), `${f(b, 'CODE')}\n`),
  });

  defineBlock({
    type: 'verse_raw_member_wrap', colour: COLORS.raw, explain,
    init() {
      codeField(this);
      this.appendStatementInput('DO').setCheck(Slot.STATEMENT);
      stacksIn(this, [Slot.MEMBER, Slot.FUNCTION]);
    },
    generate: (b, g) => (noteRaw(b, g), `${f(b, 'CODE')}\n${body(g, b, 'DO')}`),
  });

  defineBlock({
    type: 'verse_raw_expr', colour: COLORS.raw, explain,
    init() {
      this.appendDummyInput().appendField(new Blockly.FieldTextInput(''), 'CODE');
      this.setOutput(true, null);
    },
    // OR is the loosest order, so Blockly adds parentheses around raw values when needed.
    generate: (b) => [f(b, 'CODE') || '0', Order.OR],
  });
}
