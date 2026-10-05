/**
 * Fixed reference data: Epic doc links, block category colors, and the modules
 * you can bring in with `using`. Descriptions come from Epic's Verse API reference.
 */
import type { ModuleInfo } from '../types.ts';

/** Links to Epic's Verse documentation, shown under each block's explanation. */
export const DOCS = {
  quick: 'https://dev.epicgames.com/documentation/en-us/fortnite/verse-language-quick-reference',
  functions: 'https://dev.epicgames.com/documentation/en-us/fortnite/functions-in-verse',
  control: 'https://dev.epicgames.com/documentation/en-us/fortnite/control-flow-in-verse',
  failure: 'https://dev.epicgames.com/documentation/en-us/fortnite/failure-in-verse',
  time: 'https://dev.epicgames.com/documentation/en-us/fortnite/time-flow-and-concurrency-in-verse',
  operators: 'https://dev.epicgames.com/documentation/en-us/fortnite/operators-in-verse',
  specifiers: 'https://dev.epicgames.com/documentation/en-us/fortnite/specifiers-and-attributes-in-verse',
  modules: 'https://dev.epicgames.com/documentation/en-us/fortnite/modules-and-paths-in-verse',
  api: 'https://dev.epicgames.com/documentation/en-us/fortnite/verse-api',
  style: 'https://dev.epicgames.com/documentation/en-us/fortnite/verse-code-style-guide-in-unreal-editor-for-fortnite',
} as const;

/** Block colors per toolbox category. The code view's syntax colors match these. */
export const COLORS = {
  structure: '#7B61FF', devices: '#2E9BD6', events: '#E9A23B', logic: '#3DAE72',
  loops: '#D9536F', math: '#2FA6A0', text: '#B46CD3', vars: '#E67A3A',
  player: '#D65446', funcs: '#8A63D2', time: '#6C7A93', comment: '#5b5870', raw: '#6E6A86', data: '#C0862B', types: '#C2579A',
  teams: '#8A9A2B', movement: '#3A8FB7', ui: '#B8629E',
} as const;

/** Modules offered in the "using" dropdown, in the order using lines are written. */
export const MODULES: readonly ModuleInfo[] = [
  { path: '/Fortnite.com/Devices', text: 'Every Creative device (button_device, trigger_device…) and creative_device itself.', unlocks: 'creative_device, *_device' },
  { path: '/Verse.org/Simulation', text: 'Core game types: agent, player, Sleep, and the @editable attribute.', unlocks: 'agent, player, Sleep, @editable' },
  { path: '/UnrealEngine.com/Temporary/Diagnostics', text: 'Debug tools: log channels (log.Print with a level) and debug_draw. Plain Print needs no using line.', unlocks: 'log, log_channel, debug_draw' },
  { path: '/Fortnite.com/Characters', text: 'fort_character and GetFortCharacter[] for health, damage and healing.', unlocks: 'fort_character, GetFortCharacter' },
  { path: '/Verse.org/Random', text: 'Random numbers: GetRandomInt, GetRandomFloat, Shuffle.', unlocks: 'GetRandomInt, GetRandomFloat' },
  { path: '/Fortnite.com/Playspaces', text: 'fort_playspace: the game session, its players and teams.', unlocks: 'fort_playspace, GetPlayers' },
  { path: '/Fortnite.com/Game', text: 'Game events and results, such as elimination and damage results.', unlocks: 'elimination_result, damage_result' },
  { path: '/Fortnite.com/Teams', text: 'Teams and team collections.', unlocks: 'fort_team_collection' },
  { path: '/Fortnite.com/UI', text: 'Fortnite-styled widgets such as button_loud and button_regular.', unlocks: 'button_loud, button_regular' },
  { path: '/UnrealEngine.com/Temporary/UI', text: 'Custom UI: canvas, text_block, GetPlayerUI.', unlocks: 'canvas, text_block, player_ui' },
  { path: '/UnrealEngine.com/Temporary/SpatialMath', text: 'Positions and rotations: vector3, rotation, transform.', unlocks: 'vector3, rotation, transform' },
  { path: '/Verse.org/Colors', text: 'The color type and color helpers.', unlocks: 'color' },
  { path: '/Verse.org/Simulation/Tags', text: 'Gameplay tags for finding devices by tag.', unlocks: 'tag' },
  { path: '/Fortnite.com/Vehicles', text: 'Vehicle types and helpers.', unlocks: 'fort_vehicle' },
  { path: '/Fortnite.com/AI', text: 'AI behaviors for NPCs and guards.', unlocks: 'npc_behavior' },
];

export const MODULE_PATHS: readonly string[] = MODULES.map(m => m.path);
export const moduleInfo = (path: string): ModuleInfo | undefined => MODULES.find(m => m.path === path);
