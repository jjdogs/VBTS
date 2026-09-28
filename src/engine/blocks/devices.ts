/**
 * Device blocks: linking placed devices (@editable) and calling their actions.
 */
import Blockly from '../blockly.ts';
import type { Block, Field } from '../blockly.ts';
import { DEVICE_TYPES, deviceInfo } from '../catalog.ts';
import { COLORS, DOCS } from '../data/modules.ts';
import { deviceOptions, looseDropdown, nameField, prime, rerender, type Option } from '../fields.ts';
import { Order } from '../generator/verse-generator.ts';
import { defineBlock } from '../registry.ts';
import { deviceTypeFor } from '../workspace.ts';
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
      if (!deviceTypeFor(b, dev)) g.warn(b, `No @editable device named ${dev}.`);
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
      g.helpers.add('msg');
      const value = g.valueToCode(b, 'TEXT', Order.NONE) || '""';
      return `${f(b, 'DEVICE')}.SetText(MakeMessage(${value}))\n`;
    },
  });
}
