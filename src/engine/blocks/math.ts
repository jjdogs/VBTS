/**
 * Math blocks: numbers, arithmetic and random numbers.
 */
import Blockly from '../blockly.ts';
import { COLORS, DOCS } from '../data/modules.ts';
import { formatFloat, Order } from '../generator/verse-generator.ts';
import { defineBlock } from '../registry.ts';
import { f } from './shared.ts';

export function registerMathBlocks(): void {
  defineBlock({
    type: 'verse_number',
    colour: COLORS.math,
    explain: {
      title: 'Number', doc: DOCS.quick, tip: 'An int (whole number) or float (decimal).',
      text: 'Verse never mixes int and float automatically. 5 is an int; 5.0 is a float. Pick the type the function expects.',
    },
    init() {
      this.appendDummyInput().appendField(new Blockly.FieldNumber(0), 'NUM')
        .appendField(new Blockly.FieldDropdown([['int', 'int'], ['float', 'float']]), 'TYPE');
      this.setOutput(true, 'Number');
    },
    generate: (b) => [
      f(b, 'TYPE') === 'float' ? formatFloat(b.getFieldValue('NUM')) : String(Math.trunc(Number(b.getFieldValue('NUM')))),
      Order.ATOMIC,
    ],
  });

  defineBlock({
    type: 'verse_arith',
    colour: COLORS.math,
    explain: {
      title: 'Math', doc: DOCS.operators, tip: 'Adds, subtracts, or multiplies two numbers of the same type.',
      text: 'Both sides must be the same type. Dividing ints is special in Verse (it can fail), so this block sticks to + - *.',
    },
    init() {
      this.appendValueInput('A');
      this.appendValueInput('B').appendField(new Blockly.FieldDropdown([['+', '+'], ['-', '-'], ['*', '*']]), 'OP');
      this.setInputsInline(true);
      this.setOutput(true, 'Number');
    },
    generate(b, g) {
      const op = f(b, 'OP');
      const order = op === '*' ? Order.MUL : Order.ADD;
      // Blockly adds parentheses when the inner order is not lower than the outer one. The left side
      // allows its own level (a - b - c needs none); the right side doesn't, so a - (b - c) keeps them.
      return [`${g.valueToCode(b, 'A', order + 1) || '0'} ${op} ${g.valueToCode(b, 'B', order) || '0'}`, order];
    },
  });

  defineBlock({
    type: 'verse_random',
    colour: COLORS.math,
    explain: {
      title: 'Random int', doc: DOCS.api, tip: 'A random whole number between low and high.',
      text: 'GetRandomInt(Low, High) lives in /Verse.org/Random; the generator adds the using line for you.',
    },
    init() {
      this.appendDummyInput().appendField('random int from').appendField(new Blockly.FieldNumber(1, null, null, 1), 'LO')
        .appendField('to').appendField(new Blockly.FieldNumber(10, null, null, 1), 'HI');
      this.setOutput(true, 'Number');
    },
    generate(b, g) {
      g.need('/Verse.org/Random', 'GetRandomInt');
      return [`GetRandomInt(${Math.trunc(Number(b.getFieldValue('LO')))}, ${Math.trunc(Number(b.getFieldValue('HI')))})`, Order.ATOMIC];
    },
  });

  defineBlock({
    type: 'verse_random_range',
    colour: COLORS.math,
    explain: {
      title: 'Random int between values', doc: DOCS.api,
      tip: 'A random whole number between two values you plug in.',
      text: 'Like "random int", but the ends can be any value. GetRandomInt(0, Targets.Length - 1) picks a random position in an array (positions start at 0).',
    },
    init() {
      this.appendValueInput('LO').appendField('random int from');
      this.appendValueInput('HI').appendField('to');
      this.setInputsInline(true);
      this.setOutput(true, 'Number');
    },
    generate(b, g) {
      g.need('/Verse.org/Random', 'GetRandomInt');
      return [`GetRandomInt(${g.valueToCode(b, 'LO', Order.NONE) || '0'}, ${g.valueToCode(b, 'HI', Order.NONE) || '0'})`, Order.ATOMIC];
    },
  });
}
