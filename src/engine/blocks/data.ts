/**
 * Lists & Maps blocks: arrays, maps and options, plus using them — looping, adding,
 * setting entries, and "if it exists" for anything that can fail.
 *
 * Verse rules these blocks teach:
 *  - Reading an array/map entry can FAIL (the index or key may not exist), so it must be
 *    inside an if (or "if it exists"). Same for an option's value (Name?).
 *  - Setting a map or array entry can fail too, so it is written as if (set X[K] = V).
 */
import Blockly from '../blockly.ts';
import type { Block } from '../blockly.ts';
import { DEVICE_TYPES } from '../catalog.ts';
import { COLORS, DOCS } from '../data/modules.ts';
import { KEY_TYPES, hasLiteral, literal, moduleForType, splitList, typeNamesIn, VALUE_TYPES } from '../data/verse-types.ts';
import { nameField } from '../fields.ts';
import { Order, type VerseGenerator } from '../generator/verse-generator.ts';
import { defineBlock } from '../registry.ts';
import { deviceArraysIn, fieldsIn, inFailureContext } from '../workspace.ts';
import { COND } from './logic.ts';
import { asStatement, body, checkAgent, elseCode, f, Slot, stacksIn } from './shared.ts';

/** Output type for values that can fail (index, option value, <decides> call). */
export const FAILABLE = 'Failable';
const kindDropdown = () => new Blockly.FieldDropdown([['var', 'var'], ['constant', 'const']]);
const typeDropdown = (types: readonly string[]) => new Blockly.FieldDropdown(types.map(t => [t, t]));

const needType = (g: VerseGenerator, type: string) => { for (const t of typeNamesIn(type)) { const m = moduleForType(t); if (m) g.need(m, t); } };

/** Warns when a value that can fail is used somewhere failure isn't allowed. */
export function checkFailable(g: VerseGenerator, b: Block, what: string): void {
  if (b.getParent() && !inFailureContext(b)) {
    g.warn(b, `${what} can fail, so it has to be inside an if or "if it exists" (or a check line in a <decides> function).`);
  }
}

/** Warns when a name isn't a declared container of the expected kind. */
function checkContainer(g: VerseGenerator, b: Block, name: string, kinds: string[], mustBeVar: boolean): void {
  // @editable device arrays count as (constant) arrays too.
  const all = [...fieldsIn(b.workspace), ...deviceArraysIn(b.workspace).map(d => ({ name: d.name, kind: 'array' as const, mutable: false }))];
  const found = all.find(x => x.name === name && kinds.includes(x.kind));
  const label = kinds.join(' or ');
  if (!found) g.warn(b, `No ${label} named ${name}. Declare one under linked devices & variables.`);
  else if (mustBeVar && !found.mutable) g.warn(b, `${name} is a constant. Change it to var so it can change.`);
}

export function registerDataBlocks(): void {
  // ---------------- declarations ----------------
  defineBlock({
    type: 'verse_array_field',
    colour: COLORS.data,
    explain: {
      title: 'Array (a list)', doc: DOCS.quick,
      tip: 'A list of values of one type, like []int. Starts with the values you type, or empty.',
      text: 'An array holds many values in order: []int is "a list of ints". array{1, 2, 3} makes one. Arrays start counting at 0, and reading Scores[5] can fail if there is no item 5, so reading goes inside "if it exists". Add to a var array with set Scores += array{4}.',
    },
    init() {
      this.appendDummyInput().appendField(kindDropdown(), 'KIND').appendField(nameField('Scores'), 'NAME')
        .appendField(': []').appendField(typeDropdown(VALUE_TYPES), 'ELEM')
        .appendField('= array{').appendField(new Blockly.FieldTextInput(''), 'VALUES').appendField('}');
      stacksIn(this, [Slot.MEMBER, Slot.FUNCTION]);
    },
    generate(b, g) {
      const elem = f(b, 'ELEM');
      needType(g, elem);
      const items = splitList(f(b, 'VALUES'));
      if (items.length && !hasLiteral(elem)) g.warn(b, `An array of ${elem} starts empty; ${elem}s come from the game, so they can't be typed in.`);
      const values = hasLiteral(elem) ? items.map(v => literal(elem, v.replace(/^"(.*)"$/, '$1'))).join(', ') : '';
      return `${f(b, 'KIND') === 'var' ? 'var ' : ''}${f(b, 'NAME')}:[]${elem} = array{${values}}\n`;
    },
  });

  defineBlock({
    type: 'verse_editable_array',
    colour: COLORS.devices,
    explain: {
      title: '@editable device array', doc: DOCS.specifiers,
      tip: 'One slot that holds many placed devices, like all your targets.',
      text: 'Instead of Target1, Target2, Target3, one @editable array holds them all. In UEFN, select your Verse device and use the + button in the Details panel to add each placed device. Then loop over them with "for each".',
    },
    init() {
      this.appendDummyInput().appendField('@editable').appendField(nameField('Targets'), 'NAME').appendField(': []')
        .appendField(new Blockly.FieldDropdown(DEVICE_TYPES.map(t => [t, t])), 'DTYPE').appendField('= array{}');
      stacksIn(this, [Slot.MEMBER, Slot.FUNCTION]);
    },
    generate(b, g) {
      const type = f(b, 'DTYPE');
      g.need('/Verse.org/Simulation', '@editable');
      g.need('/Fortnite.com/Devices', type);
      return `@editable\n${f(b, 'NAME')}:[]${type} = array{}\n`;
    },
  });

  defineBlock({
    type: 'verse_map_field',
    colour: COLORS.data,
    explain: {
      title: 'Map (look-up table)', doc: DOCS.quick,
      tip: 'Pairs keys with values, like each player → their score.',
      text: 'A map links keys to values: [agent]int gives every player a number, perfect for per-player scores. Reading Scores[Agent] can fail (that player may have no score yet), and so can setting it, so both go in failure contexts.',
    },
    init() {
      this.appendDummyInput().appendField(kindDropdown(), 'KIND').appendField(nameField('PlayerScores'), 'NAME')
        .appendField(': [').appendField(typeDropdown(KEY_TYPES), 'KEY').appendField(']')
        .appendField(typeDropdown(VALUE_TYPES), 'VAL').appendField('= map{}'); // starts empty, so any value type works
      stacksIn(this, [Slot.MEMBER, Slot.FUNCTION]);
    },
    generate(b, g) {
      needType(g, f(b, 'KEY'));
      needType(g, f(b, 'VAL'));
      return `${f(b, 'KIND') === 'var' ? 'var ' : ''}${f(b, 'NAME')}:[${f(b, 'KEY')}]${f(b, 'VAL')} = map{}\n`;
    },
  });

  defineBlock({
    type: 'verse_option_field',
    colour: COLORS.data,
    explain: {
      title: 'Option (maybe a value)', doc: DOCS.failure,
      tip: 'Holds one value or nothing, like "maybe a winner". Starts empty (false).',
      text: 'An option is written ?type: ?agent is "maybe an agent". false means empty; option{X} puts a value in. Getting the value out (Winner?) can fail when it is empty, so it goes inside "if it exists".',
    },
    init() {
      this.appendDummyInput().appendField('var').appendField(nameField('Winner'), 'NAME')
        .appendField(': ?').appendField(typeDropdown(VALUE_TYPES), 'TYPE').appendField('= false (empty)');
      stacksIn(this, [Slot.MEMBER, Slot.FUNCTION]);
    },
    generate(b, g) {
      needType(g, f(b, 'TYPE'));
      return `var ${f(b, 'NAME')}:?${f(b, 'TYPE')} = false\n`;
    },
  });

  // ---------------- statements ----------------
  defineBlock({
    type: 'verse_for_each',
    colour: COLORS.loops,
    explain: {
      title: 'For each item', doc: DOCS.control,
      tip: 'Runs the inside once for every item in an array or map.',
      text: 'for (Item : Scores) runs once per item. Tick "with position/key" to also get the index (arrays, starting at 0) or the key (maps): for (Index -> Item : Scores). Looping over an @editable device array lets you use each device inside, like T.PopUp().',
    },
    init() {
      this.appendValueInput('COLLECTION').appendField('for each').appendField(nameField('Item'), 'VAR').appendField('in');
      this.appendDummyInput().appendField('with position/key').appendField(new Blockly.FieldCheckbox('FALSE'), 'KEYED')
        .appendField(nameField('Key'), 'KEY');
      this.appendStatementInput('DO').setCheck(Slot.STATEMENT);
      this.setInputsInline(false);
      asStatement(this);
    },
    generate(b, g) {
      const collection = g.valueToCode(b, 'COLLECTION', Order.NONE);
      if (!collection) g.warn(b, 'for each needs an array or map to loop over. Plug in a "get" block with its name.');
      const head = f(b, 'KEYED') === 'TRUE' ? `${f(b, 'KEY')} -> ${f(b, 'VAR')}` : f(b, 'VAR');
      return `for (${head} : ${collection || 'Items'}):\n${body(g, b, 'DO')}`;
    },
  });

  defineBlock({
    type: 'verse_array_add',
    colour: COLORS.data,
    explain: {
      title: 'Add to array', doc: DOCS.quick,
      tip: 'Adds an item to the end of a var array.',
      text: 'set Scores += array{5} makes a new array with 5 on the end and stores it back in Scores. The array must be declared with var.',
    },
    init() {
      this.appendValueInput('VALUE').appendField('add to').appendField(nameField('Scores'), 'NAME').appendField(':');
      this.setInputsInline(true);
      asStatement(this);
    },
    generate(b, g) {
      const name = f(b, 'NAME');
      checkContainer(g, b, name, ['array'], true);
      const value = g.valueToCode(b, 'VALUE', Order.NONE);
      if (!value) g.warn(b, 'Plug in the value to add.');
      return `set ${name} += array{${value || '0'}}\n`;
    },
  });

  defineBlock({
    type: 'verse_set_index',
    colour: COLORS.data,
    explain: {
      title: 'Set an entry', doc: DOCS.failure,
      tip: 'Sets Name[key] in a var map or array. Can fail, so it is written as if (set …).',
      text: 'For a map, this adds the key or updates it: if (set PlayerScores[Agent] = 10). For an array, the position must already exist. Because it can fail, Verse writes it as an if; put blocks inside to run only when it worked, or leave it empty.',
    },
    init() {
      this.appendValueInput('KEY').appendField('set').appendField(nameField('PlayerScores'), 'NAME').appendField('[');
      this.appendValueInput('VALUE').appendField('] =');
      this.appendStatementInput('DO').setCheck(Slot.STATEMENT).appendField('if it worked');
      this.setInputsInline(true);
      asStatement(this);
    },
    generate(b, g) {
      const name = f(b, 'NAME');
      checkContainer(g, b, name, ['map', 'array'], true);
      const key = g.valueToCode(b, 'KEY', Order.NONE) || '0';
      const value = g.valueToCode(b, 'VALUE', Order.NONE) || '0';
      const inner = g.statementToCode(b, 'DO');
      return inner.trim() ? `if (set ${name}[${key}] = ${value}):\n${inner}` : `if (set ${name}[${key}] = ${value}) {}\n`;
    },
  });

  defineBlock({
    type: 'verse_if_bind',
    colour: COLORS.logic,
    explain: {
      title: 'If it exists', doc: DOCS.failure,
      tip: 'Tries something that can fail. If it works, the result gets a name you can use inside.',
      text: 'if (Score := PlayerScores[Agent]) tries to read the map. If the player has a score, it is named Score inside; if not, the else part runs. Use it for array items, map entries, option values (Winner?) and <decides> functions.',
    },
    init() {
      this.appendValueInput('VALUE').appendField('if').appendField(nameField('Value'), 'VAR').appendField(':=');
      this.appendStatementInput('DO').setCheck(Slot.STATEMENT).appendField('then');
      this.appendStatementInput('ELSE').setCheck(Slot.STATEMENT).appendField('else');
      this.setInputsInline(true);
      asStatement(this);
    },
    generate(b, g) {
      const value = g.valueToCode(b, 'VALUE', Order.NONE);
      if (!value) g.warn(b, '"if it exists" needs something that can fail, like an array item, map entry or option value.');
      return `if (${f(b, 'VAR')} := ${value || 'false?'}):\n${body(g, b, 'DO')}${elseCode(g, b, false)}`;
    },
  });

  // ---------------- values ----------------
  defineBlock({
    type: 'verse_index',
    colour: COLORS.data,
    explain: {
      title: 'Item / entry', doc: DOCS.failure,
      tip: 'Reads Name[key] from an array or map. Can fail.',
      text: 'Scores[0] is the first array item; PlayerScores[Agent] is a map entry. Either may not exist, so this can only be used inside an if or "if it exists".',
    },
    init() {
      this.appendValueInput('KEY').appendField(nameField('Scores'), 'NAME').appendField('[');
      this.appendDummyInput().appendField(']');
      this.setInputsInline(true);
      this.setOutput(true, [FAILABLE, COND]);
    },
    generate(b, g) {
      checkContainer(g, b, f(b, 'NAME'), ['array', 'map'], false);
      checkFailable(g, b, `${f(b, 'NAME')}[…]`);
      return [`${f(b, 'NAME')}[${g.valueToCode(b, 'KEY', Order.NONE) || '0'}]`, Order.ATOMIC];
    },
  });

  defineBlock({
    type: 'verse_length',
    colour: COLORS.data,
    explain: { title: 'Length', doc: DOCS.quick, tip: 'How many items an array or map has.', text: 'Scores.Length is the number of items. The last array position is Scores.Length - 1.' },
    init() {
      this.appendDummyInput().appendField(nameField('Scores'), 'NAME').appendField('.Length');
      this.setOutput(true, 'Number');
    },
    generate: (b) => [`${f(b, 'NAME')}.Length`, Order.ATOMIC],
  });

  defineBlock({
    type: 'verse_option_value',
    colour: COLORS.data,
    explain: {
      title: 'Option value', doc: DOCS.failure,
      tip: 'Gets the value out of an option (Winner?). Fails when it is empty.',
      text: 'Winner? succeeds with the value inside the option, or fails when it is empty (false). Use it in "if it exists": if (W := Winner?).',
    },
    init() {
      this.appendDummyInput().appendField('value in').appendField(nameField('Winner'), 'NAME').appendField('?');
      this.setOutput(true, [FAILABLE, COND]);
    },
    generate(b, g) {
      checkContainer(g, b, f(b, 'NAME'), ['option'], false);
      checkFailable(g, b, `${f(b, 'NAME')}?`);
      return [`${f(b, 'NAME')}?`, Order.ATOMIC];
    },
  });

  defineBlock({
    type: 'verse_make_option',
    colour: COLORS.data,
    explain: { title: 'Put in an option', doc: DOCS.quick, tip: 'option{X}: an option holding X.', text: 'Use with set: set Winner = option{Agent}. To empty it again, set Winner = false.' },
    init() {
      this.appendValueInput('VALUE').appendField('option{');
      this.appendDummyInput().appendField('}');
      this.setInputsInline(true);
      this.setOutput(true, null);
    },
    generate: (b, g) => [`option{${g.valueToCode(b, 'VALUE', Order.NONE) || 'false'}}`, Order.ATOMIC],
  });

  defineBlock({
    type: 'verse_agent_value',
    colour: COLORS.player,
    explain: { title: 'Agent / Player', doc: DOCS.quick, tip: 'The Agent or Player available here, as a value.', text: 'Use it as a map key (PlayerScores[Agent]) or to store in an option (option{Agent}).' },
    init() {
      this.appendDummyInput().appendField(new Blockly.FieldDropdown([['Agent', 'Agent'], ['Player', 'Player']]), 'WHO');
      this.setOutput(true, null);
    },
    generate(b, g) { checkAgent(g, b, f(b, 'WHO')); return [f(b, 'WHO'), Order.ATOMIC]; },
  });
}
