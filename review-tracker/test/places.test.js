import test from 'node:test';
import assert from 'node:assert/strict';
import { PlacesClient, fetchAll } from '../src/places.js';

const ok = (body) => ({ ok: true, status: 200, json: async () => body });
const bad = (status, body = '') => ({ ok: false, status, text: async () => body });

const clientWith = (fetchImpl, options = {}) =>
  new PlacesClient({ apiKey: 'test-key', fetchImpl, maxRetries: 0, ...options });

test('place details asks for the fields we bill for, and nothing more', async () => {
  let seen;
  const client = clientWith(async (url, init) => {
    seen = { url, init };
    return ok({ id: 'abc', displayName: { text: 'Test Opticians' }, rating: 4.7, userRatingCount: 128 });
  });
  const result = await client.placeDetails('abc');

  assert.match(seen.url, /^https:\/\/places\.googleapis\.com\/v1\/places\/abc\?/);
  assert.equal(seen.init.headers['X-Goog-Api-Key'], 'test-key');
  assert.equal(seen.init.headers['X-Goog-FieldMask'], 'id,displayName,rating,userRatingCount,businessStatus,formattedAddress,googleMapsUri');
  assert.match(seen.url, /languageCode=en-GB/);
  assert.match(seen.url, /regionCode=GB/);
  assert.equal(result.totalReviews, 128);
  assert.equal(result.rating, 4.7);
  assert.equal(result.name, 'Test Opticians');
});

test('a place with no reviews reads as zero, not as missing', async () => {
  const client = clientWith(async () => ok({ id: 'abc', displayName: { text: 'New Practice' } }));
  const result = await client.placeDetails('abc');
  assert.equal(result.totalReviews, 0);
  assert.equal(result.rating, null);
});

test('a place ID Google has re-issued comes back flagged', async () => {
  const client = clientWith(async () => ok({ id: 'new-id', displayName: { text: 'Moved' }, userRatingCount: 4 }));
  const result = await client.placeDetails('old-id');
  assert.equal(result.placeId, 'old-id');
  assert.equal(result.currentPlaceId, 'new-id');
});

test('a bad key is not retried, because retrying only burns quota', async () => {
  let calls = 0;
  const client = clientWith(async () => {
    calls += 1;
    return bad(403, 'PERMISSION_DENIED');
  }, { maxRetries: 3 });
  await assert.rejects(() => client.placeDetails('abc'), /403/);
  assert.equal(calls, 1);
});

test('a rate limit is retried', async () => {
  let calls = 0;
  const client = clientWith(async () => {
    calls += 1;
    return calls < 3 ? bad(429) : ok({ id: 'abc', userRatingCount: 7 });
  }, { maxRetries: 3 });
  const result = await client.placeDetails('abc');
  assert.equal(result.totalReviews, 7);
  assert.equal(calls, 3);
});

test('one dead place ID does not cost the whole run', async () => {
  const client = clientWith(async (url) =>
    url.includes('dead') ? bad(404, 'NOT_FOUND') : ok({ id: 'live', displayName: { text: 'Live' }, userRatingCount: 12 })
  );
  const results = await fetchAll(client, [{ placeId: 'dead', name: 'Dead' }, { placeId: 'live', name: 'Live' }]);
  assert.equal(results.length, 2);
  assert.equal(results[0].placeId, 'dead', 'results keep the order they were asked for');
  assert.equal(results[0].status, 'not_found');
  assert.equal(results[1].status, 'ok');
  assert.equal(results[1].totalReviews, 12);
});

test('text search posts the query and returns candidates with their place IDs', async () => {
  let seen;
  const client = clientWith(async (url, init) => {
    seen = { url, init };
    return ok({
      places: [
        { id: 'p1', displayName: { text: 'One' }, formattedAddress: 'Sheffield', rating: 4.9, userRatingCount: 30 },
        { id: 'p2', displayName: { text: 'Two' } },
      ],
    });
  });
  const results = await client.searchText('opticians in Hillsborough');

  assert.equal(seen.init.method, 'POST');
  assert.deepEqual(JSON.parse(seen.init.body), {
    textQuery: 'opticians in Hillsborough',
    regionCode: 'GB',
    languageCode: 'en-GB',
    maxResultCount: 20,
  });
  assert.equal(results.length, 2);
  assert.equal(results[0].placeId, 'p1');
  assert.equal(results[1].totalReviews, 0);
});

test('no API key fails immediately with something actionable', () => {
  assert.throws(() => new PlacesClient({ apiKey: '' }), /GOOGLE_MAPS_API_KEY/);
});
