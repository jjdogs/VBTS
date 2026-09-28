/** Shared setup for tests: a headless Blockly workspace and the engine. */
import Blockly from '../src/engine/blockly.ts';
import { createEngine } from '../src/engine/index.ts';
import type { ProjectContext } from '../src/engine/project.ts';
import type { GenerateResult, WorkspaceState } from '../src/engine/types.ts';

export const engine = createEngine();
export const workspace = () => new Blockly.Workspace();

/** Loads saved blocks into a workspace and generates its Verse (with the project's other files, if given). */
export function generateFrom(state: WorkspaceState, ws = workspace(), project?: ProjectContext): GenerateResult {
  ws.clear();
  Blockly.serialization.workspaces.load(state as never, ws);
  return engine.generate(ws, project);
}

/** The parts of a result the golden file records. */
export const signature = (r: GenerateResult) => ({
  code: r.code,
  warnings: r.warnings.map(w => [w.level, w.msg, w.fix && w.fix.label]),
  autoUsing: r.autoUsing,
  needs: r.needs,
  spanCount: Object.keys(r.spans).length,
});

/** Verse → blocks → Verse. */
export function reconvert(code: string): { code: string; raw: string[] } {
  const parsed = engine.parseVerse(code);
  if (!parsed.ok) throw new Error(parsed.error);
  return { code: generateFrom(parsed.state).code, raw: parsed.report.raw };
}
