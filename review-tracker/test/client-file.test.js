import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { readClientFile, upsertClient, writeClientFile, slugify } from '../src/client-file.js';

const client = (id, placeId, name = id) => ({ id, name, placeId, competitors: [] });

test('adding a second practice keeps the first', () => {
  const start = { agency: {}, clients: [client('a', 'pa')] };
  const { config, replaced } = upsertClient(start, client('b', 'pb'));
  assert.deepEqual(config.clients.map((c) => c.id), ['a', 'b']);
  assert.equal(replaced, false);
});

test('re-running for the same practice updates it rather than duplicating', () => {
  const start = { agency: {}, clients: [{ ...client('a', 'pa'), competitors: [{ name: 'old', placeId: 'x' }] }] };
  const { config, replaced } = upsertClient(start, { ...client('a', 'pa'), competitors: [{ name: 'new', placeId: 'y' }] });
  assert.equal(config.clients.length, 1);
  assert.equal(config.clients[0].competitors[0].name, 'new');
  assert.equal(replaced, true);
});

test('a practice re-added under a different id is still recognised by its place ID', () => {
  const start = { agency: {}, clients: [client('old-name', 'same-place')] };
  const { config, replaced } = upsertClient(start, client('new-name', 'same-place'));
  assert.equal(config.clients.length, 1, 'the same shop must not be tracked twice');
  assert.equal(config.clients[0].id, 'new-name');
  assert.equal(replaced, true);
});

test('clients are kept in name order so the file diffs cleanly', () => {
  const start = { agency: {}, clients: [client('z', 'pz', 'Zed'), client('a', 'pa', 'Alpha')] };
  const { config } = upsertClient(start, client('m', 'pm', 'Middle'));
  assert.deepEqual(config.clients.map((c) => c.name), ['Alpha', 'Middle', 'Zed']);
});

test('a missing file starts an empty config rather than failing', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'rt-'));
  const config = await readClientFile(path.join(dir, 'nope.json'));
  assert.deepEqual(config.clients, []);
  assert.equal(config.agency.regionCode, 'GB');
});

test('a corrupt file is refused, never quietly overwritten', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'rt-'));
  const file = path.join(dir, 'broken.json');
  await writeFile(file, '{ this is not json', 'utf8');
  await assert.rejects(() => readClientFile(file), /could not be read/);
});

test('a round trip through the file preserves every client', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'rt-'));
  const file = path.join(dir, 'practices.json');
  let config = { agency: { name: 'SVM' }, clients: [] };
  for (const [id, place] of [['one', 'p1'], ['two', 'p2'], ['three', 'p3']]) {
    config = upsertClient(config, client(id, place)).config;
  }
  await writeClientFile(file, config);
  const back = await readClientFile(file);
  assert.deepEqual(back.clients.map((c) => c.id).sort(), ['one', 'three', 'two']);
  assert.match(await readFile(file, 'utf8'), /\n$/, 'ends with a newline');
});

test('writing refuses a config the validator rejects', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'rt-'));
  await assert.rejects(
    () => writeClientFile(path.join(dir, 'x.json'), { agency: {}, clients: [{ id: 'Bad Id', name: 'x', placeId: 'y' }] }),
    /lowercase/
  );
});

test('slugify makes a filename-safe id', () => {
  assert.equal(slugify('Murgatroyd Holmes Opticians'), 'murgatroyd-holmes-opticians');
  assert.equal(slugify('Cotler & Bell Opticians Ltd.'), 'cotler-bell-opticians-ltd');
  assert.equal(slugify('!!!'), 'practice');
});
