/**
 * The general chain block: any value followed by .Name, .Name(…) or .Name[…], so Verse such as
 * Char.GetTransform().Rotation.ApplyYaw(1.0) or Agent.GetFortCharacter[] becomes blocks instead of
 * raw Verse. More specific blocks (teams, transforms, widgets…) are used when they fit; this is
 * the fallback. "do" runs a call chain as a line of its own.
 */
import Blockly from '../blockly.ts';
import type { Block, BlockSvg, Field } from '../blockly.ts';
import { COLORS, DOCS } from '../data/modules.ts';
import { nameField, rerender } from '../fields.ts';
import { Order } from '../generator/verse-generator.ts';
import { defineBlock } from '../registry.ts';
import { checkFailable } from './data.ts';
import { asStatement, f } from './shared.ts';

const ARGS = ['A1', 'A2', 'A3'];
const BRACKETS: Record<string, [string, string]> = { field: ['', ''], call: ['(', ')'], try: ['[', ']'] };

/** Brackets for the chosen kind, and one input slot per filled argument plus one (none for a field). */
function updateChain(block: Block, kind: string): void {
  if (!(block as BlockSvg).rendered) return;
  const [open, close] = BRACKETS[kind] ?? BRACKETS.field;
  let changed = false;
  for (const [name, text] of [['OPEN', open], ['CLOSE', close]] as const) {
    const label = block.getField(name);
    if (label && label.getValue() !== text) { label.setValue(text); changed = true; }
  }
  let last = 0;
  ARGS.forEach((a, i) => { if (block.getInputTargetBlock(a)) last = i + 1; });
  ARGS.forEach((a, i) => {
    const input = block.getInput(a);
    const show = (kind !== 'field' && i <= last) || i < last;
    if (input && input.isVisible() !== show) { input.setVisible(show); changed = true; }
  });
  if (changed) rerender(block);
}

export function registerChainBlocks(): void {
  defineBlock({
    type: 'verse_chain',
    colour: COLORS.funcs,
    explain: {
      title: 'Part of a value (chain)', doc: DOCS.quick,
      tip: 'Value.Name, Value.Name(…) or Value.Name[…]: a field, a call, or a call that can fail.',
      text: 'Verse reaches into values with a dot: Char.GetTransform() calls a function on Char, .Rotation reads a field, and .GetFortCharacter[] calls one that can fail (square brackets, so it goes in an if). Chains build up: Char.GetTransform().Rotation. Use this when there is no more specific block for it.',
    },
    init() {
      this.appendValueInput('OBJ');
      this.appendDummyInput('HEAD').appendField('.').appendField(nameField('Name'), 'MEMBER')
        .appendField(new Blockly.FieldDropdown([['field', 'field'], ['( ) call', 'call'], ['[ ] can fail', 'try']], function (this: Field, v: string) {
          const b = this.getSourceBlock();
          if (b) updateChain(b, v);
          return v;
        }), 'KIND')
        .appendField(new Blockly.FieldLabel(''), 'OPEN');
      ARGS.forEach((a, i) => this.appendValueInput(a).appendField(i ? ',' : ''));
      this.appendDummyInput('TAIL').appendField(new Blockly.FieldLabel(''), 'CLOSE');
      this.setInputsInline(true);
      this.setOutput(true, null);
      updateChain(this, f(this, 'KIND'));
      this.setOnChange(function (this: Block) { if (this.workspace && !this.isDeadOrDying()) updateChain(this, f(this, 'KIND')); });
    },
    generate(b, g) {
      const obj = g.valueToCode(b, 'OBJ', Order.ATOMIC);
      if (!obj) g.warn(b, `Plug in the value to take .${f(b, 'MEMBER')} from.`);
      const kind = f(b, 'KIND');
      if (kind === 'try') checkFailable(g, b, `${f(b, 'MEMBER')}[…]`);
      const args = ARGS.map(a => g.valueToCode(b, a, Order.NONE)).filter(Boolean).join(', ');
      const [open, close] = BRACKETS[kind] ?? BRACKETS.field;
      return [`${obj || 'Value'}.${f(b, 'MEMBER')}${open}${kind === 'field' ? '' : args}${close}`, Order.ATOMIC];
    },
  });

  defineBlock({
    type: 'verse_do',
    colour: COLORS.funcs,
    explain: {
      title: 'Do (run a call)', doc: DOCS.functions,
      tip: 'Runs a call as a line of its own, like Prop.GetTransform().Rotation… or Button.Show().',
      text: 'A line that is just a call runs it and ignores its result. Plug in a chain that ends with a ( ) call.',
    },
    init() {
      this.appendValueInput('VALUE').appendField('do');
      asStatement(this);
    },
    generate(b, g) {
      const value = g.valueToCode(b, 'VALUE', Order.NONE);
      if (!value) g.warn(b, 'Plug in the call to run.');
      return `${value || '# (nothing to do)'}\n`;
    },
  });
}
