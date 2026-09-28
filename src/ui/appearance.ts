/**
 * Appearance ("Edit Mode"): every visual setting, applied live and saved in the browser.
 *
 *  - Presets set all colours at once; any colour can then be changed individually.
 *  - Colours, fonts and sizes become CSS variables on <html> (see styles/appearance.css).
 *  - The block workspace gets a Blockly theme built from the same settings.
 *  - Block category colours go to the engine (setColourOverrides) and recolour blocks live.
 *  - Block shape (renderer) is chosen when the workspace starts, so it applies after a reload.
 */
import type Blockly from '../engine/blockly.ts';
import type { Engine } from '../engine/index.ts';
import type { Layout } from './layout.ts';

type BlocklyNS = typeof Blockly;

// ---------------------------------------------------------------------------------------
// Settings model
// ---------------------------------------------------------------------------------------
export const UI_COLOURS = ['bg', 'panel', 'panel2', 'line', 'ink', 'muted', 'accent', 'accentInk', 'ok', 'warn', 'codeBg'] as const;
export const SYNTAX_COLOURS = ['kw', 'var', 'str', 'num', 'spec', 'type', 'fn', 'com'] as const;
type UiColour = typeof UI_COLOURS[number];
type SyntaxColour = typeof SYNTAX_COLOURS[number];
type Palette = Record<UiColour, string> & { syntax: Record<SyntaxColour, string>; dark: boolean };

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
}

const DEFAULTS: AppearanceSettings = {
  preset: 'system', colours: {}, syntax: {}, blocks: {},
  uiFont: 'Lexend', codeFont: 'JetBrains Mono', blockFont: 'code',
  blockStyle: 'text', blockWords: 'friendly',
  uiScale: 1, codeSize: 13.5, lineHeight: 1.65, blockScale: 1,
  layout: 'document', renderer: 'zelos', grid: false,
  radius: 1, density: 'comfortable', motion: true,
};

const MIDNIGHT: Palette = {
  dark: true, bg: '#13112A', panel: '#1B1834', panel2: '#24204A', line: '#34305C', ink: '#EFEBFF', muted: '#A7A1CE',
  accent: '#9480FF', accentInk: '#13112A', ok: '#4CC98A', warn: '#F0B04E', codeBg: '#100E22',
  syntax: { kw: '#5ED39A', var: '#F59A5E', str: '#D69BF0', num: '#5AD1CB', spec: '#F2C063', type: '#6CC0F2', fn: '#F2B36B', com: '#7D78A3' },
};
const DAYLIGHT: Palette = {
  dark: false, bg: '#F4F2FC', panel: '#FFFFFF', panel2: '#EFECFA', line: '#DCD7F0', ink: '#1E1A38', muted: '#5E5980',
  accent: '#6A50F0', accentInk: '#FFFFFF', ok: '#22885A', warn: '#B8741A', codeBg: '#FBFAFF',
  syntax: { kw: '#2E8A5C', var: '#C4621F', str: '#9A4FBA', num: '#1F8A85', spec: '#B07A12', type: '#2379B4', fn: '#B45A12', com: '#8C88A6' },
};
const HIGH_CONTRAST: Palette = {
  dark: true, bg: '#000000', panel: '#0A0A0A', panel2: '#1A1A1A', line: '#8A8A8A', ink: '#FFFFFF', muted: '#D6D6D6',
  accent: '#FFD400', accentInk: '#000000', ok: '#3CFF8F', warn: '#FFB020', codeBg: '#000000',
  syntax: { kw: '#7CFFB2', var: '#FFB86B', str: '#FF9CF0', num: '#6CF0FF', spec: '#FFE36E', type: '#8CCBFF', fn: '#FFC98B', com: '#C8C8C8' },
};
const WARM: Palette = {
  dark: true, bg: '#1C1410', panel: '#241A15', panel2: '#30231C', line: '#4A3529', ink: '#F7EDE4', muted: '#C9B3A2',
  accent: '#F29A4A', accentInk: '#1C1410', ok: '#7BCB7A', warn: '#F2C14E', codeBg: '#17100C',
  syntax: { kw: '#9ED67E', var: '#F7A36B', str: '#E8A0C8', num: '#7FD3C4', spec: '#F2C866', type: '#8EC2EA', fn: '#F5B97A', com: '#9C8676' },
};
const SYSTEM_DARK = window.matchMedia('(prefers-color-scheme: dark)');
export const PRESETS: Record<string, { label: string; palette: () => Palette }> = {
  system: { label: 'Follow system', palette: () => (SYSTEM_DARK.matches ? MIDNIGHT : DAYLIGHT) },
  midnight: { label: 'Midnight', palette: () => MIDNIGHT },
  daylight: { label: 'Daylight', palette: () => DAYLIGHT },
  contrast: { label: 'High contrast', palette: () => HIGH_CONTRAST },
  warm: { label: 'Warm', palette: () => WARM },
};

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
  ['data', 'Lists & Maps'], ['funcs', 'Functions'], ['time', 'Time'], ['comment', 'Comments'], ['raw', 'Raw Verse'],
];
const UI_LABELS: Record<UiColour, string> = {
  bg: 'Page background', panel: 'Panels', panel2: 'Soft fill', line: 'Borders', ink: 'Text', muted: 'Secondary text',
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

  const palette = (): Palette => {
    const base = PRESETS[settings.preset].palette();
    return { ...base, ...settings.colours, syntax: { ...base.syntax, ...settings.syntax } };
  };

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
      bg: '--bg', panel: '--panel', panel2: '--panel2', line: '--line', ink: '--ink', muted: '--muted',
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
// The Appearance panel
// ---------------------------------------------------------------------------------------
export function mountAppearancePanel(opts: { B: BlocklyNS; ws: InstanceType<BlocklyNS['WorkspaceSvg']>; V: Engine; layout: Layout; appearance: Appearance }): void {
  const { B, ws, V, layout, appearance: A } = opts;
  const body = layout.body('appearance');
  const s = () => A.settings();
  const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const startRenderer = s().renderer; // the renderer the workspace was started with
  const startStyle = s().blockStyle;
  const startWords = s().blockWords;

  const select = (id: string, options: Array<[string, string]>, value: string) =>
    `<select id="${id}">${options.map(([v, l]) => `<option value="${esc(v)}"${v === value ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
  const slider = (id: string, min: number, max: number, step: number, value: number, unit = '') =>
    `<span class="ap-slider"><input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${value}"><output for="${id}">${value}${unit}</output></span>`;
  const colourRow = (group: string, key: string, label: string, value: string, changed: boolean) =>
    `<label class="ap-colour"><input type="color" data-group="${group}" data-key="${key}" value="${value}"><span>${esc(label)}</span>${changed ? `<button class="ap-undo" data-group="${group}" data-key="${key}" title="Back to the preset colour" aria-label="Reset ${esc(label)}">↺</button>` : ''}</label>`;

  function paletteNow() {
    const base = PRESETS[s().preset].palette();
    return { ...base, ...s().colours, syntax: { ...base.syntax, ...s().syntax } };
  }

  function render() {
    const st = s(), p = paletteNow();
    const open = new Set([...body.querySelectorAll('details[open]')].map(d => (d as HTMLElement).dataset.sec));
    if (!body.childElementCount) open.add('look');
    const sec = (id: string, title: string, inner: string) =>
      `<details data-sec="${id}"${open.has(id) ? ' open' : ''}><summary>${title}</summary><div class="ap-sec">${inner}</div></details>`;
    body.innerHTML = `<div class="ap">
      <p class="ap-intro">Change how Verse Blocks looks. Everything applies right away and is saved on this device.</p>
      ${sec('look', 'Theme', `
        <div class="ap-presets">${Object.entries(PRESETS).map(([id, pr]) => {
          const pal = pr.palette();
          return `<button class="ap-preset" data-preset="${id}" aria-pressed="${st.preset === id}">
            <span class="sw" style="background:${pal.bg};border-color:${pal.line}"><i style="background:${pal.accent}"></i><i style="background:${pal.syntax.kw}"></i><i style="background:${pal.syntax.str}"></i></span>${esc(pr.label)}</button>`;
        }).join('')}</div>`)}
      ${sec('editor', 'Blocks & editor', `
        <label class="ap-row"><span>Blocks layout</span>${select('ap-layout', [['document', 'Like text (top to bottom)'], ['canvas', 'Free canvas']], st.layout)}</label>
        <p class="ap-note">"Like text" lines blocks up in one column that scrolls like code, so Blocks and Text feel like the same page.</p>
        <label class="ap-row"><span>Block look</span>${select('ap-bstyle', [['text', 'Like text (outlines, code font)'], ['classic', 'Classic (solid)']], st.blockStyle)}</label>
        <label class="ap-row"><span>Block words</span>${select('ap-bwords', [['friendly', 'Friendly (print, when called…)'], ['code', 'Verse code (Print(, OnBegin…)']], st.blockWords)}</label>
        <label class="ap-row"><span>Block size</span>${slider('ap-bscale', 0.5, 1.6, 0.05, st.blockScale, '×')}</label>
        ${st.blockStyle === 'classic' ? `<label class="ap-row"><span>Block font</span>${select('ap-bfont', [['code', 'Same as code'], ['ui', 'Same as interface']], st.blockFont)}</label>
        <label class="ap-row"><span>Block shape</span>${select('ap-renderer', [['zelos', 'Rounded'], ['geras', 'Classic'], ['thrasos', 'Simple']], st.renderer)}</label>` : ''}
        ${st.renderer !== startRenderer || st.blockStyle !== startStyle || st.blockWords !== startWords ? '<p class="ap-note">Block look, words and shape change after a reload. <button class="btn" id="ap-reload">Reload now</button></p>' : ''}
        <label class="ap-row ap-check"><input type="checkbox" id="ap-grid"${st.grid ? ' checked' : ''}${st.layout === 'document' ? ' disabled' : ''}><span>Dot grid${st.layout === 'document' ? ' (free canvas only)' : ''}</span></label>`)}
      ${sec('text', 'Text & fonts', `
        <label class="ap-row"><span>Interface font</span>${select('ap-uifont', Object.keys(UI_FONTS).map(f => [f, f]), st.uiFont)}</label>
        <label class="ap-row"><span>Interface size</span>${slider('ap-uiscale', 0.85, 1.35, 0.05, st.uiScale, '×')}</label>
        <label class="ap-row"><span>Code font</span>${select('ap-codefont', Object.keys(CODE_FONTS).map(f => [f, f]), st.codeFont)}</label>
        <label class="ap-row"><span>Code size</span>${slider('ap-codesize', 11, 22, 0.5, st.codeSize, 'px')}</label>
        <label class="ap-row"><span>Line spacing</span>${slider('ap-lh', 1.3, 2.1, 0.05, st.lineHeight)}</label>`)}
      ${sec('colours', 'Interface colours', UI_COLOURS.map(k => colourRow('colours', k, UI_LABELS[k], p[k], k in st.colours)).join(''))}
      ${sec('syntax', 'Code colours', SYNTAX_COLOURS.map(k => colourRow('syntax', k, SYNTAX_LABELS[k], p.syntax[k], k in st.syntax)).join(''))}
      ${sec('blocks', 'Block colours', BLOCK_CATEGORIES.map(([k, label]) => colourRow('blocks', k, label, st.blocks[k] ?? (V.COLORS as Record<string, string>)[k], k in st.blocks)).join(''))}
      ${sec('shape', 'Shape & spacing', `
        <label class="ap-row"><span>Corner roundness</span>${slider('ap-radius', 0, 2, 0.1, st.radius, '×')}</label>
        <label class="ap-row"><span>Spacing</span>${select('ap-density', [['compact', 'Compact'], ['comfortable', 'Comfortable'], ['spacious', 'Spacious']], st.density)}</label>
        <label class="ap-row ap-check"><input type="checkbox" id="ap-motion"${st.motion ? ' checked' : ''}><span>Animations</span></label>`)}
      ${sec('share', 'Save & share your look', `
        <p class="ap-note">Copy this code to keep your look or share it. Paste someone's code to use theirs.</p>
        <textarea id="ap-code" rows="3" aria-label="Appearance code">${A.exportCode()}</textarea>
        <div class="ap-buttons"><button class="btn" id="ap-copy">Copy</button><button class="btn" id="ap-import">Use pasted code</button></div>
        <div class="ap-buttons"><button class="btn" id="ap-reset">Reset everything to default</button></div>`)}
    </div>`;
  }

  // One listener for everything (the panel re-renders after each change).
  body.addEventListener('input', (e) => {
    const t = e.target as HTMLInputElement;
    const out = t.parentElement?.querySelector('output');
    if (t.type === 'range' && out) out.textContent = t.value + (out.textContent?.replace(/^[\d.]+/, '') ?? '');
    const n = Number(t.value);
    if (t.id === 'ap-bscale') { A.set({ blockScale: n }); ws.setScale(n); }
    if (t.id === 'ap-uiscale') A.set({ uiScale: n });
    if (t.id === 'ap-codesize') A.set({ codeSize: n });
    if (t.id === 'ap-lh') A.set({ lineHeight: n });
    if (t.id === 'ap-radius') A.set({ radius: n });
    if (t.type === 'color') {
      const group = t.dataset.group as 'colours' | 'syntax' | 'blocks';
      A.set({ [group]: { ...s()[group], [t.dataset.key!]: t.value } } as Partial<AppearanceSettings>);
    }
  });
  body.addEventListener('change', (e) => {
    const t = e.target as HTMLInputElement & HTMLSelectElement;
    // The share box is only read when "Use pasted code" is clicked; redrawing here would
    // replace the pasted code before that click lands.
    if (t.tagName === 'TEXTAREA') return;
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
    render(); // re-render to show ↺ buttons and keep every control in sync
  });
  body.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('button');
    if (!btn) return;
    if (btn.dataset.preset) { A.set({ preset: btn.dataset.preset, colours: {}, syntax: {} }); render(); }
    if (btn.classList.contains('ap-undo')) {
      const group = btn.dataset.group as 'colours' | 'syntax' | 'blocks';
      const next = { ...s()[group] } as Record<string, string>;
      delete next[btn.dataset.key!];
      A.set({ [group]: next } as Partial<AppearanceSettings>);
      render();
    }
    if (btn.id === 'ap-reload') location.reload();
    if (btn.id === 'ap-copy') {
      const ta = body.querySelector('#ap-code') as HTMLTextAreaElement;
      navigator.clipboard?.writeText(ta.value).catch(() => { ta.select(); document.execCommand('copy'); });
      btn.textContent = 'Copied';
    }
    if (btn.id === 'ap-import') {
      const ok = A.importCode((body.querySelector('#ap-code') as HTMLTextAreaElement).value);
      if (ok) ws.setScale(s().blockScale);
      render();
      if (!ok) (body.querySelector('#ap-code') as HTMLTextAreaElement).setAttribute('aria-invalid', 'true');
    }
    if (btn.id === 'ap-reset') {
      if (!btn.dataset.armed) { btn.dataset.armed = '1'; btn.textContent = 'Click again to reset everything'; return; }
      A.reset(); ws.setScale(s().blockScale); render();
    }
  });

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
