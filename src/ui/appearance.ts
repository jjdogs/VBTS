/**
 * Look (Appearance): every visual setting, applied live and saved in the browser.
 *
 *  - Themes set all colours at once; the accent and any colour can then be changed individually.
 *  - The Look panel finds settings by search, shows only changed ones, edits them all as JSON,
 *    and Inspect jumps from any part of the app to the colour that paints it.
 *  - Colours, fonts and sizes become CSS variables on <html> (see styles/appearance.css).
 *  - The block workspace gets a Blockly theme built from the same settings.
 *  - Block category colours go to the engine (setColourOverrides) and recolour blocks live.
 *  - Block shape (renderer) is chosen when the workspace starts, so it applies after a reload.
 */
import type Blockly from '../engine/blockly.ts';
import type { Engine } from '../engine/index.ts';
import { ICONS } from './icons.ts';
import { PANEL_IDS, PANEL_TITLES } from './layout.ts';
import type { Layout, PanelId, Side } from './layout.ts';

type BlocklyNS = typeof Blockly;

// ---------------------------------------------------------------------------------------
// Settings model
// ---------------------------------------------------------------------------------------
export const UI_COLOURS = ['chrome', 'bar', 'bg', 'panel', 'panel2', 'line', 'ink', 'muted', 'accent', 'accentInk', 'ok', 'warn', 'bad', 'codeBg'] as const;
export const SYNTAX_COLOURS = ['kw', 'var', 'str', 'num', 'spec', 'type', 'fn', 'com'] as const;
type UiColour = typeof UI_COLOURS[number];
type SyntaxColour = typeof SYNTAX_COLOURS[number];
export type Palette = Record<UiColour, string> & { syntax: Record<SyntaxColour, string>; dark: boolean };

export interface AppearanceSettings {
  preset: string;
  /** Individual colour changes on top of the preset. */
  colours: Partial<Record<UiColour, string>>;
  syntax: Partial<Record<SyntaxColour, string>>;
  /** Block category colours: category key (e.g. "logic") → colour. */
  blocks: Record<string, string>;
  uiFont: string;
  codeFont: string;
  blockFont: 'code' | 'ui';
  /** Interface text size multiplier. */
  uiScale: number;
  /** Code text size in px. */
  codeSize: number;
  lineHeight: number;
  /** Block zoom when the app opens. */
  blockScale: number;
  /** "text": blocks read and look like the Verse text (code labels, outlines, code font).
   *  "classic": solid blocks with friendly labels. Applies after a reload. */
  blockStyle: 'text' | 'classic';
  /** Block wording: "friendly" ("print", "when called") or "code" ("Print(", "OnPressed(…):void ="). */
  blockWords: 'friendly' | 'code';
  /** "document": blocks line up top-to-bottom and scroll like text. "canvas": free space. */
  layout: 'document' | 'canvas';
  renderer: 'zelos' | 'geras' | 'thrasos';
  grid: boolean;
  /** Corner roundness multiplier (0 = square). */
  radius: number;
  density: 'compact' | 'comfortable' | 'spacious';
  motion: boolean;
  /** Tabs and files: a dot on files with problems, and ".verse" after tab names. */
  fileDots: boolean;
  fileExt: boolean;
}

export const DEFAULTS: AppearanceSettings = {
  preset: 'graphite', colours: {}, syntax: {}, blocks: {},
  uiFont: 'Lexend', codeFont: 'JetBrains Mono', blockFont: 'code',
  blockStyle: 'text', blockWords: 'friendly',
  uiScale: 1, codeSize: 13.5, lineHeight: 1.65, blockScale: 1,
  layout: 'document', renderer: 'zelos', grid: false,
  radius: 1, density: 'comfortable', motion: true,
  fileDots: true, fileExt: false,
};

/** Graphite: the neutral dark look from the design sheet (the default). */
const GRAPHITE: Palette = {
  dark: true, chrome: '#1F1F24', bar: '#0E0E11', bg: '#151517', panel: '#1A1A1D', panel2: '#26262A', line: '#2E2E33',
  ink: '#E7E7EC', muted: '#9494A2', accent: '#8B7CF5', accentInk: '#151517', ok: '#4BC88A', warn: '#F59D41', bad: '#F0564A', codeBg: '#151517',
  syntax: { kw: '#5DD399', var: '#F59D41', str: '#D59AF0', num: '#5AD1CB', spec: '#F1C84B', type: '#6CB6F5', fn: '#F2AE6B', com: '#7C7C8A' },
};

const MIDNIGHT: Palette = {
  dark: true, chrome: '#1B1834', bar: '#100E22', bad: '#FF6B7A', bg: '#13112A', panel: '#1B1834', panel2: '#24204A', line: '#34305C', ink: '#EFEBFF', muted: '#A7A1CE',
  accent: '#9480FF', accentInk: '#13112A', ok: '#4CC98A', warn: '#F0B04E', codeBg: '#100E22',
  syntax: { kw: '#5ED39A', var: '#F59A5E', str: '#D69BF0', num: '#5AD1CB', spec: '#F2C063', type: '#6CC0F2', fn: '#F2B36B', com: '#7D78A3' },
};
const DAYLIGHT: Palette = {
  dark: false, chrome: '#FFFFFF', bar: '#ECE9F7', bad: '#D33A3A', bg: '#F4F2FC', panel: '#FFFFFF', panel2: '#EFECFA', line: '#DCD7F0', ink: '#1E1A38', muted: '#5E5980',
  accent: '#6A50F0', accentInk: '#FFFFFF', ok: '#22885A', warn: '#B8741A', codeBg: '#FBFAFF',
  syntax: { kw: '#2E8A5C', var: '#C4621F', str: '#9A4FBA', num: '#1F8A85', spec: '#B07A12', type: '#2379B4', fn: '#B45A12', com: '#8C88A6' },
};
const HIGH_CONTRAST: Palette = {
  dark: true, chrome: '#0A0A0A', bar: '#000000', bad: '#FF5A5A', bg: '#000000', panel: '#0A0A0A', panel2: '#1A1A1A', line: '#8A8A8A', ink: '#FFFFFF', muted: '#D6D6D6',
  accent: '#FFD400', accentInk: '#000000', ok: '#3CFF8F', warn: '#FFB020', codeBg: '#000000',
  syntax: { kw: '#7CFFB2', var: '#FFB86B', str: '#FF9CF0', num: '#6CF0FF', spec: '#FFE36E', type: '#8CCBFF', fn: '#FFC98B', com: '#C8C8C8' },
};
const WARM: Palette = {
  dark: true, chrome: '#241A15', bar: '#17100C', bad: '#F26B5B', bg: '#1C1410', panel: '#241A15', panel2: '#30231C', line: '#4A3529', ink: '#F7EDE4', muted: '#C9B3A2',
  accent: '#F29A4A', accentInk: '#1C1410', ok: '#7BCB7A', warn: '#F2C14E', codeBg: '#17100C',
  syntax: { kw: '#9ED67E', var: '#F7A36B', str: '#E8A0C8', num: '#7FD3C4', spec: '#F2C866', type: '#8EC2EA', fn: '#F5B97A', com: '#9C8676' },
};
const SYSTEM_DARK = window.matchMedia('(prefers-color-scheme: dark)');
export const PRESETS: Record<string, { label: string; palette: () => Palette }> = {
  graphite: { label: 'Graphite', palette: () => GRAPHITE },
  midnight: { label: 'Midnight', palette: () => MIDNIGHT },
  daylight: { label: 'Daylight', palette: () => DAYLIGHT },
  warm: { label: 'Warm', palette: () => WARM },
  contrast: { label: 'High contrast', palette: () => HIGH_CONTRAST },
  system: { label: 'Match my device', palette: () => (SYSTEM_DARK.matches ? GRAPHITE : DAYLIGHT) },
};
/** Accent swatches under the themes (from the design sheet). */
export const ACCENTS = ['#8B7CF5', '#4DA2FF', '#3DCF8E', '#F59D41', '#F472B5', '#F1C84B'];

/** Text on the accent: dark on light accents, white on dark ones. */
function inkFor(hex: string): string {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.3 ? '#151517' : '#FFFFFF';
}

/** Fonts from Google Fonts (the only font host published pages allow), plus system fonts. */
const UI_FONTS: Record<string, string> = {
  'Lexend': 'Lexend:wght@400;500;600;700', 'Inter': 'Inter:wght@400;500;600;700',
  'Atkinson Hyperlegible': 'Atkinson+Hyperlegible:wght@400;700', 'Nunito': 'Nunito:wght@400;500;600;700',
  'Source Sans 3': 'Source+Sans+3:wght@400;500;600;700', 'System': '',
};
const CODE_FONTS: Record<string, string> = {
  'JetBrains Mono': 'JetBrains+Mono:wght@400;600', 'Fira Code': 'Fira+Code:wght@400;600',
  'Source Code Pro': 'Source+Code+Pro:wght@400;600', 'IBM Plex Mono': 'IBM+Plex+Mono:wght@400;600',
  'Roboto Mono': 'Roboto+Mono:wght@400;600', 'System': '',
};
const uiStack = (f: string) => (f === 'System' ? '' : `'${f}', `) + "system-ui, -apple-system, 'Segoe UI', sans-serif";
const codeStack = (f: string) => (f === 'System' ? '' : `'${f}', `) + 'ui-monospace, Consolas, monospace';

/** Block categories users can recolour (keys match the engine's COLORS). */
export const BLOCK_CATEGORIES: Array<[key: string, label: string]> = [
  ['structure', 'Device & using'], ['devices', 'Devices'], ['events', 'Events'], ['player', 'Player'],
  ['logic', 'Logic'], ['loops', 'Loops'], ['math', 'Math'], ['text', 'Text'], ['vars', 'Variables'],
  ['data', 'Lists & Maps'], ['types', 'Types'], ['teams', 'Teams'], ['movement', 'Movement'], ['ui', 'UI widgets'], ['funcs', 'Functions'], ['time', 'Time'], ['comment', 'Comments'], ['raw', 'Raw Verse'],
];
const UI_LABELS: Record<UiColour, string> = {
  chrome: 'Top bar, tabs and status bar', bar: 'Side icon bars', bad: 'Errors', bg: 'Background', panel: 'Panels', panel2: 'Soft fill', line: 'Borders', ink: 'Text', muted: 'Secondary text',
  accent: 'Accent', accentInk: 'Text on accent', ok: 'Success', warn: 'Warning', codeBg: 'Editor background',
};
const SYNTAX_LABELS: Record<SyntaxColour, string> = {
  kw: 'Control (if, for…)', var: 'Variables (var, set)', str: 'Text strings', num: 'Numbers',
  spec: 'Specifiers <…>', type: 'Devices & types', fn: 'Functions', com: 'Comments',
};
const KEY = 'verse-blocks:appearance:v1';

// ---------------------------------------------------------------------------------------
// Appearance: load, resolve, apply, change
// ---------------------------------------------------------------------------------------
export interface Appearance {
  settings: () => AppearanceSettings;
  /** Changes some settings, applies them live, saves, and tells listeners. */
  set: (patch: Partial<AppearanceSettings>) => void;
  reset: () => void;
  /** The Blockly theme for the current settings. */
  theme: (B: BlocklyNS) => InstanceType<BlocklyNS['Theme']>;
  isDark: () => boolean;
  /** Called after every change (and when the system switches dark/light). */
  onChange: (fn: (s: AppearanceSettings) => void) => void;
  exportCode: () => string;
  importCode: (code: string) => boolean;
  /** Replaces every setting (missing ones go back to their defaults); used by the JSON editor. */
  load: (data: Partial<AppearanceSettings>) => void;
  /** The resolved colours right now (theme + your changes). */
  palette: () => Palette;
}

/** The theme's colours with your changes on top (the accent's text colour follows the accent). */
function resolvePalette(s: AppearanceSettings): Palette {
  const base = PRESETS[s.preset].palette();
  const p: Palette = { ...base, ...s.colours, syntax: { ...base.syntax, ...s.syntax } };
  if (s.colours.accent && !s.colours.accentInk) p.accentInk = inkFor(p.accent);
  return p;
}

function clampSettings(s: AppearanceSettings): AppearanceSettings {
  const num = (v: unknown, lo: number, hi: number, d: number) => (typeof v === 'number' && isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
  const hex = (v: unknown) => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);
  const pick = <T extends string>(v: unknown, options: readonly T[], d: T): T => (options.includes(v as T) ? (v as T) : d);
  const colours = (o: unknown) => Object.fromEntries(Object.entries((o && typeof o === 'object') ? o : {}).filter(([, v]) => hex(v)));
  return {
    preset: pick(s.preset, Object.keys(PRESETS), DEFAULTS.preset),
    colours: colours(s.colours), syntax: colours(s.syntax), blocks: colours(s.blocks),
    uiFont: pick(s.uiFont, Object.keys(UI_FONTS), DEFAULTS.uiFont),
    codeFont: pick(s.codeFont, Object.keys(CODE_FONTS), DEFAULTS.codeFont),
    blockFont: pick(s.blockFont, ['code', 'ui'] as const, DEFAULTS.blockFont),
    blockStyle: pick(s.blockStyle, ['text', 'classic'] as const, 'text'),
    blockWords: pick(s.blockWords, ['friendly', 'code'] as const, 'friendly'),
    uiScale: num(s.uiScale, 0.85, 1.35, 1), codeSize: num(s.codeSize, 11, 22, 13.5), lineHeight: num(s.lineHeight, 1.3, 2.1, 1.65),
    blockScale: num(s.blockScale, 0.5, 1.6, 1),
    layout: pick(s.layout, ['document', 'canvas'] as const, 'document'),
    renderer: pick(s.renderer, ['zelos', 'geras', 'thrasos'] as const, 'zelos'),
    grid: typeof s.grid === 'boolean' ? s.grid : false,
    radius: num(s.radius, 0, 2, 1),
    density: pick(s.density, ['compact', 'comfortable', 'spacious'] as const, 'comfortable'),
    motion: typeof s.motion === 'boolean' ? s.motion : true,
    fileDots: typeof s.fileDots === 'boolean' ? s.fileDots : true,
    fileExt: typeof s.fileExt === 'boolean' ? s.fileExt : false,
  };
}

export function createAppearance(defaultColours: Record<string, string>): Appearance {
  let settings: AppearanceSettings;
  try { settings = clampSettings({ ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }); }
  catch { settings = { ...DEFAULTS }; }
  // Block look is fixed when the workspace starts (labels are built into blocks), like block shape.
  const startStyle = settings.blockStyle;
  const listeners: Array<(s: AppearanceSettings) => void> = [];
  let themeCount = 0;

  const palette = (): Palette => resolvePalette(settings);

  const loadedFonts = new Set<string>(['Lexend', 'JetBrains Mono']); // already in index.html
  function loadFont(name: string, spec: string) {
    if (!spec || loadedFonts.has(name)) return;
    loadedFonts.add(name);
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${spec}&display=swap`;
    document.head.appendChild(link);
  }

  function apply() {
    const p = palette(), root = document.documentElement, set = (k: string, v: string) => root.style.setProperty(k, v);
    const cssName: Record<UiColour, string> = {
      chrome: '--chrome', bar: '--bar', bad: '--bad', bg: '--bg', panel: '--panel', panel2: '--panel2', line: '--line', ink: '--ink', muted: '--muted',
      accent: '--accent', accentInk: '--accent-ink', ok: '--ok', warn: '--warn', codeBg: '--code-bg',
    };
    for (const k of UI_COLOURS) set(cssName[k], p[k]);
    for (const k of SYNTAX_COLOURS) set(`--t-${k}`, p.syntax[k]);
    const [r, g, b] = [1, 3, 5].map(i => parseInt(p.accent.slice(i, i + 2), 16));
    set('--hl', `rgba(${r},${g},${b},${p.dark ? 0.18 : 0.13})`);
    root.dataset.theme = p.dark ? 'dark' : 'light';
    root.style.colorScheme = p.dark ? 'dark' : 'light';

    loadFont(settings.uiFont, UI_FONTS[settings.uiFont]);
    loadFont(settings.codeFont, CODE_FONTS[settings.codeFont]);
    set('--ui', uiStack(settings.uiFont));
    set('--mono', codeStack(settings.codeFont));
    set('--ui-scale', String(settings.uiScale));
    set('--code-size', `${settings.codeSize}px`);
    set('--code-lh', String(settings.lineHeight));
    set('--radius-scale', String(settings.radius));
    set('--space', String({ compact: 0.7, comfortable: 1, spacious: 1.3 }[settings.density]));
    set('--ws-bg', settings.layout === 'document' ? p.codeBg : p.bg);
    document.body.classList.toggle('no-grid', settings.layout === 'document' || !settings.grid);
    document.body.classList.toggle('reduce-motion', !settings.motion);
    document.body.dataset.blocksLayout = settings.layout;
    document.body.classList.toggle('blocks-text', startStyle === 'text');
  }

  function notify() { listeners.forEach(fn => fn(settings)); }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* private mode */ } }

  const api: Appearance = {
    settings: () => settings,
    set(patch) { settings = clampSettings({ ...settings, ...patch }); apply(); save(); notify(); },
    reset() { settings = { ...DEFAULTS, colours: {}, syntax: {}, blocks: {} }; apply(); save(); notify(); },
    isDark: () => palette().dark,
    theme(B) {
      const p = palette();
      const text = startStyle === 'text';
      const family = text || settings.blockFont === 'code' ? codeStack(settings.codeFont) : uiStack(settings.uiFont);
      // Like text: block text is the same size as the code (points = px × 0.75).
      return B.Theme.defineTheme(`verse-appearance-${++themeCount}`, {
        name: `verse-appearance-${themeCount}`,
        base: B.Themes.Classic,
        componentStyles: {
          workspaceBackgroundColour: settings.layout === 'document' ? p.codeBg : p.bg,
          toolboxBackgroundColour: p.panel, toolboxForegroundColour: p.ink,
          flyoutBackgroundColour: p.panel2, flyoutForegroundColour: p.ink, flyoutOpacity: 0.97,
          scrollbarColour: p.line, scrollbarOpacity: 0.8,
          insertionMarkerColour: p.ink, insertionMarkerOpacity: 0.3, cursorColour: p.ink,
        },
        fontStyle: { family, weight: text ? '400' : '500', size: text ? Math.round(settings.codeSize * 0.75 * 10) / 10 : 11 },
      });
    },
    onChange(fn) { listeners.push(fn); },
    load(data) { settings = clampSettings({ ...DEFAULTS, ...data }); apply(); save(); notify(); },
    palette,
    exportCode: () => 'VBLOOK1:' + btoa(unescape(encodeURIComponent(JSON.stringify(settings)))),
    importCode(code) {
      try {
        const data = JSON.parse(decodeURIComponent(escape(atob(code.trim().replace(/^VBLOOK1:/, '')))));
        settings = clampSettings({ ...DEFAULTS, ...data });
        apply(); save(); notify();
        return true;
      } catch { return false; }
    },
  };

  SYSTEM_DARK.addEventListener('change', () => { if (settings.preset === 'system') { apply(); notify(); } });
  apply();
  (api as Appearance & { blockOverrides: () => Record<string, string> }).blockOverrides = () =>
    Object.fromEntries(Object.entries(settings.blocks).map(([key, colour]) => [defaultColours[key], colour]).filter(([k]) => k));
  return api;
}

/** Default colour → chosen colour, for the engine's setColourOverrides. */
export const blockOverrides = (a: Appearance): Record<string, string> =>
  (a as Appearance & { blockOverrides: () => Record<string, string> }).blockOverrides();

// ---------------------------------------------------------------------------------------
// The Look panel
// ---------------------------------------------------------------------------------------
type ColourGroup = 'colours' | 'syntax' | 'blocks';
/** UI colours in the order Inspect tries them (the most specific surfaces first). */
const INSPECT_ORDER: UiColour[] = ['chrome', 'bar', 'panel', 'panel2', 'codeBg', 'bg', 'accent', 'ok', 'warn', 'bad', 'ink', 'muted', 'line', 'accentInk'];

export function mountAppearancePanel(opts: { B: BlocklyNS; ws: InstanceType<BlocklyNS['WorkspaceSvg']>; V: Engine; layout: Layout; appearance: Appearance }): void {
  const { B, ws, V, layout, appearance: A } = opts;
  const body = layout.body('appearance');
  const s = () => A.settings();
  const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const startRenderer = s().renderer; // the renderer the workspace was started with
  const startStyle = s().blockStyle;
  const startWords = s().blockWords;
  const blockColour = (k: string) => s().blocks[k] ?? (V.COLORS as Record<string, string>)[k];

  let mode: 'settings' | 'json' = 'settings';
  let query = '';
  let changedOnly = false;
  const openSecs = new Set<string>(['theme']);

  body.innerHTML = `<div class="ap">
    <div class="ap-tools">
      <label class="ap-search">${ICONS.search}<input type="search" id="ap-q" placeholder="Search settings" aria-label="Search settings" spellcheck="false" autocomplete="off"></label>
      <div class="ap-toolrow">
        <div class="ap-tabs" role="tablist" aria-label="Show settings as">
          <button role="tab" data-mode="settings" aria-selected="true">Settings</button><button role="tab" data-mode="json" aria-selected="false">JSON</button>
        </div>
        <button class="ap-toggle" id="ap-changed" aria-pressed="false" title="Show only the settings you have changed">Changed only</button>
        <button class="ap-toggle" id="ap-inspect" aria-pressed="false" title="Click any part of the app to find the colour that paints it">Inspect</button>
      </div>
    </div>
    <div class="ap-list"></div>
  </div>`;
  const list = body.querySelector('.ap-list') as HTMLElement;
  const searchBox = body.querySelector('#ap-q') as HTMLInputElement;

  // ---------- building blocks: every setting is an "item" that search and Changed only can find ----------
  const changed = (k: keyof AppearanceSettings) => JSON.stringify(s()[k]) !== JSON.stringify(DEFAULTS[k]);
  const item = (key: string, words: string, isChanged: boolean, inner: string) =>
    `<div class="ap-item" data-key="${esc(key)}" data-search="${esc(words.toLowerCase())}" data-changed="${isChanged ? 1 : 0}">${inner}</div>`;
  const select = (id: string, options: Array<[string, string]>, value: string, attrs = '') =>
    `<select id="${id}"${attrs}>${options.map(([v, l]) => `<option value="${esc(v)}"${v === value ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
  const slider = (id: string, min: number, max: number, step: number, value: number, unit = '') =>
    `<span class="ap-slider"><input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${value}"><output for="${id}">${value}${unit}</output></span>`;
  const row = (key: keyof AppearanceSettings, label: string, control: string, note = '') =>
    item(key, `${label} ${note}`, changed(key), `<label class="ap-row"><span>${esc(label)}</span>${control}</label>${note ? `<p class="ap-note">${esc(note)}</p>` : ''}`);
  const check = (key: keyof AppearanceSettings, id: string, label: string, on: boolean, disabled = false) =>
    item(key, label, changed(key), `<label class="ap-row ap-check"><input type="checkbox" id="${id}"${on ? ' checked' : ''}${disabled ? ' disabled' : ''}><span>${esc(label)}</span></label>`);
  const colourRow = (group: ColourGroup, key: string, label: string, value: string, isChanged: boolean) =>
    item(`${group}:${key}`, `${label} colour color`, isChanged, `<label class="ap-colour"><input type="color" data-group="${group}" data-key="${key}" value="${value}"><span>${esc(label)}</span>${isChanged ? `<button class="ap-undo" data-group="${group}" data-key="${key}" title="Back to the theme's colour" aria-label="Reset ${esc(label)}">${ICONS.reset}</button>` : ''}</label>`);

  function sections(): string {
    const st = s(), p = A.palette();
    const sec = (id: string, title: string, items: string[]) =>
      `<details data-sec="${id}" data-title="${esc(title.toLowerCase())}"${openSecs.has(id) ? ' open' : ''}><summary>${ICONS.chevron}<span>${title}</span></summary><div class="ap-sec">${items.join('')}</div></details>`;
    const themeIds = Object.keys(PRESETS).filter(id => id !== 'system');
    const shownPreset = st.preset === 'system' ? (SYSTEM_DARK.matches ? 'graphite' : 'daylight') : st.preset;
    const themeDefaultAccent = PRESETS[st.preset].palette().accent.toLowerCase();
    return [
      sec('theme', 'Theme and accent', [
        item('preset', 'theme graphite midnight daylight warm high contrast dark light', changed('preset'),
          `<div class="ap-presets" role="group" aria-label="Theme">${themeIds.map((id) => {
            const pal = PRESETS[id].palette();
            return `<button class="ap-preset" data-preset="${id}" aria-pressed="${shownPreset === id}"><span class="sw" style="background:${pal.panel};border-color:${pal.line}"><i style="background:${pal.accent}"></i><i style="background:${pal.syntax.kw}"></i><i style="background:${pal.syntax.str}"></i><i style="background:${pal.syntax.type}"></i></span>${esc(PRESETS[id].label)}</button>`;
          }).join('')}</div>`),
        item('colours:accent', 'accent colour color highlight', 'accent' in st.colours,
          `<div class="ap-accents" role="group" aria-label="Accent colour">${ACCENTS.map(c => `<button class="ap-swatch" data-accent="${c}" style="--sw:${c}" aria-pressed="${p.accent.toLowerCase() === c.toLowerCase()}" aria-label="Accent ${c}" title="${c}"></button>`).join('')}<label class="ap-swatch ap-swatch-custom" title="Any colour"><input type="color" id="ap-accent" value="${p.accent}" aria-label="Pick any accent colour"></label>${'accent' in st.colours && st.colours.accent!.toLowerCase() !== themeDefaultAccent ? `<button class="ap-undo" data-group="colours" data-key="accent" title="Back to the theme's accent" aria-label="Reset accent">${ICONS.reset}</button>` : ''}</div>`),
        check('preset', 'ap-system', 'Match my device (Graphite when dark, Daylight when light)', st.preset === 'system'),
      ]),
      sec('layout', 'Layout and panels', [
        row('layout', 'Blocks layout', select('ap-layout', [['document', 'Like text (top to bottom)'], ['canvas', 'Free canvas']], st.layout),
          '"Like text" lines blocks up in one column that scrolls like code, so Blocks and Text feel like the same page.'),
        row('blockStyle', 'Block look', select('ap-bstyle', [['text', 'Like text (outlines, code font)'], ['classic', 'Classic (solid)']], st.blockStyle)),
        row('blockWords', 'Block words', select('ap-bwords', [['friendly', 'Friendly (print, when called…)'], ['code', 'Verse code (Print(, OnBegin…)']], st.blockWords)),
        row('blockScale', 'Block size', slider('ap-bscale', 0.5, 1.6, 0.05, st.blockScale, '×')),
        ...(st.blockStyle === 'classic' ? [
          row('blockFont', 'Block font', select('ap-bfont', [['code', 'Same as code'], ['ui', 'Same as interface']], st.blockFont)),
          row('renderer', 'Block shape', select('ap-renderer', [['zelos', 'Rounded'], ['geras', 'Classic'], ['thrasos', 'Simple']], st.renderer)),
        ] : []),
        ...(st.renderer !== startRenderer || st.blockStyle !== startStyle || st.blockWords !== startWords
          ? [item('reload', 'reload block look words shape', true, '<p class="ap-note">Block look, words and shape change after a reload. <button class="btn" id="ap-reload">Reload now</button></p>')] : []),
        check('grid', 'ap-grid', st.layout === 'document' ? 'Dot grid (free canvas only)' : 'Dot grid', st.grid, st.layout === 'document'),
        ...PANEL_IDS.map(id => item(`side:${id}`, `${PANEL_TITLES[id]} panel side left right`, false,
          `<label class="ap-row"><span>${PANEL_TITLES[id]} panel</span>${select(`ap-side-${id}`, [['left', 'Left side'], ['right', 'Right side']], layout.sideOf(id), ` data-panel-side="${id}"`)}</label>`)),
      ]),
      sec('files', 'Tabs and files', [
        check('fileDots', 'ap-dots', 'Dots on files with problems (red: needs fixing, amber: style notes)', st.fileDots),
        check('fileExt', 'ap-ext', 'Show .verse after tab names', st.fileExt),
      ]),
      sec('feel', 'Feel', [
        row('radius', 'Corner roundness', slider('ap-radius', 0, 2, 0.1, st.radius, '×')),
        row('density', 'Spacing', select('ap-density', [['compact', 'Compact'], ['comfortable', 'Comfortable'], ['spacious', 'Spacious']], st.density)),
        check('motion', 'ap-motion', 'Animations', st.motion),
      ]),
      sec('text', 'Text and fonts', [
        row('uiFont', 'Interface font', select('ap-uifont', Object.keys(UI_FONTS).map(f => [f, f]), st.uiFont)),
        row('uiScale', 'Interface size', slider('ap-uiscale', 0.85, 1.35, 0.05, st.uiScale, '×')),
        row('codeFont', 'Code font', select('ap-codefont', Object.keys(CODE_FONTS).map(f => [f, f]), st.codeFont)),
        row('codeSize', 'Code size', slider('ap-codesize', 11, 22, 0.5, st.codeSize, 'px')),
        row('lineHeight', 'Line spacing', slider('ap-lh', 1.3, 2.1, 0.05, st.lineHeight)),
      ]),
      sec('chrome', 'App chrome colors', UI_COLOURS.map(k => colourRow('colours', k, UI_LABELS[k], p[k], k in st.colours))),
      sec('code', 'Code colors', SYNTAX_COLOURS.map(k => colourRow('syntax', k, SYNTAX_LABELS[k], p.syntax[k], k in st.syntax))),
      sec('blocks', 'Block colors', BLOCK_CATEGORIES.map(([k, label]) => colourRow('blocks', k, label, blockColour(k), k in st.blocks))),
      sec('share', 'Save and share', [
        item('share', 'save share copy paste code import export reset', false, `
          <p class="ap-note">Copy this code to keep your look or share it. Paste someone's code to use theirs.</p>
          <textarea id="ap-code" rows="3" aria-label="Look code">${A.exportCode()}</textarea>
          <div class="ap-buttons"><button class="btn" id="ap-copy">Copy</button><button class="btn" id="ap-import">Use pasted code</button></div>
          <div class="ap-buttons"><button class="btn" id="ap-reset">Reset everything to default</button></div>`),
      ]),
    ].join('');
  }

  function render() {
    body.querySelectorAll<HTMLElement>('.ap-tabs [data-mode]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.mode === mode)));
    searchBox.disabled = mode === 'json';
    if (mode === 'json') {
      const shown = changedOnly ? Object.fromEntries(Object.entries(s()).filter(([k]) => changed(k as keyof AppearanceSettings))) : s();
      list.innerHTML = `<div class="ap-json">
        <p class="ap-note">${changedOnly ? 'The settings you have changed' : 'Every setting'}, as JSON. Edit, then Apply: anything left out goes back to its default.</p>
        <textarea id="ap-json" rows="18" spellcheck="false" aria-label="Settings as JSON">${esc(JSON.stringify(shown, null, 2))}</textarea>
        <p class="ap-err" id="ap-json-err" hidden></p>
        <div class="ap-buttons"><button class="btn btn-primary" id="ap-json-apply">Apply</button><button class="btn" id="ap-json-revert">Revert</button></div>
      </div>`;
      return;
    }
    list.innerHTML = sections() + '<p class="ap-empty" hidden></p>';
    filter();
  }

  /** Search and Changed only: hide what doesn't match, open sections that have matches. */
  function filter() {
    if (mode !== 'settings') return;
    const q = query.trim().toLowerCase(), filtering = !!q || changedOnly;
    let shown = 0;
    list.querySelectorAll<HTMLDetailsElement>('details').forEach(d => {
      let n = 0;
      d.querySelectorAll<HTMLElement>('.ap-item').forEach(it => {
        const ok = (!q || it.dataset.search!.includes(q) || d.dataset.title!.includes(q)) && (!changedOnly || it.dataset.changed === '1');
        it.hidden = !ok;
        if (ok) n++;
      });
      d.hidden = filtering && n === 0;
      d.open = filtering ? n > 0 : openSecs.has(d.dataset.sec!);
      shown += n;
    });
    const empty = list.querySelector('.ap-empty') as HTMLElement;
    empty.hidden = !filtering || shown > 0;
    empty.textContent = changedOnly && !q ? "You haven't changed any settings yet." : 'No settings match.';
  }
  list.addEventListener('toggle', (e) => {
    const d = e.target as HTMLDetailsElement;
    if (!d.dataset?.sec || query || changedOnly) return;
    if (d.open) openSecs.add(d.dataset.sec); else openSecs.delete(d.dataset.sec);
  }, true);

  // ---------- the toolbar: search, Settings / JSON, Changed only, Inspect ----------
  searchBox.addEventListener('input', () => { query = searchBox.value; filter(); });
  body.querySelector('.ap-tools')!.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('button');
    if (!btn) return;
    if (btn.dataset.mode) { mode = btn.dataset.mode as typeof mode; render(); }
    if (btn.id === 'ap-changed') { changedOnly = !changedOnly; btn.setAttribute('aria-pressed', String(changedOnly)); render(); }
    if (btn.id === 'ap-inspect') setInspect(!inspecting);
  });

  // ---------- changes: one listener each for live input, committed changes, and buttons ----------
  list.addEventListener('input', (e) => {
    const t = e.target as HTMLInputElement;
    const out = t.parentElement?.querySelector('output');
    if (t.type === 'range' && out) out.textContent = t.value + (out.textContent?.replace(/^[\d.]+/, '') ?? '');
    const n = Number(t.value);
    if (t.id === 'ap-bscale') { A.set({ blockScale: n }); ws.setScale(n); }
    if (t.id === 'ap-uiscale') A.set({ uiScale: n });
    if (t.id === 'ap-codesize') A.set({ codeSize: n });
    if (t.id === 'ap-lh') A.set({ lineHeight: n });
    if (t.id === 'ap-radius') A.set({ radius: n });
    if (t.id === 'ap-accent') A.set({ colours: { ...s().colours, accent: t.value } });
    if (t.type === 'color' && t.dataset.group) {
      const group = t.dataset.group as ColourGroup;
      A.set({ [group]: { ...s()[group], [t.dataset.key!]: t.value } } as Partial<AppearanceSettings>);
    }
  });
  list.addEventListener('change', (e) => {
    const t = e.target as HTMLInputElement & HTMLSelectElement;
    // The share and JSON boxes are only read when their buttons are clicked; redrawing here would
    // replace what was pasted before that click lands.
    if (t.tagName === 'TEXTAREA') return;
    if (t.dataset.panelSide) { layout.setSide(t.dataset.panelSide as PanelId, t.value as Side); return; }
    if (t.id === 'ap-layout') A.set({ layout: t.value as AppearanceSettings['layout'] });
    if (t.id === 'ap-bfont') A.set({ blockFont: t.value as AppearanceSettings['blockFont'] });
    if (t.id === 'ap-bstyle') A.set({ blockStyle: t.value as AppearanceSettings['blockStyle'] });
    if (t.id === 'ap-bwords') A.set({ blockWords: t.value as AppearanceSettings['blockWords'] });
    if (t.id === 'ap-renderer') A.set({ renderer: t.value as AppearanceSettings['renderer'] });
    if (t.id === 'ap-uifont') A.set({ uiFont: t.value });
    if (t.id === 'ap-codefont') A.set({ codeFont: t.value });
    if (t.id === 'ap-density') A.set({ density: t.value as AppearanceSettings['density'] });
    if (t.id === 'ap-grid') A.set({ grid: t.checked });
    if (t.id === 'ap-motion') A.set({ motion: t.checked });
    if (t.id === 'ap-dots') A.set({ fileDots: t.checked });
    if (t.id === 'ap-ext') A.set({ fileExt: t.checked });
    if (t.id === 'ap-system') A.set({ preset: t.checked ? 'system' : (SYSTEM_DARK.matches ? 'graphite' : 'daylight'), colours: {}, syntax: {} });
    render(); // re-render to show reset buttons and keep every control in sync
  });
  list.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('button');
    if (!btn) return;
    if (btn.dataset.preset) { A.set({ preset: btn.dataset.preset, colours: {}, syntax: {} }); render(); }
    if (btn.dataset.accent) {
      const isThemes = btn.dataset.accent.toLowerCase() === PRESETS[s().preset].palette().accent.toLowerCase();
      const { accent: _old, ...rest } = s().colours;
      A.set({ colours: isThemes ? rest : { ...rest, accent: btn.dataset.accent } });
      render();
    }
    if (btn.classList.contains('ap-undo')) {
      const group = btn.dataset.group as ColourGroup;
      const next = { ...s()[group] } as Record<string, string>;
      delete next[btn.dataset.key!];
      A.set({ [group]: next } as Partial<AppearanceSettings>);
      render();
    }
    if (btn.id === 'ap-reload') location.reload();
    if (btn.id === 'ap-copy') {
      const ta = list.querySelector('#ap-code') as HTMLTextAreaElement;
      navigator.clipboard?.writeText(ta.value).catch(() => { ta.select(); document.execCommand('copy'); });
      btn.textContent = 'Copied';
    }
    if (btn.id === 'ap-import') {
      const ok = A.importCode((list.querySelector('#ap-code') as HTMLTextAreaElement).value);
      if (ok) ws.setScale(s().blockScale);
      render();
      if (!ok) (list.querySelector('#ap-code') as HTMLTextAreaElement).setAttribute('aria-invalid', 'true');
    }
    if (btn.id === 'ap-reset') {
      if (!btn.dataset.armed) { btn.dataset.armed = '1'; btn.textContent = 'Click again to reset everything'; return; }
      A.reset(); ws.setScale(s().blockScale); render();
    }
    if (btn.id === 'ap-json-apply') {
      const box = list.querySelector('#ap-json') as HTMLTextAreaElement, err = list.querySelector('#ap-json-err') as HTMLElement;
      try {
        const data = JSON.parse(box.value);
        if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('The settings must be one { … } object.');
        A.load(data);
        ws.setScale(s().blockScale);
        render();
      } catch (ex) {
        err.hidden = false;
        err.textContent = `Not applied: ${(ex as Error).message}`;
        box.setAttribute('aria-invalid', 'true');
      }
    }
    if (btn.id === 'ap-json-revert') render();
  });
  // The panel-side choices follow the layout (the panels' ⋯ menus can move them too).
  layout.onChange(() => list.querySelectorAll<HTMLSelectElement>('select[data-panel-side]').forEach(sel => { sel.value = layout.sideOf(sel.dataset.panelSide as PanelId); }));

  // ---------- Inspect: click any part of the app to find the colour that paints it ----------
  let inspecting = false;
  const box = document.createElement('div');
  box.className = 'inspect-box';
  box.innerHTML = '<span class="inspect-label"></span>';
  box.hidden = true;
  document.body.appendChild(box);
  const hexOf = (css: string): string | null => {
    const m = css.match(/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+%?))?\s*\)$/);
    if (!m || (m[4] !== undefined && parseFloat(m[4]) === 0)) return null;
    return '#' + [m[1], m[2], m[3]].map(n => Number(n).toString(16).padStart(2, '0')).join('').toUpperCase();
  };
  const SECTION_OF: Record<ColourGroup, string> = { colours: 'chrome', syntax: 'code', blocks: 'blocks' };
  type Found = { group: ColourGroup; key: string; label: string };
  function resolve(t: Element): Found | null {
    // A block, in the workspace or the Toolbox: its category's colour.
    const g = t.closest('g[data-id]');
    if (g && t.closest('.blocklySvg')) {
      const id = g.getAttribute('data-id')!;
      const blk = B.Workspace.getAll().map(w => w.getBlockById(id)).find(Boolean);
      const colour = blk?.getColour().toLowerCase();
      const hit = colour && BLOCK_CATEGORIES.find(([k]) => [blockColour(k), V.resolveColour((V.COLORS as Record<string, string>)[k])].some(c => String(c).toLowerCase() === colour));
      if (hit) return { group: 'blocks', key: hit[0], label: `Block colour: ${hit[1]}` };
    }
    const p = A.palette();
    // Code: the colour of the word under the pointer.
    if (t.closest('.cm-content')) {
      const c = hexOf(getComputedStyle(t).color);
      const k = SYNTAX_COLOURS.find(k => p.syntax[k].toUpperCase() === c);
      if (k) return { group: 'syntax', key: k, label: `Code colour: ${SYNTAX_LABELS[k]}` };
    }
    const uiKey = (c: string | null) => (c ? INSPECT_ORDER.find(k => p[k].toUpperCase() === c) : undefined);
    // Words: their text colour. Anything else: the nearest painted background.
    const hasText = [...t.childNodes].some(n => n.nodeType === Node.TEXT_NODE && n.textContent!.trim());
    if (hasText) {
      const k = uiKey(hexOf(getComputedStyle(t).color));
      if (k) return { group: 'colours', key: k, label: `Colour: ${UI_LABELS[k]}` };
    }
    for (let el: Element | null = t; el; el = el.parentElement) {
      const k = uiKey(hexOf(getComputedStyle(el).backgroundColor));
      if (k) return { group: 'colours', key: k, label: `Colour: ${UI_LABELS[k]}` };
    }
    return null;
  }
  const ignore = (t: Element) => !!t.closest('.inspect-box, #ap-inspect');
  function onMove(e: PointerEvent) {
    const t = e.target as Element;
    if (ignore(t)) { box.hidden = true; return; }
    const r = t.getBoundingClientRect();
    Object.assign(box.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
    (box.firstElementChild as HTMLElement).textContent = resolve(t)?.label ?? 'Not one of your colours';
    box.hidden = false;
  }
  function onPick(e: Event) {
    const t = e.target as Element;
    if (ignore(t)) return;
    e.preventDefault(); e.stopImmediatePropagation();
    const found = resolve(t);
    setInspect(false);
    if (!found) return;
    mode = 'settings'; query = ''; searchBox.value = ''; changedOnly = false;
    body.querySelector('#ap-changed')!.setAttribute('aria-pressed', 'false');
    openSecs.add(SECTION_OF[found.group]);
    render();
    layout.show('appearance');
    const el = list.querySelector<HTMLElement>(`.ap-item[data-key="${found.group}:${found.key}"]`);
    if (el) { el.scrollIntoView({ block: 'center' }); el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1600); (el.querySelector('input') as HTMLElement | null)?.focus({ preventScroll: true }); }
  }
  const swallow = (e: Event) => { if (!ignore(e.target as Element)) { e.preventDefault(); e.stopImmediatePropagation(); } };
  function onKey(e: KeyboardEvent) { if (e.key === 'Escape') { e.stopImmediatePropagation(); setInspect(false); } }
  function setInspect(on: boolean) {
    if (on === inspecting) return;
    inspecting = on;
    body.querySelector('#ap-inspect')!.setAttribute('aria-pressed', String(on));
    document.body.classList.toggle('inspecting', on);
    box.hidden = true;
    const fn = on ? window.addEventListener : window.removeEventListener;
    fn('pointermove', onMove as EventListener, true);
    fn('pointerdown', onPick, true);
    fn('click', swallow, true);
    fn('mousedown', swallow, true);
    fn('keydown', onKey as EventListener, true);
    // On a phone the Look sheet covers the app: put it away while you pick.
    if (on && document.body.classList.contains('narrow')) layout.closeOverlay();
  }

  // Keep the workspace in step with the settings.
  A.onChange(() => {
    ws.setTheme(A.theme(B));
    V.setColourOverrides(blockOverrides(A));
    V.recolourBlocks(ws);
    // Only after the engine has the new colours: let the Toolbox repaint its chips.
    document.dispatchEvent(new CustomEvent('verse:colours'));
  });
  render();
}
