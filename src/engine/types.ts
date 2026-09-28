/**
 * Shared types used across the engine and by the UI.
 * If you are adding a feature, start here to see the shapes of the data that move around.
 */

// ---------- devices ----------

/** What a device event sends to its handler. */
export type EventPayload = 'agent' | '?agent' | 'none';

/** One Creative device's events and simple actions, from Epic's Verse API. */
export interface DeviceInfo {
  /** Event name → what it sends. Example: InteractedWithEvent → 'agent'. */
  events: Record<string, EventPayload>;
  /** Actions with no inputs, or one agent. Methods that take an agent end in "(Agent)". */
  methods: string[];
}

export type DeviceCatalog = Record<string, DeviceInfo>;

// ---------- modules (using lines) ----------

export interface ModuleInfo {
  /** Full module path, e.g. /Verse.org/Random */
  path: string;
  /** Plain-English description of the module. */
  text: string;
  /** Names the module gives you, e.g. "GetRandomInt, GetRandomFloat". */
  unlocks: string;
}

// ---------- explanations ----------

/** The help shown for a block: tooltip, coach-panel text and a docs link. */
export interface Explain {
  title: string;
  doc: string;
  tip: string;
  text: string;
}

/** An explanation filled in for one specific block, with extra label/value rows. */
export interface ExplainView extends Explain {
  extra: Array<[label: string, value: string]>;
}

// ---------- warnings ----------

/** error: won't compile · tip: works, worth knowing · style: Epic style guide suggestion */
export type WarningLevel = 'error' | 'tip' | 'style';

/** A one-click repair offered next to a warning. */
export type Fix =
  | { label: string; kind: 'addUsing'; path: string }
  | { label: string; kind: 'setField'; type: string; match: string; field: string; value: string }
  | { label: string; kind: 'delete' }
  | { label: string; kind: 'rename'; from: string; to: string }
  | { label: string; kind: 'setBlockField'; id: string; field: string; value: string };

export interface Warning {
  /** Id of the block the warning belongs to. */
  id: string;
  msg: string;
  /** 'error' won't compile; 'tip' works but is worth knowing; 'style' follows Epic's style guide. */
  level: WarningLevel;
  fix: Fix | null;
}

// ---------- generated code ----------

/** Inclusive line range [first, last], 0-based. */
export type LineSpan = [number, number];

export interface GenerateResult {
  code: string;
  lines: string[];
  /** Block id → the lines of code that block produced. */
  spans: Record<string, LineSpan>;
  warnings: Warning[];
  /** True when using lines are added automatically. */
  autoUsing: boolean;
  /** Module path → the names in the code that need it. */
  needs: Record<string, string[]>;
}

// ---------- saved blocks (Blockly's JSON format) ----------

export interface BlockState {
  type: string;
  id?: string;
  x?: number;
  y?: number;
  fields?: Record<string, string | number | boolean>;
  /** An input can be empty (undefined), e.g. an if with nothing inside yet. */
  inputs?: Record<string, { block?: BlockState; shadow?: BlockState } | undefined>;
  next?: { block: BlockState };
}

export interface WorkspaceState {
  blocks: { languageVersion: 0; blocks: BlockState[] };
}

// ---------- text → blocks ----------

export interface ParseReport {
  /** How many blocks were made. */
  blocks: number;
  /** Verse kept word-for-word in raw blocks. */
  raw: string[];
  /** Top-level code that was left out, such as other classes. */
  skipped: string[];
  /** Anything the user should know about the conversion. */
  notes: string[];
}

export type ParseResult =
  /** sourceSpans: block id → the lines of the *original text* it came from (0-based). */
  | { ok: true; state: WorkspaceState; report: ParseReport; sourceSpans: Record<string, LineSpan> }
  | { ok: false; error: string; report: ParseReport };

// ---------- learning content ----------

export interface Lesson {
  title: string;
  concept: string;
  goal: string;
  steps: string[];
  /** Returns true when the generated code meets the goal. */
  check: (code: string, result?: GenerateResult) => boolean;
  /** Blocks to start from, or null to keep building on the previous lesson. */
  start: WorkspaceState | null;
}

/** A device the player places in UEFN for a template: [slot name, device type, UEFN name, setup tip]. */
export type TemplateDevice = [slot: string, type: string, label: string, tip: string];

export interface Template {
  id: string;
  title: string;
  kind: string;
  summary: string;
  teaches: string;
  devices: TemplateDevice[];
  steps: string[];
  /** The template's code, loaded through the text → blocks converter. */
  verse: string;
}
