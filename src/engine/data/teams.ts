/**
 * The team collection's questions (fort_team_collection in /Fortnite.com/Teams): which inputs
 * each one takes, and how the team block words it. All of them can fail.
 */
export const TEAM_OPS: Record<string, { inputs: Array<'WHO' | 'TEAM'>; label: string }> = {
  GetTeam: { inputs: ['WHO'], label: 'team of' },
  GetAgents: { inputs: ['TEAM'], label: 'players on' },
  IsOnTeam: { inputs: ['WHO', 'TEAM'], label: 'is on team' },
  AddToTeam: { inputs: ['WHO', 'TEAM'], label: 'move to team' },
};
