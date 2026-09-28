/**
 * Phase 4.2: the project format behind the file tabs — share codes, older saves, file names.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { blankFile, decodeProject, encodeProject, normalizeProject, uniqueName } from '../src/ui/files.ts';

const device = (name: string) => ({ blocks: { languageVersion: 0 as const, blocks: [{ type: 'verse_device', fields: { NAME: name } }] } });

test('a VB3 share code round-trips every file and the open one', () => {
  const project = { files: [{ name: 'main', ws: device('main') }, { name: 'pets', ws: null }], current: 1 };
  const code = encodeProject(project);
  assert.match(code, /^VB3:/);
  assert.deepEqual(decodeProject(code), project);
});

test('an older VB2 share code (one workspace) loads as a one-file project named after its device', () => {
  const vb2 = 'VB2:' + btoa(JSON.stringify(device('shared_thing')));
  assert.deepEqual(decodeProject(vb2), { files: [{ name: 'shared_thing', ws: device('shared_thing') }], current: 0 });
});

test('older saves and empty storage become a valid project', () => {
  assert.deepEqual(normalizeProject(null), { files: [{ name: 'my_device', ws: null }], current: 0 });
  assert.equal(normalizeProject(device('old_device')).files[0].name, 'old_device');
});

test('bad names, duplicate names and a bad open index are repaired', () => {
  const p = normalizeProject({ files: [{ name: 'a b', ws: device('main') }, { name: 'main', ws: null }, { name: 'main', ws: null }], current: 9 });
  assert.deepEqual(p.files.map(f => f.name), ['main', 'main_2', 'main_3']);
  assert.equal(p.current, 0);
});

test('damaged share codes throw', () => {
  assert.throws(() => decodeProject('VB3:not base64 at all!'));
});

test('new files get free names and a device named after them', () => {
  const files = [{ name: 'new_file', ws: null }, { name: 'new_file_2', ws: null }];
  assert.equal(uniqueName(files, 'new_file'), 'new_file_3');
  assert.equal(uniqueName(files, 'new_file', 0), 'new_file', 'a file may keep its own name');
  assert.equal(blankFile('scoring').blocks.blocks[0].fields?.NAME, 'scoring');
});
