/**
 * Projects with several files (Phase 4.2).
 *
 * Every file in a project sits in the same Verse module, the way .verse files in one UEFN folder
 * do: a class or enum made in one file can be used in another without a using line, and each
 * name can only be defined once. The blocks of one file are on the workspace; the other files are
 * summarised here (what they define and which names they use), so checks and the text → blocks
 * converter can see across files.
 */
import Blockly from './blockly.ts';
import type { Block } from './blockly.ts';
import { enumsIn, typesIn } from './blocks/types.ts';
import type { WorkspaceState } from './types.ts';

export interface ProjectFile {
  /** File name without .verse, e.g. "my_device". */
  name: string;
  state: WorkspaceState | null;
}

export interface ProjectContext {
  /** Top-level names (device classes, classes, structs, enums) → the file that defines them. */
  definitions: Map<string, string>;
  /** Classes and structs made in other files: name → kind, fields and methods. */
  types: ReturnType<typeof typesIn>;
  /** Enums made in other files: name → values. */
  enums: Map<string, string[]>;
  /** Every name another file refers to (fields, methods, variables, calls…). */
  references: Set<string>;
  /** Text typed in other files (raw Verse, starting values), searched for .Name and Name :=. */
  texts: string[];
}

export const emptyProject = (): ProjectContext =>
  ({ definitions: new Map(), types: new Map(), enums: new Map(), references: new Set(), texts: [] });

/** Top-level blocks that define a name for the whole module. */
export const DEFINING_BLOCKS = ['verse_device', 'verse_class', 'verse_enum'];
/** Fields that name something, on any block. */
const NAME_FIELDS = ['NAME', 'VAR', 'KEY', 'MEMBER', 'METHOD', 'HANDLER', 'OBJ', 'TYPE', 'PARENT', 'DEVICE', 'F1', 'F2', 'F3', 'F4'];

const field = (b: Block, n: string) => (b.getField(n) ? String(b.getFieldValue(n) ?? '') : '');

/** Summarises the given files (usually every file except the one being edited). */
export function projectContext(files: ProjectFile[]): ProjectContext {
  const ctx = emptyProject();
  const ws = new Blockly.Workspace();
  try {
    for (const file of files) {
      ws.clear();
      if (!file.state) continue;
      try { Blockly.serialization.workspaces.load(file.state as never, ws); } catch { continue; }
      for (const b of ws.getTopBlocks(false)) {
        if (DEFINING_BLOCKS.includes(b.type) && b.isEnabled() && !ctx.definitions.has(field(b, 'NAME'))) ctx.definitions.set(field(b, 'NAME'), file.name);
      }
      for (const [name, info] of typesIn(ws)) if (!ctx.types.has(name)) ctx.types.set(name, info);
      for (const [name, values] of enumsIn(ws)) if (!ctx.enums.has(name)) ctx.enums.set(name, values);
      for (const b of ws.getAllBlocks(false)) {
        for (const n of NAME_FIELDS) { const v = field(b, n); if (v) ctx.references.add(v); }
        const text = b.type === 'verse_member_field' ? field(b, 'DEFAULT') : b.type.startsWith('verse_raw') ? field(b, 'CODE') : '';
        if (text) ctx.texts.push(text);
      }
    }
  } finally {
    ws.dispose();
  }
  return ctx;
}
