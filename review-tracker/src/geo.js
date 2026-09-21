/**
 * The small amount of geography the tracker needs.
 *
 * Text Search (New) will only restrict results to a rectangle, never a circle.
 * So a radius search is done in two parts: ask Google for the bounding box that
 * contains the circle, then drop anything outside the circle by real distance.
 * That gives a true radius rather than a box pretending to be one.
 */

const EARTH_RADIUS_M = 6_371_008.8;
const METRES_PER_DEGREE_LAT = 111_320;
const MILES_TO_METRES = 1609.344;

export const milesToMetres = (miles) => miles * MILES_TO_METRES;
export const metresToMiles = (metres) => metres / MILES_TO_METRES;

const toRadians = (degrees) => (degrees * Math.PI) / 180;

/** Great-circle distance in metres between two {latitude, longitude} points. */
export function distanceMetres(a, b) {
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const dLat = lat2 - lat1;
  const dLng = toRadians(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * The smallest latitude/longitude rectangle containing a circle, in the shape
 * Text Search wants. Longitude degrees narrow as you leave the equator, hence
 * the cosine; it is clamped so a point near a pole cannot divide by zero.
 */
export function boundingRectangle(center, radiusMetres) {
  const latDelta = radiusMetres / METRES_PER_DEGREE_LAT;
  const shrink = Math.max(Math.cos(toRadians(center.latitude)), 0.01);
  const lngDelta = radiusMetres / (METRES_PER_DEGREE_LAT * shrink);
  return {
    low: {
      latitude: Math.max(-90, center.latitude - latDelta),
      longitude: Math.max(-180, center.longitude - lngDelta),
    },
    high: {
      latitude: Math.min(90, center.latitude + latDelta),
      longitude: Math.min(180, center.longitude + lngDelta),
    },
  };
}
