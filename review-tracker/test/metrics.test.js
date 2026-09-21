import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAnchors,
  placeSeries,
  headlineChange,
  currentStreak,
  pace,
  buildClientReport,
} from '../src/metrics.js';
import { makeHistory } from './helpers.js';

const DAY = 86_400_000;

test('headline change counts net new reviews over the trailing week', () => {
  const history = makeHistory([
    { weeksAgo: 1, totals: { a: 100 } },
    { weeksAgo: 0, totals: { a: 106 } },
  ]);
  const result = headlineChange(history.snapshots, 'a');
  assert.equal(result.status, 'ok');
  assert.equal(result.newReviews, 6);
  assert.equal(result.total, 106);
  assert.equal(result.days, 7);
  assert.equal(result.exactWeek, true);
});

test('a first run is reported as a baseline, not as zero new reviews', () => {
  const history = makeHistory([{ weeksAgo: 0, totals: { a: 100 } }]);
  const result = headlineChange(history.snapshots, 'a');
  assert.equal(result.status, 'baseline');
  assert.equal(result.total, 100);
  assert.equal(result.newReviews, undefined);
});

test('a missed week is reported over its real span, not passed off as seven days', () => {
  const history = makeHistory([
    { weeksAgo: 2, totals: { a: 100 } },
    { weeksAgo: 0, totals: { a: 110 } },
  ]);
  const result = headlineChange(history.snapshots, 'a');
  assert.equal(result.newReviews, 10);
  assert.equal(result.days, 14);
  assert.equal(result.exactWeek, false);
});

test('a removed review shows as a negative, it is not clamped away', () => {
  const history = makeHistory([
    { weeksAgo: 1, totals: { a: 100 } },
    { weeksAgo: 0, totals: { a: 98 } },
  ]);
  assert.equal(headlineChange(history.snapshots, 'a').newReviews, -2);
});

test('weekly anchors tolerate a run landing a couple of days early or late', () => {
  const history = makeHistory([
    { weeksAgo: 2, offsetDays: -2, totals: { a: 90 } },
    { weeksAgo: 1, offsetDays: 1, totals: { a: 100 } },
    { weeksAgo: 0, totals: { a: 108 } },
  ]);
  const anchors = buildAnchors(history.snapshots, { weeks: 3 });
  assert.equal(anchors[0].snapshot.places.a.totalReviews, 108);
  assert.equal(anchors[1].snapshot.places.a.totalReviews, 100);
  assert.equal(anchors[2].snapshot.places.a.totalReviews, 90);
  assert.equal(anchors[3].snapshot, null);
});

test('a skipped week leaves a hole rather than being folded into its neighbour', () => {
  const history = makeHistory([
    { weeksAgo: 3, totals: { a: 80 } },
    { weeksAgo: 1, totals: { a: 100 } },
    { weeksAgo: 0, totals: { a: 104 } },
  ]);
  const series = placeSeries(buildAnchors(history.snapshots, { weeks: 4 }), 'a');
  assert.equal(series[0].newReviews, 4); // week 0
  assert.equal(series[1].newReviews, null); // week 1 has no reading at its far end
  assert.equal(series[2].newReviews, null); // week 2 likewise
  assert.equal(series[3].newReviews, null);
});

test('the streak stops at a quiet week and at a gap in the data', () => {
  assert.equal(currentStreak([{ newReviews: 3 }, { newReviews: 1 }, { newReviews: 0 }, { newReviews: 5 }]), 2);
  assert.equal(currentStreak([{ newReviews: 0 }, { newReviews: 4 }]), 0);
  assert.equal(currentStreak([{ newReviews: 2 }, { newReviews: null }, { newReviews: 9 }]), 1);
});

test('pace averages only the weeks that have a figure', () => {
  const result = pace([{ newReviews: 4 }, { newReviews: null }, { newReviews: 2 }, { newReviews: 0 }], 4);
  assert.equal(result.weeks, 3);
  assert.equal(result.total, 6);
  assert.equal(result.perWeek, 2);
});

test('a client report ranks the pack, shares out the week, and sets the chase', () => {
  const history = makeHistory([
    { weeksAgo: 4, totals: { us: 180, big: 300, small: 120 } },
    { weeksAgo: 3, totals: { us: 186, big: 302, small: 121 } },
    { weeksAgo: 2, totals: { us: 192, big: 304, small: 122 } },
    { weeksAgo: 1, totals: { us: 198, big: 306, small: 123 } },
    { weeksAgo: 0, totals: { us: 206, big: 308, small: 124 } },
  ], { names: { us: 'Us', big: 'Big', small: 'Small' } });
  const client = {
    id: 'us',
    name: 'Us',
    placeId: 'us',
    competitors: [
      { name: 'Big', placeId: 'big' },
      { name: 'Small', placeId: 'small' },
    ],
  };
  const report = buildClientReport(client, history);

  assert.equal(report.row.newReviews, 8);
  assert.equal(report.row.total, 206);
  assert.equal(report.row.rank, 2, 'second on total reviews');
  assert.equal(report.row.rankByNew, 1, 'first on reviews gained this week');
  assert.equal(report.group.newReviews, 8 + 2 + 1);
  assert.equal(Math.round(report.group.shareOfNew * 100), 73);
  assert.equal(report.chase.name, 'Big');
  assert.equal(report.chase.gap, 102);
  assert.equal(report.chase.closingPerWeek, 4.5); // 6.5/wk against 2/wk
  assert.equal(report.chase.weeksToOvertake, 23);
  assert.equal(report.row.streak, 4);
});

test('the leader gets a margin instead of a chase', () => {
  const history = makeHistory([
    { weeksAgo: 1, totals: { us: 300, other: 100 } },
    { weeksAgo: 0, totals: { us: 305, other: 101 } },
  ], { names: { us: 'Us', other: 'Other' } });
  const report = buildClientReport(
    { id: 'us', name: 'Us', placeId: 'us', competitors: [{ name: 'Other', placeId: 'other' }] },
    history
  );
  assert.equal(report.chase, null);
  assert.equal(report.row.rank, 1);
  assert.equal(report.lead.margin, 204);
  assert.equal(report.lead.name, 'Other');
});

test('a chase that the current pace never closes reports no arrival week', () => {
  const history = makeHistory([
    { weeksAgo: 2, totals: { us: 100, big: 200 } },
    { weeksAgo: 1, totals: { us: 101, big: 210 } },
    { weeksAgo: 0, totals: { us: 102, big: 220 } },
  ]);
  const report = buildClientReport(
    { id: 'us', name: 'Us', placeId: 'us', competitors: [{ name: 'Big', placeId: 'big' }] },
    history
  );
  assert.equal(report.chase.weeksToOvertake, null);
  assert.ok(report.chase.closingPerWeek < 0);
});

test('a place that failed to read is quarantined, not counted as zero', () => {
  const history = makeHistory([
    { weeksAgo: 1, totals: { us: 100, dead: 50 } },
    { weeksAgo: 0, totals: { us: 105 }, missing: ['dead'] },
  ]);
  const report = buildClientReport(
    { id: 'us', name: 'Us', placeId: 'us', competitors: [{ name: 'Dead', placeId: 'dead' }] },
    history
  );
  assert.equal(report.table.length, 1, 'only the readable place is ranked');
  assert.equal(report.problems.length, 1);
  assert.equal(report.problems[0].placeId, 'dead');
  assert.equal(report.group.newReviews, 5);
  assert.equal(report.group.shareOfNew, 1);
});

test('an empty history does not throw', () => {
  const report = buildClientReport(
    { id: 'us', name: 'Us', placeId: 'us', competitors: [] },
    { version: 1, snapshots: [] }
  );
  assert.equal(report.row.total, null);
  assert.equal(report.row.newReviews, null);
  assert.equal(buildAnchors([], {}).length, 0);
});
