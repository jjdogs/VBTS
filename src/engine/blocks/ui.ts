/**
 * Phase 5.3: UI widgets. Each player has their own UI (GetPlayerUI[Player], failable); widgets are
 * text blocks and buttons placed on a canvas, shown with AddWidget and hidden with RemoveWidget.
 * A button's OnClick() sends a widget_message; Message.Player is who clicked.
 *
 *   if (UI := GetPlayerUI[Player]):
 *       UI.AddWidget(canvas{Slots := array{canvas_slot{… Widget := text_block{DefaultText := MakeMessage("Hi")}}}})
 *
 * Canvas positions are presets (top-left, centre…), written as the anchors, alignment and
 * SizeToContent Epic's examples use.
 */
import Blockly from '../blockly.ts';
import type { Block } from '../blockly.ts';
import { COLORS, DOCS } from '../data/modules.ts';
import { CANVAS_POSITIONS, canvasCode } from '../data/ui.ts';
import { Order } from '../generator/verse-generator.ts';
import { defineBlock } from '../registry.ts';
import { hasInScope } from '../workspace.ts';
import { checkFailable, FAILABLE } from './data.ts';
import { COND } from './logic.ts';
import { SPATIAL } from './movement.ts';
import { asStatement, f } from './shared.ts';

const UI_MODULE = '/UnrealEngine.com/Temporary/UI';
const FORTNITE_UI = '/Fortnite.com/UI';
/** The slot that lets a player click buttons (the widget takes the mouse). */
export const CLICKABLE = 'player_ui_slot{InputMode := ui_input_mode.All}';


/** The widget's text: MakeMessage(value), using the helper the generator adds. */
function messageOf(b: Block, g: Parameters<typeof checkFailable>[0], input: string): string {
  g.helpers.add('msg');
  return `MakeMessage(${g.valueToCode(b, input, Order.NONE) || '""'})`;
}

export function registerUiBlocks(): void {
  defineBlock({
    type: 'verse_player_ui',
    colour: COLORS.ui,
    explain: {
      title: 'Player\'s UI', doc: DOCS.failure,
      tip: 'GetPlayerUI[Player]: the on-screen UI of one player. Needs a player (not an agent) and can fail.',
      text: 'Every player has their own screen UI. GetPlayerUI[Player] gets it, so you can add widgets that only that player sees. It needs a player: from an agent, first use "if Player := player[Agent]". It can fail, so it goes in "if it exists": if (UI := GetPlayerUI[Player]):.',
    },
    init() {
      this.appendValueInput('PLAYER').appendField('UI of');
      this.setInputsInline(true);
      this.setOutput(true, [FAILABLE, COND]);
    },
    generate(b, g) {
      g.need(UI_MODULE, 'GetPlayerUI');
      checkFailable(g, b, 'GetPlayerUI[…]');
      const target = b.getInputTargetBlock('PLAYER');
      if (target?.type === 'verse_agent_value' && f(target, 'WHO') === 'Agent') {
        g.warn(b, 'GetPlayerUI needs a player, not an agent. Turn the agent into a player first: if (Player := player[Agent]), then use Player.');
      }
      const player = g.valueToCode(b, 'PLAYER', Order.NONE);
      if (!player) g.warn(b, 'Plug in the player whose UI you want, like Player.');
      return [`GetPlayerUI[${player || 'Player'}]`, Order.ATOMIC];
    },
  });

  defineBlock({
    type: 'verse_text_widget',
    colour: COLORS.ui,
    explain: {
      title: 'Text widget', doc: DOCS.api,
      tip: 'text_block{DefaultText := …}: text on the screen. Put it on a canvas to show it.',
      text: 'A text_block shows text. Its DefaultText is a message (localizable text), so the generator wraps your string in the MakeMessage helper. Change it later with "set widget text". Store it in a variable if you want to change it.',
    },
    init() {
      this.appendValueInput('TEXT').appendField('text widget');
      this.setInputsInline(true);
      this.setOutput(true, null);
    },
    generate(b, g) {
      g.need(FORTNITE_UI, 'text_block');
      return [`text_block{DefaultText := ${messageOf(b, g, 'TEXT')}}`, Order.ATOMIC];
    },
  });

  defineBlock({
    type: 'verse_button_widget',
    colour: COLORS.ui,
    explain: {
      title: 'Button widget', doc: DOCS.api,
      tip: 'button_loud{DefaultText := …}: a clickable button. Subscribe its OnClick() to a handler.',
      text: 'Fortnite-styled buttons: loud (bright), regular or quiet. Store the button in a local value, put it on a canvas, and subscribe Button.OnClick() to a handler that receives a button click (Message). Message.Player is who clicked. Players need a free mouse cursor to click: give the canvas to them with UI.AddWidget.',
    },
    init() {
      this.appendValueInput('TEXT')
        .appendField(new Blockly.FieldDropdown([['loud button', 'button_loud'], ['regular button', 'button_regular'], ['quiet button', 'button_quiet']]), 'KIND')
        .appendField('saying');
      this.setInputsInline(true);
      this.setOutput(true, null);
    },
    generate(b, g) {
      const kind = f(b, 'KIND');
      g.need(FORTNITE_UI, kind);
      return [`${kind}{DefaultText := ${messageOf(b, g, 'TEXT')}}`, Order.ATOMIC];
    },
  });

  defineBlock({
    type: 'verse_canvas',
    colour: COLORS.ui,
    explain: {
      title: 'Canvas (place a widget)', doc: DOCS.api,
      tip: 'A canvas holds a widget at a place on the screen: top left, centre, bottom…',
      text: 'Widgets go on a canvas, and the canvas goes on the player\'s UI with AddWidget. Pick where on the screen: the widget is anchored to that point and sized to fit its content. Keep the canvas in a local value (or a [player]canvas map) so you can remove it later with RemoveWidget.',
    },
    init() {
      this.appendValueInput('WIDGET').appendField('canvas with');
      this.appendDummyInput().appendField('at')
        .appendField(new Blockly.FieldDropdown(Object.entries(CANVAS_POSITIONS).map(([k, [label]]) => [label, k])), 'POS');
      this.setInputsInline(true);
      this.setOutput(true, null);
      this.setFieldValue('center', 'POS');
    },
    generate(b, g) {
      g.need(UI_MODULE, 'canvas'); g.need(SPATIAL, 'vector2');
      const widget = g.valueToCode(b, 'WIDGET', Order.NONE);
      if (!widget) g.warn(b, 'Plug in the widget to show, like a text widget or a button.');
      return [canvasCode(f(b, 'POS'), widget || 'text_block{}'), Order.ATOMIC];
    },
  });

  defineBlock({
    type: 'verse_ui_widget',
    colour: COLORS.ui,
    explain: {
      title: 'Show / hide a widget', doc: DOCS.api,
      tip: 'UI.AddWidget(Canvas) shows it on that player\'s screen; RemoveWidget hides it.',
      text: 'AddWidget puts a widget (usually a canvas) on one player\'s screen. For buttons, choose "show and let them click": it adds the widget with player_ui_slot{InputMode := ui_input_mode.All}, which frees the mouse so the player can click. RemoveWidget takes it away again, so keep the canvas in a value you can reach later.',
    },
    init() {
      this.appendValueInput('WIDGET').appendField(new Blockly.FieldDropdown([['show', 'AddWidget'], ['show and let them click', 'AddWidgetClick'], ['hide', 'RemoveWidget']]), 'ACTION');
      this.appendValueInput('UI').appendField('on');
      this.setInputsInline(true);
      asStatement(this);
    },
    generate(b, g) {
      const ui = g.valueToCode(b, 'UI', Order.ATOMIC), widget = g.valueToCode(b, 'WIDGET', Order.NONE);
      if (!ui) g.warn(b, 'Plug in the player\'s UI (from "if UI := UI of Player").');
      if (!widget) g.warn(b, 'Plug in the widget to show or hide.');
      const action = f(b, 'ACTION');
      if (action === 'AddWidgetClick') {
        g.need(UI_MODULE, 'player_ui_slot');
        return `${ui || 'UI'}.AddWidget(${widget || 'Canvas'}, ${CLICKABLE})\n`;
      }
      return `${ui || 'UI'}.${action}(${widget || 'Canvas'})\n`;
    },
  });

  defineBlock({
    type: 'verse_widget_text',
    colour: COLORS.ui,
    explain: {
      title: 'Set widget text', doc: DOCS.api,
      tip: 'Widget.SetText(MakeMessage(…)): changes what a text widget or button says.',
      text: 'SetText changes the words on a text widget or button that is already on the screen, like a live score. Keep the widget in a variable so you can reach it.',
    },
    init() {
      this.appendValueInput('WIDGET').appendField('set text of');
      this.appendValueInput('TEXT').appendField('to');
      this.setInputsInline(true);
      asStatement(this);
    },
    generate(b, g) {
      const widget = g.valueToCode(b, 'WIDGET', Order.ATOMIC);
      if (!widget) g.warn(b, 'Plug in the widget whose text to change.');
      return `${widget || 'Widget'}.SetText(${messageOf(b, g, 'TEXT')})\n`;
    },
  });

  defineBlock({
    type: 'verse_message_player',
    colour: COLORS.ui,
    explain: {
      title: 'Who clicked', doc: DOCS.api,
      tip: 'Message.Player: the player who clicked the button.',
      text: 'A button click handler receives a Message (a widget_message). Message.Player is the player who clicked, so you can reward them or change their UI.',
    },
    init() {
      this.appendDummyInput().appendField('who clicked (Message.Player)');
      this.setOutput(true, null);
    },
    generate(b, g) {
      if (!hasInScope(b, 'Message')) g.warn(b, 'No Message here. Use this inside a handler that receives a button click (Message).');
      return ['Message.Player', Order.ATOMIC];
    },
  });
}
