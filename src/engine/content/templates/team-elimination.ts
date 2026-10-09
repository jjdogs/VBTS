/**
 * Game-mode template: team elimination (Phase 5.1).
 *
 * Every player's character is watched for eliminations. When someone eliminates another player,
 * their team scores a point; the first team to WinningScore ends the game. Like every template,
 * the Verse below goes through the text → blocks converter, so it must convert without raw blocks.
 */
import type { Template } from '../../types.ts';

export const teamElimination: Template = {
  id: 'team_elimination',
  title: 'Team elimination',
  kind: 'Team deathmatch',
  summary: 'Two or more teams. Each elimination scores a point for the eliminator\'s team; the first team to 10 wins and the game ends.',
  teaches: 'Players joining (PlayerAddedEvent), elimination events and results, a character\'s agent, teams (GetTeam) and a score per team in a [team]int map.',
  devices: [
    ['EndGame', 'end_game_device', 'End Game', 'Ends the round for everyone when a team wins.'],
    ['Hud', 'hud_message_device', 'HUD Message', 'Shows each team\'s score as it changes.'],
  ],
  steps: [
    'In UEFN, open Island Settings and set the number of teams (for example 2), with players split evenly.',
    'Open Verse Explorer, create a new Verse file named team_elimination, paste your code (Copy Verse) and save.',
    'Build it: Verse menu → Build Verse Code. Fix anything it reports.',
    'Place the devices listed above, then drag team_elimination from the Content Browser into the level.',
    'Select the team_elimination device and link EndGame and Hud in the Details panel.',
    'Give players weapons (starting inventory or an Item Granter), then Launch Session to play.',
  ],
  verse: `using { /Fortnite.com/Devices }  # for creative_device, end_game_device, hud_message_device
using { /Verse.org/Simulation }  # for @editable, player, agent, team
using { /Fortnite.com/Characters }  # for GetFortCharacter, GetAgent
using { /Fortnite.com/Game }  # for elimination_result
using { /Fortnite.com/Teams }  # for the team collection (GetTeams, GetTeam)

team_elimination := class(creative_device):

    @editable
    EndGame:end_game_device = end_game_device{}
    @editable
    Hud:hud_message_device = hud_message_device{}
    var TeamScores:[team]int = map{}
    WinningScore:int = 10

    OnBegin<override>()<suspends>:void =
        # Watch everyone already here, and everyone who joins later
        GetPlayspace().PlayerAddedEvent().Subscribe(OnPlayerAdded)
        for (Player : GetPlayspace().GetPlayers()):
            WatchPlayer(Player)

    OnPlayerAdded(Player:player):void =
        WatchPlayer(Player)

    # Calls OnEliminated whenever this player's character is eliminated
    WatchPlayer(Player:player):void =
        if (FortChar := Player.GetFortCharacter[]):
            FortChar.EliminatedEvent().Subscribe(OnEliminated)

    # The Result says who was eliminated and who did it (nobody, for a fall or the storm)
    OnEliminated(Result:elimination_result):void =
        if (Eliminator := Result.EliminatingCharacter?):
            if (Scorer := Eliminator.GetAgent[]):
                if (Team := GetPlayspace().GetTeamCollection().GetTeam[Scorer]):
                    AddPoint(Scorer, Team)

    AddPoint(Agent:agent, Team:team):void =
        var Score:int = 1
        if (Old := TeamScores[Team]):
            set Score = Old + 1
        if (set TeamScores[Team] = Score) {}
        Hud.SetText(MakeMessage("Team score: {Score}"))
        Hud.Show()
        if (Score >= WinningScore):
            EndGame.Activate(Agent)
`,
};
