/**
 * The coach panel's "Selected block" explanation, filled in with details for the block's
 * current settings (which module, which device's events and actions).
 */
import type { Block } from './blockly.ts';
import { deviceInfo } from './catalog.ts';
import { moduleInfo } from './data/modules.ts';
import { EXPLAIN } from './registry.ts';
import type { ExplainView } from './types.ts';
import { deviceTypeFor } from './workspace.ts';

const DEVICE_BLOCKS = ['verse_editable', 'verse_call_device', 'verse_subscribe'];

export function explainFor(block: Block): ExplainView | null {
  const base = EXPLAIN[block.type];
  if (!base) return null;
  const view: ExplainView = { ...base, extra: [] };

  if (block.type === 'verse_using') {
    const path = String(block.getFieldValue('MODULE'));
    const info = moduleInfo(path);
    if (info) {
      view.title = `using { ${path} }`;
      view.extra.push(['What it unlocks', info.text], ['Names you get', info.unlocks]);
    }
  }

  if (DEVICE_BLOCKS.includes(block.type)) {
    const type = block.type === 'verse_editable'
      ? String(block.getFieldValue('DTYPE'))
      : deviceTypeFor(block, String(block.getFieldValue('DEVICE')));
    const info = deviceInfo(type);
    if (info && type) {
      const events = Object.entries(info.events).map(([name, sends]) => `${name} (sends ${sends === 'none' ? 'nothing' : sends})`);
      view.extra.push([`${type} events`, events.length ? events.join(', ') : 'none']);
      view.extra.push([`${type} actions`, info.methods.length ? info.methods.join(', ') : 'none without extra inputs']);
    }
  }
  return view;
}
