/**
 * Player blocks: optional agents, Fortnite characters (health) and looping over players.
 */
import Blockly from '../blockly.ts';
import { COLORS, DOCS } from '../data/modules.ts';
import { moduleForType } from '../data/verse-types.ts';
import { formatFloat, Order } from '../generator/verse-generator.ts';
import { checkFailable, FAILABLE } from './data.ts';
import { COND } from './logic.ts';
import { defineBlock } from '../registry.ts';
import { hasInScope } from '../workspace.ts';
import { asStatement, body, checkAgent, f, Slot } from './shared.ts';

export function registerPlayerBlocks(): void {
  defineBlock({
    type: 'verse_unwrap_agent',
    colour: COLORS.player,
    explain: {
      title: 'If there is an agent', doc: DOCS.failure,
      tip: 'Unpacks a ?agent. The body only runs if a player actually caused the event.',
      text: 'MaybeAgent? fails when the option is empty. Inside if ( ), failure just skips the body. This is how Verse makes you handle "maybe nobody" safely.',
    },
    init() {
      this.appendDummyInput().appendField('if there is an agent (Agent := MaybeAgent?)');
      this.appendStatementInput('DO').setCheck(Slot.STATEMENT);
      asStatement(this);
    },
    generate(b, g) {
      if (!hasInScope(b, 'MaybeAgent')) g.warn(b, 'No MaybeAgent here. Use this inside a handler that receives "maybe agent (?agent)".');
      return `if (Agent := MaybeAgent?):\n${body(g, b, 'DO')}`;
    },
  });

  defineBlock({
    type: 'verse_fort_character',
    colour: COLORS.player,
    explain: {
      title: 'Get their Fortnite character', doc: DOCS.failure,
      tip: 'Gets the character of an Agent or Player so you can damage or heal it.',
      text: 'GetFortCharacter[] uses square brackets because it can fail (the agent may not have a character). It must be inside an if ( ) failure context. Needs using { /Fortnite.com/Characters }.',
    },
    init() {
      this.appendDummyInput().appendField('if')
        .appendField(new Blockly.FieldDropdown([['Agent', 'Agent'], ['Player', 'Player']]), 'WHO')
        .appendField('has a character (FortChar)');
      this.appendStatementInput('DO').setCheck(Slot.STATEMENT);
      asStatement(this);
    },
    generate(b, g) {
      g.need('/Fortnite.com/Characters', 'GetFortCharacter');
      const who = f(b, 'WHO');
      checkAgent(g, b, who);
      return `if (FortChar := ${who}.GetFortCharacter[]):\n${body(g, b, 'DO')}`;
    },
  });

  defineBlock({
    type: 'verse_char_action',
    colour: COLORS.player,
    explain: {
      title: 'Damage / heal character', doc: DOCS.api,
      tip: 'Changes health on FortChar. Place inside "has a character".',
      text: 'fort_character has Damage(Amount:float), Heal(Amount:float) and SetHealth(Health:float). Amounts are floats.',
    },
    init() {
      this.appendDummyInput().appendField('FortChar.')
        .appendField(new Blockly.FieldDropdown([['Damage', 'Damage'], ['Heal', 'Heal'], ['SetHealth', 'SetHealth']]), 'ACTION')
        .appendField(new Blockly.FieldNumber(25, 0), 'AMOUNT');
      asStatement(this);
    },
    generate(b, g) {
      if (!hasInScope(b, 'FortChar')) g.warn(b, 'FortChar only exists inside "if … has a character".');
      return `FortChar.${f(b, 'ACTION')}(${formatFloat(b.getFieldValue('AMOUNT'))})\n`;
    },
  });

  // Phase 5.0: turning an agent into a player (or any value into one of your classes) can fail.
  defineBlock({
    type: 'verse_cast',
    colour: COLORS.player,
    explain: {
      title: 'Is it a…? (cast)', doc: DOCS.failure,
      tip: 'player[Agent] succeeds with the player when the agent is one. Use it in "if it exists".',
      text: 'An agent can be a player or something else, like an AI guard. player[Agent] gives you the player, and fails when the agent isn\'t one, so it goes in a failure context: if (Player := player[Agent]):. Some things, like a player\'s UI, need a player rather than an agent. The same works for your own classes: cat[MyPet].',
    },
    init() {
      this.appendValueInput('VALUE')
        .appendField(new Blockly.FieldTextInput('player', (s: string) => (/^[A-Za-z_]\w*$/.test(s) ? s : null)), 'TYPE').appendField('[');
      this.appendDummyInput().appendField(']');
      this.setInputsInline(true);
      this.setOutput(true, [FAILABLE, COND]);
    },
    generate(b, g) {
      const type = f(b, 'TYPE');
      const m = moduleForType(type); if (m) g.need(m, type);
      checkFailable(g, b, `${type}[…]`);
      const value = g.valueToCode(b, 'VALUE', Order.NONE);
      if (!value) g.warn(b, `Plug in what to turn into a ${type}, like Agent.`);
      return [`${type}[${value || 'Agent'}]`, Order.ATOMIC];
    },
  });

  defineBlock({
    type: 'verse_for_players',
    colour: COLORS.loops,
    explain: {
      title: 'For every player', doc: DOCS.control,
      tip: 'Runs the inside once for each player in the game.',
      text: 'for (Player : GetPlayspace().GetPlayers()) loops over an array. Inside, Player is the current player. A player is also an agent, so you can pass it to (Agent) methods.',
    },
    init() {
      this.appendDummyInput().appendField('for each Player in the game');
      this.appendStatementInput('DO').setCheck(Slot.STATEMENT);
      asStatement(this);
    },
    generate: (b, g) => `for (Player : GetPlayspace().GetPlayers()):\n${body(g, b, 'DO')}`,
  });
}
