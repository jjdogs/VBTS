/**
 * App entry point: loads Blockly and its English text, sets up the engine, embeds Blockly's
 * control icons, then starts the UI.
 */
import * as English from 'blockly/msg/en';
import Blockly from './engine/blockly.ts';
import { createEngine } from './engine/index.ts';
import './styles/app.css';
import './styles/layout.css';
import './styles/responsive.css';
import './styles/appearance.css';
import { startApp } from './ui/app.js';
import { createLayout } from './ui/layout.ts';
import { mountToolboxPanel } from './ui/toolbox-panel.ts';
import { setupResponsive } from './ui/responsive.ts';
import { blockOverrides, createAppearance, mountAppearancePanel } from './ui/appearance.ts';
import { setupUnifiedEditor } from './ui/unified.ts';
import { createTextView } from './ui/text-editor.ts';
import { registerDocumentMetrics } from './ui/document-metrics.ts';

import sprites from './ui/blockly-media/sprites.png?inline';
import dropdownArrow from './ui/blockly-media/dropdown-arrow.svg?inline';
import deleteIcon from './ui/blockly-media/delete-icon.svg?inline';
import foldoutIcon from './ui/blockly-media/foldout-icon.svg?inline';
import resizeHandle from './ui/blockly-media/resize-handle.svg?inline';
import pixel from './ui/blockly-media/1x1.gif?inline';

Blockly.setLocale(English as unknown as Record<string, string>);

/** File name (as Blockly asks for it) → embedded data URL. */
const MEDIA: Record<string, string> = {
  'sprites.png': sprites,
  'dropdown-arrow.svg': dropdownArrow,
  'delete-icon.svg': deleteIcon,
  'foldout-icon.svg': foldoutIcon,
  'resize-handle.svg': resizeHandle,
  '1x1.gif': pixel,
};

// Blockly was a global in the original single-file version; keep it reachable for the browser
// console and the browser tests.
(window as unknown as { Blockly: typeof Blockly }).Blockly = Blockly;

const V = createEngine();

// One-time move to the single-window default (Blocks view) for people who used Split before.
try {
  if (!localStorage.getItem('verse-blocks:unified:v1')) {
    const saved = JSON.parse(localStorage.getItem('verse-blocks:v1') || 'null');
    if (saved && saved.view === 'split') { saved.view = 'blocks'; localStorage.setItem('verse-blocks:v1', JSON.stringify(saved)); }
    localStorage.setItem('verse-blocks:unified:v1', '1');
  }
} catch { /* private mode */ }

const appearance = createAppearance(V.COLORS);
// Block wording is built into blocks, so choose it before any block is created (friendly by default).
V.setLabelStyle(appearance.settings().blockWords);
V.setColourOverrides(blockOverrides(appearance));
registerDocumentMetrics(); // text-like scroll limits in the "like text" blocks layout
const layout = createLayout();
const { ws, current, textView } = startApp({
  Blockly, V, MEDIA, layout, appearance,
  makeTextView: (w, cur, onStatus) => createTextView({ parent: document.getElementById('code')!, B: Blockly, ws: w, V, current: cur, onStatus }),
});
(ws as unknown as { verseMain: boolean }).verseMain = true; // document scroll limits apply to the main workspace only
mountToolboxPanel({ Blockly, ws, V, layout, appearance, textView, renderer: appearance.settings().blockStyle === 'text' ? 'thrasos' : appearance.settings().renderer });
mountAppearancePanel({ B: Blockly, ws, V, layout, appearance });
setupUnifiedEditor({ B: Blockly, ws, appearance, current, textView });

// Handy in the browser console and used by the browser tests.
(window as unknown as { VerseBlocks: object }).VerseBlocks = {
  text: () => textView.text(), type: (t: string) => textView.typeText(t), flush: () => textView.flush(), generated: () => current().code,
  topLine: () => textView.topLine(), showLine: (n: number) => textView.showLineAtTop(n),
};
document.getElementById('lookBtn')!.addEventListener('click', () => layout.show('appearance'));
setupResponsive();
