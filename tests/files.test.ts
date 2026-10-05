/**
 * Phase 4.2: the project format behind the Files panel and tabs — share codes, older saves,
 * file names, open tabs and the project's name.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_PROJECT_NAME, blankFile, decodeProject, encodeProject, normalizeProject, uniqueName } from '../src/ui/files.ts';

const device = (name: string) => ({ blocks: { languageVersion: 0 as const, blocks: [{ type: 'verse_device', fields: { NAME: name } }] } });

test('a VB3 share code round-trips every file, the open one, the tabs and the name', () => {
  const project = { files: [{ name: 'main', ws: device('main') }, { name: 'pets', ws: null }], current: 1, tabs: ['pets'], name: 'Arena game' };
  const code = encodeProject(project);
  assert.match(code, /^VB3:/);
  assert.deepEqual(decodeProject(code), project);
});

test('an older VB2 share code (one workspace) loads as a one-file project named after its device', () => {
  const vb2 = 'VB2:' + btoa(JSON.stringify(device('shared_thing')));
  assert.deepEqual(decodeProject(vb2), { files: [{ name: 'shared_thing', ws: device('shared_thing') }], current: 0, tabs: ['shared_thing'], name: DEFAULT_PROJECT_NAME });
});

test('older saves and empty storage become a valid project', () => {
  assert.deepEqual(normalizeProject(null), { files: [{ name: 'my_device', ws: null }], current: 0, tabs: ['my_device'], name: DEFAULT_PROJECT_NAME });
  assert.equal(normalizeProject(device('old_device')).files[0].name, 'old_device');
});

test('bad names, duplicate names and a bad open index are repaired', () => {
  const p = normalizeProject({ files: [{ name: 'a b', ws: device('main') }, { name: 'main', ws: null }, { name: 'main', ws: null }], current: 9 });
  assert.deepEqual(p.files.map(f => f.name), ['main', 'main_2', 'main_3']);
  assert.equal(p.current, 0);
});

test('older projects open every file as a tab; bad tab names are dropped and the open file always has a tab', () => {
  const files = [{ name: 'a', ws: null }, { name: 'b', ws: null }, { name: 'c', ws: null }];
  assert.deepEqual(normalizeProject({ files, current: 1 }).tabs, ['a', 'b', 'c']);
  assert.deepEqual(normalizeProject({ files, current: 2, tabs: ['a', 'zzz', 'a', 7] }).tabs, ['a', 'c']);
  assert.equal(normalizeProject({ files, current: 0, name: '   ' }).name, DEFAULT_PROJECT_NAME);
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
