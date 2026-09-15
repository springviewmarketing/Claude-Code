/** One row per tracked place per run, for the record and for spreadsheets. */

const escape = (value) => {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

const HEADERS = [
  'week_ending',
  'client_id',
  'client_name',
  'place_name',
  'is_client',
  'place_id',
  'total_reviews',
  'rating',
  'new_reviews',
  'days_in_period',
  'rank_by_total',
  'rank_by_new',
  'streak_weeks',
  'pace_per_week',
  'status',
];

export function toCsv(reports) {
  const lines = [HEADERS.join(',')];
  for (const report of reports) {
    for (const row of [report.row, ...report.competitors]) {
      lines.push(
        [
          report.weekEnding,
          report.client.id,
          report.client.name,
          row.name,
          row.isClient ? 'yes' : 'no',
          row.placeId,
          row.total,
          row.rating,
          row.newReviews,
          row.days,
          row.rank ?? '',
          row.rankByNew ?? '',
          row.streak,
          row.pace?.perWeek ?? '',
          row.status,
        ]
          .map(escape)
          .join(',')
      );
    }
  }
  return `${lines.join('\n')}\n`;
}
