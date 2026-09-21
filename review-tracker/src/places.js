/**
 * Google Places API (New) client.
 *
 * Only two calls are used:
 *   - Place Details, to read `userRatingCount` and `rating` for one place.
 *   - Text Search, to find place IDs when setting a client up.
 *
 * Place Details is billed once, at the highest SKU tier among the fields asked
 * for. `rating` and `userRatingCount` are Enterprise fields, so every details
 * call here is an Enterprise call: 1,000 free per month, then $20 per 1,000.
 * One weekly run over 60 places is ~260 calls a month, comfortably inside free.
 */

const DETAILS_FIELDS = [
  'id',
  'displayName',
  'location',
  'rating',
  'userRatingCount',
  'businessStatus',
  'formattedAddress',
  'googleMapsUri',
].join(',');

const SEARCH_FIELDS = [
  'places.id',
  'places.displayName',
  'places.location',
  'places.formattedAddress',
  'places.rating',
  'places.userRatingCount',
  'places.businessStatus',
].join(',');

const SEARCH_FIELDS_PAGED = `${SEARCH_FIELDS},nextPageToken`;

const BASE = 'https://places.googleapis.com/v1';
const RETRYABLE = new Set([408, 429, 500, 502, 503, 504]);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export class PlacesClient {
  constructor({ apiKey, regionCode = 'GB', languageCode = 'en-GB', fetchImpl = fetch, maxRetries = 4 }) {
    if (!apiKey) {
      const error = new Error(
        'No Google Maps API key. Set GOOGLE_MAPS_API_KEY in the environment or in review-tracker/.env'
      );
      error.expected = true;
      throw error;
    }
    this.apiKey = apiKey;
    this.regionCode = regionCode;
    this.languageCode = languageCode;
    this.fetchImpl = fetchImpl;
    this.maxRetries = maxRetries;
    this.callCount = 0;
  }

  async #request(url, { method = 'GET', fieldMask, body } = {}) {
    let lastError;
    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      if (attempt > 0) await sleep(2 ** attempt * 500);
      let response;
      try {
        this.callCount += 1;
        response = await this.fetchImpl(url, {
          method,
          headers: {
            'X-Goog-Api-Key': this.apiKey,
            'X-Goog-FieldMask': fieldMask,
            ...(body ? { 'Content-Type': 'application/json' } : {}),
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
        });
      } catch (error) {
        // Network-level failure. Worth another go.
        lastError = error;
        continue;
      }

      if (response.ok) return response.json();

      const text = await response.text().catch(() => '');
      const error = new Error(`Places API ${response.status}: ${text.slice(0, 400)}`);
      error.status = response.status;
      if (response.status === 404) throw error; // a wrong place ID never becomes right
      if (response.status === 403 || response.status === 400) {
        error.expected = true;
        throw error; // key, billing or field-mask problem: retrying just burns quota
      }
      if (!RETRYABLE.has(response.status)) throw error;
      lastError = error;
    }
    throw lastError;
  }

  /** Current rating and total review count for one place. */
  async placeDetails(placeId) {
    const url = `${BASE}/places/${encodeURIComponent(placeId)}?languageCode=${this.languageCode}&regionCode=${this.regionCode}`;
    const data = await this.#request(url, { fieldMask: DETAILS_FIELDS });
    return {
      placeId,
      // Google occasionally re-issues a place ID. The response carries the live
      // one, so surface a change rather than silently tracking a stale key.
      currentPlaceId: data.id ?? placeId,
      name: data.displayName?.text ?? null,
      address: data.formattedAddress ?? null,
      mapsUri: data.googleMapsUri ?? null,
      businessStatus: data.businessStatus ?? null,
      location: data.location ?? null,
      rating: typeof data.rating === 'number' ? data.rating : null,
      // A place with no reviews omits the field entirely; that is a real zero.
      totalReviews: typeof data.userRatingCount === 'number' ? data.userRatingCount : 0,
    };
  }

  /**
   * Free-text place lookup, for finding place IDs during setup.
   *
   * `locationRestriction` takes a rectangle only; a circle is not accepted here,
   * which is why a radius search boxes the circle first and filters afterwards.
   * Google caps a search at 60 results across all pages.
   */
  async searchText(textQuery, { pageSize = 20, locationRestriction, maxPages = 1 } = {}) {
    const results = [];
    let pageToken;

    for (let page = 0; page < maxPages; page += 1) {
      const data = await this.#request(`${BASE}/places:searchText`, {
        method: 'POST',
        fieldMask: maxPages > 1 ? SEARCH_FIELDS_PAGED : SEARCH_FIELDS,
        body: {
          textQuery,
          regionCode: this.regionCode,
          languageCode: this.languageCode,
          pageSize,
          ...(locationRestriction ? { locationRestriction } : {}),
          // Every other field has to match the first call for a page token to
          // be accepted, so the token is the only thing that changes.
          ...(pageToken ? { pageToken } : {}),
        },
      });

      for (const place of data.places ?? []) {
        results.push({
          placeId: place.id,
          name: place.displayName?.text ?? null,
          address: place.formattedAddress ?? null,
          location: place.location ?? null,
          rating: typeof place.rating === 'number' ? place.rating : null,
          totalReviews: typeof place.userRatingCount === 'number' ? place.userRatingCount : 0,
          businessStatus: place.businessStatus ?? null,
        });
      }

      pageToken = data.nextPageToken;
      if (!pageToken) break;
    }

    return results;
  }
}

/**
 * Fetch every place, a few at a time. Failures are captured per place so one
 * dead place ID cannot cost us the whole week's snapshot.
 */
export async function fetchAll(client, places, { concurrency = 4, onResult } = {}) {
  const queue = [...places];
  const results = [];

  async function worker() {
    while (queue.length > 0) {
      const place = queue.shift();
      try {
        const details = await client.placeDetails(place.placeId);
        const record = { ...details, configName: place.name, status: 'ok' };
        results.push(record);
        onResult?.(record);
      } catch (error) {
        const record = {
          placeId: place.placeId,
          configName: place.name,
          status: error.status === 404 ? 'not_found' : 'error',
          error: error.message,
        };
        results.push(record);
        onResult?.(record);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, places.length) }, worker));
  // Restore the caller's ordering; the workers finish out of order.
  const order = new Map(places.map((place, index) => [place.placeId, index]));
  results.sort((a, b) => order.get(a.placeId) - order.get(b.placeId));
  return results;
}
