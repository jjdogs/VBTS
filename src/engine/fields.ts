/**
 * Custom Blockly fields used by Verse blocks.
 */
import Blockly from './blockly.ts';
import type { Block, BlockSvg, Field, FieldDropdownValidator, MenuGeneratorFunction, MenuOption } from './blockly.ts';
import { devicesInScope, type PlacedDevice } from './workspace.ts';

export type Option = [label: string, value: string];
type OptionSource = (this: LooseDropdown) => Option[];

/**
 * A dropdown whose options are worked out live from the workspace (your devices, your handlers…).
 * It also accepts any saved value, even if that option isn't available yet. This matters when
 * loading a project: a "when MyButton…" block may load before the MyButton device does.
 */
export class LooseDropdown extends Blockly.FieldDropdown {
  private readonly source: OptionSource;

  constructor(source: OptionSource, validator?: FieldDropdownValidator) {
    super(source as unknown as MenuGeneratorFunction, validator);
    this.source = source;
  }

  override getOptions(): MenuOption[] {
    let options: Option[];
    try { options = this.source.call(this); } catch { options = []; }
    if (!options || !options.length) options = [['(none yet)', '']];
    const current = this.value_;
    if (current && !options.some(o => o[1] === current)) options = options.concat([[current, current]]);
    return options;
  }

  protected override doClassValidation_(value?: unknown): string | null {
    return value == null ? null : String(value);
  }
}

/**
 * Creates a LooseDropdown for use in `appendField`.
 * (Blockly's type definitions reject subclasses of FieldDropdown in appendField, although
 * they work fine at runtime, so the field is returned typed as a plain Field.)
 */
export const looseDropdown = (source: OptionSource, validator?: FieldDropdownValidator): Field =>
  new LooseDropdown(source, validator) as unknown as Field;

/** A text box that only accepts valid Verse names (letters, digits, underscores; no leading digit). */
export const nameField = (initial: string): Field =>
  new Blockly.FieldTextInput(initial, (s: string) => (s && /^[A-Za-z_][A-Za-z0-9_]*$/.test(s) ? s : null));

/** Options listing the @editable devices on the workspace, optionally filtered. */
export function deviceOptions(filter?: (d: PlacedDevice) => boolean): OptionSource {
  return function (this: LooseDropdown) {
    const ds = devicesInScope(this.getSourceBlock()).filter(d => !filter || filter(d));
    return ds.length ? ds.map(d => [d.name, d.name] as Option) : [['MyDevice', 'MyDevice']];
  };
}

/** Gives empty dropdowns their first real option, so new blocks start out useful. */
export function prime(block: Block, names: string[]): void {
  for (const n of names) {
    const f = block.getField(n);
    if (f instanceof Blockly.FieldDropdown && !f.getValue()) {
      const first = f.getOptions()[0];
      if (first && first[1]) f.setValue(first[1]);
    }
  }
}

/** Re-draws a block after its shape changed (queued, so it is safe during loading). */
export function rerender(block: Block): void {
  const svg = block as BlockSvg;
  if (!svg.rendered) return;
  if (typeof svg.queueRender === 'function') void svg.queueRender();
  else svg.render();
}
