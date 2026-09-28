/**
 * Phase 5.1: players & teams. Team questions, every player, elimination results, a character's
 * agent, health and shield; the lessons and the team elimination template.
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { engine, generateFrom } from './helpers.ts';

function convert(src: string) {
  const parsed = engine.parseVerse(src);
  assert.ok(parsed.ok, parsed.ok ? '' : parsed.error);
  const r = generateFrom(parsed.state);
  return { ...r, raw: parsed.report.raw, blocks: JSON.stringify(parsed.state), errors: r.warnings.filter(w => w.level === 'error').map(w => w.msg) };
}
const stable = (code: string) => assert.equal(convert(code).code, code, 'round trip');
/** A device with an agent handler OnPressed (subscribed to MyButton) holding these lines. */
const pressed = (lines: string[], members: string[] = []) => `my_device := class(creative_device):
    @editable
    MyButton:button_device = button_device{}
${members.map(l => `    ${l}\n`).join('')}
    OnBegin<override>()<suspends>:void =
        MyButton.InteractedWithEvent.Subscribe(OnPressed)

    OnPressed(Agent:agent):void =
${lines.map(l => `        ${l}\n`).join('')}`;

describe('teams', () => {
  test('every team question becomes a block and round-trips', () => {
    const r = convert(pressed([
      'Teams := GetPlayspace().GetTeamCollection()',
      'if (MyTeam := Teams.GetTeam[Agent]):',
      '    if (Teams.IsOnTeam[Agent, MyTeam]):',
      '        Print("on it")',
      '    if (Mates := Teams.GetAgents[MyTeam]):',
      '        Print("{Mates.Length}")',
      'for (T : Teams.GetTeams()):',
      '    if (Teams.AddToTeam[Agent, T]):',
      '        Print("moved")',
    ]));
    assert.deepEqual(r.raw, []);
    for (const op of ['GetTeam', 'IsOnTeam', 'GetAgents', 'AddToTeam']) assert.ok(r.blocks.includes(`"OP":"${op}"`), op);
    assert.ok(r.blocks.includes('"verse_all_teams"') && r.blocks.includes('"verse_team_collection"'));
    assert.match(r.code, /using \{ \/Fortnite\.com\/Teams \}/);
    assert.deepEqual(r.errors, []);
    stable(r.code);
  });

  test('a team question straight from the playspace also converts', () => {
    const r = convert(pressed(['if (MyTeam := GetPlayspace().GetTeamCollection().GetTeam[Agent]):', '    Print("x")']));
    assert.deepEqual(r.raw, []);
    assert.match(r.code, /if \(MyTeam := GetPlayspace\(\)\.GetTeamCollection\(\)\.GetTeam\[Agent\]\):/);
  });

  test('a team question outside a failure context is an error', () => {
    const r = convert(pressed(['Print("{GetPlayspace().GetTeamCollection().GetTeam[Agent]}")']));
    assert.ok(r.errors.some(e => e.includes('GetTeam[…] can fail')), r.errors.join(' | '));
  });

  test('the wrong number of inputs stays raw Verse', () => {
    const r = convert(pressed(['if (T := GetPlayspace().GetTeamCollection().GetTeam[Agent, Agent]):', '    Print("x")']));
    assert.equal(r.raw.length, 1);
  });

  test('a [team]int map holds a score per team', () => {
    const r = convert(pressed(['if (MyTeam := GetPlayspace().GetTeamCollection().GetTeam[Agent]):', '    if (set TeamScores[MyTeam] = 1) {}'], ['var TeamScores:[team]int = map{}']));
    assert.deepEqual(r.raw, []);
    assert.deepEqual(r.errors, []);
  });
});

describe('players and eliminations', () => {
  const src = `my_device := class(creative_device):
    var Knockouts:int = 0

    OnBegin<override>()<suspends>:void =
        GetPlayspace().PlayerAddedEvent().Subscribe(OnPlayerAdded)
        Everyone := GetPlayspace().GetPlayers()
        Print("Players: {Everyone.Length}")

    OnPlayerAdded(Player:player):void =
        if (FortChar := Player.GetFortCharacter[]):
            FortChar.EliminatedEvent().Subscribe(OnEliminated)
            FortChar.SetShield(50.0)
            Print("{FortChar.GetHealth()}")

    OnEliminated(Result:elimination_result):void =
        set Knockouts += 1
        if (Out := Result.EliminatedCharacter.GetAgent[]):
            Print("out")
        if (Eliminator := Result.EliminatingCharacter?):
            if (Winner := Eliminator.GetAgent[]):
                Print("got one")
`;

  test('players, elimination results, GetAgent, health and shield become blocks', () => {
    const r = convert(src);
    assert.deepEqual(r.raw, []);
    for (const t of ['verse_players', 'verse_eliminated', 'verse_eliminator', 'verse_char_agent', 'verse_char_stat']) assert.ok(r.blocks.includes(`"${t}"`), t);
    assert.ok(r.blocks.includes('"ACTION":"SetShield"'));
    assert.deepEqual(r.errors, []);
    stable(r.code);
  });

  test('Result outside an elimination handler is reported', () => {
    const r = convert(pressed(['if (E := Result.EliminatingCharacter?):', '    Print("x")']));
    assert.ok(r.errors.some(e => e.includes('No Result here')), r.errors.join(' | '));
  });

  test('a function input named Player counts as a Player', () => {
    const r = convert(`my_device := class(creative_device):
    OnBegin<override>()<suspends>:void =
        for (Player : GetPlayspace().GetPlayers()):
            Watch(Player)

    Watch(Player:player):void =
        if (FortChar := Player.GetFortCharacter[]):
            FortChar.Heal(10.0)
`);
    assert.ok(!r.errors.some(e => e.includes('No Player here')), r.errors.join(' | '));
  });
});

describe('lessons and template', () => {
  const lesson = (title: string) => engine.LESSONS.find(l => l.title === title)!;
  const passes = (title: string, src: string) => {
    const r = convert(src);
    assert.deepEqual(r.errors, [], title);
    assert.ok(lesson(title).check(r.code, r), `${title}:\n${r.code}`);
  };

  test('lesson "Welcome, everyone" accepts a model solution', () => passes('Welcome, everyone', `my_device := class(creative_device):
    OnBegin<override>()<suspends>:void =
        GetPlayspace().PlayerAddedEvent().Subscribe(OnPlayerAdded)

    OnPlayerAdded(Player:player):void =
        Print("Welcome!")
`));

  test('lesson "Pick a side" accepts a model solution', () => passes('Pick a side',
    pressed(['if (MyTeam := GetPlayspace().GetTeamCollection().GetTeam[Agent]):', '    Print("You have a team!")'])));

  test('lesson "Knockouts" accepts a model solution', () => passes('Knockouts', `my_device := class(creative_device):
    var Knockouts:int = 0

    OnBegin<override>()<suspends>:void =
        GetPlayspace().PlayerAddedEvent().Subscribe(OnPlayerAdded)

    OnPlayerAdded(Player:player):void =
        if (FortChar := Player.GetFortCharacter[]):
            FortChar.EliminatedEvent().Subscribe(OnEliminated)

    OnEliminated(Result:elimination_result):void =
        set Knockouts += 1
        Print("Knockouts: {Knockouts}")
`));

  test('the team elimination template converts with no warnings', () => {
    const t = engine.TEMPLATES.find(x => x.id === 'team_elimination')!;
    const r = convert(t.verse);
    assert.deepEqual(r.raw, []);
    assert.deepEqual(r.warnings.filter(w => w.level !== 'tip').map(w => w.msg), []);
  });
});
