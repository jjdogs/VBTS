/**
 * Layout manager: side panels around the editor, like a code editor's side bars.
 *
 *  - Each panel lives on the left or right side. Each side has an activity bar of icons and
 *    shows one panel at a time; clicking the open panel's icon hides it.
 *  - A panel moves to the other side from its ⋯ menu (or Look → Layout and panels).
 *  - Panel widths and the blocks/code split can be resized; double-click a divider to reset.
 *  - When the window is too narrow for the open panels, they float over the editor instead.
 *  - Phones: a bottom tab bar, and the chosen panel opens as a sheet from the bottom.
 *  - The layout is saved in the browser.
 */
import { ICONS } from './icons.ts';
import { closeMenu, openMenu } from './menu.ts';

export type PanelId = 'files' | 'toolbox' | 'learn' | 'appearance';
export type Side = 'left' | 'right';

interface LayoutState {
  side: Record<PanelId, Side>;
  /** The panel shown on each side (null = that side is closed). */
  open: Record<Side, PanelId | null>;
  widths: Record<PanelId, number>;
  /** The code pane's share of the editor in split view (0–1). */
  codeFraction: number;
}

export const PANEL_IDS: PanelId[] = ['files', 'toolbox', 'learn', 'appearance'];
export const PANEL_TITLES: Record<PanelId, string> = { files: 'Files', toolbox: 'Toolbox', learn: 'Learn', appearance: 'Look' };
const PANEL_ICONS: Record<PanelId, string> = { files: ICONS.files, toolbox: ICONS.toolbox, learn: ICONS.learn, appearance: ICONS.look };
const DEFAULTS: LayoutState = {
  side: { files: 'left', toolbox: 'left', learn: 'left', appearance: 'right' },
  open: { left: 'toolbox', right: null },
  widths: { files: 260, toolbox: 300, learn: 320, appearance: 340 },
  codeFraction: 0.44,
};
const LIMITS: Record<PanelId, [min: number, max: number]> = { files: [200, 440], toolbox: [220, 520], learn: [240, 560], appearance: [280, 520] };
const BAR_WIDTH = 48;
/** Narrowest usable editor, in split view (blocks + code) and in Blocks or Text view. */
const MIN_STAGE_SPLIT = 720;
const MIN_STAGE_SINGLE = 420;
/** Split view stacks vertically when the editor is narrower than this and at least this tall. */
const STACK_BELOW_WIDTH = 640;
const STACK_MIN_HEIGHT = 480;
const NARROW = window.matchMedia('(max-width: 900px)');
const KEY = 'verse-blocks:layout:v2';

function load(): LayoutState {
  const state = structuredClone(DEFAULTS);
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!saved) return state;
    for (const id of PANEL_IDS) {
      if (saved.side?.[id] === 'left' || saved.side?.[id] === 'right') state.side[id] = saved.side[id];
      const w = saved.widths?.[id];
      if (typeof w === 'number' && isFinite(w)) state.widths[id] = clamp(w, LIMITS[id]);
    }
    for (const side of ['left', 'right'] as const) {
      const id = saved.open?.[side];
      state.open[side] = PANEL_IDS.includes(id) && state.side[id as PanelId] === side ? id : null;
    }
    if (typeof saved.codeFraction === 'number') state.codeFraction = Math.min(0.8, Math.max(0.2, saved.codeFraction));
  } catch { /* use the defaults */ }
  return state;
}

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const clamp = (v: number, [lo, hi]: [number, number]) => Math.min(hi, Math.max(lo, v));

export interface Layout {
  /** Shows a panel: opens it on its side (or as the sheet on a phone). */
  show(id: PanelId): void;
  /** Hides a panel if it is open. */
  hide(id: PanelId): void;
  /** Closes panels that float over the editor (narrow windows, phones). */
  closeOverlay(): void;
  /** The body element of a panel, to put content in. */
  body(id: PanelId): HTMLElement;
  /** A slot in the panel's header for its own buttons (left of ⋯). */
  actions(id: PanelId): HTMLElement;
  isOpen(id: PanelId): boolean;
  sideOf(id: PanelId): Side;
  setSide(id: PanelId, side: Side): void;
  reset(): void;
  /** Called after any layout change (sides, open panels). */
  onChange(fn: () => void): void;
  /** The Toolbox's colour-chips mode (kept for the Toolbox panel; this layout never uses it). */
  onToolboxCompact(fn: (compact: boolean) => void): void;
  isCompact(): boolean;
}

export function createLayout(): Layout {
  let state = load();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode etc. */ } };
  const bars: Record<Side, HTMLElement> = { left: $('barLeft'), right: $('barRight') };
  const docks: Record<Side, HTMLElement> = { left: $('sideLeft'), right: $('sideRight') };
  const sheet = $('sheetHost'), bottomNav = $('bottomNav');
  const panels = {} as Record<PanelId, HTMLElement>;
  const listeners: Array<() => void> = [];
  /** Phones: the panel shown as a sheet (not saved). */
  let sheetOpen: PanelId | null = null;
  /** Sides whose panel floats over the editor because the window is too narrow (not saved). */
  const floating = new Set<Side>();

  const isNarrow = () => NARROW.matches;
  const isOpen = (id: PanelId) => (isNarrow() ? sheetOpen === id : state.open[state.side[id]] === id);

  /** Float the open panels (right side first) when the editor would get too narrow. */
  function makeRoom() {
    floating.clear();
    if (isNarrow()) return;
    const minStage = (document.body.dataset.view || 'blocks') === 'split' ? MIN_STAGE_SPLIT : MIN_STAGE_SINGLE;
    const room = () => window.innerWidth - (['left', 'right'] as const).reduce((sum, side) =>
      sum + (bars[side].hidden ? 0 : BAR_WIDTH) + (state.open[side] && !floating.has(side) ? state.widths[state.open[side]!] : 0), 0);
    // The right panel floats first; the left one only when even a single view would be cramped
    // (a cramped split view stacks blocks over code instead, see chooseSplitDirection).
    if (room() < minStage && state.open.right) floating.add('right');
    if (room() < MIN_STAGE_SINGLE && state.open.left) floating.add('left');
  }

  /** Split view stacks blocks over code only when the editor is narrow and tall. */
  function chooseSplitDirection() {
    const r = $('panes').getBoundingClientRect();
    document.body.dataset.split = r.width < STACK_BELOW_WIDTH && r.height >= STACK_MIN_HEIGHT ? 'column' : 'row';
  }

  // ---------- build panels ----------
  for (const id of PANEL_IDS) {
    const el = $(`panel-${id}`);
    panels[id] = el;
    const head = el.querySelector('.panel-head') as HTMLElement;
    head.innerHTML = `
      <h2 class="panel-title">${PANEL_TITLES[id]}</h2>
      <span class="panel-actions"></span>
      <button class="pb" data-act="menu" aria-label="${PANEL_TITLES[id]} panel options" aria-haspopup="menu" title="Panel options">${ICONS.more}</button>
      <button class="pb sheet-close" data-act="close" aria-label="Close ${PANEL_TITLES[id]}" title="Close">${ICONS.close}</button>`;
    head.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('button');
      if (btn?.dataset.act === 'menu') panelMenu(id, btn);
      if (btn?.dataset.act === 'close') hide(id);
    });
    const resizer = document.createElement('div');
    resizer.className = 'resizer';
    resizer.setAttribute('role', 'separator');
    resizer.setAttribute('aria-label', `Resize ${PANEL_TITLES[id]}`);
    el.appendChild(resizer);
    makeResizable(id, resizer);
  }

  function panelMenu(id: PanelId, anchor: HTMLElement) {
    const other: Side = state.side[id] === 'left' ? 'right' : 'left';
    openMenu(anchor, [
      ...(isNarrow() ? [] : [{ label: `Move to the ${other} side`, run: () => setSide(id, other) }]),
      { label: `Hide ${PANEL_TITLES[id]}`, run: () => hide(id) },
      'separator',
      { label: 'Reset layout', run: reset },
    ]);
  }

  // ---------- render: put every panel where the state says ----------
  function render() {
    const narrow = isNarrow();
    document.body.classList.toggle('narrow', narrow);
    for (const side of ['left', 'right'] as const) {
      const ids = PANEL_IDS.filter(id => state.side[id] === side);
      bars[side].hidden = narrow || ids.length === 0;
      bars[side].innerHTML = ids.map(id => activityButton(id, state.open[side] === id, false)).join('');
    }
    bottomNav.hidden = !narrow;
    bottomNav.innerHTML = PANEL_IDS.map(id => activityButton(id, sheetOpen === id, true)).join('');
    makeRoom();
    for (const side of ['left', 'right'] as const) {
      const dock = docks[side];
      const id = narrow ? null : state.open[side];
      dock.hidden = !id;
      dock.dataset.side = side;
      dock.classList.toggle('floating', floating.has(side));
      if (id) {
        dock.appendChild(panels[id]);
        dock.style.width = `${state.widths[id]}px`;
      }
    }
    sheet.hidden = !(narrow && sheetOpen);
    for (const id of PANEL_IDS) {
      const el = panels[id];
      if (narrow && el.parentElement !== sheet) sheet.appendChild(el);
      if (!narrow && !isOpen(id) && el.parentElement !== sheet) sheet.appendChild(el); // parked, hidden
      el.hidden = !isOpen(id);
      el.dataset.side = state.side[id];
    }
    applyCodeFraction();
    chooseSplitDirection();
    listeners.forEach(fn => fn());
  }

  function activityButton(id: PanelId, active: boolean, labelled: boolean) {
    return `<button class="ab" data-panel="${id}" aria-pressed="${active}" aria-label="${PANEL_TITLES[id]}" title="${PANEL_TITLES[id]}">${PANEL_ICONS[id]}${labelled ? `<span>${PANEL_TITLES[id]}</span>` : ''}</button>`;
  }
  for (const host of [bars.left, bars.right, bottomNav]) {
    host.addEventListener('click', (e) => {
      const id = (e.target as HTMLElement).closest('button')?.dataset.panel as PanelId | undefined;
      if (!id) return;
      if (isOpen(id)) hide(id); else show(id);
    });
  }

  function show(id: PanelId) {
    closeMenu();
    if (isNarrow()) sheetOpen = id;
    else { state.open[state.side[id]] = id; save(); }
    render();
    (panels[id].querySelector('.panel-body') as HTMLElement)?.focus({ preventScroll: true });
  }
  function hide(id: PanelId) {
    if (!isOpen(id)) return;
    if (isNarrow()) sheetOpen = null;
    else { state.open[state.side[id]] = null; save(); }
    render();
  }
  function closeOverlay() {
    if (isNarrow()) { if (sheetOpen) { sheetOpen = null; render(); } return; }
    let changed = false;
    for (const side of floating) if (state.open[side]) { state.open[side] = null; changed = true; }
    if (changed) { save(); render(); }
  }
  function setSide(id: PanelId, side: Side) {
    if (state.side[id] === side) return;
    const wasOpen = state.open[state.side[id]] === id;
    if (wasOpen) state.open[state.side[id]] = null;
    state.side[id] = side;
    if (wasOpen) state.open[side] = id;
    save(); render();
  }
  function reset() {
    state = structuredClone(DEFAULTS);
    sheetOpen = null;
    save(); render();
  }

  // Clicking outside a floating panel or the phone sheet (or pressing Esc) puts it away.
  document.addEventListener('pointerdown', (e) => {
    const t = e.target as HTMLElement;
    if (t.closest('.panel-menu, .blocklyWidgetDiv, .blocklyDropDownDiv, dialog, .ab')) return;
    if (isNarrow() ? sheetOpen && !sheet.contains(t) : [...floating].some(side => !docks[side].contains(t))) {
      if (isNarrow()) closeOverlay();
      else for (const side of [...floating]) if (!docks[side].contains(t)) { state.open[side] = null; save(); render(); }
    }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !document.querySelector('dialog[open], .panel-menu')) closeOverlay(); });

  // ---------- resize a panel by its inner edge ----------
  function makeResizable(id: PanelId, handle: HTMLElement) {
    handle.addEventListener('pointerdown', (e) => {
      if (isNarrow()) return;
      e.preventDefault();
      handle.setPointerCapture(e.pointerId);
      const startX = e.clientX, startW = state.widths[id];
      const dir = state.side[id] === 'right' ? -1 : 1;
      document.body.classList.add('resizing');
      const move = (ev: PointerEvent) => {
        state.widths[id] = clamp(startW + (ev.clientX - startX) * dir, LIMITS[id]);
        docks[state.side[id]].style.width = `${state.widths[id]}px`;
      };
      const up = () => {
        handle.removeEventListener('pointermove', move); handle.removeEventListener('pointerup', up);
        document.body.classList.remove('resizing'); save(); render();
      };
      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', up);
    });
    handle.addEventListener('dblclick', () => { state.widths[id] = DEFAULTS.widths[id]; save(); render(); });
  }

  // ---------- blocks ↔ code divider ----------
  const stage = $('panes'), split = $('codeSplit'), code = $('codePane');
  function applyCodeFraction() { code.style.flexBasis = `${(state.codeFraction * 100).toFixed(2)}%`; }
  split.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    split.setPointerCapture(e.pointerId);
    document.body.classList.add('resizing');
    const move = (ev: PointerEvent) => {
      const r = stage.getBoundingClientRect();
      const vertical = getComputedStyle(stage).flexDirection === 'column';
      const frac = vertical ? (r.bottom - ev.clientY) / r.height : (r.right - ev.clientX) / r.width;
      state.codeFraction = Math.min(0.8, Math.max(0.2, frac));
      applyCodeFraction();
    };
    const up = () => {
      split.removeEventListener('pointermove', move); split.removeEventListener('pointerup', up);
      document.body.classList.remove('resizing'); save();
    };
    split.addEventListener('pointermove', move);
    split.addEventListener('pointerup', up);
  });
  split.addEventListener('dblclick', () => { state.codeFraction = DEFAULTS.codeFraction; save(); applyCodeFraction(); });
  split.addEventListener('keydown', (e) => {
    const step = e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? 0.03 : e.key === 'ArrowRight' || e.key === 'ArrowDown' ? -0.03 : 0;
    if (!step) return;
    e.preventDefault();
    state.codeFraction = Math.min(0.8, Math.max(0.2, state.codeFraction + step));
    save(); applyCodeFraction();
  });

  NARROW.addEventListener('change', () => { sheetOpen = null; render(); });
  // Re-check room on resize/rotate and when switching Blocks / Split / Text.
  let resizeTimer = 0;
  window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = window.setTimeout(render, 80); });
  new MutationObserver(render).observe(document.body, { attributes: true, attributeFilter: ['data-view'] });
  render();

  return {
    show,
    hide,
    closeOverlay,
    body: (id) => panels[id].querySelector('.panel-body') as HTMLElement,
    actions: (id) => panels[id].querySelector('.panel-actions') as HTMLElement,
    isOpen,
    sideOf: (id) => state.side[id],
    setSide,
    reset,
    onChange: (fn) => { listeners.push(fn); },
    onToolboxCompact: () => {},
    isCompact: () => false,
  };
}
