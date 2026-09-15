import test from 'node:test';
import assert from 'node:assert/strict';
import { addSnapshot, toPlaceMap } from '../src/store.js';

const history = () => ({ version: 1, snapshots: [] });

test('a reading is appended and the history stays in date order', () => {
  const store = history();
  addSnapshot(store, { takenAt: '2026-09-08T08:00:00.000Z', places: { a: { totalReviews: 1, status: 'ok' } } });
  addSnapshot(store, { takenAt: '2026-09-01T08:00:00.000Z', places: { a: { totalReviews: 0, status: 'ok' } } });
  assert.deepEqual(
    store.snapshots.map((s) => s.takenAt),
    ['2026-09-01T08:00:00.000Z', '2026-09-08T08:00:00.000Z']
  );
});

test('a re-run on the same day tops up the reading rather than inventing a second week', () => {
  const store = history();
  addSnapshot(store, {
    takenAt: '2026-09-08T08:00:00.000Z',
    places: { a: { totalReviews: 10, status: 'ok' }, b: { status: 'error', error: 'timeout' } },
  });
  const { merged } = addSnapshot(store, {
    takenAt: '2026-09-08T11:00:00.000Z',
    places: { a: { totalReviews: 10, status: 'ok' }, b: { totalReviews: 4, status: 'ok' } },
  });
  assert.equal(merged, true);
  assert.equal(store.snapshots.length, 1);
  assert.equal(store.snapshots[0].places.b.totalReviews, 4);
});

test('a re-run does not overwrite a good reading with a fresh failure', () => {
  const store = history();
  addSnapshot(store, { takenAt: '2026-09-08T08:00:00.000Z', places: { a: { totalReviews: 10, status: 'ok' } } });
  addSnapshot(store, { takenAt: '2026-09-08T11:00:00.000Z', places: { a: { status: 'error', error: 'timeout' } } });
  assert.equal(store.snapshots[0].places.a.totalReviews, 10);
  assert.equal(store.snapshots[0].places.a.status, 'ok');
});

test('a run a week later is a new reading, not a merge', () => {
  const store = history();
  addSnapshot(store, { takenAt: '2026-09-01T08:00:00.000Z', places: { a: { totalReviews: 5, status: 'ok' } } });
  const { merged } = addSnapshot(store, { takenAt: '2026-09-08T08:00:00.000Z', places: { a: { totalReviews: 9, status: 'ok' } } });
  assert.equal(merged, false);
  assert.equal(store.snapshots.length, 2);
});

test('a re-issued place ID is recorded so the config can be corrected', () => {
  const map = toPlaceMap([
    { placeId: 'old', currentPlaceId: 'new', name: 'A', totalReviews: 3, rating: 4.5, businessStatus: 'OPERATIONAL', status: 'ok' },
    { placeId: 'same', currentPlaceId: 'same', name: 'B', totalReviews: 1, rating: 5, businessStatus: 'OPERATIONAL', status: 'ok' },
  ]);
  assert.equal(map.old.currentPlaceId, 'new');
  assert.equal('currentPlaceId' in map.same, false);
});

test('a failed read is stored as a failure, never as zero reviews', () => {
  const map = toPlaceMap([{ placeId: 'x', configName: 'X', status: 'not_found', error: '404' }]);
  assert.equal(map.x.status, 'not_found');
  assert.equal(map.x.totalReviews, undefined);
});
