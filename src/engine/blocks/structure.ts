/**
 * Structure blocks: the device class itself, using lines and comments.
 */
import Blockly from '../blockly.ts';
import { COLORS, DOCS, MODULES } from '../data/modules.ts';
import { nameField } from '../fields.ts';
import { defineBlock } from '../registry.ts';
import { f, Slot, stacksIn } from './shared.ts';

export function registerStructureBlocks(): void {
  defineBlock({
    type: 'verse_device',
    colour: COLORS.structure,
    explain: {
      title: 'Verse device (class)', doc: DOCS.quick,
      tip: 'A custom Creative device. Everything you build lives inside this class.',
      text: 'Every Verse script you drop into a UEFN level is a class that inherits from creative_device. Place the compiled device in your level, then link its @editable slots in the Details panel. OnBegin runs automatically when the game starts. Untick "add what I need automatically" to write the using lines yourself.',
    },
    init() {
      this.appendDummyInput().appendField('using')
        .appendField(new Blockly.FieldCheckbox('TRUE'), 'AUTO').appendField('add what I need automatically');
      this.appendStatementInput('USINGS').setCheck(Slot.USING);
      this.appendDummyInput().appendField('device').appendField(nameField('my_device'), 'NAME').appendField(':= class(creative_device)');
      this.appendDummyInput().appendField('linked devices & variables');
      this.appendStatementInput('EDITABLES').setCheck(Slot.MEMBER);
      this.appendDummyInput().appendField('OnBegin — when the game starts');
      this.appendStatementInput('ONBEGIN').setCheck(Slot.STATEMENT);
      this.appendDummyInput().appendField('functions & event handlers');
      this.appendStatementInput('MEMBERS').setCheck(Slot.FUNCTION);
      this.setDeletable(true);
    },
    // Note: using lines are written by generate.ts, because they belong to the whole file.
    generate(b, g) {
      g.need('/Fortnite.com/Devices', 'creative_device');
      const edits = g.statementToCode(b, 'EDITABLES');
      let begin = g.statementToCode(b, 'ONBEGIN');
      const members = g.statementToCode(b, 'MEMBERS');
      if (!begin.trim()) begin = g.INDENT + '# (empty — drag blocks here)\n';
      begin = g.prefixLines(begin, g.INDENT);
      let out = `${f(b, 'NAME')} := class(creative_device):\n\n`;
      if (edits.trim()) out += edits + '\n';
      out += `${g.INDENT}OnBegin<override>()<suspends>:void =\n${begin}`; // style guide 3.2
      if (members.trim()) out += '\n' + members;
      if (g.helpers.has('msg')) {
        out += `\n${g.INDENT}# Turns a string into a message (needed for HUD text)\n${g.INDENT}MakeMessage<localizes>(Text:string):message = "{Text}"\n`;
      }
      return out;
    },
  });

  defineBlock({
    type: 'verse_using',
    colour: COLORS.structure,
    explain: {
      title: 'using { module }', doc: DOCS.modules,
      tip: 'Brings a module\'s names into this file, like opening a toolbox.',
      text: 'Verse code is organized into modules. A using line at the top of the file lets you use a module\'s types and functions by their short names. Without the right using, the compiler says it can\'t find names like Print or button_device.',
    },
    init() {
      this.appendDummyInput().appendField('using {')
        .appendField(new Blockly.FieldDropdown(MODULES.map(m => [m.path, m.path])), 'MODULE').appendField('}');
      stacksIn(this, Slot.USING);
    },
    generate: () => '', // written by generate.ts with the other using lines
  });

  defineBlock({
    type: 'verse_using_custom',
    colour: COLORS.structure,
    explain: {
      title: 'using { your own path }', doc: DOCS.modules,
      tip: 'Uses any module path, including your own project\'s modules.',
      text: 'For modules not in the list, or ones from your own project (like /YourName@fortnite.com/YourProject/Utils), type the full path. Paths start with /.',
    },
    init() {
      this.appendDummyInput().appendField('using {')
        .appendField(new Blockly.FieldTextInput('/Verse.org/Colors', (v: string) => (/^\/[^\s{}]+$/.test(v) ? v : null)), 'PATH')
        .appendField('}');
      stacksIn(this, Slot.USING);
    },
    generate: () => '',
  });

  defineBlock({
    type: 'verse_comment',
    colour: COLORS.comment,
    explain: { title: 'Comment', doc: DOCS.style, tip: 'A note for humans. Ignored by the compiler.', text: 'Comments start with #.' },
    init() {
      this.appendDummyInput().appendField('#').appendField(new Blockly.FieldTextInput('note to self'), 'TEXT');
      stacksIn(this, [Slot.STATEMENT, Slot.MEMBER, Slot.FUNCTION]);
    },
    generate: (b) => `# ${f(b, 'TEXT')}\n`,
  });
}
