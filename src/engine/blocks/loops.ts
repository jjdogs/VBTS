/**
 * Loop blocks: loop forever, break, and counting with a range.
 */
import Blockly from '../blockly.ts';
import { COLORS, DOCS } from '../data/modules.ts';
import { nameField } from '../fields.ts';
import { defineBlock } from '../registry.ts';
import { asStatement, body, f, Slot } from './shared.ts';

export function registerLoopBlocks(): void {
  defineBlock({
    type: 'verse_loop',
    colour: COLORS.loops,
    explain: {
      title: 'Loop forever', doc: DOCS.control,
      tip: 'Repeats forever until break. Put a wait inside!',
      text: 'loop: repeats until break. A loop with no Sleep in a suspending context will freeze the game, so almost always add a wait.',
    },
    init() {
      this.appendDummyInput().appendField('loop forever');
      this.appendStatementInput('DO').setCheck(Slot.STATEMENT);
      asStatement(this);
    },
    generate(b, g) {
      const code = body(g, b, 'DO');
      if (!/Sleep\(|break/.test(code)) g.warn(b, 'This loop never waits or breaks — it would freeze the game. Add a wait block.');
      return `loop:\n${code}`;
    },
  });

  defineBlock({
    type: 'verse_break',
    colour: COLORS.loops,
    explain: { title: 'Break', doc: DOCS.control, tip: 'Leaves the loop.', text: 'break exits the nearest loop.' },
    init() {
      this.appendDummyInput().appendField('break out of loop');
      this.setPreviousStatement(true, Slot.STATEMENT); // nothing can come after break
    },
    generate: () => 'break\n',
  });

  defineBlock({
    type: 'verse_for_range',
    colour: COLORS.loops,
    explain: {
      title: 'Count with', doc: DOCS.control,
      tip: 'Runs the inside once for each number in a range.',
      text: 'for (I := 1..5) runs with I = 1, 2, 3, 4, 5. The range includes both ends.',
    },
    init() {
      this.appendDummyInput().appendField('for').appendField(nameField('I'), 'VAR').appendField(':=')
        .appendField(new Blockly.FieldNumber(1, null, null, 1), 'FROM').appendField('..')
        .appendField(new Blockly.FieldNumber(5, null, null, 1), 'TO');
      this.appendStatementInput('DO').setCheck(Slot.STATEMENT);
      asStatement(this);
    },
    generate: (b, g) =>
      `for (${f(b, 'VAR')} := ${Math.trunc(Number(b.getFieldValue('FROM')))}..${Math.trunc(Number(b.getFieldValue('TO')))}):\n${body(g, b, 'DO')}`,
  });
}
