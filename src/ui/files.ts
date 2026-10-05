/**
 * Several files in one project (Phase 4.2): the Files panel and the editor's tabs.
 *
 *  - Every file is in the same Verse module, like .verse files in one UEFN folder: a class made in
 *    one file can be used in another without a using line (see engine/project.ts).
 *  - One file is on the workspace at a time. The others are kept as saved blocks, and the engine
 *    gets a summary of them (projectContext) so its checks can see across files.
 *  - The Files panel lists every file; the tabs are the files you have open. Click to open,
 *    double-click (or ⋯) to rename, × closes a tab (the file stays in the project).
 *  - Renaming a file renames the device or class inside it that has the file's name.
 *  - A dot marks files with problems: red = needs fixing, amber = style notes.
 *  - Share codes (VB3:…) carry every file. Older VB2 codes (one workspace) still load.
 */
import type Blockly from '../engine/blockly.ts';
import type { WorkspaceSvg } from '../engine/blockly.ts';
import type { Engine, ProjectContext, WorkspaceState, Warning } from '../engine/index.ts';
import { ICONS } from './icons.ts';
import { closeMenu, openMenu } from './menu.ts';

type BlocklyNS = typeof Blockly;

export interface FileEntry {
  /** File name without .verse. */
  name: string;
  ws: WorkspaceState | null;
}
export interface ProjectState {
  files: FileEntry[];
  /** Index of the open file. */
  current: number;
  /** Names of the files open as tabs, in tab order (always includes the current file). */
  tabs?: string[];
  /** The project's name, shown in the top bar. */
  name?: string;
}

/** File names: letters, digits and underscores, not starting with a digit (like Verse names). */
export const FILE_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
export const DEFAULT_PROJECT_NAME = 'My first project';

/** A new file: one device, named after the file (like UEFN's Verse device template). */
export const blankFile = (name: string): WorkspaceState =>
  ({ blocks: { languageVersion: 0, blocks: [{ type: 'verse_device', x: 30, y: 30, fields: { NAME: name } }] } });

/** base, base_2, base_3… whichever is free. */
export function uniqueName(files: FileEntry[], base: string, except = -1): string {
  const taken = (n: string) => files.some((f, i) => i !== except && f.name === n);
  let name = base;
  for (let i = 2; taken(name); i++) name = `${base}_${i}`;
  return name;
}

/** The first device's name, used to name a file that comes from an older single-file save. */
function nameFromState(state: WorkspaceState | null | undefined): string {
  const dev = state?.blocks?.blocks?.find(b => b.type === 'verse_device');
  const name = String(dev?.fields?.NAME ?? 'my_device');
  return FILE_NAME.test(name) ? name : 'my_device';
}

/** Makes any saved or shared project safe to use (unknown shapes become one file). */
export function normalizeProject(data: unknown): ProjectState {
  const raw = data as { files?: unknown; current?: unknown; tabs?: unknown; name?: unknown } | null;
  if (!raw || !Array.isArray(raw.files) || !raw.files.length) {
    // One workspace (a VB2 share code or an older save)
    const ws = (data && typeof data === 'object' && 'blocks' in data ? data : null) as WorkspaceState | null;
    const name = nameFromState(ws);
    return { files: [{ name, ws }], current: 0, tabs: [name], name: DEFAULT_PROJECT_NAME };
  }
  const files: FileEntry[] = [];
  for (const f of raw.files as Array<{ name?: unknown; ws?: unknown }>) {
    const ws = (f && typeof f.ws === 'object' ? f.ws : null) as WorkspaceState | null;
    const wanted = typeof f?.name === 'string' && FILE_NAME.test(f.name) ? f.name : nameFromState(ws);
    files.push({ name: uniqueName(files, wanted), ws });
  }
  const current = typeof raw.current === 'number' && raw.current >= 0 && raw.current < files.length ? Math.floor(raw.current) : 0;
  const names = new Set(files.map(f => f.name));
  // Older projects have no tab list: every file starts open.
  const tabs = Array.isArray(raw.tabs) ? [...new Set(raw.tabs.filter((t): t is string => typeof t === 'string' && names.has(t)))] : files.map(f => f.name);
  if (!tabs.includes(files[current].name)) tabs.push(files[current].name);
  const name = typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim().slice(0, 60) : DEFAULT_PROJECT_NAME;
  return { files, current, tabs, name };
}

const toBase64 = (s: string) => btoa(unescape(encodeURIComponent(s)));
const fromBase64 = (s: string) => decodeURIComponent(escape(atob(s)));

/** A share code for the whole project. */
export const encodeProject = (p: ProjectState): string => 'VB3:' + toBase64(JSON.stringify(p));
/** Reads a VB3 (project) or VB2 (one workspace) share code. Throws if it is damaged. */
export const decodeProject = (code: string): ProjectState =>
  normalizeProject(JSON.parse(fromBase64(code.trim().replace(/^VB\d:/, ''))));

export interface Problems { errors: number; notes: number }

export interface Files {
  current(): FileEntry;
  project(): ProjectState;
  /** Summary of every file except the open one (cached until files change). */
  context(): ProjectContext;
  /** Copies the workspace into the open file's entry and saves the project. */
  saveCurrent(): void;
  open(index: number): void;
  /** Adds a file (a blank one unless blocks are given) and opens it; then calls `after`. */
  add(name: string, state?: WorkspaceState | null, after?: () => void): void;
  /** Puts new blocks in a file (replacing what it held) and opens it; then calls `after`. */
  load(index: number, state: WorkspaceState, after?: () => void): void;
  indexOf(name: string): number;
  /** Replaces the whole project (share codes, blank project). Throws if the open file can't load. */
  replaceAll(project: ProjectState): void;
  setProjectName(name: string): void;
  /** Redraws the tabs and the Files panel. */
  render(): void;
  /** Redraws them unless a name is being edited (after the open file's problems change). */
  refresh(): void;
}

export function createFiles(opts: {
  B: BlocklyNS;
  ws: WorkspaceSvg;
  V: Engine;
  /** Where the tabs go (the editor bar). */
  tabsHost: HTMLElement;
  /** The Files panel's body, and the slot for its header buttons. */
  panelHost: HTMLElement;
  panelActions: HTMLElement;
  initial: ProjectState;
  /** Saves the project (browser storage). */
  persist: (p: ProjectState) => void;
  /** Called before leaving the open file; calls `then` once it is safe (the Text view may ask first). */
  beforeLeave: (then: () => void) => void;
  /** Called after another file was opened. */
  onOpened: () => void;
  /** The open file's warnings (the app generates it on every change). */
  currentWarnings: () => Warning[];
  /** Display choices from Look → Tabs and files. */
  prefs: () => { dots: boolean; ext: boolean };
  toast: (msg: string) => void;
}): Files {
  const { B, ws, V, tabsHost, panelHost } = opts;
  let project = normalizeProject(opts.initial);
  let cached: ProjectContext | null = null;
  /** Problems of files that are not open, worked out from their saved blocks. */
  let problemCache = new Map<string, Problems>();
  let editing: { name: string; where: 'tab' | 'list' } | null = null;

  const current = () => project.files[project.current];
  const tabs = () => project.tabs!;
  const persist = () => { cached = null; opts.persist(project); };

  function saveCurrent() {
    current().ws = B.serialization.workspaces.save(ws) as unknown as WorkspaceState;
    opts.persist(project);
  }

  /** Puts a file's blocks on the workspace. Undo history belongs to one file, so it starts fresh. */
  function show(state: WorkspaceState | null) {
    ws.clear();
    if (state) B.serialization.workspaces.load(state as never, ws);
    ws.clearUndo();
  }

  function switchTo(index: number) {
    project.current = index;
    if (!tabs().includes(current().name)) tabs().push(current().name);
    problemCache = new Map();
    persist();
    show(current().ws);
    render();
    opts.onOpened();
  }

  function open(index: number) {
    if (!project.files[index]) return;
    if (index === project.current) { if (!tabs().includes(current().name)) { tabs().push(current().name); persist(); render(); } return; }
    opts.beforeLeave(() => { saveCurrent(); switchTo(index); });
  }

  function add(name: string, state?: WorkspaceState | null, after?: () => void) {
    opts.beforeLeave(() => {
      saveCurrent();
      const n = uniqueName(project.files, FILE_NAME.test(name) ? name : 'new_file');
      project.files.push({ name: n, ws: state ?? blankFile(n) });
      switchTo(project.files.length - 1);
      after?.();
    });
  }

  function load(index: number, state: WorkspaceState, after?: () => void) {
    if (!project.files[index]) return;
    opts.beforeLeave(() => {
      if (index !== project.current) saveCurrent();
      project.files[index].ws = state;
      switchTo(index);
      after?.();
    });
  }

  /** The device or class named after the file follows a rename (top-level blocks only). */
  const RENAMES = ['verse_device', 'verse_class'];
  function rename(index: number, to: string) {
    const file = project.files[index];
    to = to.trim().replace(/\.verse$/, '');
    if (!to || to === file.name) return;
    if (!FILE_NAME.test(to)) { opts.toast('File names use letters, digits and _ (not starting with a digit)'); return; }
    if (project.files.some((f, i) => i !== index && f.name === to)) { opts.toast(`There is already a file called ${to}.verse`); return; }
    const from = file.name;
    file.name = to;
    project.tabs = tabs().map(t => (t === from ? to : t));
    if (index === project.current) {
      for (const b of ws.getTopBlocks(false)) if (RENAMES.includes(b.type) && b.getFieldValue('NAME') === from) b.setFieldValue(to, 'NAME');
    } else {
      for (const b of file.ws?.blocks?.blocks ?? []) if (RENAMES.includes(b.type) && b.fields?.NAME === from) b.fields.NAME = to;
    }
    problemCache = new Map();
    persist();
  }

  function remove(index: number) {
    if (project.files.length < 2) return;
    const name = project.files[index].name;
    project.tabs = tabs().filter(t => t !== name);
    if (index !== project.current) {
      project.files.splice(index, 1);
      if (index < project.current) project.current--;
      problemCache = new Map();
      persist(); render();
    } else {
      // Deleting the open file: nothing to keep from it, so no need to ask the Text view.
      project.files.splice(index, 1);
      const next = project.files.findIndex(f => tabs().includes(f.name));
      switchTo(next >= 0 ? next : Math.min(index, project.files.length - 1));
    }
    opts.toast(`Deleted ${name}.verse`);
  }

  /** Closes a tab (the file stays in the project). The last open tab can't be closed. */
  function closeTab(name: string) {
    const list = tabs();
    const at = list.indexOf(name);
    if (at < 0 || list.length < 2) return;
    if (name !== current().name) { list.splice(at, 1); persist(); render(); return; }
    const next = list[at + 1] ?? list[at - 1];
    opts.beforeLeave(() => {
      saveCurrent();
      list.splice(list.indexOf(name), 1);
      switchTo(project.files.findIndex(f => f.name === next));
    });
  }

  function replaceAll(next: ProjectState) {
    const before = project;
    project = normalizeProject(next);
    if (!next.name) project.name = before.name;
    try { switchTo(project.current); }
    catch (e) { project = before; switchTo(project.current); throw e; }
  }

  // ---------------- problems (the dots) ----------------
  function count(warnings: Warning[]): Problems {
    return { errors: warnings.filter(w => w.level === 'error').length, notes: warnings.filter(w => w.level === 'style').length };
  }
  function problemsOf(index: number): Problems {
    if (index === project.current) return count(opts.currentWarnings());
    const file = project.files[index];
    const hit = problemCache.get(file.name);
    if (hit) return hit;
    let result: Problems = { errors: 0, notes: 0 };
    try {
      const hidden = new B.Workspace();
      if (file.ws) B.serialization.workspaces.load(file.ws as never, hidden);
      const others = project.files.filter((_, i) => i !== index).map(f => (f === current() ? { name: f.name, state: B.serialization.workspaces.save(ws) as unknown as WorkspaceState } : { name: f.name, state: f.ws }));
      result = count(V.generate(hidden, V.projectContext(others)).warnings);
      hidden.dispose();
    } catch { /* a file that can't load shows no dot; opening it shows why */ }
    problemCache.set(file.name, result);
    return result;
  }
  function dot(p: Problems) {
    if (!opts.prefs().dots) return '';
    if (p.errors) return `<span class="fdot err" title="${p.errors} to fix" aria-label="${p.errors} to fix"></span>`;
    if (p.notes) return `<span class="fdot note" title="${p.notes} style note${p.notes > 1 ? 's' : ''}" aria-label="${p.notes} style notes"></span>`;
    return '';
  }

  // ---------------- tabs and the Files panel ----------------
  const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const renameBox = (name: string) => `<input class="ft-rename" value="${esc(name)}" aria-label="New name for ${esc(name)}.verse" spellcheck="false">`;
  function render() {
    const ext = opts.prefs().ext ? '<span class="ext">.verse</span>' : '';
    const canClose = tabs().length > 1;
    tabsHost.innerHTML = '<div class="ft-list" role="tablist" aria-label="Open files">' + tabs().map((name) => {
      const i = project.files.findIndex(f => f.name === name), on = i === project.current;
      if (editing?.where === 'tab' && editing.name === name) return renameBox(name);
      return `<div class="ft" role="tab" data-name="${esc(name)}" aria-selected="${on}" tabindex="${on ? 0 : -1}" title="${on ? 'Double-click to rename' : `Open ${esc(name)}.verse`}">${esc(name)}${ext}${dot(problemsOf(i))}${canClose ? `<button class="ft-close" data-act="close" aria-label="Close ${esc(name)}" title="Close tab">${ICONS.close}</button>` : ''}</div>`;
    }).join('') + `</div><button class="ft-add" data-act="add" aria-label="New file" title="New file (files in a project can use each other's classes)">${ICONS.plus}</button>`;

    panelHost.innerHTML = '<ul class="file-list" role="list">' + project.files.map((f, i) => {
      if (editing?.where === 'list' && editing.name === f.name) return `<li>${renameBox(f.name)}</li>`;
      return `<li><button class="fl-row" data-i="${i}" aria-current="${i === project.current}" title="Open ${esc(f.name)}.verse (double-click to rename)"><span class="fl-name">${esc(f.name)}</span>${dot(problemsOf(i))}</button><button class="fl-more" data-i="${i}" aria-label="${esc(f.name)} options" aria-haspopup="menu" title="Rename or delete">${ICONS.more}</button></li>`;
    }).join('') + '</ul><p class="fl-note">Names are linked: renaming a file renames the type inside it.</p>';

    const input = document.querySelector<HTMLInputElement>('.ft-rename');
    if (input && editing) {
      input.focus(); input.select();
      const target = editing.name;
      const done = (keep: boolean) => {
        if (!editing) return;
        editing = null;
        if (keep) rename(project.files.findIndex(f => f.name === target), input.value);
        render();
      };
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); done(true); }
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done(false); }
      });
      input.addEventListener('blur', () => done(true));
    }
    tabsHost.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  function fileMenu(index: number, anchor: HTMLElement) {
    const f = project.files[index];
    openMenu(anchor, [
      { label: 'Rename…', run: () => { editing = { name: f.name, where: 'list' }; render(); } },
      ...(tabs().includes(f.name) && tabs().length > 1 ? [{ label: 'Close tab', run: () => closeTab(f.name) }] : []),
      project.files.length > 1
        ? { label: `Delete ${f.name}.verse`, danger: true, keepOpen: true, run: (b: HTMLButtonElement) => {
          if (!b.dataset.armed) { b.dataset.armed = '1'; b.textContent = `Click again to delete ${f.name}.verse`; return; }
          closeMenu(); remove(index);
        } }
        : { note: 'This is the only file, so it can\'t be deleted.' },
    ]);
  }

  tabsHost.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t.closest('[data-act="add"]')) { add('new_file'); return; }
    const tab = t.closest<HTMLElement>('.ft');
    if (!tab) return;
    if (t.closest('[data-act="close"]')) { closeTab(tab.dataset.name!); return; }
    open(project.files.findIndex(f => f.name === tab.dataset.name));
  });
  tabsHost.addEventListener('auxclick', (e) => {
    const tab = (e.target as HTMLElement).closest<HTMLElement>('.ft');
    if (tab && e.button === 1) { e.preventDefault(); closeTab(tab.dataset.name!); }
  });
  tabsHost.addEventListener('dblclick', (e) => {
    const tab = (e.target as HTMLElement).closest<HTMLElement>('.ft');
    if (tab && tab.dataset.name === current().name && !(e.target as HTMLElement).closest('button')) { editing = { name: current().name, where: 'tab' }; render(); }
  });
  tabsHost.addEventListener('keydown', (e) => {
    const tab = (e.target as HTMLElement).closest<HTMLElement>('.ft');
    if (tab && (e.key === 'F2' || e.key === 'Enter')) { e.preventDefault(); editing = { name: tab.dataset.name!, where: 'tab' }; render(); }
  });
  panelHost.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const more = t.closest<HTMLElement>('.fl-more');
    if (more) { fileMenu(Number(more.dataset.i), more); return; }
    const row = t.closest<HTMLElement>('.fl-row');
    if (row) open(Number(row.dataset.i));
  });
  panelHost.addEventListener('dblclick', (e) => {
    const row = (e.target as HTMLElement).closest<HTMLElement>('.fl-row');
    if (row) { editing = { name: project.files[Number(row.dataset.i)].name, where: 'list' }; render(); }
  });
  opts.panelActions.innerHTML = `<button class="pb" data-act="new-file" aria-label="New file" title="New file">${ICONS.plus}</button>`;
  opts.panelActions.addEventListener('click', (e) => { if ((e.target as HTMLElement).closest('[data-act="new-file"]')) add('new_file'); });

  return {
    current,
    project: () => project,
    context: () => (cached ??= V.projectContext(project.files.filter((_, i) => i !== project.current).map(f => ({ name: f.name, state: f.ws })))),
    saveCurrent,
    open,
    add,
    load,
    indexOf: (name) => project.files.findIndex(f => f.name === name),
    replaceAll,
    setProjectName(name) { project.name = name.trim().slice(0, 60) || DEFAULT_PROJECT_NAME; persist(); },
    render,
    refresh: () => { if (!editing) render(); },
  };
}
