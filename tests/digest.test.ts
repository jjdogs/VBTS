/**
 * The Verse that blocks write, checked against Epic's API digests (scripts/data/digest/, copied
 * from UEFN). When a new digest moves or renames something, this says what to update.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { HANDLER_INPUTS, VALUE_EVENTS } from '../src/engine/data/handlers.ts';
import { MODULES } from '../src/engine/data/modules.ts';
import { TEAM_OPS } from '../src/engine/data/teams.ts';
import { TYPE_MODULES } from '../src/engine/data/verse-types.ts';

interface Decl { name: string; module: string; owner: string; code: string }

/** Every declaration in the digests, with the module it is in and the class it belongs to. */
function readDigests(): { decls: Decl[]; modules: Set<string> } {
  const decls: Decl[] = [], modules = new Set<string>();
  for (const [file, root] of [['Fortnite', '/Fortnite.com'], ['UnrealEngine', '/UnrealEngine.com'], ['Verse', '/Verse.org']]) {
    const open: Array<{ indent: number; kind: 'module' | 'class'; name: string }> = [];
    for (const line of readFileSync(`scripts/data/digest/${file}.digest.verse`, 'utf8').split('\n')) {
      const code = line.trim();
      if (!code || /^(#|@|<#|using\b)/.test(code)) continue;
      const indent = line.length - line.trimStart().length;
      while (open.length && indent <= open[open.length - 1].indent) open.pop();
      const module = [...open].reverse().find(o => o.kind === 'module')?.name ?? '';
      const owner = [...open].reverse().find(o => o.kind === 'class')?.name ?? '';
      // (/Fortnite.com:)UI<public> := module:   or   Devices<public> := module:
      const mod = code.match(/^(?:\(([^)]*):\))?(\w+)(?:<\w+>)* := module:/);
      if (mod) {
        const path = `${mod[1] ?? (module || root)}/${mod[2]}`;
        modules.add(path);
        open.push({ indent, kind: 'module', name: path });
        continue;
      }
      // (InAgent:agent).GetFortCharacter<native>…, (/Verse.org/Simulation:)team…, Sleep<native>…
      const name = code.match(/^(?:\((?:[^()]|\([^()]*\))*\)\.)?(?:\([^)]*:\))?(\w+)/)?.[1];
      if (!name) continue;
      decls.push({ name, module, owner, code });
      if (/:= (class|interface|struct|enum)\b/.test(code) && code.endsWith(':')) open.push({ indent, kind: 'class', name });
    }
  }
  return { decls, modules };
}

const { decls, modules } = readDigests();
const declared = (name: string, where: (d: Decl) => boolean = () => true) => decls.filter(d => d.name === name && where(d));
const isType = (d: Decl) => !d.owner && /:= (class|interface|struct|enum)\b/.test(d.code);

describe('the API digests', () => {
  test('are read (Fortnite, Unreal Engine and Verse)', () => {
    assert.ok(decls.length > 5000, `${decls.length} declarations`);
    for (const m of ['/Fortnite.com/Devices', '/UnrealEngine.com/Temporary/SpatialMath', '/Verse.org/Simulation']) assert.ok(modules.has(m), m);
  });

  test('every type is in the module its using line names', () => {
    for (const [type, module] of Object.entries(TYPE_MODULES)) {
      const found = declared(type, isType);
      assert.ok(found.some(d => d.module === module), `${type} is in ${found.map(d => d.module).join(', ') || 'no module'}, not ${module}`);
    }
  });

  test('every module in the "using" list exists', () => {
    for (const { path } of MODULES) assert.ok(modules.has(path), path);
  });

  test('handler inputs are real types', () => {
    for (const { type } of Object.values(HANDLER_INPUTS)) {
      if (type) assert.ok(declared(type.replace(/^\?/, ''), isType).length, type);
    }
  });

  test('value events send what the blocks expect', () => {
    for (const [event, sends] of Object.entries(VALUE_EVENTS)) {
      const found = declared(event, d => /^\w+(<\w+>)*\(\):listenable\(/.test(d.code));
      assert.ok(found.some(d => d.code.includes(`:listenable(${sends})`)), `${event}: ${found.map(d => d.code).join(' | ') || 'not found'}`);
    }
  });
});

describe('the Verse blocks write matches the digests', () => {
  /** [name, where it is declared (module or class), the declaration must contain…] */
  const API: Array<[string, string, string]> = [
    ['Sleep', '/Verse.org/Simulation', '(Seconds:float)<suspends>:void'],
    ['Print', '/Verse.org/Verse', '(Message:string,'],
    ['GetRandomInt', '/Verse.org/Random', '(Low:int, High:int)<transacts>:int'],
    ['GetFortCharacter', '/Fortnite.com/Characters', '<decides>:fort_character'],
    ['GetAgent', 'fort_character', '<decides>:agent'],
    ['GetPlayspace', '/Fortnite.com/Devices', ':fort_playspace'],
    ['GetPlayers', 'fort_playspace', ':[]player'],
    ['GetTeamCollection', 'fort_playspace', ':fort_team_collection'],
    ['GetTeams', 'fort_team_collection', ':[]team'],
    ['Damage', 'damageable', '(Amount:float):void'],
    ['Heal', 'healable', '(Amount:float):void'],
    ['SetHealth', 'healthful', '(Health:float)'],
    ['GetHealth', 'healthful', ':float'],
    ['SetShield', 'shieldable', '(Shield:float)'],
    ['GetShield', 'shieldable', ':float'],
    ['EliminatedCharacter', 'elimination_result', ':fort_character'],
    ['EliminatingCharacter', 'elimination_result', ':?fort_character'],
    ['TeleportTo', 'fort_character', '<decides>:void'],
    ['TeleportTo', 'creative_object', '<decides>:void'],
    ['MoveTo', 'creative_object', 'OverTime:float)<suspends>'],
    ['GetTransform', 'positional', ':(/UnrealEngine.com/Temporary/SpatialMath:)transform'],
    ['MakeRotationFromYawPitchRollDegrees', '/UnrealEngine.com/Temporary/SpatialMath', '(YawRightDegrees:float, PitchUpDegrees:float, RollClockwiseDegrees:float)'],
    ['IdentityRotation', '/UnrealEngine.com/Temporary/SpatialMath', ':(/UnrealEngine.com/Temporary/SpatialMath:)rotation'],
    ['Distance', '/UnrealEngine.com/Temporary/SpatialMath', 'vector3)<reads>:float'],
    ['DistanceXY', '/UnrealEngine.com/Temporary/SpatialMath', 'vector3)<reads>:float'],
    ['GetPlayerUI', '/UnrealEngine.com/Temporary/UI', '(Player:player)<transacts><decides>:player_ui'],
    ['AddWidget', 'player_ui', '(Widget:widget, Slot:player_ui_slot):void'],
    ['InputMode', 'player_ui_slot', ':ui_input_mode'],
    ['SetText', 'text_base', '(InText:message):void'],
    ['SetText', 'hud_message_device', '(Text:message):void'],
  ];
  for (const [name, where, has] of API) {
    test(`${where} ${name}`, () => {
      const found = declared(name, d => d.module === where || d.owner === where);
      assert.ok(found.some(d => d.code.includes(has)), `${name} in ${where} should contain "${has}": ${found.map(d => d.code).join(' | ') || 'not found'}`);
    });
  }

  test('the team questions take the inputs the team block gives them, and can fail', () => {
    for (const [op, { inputs }] of Object.entries(TEAM_OPS)) {
      const params = inputs.map(i => (i === 'WHO' ? 'InAgent:agent' : 'InTeam:team')).join(', ');
      const found = declared(op, d => d.owner === 'fort_team_collection');
      assert.ok(found.some(d => d.code.includes(`(${params})`) && d.code.includes('<decides>')), `${op}: ${found.map(d => d.code).join(' | ')}`);
    }
  });
});
