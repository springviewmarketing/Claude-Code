import test from 'node:test';
import assert from 'node:assert/strict';
import { distanceMetres, boundingRectangle, milesToMetres, metresToMiles } from '../src/geo.js';

const conisbrough = { latitude: 53.4839, longitude: -1.2281 };
const doncaster = { latitude: 53.5228, longitude: -1.1285 };

test('distance between Conisbrough and Doncaster is about five miles', () => {
  const miles = metresToMiles(distanceMetres(conisbrough, doncaster));
  assert.ok(miles > 4.5 && miles < 5.5, `expected roughly 5 miles, got ${miles.toFixed(2)}`);
});

test('distance is zero to itself and symmetric', () => {
  assert.equal(Math.round(distanceMetres(conisbrough, conisbrough)), 0);
  assert.equal(
    Math.round(distanceMetres(conisbrough, doncaster)),
    Math.round(distanceMetres(doncaster, conisbrough))
  );
});

test('the bounding rectangle contains the circle it was built from', () => {
  const radius = milesToMetres(5);
  const box = boundingRectangle(conisbrough, radius);

  // Due north, south, east and west at exactly the radius must all sit inside.
  const latSpan = box.high.latitude - conisbrough.latitude;
  const lngSpan = box.high.longitude - conisbrough.longitude;
  const north = { latitude: conisbrough.latitude + latSpan, longitude: conisbrough.longitude };
  const east = { latitude: conisbrough.latitude, longitude: conisbrough.longitude + lngSpan };

  assert.ok(distanceMetres(conisbrough, north) >= radius * 0.99, 'box reaches the radius north');
  assert.ok(distanceMetres(conisbrough, east) >= radius * 0.99, 'box reaches the radius east');
  assert.ok(box.low.latitude < conisbrough.latitude && box.high.latitude > conisbrough.latitude);
  assert.ok(box.low.longitude < conisbrough.longitude && box.high.longitude > conisbrough.longitude);
});

test('the rectangle is wider in longitude than latitude at UK latitudes', () => {
  const box = boundingRectangle(conisbrough, milesToMetres(5));
  const latSpan = box.high.latitude - box.low.latitude;
  const lngSpan = box.high.longitude - box.low.longitude;
  assert.ok(lngSpan > latSpan, 'longitude degrees are shorter this far north, so the box spans more of them');
});

test('miles and metres convert back and forth', () => {
  assert.equal(Math.round(milesToMetres(1)), 1609);
  assert.equal(Number(metresToMiles(milesToMetres(7.5)).toFixed(6)), 7.5);
});
