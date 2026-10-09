/**
 * Time blocks: waiting (Sleep), spawning background work, race / sync.
 */
import Blockly from '../blockly.ts';
import { COLORS, DOCS } from '../data/modules.ts';
import { looseDropdown, prime, type Option } from '../fields.ts';
import { formatFloat } from '../generator/verse-generator.ts';
import { defineBlock } from '../registry.ts';
import { functionsIn, inSuspends, liveWorkspace, rawDeclared } from '../workspace.ts';
import { asStatement, body, f, Slot } from './shared.ts';

export function registerTimeBlocks(): void {
  defineBlock({
    type: 'verse_sleep',
    colour: COLORS.time,
    explain: {
      title: 'Sleep (wait)', doc: DOCS.time, tip: 'Pauses for some seconds. Only works in <suspends> code like OnBegin.',
      text: 'Sleep takes a float number of seconds, so 2 becomes 2.0. It can only run in a <suspends> context: OnBegin, or a function with <suspends> ticked. Event handlers are not suspending; start a suspending function from them with spawn{}.',
    },
    init() {
      this.appendDummyInput().appendField('wait').appendField(new Blockly.FieldNumber(1, 0), 'SECS').appendField('seconds');
      asStatement(this);
    },
    generate(b, g) {
      if (!inSuspends(b)) g.warn(b, 'Sleep only works in <suspends> code (OnBegin or a <suspends> function). From a handler, put it in a function and use spawn.');
      g.need('/Verse.org/Simulation', 'Sleep');
      return `Sleep(${formatFloat(b.getFieldValue('SECS'))})\n`;
    },
  });

  defineBlock({
    type: 'verse_spawn',
    colour: COLORS.time,
    explain: {
      title: 'Spawn', doc: DOCS.time, tip: 'Starts a <suspends> function in the background and keeps going.',
      text: 'spawn{ } starts a suspending function without waiting for it. It is the usual way to run timed code (Sleep, loops) from an event handler.',
    },
    init() {
      this.appendDummyInput().appendField('spawn in background').appendField(looseDropdown(function () {
        const fns = functionsIn(liveWorkspace(this.getSourceBlock())).filter(fn => fn.suspends);
        return fns.length ? fns.map(fn => [fn.name + '()', fn.name] as Option) : [['DoSomething()', 'DoSomething']];
      }), 'NAME');
      asStatement(this);
      prime(this, ['NAME']);
    },
    generate(b, g) {
      const name = f(b, 'NAME');
      const fn = functionsIn(b.workspace).find(x => x.name === name);
      if (!fn) { if (!rawDeclared(b.workspace, name)?.isFunction) g.warn(b, `No function named ${name}.`); }
      else if (!fn.suspends) g.warn(b, `spawn needs a <suspends> function; tick <suspends> on ${name}.`);
      return `spawn{${name}()}\n`;
    },
  });

  defineBlock({
    type: 'verse_race',
    colour: COLORS.time,
    explain: {
      title: 'Race / sync', doc: DOCS.time, tip: 'race: run both, stop when the first finishes. sync: wait for both.',
      text: 'race runs its branches at the same time and cancels the losers when one finishes. sync waits for every branch. Both need a <suspends> context.',
    },
    init() {
      this.appendDummyInput().appendField(new Blockly.FieldDropdown([['race', 'race'], ['sync', 'sync']]), 'KIND');
      this.appendStatementInput('A').setCheck(Slot.STATEMENT).appendField('branch 1');
      this.appendStatementInput('B').setCheck(Slot.STATEMENT).appendField('branch 2');
      asStatement(this);
    },
    generate(b, g) {
      const kind = f(b, 'KIND');
      if (!inSuspends(b)) g.warn(b, `${kind} needs a <suspends> context.`);
      const branch = (input: string) => `block:\n${body(g, b, input)}`;
      return `${kind}:\n${g.prefixLines(branch('A') + branch('B'), g.INDENT)}`;
    },
  });
}
