import test from 'node:test';
import assert from 'node:assert/strict';
import { addSnapshot, toPlaceMap, isReadingFresh } from '../src/store.js';

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

// The backup schedule slots. Each fires a few hours after the last, and stands
// down if the one before it already stored a complete reading.
const NOW = Date.parse('2026-10-04T23:30:00.000Z');
const reading = (takenAt, places) => ({ version: 1, snapshots: [{ takenAt, places }] });
const COMPLETE = { a: { status: 'ok', totalReviews: 3 }, b: { status: 'ok', totalReviews: 9 } };

test('a complete reading taken an hour ago is fresh', () => {
  assert.equal(isReadingFresh(reading('2026-10-04T22:23:00.000Z', COMPLETE), { withinHours: 20, now: NOW }), true);
});

test("last week's reading is stale", () => {
  assert.equal(isReadingFresh(reading('2026-09-27T22:23:00.000Z', COMPLETE), { withinHours: 20, now: NOW }), false);
});

test('a reading with a failed profile is stale however recent it is', () => {
  const partial = { a: { status: 'ok', totalReviews: 3 }, b: { status: 'error', error: 'timeout' } };
  assert.equal(isReadingFresh(reading('2026-10-04T22:23:00.000Z', partial), { withinHours: 20, now: NOW }), false);
});

test('an empty history has nothing to stand down for', () => {
  assert.equal(isReadingFresh({ version: 1, snapshots: [] }, { withinHours: 20, now: NOW }), false);
  assert.equal(isReadingFresh(reading('2026-10-04T22:23:00.000Z', {}), { withinHours: 20, now: NOW }), false);
});

test('an unparseable date is not trusted', () => {
  assert.equal(isReadingFresh(reading('not a date', COMPLETE), { withinHours: 20, now: NOW }), false);
});

test('the window covers the whole span of backup slots', () => {
  const lastSlot = Date.parse('2026-10-05T05:23:00.000Z');
  assert.equal(
    isReadingFresh(reading('2026-10-04T22:23:00.000Z', COMPLETE), { withinHours: 20, now: lastSlot }),
    true
  );
});
