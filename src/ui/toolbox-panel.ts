/**
 * The Toolbox panel, laid out like Code.org's App Lab:
 *
 *   ┌ Toolbox ─────────────────┐
 *   │ ▌Device      ▌Using      │  category grid (two columns, colour bars)
 *   │ ▌Devices     ▌Events     │
 *   ├──────────────────────────┤
 *   │ [block]                  │  the chosen category's blocks, always visible
 *   │ [block]                  │
 *
 * Blocks view: the palette is a small read-only Blockly workspace, so blocks look exactly like
 * the ones in the workspace. Dragging one creates it in the workspace and hands it to Blockly's
 * dragger (snapping, previews), so it feels like dragging from Blockly's own tray.
 * Text view: the palette shows each block's Verse; drag it into the editor or click to insert.
 * Collapsed (☰): only the colour chips; clicking one opens Blockly's tray as before.
 */
import type Blockly from '../engine/blockly.ts';
import type { BlockSvg, WorkspaceSvg } from '../engine/blockly.ts';
import type { Engine } from '../engine/index.ts';
import type { Appearance } from './appearance.ts';
import type { Layout } from './layout.ts';
import type { TextView } from './text-editor.ts';
import { freezeScroll } from './document-metrics.ts';

type BlocklyNS = typeof Blockly;
type ToolboxItem = { kind: string; type?: string; text?: string };
/** Pointer movement before a press on the palette becomes a drag. */
const DRAG_THRESHOLD = 4;
const GAP = 14;

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function mountToolboxPanel(opts: {
  Blockly: BlocklyNS; ws: WorkspaceSvg; V: Engine; layout: Layout; appearance: Appearance; textView: TextView; renderer: string;
}): void {
  const { Blockly: B, ws, V, layout, appearance, textView } = opts;
  const body = layout.body('toolbox');
  const categories = V.TOOLBOX.contents;
  let current = 0;

  body.innerHTML = `
    <div class="tb">
      <ul class="cats" role="list">${categories.map((c, i) => `
        <li><button class="cat" data-i="${i}" aria-pressed="${i === 0}" title="${esc(c.name)}">
          <span class="chip" style="--chip:${V.resolveColour(c.colour)}" data-colour="${c.colour}" aria-hidden="true"></span><span class="cat-name">${esc(c.name)}</span>
        </button></li>`).join('')}
      </ul>
      <p class="tb-note" hidden></p>
      <div class="palette" aria-label="Blocks you can drag into the workspace"></div>
      <ul class="snippets" role="list" aria-label="Code you can drag into the editor or click to insert" hidden></ul>
    </div>`;
  const list = body.querySelector('.cats') as HTMLUListElement;
  const note = body.querySelector('.tb-note') as HTMLParagraphElement;
  const paletteDiv = body.querySelector('.palette') as HTMLDivElement;
  const snippets = body.querySelector('.snippets') as HTMLUListElement;

  // ---------------- the palette (a read-only Blockly workspace) ----------------
  const palette = B.inject(paletteDiv, {
    readOnly: true, renderer: opts.renderer, theme: appearance.theme(B), sounds: false, trashcan: false, media: 'vb-media/',
    move: { scrollbars: { vertical: true, horizontal: true }, drag: false, wheel: true },
    zoom: { controls: false, wheel: false, startScale: ws.scale },
  }) as WorkspaceSvg;
  // A list, not a canvas: no scrolling above the first block or sideways past the blocks (document-metrics.ts).
  (palette as WorkspaceSvg & { versePalette?: boolean }).versePalette = true;
  new ResizeObserver(() => B.svgResize(palette)).observe(paletteDiv);
  // Injecting makes the newest workspace Blockly's "main" one (used for keyboard shortcuts and
  // more). The real workspace stays main; the palette never takes focus (see pointerdown below).
  B.common.setMainWorkspace(ws);

  function fill() {
    const cat = categories[current];
    const items = cat.contents as ToolboxItem[];
    B.Events.disable();
    try {
      palette.clear();
      let y = GAP;
      for (const item of items) {
        if (item.kind !== 'block') continue;
        const block = B.serialization.blocks.append(item as never, palette) as BlockSvg;
        block.moveBy(GAP, y);
        y += block.getHeightWidth().height + GAP;
      }
    } finally { B.Events.enable(); }
    const tips = items.filter(i => i.kind === 'label').map(i => i.text).filter(Boolean);
    note.innerHTML = tips.map(t => esc(t!)).join('<br>'); // one tip per line
    note.hidden = !tips.length;
    palette.scroll(0, 0);
    fillSnippets();
  }

  /** Text view: each block's Verse, to drag into the editor or click to insert. */
  function fillSnippets() {
    const colour = V.resolveColour(categories[current].colour);
    const top = palette.getTopBlocks(true);
    const codes = top.map(b => V.snippetFor(b));
    snippets.innerHTML = codes.map((code, i) =>
      `<li><button class="snip" draggable="true" data-i="${i}" style="--chip:${colour}" title="Drag into the code, or click to insert at the cursor">${esc(code)}</button></li>`).join('');
    snippets.querySelectorAll<HTMLButtonElement>('.snip').forEach((btn, i) => {
      btn.addEventListener('dragstart', (e) => { e.dataTransfer?.setData('text/plain', codes[i]); layout.closeOverlay(); });
      btn.addEventListener('click', () => { layout.closeOverlay(); textView.insertSnippet(codes[i]); });
    });
  }

  function showFor(view: string | undefined) {
    const text = view === 'text';
    paletteDiv.hidden = text;
    snippets.hidden = !text;
    if (!text) window.setTimeout(() => B.svgResize(palette), 0);
  }
  new MutationObserver(() => showFor(document.body.dataset.view)).observe(document.body, { attributes: true, attributeFilter: ['data-view'] });

  // ---------------- dragging from the palette into the workspace ----------------
  paletteDiv.addEventListener('pointerdown', (e) => {
    const g = (e.target as Element).closest('[data-id]');
    const hit = g ? palette.getBlockById(g.getAttribute('data-id')!) : null;
    if (!hit || e.button !== 0) return;
    const source = hit.getRootBlock() as BlockSvg;
    e.preventDefault();
    e.stopPropagation();
    const start = { x: e.clientX, y: e.clientY };
    const r0 = source.getSvgRoot().getBoundingClientRect();
    const grab = { x: e.clientX - r0.left, y: e.clientY - r0.top };
    let dragger: InstanceType<BlocklyNS['dragging']['Dragger']> | null = null;

    const move = (ev: PointerEvent) => {
      if (!dragger) {
        if (Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < DRAG_THRESHOLD) return;
        layout.closeOverlay(); // a slid-out Toolbox gets out of the way
        freezeScroll(true);    // keep the view still while the new block is dragged
        B.Events.setGroup(true);
        const json = B.serialization.blocks.save(source, { addCoordinates: false });
        const block = B.serialization.blocks.append(json as never, ws) as BlockSvg;
        // Put the new block where the palette block is under the pointer, then drag it.
        const svg = ws.getParentSvg().getBoundingClientRect();
        block.moveTo(new B.utils.Coordinate(
          (ev.clientX - grab.x - svg.left - ws.scrollX) / ws.scale,
          (ev.clientY - grab.y - svg.top - ws.scrollY) / ws.scale));
        dragger = new B.dragging.Dragger(block, ws);
        dragger.onDragStart(ev);
        start.x = ev.clientX; start.y = ev.clientY;
      }
      dragger.onDrag(ev, new B.utils.Coordinate(ev.clientX - start.x, ev.clientY - start.y));
    };
    const up = (ev: PointerEvent) => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      if (dragger) { dragger.onDragEnd(ev); B.Events.setGroup(false); freezeScroll(false); }
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  }, { capture: true });

  // ---------------- categories ----------------
  const toolbox = () => ws.getToolbox() as unknown as {
    getToolboxItems(): Array<{ getName(): string }>; getSelectedItem(): { getName(): string } | null;
    setSelectedItem(item: unknown): void; clearSelection(): void;
  };
  list.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('button.cat') as HTMLButtonElement | null;
    if (!btn) return;
    const i = Number(btn.dataset.i);
    if (layout.isCompact()) {
      // Collapsed: no room for the palette, so open Blockly's tray as before.
      const item = toolbox().getToolboxItems().find(t => t.getName() === categories[i].name);
      if (!item) return;
      if (toolbox().getSelectedItem() === item) toolbox().clearSelection();
      else { layout.closeOverlay(); toolbox().setSelectedItem(item); }
    } else {
      current = i;
      fill();
    }
    sync();
  });

  function sync() {
    const trayName = toolbox().getSelectedItem()?.getName();
    list.querySelectorAll<HTMLButtonElement>('button.cat').forEach(b => {
      const i = Number(b.dataset.i);
      b.setAttribute('aria-pressed', String(layout.isCompact() ? categories[i].name === trayName : i === current));
      b.style.setProperty('--cat', V.resolveColour(categories[i].colour));
    });
  }
  ws.addChangeListener((ev: { type: string }) => { if (ev.type === B.Events.TOOLBOX_ITEM_SELECT) sync(); });
  layout.onToolboxCompact(() => { sync(); window.setTimeout(() => B.svgResize(palette), 0); });

  // Appearance changes: same theme and colours as the workspace.
  document.addEventListener('verse:colours', () => {
    list.querySelectorAll<HTMLElement>('.chip').forEach(chip => chip.style.setProperty('--chip', V.resolveColour(chip.dataset.colour!)));
    palette.setTheme(appearance.theme(B));
    V.recolourBlocks(palette);
    fill();
    sync();
  });

  fill();
  sync();
  showFor(document.body.dataset.view);
}
