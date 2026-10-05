/**
 * Event blocks: handlers (functions an event calls) and subscribing to events, either a linked
 * device's (MyButton.InteractedWithEvent) or a value's (GetPlayspace().PlayerAddedEvent()).
 */
import Blockly from '../blockly.ts';
import type { Block } from '../blockly.ts';
import { deviceInfo } from '../catalog.ts';
import { handlerParamFor, handlerSignature, HANDLER_INPUTS, VALUE_EVENTS } from '../data/handlers.ts';
import { COLORS, DOCS } from '../data/modules.ts';
import { moduleForType } from '../data/verse-types.ts';
import { deviceOptions, looseDropdown, nameField, prime, type Option } from '../fields.ts';
import { Order, type VerseGenerator } from '../generator/verse-generator.ts';
import { defineBlock } from '../registry.ts';
import { deviceTypeFor, functionsIn, handlersIn, liveWorkspace, rawDeclared } from '../workspace.ts';
import { asStatement, body, f, Slot, stacksIn } from './shared.ts';

/** The handler dropdown shared by both subscribe blocks. */
const handlerDropdown = () => looseDropdown(function () {
  const handlers = handlersIn(liveWorkspace(this.getSourceBlock()));
  return handlers.length ? handlers.map(h => [h.name, h.name] as Option) : [['OnButtonPressed', 'OnButtonPressed']];
});

/** Warns when the handler is missing, or receives something other than what the event sends. */
function checkHandler(g: VerseGenerator, b: Block, ev: string, sends: string | undefined): void {
  const name = f(b, 'HANDLER');
  const handler = handlersIn(b.workspace).find(h => h.name === name);
  if (!handler) {
    // Any function that takes what the event sends works as a handler, including one written as raw Verse.
    const fn = functionsIn(b.workspace).find(x => x.name === name);
    if (fn) {
      if (sends === 'none' ? fn.params !== 0 : sends && fn.params !== 1) g.warn(b, `${ev} sends ${sends === 'none' ? 'nothing' : sends}, so ${name} must take ${sends === 'none' ? 'no inputs' : 'one input'}.`);
      return;
    }
    if (rawDeclared(b.workspace, name)?.isFunction) return;
    g.warn(b, `No handler named ${name}. Add a "when called" block under functions & event handlers.`);
    return;
  }
  if (!sends) return;
  const want = handlerParamFor(sends);
  if (!want) return; // an event blocks can't receive yet: its handler is raw Verse
  if (handler.param !== want) {
    const label = HANDLER_INPUTS[want].label;
    g.warn(b, `${ev} sends ${sends === 'none' ? 'nothing' : sends}, so ${name} must receive "${label}".`, 'error',
      { label: `Make ${name} receive ${label}`, kind: 'setField', type: 'verse_handler', match: name, field: 'PARAM', value: want });
  }
}

export function registerEventBlocks(): void {
  defineBlock({
    type: 'verse_handler',
    colour: COLORS.events,
    explain: {
      title: 'Event handler', doc: DOCS.functions,
      tip: 'A function a device event calls. Its input must match what the event sends.',
      text: 'Events send data to the function you subscribe. InteractedWithEvent sends an agent (the player). TriggeredEvent sends ?agent, an option that might be empty, because code can trigger it without a player. A player joining sends a player, an elimination sends a Result with who was eliminated, and a button click sends a Message with who clicked. Match the handler input to the event.',
    },
    init() {
      this.appendDummyInput().appendField('when called').appendField(nameField('OnButtonPressed'), 'NAME')
        .appendField('receives')
        .appendField(new Blockly.FieldDropdown(Object.entries(HANDLER_INPUTS).map(([v, input]) => [input.label, v])), 'PARAM');
      this.appendStatementInput('DO').setCheck(Slot.STATEMENT);
      stacksIn(this, Slot.FUNCTION);
    },
    generate(b, g) {
      const param = f(b, 'PARAM');
      const type = HANDLER_INPUTS[param]?.type.replace(/^\?/, '');
      const m = type ? moduleForType(type) : null;
      if (m) g.need(m, type);
      return `${f(b, 'NAME')}(${handlerSignature(param)}):void =\n${body(g, b, 'DO')}`; // style guide 3.2: space around =
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
        .appendField(handlerDropdown(), 'HANDLER');
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
      const dev = f(b, 'DEVICE'), ev = f(b, 'EVENT');
      const type = deviceTypeFor(b, dev);
      if (!type && !rawDeclared(b.workspace, dev)?.editable) g.warn(b, `No @editable device named ${dev}. Add one in "linked devices".`);
      checkHandler(g, b, ev, deviceInfo(type)?.events[ev]);
      return `${dev}.${ev}.Subscribe(${f(b, 'HANDLER')})\n`;
    },
  });

  // Phase 5.0: events that are functions on a value (the game, a character, a button).
  defineBlock({
    type: 'verse_subscribe_event',
    colour: COLORS.events,
    explain: {
      title: 'Subscribe to a value\'s event', doc: DOCS.api,
      tip: 'Connects an event of the game, a character or a button to your handler.',
      text: 'Some events belong to a value instead of a linked device, and are called like functions: GetPlayspace().PlayerAddedEvent() when a player joins, FortChar.EliminatedEvent() when a character is eliminated, MyButton.OnClick() when a UI button is clicked. Plug in the value, pick the event, and the handler that runs; its input must match what the event sends (a player, a Result or a Message).',
    },
    init() {
      this.appendValueInput('SOURCE').appendField('when');
      this.appendDummyInput()
        .appendField('.')
        .appendField(looseDropdown(() => Object.keys(VALUE_EVENTS).map(e => [e + '()', e] as Option)), 'EVENT')
        .appendField('run')
        .appendField(handlerDropdown(), 'HANDLER');
      this.setInputsInline(true);
      asStatement(this);
      prime(this, ['EVENT', 'HANDLER']);
    },
    generate(b, g) {
      const source = g.valueToCode(b, 'SOURCE', Order.ATOMIC);
      if (!source) g.warn(b, 'Plug in what the event belongs to, like "the game" for a player joining.');
      const ev = f(b, 'EVENT');
      checkHandler(g, b, ev, VALUE_EVENTS[ev]);
      return `${source || 'GetPlayspace()'}.${ev}().Subscribe(${f(b, 'HANDLER')})\n`;
    },
  });

  defineBlock({
    type: 'verse_playspace',
    colour: COLORS.player,
    explain: {
      title: 'The game (playspace)', doc: DOCS.api,
      tip: 'GetPlayspace(): the game session, with its players and teams.',
      text: 'GetPlayspace() gives you the game session your device runs in. Use it for events like a player joining (PlayerAddedEvent) or leaving, and to get every player or the teams.',
    },
    init() {
      this.appendDummyInput().appendField('the game (GetPlayspace())');
      this.setOutput(true, null);
    },
    generate: () => ['GetPlayspace()', Order.ATOMIC],
  });
}
