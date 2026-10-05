/**
 * The Verse value types blocks can declare, and how to write their literals.
 */
import { escapeString, formatFloat } from '../generator/verse-generator.ts';

/** Types a variable, array element, option or map value can have. */
export const VALUE_TYPES = [
  'int', 'float', 'logic', 'string', 'agent', 'player',
  'team', 'fort_character', 'vector3', 'rotation', 'transform',
  'canvas', 'text_block', 'button_loud', 'button_regular', 'button_quiet', 'player_ui',
] as const;
/** Types that work as map keys (they must be comparable). */
export const KEY_TYPES = ['agent', 'player', 'team', 'string', 'int'] as const;
/** Return types for functions. */
export const RETURN_TYPES = ['void', ...VALUE_TYPES] as const;

/** Types that have no literal you can type (players and agents come from the game). */
export const hasLiteral = (type: string) => ['int', 'float', 'logic', 'string'].includes(type);

/** The module each type that needs a using line lives in (from Epic's API digest). */
const TYPE_MODULES: Record<string, string> = {
  agent: '/Verse.org/Simulation', player: '/Verse.org/Simulation',
  team: '/Fortnite.com/Teams', fort_team_collection: '/Fortnite.com/Teams',
  fort_character: '/Fortnite.com/Characters',
  fort_playspace: '/Fortnite.com/Playspaces',
  elimination_result: '/Fortnite.com/Game', damage_result: '/Fortnite.com/Game',
  device_ai_interaction_result: '/Fortnite.com/Devices', fort_vehicle: '/Fortnite.com/Vehicles',
  vector3: '/UnrealEngine.com/Temporary/SpatialMath', rotation: '/UnrealEngine.com/Temporary/SpatialMath',
  transform: '/UnrealEngine.com/Temporary/SpatialMath',
  widget: '/UnrealEngine.com/Temporary/UI', canvas: '/UnrealEngine.com/Temporary/UI',
  canvas_slot: '/UnrealEngine.com/Temporary/UI', player_ui: '/UnrealEngine.com/Temporary/UI',
  widget_message: '/UnrealEngine.com/Temporary/UI',
  text_block: '/Fortnite.com/UI', button_loud: '/Fortnite.com/UI', button_regular: '/Fortnite.com/UI', button_quiet: '/Fortnite.com/UI',
  vector2: '/UnrealEngine.com/Temporary/SpatialMath', anchors: '/UnrealEngine.com/Temporary/UI',
};

/** The module a type needs, or null. */
export const moduleForType = (type: string): string | null => TYPE_MODULES[type] ?? null;

/** The plain type names inside a type: "[player]?vector3" → ["player", "vector3"]. */
export const typeNamesIn = (type: string): string[] => type.match(/[A-Za-z_]\w*/g) ?? [];

/** Turns what the user typed into a valid Verse literal of the given type. */
export function literal(type: string, typed: string): string {
  if (type === 'int') return String(parseInt(typed, 10) || 0);
  if (type === 'float') return formatFloat(typed);
  if (type === 'logic') return /^(true|1|yes)$/i.test(typed.trim()) ? 'true' : 'false';
  return `"${escapeString(typed)}"`;
}

/** Splits "a, b, \"c, d\"" into items, keeping commas inside quotes. */
export function splitList(text: string): string[] {
  const out: string[] = [];
  let cur = '', inString = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '\\' && inString) { cur += c + (text[i + 1] ?? ''); i++; continue; }
    if (c === '"') inString = !inString;
    if (c === ',' && !inString) { out.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/** Parameter list text like "Amount:int, Who:agent" → [{name, type}], or null if it isn't valid. */
export function parseParams(text: string): Array<{ name: string; type: string }> | null {
  if (!text.trim()) return [];
  const parts = text.split(',').map(p => p.trim());
  const out: Array<{ name: string; type: string }> = [];
  for (const p of parts) {
    const m = p.match(/^([A-Za-z_]\w*)\s*:\s*(\??(?:\[\w*\])*\w+)$/);
    if (!m) return null;
    out.push({ name: m[1], type: m[2] });
  }
  return out;
}
