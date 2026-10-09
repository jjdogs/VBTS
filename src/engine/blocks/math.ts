/**
 * Math blocks: numbers, arithmetic and random numbers.
 */
import Blockly from '../blockly.ts';
import type { Block } from '../blockly.ts';
import { COLORS, DOCS } from '../data/modules.ts';
import { formatFloat, Order } from '../generator/verse-generator.ts';
import { defineBlock } from '../registry.ts';
import { fieldsIn, inFailureContext } from '../workspace.ts';
import { floatInput } from './movement.ts';
import { f } from './shared.ts';

/** True when a value is surely an int: an int number, an int variable, or math on ints. */
function isInt(block: Block | null): boolean {
  if (!block) return false;
  if (block.type === 'verse_number') return f(block, 'TYPE') === 'int';
  if (block.type === 'verse_get') return fieldsIn(block.workspace).find(x => x.name === f(block, 'NAME'))?.type === 'int';
  if (block.type === 'verse_arith') return f(block, 'OP') !== '/' && isInt(block.getInputTargetBlock('A')) && isInt(block.getInputTargetBlock('B'));
  return false;
}

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
      title: 'Math', doc: DOCS.operators, tip: 'Adds, subtracts, multiplies or divides two numbers of the same type.',
      text: 'Both sides must be the same type. Dividing floats (10.0 / 4.0) always works. Dividing ints is special in Verse: it fails when dividing by 0, so it only works inside an if.',
    },
    init() {
      this.appendValueInput('A');
      this.appendValueInput('B').appendField(new Blockly.FieldDropdown([['+', '+'], ['-', '-'], ['*', '*'], ['/', '/']]), 'OP');
      this.setInputsInline(true);
      this.setOutput(true, 'Number');
    },
    generate(b, g) {
      const op = f(b, 'OP');
      const order = op === '*' || op === '/' ? Order.MUL : Order.ADD;
      if (op === '/' && isInt(b.getInputTargetBlock('A')) && isInt(b.getInputTargetBlock('B')) && !inFailureContext(b)) {
        g.warn(b, 'Dividing ints can fail in Verse (dividing by 0), so it only works inside an if. For decimals, use floats like 10.0 / 4.0.');
      }
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

  defineBlock({
    type: 'verse_random_float',
    colour: COLORS.math,
    explain: {
      title: 'Random decimal', doc: DOCS.api,
      tip: 'GetRandomFloat(Low, High): a random float between two values.',
      text: 'GetRandomFloat gives a random decimal number (a float) between Low and High, such as a random wait: Sleep(GetRandomFloat(1.0, 3.0)). Both ends are floats, so write 1.0, not 1. Lives in /Verse.org/Random; the generator adds the using line.',
    },
    init() {
      this.appendValueInput('LO').appendField('random decimal from');
      this.appendValueInput('HI').appendField('to');
      this.setInputsInline(true);
      this.setOutput(true, 'Number');
    },
    generate(b, g) {
      g.need('/Verse.org/Random', 'GetRandomFloat');
      return [`GetRandomFloat(${floatInput(g, b, 'LO', 'Low')}, ${floatInput(g, b, 'HI', 'High')})`, Order.ATOMIC];
    },
  });

  defineBlock({
    type: 'verse_shuffle',
    colour: COLORS.data,
    explain: {
      title: 'Shuffle', doc: DOCS.api,
      tip: 'Shuffle(Array): the same items in a random order.',
      text: 'Shuffle gives a new array with the same items in a random order; the original is unchanged. Loop over it to visit things in a random order, or store it: set Order = Shuffle(Targets). Lives in /Verse.org/Random.',
    },
    init() {
      this.appendValueInput('LIST').appendField('shuffled');
      this.setInputsInline(true);
      this.setOutput(true);
    },
    generate(b, g) {
      g.need('/Verse.org/Random', 'Shuffle');
      const list = g.valueToCode(b, 'LIST', Order.NONE);
      if (!list) g.warn(b, 'Plug in the array to shuffle.');
      return [`Shuffle(${list || 'array{}'})`, Order.ATOMIC];
    },
  });
}
