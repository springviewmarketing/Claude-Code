/**
 * Finding every optician within a radius of a practice.
 *
 * Google has no "optician" place type, so a pure radius search would return
 * every business in range: cafes, barbers, the lot. The search therefore stays
 * keyword-driven and the radius is applied on top. Several wordings are tried
 * because practices list themselves variously as opticians, optometrists or eye
 * care, and the results are merged on place ID.
 */

import { boundingRectangle, distanceMetres, metresToMiles } from './geo.js';

export const DEFAULT_QUERIES = ['opticians', 'optometrist', 'eye care'];

/**
 * Deciding what is actually an optician.
 *
 * Google has no optician place type, in either filterable table, so it cannot
 * be asked for one. Text Search is loose: searching "eye care" near a town
 * returns health centres, an NHS commissioning body, supermarkets with a
 * concession inside, and on one occasion a car park. Ranking a practice against
 * a GP surgery is worse than useless, so the name is the gate.
 *
 * UK opticians name themselves consistently enough for this to be reliable.
 * Google's own type label is checked too, which catches a practice whose name
 * gives nothing away.
 */
const OPTICAL_PATTERNS = [
  /\boptician/i,
  /\boptometr/i,
  /\boptical\b/i,
  /\beye\s*care\b/i,
  /\beyewear\b/i,
  /\beye\s+(clinic|centre|center|test|practice|specialist)/i,
  /\bvision\b/i,
  /\bspecsavers\b/i,
  /\bspectacle/i,
  /\bsight\s*care\b/i,
];

/**
 * Types that are never an optician whatever the name says, so a supermarket
 * with a concession inside cannot enter the table as the whole supermarket.
 */
const BLOCKED_TYPES = new Set([
  'supermarket',
  'hypermarket',
  'discount_supermarket',
  'grocery_store',
  'department_store',
  'parking',
  'government_office',
  'hospital',
  'general_hospital',
  'pharmacy',
  'drugstore',
]);

/** Whether a search result is plausibly an opticians practice. */
export function looksLikeOptician(place) {
  if (place.primaryType && BLOCKED_TYPES.has(place.primaryType)) return false;
  const haystack = `${place.name ?? ''} ${place.primaryTypeLabel ?? ''}`;
  return OPTICAL_PATTERNS.some((pattern) => pattern.test(haystack));
}

/** A place ID rather than something to search for. */
const looksLikePlaceId = (value) => /^[A-Za-z0-9_-]{20,}$/.test(value.trim());

/**
 * Work out what we are measuring distance from. Accepts a place ID directly, or
 * a name to search for, in which case the best match is used and returned so the
 * caller can show which one it picked.
 */
export async function resolveAnchor(client, target) {
  if (looksLikePlaceId(target)) {
    const details = await client.placeDetails(target.trim());
    if (!details.location) {
      const error = new Error(`Google returned no coordinates for ${target}.`);
      error.expected = true;
      throw error;
    }
    return { placeId: details.placeId, name: details.name, address: details.address, location: details.location, matched: false };
  }

  const [best] = await client.searchText(target);
  if (!best || !best.location) {
    const error = new Error(
      `Could not find "${target}" on Google. Try the practice name with its town, or paste its place ID.`
    );
    error.expected = true;
    throw error;
  }
  return { ...best, matched: true };
}

/**
 * Every place matching one of the queries whose real distance from `center` is
 * within `radiusMetres`, nearest first.
 */
export async function findNearby(client, { center, radiusMetres, queries = DEFAULT_QUERIES, maxPages = 3 }) {
  const rectangle = boundingRectangle(center, radiusMetres);
  const found = new Map();

  for (const query of queries) {
    const places = await client.searchText(query, {
      locationRestriction: { rectangle },
      maxPages,
      pageSize: 20,
    });
    for (const place of places) {
      if (!place.placeId || found.has(place.placeId)) continue;
      // Without coordinates the distance cannot be checked, and an unchecked
      // result is worse than a missing one here.
      if (!place.location) continue;
      const metres = distanceMetres(center, place.location);
      if (metres > radiusMetres) continue;
      found.set(place.placeId, {
        ...place,
        metres,
        miles: Number(metresToMiles(metres).toFixed(1)),
        isOptician: looksLikeOptician(place),
      });
    }
  }

  return [...found.values()].sort((a, b) => a.metres - b.metres);
}

/**
 * Split the results into the ones worth tracking and the ones that are not.
 *
 * The rule is deliberately about comparability rather than size alone. A
 * practice with an order of magnitude more reviews is not a target anyone can
 * chase, and leaving it in swamps the share-of-new-reviews figure every week.
 */
export function shortlist(places, { anchorPlaceId, anchorTotal, maxMultiple = 12, minReviews = 5, limit = 5 }) {
  const rivals = places.filter((place) => place.placeId !== anchorPlaceId);
  const ceiling = Math.max(anchorTotal * maxMultiple, 40);

  const comparable = [];
  const tooBig = [];
  const tooSmall = [];
  const notOpticians = [];

  for (const place of rivals) {
    // Anything that is not an opticians practice is out before size is even
    // considered. A health centre with 89 reviews is not a rival, at any size.
    if (place.isOptician === false) notOpticians.push(place);
    else if (place.totalReviews < minReviews) tooSmall.push(place);
    else if (place.totalReviews > ceiling) tooBig.push(place);
    else comparable.push(place);
  }

  // Nearest rungs first: the ones just above make the most motivating targets.
  const ladder = comparable
    .slice()
    .sort((a, b) => {
      const aAbove = a.totalReviews >= anchorTotal;
      const bAbove = b.totalReviews >= anchorTotal;
      if (aAbove !== bAbove) return aAbove ? -1 : 1;
      return aAbove ? a.totalReviews - b.totalReviews : b.totalReviews - a.totalReviews;
    })
    .slice(0, limit);

  return { ladder, comparable, tooBig, tooSmall, notOpticians, ceiling };
}
