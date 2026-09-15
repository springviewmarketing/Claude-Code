const DAY = 86_400_000;

/** Build a history from a compact spec: weeksAgo -> { placeId: total }. */
export function makeHistory(spec, { end = Date.parse('2026-09-14T08:00:00.000Z'), ratings = {}, names = {} } = {}) {
  const snapshots = spec
    .slice()
    .sort((a, b) => b.weeksAgo - a.weeksAgo)
    .map(({ weeksAgo, offsetDays = 0, totals, missing = [] }) => {
      const takenAt = new Date(end - weeksAgo * 7 * DAY + offsetDays * DAY).toISOString();
      const places = {};
      for (const [placeId, totalReviews] of Object.entries(totals)) {
        places[placeId] = {
          name: names[placeId] ?? placeId,
          totalReviews,
          rating: ratings[placeId] ?? 4.8,
          status: 'ok',
        };
      }
      for (const placeId of missing) {
        places[placeId] = { name: names[placeId] ?? placeId, status: 'error', error: 'boom' };
      }
      return { takenAt, places };
    });
  return { version: 1, snapshots };
}
