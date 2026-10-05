/**
 * Text blocks: Print, text, and text with a value inside ({ } interpolation).
 */
import Blockly from '../blockly.ts';
import type { Block, BlockSvg, Field } from '../blockly.ts';
import { rerender } from '../fields.ts';
import { COLORS, DOCS } from '../data/modules.ts';
import { escapeString, Order } from '../generator/verse-generator.ts';
import { defineBlock } from '../registry.ts';
import { asStatement, f } from './shared.ts';

export const STRING = 'String';

/** Shows the value slots (and the text between them) that the chosen count uses. */
function showValues(block: Block, count: number): void {
  if (!(block as BlockSvg).rendered) return;
  let changed = false;
  for (let i = 2; i <= 3; i++) {
    const input = block.getInput(`V${i}`);
    const show = i <= count || !!input?.connection?.targetBlock();
    if (input && input.isVisible() !== show) { input.setVisible(show); changed = true; }
  }
  if (changed) rerender(block);
}

export function registerTextBlocks(): void {
  defineBlock({
    type: 'verse_print',
    colour: COLORS.text,
    explain: {
      title: 'Print', doc: DOCS.quick, tip: 'Writes text to the UEFN output log (and on screen while testing).',
      text: 'Print is part of Verse itself (/Verse.org/Verse), so it needs no using line. It takes a string; numbers get wrapped in "{ }" string interpolation automatically.',
    },
    init() {
      this.appendValueInput('TEXT').appendField('print');
      asStatement(this);
    },
    generate(b, g) {
      const target = b.getInputTargetBlock('TEXT');
      let value = g.valueToCode(b, 'TEXT', Order.NONE);
      if (!value) {
        g.warn(b, 'print needs something to print.');
        value = '""';
      } else if (target && !(target.outputConnection?.getCheck() ?? []).includes(STRING) && !(target.type === 'verse_raw_expr' && /^".*"$/.test(value))) {
        value = `"{${value}}"`; // Print takes a string, so wrap non-text values
      }
      return `Print(${value})\n`;
    },
  });

  defineBlock({
    type: 'verse_text',
    colour: COLORS.text,
    explain: {
      title: 'Text', doc: DOCS.quick, tip: 'A string of text.',
      text: 'Strings go in double quotes. Characters like { } and " are escaped with a backslash.',
    },
    init() {
      this.appendDummyInput().appendField('"').appendField(new Blockly.FieldTextInput('Hello, world!'), 'TEXT').appendField('"');
      this.setOutput(true, STRING);
    },
    generate: (b) => [`"${escapeString(f(b, 'TEXT'))}"`, Order.ATOMIC],
  });

  defineBlock({
    type: 'verse_text_join',
    colour: COLORS.text,
    explain: {
      title: 'Text with a value', doc: DOCS.quick, tip: 'Builds text with a value inside, like "Score: {Score}".',
      text: 'String interpolation: anything inside { } in a string is turned into text. "Score: {Score}" shows the current Score.',
    },
    init() {
      this.appendValueInput('V').appendField('"').appendField(new Blockly.FieldTextInput('Score: '), 'LABEL').appendField('{');
      this.appendDummyInput().appendField('}"');
      this.setInputsInline(true);
      this.setOutput(true, STRING);
    },
    generate: (b, g) => [`"${escapeString(f(b, 'LABEL'))}{${g.valueToCode(b, 'V', Order.NONE) || ''}}"`, Order.ATOMIC],
  });

  // Text with up to three values anywhere: "You have {Coins} coins", "{A} vs {B}".
  defineBlock({
    type: 'verse_text_multi',
    colour: COLORS.text,
    explain: {
      title: 'Text with values', doc: DOCS.quick, tip: 'Text with values anywhere inside: "You have {Coins} coins".',
      text: 'String interpolation with text before, between and after the values: "Round {Round} of {Rounds}". Pick how many values (1 to 3); each { } is turned into text.',
    },
    init() {
      this.appendValueInput('V1').appendField('"').appendField(new Blockly.FieldTextInput('You have '), 'T0').appendField('{');
      this.appendValueInput('V2').appendField('}').appendField(new Blockly.FieldTextInput(' of '), 'T1').appendField('{');
      this.appendValueInput('V3').appendField('}').appendField(new Blockly.FieldTextInput(' and '), 'T2').appendField('{');
      this.appendDummyInput('END').appendField('}').appendField(new Blockly.FieldTextInput(' coins'), 'TEND').appendField('"')
        .appendField(new Blockly.FieldDropdown([['1 value', '1'], ['2 values', '2'], ['3 values', '3']], function (this: Field, v: string) {
          const b = this.getSourceBlock();
          if (b) showValues(b, Number(v));
          return v;
        }), 'COUNT');
      this.setInputsInline(true);
      this.setOutput(true, STRING);
      showValues(this, Number(f(this, 'COUNT')));
    },
    generate(b, g) {
      const count = Math.min(3, Math.max(1, Number(f(b, 'COUNT')) || 1));
      let out = `"${escapeString(f(b, 'T0'))}`;
      for (let i = 1; i <= count; i++) {
        const v = g.valueToCode(b, `V${i}`, Order.NONE);
        if (!v) g.warn(b, `Plug in value ${i} of the text.`);
        out += `{${v}}${i < count ? escapeString(f(b, `T${i}`)) : ''}`;
      }
      return [`${out}${escapeString(f(b, 'TEND'))}"`, Order.ATOMIC];
    },
  });
}
