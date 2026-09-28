/**
 * Layout manager: movable side panels around the block workspace.
 *
 *  - A panel is either PINNED (a column in the left or right dock) or UNPINNED
 *    (an icon on the activity bar; clicking it slides the panel out over the workspace).
 *  - Pinned panels can be reordered and moved between sides by dragging their header,
 *    or with the ⋯ menu (which also works on touch screens).
 *  - Panel widths and the blocks/code split can be resized; double-click a divider to reset.
 *  - The layout is saved in the browser. On narrow screens every panel acts unpinned.
 */

export type PanelId = 'learn' | 'toolbox' | 'appearance';
type Side = 'left' | 'right';

interface LayoutState {
  /** Pinned panels per side, listed from the screen edge inward. */
  left: PanelId[];
  right: PanelId[];
  widths: Record<PanelId, number>;
  /** Where each panel goes back to when it is pinned again. */
  lastSide: Record<PanelId, Side>;
  /** The code pane's share of the stage in split view (0–1). */
  codeFraction: number;
  toolboxCompact: boolean;
  /** Set once the saved layout has moved to the App Lab-style default. */
  appLab?: boolean;
}

const PANEL_IDS: PanelId[] = ['learn', 'toolbox', 'appearance'];
const TITLES: Record<PanelId, string> = { learn: 'Learn', toolbox: 'Toolbox', appearance: 'Appearance' };
/** Shorter labels for the narrow side bar. */
const BAR_LABELS: Record<PanelId, string> = { learn: 'Learn', toolbox: 'Toolbox', appearance: 'Look' };
const DEFAULTS: LayoutState = {
  left: ['toolbox'],
  right: ['learn'],
  widths: { learn: 320, toolbox: 300, appearance: 340 },
  lastSide: { learn: 'right', toolbox: 'left', appearance: 'right' },
  codeFraction: 0.44,
  toolboxCompact: false,
  appLab: true,
};
const LIMITS: Record<PanelId, [min: number, max: number]> = { learn: [240, 560], toolbox: [220, 520], appearance: [280, 520] };
const COMPACT_WIDTH = 72;
const BAR_WIDTH = 56;
/** Narrowest usable workspace, in split view (blocks + code) and in Blocks or Text view. */
const MIN_STAGE_SPLIT = 720;
const MIN_STAGE_SINGLE = 420;
/** Split view stacks vertically when the workspace is narrower than this and at least this tall. */
const STACK_BELOW_WIDTH = 640;
const STACK_MIN_HEIGHT = 480;
const NARROW = window.matchMedia('(max-width: 900px)');
const COARSE = window.matchMedia('(pointer: coarse)');
const KEY = 'verse-blocks:layout:v1';

// Simple line icons for the activity bar and panel buttons (drawn for this app).
const ICONS: Record<string, string> = {
  learn: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9l9-4 9 4-9 4-9-4z"/><path d="M7 11v4c0 1.5 2.2 3 5 3s5-1.5 5-3v-4"/><path d="M21 9v5"/></svg>',
  appearance: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.6-.8 1.2-1.8-.5-1.2.3-2.2 1.5-2.2H17a4 4 0 0 0 4-4c0-5.5-4-10-9-10z"/><circle cx="7.5" cy="11" r="1.2"/><circle cx="10" cy="7" r="1.2"/><circle cx="15" cy="7.5" r="1.2"/></svg>',
  toolbox: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="8" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/><rect x="13" y="13" width="8" height="8" rx="2"/></svg>',
  pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6l-1 6 3 3H7l3-3-1-6z"/><path d="M12 12v9"/></svg>',
  unpin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6l-1 6 3 3H7l3-3-1-6z"/><path d="M12 12v9"/><path d="M4 4l16 16"/></svg>',
  more: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>',
  menu: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
};

function load(): LayoutState {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    // One-time move to the App Lab-style default (Toolbox left, Learn right).
    if (saved && !saved.appLab) return { ...structuredClone(DEFAULTS), appLab: true } as LayoutState;
    if (!saved) return structuredClone(DEFAULTS);
    const state: LayoutState = { ...structuredClone(DEFAULTS), ...saved };
    state.widths = { ...DEFAULTS.widths, ...(saved.widths || {}) };
    state.lastSide = { ...DEFAULTS.lastSide, ...(saved.lastSide || {}) };
    // Drop anything unknown or duplicated (e.g. from an older saved layout).
    const seen = new Set<PanelId>();
    for (const side of ['left', 'right'] as const) {
      state[side] = (state[side] || []).filter((p): p is PanelId => PANEL_IDS.includes(p) && !seen.has(p) && !!seen.add(p));
    }
    return state;
  } catch {
    return structuredClone(DEFAULTS);
  }
}

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const clamp = (v: number, [lo, hi]: [number, number]) => Math.min(hi, Math.max(lo, v));

export interface Layout {
  /** Shows a panel: scrolls to it if pinned, slides it out if not. */
  show(id: PanelId): void;
  /** Closes the slide-out panel, if one is open. */
  closeOverlay(): void;
  /** The body element of a panel, to put content in. */
  body(id: PanelId): HTMLElement;
  /** Called when the Toolbox panel switches between full and compact. */
  onToolboxCompact(fn: (compact: boolean) => void): void;
  isCompact(): boolean;
}

export function createLayout(): Layout {
  let state = load();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode etc. */ } };
  const bar = $('activityBar'), docks: Record<Side, HTMLElement> = { left: $('dockLeft'), right: $('dockRight') };
  const overlay = $('overlayHost');
  const panels = {} as Record<PanelId, HTMLElement>;
  const compactListeners: Array<(c: boolean) => void> = [];
  let openOverlay: PanelId | null = null;
  /** Panels tucked into the side bar automatically because the screen is too narrow for them. */
  const autoTucked = new Set<PanelId>();
  /** Toolbox collapsed to chips automatically for the same reason. */
  let autoCompact = false;

  const pinnedSide = (id: PanelId): Side | null =>
    state.left.includes(id) ? 'left' : state.right.includes(id) ? 'right' : null;
  const isNarrow = () => NARROW.matches;
  /** Pinned for display purposes: on narrow screens, or when tucked to make room, it isn't. */
  const shownPinned = (id: PanelId) => !isNarrow() && pinnedSide(id) !== null && !autoTucked.has(id);
  const isCompactNow = () => state.toolboxCompact || autoCompact;
  const widthOf = (id: PanelId) => {
    if (id === 'toolbox' && isCompactNow()) return COMPACT_WIDTH;
    // Touch screens get bigger buttons, so give the Toolbox header room for them.
    return id === 'toolbox' && COARSE.matches ? Math.max(state.widths.toolbox, 208) : state.widths[id];
  };

  /**
   * Make room: the workspace needs a minimum width to be usable (more in split view, where it
   * holds blocks and code). If the pinned panels leave less, first collapse the Toolbox to chips,
   * then tuck panels (widest first) into the side bar. The saved layout is not changed, so
   * everything comes back when the window is wide enough again.
   */
  function makeRoom() {
    autoTucked.clear();
    autoCompact = false;
    if (isNarrow()) return;
    const view = document.body.dataset.view || 'split';
    const minStage = view === 'split' ? MIN_STAGE_SPLIT : MIN_STAGE_SINGLE;
    const pinned = [...state.left, ...state.right];
    const room = () => {
      const barShown = PANEL_IDS.some(id => pinnedSide(id) === null || autoTucked.has(id));
      return window.innerWidth - (barShown ? BAR_WIDTH : 0) -
        pinned.filter(id => !autoTucked.has(id)).reduce((sum, id) => sum + widthOf(id), 0);
    };
    if (room() >= minStage) return;
    if (pinned.includes('toolbox') && !state.toolboxCompact) autoCompact = true;
    const byWidth = [...pinned].sort((a, b) => widthOf(b) - widthOf(a));
    for (const id of byWidth) {
      if (room() >= minStage) break;
      autoTucked.add(id);
    }
  }

  /** Split view stacks blocks over code only when the workspace is narrow and tall. */
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
      ${id === 'toolbox' ? `<button class="pb" data-act="compact" aria-label="Collapse toolbox">${ICONS.menu}</button>` : ''}
      <h2 class="panel-title">${TITLES[id]}</h2>
      <button class="pb" data-act="menu" aria-label="${TITLES[id]} panel options" aria-haspopup="menu">${ICONS.more}</button>
      <button class="pb" data-act="pin"></button>`;
    head.addEventListener('click', (e) => {
      const act = (e.target as HTMLElement).closest('button')?.dataset.act;
      if (act === 'pin') togglePin(id);
      if (act === 'menu') openMenu(id, (e.target as HTMLElement).closest('button')!);
      if (act === 'compact') setCompact(!state.toolboxCompact);
    });
    const resizer = document.createElement('div');
    resizer.className = 'resizer';
    resizer.setAttribute('role', 'separator');
    resizer.setAttribute('aria-label', `Resize ${TITLES[id]}`);
    el.appendChild(resizer);
    makeResizable(id, resizer);
    makeDraggable(id, head);
  }

  // ---------- render: put every panel where the state says ----------
  function render() {
    makeRoom();
    document.body.classList.toggle('narrow', isNarrow());
    for (const side of ['left', 'right'] as const) {
      const dock = docks[side];
      const ids = isNarrow() ? [] : side === 'left' ? state.left : [...state.right].reverse(); // DOM order = screen order
      dock.dataset.side = side;
      for (const id of ids) dock.appendChild(panels[id]);
      dock.hidden = ids.length === 0;
    }
    for (const id of PANEL_IDS) {
      const el = panels[id];
      const side = shownPinned(id) ? pinnedSide(id)! : null;
      el.dataset.state = side ? 'pinned' : 'floating';
      el.dataset.side = side ?? 'left';
      el.style.width = `${widthOf(id)}px`;
      if (!side && el.parentElement !== overlay) overlay.appendChild(el);
      el.hidden = !side && openOverlay !== id;
      const pinBtn = el.querySelector('[data-act="pin"]') as HTMLButtonElement;
      pinBtn.innerHTML = side ? ICONS.unpin : ICONS.pin;
      pinBtn.setAttribute('aria-label', side ? `Unpin ${TITLES[id]}` : `Pin ${TITLES[id]}`);
      pinBtn.title = side ? 'Unpin: tuck into the side bar' : 'Pin: keep it open';
      pinBtn.hidden = isNarrow() || autoTucked.has(id);
      (el.querySelector('.panel-head') as HTMLElement).draggable = !isNarrow();
    }
    panels.toolbox.classList.toggle('compact', isCompactNow());
    const compactBtn = panels.toolbox.querySelector('[data-act="compact"]') as HTMLButtonElement;
    compactBtn.setAttribute('aria-label', isCompactNow() ? 'Expand toolbox' : 'Collapse toolbox');
    compactBtn.setAttribute('aria-expanded', String(!isCompactNow()));
    compactBtn.title = autoCompact ? 'Collapsed automatically to make room. Widen the window to show names.'
      : state.toolboxCompact ? 'Show category names' : 'Show colors only';
    compactBtn.disabled = autoCompact;

    // Activity bar: only panels that are not pinned.
    const unpinned = PANEL_IDS.filter(id => !shownPinned(id));
    bar.innerHTML = unpinned.map(id => {
      const tucked = autoTucked.has(id);
      const title = tucked ? `${TITLES[id]} (tucked away to make room; widen the window to pin it again)` : TITLES[id];
      return `<button class="ab${tucked ? ' tucked' : ''}" data-panel="${id}" aria-label="${title}" aria-expanded="${openOverlay === id}" title="${title}">${ICONS[id]}<span>${BAR_LABELS[id]}</span></button>`;
    }).join('');
    bar.hidden = unpinned.length === 0 && !document.body.classList.contains('dragging-panel');
    overlay.hidden = !openOverlay;
    overlay.dataset.open = openOverlay ?? '';
    applyCodeFraction();
    chooseSplitDirection();
  }

  bar.addEventListener('click', (e) => {
    const id = (e.target as HTMLElement).closest('button')?.dataset.panel as PanelId | undefined;
    if (!id) return;
    if (openOverlay === id) closeOverlay(); else openPanel(id);
  });

  function openPanel(id: PanelId) {
    openOverlay = id;
    render();
    (panels[id].querySelector('.panel-body') as HTMLElement)?.focus({ preventScroll: true });
  }
  function closeOverlay() {
    if (!openOverlay) return;
    const was = openOverlay;
    openOverlay = null;
    render();
    (bar.querySelector(`[data-panel="${was}"]`) as HTMLElement | null)?.focus({ preventScroll: true });
  }
  // Clicking outside a slid-out panel (or pressing Esc) tucks it away.
  document.addEventListener('pointerdown', (e) => {
    const t = e.target as HTMLElement;
    if (openOverlay && !overlay.contains(t) && !bar.contains(t) && !t.closest('.panel-menu, .blocklyFlyout, .blocklyWidgetDiv, .blocklyDropDownDiv, dialog')) closeOverlay();
    if (!t.closest('.panel-menu, [data-act="menu"]')) closeMenu();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeMenu(); closeOverlay(); } });

  // ---------- pinning, moving, compact ----------
  function unpinAll(id: PanelId) {
    state.left = state.left.filter(p => p !== id);
    state.right = state.right.filter(p => p !== id);
  }
  function pinTo(id: PanelId, side: Side, index?: number) {
    unpinAll(id);
    const list = state[side];
    list.splice(index === undefined ? list.length : Math.max(0, Math.min(index, list.length)), 0, id);
    state.lastSide[id] = side;
    if (openOverlay === id) openOverlay = null;
    save(); render();
  }
  function unpin(id: PanelId) {
    const side = pinnedSide(id);
    if (side) state.lastSide[id] = side;
    unpinAll(id); save(); render();
  }
  function togglePin(id: PanelId) { if (shownPinned(id)) unpin(id); else pinTo(id, state.lastSide[id]); }
  /** Moves a pinned panel one step toward the left or right edge of the screen. */
  function nudge(id: PanelId, dir: -1 | 1) {
    const side = pinnedSide(id);
    if (!side) return;
    // Screen order across both docks: left dock (edge → inward), then right dock (inward → edge).
    const order: Array<[Side, PanelId]> = [...state.left.map(p => ['left', p] as [Side, PanelId]), ...[...state.right].reverse().map(p => ['right', p] as [Side, PanelId])];
    const i = order.findIndex(([, p]) => p === id), j = i + dir;
    if (j < 0 || j >= order.length) { pinTo(id, dir < 0 ? 'left' : 'right', dir < 0 ? 0 : 0); return; }
    const [otherSide, other] = order[j];
    if (otherSide === side) {
      const list = state[side], a = list.indexOf(id), b = list.indexOf(other);
      [list[a], list[b]] = [list[b], list[a]];
      save(); render();
    } else {
      pinTo(id, otherSide, otherSide === 'left' ? state.left.length : state.right.length);
    }
  }
  function setCompact(compact: boolean) {
    state.toolboxCompact = compact; save(); render();
    compactListeners.forEach(fn => fn(compact));
  }

  // ---------- ⋯ menu (works with touch, unlike dragging) ----------
  let menu: HTMLElement | null = null;
  function closeMenu() { menu?.remove(); menu = null; }
  function openMenu(id: PanelId, anchor: HTMLElement) {
    closeMenu();
    const pinned = shownPinned(id), side = pinnedSide(id);
    const items: Array<[string, () => void, boolean?]> = [];
    if (autoTucked.has(id)) items.push(['Tucked away to make room. Widen the window, or unpin other panels, to pin it again.', () => {}, true]);
    if (pinned) {
      items.push(['Move left', () => nudge(id, -1)], ['Move right', () => nudge(id, 1)]);
      items.push([`Move to the ${side === 'left' ? 'right' : 'left'} side`, () => pinTo(id, side === 'left' ? 'right' : 'left')]);
      items.push(['Unpin (tuck into side bar)', () => unpin(id)]);
    } else if (!isNarrow()) {
      items.push(['Pin on the left', () => pinTo(id, 'left')], ['Pin on the right', () => pinTo(id, 'right')]);
    }
    if (id === 'toolbox') items.push([state.toolboxCompact ? 'Show category names' : 'Show colors only', () => setCompact(!state.toolboxCompact)]);
    items.push(['Reset layout', () => { state = structuredClone(DEFAULTS); openOverlay = null; save(); render(); compactListeners.forEach(fn => fn(false)); }]);
    menu = document.createElement('div');
    menu.className = 'panel-menu';
    menu.setAttribute('role', 'menu');
    items.forEach(([label, run, note]) => {
      const b = document.createElement('button');
      b.setAttribute('role', 'menuitem');
      if (note) { b.className = 'note'; b.setAttribute('aria-disabled', 'true'); }
      b.textContent = label;
      b.onclick = () => { closeMenu(); run(); };
      menu!.appendChild(b);
    });
    document.body.appendChild(menu);
    const r = anchor.getBoundingClientRect();
    menu.style.top = `${r.bottom + 4}px`;
    menu.style.left = `${Math.min(window.innerWidth - menu.offsetWidth - 8, Math.max(8, r.right - menu.offsetWidth))}px`;
    (menu.firstElementChild as HTMLElement)?.focus();
  }

  // ---------- drag a panel by its header ----------
  let dragging: PanelId | null = null;
  let marker: HTMLElement | null = null;
  function makeDraggable(id: PanelId, head: HTMLElement) {
    head.addEventListener('dragstart', (e) => {
      if ((e.target as HTMLElement).closest('button')) { e.preventDefault(); return; }
      dragging = id;
      e.dataTransfer?.setData('text/plain', id);
      if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
      closeOverlay();
      requestAnimationFrame(() => { document.body.classList.add('dragging-panel'); for (const s of ['left', 'right'] as const) docks[s].hidden = false; bar.hidden = false; });
    });
    head.addEventListener('dragend', () => {
      dragging = null; marker?.remove(); marker = null;
      document.body.classList.remove('dragging-panel');
      render();
    });
  }
  /** Where in a dock a drop at clientX would land. */
  function dropIndex(side: Side, clientX: number): { domIndex: number; stateIndex: number } {
    const cols = [...docks[side].querySelectorAll(':scope > .panel')].filter(c => (c as HTMLElement).dataset.panel !== dragging) as HTMLElement[];
    let domIndex = cols.findIndex(c => { const r = c.getBoundingClientRect(); return clientX < r.left + r.width / 2; });
    if (domIndex < 0) domIndex = cols.length;
    // state lists run edge → inward; the right dock's DOM order is the reverse of that
    const stateIndex = side === 'left' ? domIndex : cols.length - domIndex;
    return { domIndex, stateIndex };
  }
  for (const side of ['left', 'right'] as const) {
    const dock = docks[side];
    dock.addEventListener('dragover', (e) => {
      if (!dragging) return;
      e.preventDefault();
      const { domIndex } = dropIndex(side, e.clientX);
      marker ??= Object.assign(document.createElement('div'), { className: 'drop-marker' });
      const cols = [...dock.querySelectorAll(':scope > .panel')].filter(c => (c as HTMLElement).dataset.panel !== dragging);
      dock.insertBefore(marker, cols[domIndex] ?? null);
    });
    dock.addEventListener('drop', (e) => {
      if (!dragging) return;
      e.preventDefault();
      const id = dragging;
      pinTo(id, side, dropIndex(side, e.clientX).stateIndex);
    });
  }
  bar.addEventListener('dragover', (e) => { if (dragging) { e.preventDefault(); bar.classList.add('drop-here'); } });
  bar.addEventListener('dragleave', () => bar.classList.remove('drop-here'));
  bar.addEventListener('drop', (e) => { if (!dragging) return; e.preventDefault(); bar.classList.remove('drop-here'); unpin(dragging); });

  // ---------- resize a panel by its inner edge ----------
  function makeResizable(id: PanelId, handle: HTMLElement) {
    handle.addEventListener('pointerdown', (e) => {
      if (id === 'toolbox' && state.toolboxCompact) return;
      e.preventDefault();
      handle.setPointerCapture(e.pointerId);
      const startX = e.clientX, startW = state.widths[id];
      const onRight = panels[id].dataset.state === 'pinned' && panels[id].dataset.side === 'right';
      document.body.classList.add('resizing');
      const move = (ev: PointerEvent) => {
        const dx = (ev.clientX - startX) * (onRight ? -1 : 1);
        state.widths[id] = clamp(startW + dx, LIMITS[id]);
        panels[id].style.width = `${state.widths[id]}px`;
      };
      const up = () => {
        handle.removeEventListener('pointermove', move); handle.removeEventListener('pointerup', up);
        document.body.classList.remove('resizing'); save();
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

  NARROW.addEventListener('change', () => { openOverlay = null; render(); });
  // Re-check room on resize/rotate and when switching Blocks / Split / Text.
  let resizeTimer = 0;
  window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = window.setTimeout(render, 80); });
  new MutationObserver(render).observe(document.body, { attributes: true, attributeFilter: ['data-view'] });
  render();

  return {
    show(id) {
      if (shownPinned(id)) panels[id].scrollIntoView({ block: 'nearest' });
      else openPanel(id);
    },
    closeOverlay,
    body: (id) => panels[id].querySelector('.panel-body') as HTMLElement,
    onToolboxCompact: (fn) => { compactListeners.push(fn); },
    isCompact: () => isCompactNow(),
  };
}
