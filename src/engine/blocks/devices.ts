/**
 * Device blocks: linking placed devices (@editable) and calling their actions.
 */
import Blockly from '../blockly.ts';
import type { Block, BlockSvg, Field } from '../blockly.ts';
import { DEVICE_TYPES, deviceInfo, parseAction } from '../catalog.ts';
import { COLORS, DOCS } from '../data/modules.ts';
import { deviceOptions, looseDropdown, nameField, prime, rerender, type Option } from '../fields.ts';
import { Order } from '../generator/verse-generator.ts';
import { defineBlock } from '../registry.ts';
import { deviceTypeFor, rawDeclared } from '../workspace.ts';
import { asStatement, checkAgent, f, Slot, stacksIn } from './shared.ts';

/** Shows the "using Agent/Player" picker only for actions that take an agent. */
function updateWho(block: Block, method: string | null | undefined): void {
  const needsAgent = /\(Agent\)/.test(method || '');
  const who = block.getField('WHO'), label = block.getField('USING_LBL');
  if (who && label && who.isVisible() !== needsAgent) {
    who.setVisible(needsAgent);
    label.setVisible(needsAgent);
    rerender(block);
  }
}

const MAX_ACTION_INPUTS = 3;
/** A value to write when an input slot is empty, so the code still has the right shape. */
const PLACEHOLDER: Record<string, string> = { int: '0', float: '0.0', logic: 'false', string: '""', agent: 'Agent' };

/** Shows one slot per input of the chosen action, labelled with the input's name. */
function updateActionSlots(block: Block, sig: string): void {
  const { params } = parseAction(sig || '');
  let changed = false;
  for (let i = 1; i <= MAX_ACTION_INPUTS; i++) {
    const input = block.getInput(`A${i}`), label = block.getField(`P${i}`);
    const p = params[i - 1];
    const show = !!p || !!input?.connection?.targetBlock();
    if (label && label.getValue() !== (p ? `${p.name}:` : '')) { label.setValue(p ? `${p.name}:` : ''); changed = true; }
    if (input && input.isVisible() !== show) { input.setVisible(show); changed = true; }
  }
  if (changed) rerender(block);
}

export function registerDeviceBlocks(): void {
  defineBlock({
    type: 'verse_editable',
    colour: COLORS.devices,
    explain: {
      title: '@editable device', doc: DOCS.specifiers,
      tip: 'Creates a slot you link to a device placed in your level.',
      text: '@editable exposes this field in the UEFN Details panel. After compiling, select your Verse device in the level and pick which placed device fills this slot. The = device_type{} part is just a default placeholder.',
    },
    init() {
      this.appendDummyInput().appendField('@editable').appendField(nameField('MyButton'), 'NAME').appendField(':')
        .appendField(new Blockly.FieldDropdown(DEVICE_TYPES.map(t => [t, t])), 'DTYPE');
      stacksIn(this, Slot.MEMBER);
    },
    generate(b, g) {
      const type = f(b, 'DTYPE');
      g.need('/Verse.org/Simulation', '@editable');
      g.need('/Fortnite.com/Devices', type);
      return `@editable\n${f(b, 'NAME')}:${type} = ${type}{}\n`;
    },
  });

  defineBlock({
    type: 'verse_call_device',
    colour: COLORS.devices,
    explain: {
      title: 'Use a device', doc: DOCS.api,
      tip: 'Calls a function on a linked device, like GrantItem or Enable.',
      text: 'Each Creative device exposes functions in the Verse API. Methods marked (Agent) act on one player, so they need an Agent or Player that is available where the block sits.',
    },
    init() {
      this.appendDummyInput()
        .appendField(looseDropdown(deviceOptions()), 'DEVICE').appendField('.')
        .appendField(looseDropdown(function () {
          const b = this.getSourceBlock();
          const type = b ? deviceTypeFor(b, f(b, 'DEVICE')) : undefined;
          const methods = type ? deviceInfo(type)!.methods : ['Enable()', 'Disable()', 'GrantItem(Agent)'];
          return methods.length ? methods.map(m => [m, m] as Option) : [['(no simple actions)', '']];
        }, function (this: Field, v: string) {
          const b = this.getSourceBlock();
          if (b) updateWho(b, v);
          return v;
        }), 'METHOD')
        .appendField('using', 'USING_LBL')
        .appendField(new Blockly.FieldDropdown([['Agent', 'Agent'], ['Player', 'Player']]), 'WHO');
      asStatement(this);
      prime(this, ['DEVICE', 'METHOD']);
      updateWho(this, this.getFieldValue('METHOD'));
      // If the device changes to one without this action, switch to its first action.
      this.setOnChange(function (this: Block) {
        if (!this.workspace || this.isDeadOrDying() || this.workspace.isFlyout) return;
        const type = deviceTypeFor(this, f(this, 'DEVICE'));
        const methods = deviceInfo(type)?.methods;
        if (methods && methods.length && !methods.includes(f(this, 'METHOD'))) this.setFieldValue(methods[0], 'METHOD');
      });
    },
    generate(b, g) {
      const dev = f(b, 'DEVICE');
      let method = f(b, 'METHOD');
      // An @editable written as raw Verse (e.g. inside your own class) counts too.
      if (!deviceTypeFor(b, dev) && !rawDeclared(b.workspace, dev)?.editable) g.warn(b, `No @editable device named ${dev}.`);
      if (/\(Agent\)/.test(method)) {
        const who = f(b, 'WHO');
        checkAgent(g, b, who);
        method = method.replace('(Agent)', `(${who})`);
      }
      if (!method) {
        g.warn(b, 'This device has no simple actions — pick another device.');
        return `# ${dev} has no simple actions\n`;
      }
      return `${dev}.${method}\n`;
    },
  });

  // Phase 5.0: device actions that take inputs, like SetScoreAward(Value:int).
  defineBlock({
    type: 'verse_device_action',
    colour: COLORS.devices,
    explain: {
      title: 'Use a device (with inputs)', doc: DOCS.api,
      tip: 'Calls a device action that takes values, like SetScoreAward(10) or SetMaxDuration(30.0).',
      text: 'Some device actions need values: how many points, how many seconds, which player. A slot appears for each input, named as Epic\'s Verse API names it. Numbers must be the right kind: 30 is an int, 30.0 is a float.',
    },
    init() {
      this.appendDummyInput('HEAD')
        .appendField(looseDropdown(deviceOptions(d => (deviceInfo(d.type)?.actions.length ?? 0) > 0)), 'DEVICE').appendField('.')
        .appendField(looseDropdown(function () {
          const b = this.getSourceBlock();
          const type = b ? deviceTypeFor(b, f(b, 'DEVICE')) : undefined;
          const actions = type ? deviceInfo(type)!.actions : ['SetScoreAward(Value:int)'];
          // Just the name; overloads that share one also show their inputs: SetActiveDuration(Time, Agent).
          const names = actions.map(a => parseAction(a).name);
          const label = (a: string, i: number) => (names.indexOf(names[i]) !== names.lastIndexOf(names[i]) ? a.replace(/:\w+/g, '') : names[i]);
          return actions.length ? actions.map((a, i) => [label(a, i), a] as Option) : [['(no actions with inputs)', '']];
        }, function (this: Field, v: string) {
          const b = this.getSourceBlock();
          if (b && (b as BlockSvg).rendered) updateActionSlots(b, v);
          return v;
        }), 'ACTION').appendField('(');
      for (let i = 1; i <= MAX_ACTION_INPUTS; i++) {
        this.appendValueInput(`A${i}`).appendField(i > 1 ? ',' : '').appendField(new Blockly.FieldLabel(''), `P${i}`);
      }
      this.appendDummyInput().appendField(')');
      this.setInputsInline(true);
      asStatement(this);
      prime(this, ['DEVICE', 'ACTION']);
      this.setOnChange(function (this: Block) {
        if (!this.workspace || this.isDeadOrDying()) return;
        if (!this.workspace.isFlyout) {
          const actions = deviceInfo(deviceTypeFor(this, f(this, 'DEVICE')))?.actions;
          if (actions && actions.length && !actions.includes(f(this, 'ACTION'))) this.setFieldValue(actions[0], 'ACTION');
        }
        if ((this as BlockSvg).rendered) updateActionSlots(this, f(this, 'ACTION'));
      });
    },
    generate(b, g) {
      const dev = f(b, 'DEVICE'), sig = f(b, 'ACTION');
      const type = deviceTypeFor(b, dev);
      if (!type) { if (!rawDeclared(b.workspace, dev)?.editable) g.warn(b, `No @editable device named ${dev}.`); }
      else if (!deviceInfo(type)!.actions.includes(sig)) g.warn(b, `${dev} is a ${type}, which has no action ${sig}. Pick one from the list.`);
      const { name, params } = parseAction(sig);
      const args = params.map((p, i) => {
        const code = g.valueToCode(b, `A${i + 1}`, Order.NONE);
        if (!code) g.warn(b, `Plug in ${p.name} (${p.type === 'agent' ? 'an Agent or Player' : `${/^[aeiou]/.test(p.type) ? 'an' : 'a'} ${p.type}`}) for ${name}.`);
        return code || PLACEHOLDER[p.type] || '0';
      });
      const extra = [1, 2, 3].slice(params.length).filter(i => b.getInputTargetBlock(`A${i}`)).length;
      if (extra) g.warn(b, `${name} takes ${params.length} input${params.length === 1 ? '' : 's'}; take out the extra value.`);
      return `${dev}.${name}(${args.join(', ')})\n`;
    },
  });

  defineBlock({
    type: 'verse_hud_text',
    colour: COLORS.devices,
    explain: {
      title: 'Set HUD message text', doc: DOCS.api,
      tip: 'Changes the text a HUD Message device shows.',
      text: 'HUD text uses the message type (localizable text), not a plain string. The generator adds a small <localizes> helper function that turns your string into a message.',
    },
    init() {
      this.appendValueInput('TEXT').appendField('set text of')
        .appendField(looseDropdown(deviceOptions(d => d.type === 'hud_message_device')), 'DEVICE').appendField('to');
      asStatement(this);
      prime(this, ['DEVICE']);
    },
    generate(b, g) {
      const dev = f(b, 'DEVICE');
      const type = deviceTypeFor(b, dev);
      if (!type) g.warn(b, `No @editable device named ${dev}. Add a hud_message_device in "linked devices".`);
      else if (type !== 'hud_message_device') g.warn(b, `${dev} is a ${type}, which has no text to set. Pick a hud_message_device.`);
      g.helpers.add('msg');
      const value = g.valueToCode(b, 'TEXT', Order.NONE) || '""';
      return `${dev}.SetText(MakeMessage(${value}))\n`;
    },
  });
}
