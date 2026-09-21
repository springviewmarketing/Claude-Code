/**
 * Turning a history of review counts into the numbers a practice will act on.
 *
 * The one thing to understand before reading any figure out of here: Google's
 * API gives a *live total*, not a dated list of reviews. Every "new this week"
 * number is therefore a difference between two readings, which makes it a NET
 * figure. Seven reviews gained and one removed reads as six. That is the honest
 * limit of the method and the report says so on its face.
 */

const DAY = 86_400_000;
const WEEK = 7 * DAY;

const readingFor = (snapshot, placeId) => {
  const record = snapshot?.places?.[placeId];
  if (!record || record.status !== 'ok' || typeof record.totalReviews !== 'number') return null;
  return record;
};

/**
 * Pin the history onto a weekly grid.
 *
 * Anchor 0 is the latest reading. Anchor w is whichever reading sits closest to
 * `w` weeks before it, within tolerance. A week with no reading nearby gets
 * null, so a missed run shows as a gap rather than being quietly absorbed into
 * a neighbouring week and inflating it.
 */
export function buildAnchors(snapshots, { asOf, weeks = 12, toleranceDays = 3 } = {}) {
  if (snapshots.length === 0) return [];
  const ordered = snapshots.slice().sort((a, b) => Date.parse(a.takenAt) - Date.parse(b.takenAt));
  const latest = ordered.at(-1);
  const end = asOf ? Date.parse(asOf) : Date.parse(latest.takenAt);
  const tolerance = toleranceDays * DAY;

  const anchors = [{ weekIndex: 0, snapshot: latest, at: latest.takenAt, targetAt: new Date(end).toISOString() }];
  const used = new Set([latest]);

  for (let w = 1; w <= weeks; w += 1) {
    const target = end - w * WEEK;
    let best = null;
    let bestGap = Infinity;
    for (const snapshot of ordered) {
      if (used.has(snapshot)) continue;
      const gap = Math.abs(Date.parse(snapshot.takenAt) - target);
      if (gap <= tolerance && gap < bestGap) {
        best = snapshot;
        bestGap = gap;
      }
    }
    if (best) used.add(best);
    anchors.push({
      weekIndex: w,
      snapshot: best,
      at: best?.takenAt ?? null,
      targetAt: new Date(target).toISOString(),
    });
  }
  return anchors;
}

/**
 * The weekly run of new reviews for one place, newest first.
 * `newReviews` is null where either end of the week is missing a reading.
 */
export function placeSeries(anchors, placeId) {
  const series = [];
  for (let i = 0; i < anchors.length - 1; i += 1) {
    const current = readingFor(anchors[i].snapshot, placeId);
    const previous = readingFor(anchors[i + 1].snapshot, placeId);
    const known = current && previous;
    series.push({
      weekIndex: i,
      weekEnding: anchors[i].at ?? anchors[i].targetAt,
      total: current?.totalReviews ?? null,
      rating: current?.rating ?? null,
      newReviews: known ? current.totalReviews - previous.totalReviews : null,
      days: known ? Math.round((Date.parse(anchors[i].at) - Date.parse(anchors[i + 1].at)) / DAY) : null,
    });
  }
  return series;
}

/**
 * The headline change. Prefers the exact one-week-ago anchor; where that run was
 * missed it falls back to the most recent earlier reading and reports the real
 * number of days elapsed, rather than calling a fortnight a week.
 */
export function headlineChange(snapshots, placeId, { asOf, toleranceDays = 3 } = {}) {
  const ordered = snapshots.slice().sort((a, b) => Date.parse(a.takenAt) - Date.parse(b.takenAt));
  const latest = ordered.at(-1);
  if (!latest) return { status: 'no_data' };

  // The reading has to come from the *latest* run. If this week's call failed
  // for this place, an older total is not "the current total" and must not be
  // ranked or differenced as if it were.
  const current = readingFor(latest, placeId);
  if (!current) {
    const lastGood = ordered.filter((snapshot) => readingFor(snapshot, placeId)).at(-1);
    if (!lastGood) return { status: 'no_data' };
    return {
      status: 'stale',
      lastSeenAt: lastGood.takenAt,
      lastTotal: readingFor(lastGood, placeId).totalReviews,
    };
  }

  const end = asOf ? Date.parse(asOf) : Date.parse(latest.takenAt);
  const target = end - WEEK;
  const earlier = ordered.filter(
    (snapshot) => Date.parse(snapshot.takenAt) < Date.parse(latest.takenAt) && readingFor(snapshot, placeId)
  );
  if (earlier.length === 0) {
    return {
      status: 'baseline',
      total: current.totalReviews,
      rating: current.rating,
      at: latest.takenAt,
    };
  }

  let chosen = earlier.at(-1);
  let bestGap = Infinity;
  for (const snapshot of earlier) {
    const gap = Math.abs(Date.parse(snapshot.takenAt) - target);
    if (gap < bestGap) {
      chosen = snapshot;
      bestGap = gap;
    }
  }
  const previous = readingFor(chosen, placeId);
  const days = Math.round((Date.parse(latest.takenAt) - Date.parse(chosen.takenAt)) / DAY);

  return {
    status: 'ok',
    total: current.totalReviews,
    rating: current.rating,
    at: latest.takenAt,
    newReviews: current.totalReviews - previous.totalReviews,
    ratingChange:
      typeof current.rating === 'number' && typeof previous.rating === 'number'
        ? Number((current.rating - previous.rating).toFixed(2))
        : null,
    previousTotal: previous.totalReviews,
    comparedTo: chosen.takenAt,
    days,
    exactWeek: Math.abs(days - 7) <= toleranceDays,
  };
}

/** Consecutive most-recent weeks in which at least one review landed. */
export function currentStreak(series) {
  let streak = 0;
  for (const week of series) {
    if (week.newReviews === null || week.newReviews < 1) break;
    streak += 1;
  }
  return streak;
}

/**
 * Consecutive most-recent weeks with nothing new. The mirror of the streak, and
 * the thing worth saying out loud when a practice has gone quiet.
 */
export function currentDrought(series) {
  let weeks = 0;
  for (const week of series) {
    if (week.newReviews === null || week.newReviews > 0) break;
    weeks += 1;
  }
  return weeks;
}

/** Mean new reviews per week over the last `weeks` weeks that have a figure. */
export function pace(series, weeks = 4) {
  const known = series.filter((week) => week.newReviews !== null).slice(0, weeks);
  if (known.length === 0) return null;
  const total = known.reduce((sum, week) => sum + week.newReviews, 0);
  return { weeks: known.length, total, perWeek: Number((total / known.length).toFixed(2)) };
}

function median(values) {
  if (values.length === 0) return null;
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function buildRow(entry, { snapshots, anchors, asOf, isClient }) {
  const series = placeSeries(anchors, entry.placeId);
  const headline = headlineChange(snapshots, entry.placeId, { asOf });
  const latestRecord = snapshots.at(-1)?.places?.[entry.placeId];
  const readable = headline.status === 'ok' || headline.status === 'baseline';
  return {
    placeId: entry.placeId,
    name: latestRecord?.name || entry.name,
    isClient,
    status: readable ? 'ok' : (latestRecord?.status ?? headline.status),
    lastSeenAt: headline.lastSeenAt ?? null,
    error: latestRecord?.error ?? null,
    businessStatus: latestRecord?.businessStatus ?? null,
    currentPlaceId: latestRecord?.currentPlaceId ?? null,
    total: headline.total ?? null,
    rating: headline.rating ?? null,
    newReviews: headline.status === 'ok' ? headline.newReviews : null,
    ratingChange: headline.status === 'ok' ? headline.ratingChange : null,
    days: headline.status === 'ok' ? headline.days : null,
    exactWeek: headline.status === 'ok' ? headline.exactWeek : null,
    baseline: headline.status === 'baseline',
    series,
    streak: currentStreak(series),
    drought: currentDrought(series),
    pace: pace(series, 4),
  };
}

/**
 * Everything one practice's weekly report needs: its own numbers, its rivals',
 * where it sits in the pack, and what it would take to move up a place.
 */
export function buildClientReport(client, history, { asOf, weeks = 12 } = {}) {
  const snapshots = history.snapshots;
  const anchors = buildAnchors(snapshots, { asOf, weeks });

  const clientRow = buildRow(client, { snapshots, anchors, asOf, isClient: true });
  const competitorRows = (client.competitors ?? []).map((rival) =>
    buildRow(rival, { snapshots, anchors, asOf, isClient: false })
  );
  const rows = [clientRow, ...competitorRows];
  const live = rows.filter((row) => row.status === 'ok' && row.total !== null);

  // Rank on total reviews; ties break on rating, then alphabetically, so a
  // position never flips about between two runs for no reason.
  const byTotal = live
    .slice()
    .sort(
      (a, b) =>
        b.total - a.total || (b.rating ?? 0) - (a.rating ?? 0) || a.name.localeCompare(b.name)
    );
  byTotal.forEach((row, index) => {
    row.rank = index + 1;
  });

  const withNew = live.filter((row) => row.newReviews !== null);
  const byNew = withNew
    .slice()
    .sort((a, b) => b.newReviews - a.newReviews || b.total - a.total || a.name.localeCompare(b.name));
  byNew.forEach((row, index) => {
    row.rankByNew = index + 1;
  });

  const groupNew = withNew.reduce((sum, row) => sum + Math.max(0, row.newReviews), 0);
  const shareOfNew =
    groupNew > 0 && clientRow.newReviews !== null
      ? Math.max(0, clientRow.newReviews) / groupNew
      : null;

  // The next practice up the table, and whether the client's current pace closes
  // the gap. Only honest if we have a pace for both.
  let chase = null;
  if (clientRow.rank && clientRow.rank > 1) {
    const target = byTotal[clientRow.rank - 2];
    const gap = target.total - clientRow.total;
    const clientPerWeek = clientRow.pace?.perWeek ?? null;
    const targetPerWeek = target.pace?.perWeek ?? null;
    const closing = clientPerWeek !== null && targetPerWeek !== null ? clientPerWeek - targetPerWeek : null;
    chase = {
      name: target.name,
      gap,
      closingPerWeek: closing,
      weeksToOvertake:
        closing !== null && closing > 0 && gap > 0 ? Math.ceil(gap / closing) : null,
    };
  }

  // The margin the leader is holding, so the report has something to say when
  // the client is already top.
  let lead = null;
  if (clientRow.rank === 1 && byTotal.length > 1) {
    lead = { name: byTotal[1].name, margin: clientRow.total - byTotal[1].total };
  }

  const rivalNew = competitorRows.filter((row) => row.newReviews !== null).map((row) => row.newReviews);
  const rivalPace = competitorRows.map((row) => row.pace?.perWeek).filter((value) => typeof value === 'number');

  return {
    client: { id: client.id, name: client.name, area: client.area ?? null, searchTerm: client.searchTerm ?? null },
    generatedAt: new Date().toISOString(),
    weekEnding: clientRow.series[0]?.weekEnding ?? snapshots.at(-1)?.takenAt ?? null,
    row: clientRow,
    competitors: competitorRows,
    table: byTotal,
    problems: rows.filter((row) => row.status !== 'ok'),
    group: {
      size: live.length,
      newReviews: groupNew,
      shareOfNew,
      rivalNewTotal: rivalNew.reduce((sum, value) => sum + Math.max(0, value), 0),
      rivalNewMedian: median(rivalNew),
      rivalPaceMedian: median(rivalPace),
    },
    chase,
    lead,
  };
}

export function buildAllReports(config, history, options = {}) {
  return config.clients.map((client) => buildClientReport(client, history, options));
}
