/**
 * Phase 5.1: players & teams. Every player, the team collection and its (failable) questions,
 * who was eliminated and by whom, and a character's agent, health and shield.
 *
 *   Teams := GetPlayspace().GetTeamCollection()
 *   if (Team := Teams.GetTeam[Agent]):            if (Teams.AddToTeam[Agent, Team]):
 *   if (Eliminator := Result.EliminatingCharacter?):
 *       if (Winner := Eliminator.GetAgent[]):
 */
import Blockly from '../blockly.ts';
import type { Block, BlockSvg, Field } from '../blockly.ts';
import { rerender } from '../fields.ts';
import { COLORS, DOCS } from '../data/modules.ts';
import { TEAM_OPS } from '../data/teams.ts';
import { Order, type VerseGenerator } from '../generator/verse-generator.ts';
import { defineBlock } from '../registry.ts';
import { hasInScope } from '../workspace.ts';
import { checkFailable, FAILABLE } from './data.ts';
import { COND } from './logic.ts';
import { f } from './shared.ts';

const TEAMS_MODULE = '/Fortnite.com/Teams';
const TEAMS_CALL = 'GetPlayspace().GetTeamCollection()';


/** Shows only the inputs the chosen question takes (and any that are filled). */
function updateTeamInputs(block: Block, op: string): void {
  if (!(block as BlockSvg).rendered) return; // only drawn blocks show/hide inputs
  const wanted = TEAM_OPS[op]?.inputs ?? [];
  let changed = false;
  for (const name of ['WHO', 'TEAM'] as const) {
    const input = block.getInput(name);
    const show = wanted.includes(name) || !!input?.connection?.targetBlock();
    if (input && input.isVisible() !== show) { input.setVisible(show); changed = true; }
  }
  if (changed) rerender(block);
}

/** Warns when Result is used outside a handler that receives an elimination or damage result. */
const checkResult = (g: VerseGenerator, b: Block) => {
  if (!hasInScope(b, 'Result')) g.warn(b, 'No Result here. Use this inside a handler that receives an elimination (Result).');
};

export function registerTeamBlocks(): void {
  defineBlock({
    type: 'verse_players',
    colour: COLORS.player,
    explain: {
      title: 'Every player', doc: DOCS.api,
      tip: 'GetPlayspace().GetPlayers(): all players in the game, as an array.',
      text: 'GetPlayspace().GetPlayers() is an array ([]player) of everyone in the game right now. Loop over it with "for each", count it with .Length, or store it in a local value.',
    },
    init() {
      this.appendDummyInput().appendField('every player (GetPlayers())');
      this.setOutput(true, null);
    },
    generate: () => ['GetPlayspace().GetPlayers()', Order.ATOMIC],
  });

  defineBlock({
    type: 'verse_team_collection',
    colour: COLORS.teams,
    explain: {
      title: 'The teams', doc: DOCS.api,
      tip: 'GetPlayspace().GetTeamCollection(): the game\'s teams, to ask who is on which one.',
      text: 'The team collection knows every team in the game and who is on each. Ask it a player\'s team (GetTeam), a team\'s players (GetAgents), whether someone is on a team (IsOnTeam), or move someone (AddToTeam). Those questions can fail, so they go in an if or "if it exists". Store it once in a local value (Teams := …) if you use it a lot.',
    },
    init() {
      this.appendDummyInput().appendField('the teams (GetTeamCollection())');
      this.setOutput(true, null);
    },
    generate(_b, g) {
      g.need(TEAMS_MODULE, 'teams');
      return [TEAMS_CALL, Order.ATOMIC];
    },
  });

  defineBlock({
    type: 'verse_all_teams',
    colour: COLORS.teams,
    explain: {
      title: 'All teams', doc: DOCS.api,
      tip: 'Teams.GetTeams(): every team, as an array ([]team).',
      text: 'GetTeams() lists every team in the game. Loop over it with "for each", or use Length to know how many teams there are. Teams are in the order the island settings define.',
    },
    init() {
      this.appendValueInput('TEAMS').appendField('all teams in');
      this.setInputsInline(true);
      this.setOutput(true, null);
    },
    generate(b, g) {
      g.need(TEAMS_MODULE, 'teams');
      return [`${g.valueToCode(b, 'TEAMS', Order.ATOMIC) || TEAMS_CALL}.GetTeams()`, Order.ATOMIC];
    },
  });

  defineBlock({
    type: 'verse_team_op',
    colour: COLORS.teams,
    explain: {
      title: 'Ask about teams', doc: DOCS.failure,
      tip: 'A player\'s team, a team\'s players, "is on team" or "move to team". Can fail, so use it in an if.',
      text: 'Teams.GetTeam[Agent] gives the agent\'s team, Teams.GetAgents[Team] the agents on a team, Teams.IsOnTeam[Agent, Team] succeeds if they\'re on it, and Teams.AddToTeam[Agent, Team] moves them. All of them can fail (a player might have no team yet), so they use square brackets and go inside an if or "if it exists": if (MyTeam := Teams.GetTeam[Agent]):.',
    },
    init() {
      this.appendValueInput('TEAMS')
        .appendField(new Blockly.FieldDropdown(Object.entries(TEAM_OPS).map(([op, o]) => [`${o.label} (${op})`, op]), function (this: Field, v: string) {
          const b = this.getSourceBlock();
          if (b) updateTeamInputs(b, v);
          return v;
        }), 'OP')
        .appendField('in');
      this.appendValueInput('WHO').appendField('player');
      this.appendValueInput('TEAM').appendField('team');
      this.setInputsInline(true);
      this.setOutput(true, [FAILABLE, COND]);
      updateTeamInputs(this, f(this, 'OP'));
      this.setOnChange(function (this: Block) { if (this.workspace && !this.isDeadOrDying()) updateTeamInputs(this, f(this, 'OP')); });
    },
    generate(b, g) {
      g.need(TEAMS_MODULE, 'teams');
      const op = f(b, 'OP');
      checkFailable(g, b, `${op}[…]`);
      const teams = g.valueToCode(b, 'TEAMS', Order.ATOMIC) || TEAMS_CALL;
      const args = (TEAM_OPS[op]?.inputs ?? []).map(name => {
        const code = g.valueToCode(b, name, Order.NONE);
        if (!code) g.warn(b, `Plug in the ${name === 'WHO' ? 'player (Agent or Player)' : 'team'} for ${op}.`);
        return code || (name === 'WHO' ? 'Agent' : 'Team');
      });
      return [`${teams}.${op}[${args.join(', ')}]`, Order.ATOMIC];
    },
  });

  defineBlock({
    type: 'verse_eliminated',
    colour: COLORS.player,
    explain: {
      title: 'Who was eliminated', doc: DOCS.api,
      tip: 'Result.EliminatedCharacter: the character that was eliminated.',
      text: 'An elimination handler receives a Result. Result.EliminatedCharacter is the fort_character that was eliminated. Use .GetAgent[] on it (in an if) to get the agent, for example to update their score.',
    },
    init() {
      this.appendDummyInput().appendField('who was eliminated (Result.EliminatedCharacter)');
      this.setOutput(true, null);
    },
    generate(b, g) {
      checkResult(g, b);
      return ['Result.EliminatedCharacter', Order.ATOMIC];
    },
  });

  defineBlock({
    type: 'verse_eliminator',
    colour: COLORS.player,
    explain: {
      title: 'Who eliminated them', doc: DOCS.failure,
      tip: 'Result.EliminatingCharacter?: the character who did it. Fails if nobody did (a fall, the storm).',
      text: 'Result.EliminatingCharacter is an option (?fort_character): it is empty when the elimination wasn\'t caused by a character, like falling or the storm. The ? gets the character out, and fails when it is empty, so use it in "if it exists": if (Eliminator := Result.EliminatingCharacter?):.',
    },
    init() {
      this.appendDummyInput().appendField('who eliminated them (Result.EliminatingCharacter?)');
      this.setOutput(true, [FAILABLE, COND]);
    },
    generate(b, g) {
      checkResult(g, b);
      checkFailable(g, b, 'Result.EliminatingCharacter?');
      return ['Result.EliminatingCharacter?', Order.ATOMIC];
    },
  });

  defineBlock({
    type: 'verse_char_agent',
    colour: COLORS.player,
    explain: {
      title: 'Character\'s agent', doc: DOCS.failure,
      tip: 'Char.GetAgent[]: the agent (player) a character belongs to. Can fail.',
      text: 'Scores, teams and devices want an agent, but eliminations give you characters. GetAgent[] turns a fort_character back into its agent; it can fail, so use it in "if it exists": if (Winner := Eliminator.GetAgent[]):.',
    },
    init() {
      this.appendValueInput('CHAR').appendField('agent of');
      this.appendDummyInput().appendField('(GetAgent[])');
      this.setInputsInline(true);
      this.setOutput(true, [FAILABLE, COND]);
    },
    generate(b, g) {
      g.need('/Fortnite.com/Characters', 'GetAgent');
      checkFailable(g, b, 'GetAgent[]');
      const char = g.valueToCode(b, 'CHAR', Order.ATOMIC);
      if (!char) g.warn(b, 'Plug in a character, like FortChar or "who was eliminated".');
      return [`${char || 'FortChar'}.GetAgent[]`, Order.ATOMIC];
    },
  });

  defineBlock({
    type: 'verse_char_stat',
    colour: COLORS.player,
    explain: {
      title: 'Health / shield', doc: DOCS.api,
      tip: 'FortChar.GetHealth() or GetShield(): how much the character has, as a float.',
      text: 'GetHealth() and GetShield() give the character\'s current health or shield as a float (100.0 is full health). Change them with the damage / heal block (SetHealth, SetShield).',
    },
    init() {
      this.appendDummyInput().appendField('FortChar.')
        .appendField(new Blockly.FieldDropdown([['GetHealth()', 'GetHealth'], ['GetShield()', 'GetShield']]), 'STAT');
      this.setOutput(true, 'Number');
    },
    generate(b, g) {
      if (!hasInScope(b, 'FortChar')) g.warn(b, 'FortChar only exists inside "if … has a character".');
      return [`FortChar.${f(b, 'STAT')}()`, Order.ATOMIC];
    },
  });
}
