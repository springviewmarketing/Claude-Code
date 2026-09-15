/**
 * Worked example data, so the report can be seen before a single API call.
 *
 * Every practice here is invented. Nothing in this file describes a real
 * business, and it must never be swapped for real names with made-up figures:
 * a report that looks authoritative and is fabricated is worse than no report.
 */

const DAY = 86_400_000;

export const demoConfig = {
  agency: { name: 'Spring View Marketing', regionCode: 'GB', languageCode: 'en-GB' },
  clients: [
    {
      id: 'demo-hillsborough',
      name: 'Hillsborough Eyecare (demo)',
      placeId: 'demo-hillsborough',
      area: 'Hillsborough, Sheffield',
      searchTerm: 'opticians near me',
      competitors: [
        { name: 'Northside Opticians (demo)', placeId: 'demo-northside' },
        { name: 'Broomhill Eye Practice (demo)', placeId: 'demo-broomhill' },
        { name: 'Rivelin Vision (demo)', placeId: 'demo-rivelin' },
        { name: 'Crookes Optical (demo)', placeId: 'demo-crookes' },
      ],
    },
    {
      id: 'demo-ecclesall',
      name: 'Ecclesall Eye Centre (demo)',
      placeId: 'demo-ecclesall',
      area: 'Ecclesall Road, Sheffield',
      competitors: [{ name: 'Sharrow Opticians (demo)', placeId: 'demo-sharrow' }],
    },
  ],
};

// Weekly gains, oldest week first. 12 entries gives 13 readings.
const GAINS = {
  'demo-hillsborough': [2, 3, 1, 4, 3, 5, 4, 6, 5, 7, 6, 8],
  'demo-northside': [3, 2, 2, 1, 3, 2, 2, 3, 1, 2, 2, 2],
  'demo-broomhill': [2, 1, 3, 2, 2, 1, 2, 2, 3, 1, 2, 3],
  'demo-rivelin': [1, 0, 1, 1, 0, 2, 1, 0, 1, 1, 0, 1],
  'demo-crookes': [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0],
  'demo-ecclesall': [0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 3, 5],
  'demo-sharrow': [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 1],
};

const FINAL = {
  'demo-hillsborough': { total: 206, rating: 4.9 },
  'demo-northside': { total: 308, rating: 4.4 },
  'demo-broomhill': { total: 152, rating: 4.7 },
  'demo-rivelin': { total: 124, rating: 4.8 },
  'demo-crookes': { total: 87, rating: 4.6 },
  'demo-ecclesall': { total: 41, rating: 5.0 },
  'demo-sharrow': { total: 63, rating: 4.5 },
};

const NAMES = Object.fromEntries(
  [...demoConfig.clients.flatMap((client) => [{ name: client.name, placeId: client.placeId }, ...client.competitors])].map(
    (entry) => [entry.placeId, entry.name]
  )
);

/** 13 weekly readings ending today; Ecclesall only joins three weeks ago. */
export function demoHistory(end = Date.now()) {
  const weeks = 12;
  const totals = {};
  for (const [placeId, { total }] of Object.entries(FINAL)) {
    // Walk the gains backwards to recover each week's total from the final one.
    const series = new Array(weeks + 1);
    series[weeks] = total;
    for (let i = weeks - 1; i >= 0; i -= 1) series[i] = series[i + 1] - GAINS[placeId][i];
    totals[placeId] = series;
  }

  const snapshots = [];
  for (let i = 0; i <= weeks; i += 1) {
    const takenAt = new Date(end - (weeks - i) * 7 * DAY).toISOString();
    const places = {};
    for (const [placeId, series] of Object.entries(totals)) {
      // The second practice was only added to the tracker three weeks ago, which
      // is what onboarding a new client actually looks like.
      const joined = ['demo-ecclesall', 'demo-sharrow'].includes(placeId) ? weeks - 2 : 0;
      if (i < joined) continue;
      places[placeId] = {
        name: NAMES[placeId],
        totalReviews: series[i],
        rating: FINAL[placeId].rating,
        businessStatus: 'OPERATIONAL',
        status: 'ok',
      };
    }
    snapshots.push({ takenAt, places });
  }
  return { version: 1, snapshots };
}
