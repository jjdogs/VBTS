/**
 * Your own types (Phase 4): classes, structs and enums, their fields and methods, making
 * objects, reading and setting fields, calling methods, enum values and Self.
 *
 *   cat := class:                    cat := class(pet):        point := struct:
 *       Name:string                                                X:float = 0.0
 *       var Lives<private>:int = 9   color := enum{Red, Green}
 *       Meow():void = …
 *
 *   OldCat := cat{Name := "Percy"}   OldCat.Meow()   set Pet.Age += 1   color.Red
 */
import Blockly from '../blockly.ts';
import type { Block, BlockSvg, Workspace } from '../blockly.ts';
import { COLORS, DOCS } from '../data/modules.ts';
import { nameField } from '../fields.ts';
import { Order, type VerseGenerator } from '../generator/verse-generator.ts';
import { defineBlock } from '../registry.ts';
import { asStatement, body, f, Slot, stacksIn, visibility, visibilityDropdown } from './shared.ts';

const CLASS_DOC = 'https://dev.epicgames.com/documentation/en-us/fortnite/class-in-verse';
const MAX_ITEMS = 4;

/** A type name: lower_snake_case identifier, optionally with [] / ? / map forms (e.g. []cat, ?cat, [agent]int). */
const typeField = (initial: string) =>
  new Blockly.FieldTextInput(initial, (s: string) => (/^\??(\[\w*\])*[A-Za-z_]\w*$/.test(s) ? s : null));

/** Class/struct blocks on the workspace: name → { kind, fields }. */
export function typesIn(ws: Workspace | null) {
  const out = new Map<string, { kind: string; fields: Array<{ name: string; hasDefault: boolean }>; methods: Map<string, number> }>();
  if (!ws) return out;
  for (const t of ws.getBlocksByType('verse_class', false)) {
    const fields: Array<{ name: string; hasDefault: boolean }> = [];
    const methods = new Map<string, number>();
    for (let m = t.getInputTargetBlock('MEMBERS'); m; m = m.getNextBlock()) {
      if (m.type === 'verse_member_field') fields.push({ name: f(m, 'NAME'), hasDefault: !!f(m, 'DEFAULT').trim() });
      if (m.type === 'verse_field') fields.push({ name: f(m, 'NAME'), hasDefault: true });
      if (m.type === 'verse_function') methods.set(f(m, 'NAME'), f(m, 'PARAMS').trim() ? f(m, 'PARAMS').split(',').length : 0);
    }
    out.set(f(t, 'NAME'), { kind: f(t, 'KIND'), fields, methods });
  }
  return out;
}
export const enumsIn = (ws: Workspace | null): Map<string, string[]> => new Map(
  (ws ? ws.getBlocksByType('verse_enum', false) : []).map((e: Block): [string, string[]] => [f(e, 'NAME'), f(e, 'VALUES').split(',').map(v => v.trim()).filter(Boolean)]));

/** Shows as many item slots as are filled, plus one empty one (up to MAX_ITEMS). */
function updateItems(block: Block) {
  if (!(block as BlockSvg).rendered) return;
  let lastFilled = 0;
  for (let i = 1; i <= MAX_ITEMS; i++) {
    const name = block.getField(`F${i}`) ? f(block, `F${i}`).trim() : '';
    if (name || block.getInputTargetBlock(`V${i}`) || block.getInputTargetBlock(`A${i}`)) lastFilled = i;
  }
  let changed = false;
  for (let i = 1; i <= MAX_ITEMS; i++) {
    const input = block.getInput(`V${i}`) ?? block.getInput(`A${i}`);
    const show = i <= Math.min(MAX_ITEMS, lastFilled + 1);
    if (input && input.isVisible() !== show) { input.setVisible(show); changed = true; }
  }
  if (changed) void (block as BlockSvg).queueRender?.();
}
const keepItemsUpdated = (block: Block) => {
  updateItems(block);
  block.setOnChange(function (this: Block) { if (this.workspace && !this.isDeadOrDying()) updateItems(this); });
};

/** a, b, c from inputs A1..A4 (only filled ones, in order). */
function args(b: Block, g: VerseGenerator): string {
  const out: string[] = [];
  for (let i = 1; i <= MAX_ITEMS; i++) { const c = g.valueToCode(b, `A${i}`, Order.NONE); if (c) out.push(c); }
  return out.join(', ');
}
function argInputs(block: Block) {
  for (let i = 1; i <= MAX_ITEMS; i++) block.appendValueInput(`A${i}`).appendField(i > 1 ? ',' : '');
}

export function registerTypeBlocks(): void {
  defineBlock({
    type: 'verse_class',
    colour: COLORS.types,
    explain: {
      title: 'Class or struct', doc: CLASS_DOC,
      tip: 'Your own type: a template with fields (data) and methods (functions).',
      text: 'A class bundles data (fields) and functions (methods), like a cat with a Name and a Meow(). Make objects from it with cat{Name := "Percy"}. Put a parent in ( ) to inherit its fields: cat := class(pet). A struct holds data only. Specifiers: <concrete> (can be made with cat{}), <unique> (each object is different), <final> (no subclasses).',
    },
    init() {
      this.appendDummyInput().appendField(nameField('cat'), 'NAME').appendField(':=')
        .appendField(new Blockly.FieldDropdown([['class', 'class'], ['struct', 'struct']]), 'KIND')
        .appendField(new Blockly.FieldDropdown([['', 'none'], ['<concrete>', 'concrete'], ['<unique>', 'unique'], ['<final>', 'final'], ['<abstract>', 'abstract']].map(([l, v]) => [l || '(no specifier)', v])), 'SPEC')
        .appendField('parent').appendField(new Blockly.FieldTextInput('', (s: string) => (s === '' || /^[A-Za-z_]\w*$/.test(s) ? s : null)), 'PARENT');
      this.appendStatementInput('MEMBERS').setCheck([Slot.MEMBER, Slot.FUNCTION]).appendField('fields & methods');
    },
    generate(b, g) {
      const kind = f(b, 'KIND'), spec = f(b, 'SPEC'), parent = f(b, 'PARENT').trim();
      if (kind === 'struct' && parent) g.warn(b, 'Structs can\'t inherit from a parent. Use a class, or clear the parent.');
      const head = `${f(b, 'NAME')} := ${kind}${spec !== 'none' ? `<${spec}>` : ''}${parent && kind === 'class' ? `(${parent})` : ''}:`;
      return `${head}\n${body(g, b, 'MEMBERS')}`;
    },
  });

  defineBlock({
    type: 'verse_enum',
    colour: COLORS.types,
    explain: {
      title: 'Enum', doc: DOCS.quick,
      tip: 'A type with a fixed list of values, like game_state := enum{Waiting, Playing, Over}.',
      text: 'An enum names a small set of choices. Use a value as type.Value (game_state.Playing), store it in a variable of that type, and compare it with =.',
    },
    init() {
      this.appendDummyInput().appendField(nameField('game_state'), 'NAME').appendField(':= enum{')
        .appendField(new Blockly.FieldTextInput('Waiting, Playing, Over', (s: string) => (/^\s*[A-Za-z_]\w*(\s*,\s*[A-Za-z_]\w*)*\s*$/.test(s) ? s : null)), 'VALUES')
        .appendField('}');
    },
    generate: (b) => `${f(b, 'NAME')} := enum{${f(b, 'VALUES').split(',').map(v => v.trim()).filter(Boolean).join(', ')}}\n`,
  });

  defineBlock({
    type: 'verse_member_field',
    colour: COLORS.vars,
    explain: {
      title: 'Field (any type)', doc: CLASS_DOC,
      tip: 'A field of any type, with an optional starting value.',
      text: 'Fields without a starting value must be given one when the object is made (cat{Name := "Percy"}). The type can be your own (cat, game_state) or a container ([]cat, ?cat). Add var if it can change. <private> keeps it inside its class (style guide 6.2).',
    },
    init() {
      this.appendDummyInput()
        .appendField(new Blockly.FieldDropdown([['constant', 'const'], ['var', 'var']]), 'KIND')
        .appendField(nameField('Name'), 'NAME').appendField(visibilityDropdown(), 'VIS').appendField(':')
        .appendField(typeField('string'), 'TYPE').appendField('=')
        .appendField(new Blockly.FieldTextInput(''), 'DEFAULT');
      stacksIn(this, [Slot.MEMBER, Slot.FUNCTION]); // fields and methods can be mixed, as in classes
    },
    generate(b) {
      const def = f(b, 'DEFAULT').trim();
      return `${f(b, 'KIND') === 'var' ? 'var ' : ''}${f(b, 'NAME')}${visibility(b)}:${f(b, 'TYPE')}${def ? ` = ${def}` : ''}\n`;
    },
  });

  defineBlock({
    type: 'verse_construct',
    colour: COLORS.types,
    explain: {
      title: 'Make an object', doc: CLASS_DOC,
      tip: 'Creates an object of your class or struct: cat{Name := "Percy"}.',
      text: 'Give a value for each field that has no starting value; fields with one can be left out. More slots appear as you fill them in.',
    },
    init() {
      this.appendDummyInput().appendField(typeField('cat'), 'TYPE').appendField('{');
      for (let i = 1; i <= MAX_ITEMS; i++) {
        this.appendValueInput(`V${i}`).appendField(i > 1 ? ',' : '').appendField(new Blockly.FieldTextInput(i === 1 ? 'Name' : '', (s: string) => (s === '' || /^[A-Za-z_]\w*$/.test(s) ? s : null)), `F${i}`).appendField(':=');
      }
      this.appendDummyInput().appendField('}');
      this.setInputsInline(true);
      this.setOutput(true, null);
      keepItemsUpdated(this);
    },
    generate(b, g) {
      const type = f(b, 'TYPE');
      const known = typesIn(b.workspace).get(type);
      const given: string[] = [];
      const parts: string[] = [];
      for (let i = 1; i <= MAX_ITEMS; i++) {
        const name = f(b, `F${i}`).trim();
        if (!name) continue;
        given.push(name);
        parts.push(`${name} := ${g.valueToCode(b, `V${i}`, Order.NONE) || '0'}`);
      }
      if (known) {
        const missing = known.fields.filter(x => !x.hasDefault && !given.includes(x.name)).map(x => x.name);
        if (missing.length) g.warn(b, `${type}{…} needs a value for ${missing.join(', ')} (no starting value).`);
        const unknown = given.filter(n => !known.fields.some(x => x.name === n));
        if (unknown.length) g.warn(b, `${type} has no field named ${unknown.join(', ')}.`);
      }
      return [`${type}{${parts.join(', ')}}`, Order.ATOMIC];
    },
  });

  defineBlock({
    type: 'verse_member_get',
    colour: COLORS.types,
    explain: { title: 'Field of an object', doc: CLASS_DOC, tip: 'Reads a field: OldCat.Name.', text: 'Object.Field reads a field of an object. Private fields can only be read inside their own class.' },
    init() {
      this.appendDummyInput().appendField(nameField('OldCat'), 'OBJ').appendField('.').appendField(nameField('Name'), 'MEMBER');
      this.setOutput(true, null);
    },
    generate: (b) => [`${f(b, 'OBJ')}.${f(b, 'MEMBER')}`, Order.ATOMIC],
  });

  defineBlock({
    type: 'verse_member_set',
    colour: COLORS.vars,
    explain: { title: 'Set a field', doc: CLASS_DOC, tip: 'Changes a var field of an object: set Pet.Age += 1.', text: 'Only fields declared with var can change.' },
    init() {
      this.appendValueInput('V').appendField('set').appendField(nameField('Pet'), 'OBJ').appendField('.').appendField(nameField('Age'), 'MEMBER')
        .appendField(new Blockly.FieldDropdown([['=', '='], ['+=', '+='], ['-=', '-=']]), 'OP');
      this.setInputsInline(true);
      asStatement(this);
    },
    generate: (b, g) => `set ${f(b, 'OBJ')}.${f(b, 'MEMBER')} ${f(b, 'OP')} ${g.valueToCode(b, 'V', Order.NONE) || '0'}\n`,
  });

  defineBlock({
    type: 'verse_method_call',
    colour: COLORS.funcs,
    explain: { title: 'Call a method', doc: CLASS_DOC, tip: 'Runs a method of an object: OldCat.Meow().', text: 'Object.Method(inputs) runs the method on that object. More input slots appear as you fill them.' },
    init() {
      this.appendDummyInput().appendField(nameField('OldCat'), 'OBJ').appendField('.').appendField(nameField('Meow'), 'METHOD').appendField('(');
      argInputs(this);
      this.appendDummyInput().appendField(')');
      this.setInputsInline(true);
      asStatement(this);
      keepItemsUpdated(this);
    },
    generate: (b, g) => `${f(b, 'OBJ')}.${f(b, 'METHOD')}(${args(b, g)})\n`,
  });

  defineBlock({
    type: 'verse_method_value',
    colour: COLORS.funcs,
    explain: { title: 'Method result', doc: CLASS_DOC, tip: 'Calls a method and uses what it returns.', text: 'Like "call a method", for methods with a return type.' },
    init() {
      this.appendDummyInput().appendField(nameField('OldCat'), 'OBJ').appendField('.').appendField(nameField('GetName'), 'METHOD').appendField('(');
      argInputs(this);
      this.appendDummyInput().appendField(')');
      this.setInputsInline(true);
      this.setOutput(true, null);
      keepItemsUpdated(this);
    },
    generate: (b, g) => [`${f(b, 'OBJ')}.${f(b, 'METHOD')}(${args(b, g)})`, Order.ATOMIC],
  });

  defineBlock({
    type: 'verse_enum_value',
    colour: COLORS.types,
    explain: { title: 'Enum value', doc: DOCS.quick, tip: 'One value of an enum: game_state.Playing.', text: 'Write the enum type, a dot, and the value.' },
    init() {
      this.appendDummyInput().appendField(nameField('game_state'), 'TYPE').appendField('.').appendField(nameField('Playing'), 'VALUE');
      this.setOutput(true, null);
    },
    generate(b, g) {
      const values = enumsIn(b.workspace).get(f(b, 'TYPE'));
      if (values && !values.includes(f(b, 'VALUE'))) g.warn(b, `${f(b, 'TYPE')} has no value ${f(b, 'VALUE')}. Its values: ${values.join(', ')}.`);
      return [`${f(b, 'TYPE')}.${f(b, 'VALUE')}`, Order.ATOMIC];
    },
  });

  defineBlock({
    type: 'verse_self',
    colour: COLORS.types,
    explain: { title: 'Self', doc: CLASS_DOC, tip: 'The object a method was called on.', text: 'Inside a method, Self is the whole object. You can use its fields without Self, but you need Self to pass the object itself somewhere.' },
    init() {
      this.appendDummyInput().appendField('Self');
      this.setOutput(true, null);
    },
    generate: () => ['Self', Order.ATOMIC],
  });
}
