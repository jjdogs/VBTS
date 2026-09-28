/**
 * Scroll limits for the "like text" blocks layout.
 *
 * Blockly normally lets you scroll half a screen past the blocks on every side (good for a free
 * canvas). In the document layout the blocks should scroll like text: the first block can't
 * move below the top margin, blocks can't slide away from the line-number gutter, and you can
 * only scroll a little past the last block. The free canvas layout keeps Blockly's behaviour.
 */
import Blockly from '../engine/blockly.ts';

type Region = { top: number; left: number; width: number; height: number };

/** Same top padding as the Text view's first line, and space after the gutter. */
const TOP_MARGIN = 12;
const GUTTER_GAP = 6;
/** How far past the last block you can scroll (like the editor's bottom padding). */
const END_MARGIN = 40;

const isDocument = () => document.body.dataset.blocksLayout === 'document';

/**
 * While a block is being dragged, the scroll limits stay as they were. Otherwise a block picked
 * up from the Toolbox (created under the pointer, outside the blocks) or dragged far to one side
 * would widen the content and the whole view would jump mid-drag.
 */
let frozen = false;
export function freezeScroll(on: boolean): void { frozen = on; }

export class DocumentMetricsManager extends Blockly.MetricsManager {
  private last: { top: number; left: number; bottom: number; right: number } | null = null;

  protected override getPaddedContent_(view: Region, content: Region) {
    const ws = (this as unknown as { workspace_: { isDragging?: () => boolean } }).workspace_;
    if (this.last && (frozen || ws?.isDragging?.())) return this.last;
    this.last = this.compute(view, content);
    return this.last;
  }

  private compute(view: Region, content: Region) {
    const main = (this as unknown as { workspace_: { verseMain?: boolean } }).workspace_?.verseMain;
    if (!isDocument() || !main) return super.getPaddedContent_(view, content);
    const gutter = document.getElementById('blockGutter')?.getBoundingClientRect().width || 44;
    const top = content.top - TOP_MARGIN;
    const left = content.left - gutter - GUTTER_GAP;
    return {
      top,
      left,
      bottom: Math.max(content.top + content.height + END_MARGIN, top + view.height),
      right: Math.max(content.left + content.width + END_MARGIN, left + view.width),
    };
  }
}

/** Use the document scroll limits for every workspace created from now on (flyouts have their own). */
export function registerDocumentMetrics(): void {
  Blockly.registry.register(Blockly.registry.Type.METRICS_MANAGER, Blockly.registry.DEFAULT, DocumentMetricsManager, true);
}
