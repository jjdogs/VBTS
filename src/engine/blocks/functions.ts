/**
 * Function blocks: your own functions (with inputs, a return type, <suspends> or <decides>),
 * return, check lines, and calling functions (as a step, for their value, or failably).
 */
import Blockly from '../blockly.ts';
import type { Block, BlockSvg, Field } from '../blockly.ts';
import { COLORS, DOCS } from '../data/modules.ts';
import { moduleForType, parseParams, RETURN_TYPES, typeNamesIn } from '../data/verse-types.ts';
import { looseDropdown, nameField, prime, rerender, type Option } from '../fields.ts';
import { Order, type VerseGenerator } from '../generator/verse-generator.ts';
import { defineBlock } from '../registry.ts';
import { enclosingFunction, functionsIn, inDecides, inFailureContext, inSuspends, liveWorkspace, type PlacedFunction } from '../workspace.ts';
import { checkFailable, FAILABLE } from './data.ts';
import { COND } from './logic.ts';
import { asStatement, body, f, Slot, stacksIn, visibility, visibilityDropdown } from './shared.ts';

const MAX_ARGS = 3;

/** Adds the name dropdown and three argument slots used by every call block. */
function callInputs(block: Block, label: string, which: (fn: PlacedFunction) => boolean, fallback: string, open: string, close: string): void {
  block.appendDummyInput('HEAD').appendField(label).appendField(looseDropdown(function () {
    const fns = functionsIn(liveWorkspace(this.getSourceBlock())).filter(which);
    return fns.length ? fns.map(fn => [fn.name, fn.name] as Option) : [[fallback, fallback]];
  }, function (this: Field, v: string) { const b = this.getSourceBlock(); if (b) updateArgs(b, v); return v; }), 'NAME')
    .appendField(open, 'OPEN');
  for (let i = 1; i <= MAX_ARGS; i++) block.appendValueInput(`A${i}`).appendField(i > 1 ? ',' : '', `SEP${i}`);
  block.appendDummyInput('TAIL').appendField(close);
  block.setInputsInline(true);
  prime(block, ['NAME']);
  updateArgs(block, f(block, 'NAME'));
  // Keep the slots right after loading, and when the function's inputs change.
  block.setOnChange(function (this: Block) {
    if (this.workspace && !this.isDeadOrDying()) updateArgs(this, f(this, 'NAME'));
  });
}

/** Shows one argument slot per input the chosen function declares (keeps any that are filled). */
function updateArgs(block: Block, name: string): void {
  if (!(block as BlockSvg).rendered) return; // only drawn blocks show/hide slots
  const fn = functionsIn(liveWorkspace(block)).find(x => x.name === name);
  const count = fn ? fn.params : 0;
  let changed = false;
  for (let i = 1; i <= MAX_ARGS; i++) {
    const input = block.getInput(`A${i}`);
    const show = i <= count || !!input?.connection?.targetBlock();
    if (input && input.isVisible() !== show) { input.setVisible(show); changed = true; }
  }
  if (changed) rerender(block);
}

/** "Name(a, b)" or "Name[a, b]" from a call block's filled argument slots. */
function callCode(b: Block, g: VerseGenerator, open: string, close: string): string {
  const args: string[] = [];
  for (let i = 1; i <= MAX_ARGS; i++) {
    const code = g.valueToCode(b, `A${i}`, Order.NONE);
    if (code) args[i - 1] = code;
  }
  const last = args.length;
  const filled = Array.from({ length: last }, (_, i) => args[i] ?? '0');
  return `${f(b, 'NAME')}${open}${filled.join(', ')}${close}`;
}

function checkCall(g: VerseGenerator, b: Block, want: 'any' | 'value' | 'decides'): PlacedFunction | undefined {
  const name = f(b, 'NAME');
  const fn = functionsIn(b.workspace).find(x => x.name === name);
  if (!fn) { g.warn(b, `No function named ${name}.`); return undefined; }
  const given = [1, 2, 3].filter(i => b.getInputTargetBlock(`A${i}`)).length;
  if (given !== fn.params) g.warn(b, `${name} takes ${fn.params} input${fn.params === 1 ? '' : 's'}, but ${given} ${given === 1 ? 'is' : 'are'} plugged in.`);
  if (want !== 'decides' && fn.decides) g.warn(b, `${name} is <decides> (it can fail), so call it with square brackets: use the "try" call block inside an if.`);
  if (want === 'decides' && !fn.decides) g.warn(b, `${name} isn't <decides>. Tick <decides> on the function, or use a normal call.`);
  if (want === 'value' && fn.returns === 'void') g.warn(b, `${name} returns nothing (void). Give it a return type to use its result.`);
  if (fn.suspends && !inSuspends(b)) g.warn(b, `${name} is <suspends>; call it from suspending code, or use spawn.`);
  return fn;
}

export function registerFunctionBlocks(): void {
  defineBlock({
    type: 'verse_function',
    colour: COLORS.funcs,
    explain: {
      title: 'Function', doc: DOCS.functions,
      tip: 'A reusable chunk of code, with optional inputs and a result.',
      text: 'Inputs are written Name:type, separated by commas (Amount:int, Who:agent). The return type is what it gives back; the last line is the result (or use return). <suspends> lets it wait (Sleep). <decides> makes it failable: it succeeds or fails like a comparison, and is called with square brackets, e.g. if (IsHighScore[Hits]). Verse Blocks writes <decides><transacts>, as Epic\'s style guide recommends.',
    },
    init() {
      this.appendDummyInput().appendField('function').appendField(nameField('DoSomething'), 'NAME')
        .appendField(visibilityDropdown(), 'VIS').appendField('(')
        .appendField(new Blockly.FieldTextInput('', (v: string) => (parseParams(v) ? v : null)), 'PARAMS')
        .appendField(')  :').appendField(new Blockly.FieldDropdown(RETURN_TYPES.map(t => [t, t])), 'RET');
      this.appendDummyInput()
        .appendField(new Blockly.FieldCheckbox('FALSE'), 'SUSPENDS').appendField('<suspends>')
        .appendField(new Blockly.FieldCheckbox('FALSE'), 'DECIDES').appendField('<decides>');
      this.appendStatementInput('DO').setCheck(Slot.STATEMENT);
      stacksIn(this, [Slot.FUNCTION, Slot.MEMBER]); // can follow fields, as in classes
    },
    generate(b, g) {
      const params = parseParams(f(b, 'PARAMS')) ?? [];
      const ret = f(b, 'RET') || 'void';
      for (const t of [...params.flatMap(p => typeNamesIn(p.type)), ret]) { const m = moduleForType(t); if (m) g.need(m, t); }
      const decides = f(b, 'DECIDES') === 'TRUE', suspends = f(b, 'SUSPENDS') === 'TRUE';
      if (decides && suspends) g.warn(b, 'A function can\'t be both <decides> and <suspends> in Verse. Untick one.');
      const effects = (decides ? '<decides><transacts>' : '') + (suspends ? '<suspends>' : '');
      const paramText = params.map(p => `${p.name}:${p.type}`).join(', ');
      return `${f(b, 'NAME')}${visibility(b)}(${paramText})${effects}:${ret} =\n${body(g, b, 'DO')}`; // style guide 3.2
    },
  });

  defineBlock({
    type: 'verse_return',
    colour: COLORS.funcs,
    explain: {
      title: 'Return', doc: DOCS.functions,
      tip: 'Ends the function, giving back a value.',
      text: 'return X stops the function and gives X to whoever called it. Epic\'s style guide prefers letting the last line be the result instead; if you use return anywhere in a function, use it for every result in that function.',
    },
    init() {
      this.appendValueInput('VALUE').appendField('return');
      this.setPreviousStatement(true, Slot.STATEMENT); // nothing runs after return
    },
    generate(b, g) {
      const fn = enclosingFunction(b);
      if (!fn) g.warn(b, 'return only works inside a function.');
      const value = g.valueToCode(b, 'VALUE', Order.NONE);
      if (fn && !value && f(fn, 'RET') !== 'void' && f(fn, 'RET')) g.warn(b, `${f(fn, 'NAME')} returns ${f(fn, 'RET')}, so return needs a value.`);
      return value ? `return ${value}\n` : 'return\n';
    },
  });

  defineBlock({
    type: 'verse_check',
    colour: COLORS.funcs,
    explain: {
      title: 'Check / result line', doc: DOCS.failure,
      tip: 'A line that is just a value: a condition that must succeed, or the function\'s result.',
      text: 'Inside a <decides> function, a line like Score >= 10 is a check: if it fails, the whole function fails. As the last line of a function with a return type, the value is what the function gives back.',
    },
    init() {
      this.appendValueInput('VALUE').appendField('check / result');
      asStatement(this);
    },
    generate(b, g) {
      const fn = enclosingFunction(b);
      if (!fn) g.warn(b, 'A check line only means something inside one of your functions.', 'tip');
      else if (!inDecides(b) && (f(fn, 'RET') || 'void') === 'void') g.warn(b, 'In a function that isn\'t <decides> and returns void, this line has no effect.', 'tip');
      const value = g.valueToCode(b, 'VALUE', Order.NONE);
      if (!value) g.warn(b, 'Plug in a condition or value.');
      return `${value || 'true?'}\n`;
    },
  });

  defineBlock({
    type: 'verse_call_fn',
    colour: COLORS.funcs,
    explain: {
      title: 'Call a function', doc: DOCS.functions, tip: 'Runs one of your functions. Plug in its inputs.',
      text: 'Calling a function runs it. Slots appear for each input it takes, in order. Calling a <suspends> function waits for it to finish, and only works from suspending code.',
    },
    init() {
      callInputs(this, 'call', fn => !fn.decides, 'DoSomething', '(', ')');
      asStatement(this);
    },
    generate(b, g) {
      checkCall(g, b, 'any');
      return `${callCode(b, g, '(', ')')}\n`;
    },
  });

  defineBlock({
    type: 'verse_call_value',
    colour: COLORS.funcs,
    explain: { title: 'Function result', doc: DOCS.functions, tip: 'Calls a function and uses what it returns.', text: 'Use this where a value goes, like Print or set, for functions with a return type.' },
    init() {
      callInputs(this, '', fn => !fn.decides && fn.returns !== 'void', 'GetValue', '(', ')');
      this.setOutput(true, null);
    },
    generate(b, g) {
      checkCall(g, b, 'value');
      return [callCode(b, g, '(', ')'), Order.ATOMIC];
    },
  });

  defineBlock({
    type: 'verse_call_decides',
    colour: COLORS.funcs,
    explain: {
      title: 'Try a <decides> function', doc: DOCS.failure, tip: 'Calls a failable function with [ ]. Use inside an if.',
      text: 'Failable functions are called with square brackets: IsHighScore[Hits]. It succeeds or fails like a comparison, so it goes in an if condition or "if it exists".',
    },
    init() {
      callInputs(this, 'try', fn => fn.decides, 'IsReady', '[', ']');
      this.setOutput(true, [FAILABLE, COND]);
    },
    generate(b, g) {
      checkCall(g, b, 'decides');
      checkFailable(g, b, `${f(b, 'NAME')}[…]`);
      return [callCode(b, g, '[', ']'), Order.ATOMIC];
    },
  });
}

// Re-exported so other files don't need to know where the failure rules live.
export { inFailureContext };
