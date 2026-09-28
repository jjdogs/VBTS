/**
 * The Blocks view's controls: a small bar in the bottom-right corner with zoom in, zoom out,
 * "back to the start" and a trash can. They replace Blockly's own zoom and trash icons, which are
 * large images that don't match the rest of the app.
 *
 * The trash is a real Blockly delete area: drop a block on it to delete it (Ctrl+Z brings it
 * back), and it lights up while a block that can be deleted is over it.
 */
import type Blockly from '../engine/blockly.ts';
import type { IDraggable, WorkspaceSvg } from '../engine/blockly.ts';

type BlocklyNS = typeof Blockly;

const icon = (d: string) => `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICONS = {
  plus: icon('<path d="M12 5v14M5 12h14"/>'),
  minus: icon('<path d="M5 12h14"/>'),
  home: icon('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/><circle cx="12" cy="12" r="2.5"/>'),
  trash: icon('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>'),
};

export function mountWorkspaceControls(opts: { Blockly: BlocklyNS; ws: WorkspaceSvg; host: HTMLElement; startScale: () => number }): void {
  const { Blockly: B, ws, host } = opts;
  const bar = document.createElement('div');
  bar.className = 'ws-controls';
  bar.setAttribute('role', 'toolbar');
  bar.setAttribute('aria-label', 'Blocks view');
  bar.innerHTML = `
    <button type="button" class="wsc" data-act="in" title="Zoom in" aria-label="Zoom in">${ICONS.plus}</button>
    <button type="button" class="wsc" data-act="out" title="Zoom out" aria-label="Zoom out">${ICONS.minus}</button>
    <button type="button" class="wsc" data-act="home" title="Normal size, back to the blocks" aria-label="Reset zoom and position">${ICONS.home}</button>
    <span class="wsc-sep" aria-hidden="true"></span>
    <div class="wsc wsc-trash" title="Drag a block here to delete it (Ctrl+Z brings it back)" aria-label="Trash: drag a block here to delete it">${ICONS.trash}</div>`;
  host.appendChild(bar);

  bar.addEventListener('click', (e) => {
    const act = (e.target as Element).closest<HTMLButtonElement>('button.wsc')?.dataset.act;
    if (!act) return;
    if (act === 'in' || act === 'out') ws.zoomCenter(act === 'in' ? 1 : -1);
    if (act === 'home') {
      ws.setScale(opts.startScale());
      // "Like text" layout: back to the first line. Canvas: blocks in the middle.
      if (document.body.dataset.blocksLayout === 'document') ws.scroll(1e6, 1e6);
      else ws.scrollCenter();
    }
  });
  // Keep the workspace's keyboard focus (Delete, Ctrl+Z) when a control is clicked.
  bar.addEventListener('pointerdown', (e) => e.preventDefault());

  const trashEl = bar.querySelector('.wsc-trash') as HTMLDivElement;
  class Trash extends B.DeleteArea {
    override id = 'verseTrash';
    override getClientRect() {
      const r = trashEl.getBoundingClientRect();
      if (!r.width) return null; // hidden (Text view)
      // A little larger than the icon, so a block doesn't have to land exactly on it.
      return new B.utils.Rect(r.top - 8, r.bottom + 8, r.left - 8, r.right + 8);
    }
    // On each move Blockly first asks whether the block would be deleted, then calls onDragOver.
    // (It asks once more after the drop, so the colour is set here, not in updateWouldDelete_.)
    override onDragOver(el: IDraggable) { super.onDragOver(el); trashEl.classList.toggle('hot', this.wouldDelete_); }
    override onDragExit(el: IDraggable) { super.onDragExit(el); trashEl.classList.remove('hot'); }
    override onDrop(el: IDraggable) {
      super.onDrop(el);
      trashEl.classList.remove('hot');
      if (!this.wouldDelete_) return;
      trashEl.classList.add('gulp');
      window.setTimeout(() => trashEl.classList.remove('gulp'), 250);
    }
    override shouldPreventMove() { return false; }
  }
  const Cap = B.ComponentManager.Capability;
  ws.getComponentManager().addComponent({ component: new Trash(), weight: 1, capabilities: [Cap.DELETE_AREA, Cap.DRAG_TARGET] });
}
