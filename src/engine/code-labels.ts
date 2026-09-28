/**
 * Code labels: blocks that read like the Verse text.
 *
 * With code labels on, each block's friendly wording ("print", "when called … receives") is
 * swapped for Verse ("Print(", "OnPressed(Agent:agent):void =") as the block is built, and each
 * label gets a syntax class (vb-kw, vb-fn, …) so it is coloured like the Text view.
 * Labels never affect the generated code; they only change what the block shows.
 *
 *   swap:    friendly label → [code text, syntax class]   ('' hides the label)
 *   suffix:  text added at the end of a row                 (e.g. ' =' after a signature)
 *   closeAfter: a closing mark placed right after an input  (e.g. ')' after Print's value)
 */
import Blockly from './blockly.ts';
import type { Block } from './blockly.ts';

type Cls = 'kw' | 'var' | 'fn' | 'type' | 'spec' | 'com' | 'punct';
type Swap = Record<string, [text: string, cls: Cls]>;
interface Spec {
  swap?: Swap;
  suffix?: Array<[row: number, text: string, cls: Cls]>;
  closeAfter?: Array<[input: string, text: string, cls: Cls]>;
}

const SPECS: Record<string, Spec> = {
  verse_device: {
    swap: {
      'using': ['using', 'kw'],
      'add what I need automatically': ['# add the using lines my code needs', 'com'],
      'device': ['', 'punct'],
      ':= class(creative_device)': [':= class(creative_device):', 'type'],
      'linked devices & variables': ['# linked devices & variables', 'com'],
      'OnBegin — when the game starts': ['OnBegin<override>()<suspends>:void =', 'fn'],
      'functions & event handlers': ['# functions & event handlers', 'com'],
    },
  },
  verse_using: { swap: { 'using {': ['using {', 'kw'], '}': ['}', 'kw'] } },
  verse_using_custom: { swap: { 'using {': ['using {', 'kw'], '}': ['}', 'kw'] } },
  verse_comment: { swap: { '#': ['#', 'com'] } },
  verse_editable: { swap: { '@editable': ['@editable', 'spec'] } },
  verse_editable_array: { swap: { '@editable': ['@editable', 'spec'], ': []': [':[]', 'punct'], '= array{}': ['= array{}', 'punct'] } },
  verse_call_device: { swap: { 'using': ['with', 'com'] } },
  verse_hud_text: { swap: { 'set text of': ['', 'punct'], 'to': ['.SetText(MakeMessage(', 'fn'] }, closeAfter: [['TEXT', '))', 'fn']] },
  verse_handler: { swap: { 'when called': ['', 'punct'], 'receives': ['(', 'punct'] }, suffix: [[0, '):void =', 'fn']] },
  verse_subscribe: { swap: { 'when': ['', 'punct'], 'run': ['.Subscribe(', 'fn'] }, suffix: [[0, ')', 'fn']] },
  verse_unwrap_agent: { swap: { 'if there is an agent (Agent := MaybeAgent?)': ['if (Agent := MaybeAgent?):', 'kw'] } },
  verse_fort_character: { swap: { 'if': ['if (FortChar :=', 'kw'], 'has a character (FortChar)': ['.GetFortCharacter[]):', 'fn'] } },
  verse_char_action: { swap: { 'FortChar.': ['FortChar.', 'fn'] } },
  verse_for_players: { swap: { 'for each Player in the game': ['for (Player : GetPlayspace().GetPlayers()):', 'kw'] } },
  verse_if: { swap: { 'if': ['if (', 'kw'], 'then': ['', 'punct'] }, closeAfter: [['COND', '):', 'kw']] },
  verse_if_else: { swap: { 'if': ['if (', 'kw'], 'then': ['', 'punct'], 'else': ['else:', 'kw'] }, closeAfter: [['COND', '):', 'kw']] },
  verse_not: { swap: { 'not': ['not', 'kw'] } },
  verse_is_true: { swap: { '? is true': ['?', 'kw'] } },
  verse_loop: { swap: { 'loop forever': ['loop:', 'kw'] } },
  verse_break: { swap: { 'break out of loop': ['break', 'kw'] } },
  verse_for_range: { swap: { 'for': ['for (', 'kw'] }, suffix: [[0, '):', 'kw']] },
  verse_random: { swap: { 'random int from': ['GetRandomInt(', 'fn'], 'to': [',', 'punct'] }, suffix: [[0, ')', 'fn']] },
  verse_random_range: { swap: { 'random int from': ['GetRandomInt(', 'fn'], 'to': [',', 'punct'] }, closeAfter: [['HI', ')', 'fn']] },
  verse_print: { swap: { 'print': ['Print(', 'fn'] }, closeAfter: [['TEXT', ')', 'fn']] },
  verse_field: {},
  verse_set: { swap: { 'set': ['set', 'var'] } },
  verse_function: { swap: { 'function': ['', 'punct'], ')  :': ['):', 'punct'] }, suffix: [[0, ' =', 'punct']] },
  verse_call_fn: { swap: { 'call': ['', 'punct'] } },
  verse_call_decides: { swap: { 'try': ['', 'punct'] } },
  verse_return: { swap: { 'return': ['return', 'kw'] } },
  verse_check: { swap: { 'check / result': ['', 'punct'] } },
  verse_sleep: { swap: { 'wait': ['Sleep(', 'fn'], 'seconds': [')', 'fn'] } },
  verse_spawn: { swap: { 'spawn in background': ['spawn{', 'kw'] }, suffix: [[0, '}', 'kw']] },
  verse_race: { swap: { 'branch 1': ['block:', 'kw'], 'branch 2': ['block:', 'kw'] }, suffix: [[0, ':', 'kw']] },
  verse_option_field: { swap: { 'var': ['var', 'var'], '= false (empty)': ['= false', 'punct'] } },
  verse_array_field: { swap: { ': []': [':[]', 'punct'] } },
  verse_map_field: { swap: { ': [': [':[', 'punct'] } },
  verse_for_each: { swap: { 'for each': ['for (', 'kw'], 'in': [':', 'punct'], 'with position/key': ['# with key', 'com'] }, closeAfter: [['COLLECTION', '):', 'kw']] },
  verse_array_add: { swap: { 'add to': ['set', 'var'], ':': ['+= array{', 'punct'] }, closeAfter: [['VALUE', '}', 'punct']] },
  verse_set_index: { swap: { 'set': ['if (set', 'kw'], 'if it worked': ['# if it worked', 'com'] }, closeAfter: [['VALUE', ')', 'kw']] },
  verse_if_bind: { swap: { 'if': ['if (', 'kw'], 'then': ['', 'punct'], 'else': ['else:', 'kw'] }, closeAfter: [['VALUE', '):', 'kw']] },
  verse_option_value: { swap: { 'value in': ['', 'punct'] } },
  verse_raw: { swap: { 'Verse': ['', 'punct'] } },
  verse_raw_wrap: { swap: { 'Verse': ['', 'punct'] } },
  verse_raw_member: { swap: { 'Verse': ['', 'punct'] } },
  verse_raw_member_wrap: { swap: { 'Verse': ['', 'punct'] } },
};

let codeLabels = false;
let building: string | null = null;
let patched = false;

/** Turns code labels on or off for blocks built from now on (set it before the workspace starts). */
export function setLabelStyle(style: 'code' | 'friendly'): void {
  codeLabels = style === 'code';
  if (codeLabels && !patched) patchAppendField();
}
export const usesCodeLabels = () => codeLabels;

const label = (text: string, cls: Cls) => new Blockly.FieldLabel(text, `vb-${cls}`);

/** Swaps friendly label strings as they are added, while a block is being built. */
function patchAppendField() {
  patched = true;
  const proto = Blockly.Input.prototype as unknown as { appendField: (f: unknown, name?: string) => unknown };
  const original = proto.appendField;
  proto.appendField = function (this: unknown, field: unknown, name?: string) {
    if (codeLabels && building && typeof field === 'string') {
      const swap = SPECS[building]?.swap?.[field];
      if (swap) field = swap[0] === '' ? '' : label(swap[0], swap[1]);
      else if (field) field = label(field, 'punct');
    }
    return original.call(this, field, name);
  };
}

/** Called around each block's init (see registry.ts). */
export function beginLabels(type: string): void { building = codeLabels ? type : null; }

export function endLabels(block: Block): void {
  const type = building;
  building = null;
  if (!codeLabels || !type) return;
  const spec = SPECS[type];
  for (const [row, text, cls] of spec?.suffix ?? []) block.inputList[row]?.appendField(label(text, cls));
  for (const [inputName, text, cls] of spec?.closeAfter ?? []) {
    const idx = block.inputList.findIndex(i => i.name === inputName);
    if (idx < 0) continue;
    const closer = block.appendDummyInput(`VB_CLOSE_${inputName}`).appendField(label(text, cls));
    const next = block.inputList[idx + 1];
    if (next && next !== closer) block.moveInputBefore(closer.name, next.name);
    block.setInputsInline(true); // keep "Print( value )" on one row
  }
}
