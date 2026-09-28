/**
 * UI widget data (Phase 5.3): canvas position presets and the canvas Verse they write.
 */
import { formatFloat } from '../generator/verse-generator.ts';

/** Canvas position presets: name → [label, x, y] (anchor = alignment = the same point). */
export const CANVAS_POSITIONS: Record<string, [label: string, x: number, y: number]> = {
  top_left: ['top left', 0, 0], top: ['top', 0.5, 0], top_right: ['top right', 1, 0],
  left: ['left', 0, 0.5], center: ['centre', 0.5, 0.5], right: ['right', 1, 0.5],
  bottom_left: ['bottom left', 0, 1], bottom: ['bottom', 0.5, 1], bottom_right: ['bottom right', 1, 1],
};

/** The canvas Verse for one widget at a preset position (the converter reads exactly this back). */
export function canvasCode(position: string, widget: string): string {
  const [, x, y] = CANVAS_POSITIONS[position] ?? CANVAS_POSITIONS.center;
  const v = `vector2{X := ${formatFloat(x)}, Y := ${formatFloat(y)}}`;
  return `canvas{Slots := array{canvas_slot{Anchors := anchors{Minimum := ${v}, Maximum := ${v}}, Alignment := ${v}, SizeToContent := true, Widget := ${widget}}}}`;
}

const NUM = String.raw`(\d+(?:\.\d+)?)`;
const vec = (x: string, y: string) => String.raw`vector2\s*\{\s*X\s*:=\s*${x}\s*,\s*Y\s*:=\s*${y}\s*\}`;
const CANVAS = new RegExp(String.raw`^canvas\s*\{\s*Slots\s*:=\s*array\s*\{\s*canvas_slot\s*\{\s*Anchors\s*:=\s*anchors\s*\{\s*Minimum\s*:=\s*`
  + vec(NUM, NUM) + String.raw`\s*,\s*Maximum\s*:=\s*` + vec(String.raw`\1`, String.raw`\2`) + String.raw`\s*\}\s*,\s*Alignment\s*:=\s*`
  + vec(String.raw`\1`, String.raw`\2`) + String.raw`\s*,\s*SizeToContent\s*:=\s*true\s*,\s*Widget\s*:=\s*(.+?)\s*\}\s*\}\s*\}$`);

/** Reads a preset canvas back: its position and the widget's Verse, or null if it isn't one. */
export function matchCanvas(text: string): { position: string; widget: string } | null {
  const m = text.trim().match(CANVAS);
  if (!m) return null;
  const [x, y] = [Number(m[1]), Number(m[2])];
  const position = Object.keys(CANVAS_POSITIONS).find(k => CANVAS_POSITIONS[k][1] === x && CANVAS_POSITIONS[k][2] === y);
  return position ? { position, widget: m[3] } : null;
}
