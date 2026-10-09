/**
 * Player blocks: optional agents, Fortnite characters (health) and looping over players.
 */
import Blockly from '../blockly.ts';
import { COLORS, DOCS } from '../data/modules.ts';
import { moduleForType } from '../data/verse-types.ts';
import { formatFloat, Order } from '../generator/verse-generator.ts';
import { checkFailable, FAILABLE } from './data.ts';
import { COND } from './logic.ts';
import { SPATIAL } from './movement.ts';

const PLAYER_UTILITIES = '/Fortnite.com/FortPlayerUtilities';
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
      text: 'fort_character has Damage(Amount:float), Heal(Amount:float), SetHealth(Health:float) and SetShield(Shield:float). Amounts are floats. Read them back with the health / shield block.',
    },
    init() {
      this.appendDummyInput().appendField('FortChar.')
        .appendField(new Blockly.FieldDropdown([['Damage', 'Damage'], ['Heal', 'Heal'], ['SetHealth', 'SetHealth'], ['SetShield', 'SetShield']]), 'ACTION')
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

  // FortPlayerUtilities: respawning and sending to the lobby
  defineBlock({
    type: 'verse_respawn',
    colour: COLORS.player,
    explain: {
      title: 'Respawn', doc: DOCS.api,
      tip: 'Agent.Respawn(Position, Rotation): brings an agent back into the game at a spot, facing a rotation.',
      text: 'Respawn puts an agent back into the game at a position (a vector3), facing a rotation. Use it after an elimination, or to send someone back to the start. Needs using { /Fortnite.com/FortPlayerUtilities }; the generator adds it.',
    },
    init() {
      this.appendValueInput('WHO').appendField('respawn');
      this.appendValueInput('POS').appendField('at');
      this.appendValueInput('ROT').appendField('facing');
      this.setInputsInline(true);
      asStatement(this);
    },
    generate(b, g) {
      g.need(PLAYER_UTILITIES, 'Respawn');
      const who = g.valueToCode(b, 'WHO', Order.ATOMIC);
      if (!who) g.warn(b, 'Plug in who to respawn, like Agent.');
      const pos = g.valueToCode(b, 'POS', Order.NONE), rot = g.valueToCode(b, 'ROT', Order.NONE);
      if (!pos) { g.need(SPATIAL, 'vector3'); g.warn(b, 'Plug in where to respawn them.'); }
      if (!rot) g.need(SPATIAL, 'IdentityRotation');
      return `${who || 'Agent'}.Respawn(${pos || 'vector3{}'}, ${rot || 'IdentityRotation()'})\n`;
    },
  });

  defineBlock({
    type: 'verse_send_to_lobby',
    colour: COLORS.player,
    explain: {
      title: 'Send to the lobby', doc: DOCS.api,
      tip: 'Player.SendToLobby(): takes a player out of the island and back to the Fortnite lobby.',
      text: 'SendToLobby removes a player from the game and sends them back to the lobby. It needs a player, not an agent: turn the agent into one first with "if Player := player[Agent]". Needs using { /Fortnite.com/FortPlayerUtilities }.',
    },
    init() {
      this.appendValueInput('WHO').appendField('send');
      this.appendDummyInput().appendField('to the lobby');
      this.setInputsInline(true);
      asStatement(this);
    },
    generate(b, g) {
      g.need(PLAYER_UTILITIES, 'SendToLobby');
      const target = b.getInputTargetBlock('WHO');
      if (target?.type === 'verse_agent_value' && f(target, 'WHO') === 'Agent') {
        g.warn(b, 'SendToLobby needs a player, not an agent. Turn the agent into a player first: if (Player := player[Agent]), then use Player.');
      }
      const who = g.valueToCode(b, 'WHO', Order.ATOMIC);
      if (!who) g.warn(b, 'Plug in the player to send, like Player.');
      return `${who || 'Player'}.SendToLobby()\n`;
    },
  });
}
