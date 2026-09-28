/** Types for the (plain JavaScript) UI module, so main.ts can call it type-safely. */
import type Blockly from '../engine/blockly.ts';
import type { Engine } from '../engine/index.ts';

import type { WorkspaceSvg } from '../engine/blockly.ts';
import type { Layout } from './layout.ts';
import type { Appearance } from './appearance.ts';
import type { SyncStatus, TextView } from './text-editor.ts';
import type { GenerateResult, ProjectContext } from '../engine/index.ts';
import type { Files } from './files.ts';

export function startApp(options: {
  Blockly: typeof Blockly; V: Engine; MEDIA: Record<string, string>; layout: Layout; appearance: Appearance;
  makeTextView: (ws: WorkspaceSvg, current: () => GenerateResult, onStatus: (s: SyncStatus) => void, context: () => ProjectContext) => TextView;
}): { ws: WorkspaceSvg; current: () => GenerateResult; textView: TextView; files: Files };
