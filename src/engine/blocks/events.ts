/**
 * Event blocks: handlers (functions an event calls) and subscribing to device events.
 */
import Blockly from '../blockly.ts';
import type { Block } from '../blockly.ts';
import { deviceInfo } from '../catalog.ts';
import { COLORS, DOCS } from '../data/modules.ts';
import { deviceOptions, looseDropdown, nameField, prime, type Option } from '../fields.ts';
import { defineBlock } from '../registry.ts';
import { deviceTypeFor, handlersIn, liveWorkspace, type PlacedHandler } from '../workspace.ts';
import { asStatement, body, f, Slot, stacksIn } from './shared.ts';

/** What a handler must receive for an event that sends `payload`. */
const PARAM_FOR: Record<string, PlacedHandler['param']> = { 'agent': 'agent', '?agent': 'maybe', 'none': 'none' };
const PARAM_LABEL: Record<PlacedHandler['param'], string> = { agent: 'agent (Agent)', maybe: 'maybe agent (?agent)', none: 'nothing' };

export function registerEventBlocks(): void {
  defineBlock({
    type: 'verse_handler',
    colour: COLORS.events,
    explain: {
      title: 'Event handler', doc: DOCS.functions,
      tip: 'A function a device event calls. Its input must match what the event sends.',
      text: 'Events send data to the function you subscribe. InteractedWithEvent sends an agent (the player). TriggeredEvent sends ?agent, an option that might be empty, because code can trigger it without a player. Match the handler input to the event.',
    },
    init() {
      this.appendDummyInput().appendField('when called').appendField(nameField('OnButtonPressed'), 'NAME')
        .appendField('receives')
        .appendField(new Blockly.FieldDropdown(Object.entries(PARAM_LABEL).map(([v, label]) => [label, v])), 'PARAM');
      this.appendStatementInput('DO').setCheck(Slot.STATEMENT);
      stacksIn(this, Slot.FUNCTION);
    },
    generate(b, g) {
      const param = f(b, 'PARAM');
      const signature = param === 'agent' ? 'Agent:agent' : param === 'maybe' ? 'MaybeAgent:?agent' : '';
      if (param !== 'none') g.need('/Verse.org/Simulation', 'agent');
      return `${f(b, 'NAME')}(${signature}):void =\n${body(g, b, 'DO')}`; // style guide 3.2: space around =
    },
  });

  defineBlock({
    type: 'verse_subscribe',
    colour: COLORS.events,
    explain: {
      title: 'Subscribe to an event', doc: DOCS.api,
      tip: 'Connects a device event to your handler. Usually placed in OnBegin.',
      text: 'Subscribe tells a device: "when this happens, run my function." Do it once in OnBegin. Pick the device, the event, and the handler; the handler input must match what the event sends.',
    },
    init() {
      this.appendDummyInput().appendField('when')
        .appendField(looseDropdown(deviceOptions()), 'DEVICE')
        .appendField(looseDropdown(function () {
          const b = this.getSourceBlock();
          const type = b ? deviceTypeFor(b, f(b, 'DEVICE')) : undefined;
          const events = type ? Object.keys(deviceInfo(type)!.events) : ['InteractedWithEvent'];
          return events.length ? events.map(e => [e, e] as Option) : [['(no events)', '']];
        }), 'EVENT')
        .appendField('run')
        .appendField(looseDropdown(function () {
          const handlers = handlersIn(liveWorkspace(this.getSourceBlock()));
          return handlers.length ? handlers.map(h => [h.name, h.name] as Option) : [['OnButtonPressed', 'OnButtonPressed']];
        }), 'HANDLER');
      asStatement(this);
      prime(this, ['DEVICE', 'EVENT', 'HANDLER']);
      // If the device changes to one without this event, switch to its first event.
      this.setOnChange(function (this: Block) {
        if (!this.workspace || this.workspace.isFlyout || this.isDeadOrDying()) return;
        const type = deviceTypeFor(this, f(this, 'DEVICE'));
        const events = type ? Object.keys(deviceInfo(type)!.events) : [];
        if (events.length && !events.includes(f(this, 'EVENT'))) this.setFieldValue(events[0], 'EVENT');
      });
    },
    generate(b, g) {
      const dev = f(b, 'DEVICE'), ev = f(b, 'EVENT'), name = f(b, 'HANDLER');
      const type = deviceTypeFor(b, dev);
      if (!type) g.warn(b, `No @editable device named ${dev}. Add one in "linked devices".`);
      const handler = handlersIn(b.workspace).find(h => h.name === name);
      if (!handler) g.warn(b, `No handler named ${name}. Add a "when called" block under functions & event handlers.`);
      const sends = deviceInfo(type)?.events[ev];
      if (handler && sends) {
        const want = PARAM_FOR[sends];
        if (handler.param !== want) {
          const label = PARAM_LABEL[want];
          g.warn(b, `${ev} sends ${sends === 'none' ? 'nothing' : sends}, so ${name} must receive "${label}".`, 'error',
            { label: `Make ${name} receive ${label}`, kind: 'setField', type: 'verse_handler', match: name, field: 'PARAM', value: want });
        }
      }
      return `${dev}.${ev}.Subscribe(${name})\n`;
    },
  });
}
