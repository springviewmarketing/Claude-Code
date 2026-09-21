import test from 'node:test';
import assert from 'node:assert/strict';
import { buildEmail, subjectFor, contextLine } from '../src/render/email.js';
import { buildClientReport, currentDrought } from '../src/metrics.js';
import { makeHistory } from './helpers.js';

const client = {
  id: 'us', name: 'Test Opticians', placeId: 'us',
  competitors: [{ name: 'Rival', placeId: 'rival' }],
};

const reportFrom = (spec, names = { us: 'Test Opticians', rival: 'Rival' }) =>
  buildClientReport(client, makeHistory(spec, { names }));

test('the drought counts only the quiet weeks at the end', () => {
  assert.equal(currentDrought([{ newReviews: 0 }, { newReviews: 0 }, { newReviews: 3 }]), 2);
  assert.equal(currentDrought([{ newReviews: 1 }, { newReviews: 0 }]), 0);
  assert.equal(currentDrought([{ newReviews: 0 }, { newReviews: null }, { newReviews: 0 }]), 1, 'a gap is not a quiet week');
});

test('the subject carries the number so it reads unopened', () => {
  const report = reportFrom([
    { weeksAgo: 1, totals: { us: 100, rival: 50 } },
    { weeksAgo: 0, totals: { us: 103, rival: 50 } },
  ]);
  assert.equal(subjectFor(report), 'Test Opticians, 3 new Google reviews this week');
});

test('one new review is not pluralised', () => {
  const report = reportFrom([
    { weeksAgo: 1, totals: { us: 100, rival: 50 } },
    { weeksAgo: 0, totals: { us: 101, rival: 50 } },
  ]);
  assert.equal(subjectFor(report), 'Test Opticians, 1 new Google review this week');
});

test('a long quiet spell is named, and it outranks everything else worth saying', () => {
  const report = reportFrom([
    { weeksAgo: 4, totals: { us: 100, rival: 50 } },
    { weeksAgo: 3, totals: { us: 100, rival: 50 } },
    { weeksAgo: 2, totals: { us: 100, rival: 50 } },
    { weeksAgo: 1, totals: { us: 100, rival: 50 } },
    { weeksAgo: 0, totals: { us: 100, rival: 50 } },
  ]);
  assert.equal(report.row.drought, 4);
  const line = contextLine(report);
  assert.match(line, /4 weeks without a new review/);
  assert.match(line, /asking every patient/);
});

test('a short quiet spell does not get the drought line', () => {
  const report = reportFrom([
    { weeksAgo: 2, totals: { us: 100, rival: 50 } },
    { weeksAgo: 1, totals: { us: 100, rival: 50 } },
    { weeksAgo: 0, totals: { us: 100, rival: 50 } },
  ]);
  assert.equal(report.row.drought, 2);
  assert.doesNotMatch(contextLine(report), /without a new review/);
});

test('a first reading says so rather than claiming a week of nothing', () => {
  const report = reportFrom([{ weeksAgo: 0, totals: { us: 26, rival: 50 } }]);
  const email = buildEmail(report, { reportUrl: 'https://example.test/r/abc' });
  assert.match(email.subject, /baseline/);
  assert.match(email.text, /We have started tracking/);
  assert.doesNotMatch(email.text, /0 new/);
});

test('a profile that could not be read sends nothing at all', () => {
  const report = buildClientReport(client, { version: 1, snapshots: [] });
  assert.equal(buildEmail(report), null, 'a client never gets a mystifying email');
});

test('a removed review is explained rather than left looking like a mistake', () => {
  const report = reportFrom([
    { weeksAgo: 1, totals: { us: 100, rival: 50 } },
    { weeksAgo: 0, totals: { us: 98, rival: 50 } },
  ]);
  const email = buildEmail(report, {});
  assert.match(email.text, /moved by -2/);
  assert.match(email.text, /judges to be spam/);
});

test('the link appears in both the text and the HTML, and only when given', () => {
  const spec = [
    { weeksAgo: 1, totals: { us: 100, rival: 50 } },
    { weeksAgo: 0, totals: { us: 104, rival: 50 } },
  ];
  const withLink = buildEmail(reportFrom(spec), { reportUrl: 'https://example.test/r/tok3n' });
  assert.match(withLink.text, /https:\/\/example\.test\/r\/tok3n/);
  assert.match(withLink.html, /href="https:\/\/example\.test\/r\/tok3n"/);

  const without = buildEmail(reportFrom(spec), {});
  assert.doesNotMatch(without.text, /full report/);
  assert.doesNotMatch(without.html, /See your full report/);
});

test('house rules hold: no em dashes, British spelling, patients not customers', () => {
  const cases = [
    [{ weeksAgo: 1, totals: { us: 100, rival: 50 } }, { weeksAgo: 0, totals: { us: 106, rival: 50 } }],
    [{ weeksAgo: 1, totals: { us: 100, rival: 50 } }, { weeksAgo: 0, totals: { us: 100, rival: 55 } }],
    [{ weeksAgo: 0, totals: { us: 26, rival: 50 } }],
  ];
  for (const spec of cases) {
    const email = buildEmail(reportFrom(spec), { reportUrl: 'https://x.test/r/a' });
    if (!email) continue;
    assert.doesNotMatch(email.text, /—/, 'no em dash');
    assert.doesNotMatch(email.html, /—/, 'no em dash');
    assert.doesNotMatch(email.text, /customer/i, 'patients, never customers');
    assert.doesNotMatch(email.text, /\b(color|behavior|favorite|organiz)/i, 'British English');
  }
});

test('nothing in the email invites an incentive or a filtered ask', () => {
  const report = reportFrom([
    { weeksAgo: 5, totals: { us: 100, rival: 50 } },
    { weeksAgo: 4, totals: { us: 100, rival: 50 } },
    { weeksAgo: 3, totals: { us: 100, rival: 50 } },
    { weeksAgo: 2, totals: { us: 100, rival: 50 } },
    { weeksAgo: 1, totals: { us: 100, rival: 50 } },
    { weeksAgo: 0, totals: { us: 100, rival: 50 } },
  ]);
  const email = buildEmail(report, {});
  for (const banned of [/discount/i, /prize/i, /voucher/i, /incentiv/i, /reward/i, /happy patients/i, /only ask/i]) {
    assert.doesNotMatch(email.text, banned);
  }
});

test('a client name with markup cannot break the HTML email', () => {
  const nasty = { id: 'x', name: 'Smith & Sons <b>Opticians</b>', placeId: 'us', competitors: [] };
  const report = buildClientReport(nasty, makeHistory([
    { weeksAgo: 1, totals: { us: 10 } },
    { weeksAgo: 0, totals: { us: 12 } },
  ], { names: { us: 'Smith & Sons <b>Opticians</b>' } }));
  const email = buildEmail(report, {});
  assert.doesNotMatch(email.html, /<b>Opticians<\/b>/);
  assert.match(email.html, /Smith &amp; Sons/);
});
