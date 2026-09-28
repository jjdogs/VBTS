/**
 * Text blocks: Print, text, and text with a value inside ({ } interpolation).
 */
import Blockly from '../blockly.ts';
import { COLORS, DOCS } from '../data/modules.ts';
import { escapeString, Order } from '../generator/verse-generator.ts';
import { defineBlock } from '../registry.ts';
import { asStatement, f } from './shared.ts';

export const STRING = 'String';

export function registerTextBlocks(): void {
  defineBlock({
    type: 'verse_print',
    colour: COLORS.text,
    explain: {
      title: 'Print', doc: DOCS.quick, tip: 'Writes text to the UEFN output log (and on screen while testing).',
      text: 'Print lives in /UnrealEngine.com/Temporary/Diagnostics. It takes a string; numbers get wrapped in "{ }" string interpolation automatically.',
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
      g.need('/UnrealEngine.com/Temporary/Diagnostics', 'Print');
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
}
