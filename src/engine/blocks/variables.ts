/**
 * Variable blocks: declaring fields (var / constant), reading and setting them.
 */
import Blockly from '../blockly.ts';
import { COLORS, DOCS } from '../data/modules.ts';
import { moduleForType, typeNamesIn } from '../data/verse-types.ts';
import { nameField } from '../fields.ts';
import { escapeString, formatFloat, Order } from '../generator/verse-generator.ts';
import { defineBlock } from '../registry.ts';
import { fieldsIn } from '../workspace.ts';
import { asStatement, f, Slot, stacksIn } from './shared.ts';

/** Turns what the user typed into a valid Verse literal of the chosen type. */
function literal(type: string, typed: string): string {
  if (type === 'int') return String(parseInt(typed, 10) || 0);
  if (type === 'float') return formatFloat(typed);
  if (type === 'logic') return /^(true|1|yes)$/i.test(typed.trim()) ? 'true' : 'false';
  return `"${escapeString(typed)}"`;
}

export function registerVariableBlocks(): void {
  defineBlock({
    type: 'verse_field',
    colour: COLORS.vars,
    explain: {
      title: 'Variable or constant', doc: DOCS.quick, tip: 'Stores a value on the device. "var" can change later with set.',
      text: 'Verse values are constant by default. Add var to make one you can change with set. Verse is strict about types: 1 is an int, 1.0 is a float, logic is true/false.',
    },
    init() {
      this.appendDummyInput()
        .appendField(new Blockly.FieldDropdown([['var', 'var'], ['constant', 'const']]), 'KIND')
        .appendField(nameField('Score'), 'NAME').appendField(':')
        .appendField(new Blockly.FieldDropdown(['int', 'float', 'logic', 'string'].map(t => [t, t])), 'TYPE')
        .appendField('=').appendField(new Blockly.FieldTextInput('0'), 'VALUE');
      stacksIn(this, [Slot.MEMBER, Slot.FUNCTION]);
    },
    generate: (b) =>
      `${f(b, 'KIND') === 'var' ? 'var ' : ''}${f(b, 'NAME')}:${f(b, 'TYPE')} = ${literal(f(b, 'TYPE'), f(b, 'VALUE'))}\n`,
  });

  defineBlock({
    type: 'verse_get',
    colour: COLORS.vars,
    explain: {
      title: 'Get a value', doc: DOCS.quick, tip: 'Reads a variable, constant, or loop counter by name.',
      text: 'Use the exact name, including capital letters. Verse style uses PascalCase for variables.',
    },
    init() {
      this.appendDummyInput().appendField(nameField('Score'), 'NAME');
      this.setOutput(true, null);
    },
    generate: (b) => [f(b, 'NAME'), Order.ATOMIC],
  });

  defineBlock({
    type: 'verse_set',
    colour: COLORS.vars,
    explain: {
      title: 'Set a variable', doc: DOCS.quick, tip: 'Changes a var. Constants cannot be set.',
      text: 'Changing a var needs the set keyword: set Score += 1. Only fields declared with var can change.',
    },
    init() {
      this.appendValueInput('V').appendField('set').appendField(nameField('Score'), 'NAME')
        .appendField(new Blockly.FieldDropdown([['=', '='], ['+=', '+='], ['-=', '-=']]), 'OP');
      asStatement(this);
    },
    generate(b, g) {
      const name = f(b, 'NAME');
      const declared = fieldsIn(b.workspace).find(x => x.name === name);
      if (!declared) g.warn(b, `No variable named ${name}. Add a "var" block under linked devices & variables.`);
      else if (!declared.mutable) g.warn(b, `${name} is a constant. Change it to var so it can be set.`);
      return `set ${name} ${f(b, 'OP')} ${g.valueToCode(b, 'V', Order.NONE) || '0'}\n`;
    },
  });

  // Phase 5.0: a value that only exists inside a function, from its line to the end of its block.
  defineBlock({
    type: 'verse_local',
    colour: COLORS.vars,
    explain: {
      title: 'Local value', doc: DOCS.quick,
      tip: 'Names a value inside a function: Position := Char.GetTransform().Translation.',
      text: 'Name := value makes a constant that only exists inside this function, from this line on. Its type comes from the value. Tick var to make one you can change with set; a var needs its type written out: var Count:int = 0. You can also write the type of a constant: Speed:float = 2.0.',
    },
    init() {
      this.appendValueInput('VALUE')
        .appendField(new Blockly.FieldDropdown([['constant', 'const'], ['var', 'var']]), 'KIND')
        .appendField(nameField('Position'), 'NAME').appendField(':')
        .appendField(new Blockly.FieldTextInput('', (s: string) => (s === '' || /^\??(\[\w*\])*[A-Za-z_]\w*$/.test(s) ? s : null)), 'TYPE')
        .appendField('=');
      this.setInputsInline(true);
      asStatement(this);
    },
    generate(b, g) {
      const name = f(b, 'NAME'), type = f(b, 'TYPE').trim(), isVar = f(b, 'KIND') === 'var';
      for (const t of typeNamesIn(type)) { const m = moduleForType(t); if (m) g.need(m, t); }
      const value = g.valueToCode(b, 'VALUE', Order.NONE);
      if (!value) g.warn(b, `Plug in the value ${name} starts with.`);
      if (isVar && !type) g.warn(b, `A var needs its type written out, like var ${name}:int = 0. Type it in the box after ${name}.`);
      if (!isVar && !type) return `${name} := ${value || '0'}\n`;
      return `${isVar ? 'var ' : ''}${name}:${type || 'int'} = ${value || '0'}\n`;
    },
  });
}
