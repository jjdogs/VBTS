/**
 * Verse Blocks user interface: coach panel, lessons, code view, dialogs, templates.
 *
 * This is the original UI code, moved here unchanged apart from how it is started:
 * it now receives Blockly, the engine and the embedded icons from main.ts instead of
 * finding them as globals. It talks to the engine only through `V` (see src/engine/index.ts).
 */
import { blankFile, createFiles, decodeProject, encodeProject, normalizeProject } from './files.ts';
import { mountWorkspaceControls } from './workspace-controls.ts';

export function startApp({ Blockly, V, MEDIA, layout, appearance, makeTextView }) {
  if (!Blockly) { document.querySelector('main').style.display = 'none'; document.getElementById('loadErr').style.display = 'block'; return; }
  const KEY = 'verse-blocks:v1';
  const store = {
    get() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } },
    set(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {} },
  };
  let state = Object.assign({ lesson: 0, done: [], view: null, ws: null, project: null }, store.get());
  // Phase 4.2: a project of files. Older saves held one workspace (state.ws); it becomes the first file.
  if (!state.project) { state.project = normalizeProject(state.ws); delete state.ws; }
  else state.project = normalizeProject(state.project);
  const $ = (id) => document.getElementById(id);
  const toast = (msg) => { const t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 1800); };

  // ---- theme ----
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const isDark = () => { const a = document.documentElement.dataset.theme; return a ? a === 'dark' : mq.matches; };
  // The Blockly theme now comes from the Appearance settings (ui/appearance.ts).

  // Blockly's control icons (zoom, re-center, trash) normally load from Google's demo server,
  // which published pages block. Serve embedded copies instead.
  const swapMedia = (el) => {
    for (const attr of ['href', 'xlink:href']) {
      const v = el.getAttribute(attr) || (attr === 'xlink:href' && el.getAttributeNS('http://www.w3.org/1999/xlink', 'href'));
      if (v && v.startsWith('vb-media/')) {
        const data = MEDIA[v.slice(9)];
        if (data) { el.setAttribute('href', data); el.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', data); }
      }
    }
  };
  // Blockly's stylesheet also uses the sprite sheet (dropdown checkmarks, category icons).
  const spriteCss = document.createElement('style');
  spriteCss.textContent = `.blocklyToolboxCategoryIcon, .blocklyMenuItemSelected .blocklyMenuItemCheckbox { background-image: url(${MEDIA['sprites.svg']}) !important; }`;
  document.head.appendChild(spriteCss);
  // Swap the path the moment Blockly sets it, before the browser tries to fetch it.
  const fromMedia = (v) => (typeof v === 'string' && v.startsWith('vb-media/') && MEDIA[v.slice(9)]) || v;
  const _setNS = Element.prototype.setAttributeNS, _set = Element.prototype.setAttribute;
  Element.prototype.setAttributeNS = function (ns, n, v) { return _setNS.call(this, ns, n, /href$/.test(n) ? fromMedia(v) : v); };
  Element.prototype.setAttribute = function (n, v) { return _set.call(this, n, /href$/.test(n) ? fromMedia(v) : v); };
  new MutationObserver((muts) => muts.forEach((m) => {
    if (m.type === 'attributes') swapMedia(m.target);
    m.addedNodes && m.addedNodes.forEach((n) => { if (n.nodeType !== 1) return; if (n.tagName === 'image') swapMedia(n); n.querySelectorAll && n.querySelectorAll('image').forEach(swapMedia); });
  })).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['href', 'xlink:href'] });

  const startScale = () => window.innerWidth < 700 ? Math.min(0.7, appearance.settings().blockScale) : appearance.settings().blockScale;
  const ws = Blockly.inject('blocklyDiv', {
    media: 'vb-media/',
    sounds: false,
    // Like-text blocks use Blockly's compact, flat renderer so rows sit close to text line height.
    toolbox: V.TOOLBOX, renderer: appearance.settings().blockStyle === 'text' ? 'thrasos' : appearance.settings().renderer, theme: appearance.theme(Blockly),
    grid: { spacing: 28, length: 2, colour: isDark() ? '#2A2650' : '#DEDAF2', snap: true },
    // Zoom buttons and the trash are our own small controls (ui/workspace-controls.ts).
    zoom: { controls: false, wheel: true, startScale: startScale(), maxScale: 2, minScale: 0.35 },
    trashcan: false,
    // "Like text" layout: no map-style dragging; the wheel scrolls (ui/unified.ts can switch these live)
    move: { scrollbars: true, drag: appearance.settings().layout !== 'document', wheel: appearance.settings().layout === 'document' },
  });
  document.querySelectorAll('image').forEach(swapMedia);
  new ResizeObserver(() => Blockly.svgResize(ws)).observe($('blocksPane'));
  mountWorkspaceControls({ Blockly, ws, host: $('blocksPane'), startScale });


  let last = { code: '', lines: [], spans: {}, warnings: [] };
  let selectedId = null;
  // The Text view is a real editor (ui/text-editor.ts); typing there updates the blocks.
  const statusEl = $('syncStatus');
  let lastReport = null;
  function setStatus(s) {
    statusEl.className = 'sync ' + s.kind;
    statusEl.onclick = null; statusEl.removeAttribute('role'); statusEl.tabIndex = -1;
    if (s.kind === 'synced') statusEl.textContent = 'In sync with blocks';
    if (s.kind === 'pending') statusEl.textContent = 'Updating blocks…';
    if (s.kind === 'error') statusEl.textContent = `Can't make blocks yet: ${s.message}`;
    if (s.kind === 'raw') {
      lastReport = s.report;
      const n = s.report.raw.length;
      statusEl.textContent = n ? `${n} piece${n > 1 ? 's' : ''} kept as raw Verse · details` : 'In sync · notes';
      statusEl.setAttribute('role', 'button'); statusEl.tabIndex = 0;
      statusEl.onclick = () => { showReport(lastReport); layout.show('learn'); $('coach').scrollTop = 0; };
    }
    statusEl.title = statusEl.textContent; // readable on hover when the bar is crowded
  }
  const textView = makeTextView(ws, () => last, setStatus, () => files.context());
  const files = createFiles({
    B: Blockly, ws, V, host: $('fileTabs'), initial: state.project, toast,
    persist: (p) => { state.project = p; store.set(state); },
    // Leaving a file: typed text must become blocks first (or be replaced), as when leaving the Text view.
    beforeLeave: (then) => { if (textView.tidy()) then(); else askToDiscard(then); },
    onOpened: () => { ws.scrollCenter(); renderSetup(); },
  });
  function render() {
    last = V.generate(ws, files.context()); // the other files' classes and names are known too
    last.fileName = files.current().name + '.verse';
    if (typeof renderSetup === 'function' && render.ready) renderSetup();
    textView.showGenerated(last);
    const wl = $('warnList');
    wl.innerHTML = '';
    const seen = new Set();
    const list = last.warnings.filter(w => { const k = w.id + w.msg; if (seen.has(k)) return false; seen.add(k); return true; })
      .sort((x, y) => RANK[x.level] - RANK[y.level]);
    const errs = list.filter(w => w.level === 'error').length;
    $('warnHead').textContent = errs ? `Needs fixing (${errs})` : 'Needs fixing';
    if (!errs) { const li = document.createElement('li'); li.innerHTML = '<p class="fine">Nothing to fix. This should compile.</p>'; wl.appendChild(li); }
    list.forEach((w) => {
      const li = document.createElement('li'); li.className = 'warn-row' + (w.level !== 'error' ? ` ${w.level}` : '');
      const b = document.createElement('button'); b.textContent = (w.level === 'tip' ? 'Tip: ' : '') + w.msg; b.onclick = () => focusBlock(w.id);
      li.appendChild(b);
      if (w.fix) { const f = document.createElement('button'); f.className = 'fix'; f.textContent = w.fix.label; f.onclick = () => applyFix(w); li.appendChild(f); }
      wl.appendChild(li);
    });
    paintHL();
  }
  // Errors first, then tips, then style-guide notices.
  const RANK = { error: 0, tip: 1, style: 2 };
  function applyFix(w) {
    const fx = w.fix; const blk = ws.getBlockById(w.id);
    Blockly.Events.setGroup(true);
    try {
      if (fx.kind === 'delete' && blk) blk.dispose(true);
      if (fx.kind === 'rename') V.renameEverywhere(ws, fx.from, fx.to);
      if (fx.kind === 'setBlockField') { const t = ws.getBlockById(fx.id); if (t) t.setFieldValue(fx.value, fx.field); }
      if (fx.kind === 'setField') ws.getBlocksByType(fx.type).filter(x => x.getFieldValue('NAME') === fx.match).forEach(x => x.setFieldValue(fx.value, fx.field));
      if (fx.kind === 'addUsing') {
        const dev = blk && blk.type === 'verse_device' ? blk : ws.getBlocksByType('verse_device')[0]; if (!dev) return;
        const known = V.MODULES.some(m => m.path === fx.path);
        const u = ws.newBlock(known ? 'verse_using' : 'verse_using_custom');
        u.setFieldValue(fx.path, known ? 'MODULE' : 'PATH'); u.initSvg(); u.render();
        let tail = dev.getInputTargetBlock('USINGS');
        if (!tail) dev.getInput('USINGS').connection.connect(u.previousConnection);
        else { while (tail.getNextBlock()) tail = tail.getNextBlock(); tail.nextConnection.connect(u.previousConnection); }
      }
    } finally { Blockly.Events.setGroup(false); }
    toast('Fixed');
  }
  function spanFor(id) {
    let b = ws.getBlockById(id);
    while (b) { if (last.spans[b.id]) return last.spans[b.id]; b = b.getParent(); }
    return null;
  }
  function paintHL() {
    textView.highlightBlock(selectedId, document.body.dataset.view === 'split');
  }
  function focusBlock(id) {
    const b = ws.getBlockById(id); if (!b) return;
    if (document.body.dataset.view === 'text') setView('blocks');
    Blockly.common.setSelected(b); ws.centerOnBlock(id);
  }
  function explain(id) {
    const box = $('explain'); const b = id && ws.getBlockById(id);
    const e = b && V.explainFor(b);
    if (!e) { box.innerHTML = '<p class="coach-h">Selected block</p><p class="empty">Click any block to see what it does in Verse.</p>'; return; }
    box.innerHTML = '<p class="coach-h">Selected block</p>';
    const h = document.createElement('h3'); h.textContent = e.title; box.appendChild(h);
    const p = document.createElement('p'); p.textContent = e.text; box.appendChild(p);
    (e.extra || []).forEach(([k, v]) => { const x = document.createElement('p'); x.className = 'extra'; x.innerHTML = '<b></b><span></span>'; x.querySelector('b').textContent = k; x.querySelector('span').textContent = v; box.appendChild(x); });
    const a = document.createElement('a'); a.target = '_blank'; a.rel = 'noopener'; a.href = e.doc; a.textContent = "Read about this in Epic's Verse docs"; box.appendChild(a);
  }

  let saveT;
  ws.addChangeListener((ev) => {
    if (ev.type === Blockly.Events.SELECTED) { selectedId = ev.newElementId; explain(selectedId); paintHL(); return; }
    if (ev.isUiEvent) return;
    render();
    if (selectedId && ev.blockId === selectedId) explain(selectedId);
    clearTimeout(saveT); saveT = setTimeout(() => files.saveCurrent(), 400);
  });

  // ---- lessons ----
  function loadStarter(i) {
    const L = V.LESSONS[i]; if (!L.start) return;
    textView.discardTyped(); // the text is about to be replaced by the lesson's
    ws.clear(); Blockly.serialization.workspaces.load(L.start, ws); ws.scrollCenter();
  }
  function renderLesson() {
    const i = state.lesson, L = V.LESSONS[i];
    const nav = $('lessonNav'); nav.innerHTML = '';
    V.LESSONS.forEach((l, j) => {
      const b = document.createElement('button');
      b.className = 'lesson-dot' + (state.done.includes(j) ? ' done' : '');
      b.textContent = j + 1; b.title = l.title; b.setAttribute('aria-label', `Lesson ${j + 1}: ${l.title}${state.done.includes(j) ? ' (done)' : ''}`);
      if (j === i) b.setAttribute('aria-current', 'true');
      b.onclick = () => { state.lesson = j; store.set(state); renderLesson(); };
      nav.appendChild(b);
    });
    const el = $('lesson');
    el.innerHTML = `<h2></h2><p class="concept"></p><p class="goal"></p><ol></ol>
      <div class="lesson-actions"><button class="btn btn-primary" id="checkBtn">Check my work</button><button class="btn" id="freshBtn"></button></div>
      <div class="result" id="result"></div>`;
    el.querySelector('h2').textContent = `${i + 1}. ${L.title}`;
    el.querySelector('.concept').textContent = `Learn: ${L.concept}`;
    el.querySelector('.goal').textContent = L.goal;
    const ol = el.querySelector('ol'); L.steps.forEach((s) => { const li = document.createElement('li'); li.textContent = s; ol.appendChild(li); });
    const fresh = $('freshBtn');
    if (L.start) {
      fresh.textContent = 'Start fresh';
      fresh.onclick = () => {
        if (fresh.dataset.armed) { loadStarter(i); fresh.textContent = 'Start fresh'; delete fresh.dataset.armed; toast('Workspace reset for this lesson'); return; }
        fresh.dataset.armed = '1'; fresh.textContent = 'Replace my blocks?';
        setTimeout(() => { if (fresh.isConnected) { delete fresh.dataset.armed; fresh.textContent = 'Start fresh'; } }, 3500);
      };
    } else { fresh.textContent = 'Builds on the last lesson'; fresh.disabled = true; fresh.style.opacity = .6; fresh.style.cursor = 'default'; }
    $('checkBtn').onclick = () => {
      const r = $('result'); r.className = 'result show';
      if (L.check(last.code, last)) {
        if (!state.done.includes(i)) state.done.push(i); store.set(state);
        r.classList.add('pass');
        r.innerHTML = i < V.LESSONS.length - 1 ? 'That’s valid Verse. <button class="btn" id="nextBtn" style="margin-left:6px">Next lesson</button>' : 'That’s valid Verse — you finished every lesson. Try the Text view and build your own device.';
        const nb = $('nextBtn'); if (nb) nb.onclick = () => { state.lesson = i + 1; store.set(state); renderLesson(); };
        renderLessonDots();
      } else {
        r.classList.add('fail');
        r.textContent = last.warnings.some(w => w.level === 'error') ? 'Not yet. Start with the items under “Needs fixing”, then check again.' : 'Not yet. Compare your Verse text with the goal — names and numbers must match exactly.';
      }
    };
  }
  function renderLessonDots() { document.querySelectorAll('.lesson-dot').forEach((b, j) => b.classList.toggle('done', state.done.includes(j))); }

  // ---- view + actions ----
  function setView(v) {
    // Leaving the Text view: convert anything typed, and tidy the text into the standard format.
    // If the text can't become blocks, stay here and explain (switching would leave the two apart).
    if (document.body.dataset.view === 'text' && v !== 'text' && !textView.tidy()) { askToDiscard(() => setView(v)); return; }
    document.body.dataset.view = v; state.view = v; store.set(state);
    const toggle = $('viewToggle');
    toggle.textContent = v === 'text' ? 'Show Blocks' : 'Show Text';
    toggle.hidden = v === 'split';
    document.querySelectorAll('.seg button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === v)));
    setTimeout(() => { Blockly.svgResize(ws); paintHL(); }, 30);
  }
  /** Text can't become blocks: keep editing, or go on (then) and replace the text with the blocks' code. */
  let afterDiscard = null;
  function askToDiscard(then) {
    afterDiscard = then;
    $('syncWhy').textContent = textView.pendingError() || 'The text has a problem Verse Blocks can\'t read yet.';
    $('syncDlg').showModal();
  }
  $('syncKeep').onclick = () => { $('syncDlg').close(); textView.focus(); };
  $('syncDiscard').onclick = () => {
    $('syncDlg').close();
    textView.discardTyped();
    toast('Text replaced with the code from your blocks');
    const then = afterDiscard; afterDiscard = null;
    if (then) then();
  };
  document.querySelectorAll('.seg button').forEach((b) => (b.onclick = () => setView(b.dataset.view)));
  $('viewToggle').onclick = () => {
    const to = document.body.dataset.view === 'text' ? 'blocks' : 'text';
    setView(to);
    if (to === 'text') setTimeout(() => textView.focus(), 80);
  };
  /** The code as you see it (anything typed is converted first). */
  const shownCode = () => { textView.flush(); return document.body.dataset.view === 'blocks' ? last.code : textView.text(); };
  $('copyBtn').onclick = async () => {
    const code = shownCode();
    try { await navigator.clipboard.writeText(code); toast('Verse copied'); }
    catch (e) {
      const ta = document.createElement('textarea'); ta.value = code; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); toast('Verse copied'); } catch (e2) { toast('Select the text view to copy'); }
      ta.remove();
    }
  };
  if (location.protocol === 'file:' || /^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
    const d = $('dlBtn'); d.hidden = false;
    d.onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([shownCode()], { type: 'text/plain' })); a.download = last.fileName || 'my_device.verse'; a.click(); };
  }

  // ---- project: share codes ----
  // VB3 codes hold every file of the project; older VB2 codes (one workspace) still load.
  $('projBtn').onclick = () => { files.saveCurrent(); $('shareOut').value = encodeProject(files.project()); $('shareIn').value = ''; $('projDlg').showModal(); };
  $('projClose').onclick = () => $('projDlg').close();
  $('shareCopy').onclick = async () => {
    const t = $('shareOut'); try { await navigator.clipboard.writeText(t.value); } catch (e) { t.select(); try { document.execCommand('copy'); } catch (e2) {} }
    toast('Share code copied');
  };
  $('shareLoad').onclick = () => {
    let data; try { data = decodeProject($('shareIn').value); } catch (e) { toast('That share code is incomplete or damaged'); return; }
    // replaceAll puts the old project back if the new one can't load, so a bad code loses nothing.
    files.saveCurrent();
    textView.discardTyped();
    try { files.replaceAll(data); $('projDlg').close(); toast(data.files.length > 1 ? `Project loaded (${data.files.length} files)` : 'Project loaded'); }
    catch (e) { toast('Those blocks could not be loaded. Your blocks were kept.'); }
  };
  $('newProj').onclick = () => {
    const b = $('newProj');
    if (!b.dataset.armed) { b.dataset.armed = '1'; b.textContent = 'Replace my blocks?'; return; }
    delete b.dataset.armed; b.textContent = 'Start a blank project';
    textView.discardTyped();
    files.replaceAll({ files: [{ name: 'my_device', ws: blankFile('my_device') }], current: 0 });
    $('projDlg').close(); toast('Blank project ready');
  };

  // ---- text -> blocks ----
  const escT = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  function showReport(r) {
    const box = $('importReport'); box.hidden = false;
    const rawN = r.raw.length;
    let h = `<p class="coach-h">Last conversion</p><p>Made ${r.blocks} blocks.${rawN ? ` ${rawN} piece${rawN > 1 ? 's were' : ' was'} kept as gray <b>raw Verse</b> blocks because ${rawN > 1 ? 'they have' : 'it has'} no block yet — nothing was lost.` : ' Everything became real blocks.'}</p>`;
    if (rawN) h += '<ul>' + r.raw.slice(0, 6).map(x => `<li><code>${escT(x)}</code></li>`).join('') + (rawN > 6 ? `<li>…and ${rawN - 6} more</li>` : '') + '</ul>';
    r.notes.forEach(n => { h += `<p>${escT(n)}</p>`; });
    if (r.skipped.length) h += '<ul>' + r.skipped.map(x => `<li><code>${escT(x)}</code></li>`).join('') + '</ul>';
    h += '<button class="btn" id="reportClose">Dismiss</button>';
    box.innerHTML = h; $('reportClose').onclick = () => { box.hidden = true; };
  }
  /** Opens a template as its own file (named after it), replacing that file if it already exists. */
  function openTemplate(t) {
    const res = V.parseVerse(t.verse);
    if (!res.ok) { toast(res.error); return; }
    const done = () => {
      state.setup = { id: t.id, done: [] }; store.set(state); renderSetup();
      toast(`${t.title} opened in ${t.id}.verse`);
      layout.show('learn');
      $('coach').scrollTop = 0;
    };
    const at = files.indexOf(t.id);
    if (at < 0) files.add(t.id, res.state, done);
    else files.load(at, res.state, done);
  }
  // ---- templates + map setup checklist ----
  function renderTemplates() {
    $('tmplList').innerHTML = V.TEMPLATES.map((t) => `<div class="tcard"><h3>${escT(t.title)}</h3><p class="kind">${escT(t.kind)}</p><p>${escT(t.summary)}</p><p><b>Teaches:</b> ${escT(t.teaches)}</p><div class="dlg-actions"><button class="btn btn-primary" data-t="${t.id}">${files.indexOf(t.id) < 0 ? `Open as ${escT(t.id)}.verse` : 'Load template'}</button></div></div>`).join('');
    $('tmplList').querySelectorAll('button[data-t]').forEach((b) => {
      b.onclick = () => {
        const t = V.TEMPLATES.find(x => x.id === b.dataset.t);
        // A new file needs no confirmation; replacing the template's existing file does.
        if (files.indexOf(t.id) >= 0 && !b.dataset.armed) { b.dataset.armed = '1'; b.textContent = `Replace ${t.id}.verse?`; return; }
        $('tmplDlg').close();
        openTemplate(t);
      };
    });
  }
  $('tmplBtn').onclick = () => { renderTemplates(); $('tmplDlg').showModal(); };
  $('tmplClose').onclick = () => $('tmplDlg').close();
  function renderSetup() {
    const box = $('setup'); const st = state.setup; const t = st && V.TEMPLATES.find(x => x.id === st.id);
    // Only show the checklist while the template's device is in the workspace.
    if (!t || !ws.getBlocksByType('verse_device').some(d => d.getFieldValue('NAME') === t.id)) { box.hidden = true; return; }
    if (!box.hidden && box.dataset.for === JSON.stringify(st)) return;
    box.dataset.for = JSON.stringify(st);
    box.hidden = false;
    let k = 0; const item = (html) => { const id = k++; return `<li><label><input type="checkbox" data-k="${id}" ${st.done.includes(id) ? 'checked' : ''}><span>${html}</span></label></li>`; };
    let h = `<p class="coach-h">Map setup</p><h2>${escT(t.title)}</h2><p class="kind">Tick things off as you build the map in UEFN.</p>`;
    h += '<p class="setup-sub">Devices to place</p><ul class="checks">' + t.devices.map(([n, ty, label, tip]) => item(`<span class="dev-row">${escT(label)} → link to <b>${escT(n)}</b></span><br><small>${escT(tip)}</small>`)).join('') + '</ul>';
    h += '<p class="setup-sub">Steps</p><ul class="checks">' + t.steps.map((s) => item(escT(s))).join('') + '</ul>';
    const total = t.devices.length + t.steps.length;
    h += `<p class="kind">${st.done.length} of ${total} done</p><button class="btn" id="setupClose">Hide checklist</button>`;
    box.innerHTML = h;
    box.querySelectorAll('input[type=checkbox]').forEach((c) => c.onchange = () => {
      const id = +c.dataset.k; st.done = st.done.filter(x => x !== id); if (c.checked) st.done.push(id); store.set(state); renderSetup();
    });
    $('setupClose').onclick = () => { state.setup = null; store.set(state); renderSetup(); };
  }

  // ---- roadmap ----
  const PHASES = [
    ['done', 'Phase 1: Core blocks, split view, lessons 1–9'],
    ['done', 'Phase 2: using & modules, all 115 official devices, one-click fixes, share codes'],
    ['done', 'Phase 3: Data — arrays, maps, options, function inputs and results, <decides>'],
    ['done', 'Phase 3.5: Responsive UI — phones, tablets, laptops, big screens, touch'],
    ['done', 'Phase 3.6: Edit Mode (Appearance), one-window editor, type directly in Text view'],
    ['done', 'Phase 4.1: Your own classes, structs and enums; <private> (style 6.2)'],
    ['done', 'Phase 4.2: Multiple files — tabs, classes shared across files, whole-project share codes'],
    ['done', 'Phase 5: Players & teams, UI widgets, positions and movement'],
    ['done', 'Phase 6: Text ⇄ blocks — type directly in the Text view'],
    ['next', 'Phase 7: VS Code extension (on hold: web-only for now)'],
    ['next', 'Phase 8: Game-mode templates (target gallery, team elimination, parkour, shop menu)'],
  ];
  $('roadmap').innerHTML = PHASES.map(([st, t], i) => {
    const cls = st === 'done' ? 'done' : (PHASES.findIndex(p => p[0] !== 'done') === i ? 'now' : '');
    return `<li class="${cls}"><i aria-hidden="true"></i><span>${escT(t)}${st === 'done' ? ' (done)' : ''}</span></li>`;
  }).join('');

  // ---- boot ----
  const saved = files.current().ws;
  if (saved) { try { Blockly.serialization.workspaces.load(saved, ws); ws.clearUndo(); } catch (e) { loadStarter(0); } }
  else loadStarter(0);
  files.render();
  setView(state.view || 'blocks'); // one main window by default; Split is an option
  render.ready = true;
  renderLesson(); render(); renderSetup();

  return { ws, current: () => last, textView, files };
}
