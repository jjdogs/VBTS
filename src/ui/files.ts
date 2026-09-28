/**
 * Several files in one project (Phase 4.2), shown as tabs in the file bar.
 *
 *  - Every file is in the same Verse module, like .verse files in one UEFN folder: a class made in
 *    one file can be used in another without a using line (see engine/project.ts).
 *  - One file is on the workspace at a time. The others are kept as saved blocks, and the engine
 *    gets a summary of them (projectContext) so its checks can see across files.
 *  - Click a tab to open that file; click the open tab for Rename and Delete; + makes a new file.
 *  - Share codes (VB3:…) carry every file. Older VB2 codes (one workspace) still load.
 */
import type Blockly from '../engine/blockly.ts';
import type { WorkspaceSvg } from '../engine/blockly.ts';
import type { Engine, ProjectContext, WorkspaceState } from '../engine/index.ts';

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
}

/** File names: letters, digits and underscores, not starting with a digit (like Verse names). */
export const FILE_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

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
  const raw = data as { files?: unknown; current?: unknown } | null;
  if (!raw || !Array.isArray(raw.files) || !raw.files.length) {
    // One workspace (a VB2 share code or an older save)
    const ws = (data && typeof data === 'object' && 'blocks' in data ? data : null) as WorkspaceState | null;
    return { files: [{ name: nameFromState(ws), ws }], current: 0 };
  }
  const files: FileEntry[] = [];
  for (const f of raw.files as Array<{ name?: unknown; ws?: unknown }>) {
    const ws = (f && typeof f.ws === 'object' ? f.ws : null) as WorkspaceState | null;
    const wanted = typeof f?.name === 'string' && FILE_NAME.test(f.name) ? f.name : nameFromState(ws);
    files.push({ name: uniqueName(files, wanted), ws });
  }
  const current = typeof raw.current === 'number' && raw.current >= 0 && raw.current < files.length ? Math.floor(raw.current) : 0;
  return { files, current };
}

const toBase64 = (s: string) => btoa(unescape(encodeURIComponent(s)));
const fromBase64 = (s: string) => decodeURIComponent(escape(atob(s)));

/** A share code for the whole project. */
export const encodeProject = (p: ProjectState): string => 'VB3:' + toBase64(JSON.stringify(p));
/** Reads a VB3 (project) or VB2 (one workspace) share code. Throws if it is damaged. */
export const decodeProject = (code: string): ProjectState =>
  normalizeProject(JSON.parse(fromBase64(code.trim().replace(/^VB\d:/, ''))));

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
  render(): void;
}

export function createFiles(opts: {
  B: BlocklyNS;
  ws: WorkspaceSvg;
  V: Engine;
  host: HTMLElement;
  initial: ProjectState;
  /** Saves the project (browser storage). */
  persist: (p: ProjectState) => void;
  /** Called before leaving the open file; calls `then` once it is safe (the Text view may ask first). */
  beforeLeave: (then: () => void) => void;
  /** Called after another file was opened. */
  onOpened: () => void;
  toast: (msg: string) => void;
}): Files {
  const { B, ws, V, host } = opts;
  let project = opts.initial;
  let cached: ProjectContext | null = null;
  let editing = -1; // tab being renamed

  const current = () => project.files[project.current];
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
    persist();
    show(current().ws);
    render();
    opts.onOpened();
  }

  function open(index: number) {
    if (index === project.current || !project.files[index]) return;
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

  function rename(index: number, to: string) {
    const file = project.files[index];
    to = to.trim().replace(/\.verse$/, '');
    if (!to || to === file.name) return;
    if (!FILE_NAME.test(to)) { opts.toast('File names use letters, digits and _ (not starting with a digit)'); return; }
    if (project.files.some((f, i) => i !== index && f.name === to)) { opts.toast(`There is already a file called ${to}.verse`); return; }
    const from = file.name;
    file.name = to;
    // A device still named after its file (like a new file's) follows the new name.
    if (index === project.current) {
      const dev = ws.getBlocksByType('verse_device', false).find(d => d.getFieldValue('NAME') === from);
      if (dev) dev.setFieldValue(to, 'NAME');
    }
    persist();
  }

  function remove(index: number) {
    if (project.files.length < 2) return;
    if (index !== project.current) {
      project.files.splice(index, 1);
      if (index < project.current) project.current--;
      persist(); render();
      return;
    }
    // Deleting the open file: nothing to keep from it, so no need to ask the Text view.
    const name = project.files[index].name;
    project.files.splice(index, 1);
    switchTo(Math.min(index, project.files.length - 1));
    opts.toast(`Deleted ${name}.verse`);
  }

  function replaceAll(next: ProjectState) {
    const before = project;
    project = next;
    try { switchTo(project.current); }
    catch (e) { project = before; switchTo(project.current); throw e; }
  }

  // ---------------- tabs ----------------
  const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  function render() {
    host.innerHTML = '<div class="ft-list" role="tablist" aria-label="Files in this project">' + project.files.map((f, i) => i === editing
      ? `<input class="ft-rename" data-i="${i}" value="${esc(f.name)}" aria-label="New name for ${esc(f.name)}.verse" spellcheck="false">`
      : `<button class="ft" role="tab" data-i="${i}" aria-selected="${i === project.current}" title="${i === project.current ? 'Rename or delete this file' : `Open ${esc(f.name)}.verse`}">${esc(f.name)}<span class="ext">.verse</span></button>`,
    ).join('') + '</div><button class="ft-add" data-act="add" aria-label="New file" title="New file (same project: files can use each other\'s classes)">+</button>';
    const input = host.querySelector<HTMLInputElement>('.ft-rename');
    if (input) {
      input.focus(); input.select();
      const done = (save: boolean) => {
        if (editing < 0) return;
        const i = editing; editing = -1;
        if (save) rename(i, input.value);
        render();
      };
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); done(true); }
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done(false); }
      });
      input.addEventListener('blur', () => done(true));
    }
    host.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  // ---------------- the open tab's menu ----------------
  let menu: HTMLElement | null = null;
  const closeMenu = () => { menu?.remove(); menu = null; };
  function openMenu(anchor: HTMLElement) {
    closeMenu();
    const i = project.current;
    const items: Array<[string, (b: HTMLButtonElement) => void]> = [
      ['Rename…', () => { closeMenu(); editing = i; render(); }],
    ];
    if (project.files.length > 1) {
      items.push(['Delete this file', (b) => {
        if (!b.dataset.armed) { b.dataset.armed = '1'; b.textContent = `Click again to delete ${current().name}.verse`; return; }
        closeMenu(); remove(i);
      }]);
    } else {
      items.push(['This is the only file, so it can\'t be deleted.', () => {}]);
    }
    menu = document.createElement('div');
    menu.className = 'panel-menu';
    menu.setAttribute('role', 'menu');
    items.forEach(([label, run], k) => {
      const b = document.createElement('button');
      b.setAttribute('role', 'menuitem');
      b.textContent = label;
      if (project.files.length < 2 && k === 1) { b.className = 'note'; b.setAttribute('aria-disabled', 'true'); }
      b.onclick = () => run(b);
      menu!.appendChild(b);
    });
    document.body.appendChild(menu);
    const r = anchor.getBoundingClientRect();
    menu.style.top = `${r.bottom + 4}px`;
    menu.style.left = `${Math.max(8, Math.min(window.innerWidth - menu.offsetWidth - 8, r.left))}px`;
    (menu.firstElementChild as HTMLElement).focus();
  }
  document.addEventListener('pointerdown', (e) => { if (menu && !menu.contains(e.target as Node) && !(e.target as Element).closest?.('.ft[aria-selected="true"]')) closeMenu(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });

  host.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t.closest('[data-act="add"]')) { add('new_file'); return; }
    const tab = t.closest<HTMLElement>('.ft');
    if (!tab) return;
    const i = Number(tab.dataset.i);
    if (i === project.current) { if (menu) closeMenu(); else openMenu(tab); }
    else open(i);
  });
  host.addEventListener('dblclick', (e) => {
    const tab = (e.target as HTMLElement).closest<HTMLElement>('.ft');
    if (tab && Number(tab.dataset.i) === project.current) { closeMenu(); editing = project.current; render(); }
  });

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
    render,
  };
}
