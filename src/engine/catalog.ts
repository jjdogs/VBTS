/**
 * The Creative device catalog: every device's events and simple actions.
 * Data lives in data/devices.json (regenerate with scripts/extract-devices.py).
 */
import raw from './data/devices.json' with { type: 'json' };
import type { DeviceCatalog, DeviceInfo, EventPayload } from './types.ts';

type RawEntry = { e?: Record<string, string>; m?: string[]; a?: string[]; u?: string };

export const CATALOG: DeviceCatalog = {};
for (const [name, entry] of Object.entries(raw as Record<string, RawEntry>)) {
  CATALOG[name] = { events: (entry.e ?? {}) as Record<string, EventPayload>, methods: entry.m ?? [], actions: entry.a ?? [], ...(entry.u ? { module: entry.u } : {}) };
}

// Props you place and link like devices (not in the device digest): creative_prop can be shown,
// hidden, moved (MoveTo) and teleported (TeleportTo); see blocks/movement.ts.
CATALOG.creative_prop ??= { events: {}, methods: ['Show()', 'Hide()', 'Dispose()'], actions: [] };

/** Devices most maps use, shown first in the device dropdown. */
const COMMON = [
  'button_device', 'trigger_device', 'item_granter_device', 'timer_device', 'hud_message_device', 'score_manager_device',
  'mutator_zone_device', 'damage_volume_device', 'teleporter_device', 'player_spawner_device', 'elimination_manager_device',
  'end_game_device', 'prop_mover_device', 'capture_area_device', 'switch_device', 'barrier_device', 'vending_machine_device',
].filter(d => CATALOG[d]);

/** Every device type, common ones first, then the rest alphabetically. */
export const DEVICE_TYPES: readonly string[] =
  COMMON.concat(Object.keys(CATALOG).filter(d => !COMMON.includes(d)).sort());

export const deviceInfo = (type: string | undefined): DeviceInfo | undefined => (type ? CATALOG[type] : undefined);

/** The using path a device type needs: /Fortnite.com/Devices, or its own (Patchwork devices). */
export const deviceModule = (type: string): string => CATALOG[type]?.module ?? '/Fortnite.com/Devices';

/** "SetActiveDuration(Time:float, Agent:agent)" → name and inputs. */
export function parseAction(sig: string): { name: string; params: Array<{ name: string; type: string }> } {
  const m = sig.match(/^(\w+)\((.*)\)$/);
  if (!m) return { name: sig, params: [] };
  const params = m[2].split(',').map(p => p.trim()).filter(Boolean).map(p => { const [name, type] = p.split(':'); return { name, type }; });
  return { name: m[1], params };
}
