/**
 * Logic blocks: if/else, comparisons, and/or/not, logic values.
 * Verse ifs run on success/failure, which is why comparisons are "Cond" values.
 */
import Blockly from '../blockly.ts';
import { COLORS, DOCS } from '../data/modules.ts';
import { nameField } from '../fields.ts';
import { Order } from '../generator/verse-generator.ts';
import { defineBlock } from '../registry.ts';
import { asStatement, body, f, Slot } from './shared.ts';

/** Output type for anything that can go inside if ( ). */
export const COND = 'Cond';

export function registerLogicBlocks(): void {
  defineBlock({
    type: 'verse_if',
    colour: COLORS.logic,
    explain: {
      title: 'If', doc: DOCS.control,
      tip: 'Runs the inside only if the condition succeeds.',
      text: 'Verse ifs work on success/failure, not just true/false. A comparison like Score >= 3 succeeds or fails. A logic variable needs ? to test it (IsReady?).',
    },
    init() {
      this.appendValueInput('COND').appendField('if');
      this.appendStatementInput('DO').setCheck(Slot.STATEMENT).appendField('then');
      asStatement(this);
    },
    generate(b, g) {
      const cond = g.valueToCode(b, 'COND', Order.NONE);
      if (!cond) g.warn(b, 'if needs a condition.');
      return `if (${cond || 'true?'}):\n${body(g, b, 'DO')}`;
    },
  });

  defineBlock({
    type: 'verse_if_else',
    colour: COLORS.logic,
    explain: { title: 'If / else', doc: DOCS.control, tip: 'Runs one branch or the other.', text: 'The else branch runs when the condition fails.' },
    init() {
      this.appendValueInput('COND').appendField('if');
      this.appendStatementInput('DO').setCheck(Slot.STATEMENT).appendField('then');
      this.appendStatementInput('ELSE').setCheck(Slot.STATEMENT).appendField('else');
      asStatement(this);
    },
    generate(b, g) {
      const cond = g.valueToCode(b, 'COND', Order.NONE);
      if (!cond) g.warn(b, 'if needs a condition.');
      return `if (${cond || 'true?'}):\n${body(g, b, 'DO')}else:\n${body(g, b, 'ELSE')}`;
    },
  });

  defineBlock({
    type: 'verse_compare',
    colour: COLORS.logic,
    explain: {
      title: 'Compare', doc: DOCS.operators,
      tip: 'Compares two values. Verse uses = for equals and <> for not equal.',
      text: 'Comparisons are failable expressions: they succeed or fail. = means equal (not ==), <> means not equal.',
    },
    init() {
      this.appendValueInput('A');
      this.appendValueInput('B')
        .appendField(new Blockly.FieldDropdown(['=', '<>', '<', '<=', '>', '>='].map(o => [o, o])), 'OP');
      this.setInputsInline(true);
      this.setOutput(true, COND);
    },
    generate(b, g) {
      const a = g.valueToCode(b, 'A', Order.CMP) || '0';
      const c = g.valueToCode(b, 'B', Order.CMP) || '0';
      return [`${a} ${f(b, 'OP')} ${c}`, Order.CMP];
    },
  });

  defineBlock({
    type: 'verse_logic_op',
    colour: COLORS.logic,
    explain: { title: 'And / or', doc: DOCS.operators, tip: 'Combines two conditions.', text: 'and succeeds only if both sides succeed; or succeeds if either does.' },
    init() {
      this.appendValueInput('A').setCheck(COND);
      this.appendValueInput('B').setCheck(COND).appendField(new Blockly.FieldDropdown([['and', 'and'], ['or', 'or']]), 'OP');
      this.setInputsInline(true);
      this.setOutput(true, COND);
    },
    generate(b, g) {
      const op = f(b, 'OP');
      const order = op === 'and' ? Order.AND : Order.OR;
      return [`${g.valueToCode(b, 'A', order) || 'true?'} ${op} ${g.valueToCode(b, 'B', order) || 'true?'}`, order];
    },
  });

  defineBlock({
    type: 'verse_not',
    colour: COLORS.logic,
    explain: { title: 'Not', doc: DOCS.operators, tip: 'Succeeds when the condition fails.', text: 'not flips success and failure.' },
    init() {
      this.appendValueInput('A').setCheck(COND).appendField('not');
      this.setOutput(true, COND);
    },
    // not binds tightly (see Order), so anything but a simple value gets parentheses: not (A = B).
    generate: (b, g) => [`not ${g.valueToCode(b, 'A', Order.NOT) || 'true?'}`, Order.NOT],
  });

  defineBlock({
    type: 'verse_is_true',
    colour: COLORS.logic,
    explain: {
      title: 'Logic is true', doc: DOCS.failure, tip: 'Tests a logic variable with ?.',
      text: 'A logic value is not a condition by itself. Writing IsReady? turns it into one: it succeeds when true and fails when false.',
    },
    init() {
      this.appendDummyInput().appendField(nameField('IsReady'), 'NAME').appendField('? is true');
      this.setOutput(true, COND);
    },
    generate: (b) => [`${f(b, 'NAME')}?`, Order.ATOMIC],
  });

  defineBlock({
    type: 'verse_bool',
    colour: COLORS.logic,
    explain: { title: 'true / false', doc: DOCS.quick, tip: 'A logic value. Use with set on a logic variable.', text: 'In Verse, true and false are values of type logic.' },
    init() {
      this.appendDummyInput().appendField(new Blockly.FieldDropdown([['true', 'true'], ['false', 'false']]), 'V');
      this.setOutput(true, 'Logic');
    },
    generate: (b) => [f(b, 'V'), Order.ATOMIC],
  });
}
