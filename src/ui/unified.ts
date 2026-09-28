/**
 * One editor, two views: Blocks and Text show the same code in the same place.
 *
 *  - "Like text" layout (Appearance → Blocks layout): blocks line up in one column from the
 *    top-left and are tidied after every drop or delete, the background can't be dragged
 *    around like a map, and the mouse wheel scrolls like a text editor.
 *  - Switching Blocks ⇄ Text keeps your place: whatever block is at the top of the Blocks
 *    view, its line is at the top of the Text view, and the other way round.
 */
import type Blockly from '../engine/blockly.ts';
import type { WorkspaceSvg } from '../engine/blockly.ts';
import type { GenerateResult } from '../engine/index.ts';
import type { Appearance } from './appearance.ts';
import type { TextView } from './text-editor.ts';

type BlocklyNS = typeof Blockly;
/** Same top padding as the Text view's first line. */
const TOP_MARGIN = 12;
/** Space between the line numbers and the code, like the editor's. */
const GUTTER_GAP = 6;

export function setupUnifiedEditor(opts: { B: BlocklyNS; ws: WorkspaceSvg; appearance: Appearance; current: () => GenerateResult; textView: TextView }): void {
  const { B, ws, appearance, current, textView } = opts;
  const pane = document.getElementById('blocksPane')!;
  const isDocument = () => appearance.settings().layout === 'document';
  const view = () => document.body.dataset.view;

  // ---------------- "like text" layout ----------------
  function applyLayout() {
    const doc = isDocument();
    const move = ws.options.moveOptions as { drag: boolean; wheel: boolean };
    move.drag = !doc;   // no map-style panning
    move.wheel = doc;   // the wheel scrolls, like text (Ctrl + wheel still zooms)
    if (doc) arrange(true);
  }

  // ---------------- line numbers, like the editor's gutter ----------------
  const gutter = document.createElement('div');
  gutter.id = 'blockGutter';
  gutter.setAttribute('aria-hidden', 'true');
  pane.prepend(gutter);

  /** Gutter as wide as the editor's: room for the digits of the last line number. */
  function sizeGutter(): number {
    const digits = Math.max(2, String(current().lines.length).length);
    gutter.style.width = `calc(${digits}ch + 26px)`;
    return gutter.getBoundingClientRect().width || 44;
  }

  let gutterFrame = 0;
  function paintGutter() {
    cancelAnimationFrame(gutterFrame);
    gutterFrame = requestAnimationFrame(() => {
      if (!isDocument() || view() === 'text') return;
      const paneTop = pane.getBoundingClientRect().top;
      const spans = current().spans;
      const selected = B.getSelected?.();
      const rows: string[] = [];
      const place = (line: number, el: Element | null | undefined, active: boolean) => {
        const r = el?.getBoundingClientRect();
        if (!r || !r.height) return;
        rows.push(`<span${active ? ' class="active"' : ''} style="top:${Math.round(r.top - paneTop + r.height / 2 - 7)}px">${line + 1}</span>`);
      };
      for (const b of ws.getAllBlocks(false)) {
        const span = spans[b.id];
        if (!span) continue;
        const firstField = (row: number) => b.inputList[row]?.fieldRow.find(f => f.getSvgRoot())?.getSvgRoot();
        const active = selected === (b as unknown);
        if (b.type === 'verse_device') {
          if (span[0] > 0) place(0, firstField(0), false);              // the using row: line 1
          const nameRow = b.inputList.findIndex(i => i.fieldRow.some(f => f.name === 'NAME'));
          place(span[0], firstField(nameRow), active);                  // the class line
          // The OnBegin row is part of the device block: find its line in the code.
          const beginLine = current().lines.findIndex((l, n) => n >= span[0] && n <= span[1] && /^\s*OnBegin<override>/.test(l));
          const beginRow = b.inputList.findIndex(i => i.name === 'ONBEGIN');
          if (beginLine >= 0 && beginRow > 0) place(beginLine, firstField(beginRow - 1), false);
        } else {
          place(span[0], firstField(0) ?? b.getSvgRoot(), active);
        }
      }
      gutter.innerHTML = rows.join('');
    });
  }

  /** Puts the blocks' left edge right after the gutter, like the text after its line numbers. */
  function alignLeft() {
    const tops = ws.getTopBlocks(false);
    if (!tops.length) return;
    const minX = Math.min(...tops.map(b => b.getRelativeToSurfaceXY().x));
    ws.scroll(sizeGutter() + GUTTER_GAP - minX * ws.scale, ws.scrollY);
  }

  let arrangeTimer = 0;
  /** Lines top-level blocks up in one column (without adding to undo history). */
  function arrange(toTop = false) {
    clearTimeout(arrangeTimer);
    arrangeTimer = window.setTimeout(() => {
      if (!isDocument()) return;
      B.Events.disable();
      try { ws.cleanUp(); } finally { B.Events.enable(); }
      alignLeft();
      if (toTop) {
        const tops = ws.getTopBlocks(true);
        const minY = tops.length ? Math.min(...tops.map(b => b.getRelativeToSurfaceXY().y)) : 0;
        ws.scroll(ws.scrollX, TOP_MARGIN - minY * ws.scale);
      }
      remember();
      paintGutter();
    }, 60);
  }

  ws.addChangeListener((ev: { type: string; isStart?: boolean; isUiEvent?: boolean }) => {
    const E = B.Events;
    if (ev.type === E.BLOCK_DRAG && !ev.isStart) arrange();
    // Jump to the top after loading a project, but not while blocks follow your typing.
    if (ev.type === E.BLOCK_DELETE || ev.type === E.FINISHED_LOADING) arrange(ev.type === E.FINISHED_LOADING && !document.body.dataset.textSync);
    if (ev.type === E.VIEWPORT_CHANGE) remember();
    paintGutter();
  });
  new ResizeObserver(() => { if (isDocument()) { alignLeft(); paintGutter(); } }).observe(pane);

  // ---------------- keeping your place between views ----------------
  let topBlockId: string | null = null;
  let topLine = 0;

  /** The first block whose code is at (or just below) the top of the Blocks view. */
  function blockAtTop(): string | null {
    if (view() !== 'blocks' && view() !== 'split') return topBlockId;
    const paneTop = pane.getBoundingClientRect().top;
    const spans = current().spans;
    let best: { id: string; top: number; h: number } | null = null;
    for (const b of ws.getAllBlocks(false)) {
      if (!spans[b.id]) continue;
      const r = b.getSvgRoot().getBoundingClientRect();
      if (!r.height) continue;
      const top = r.top - paneTop;
      if (top < -4) continue;
      if (!best || top < best.top - 1 || (Math.abs(top - best.top) <= 1 && r.height < best.h)) best = { id: b.id, top, h: r.height };
    }
    return best?.id ?? topBlockId;
  }

  function remember() {
    if (view() === 'blocks') topBlockId = blockAtTop();
    if (view() === 'text') topLine = textView.topLine();
  }
  textView.onScroll(remember);

  function showBlockAtTop(id: string) {
    const block = ws.getBlockById(id);
    if (!block) return;
    const xy = block.getRelativeToSurfaceXY();
    ws.scroll(ws.scrollX, -(xy.y * ws.scale) + TOP_MARGIN);
    paintGutter();
  }

  /** The smallest block whose code covers a line (the most specific block for it). */
  function blockForLine(line: number): string | null {
    let best: string | null = null, size = Infinity;
    for (const [id, [a, z]] of Object.entries(current().spans)) if (line >= a && line <= z && z - a < size) { best = id; size = z - a; }
    return best;
  }

  let lastView = view();
  new MutationObserver(() => {
    const now = view();
    if (now === lastView) return;
    const from = lastView;
    lastView = now;
    // Wait until the new view is visible and sized, then line it up.
    window.setTimeout(() => {
      if (from === 'blocks' && now === 'text' && topBlockId) {
        const span = current().spans[topBlockId];
        if (span) textView.showLineAtTop(span[0]);
      }
      if (from === 'text' && now === 'blocks') {
        const id = blockForLine(topLine);
        if (id) showBlockAtTop(id);
      }
      remember();
      if (isDocument()) { alignLeft(); paintGutter(); }
    }, 60);
  }).observe(document.body, { attributes: true, attributeFilter: ['data-view'] });

  // Blockly measures label widths when it first draws. If a font arrives later (the code font
  // loading, or a new font picked in Appearance), measure again so labels don't overlap.
  function remeasure() {
    for (const b of ws.getAllBlocks(false)) for (const input of b.inputList) for (const f of input.fieldRow) f.forceRerender();
    window.setTimeout(() => { if (isDocument()) { alignLeft(); paintGutter(); } }, 50);
  }
  void document.fonts?.ready.then(remeasure);
  document.fonts?.addEventListener('loadingdone', remeasure);

  appearance.onChange(() => { applyLayout(); remeasure(); });
  applyLayout();
}
