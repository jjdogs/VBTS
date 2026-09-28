/**
 * The Text view: a real code editor (CodeMirror 6) that you type in directly.
 *
 * Two-way sync with the blocks:
 *  - You type → a moment after you pause, the text is converted into blocks. While you are
 *    typing, your text is never rewritten under you (formatting stays yours).
 *  - Blocks change (dragging in Blocks or Split view) → the text is replaced with the new code.
 *  - Leaving the Text view tidies your text into the standard format, so both views match.
 *  - Moving the cursor onto a line selects its block, so the Learn panel explains that line.
 */
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { bracketMatching, HighlightStyle, indentUnit, StreamLanguage, syntaxHighlighting } from '@codemirror/language';
import { EditorState, StateEffect, StateField, type Extension, RangeSetBuilder } from '@codemirror/state';
import { Decoration, type DecorationSet, drawSelection, EditorView, highlightActiveLine, highlightActiveLineGutter, keymap, lineNumbers } from '@codemirror/view';
import { tags } from '@lezer/highlight';
import type Blockly from '../engine/blockly.ts';
import type { WorkspaceSvg } from '../engine/blockly.ts';
import type { Engine, GenerateResult, LineSpan, ParseReport } from '../engine/index.ts';

type BlocklyNS = typeof Blockly;
/** How long after you stop typing the text is converted into blocks. */
const CONVERT_DELAY = 600;

// ---------------------------------------------------------------------------------------
// Verse highlighting (same colours as the block categories, via the Appearance variables)
// ---------------------------------------------------------------------------------------
const KEYWORDS = /^(using|class|if|else|for|loop|break|spawn|race|sync|rush|branch|block|not|and|or|return|true|false|then|do|defer|option|array|map)$/;
const TYPES = /^(int|float|logic|string|void|agent|player|message|creative_device|[a-z_]+_device)$/;

const verseLanguage = StreamLanguage.define<null>({
  name: 'verse',
  token(stream) {
    if (stream.eatSpace()) return null;
    if (stream.match(/#.*/)) return 'comment';
    if (stream.match(/"(?:\\.|[^"\\])*"?/)) return 'string';
    if (stream.match(/<[a-z]+>/) || stream.match('@editable')) return 'meta';
    if (stream.match(/\d+(?:\.\d+)?/)) return 'number';
    const word = stream.match(/[A-Za-z_]\w*/) as RegExpMatchArray | null;
    if (word) {
      const w = word[0];
      if (w === 'var' || w === 'set') return 'modifier';
      if (KEYWORDS.test(w)) return 'keyword';
      if (stream.match(/\s*\(/, false)) return 'function';
      if (TYPES.test(w)) return 'typeName';
      return null;
    }
    stream.next();
    return null;
  },
  tokenTable: { function: tags.function(tags.variableName), modifier: tags.modifier },
});

const verseColours = HighlightStyle.define([
  { tag: tags.keyword, color: 'var(--t-kw)', fontWeight: '600' },
  { tag: tags.modifier, color: 'var(--t-var)', fontWeight: '600' },
  { tag: tags.string, color: 'var(--t-str)' },
  { tag: tags.number, color: 'var(--t-num)' },
  { tag: tags.meta, color: 'var(--t-spec)' },
  { tag: tags.typeName, color: 'var(--t-type)' },
  { tag: tags.function(tags.variableName), color: 'var(--t-fn)' },
  { tag: tags.comment, color: 'var(--t-com)', fontStyle: 'italic' },
]);

/** Looks like the old Text view: editor background, code font and size from Appearance. */
const editorLook = EditorView.theme({
  '&': { height: '100%', backgroundColor: 'var(--code-bg)', color: 'var(--ink)', fontSize: 'var(--code-size, 13.5px)' },
  '.cm-scroller': { fontFamily: 'var(--mono)', lineHeight: 'var(--code-lh, 1.65)', fontVariantLigatures: 'none', fontFeatureSettings: '"liga" 0, "calt" 0', paddingBottom: '40px' },
  '.cm-content': { padding: '12px 0', caretColor: 'var(--accent)' },
  '.cm-gutters': { backgroundColor: 'var(--code-bg)', color: 'var(--t-com)', border: 'none', paddingLeft: '6px' },
  '.cm-lineNumbers .cm-gutterElement': { padding: '0 14px 0 6px', minWidth: '2.2em' },
  '.cm-activeLine': { backgroundColor: 'color-mix(in srgb, var(--hl) 45%, transparent)' },
  '.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--ink)' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--accent)', borderLeftWidth: '2px' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': { backgroundColor: 'color-mix(in srgb, var(--accent) 30%, transparent)' },
  '&.cm-focused': { outline: 'none' },
  '.cm-block-hl': { backgroundColor: 'var(--hl)', boxShadow: 'inset 3px 0 0 var(--accent)' },
  '.cm-matchingBracket': { backgroundColor: 'color-mix(in srgb, var(--accent) 22%, transparent)', outline: 'none' },
});

// Lines belonging to the selected block
const setBlockLines = StateEffect.define<LineSpan | null>();
const blockLines = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(deco, tr) {
    deco = deco.map(tr.changes);
    for (const e of tr.effects) {
      if (!e.is(setBlockLines)) continue;
      if (!e.value) { deco = Decoration.none; continue; }
      const b = new RangeSetBuilder<Decoration>();
      const [first, last] = e.value;
      for (let n = first + 1; n <= Math.min(last + 1, tr.state.doc.lines); n++) {
        const line = tr.state.doc.line(n);
        b.add(line.from, line.from, Decoration.line({ class: 'cm-block-hl' }));
      }
      deco = b.finish();
    }
    return deco;
  },
  provide: f => EditorView.decorations.from(f),
});

// ---------------------------------------------------------------------------------------
export type SyncStatus =
  | { kind: 'synced' }
  | { kind: 'pending' }
  | { kind: 'raw'; report: ParseReport }
  | { kind: 'error'; message: string };

export interface TextView {
  /** Shows code that came from the blocks (unless you are in the middle of typing). */
  showGenerated(result: GenerateResult): void;
  /** Highlights the lines of a block (and scrolls to them if asked). */
  highlightBlock(id: string | null, reveal: boolean): void;
  /** The text as shown. */
  text(): string;
  /** Converts any typed text that is waiting to be converted, right now. */
  flush(): void;
  /** Replaces your text with the standard format of the current blocks. */
  tidy(): void;
  topLine(): number;
  showLineAtTop(line: number): void;
  onScroll(fn: () => void): void;
  focus(): void;
  /** Types text into the editor as if the user did (used by tests and pasting). */
  typeText(text: string): void;
  /** Inserts code at the cursor on its own line(s), indented to match (Toolbox clicks). */
  insertSnippet(code: string): void;
}

export function createTextView(opts: {
  parent: HTMLElement;
  B: BlocklyNS;
  ws: WorkspaceSvg;
  V: Engine;
  current: () => GenerateResult;
  onStatus: (s: SyncStatus) => void;
  /** Called after typed text became blocks (to save, update lessons…). */
  onConverted?: (report: ParseReport) => void;
}): TextView {
  const { parent, B, ws, V, current, onStatus } = opts;
  let dirty = false;           // typed text not converted yet
  let echo: string | null = null; // the code the blocks produced from your text (not pushed back)
  let timer = 0;
  let selecting = false;
  /** Your text at the last conversion, and which of its lines each block came from. */
  let sourceText: string | null = null;
  let sourceSpans: Record<string, LineSpan> = {};

  const extensions: Extension[] = [
    lineNumbers(), highlightActiveLineGutter(), highlightActiveLine(), history(), drawSelection(), bracketMatching(),
    EditorState.tabSize.of(4), indentUnit.of('    '),
    keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
    verseLanguage, syntaxHighlighting(verseColours), editorLook, blockLines,
    EditorView.contentAttributes.of({ 'aria-label': 'Verse code. Type to edit; blocks update when you pause.', spellcheck: 'false', autocapitalize: 'off', autocorrect: 'off' }),
    EditorView.updateListener.of((u) => {
      const typed = u.transactions.some(tr => tr.isUserEvent('input') || tr.isUserEvent('delete') || tr.isUserEvent('undo') || tr.isUserEvent('redo') || tr.isUserEvent('move'));
      if (u.docChanged && typed) {
        dirty = true;
        onStatus({ kind: 'pending' });
        clearTimeout(timer);
        timer = window.setTimeout(convert, CONVERT_DELAY);
      }
      // You moved the cursor (keys or a click): explain the block on that line.
      if (!u.docChanged && u.transactions.some(tr => tr.isUserEvent('select'))) selectBlockAtCursor();
    }),
  ];
  const view = new EditorView({ state: EditorState.create({ doc: '', extensions }), parent });

  const text = () => view.state.doc.toString();
  /**
   * Which lines each block covers in the text on screen: the generated code's map when the text
   * is exactly that code, or the converter's map of your own text (your formatting), or none
   * while you are typing.
   */
  function lineMap(): Record<string, LineSpan> | null {
    if (dirty) return null;
    const t = text();
    if (t === current().code) return current().spans;
    if (t === sourceText) return sourceSpans;
    return null;
  }
  /** Lines of a block, or of the nearest block around it that has lines. */
  function linesOf(id: string | null): LineSpan | null {
    const map = lineMap();
    if (!map || !id) return null;
    for (let b = ws.getBlockById(id); b; b = b.getParent()) if (map[b.id]) return map[b.id];
    return null;
  }

  function replaceText(code: string) {
    const top = view.scrollDOM.scrollTop;
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: code } });
    view.scrollDOM.scrollTop = top;
  }

  /** Typed text → blocks. */
  function convert() {
    clearTimeout(timer);
    if (!dirty) return;
    const res = V.parseVerse(text());
    if (!res.ok) { onStatus({ kind: 'error', message: res.error }); return; }
    document.body.dataset.textSync = '1'; // tells the layout not to jump to the top
    B.Events.setGroup(true);
    try {
      ws.clear();
      B.serialization.workspaces.load(res.state as never, ws);
    } finally { B.Events.setGroup(false); }
    ws.clearUndo();
    echo = V.generate(ws).code;
    sourceText = text();
    sourceSpans = res.sourceSpans;
    dirty = false;
    onStatus(res.report.raw.length || res.report.notes.length || res.report.skipped.length ? { kind: 'raw', report: res.report } : { kind: 'synced' });
    opts.onConverted?.(res.report);
    if (view.dom.contains(document.activeElement)) selectBlockAtCursor(); // explain the line you just typed
    window.setTimeout(() => { delete document.body.dataset.textSync; }, 200);
  }

  function selectBlockAtCursor() {
    const map = lineMap();
    if (!map) return;
    const line = view.state.doc.lineAt(view.state.selection.main.head).number - 1;
    let best: string | null = null, size = Infinity;
    for (const [id, [a, z]] of Object.entries(map)) if (line >= a && line <= z && z - a < size) { best = id; size = z - a; }
    const block = best ? ws.getBlockById(best) : null;
    // setSelected (not block.select(), which only draws the highlight) fires Blockly's selected event.
    if (block) { selecting = true; B.common.setSelected(block as never); selecting = false; }
  }

  return {
    showGenerated(result) {
      if (dirty) return;                       // you are typing: don't rewrite your text
      if (echo !== null && result.code === echo) return; // this came from your own text
      echo = null;
      if (result.code !== text()) replaceText(result.code);
      onStatus({ kind: 'synced' });
    },
    highlightBlock(id, reveal) {
      const valid = linesOf(id);
      view.dispatch({ effects: setBlockLines.of(valid) });
      if (valid && reveal && !selecting) {
        const line = view.state.doc.line(Math.min(valid[0] + 1, view.state.doc.lines));
        view.dispatch({ effects: EditorView.scrollIntoView(line.from, { y: 'nearest', yMargin: 60 }) });
      }
    },
    text,
    flush: convert,
    tidy() {
      convert();
      echo = null;
      const code = current().code;
      if (!dirty && code !== text()) replaceText(code);
      if (!dirty) { sourceText = null; onStatus({ kind: 'synced' }); }
    },
    topLine() {
      const block = view.lineBlockAtHeight(view.scrollDOM.scrollTop + 4);
      return view.state.doc.lineAt(block.from).number - 1;
    },
    showLineAtTop(line) {
      const n = Math.max(1, Math.min(line + 1, view.state.doc.lines));
      view.dispatch({ effects: EditorView.scrollIntoView(view.state.doc.line(n).from, { y: 'start', yMargin: 8 }) });
    },
    onScroll(fn) { view.scrollDOM.addEventListener('scroll', fn, { passive: true }); },
    focus() { view.focus(); },
    insertSnippet(code) {
      const state = view.state;
      const line = state.doc.lineAt(state.selection.main.head);
      const indent = /^\s*/.exec(line.text)![0];
      const lines = code.split('\n').map((l, i) => (i === 0 ? l : indent + l));
      const blank = !line.text.trim();
      const from = blank ? line.from : line.to;
      const insert = (blank ? indent : '\n' + indent) + lines.join('\n');
      view.dispatch({ changes: { from, to: blank ? line.to : line.to, insert }, selection: { anchor: from + insert.length }, userEvent: 'input.paste', scrollIntoView: true });
      view.focus();
    },
    typeText(t) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: t }, userEvent: 'input.paste' });
    },
  };
}
