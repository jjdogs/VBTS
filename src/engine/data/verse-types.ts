/**
 * The Verse value types blocks can declare, and how to write their literals.
 */
import { escapeString, formatFloat } from '../generator/verse-generator.ts';

/** Types a variable, array element, option or map value can have. */
export const VALUE_TYPES = ['int', 'float', 'logic', 'string', 'agent', 'player'] as const;
/** Types that work as map keys (they must be comparable). */
export const KEY_TYPES = ['agent', 'player', 'string', 'int'] as const;
/** Return types for functions. */
export const RETURN_TYPES = ['void', ...VALUE_TYPES] as const;

/** Types that have no literal you can type (players and agents come from the game). */
export const hasLiteral = (type: string) => ['int', 'float', 'logic', 'string'].includes(type);

/** Modules a type needs: agent and player live in /Verse.org/Simulation. */
export const moduleForType = (type: string): string | null =>
  type === 'agent' || type === 'player' ? '/Verse.org/Simulation' : null;

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
