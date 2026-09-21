import test from 'node:test';
import assert from 'node:assert/strict';
import { PlacesClient } from '../src/places.js';
import { resolveAnchor, findNearby, shortlist } from '../src/nearby.js';
import { milesToMetres } from '../src/geo.js';

const anchor = { latitude: 53.4839, longitude: -1.2281 }; // Conisbrough
const near = { latitude: 53.4900, longitude: -1.2300 };   // a few hundred metres
const far = { latitude: 53.8000, longitude: -1.5500 };    // Leeds, well outside

const place = (id, name, total, location) => ({
  id,
  displayName: { text: name },
  formattedAddress: 'somewhere',
  location,
  rating: 4.7,
  userRatingCount: total,
  businessStatus: 'OPERATIONAL',
});

function stub(pagesByQuery) {
  const calls = [];
  const client = new PlacesClient({
    apiKey: 'k',
    maxRetries: 0,
    fetchImpl: async (url, init) => {
      const body = JSON.parse(init.body);
      calls.push(body);
      const pages = pagesByQuery[body.textQuery] ?? [[]];
      const index = body.pageToken ? Number(body.pageToken.replace('page', '')) : 0;
      const places = pages[index] ?? [];
      const nextPageToken = index + 1 < pages.length ? `page${index + 1}` : undefined;
      return { ok: true, status: 200, json: async () => ({ places, ...(nextPageToken ? { nextPageToken } : {}) }) };
    },
  });
  return { client, calls };
}

test('the search is restricted to a rectangle, because a circle is not accepted', async () => {
  const { client, calls } = stub({ opticians: [[place('a', 'A', 30, near)]] });
  await findNearby(client, { center: anchor, radiusMetres: milesToMetres(5), queries: ['opticians'] });

  const restriction = calls[0].locationRestriction;
  assert.ok(restriction.rectangle, 'a rectangle is sent');
  assert.equal(restriction.circle, undefined, 'never a circle');
  assert.ok(restriction.rectangle.low.latitude < anchor.latitude);
  assert.ok(restriction.rectangle.high.latitude > anchor.latitude);
});

test('a result inside the box but outside the circle is dropped', async () => {
  const { client } = stub({ opticians: [[place('near', 'Near', 30, near), place('far', 'Far', 30, far)]] });
  const found = await findNearby(client, { center: anchor, radiusMetres: milesToMetres(5), queries: ['opticians'] });
  assert.deepEqual(found.map((p) => p.placeId), ['near']);
});

test('a result with no coordinates is dropped rather than assumed to be in range', async () => {
  const { client } = stub({ opticians: [[place('nowhere', 'Nowhere', 30, undefined)]] });
  const found = await findNearby(client, { center: anchor, radiusMetres: milesToMetres(5), queries: ['opticians'] });
  assert.equal(found.length, 0);
});

test('several wordings are merged and the same place is never listed twice', async () => {
  const { client, calls } = stub({
    opticians: [[place('a', 'A', 30, near)]],
    optometrist: [[place('a', 'A', 30, near), place('b', 'B', 40, near)]],
    'eye care': [[place('b', 'B', 40, near)]],
  });
  const found = await findNearby(client, { center: anchor, radiusMetres: milesToMetres(5) });
  assert.deepEqual(found.map((p) => p.placeId).sort(), ['a', 'b']);
  assert.equal(calls.length, 3, 'one call per wording, none needed a second page');
});

test('results are returned nearest first with their distance in miles', async () => {
  const mid = { latitude: 53.5100, longitude: -1.2281 };
  const { client } = stub({ opticians: [[place('mid', 'Mid', 30, mid), place('near', 'Near', 30, near)]] });
  const found = await findNearby(client, { center: anchor, radiusMetres: milesToMetres(5), queries: ['opticians'] });
  assert.deepEqual(found.map((p) => p.placeId), ['near', 'mid']);
  assert.ok(found[0].miles < found[1].miles);
  assert.equal(typeof found[0].miles, 'number');
});

test('paging follows the token and stops when Google stops sending one', async () => {
  const { client, calls } = stub({
    opticians: [
      [place('a', 'A', 30, near)],
      [place('b', 'B', 31, near)],
      [place('c', 'C', 32, near)],
    ],
  });
  const found = await findNearby(client, { center: anchor, radiusMetres: milesToMetres(5), queries: ['opticians'] });
  assert.equal(found.length, 3);
  assert.equal(calls.length, 3);
  assert.equal(calls[1].pageToken, 'page1');
  assert.equal(calls[1].textQuery, 'opticians', 'the query must not change between pages');
});

test('an anchor given as a place ID is looked up directly, not searched for', async () => {
  let url;
  const client = new PlacesClient({
    apiKey: 'k',
    maxRetries: 0,
    fetchImpl: async (u) => {
      url = u;
      return { ok: true, status: 200, json: async () => ({ id: 'ChIJQwZWJ05zeUgRQ714j_cNuSM', displayName: { text: 'Murgatroyd' }, location: anchor, userRatingCount: 11 }) };
    },
  });
  const result = await resolveAnchor(client, 'ChIJQwZWJ05zeUgRQ714j_cNuSM');
  assert.match(url, /\/places\/ChIJ/);
  assert.equal(result.matched, false);
  assert.deepEqual(result.location, anchor);
});

test('an anchor given as a name is searched for and flagged as a guess', async () => {
  const { client } = stub({ 'Murgatroyd Opticians Conisbrough': [[place('m', 'Murgatroyd Opticians', 11, anchor)]] });
  const result = await resolveAnchor(client, 'Murgatroyd Opticians Conisbrough');
  assert.equal(result.matched, true);
  assert.equal(result.placeId, 'm');
});

test('the shortlist drops the giants and the near-empty, and puts the next rung first', () => {
  const rivals = [
    { placeId: 'anchor', name: 'Us', totalReviews: 11 },
    { placeId: 'specsavers', name: 'Specsavers', totalReviews: 1195 },
    { placeId: 'priority', name: 'Priority', totalReviews: 16 },
    { placeId: 'arthur', name: 'Arthur Leach', totalReviews: 47 },
    { placeId: 'tiny', name: 'Tiny', totalReviews: 2 },
    { placeId: 'cotler', name: 'Cotler', totalReviews: 101 },
  ];
  const result = shortlist(rivals, { anchorPlaceId: 'anchor', anchorTotal: 11, limit: 5 });

  assert.equal(result.ladder.some((p) => p.placeId === 'specsavers'), false, 'a giant is never a chase target');
  assert.equal(result.ladder.some((p) => p.placeId === 'tiny'), false, 'a near-empty profile is no benchmark');
  assert.equal(result.ladder.some((p) => p.placeId === 'anchor'), false, 'the practice does not compete with itself');
  assert.equal(result.ladder[0].placeId, 'priority', 'the closest one above comes first');
  assert.deepEqual(result.ladder.map((p) => p.placeId), ['priority', 'arthur', 'cotler']);
  assert.equal(result.tooBig.length, 1);
  assert.equal(result.tooSmall.length, 1);
});

test('a brand new practice still gets a ladder, via the floor on the ceiling', () => {
  const rivals = [
    { placeId: 'anchor', name: 'Us', totalReviews: 0 },
    { placeId: 'a', name: 'A', totalReviews: 12 },
    { placeId: 'b', name: 'B', totalReviews: 38 },
    { placeId: 'huge', name: 'Huge', totalReviews: 900 },
  ];
  const result = shortlist(rivals, { anchorPlaceId: 'anchor', anchorTotal: 0, limit: 5 });
  assert.deepEqual(result.ladder.map((p) => p.placeId), ['a', 'b']);
  assert.equal(result.tooBig[0].placeId, 'huge');
});

test('two branches under one name are told apart by their town', async () => {
  const { disambiguateNames, townFrom } = await import('../src/nearby.js');
  const out = disambiguateNames([
    { name: 'Portland Optical Group', address: '12 Market St, Bolsover, Chesterfield S44 6PN', miles: 2.8 },
    { name: 'Portland Optical Group', address: '5 Low Pavement, Chesterfield S40 1PB', miles: 3.7 },
    { name: 'Parker Opticians', address: '7 Park St, Chesterfield S40 1DD', miles: 3.8 },
  ]);
  assert.deepEqual(out.map((p) => p.name), [
    'Portland Optical Group (Bolsover)',
    'Portland Optical Group (Chesterfield)',
    'Parker Opticians',
  ]);
  assert.equal(townFrom('33 High St, Staveley, Chesterfield S43 3UU'), 'Staveley');
  assert.equal(townFrom('5 Low Pavement, Chesterfield S40 1PB'), 'Chesterfield');
  assert.equal(townFrom(''), null);
});

test('two branches in the same town fall back to distance', async () => {
  const { disambiguateNames } = await import('../src/nearby.js');
  const out = disambiguateNames([
    { name: 'Boots Opticians', address: '1 A St, Leeds LS1 1AA', miles: 1.1 },
    { name: 'Boots Opticians', address: '2 B St, Leeds LS2 2BB', miles: 2.2 },
  ]);
  assert.deepEqual(out.map((p) => p.name), ['Boots Opticians (1.1mi)', 'Boots Opticians (2.2mi)']);
});

test('a single practice keeps its name untouched', async () => {
  const { disambiguateNames } = await import('../src/nearby.js');
  const out = disambiguateNames([{ name: 'Murgatroyd Opticians', address: 'x', miles: 0 }]);
  assert.deepEqual(out.map((p) => p.name), ['Murgatroyd Opticians']);
  assert.equal('_base' in out[0], false, 'no internal bookkeeping leaks into the config');
});
