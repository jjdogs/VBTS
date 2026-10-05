/**
 * Logic blocks: if/else, comparisons, and/or/not, logic values.
 * Verse ifs run on success/failure, which is why comparisons are "Cond" values.
 */
import Blockly from '../blockly.ts';
import type { Block, BlockSvg } from '../blockly.ts';
import { COLORS, DOCS } from '../data/modules.ts';
import { nameField, rerender } from '../fields.ts';
import { Order } from '../generator/verse-generator.ts';
import { defineBlock } from '../registry.ts';
import { asStatement, body, elseCode, f, Slot } from './shared.ts';

/** Output type for anything that can go inside if ( ). */
export const COND = 'Cond';

const PARTS = ['A', 'B', 'C', 'D'];
/** "all of": shows the filled parts plus one empty slot (at least two). */
function showParts(block: Block): void {
  if (!(block as BlockSvg).rendered) return;
  let last = 0;
  PARTS.forEach((p, i) => { if (block.getInputTargetBlock(p)) last = i + 1; });
  let changed = false;
  PARTS.forEach((p, i) => {
    const input = block.getInput(p);
    const show = i < Math.max(2, last + 1);
    if (input && input.isVisible() !== show) { input.setVisible(show); changed = true; }
  });
  if (changed) rerender(block);
}

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
      // Nothing inside: written as if (…) {}, Verse's way to try something that can fail and carry on.
      if (!g.statementToCode(b, 'DO').trim()) {
        g.warn(b, 'Nothing runs when this succeeds. That\'s fine for trying something that can fail, like TeleportTo[…]; otherwise drag blocks into it.', 'tip');
        return `if (${cond || 'true?'}) {}\n`;
      }
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
      return `if (${cond || 'true?'}):\n${body(g, b, 'DO')}${elseCode(g, b, true)}`;
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

  // if (A := X, B := Y): several things that must all succeed, and names for their results.
  defineBlock({
    type: 'verse_all',
    colour: COLORS.logic,
    explain: {
      title: 'All of these', doc: DOCS.failure,
      tip: 'A, B, C inside an if: runs the inside only if every part succeeds, in order.',
      text: 'In Verse, an if can hold several things separated by commas: if (Player := player[Agent], UI := GetPlayerUI[Player]):. Each must succeed, one after another; a name made by one part can be used by the next. If any part fails, the else runs.',
    },
    init() {
      this.appendValueInput('A').appendField('all of');
      this.appendValueInput('B').appendField(',');
      this.appendValueInput('C').appendField(',');
      this.appendValueInput('D').appendField(',');
      this.setInputsInline(true);
      this.setOutput(true, COND);
      showParts(this);
      this.setOnChange(function (this: Block) { if (this.workspace && !this.isDeadOrDying()) showParts(this); });
    },
    generate(b, g) {
      const parts = PARTS.map(p => g.valueToCode(b, p, Order.NONE)).filter(Boolean); // commas bind loosest: no parentheses needed
      if (parts.length < 2) g.warn(b, '"all of" needs at least two parts. Plug in conditions or "name := value" blocks.');
      return [parts.join(', ') || 'true?', Order.ALL];
    },
  });

  defineBlock({
    type: 'verse_bind',
    colour: COLORS.logic,
    explain: {
      title: 'Name := value (in an if)', doc: DOCS.failure,
      tip: 'Inside an if: tries a value that can fail and names its result, like Player := player[Agent].',
      text: 'Name := value inside an if condition tries the value; if it succeeds, the result gets that name for the rest of the condition and the then part. Use it in "all of" to try several things at once.',
    },
    init() {
      this.appendValueInput('VALUE').appendField(nameField('Player'), 'VAR').appendField(':=');
      this.setInputsInline(true);
      this.setOutput(true, COND);
    },
    generate(b, g) {
      const value = g.valueToCode(b, 'VALUE', Order.NONE);
      if (!value) g.warn(b, `Plug in the value to name ${f(b, 'VAR')}.`);
      return [`${f(b, 'VAR')} := ${value || 'false?'}`, Order.ALL];
    },
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
