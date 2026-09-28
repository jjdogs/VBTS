/**
 * The Creative device catalog: every device's events and simple actions.
 * Data lives in data/devices.json (regenerate with scripts/extract-devices.py).
 */
import raw from './data/devices.json' with { type: 'json' };
import type { DeviceCatalog, DeviceInfo, EventPayload } from './types.ts';

type RawEntry = { e?: Record<string, string>; m?: string[] };

export const CATALOG: DeviceCatalog = {};
for (const [name, entry] of Object.entries(raw as Record<string, RawEntry>)) {
  CATALOG[name] = { events: (entry.e ?? {}) as Record<string, EventPayload>, methods: entry.m ?? [] };
}

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
