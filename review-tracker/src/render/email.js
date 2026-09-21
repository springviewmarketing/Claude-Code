/**
 * The weekly email to the practice.
 *
 * Short by design. One number, one line of context, one link. A practice
 * manager reads this on a phone between patients, so anything that does not
 * change what they do on Monday morning is cut.
 *
 * House rules apply, because a client reads this: British English, no em
 * dashes, "patients" rather than "customers", and nothing that nudges towards
 * incentivised or gated reviews.
 */

import { formatDate } from './text.js';

const esc = (value) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

const plural = (n, one, many) => `${n} ${Math.abs(n) === 1 ? one : many}`;

/** The subject line carries the number, so it reads without opening. */
export function subjectFor(report) {
  const { row, client } = report;
  if (row.status !== 'ok') return `${client.name}, Google reviews update`;
  if (row.baseline) return `${client.name}, your Google reviews baseline`;
  if (row.newReviews > 0) return `${client.name}, ${plural(row.newReviews, 'new Google review', 'new Google reviews')} this week`;
  return `${client.name}, Google reviews this week`;
}

/**
 * The one line of context under the headline. Picked in order of what the
 * practice most needs to hear, so only one of these ever appears.
 */
export function contextLine(report) {
  const { row, group, chase, lead } = report;

  if (row.drought >= 3) {
    return `It has now been ${plural(row.drought, 'week', 'weeks')} without a new review. The quickest fix is asking every patient at the point they say they are happy with their visit.`;
  }
  if (row.newReviews > 0 && row.rankByNew === 1 && group.size > 1) {
    return `That is more than any other optician we track near you${group.shareOfNew !== null ? `, and ${Math.round(group.shareOfNew * 100)}% of every new review in the area this week` : ''}.`;
  }
  if (row.streak >= 3) {
    return `That is ${plural(row.streak, 'week', 'weeks')} in a row with at least one new review.`;
  }
  if (chase && chase.gap > 0 && chase.gap <= 10) {
    return `You are ${plural(chase.gap, 'review', 'reviews')} behind ${chase.name}. That is the next one to overtake.`;
  }
  if (lead) {
    return `You are still top of your local table, ${plural(lead.margin, 'review', 'reviews')} clear of ${lead.name}.`;
  }
  if (chase) {
    return `Next up the table is ${chase.name}, ${plural(chase.gap, 'review', 'reviews')} ahead of you.`;
  }
  return `You are on ${plural(row.total, 'review', 'reviews')} in total.`;
}

/** The headline sentence. */
function headlineFor(report) {
  const { row } = report;
  if (row.baseline) {
    return `We have started tracking your Google reviews. You are on ${plural(row.total, 'review', 'reviews')} today, averaging ${row.rating ?? 'n/a'} stars. From next week this email shows what you have added.`;
  }
  const period = row.exactWeek ? 'this week' : `in the last ${plural(row.days, 'day', 'days')}`;
  if (row.newReviews > 0) {
    return `You picked up ${plural(row.newReviews, 'new Google review', 'new Google reviews')} ${period}, taking you to ${plural(row.total, 'review', 'reviews')} at ${row.rating ?? 'n/a'} stars.`;
  }
  if (row.newReviews === 0) {
    return `No new Google reviews ${period}. You are holding at ${plural(row.total, 'review', 'reviews')}, ${row.rating ?? 'n/a'} stars.`;
  }
  return `Your review total moved by ${row.newReviews} ${period}, to ${plural(row.total, 'review', 'reviews')}. Google removes reviews it judges to be spam, so a total can dip without anyone having done anything wrong.`;
}

/**
 * Build the email. Returns null when there is nothing worth sending, so a
 * profile we could not read never produces a mystifying message to a client.
 */
export function buildEmail(report, { reportUrl, agencyName = 'Spring View Marketing', senderName = 'Tom' } = {}) {
  const { row, client } = report;
  if (row.status !== 'ok') return null;

  const week = formatDate(report.weekEnding);
  const headline = headlineFor(report);
  const context = row.baseline ? null : contextLine(report);
  const big = row.baseline ? String(row.total) : (row.newReviews > 0 ? `+${row.newReviews}` : String(row.newReviews));

  const lines = [
    `Hi,`,
    '',
    headline,
    ...(context ? ['', context] : []),
    ...(reportUrl ? ['', `Your full report, including how the other opticians near you did: ${reportUrl}`] : []),
    '',
    'Any questions, just reply.',
    '',
    senderName,
    agencyName,
  ];

  const html = `<!doctype html>
<html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f5;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f5;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #dde2e1;border-radius:12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
        <tr><td style="padding:28px 28px 8px;">
          <p style="margin:0 0 4px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#7d8a8a;">${esc(agencyName)}</p>
          <p style="margin:0;font-size:17px;font-weight:600;color:#13191a;">${esc(client.name)}</p>
          <p style="margin:2px 0 0;font-size:13px;color:#4e5a5b;">Google reviews, week ending ${esc(week)}</p>
        </td></tr>
        <tr><td style="padding:14px 28px 0;">
          <p style="margin:0;font-size:46px;line-height:1;font-weight:700;color:${row.newReviews > 0 || row.baseline ? '#0e5a62' : '#4e5a5b'};">${esc(big)}</p>
          <p style="margin:8px 0 0;font-size:15px;line-height:1.55;color:#13191a;">${esc(headline)}</p>
          ${context ? `<p style="margin:12px 0 0;font-size:15px;line-height:1.55;color:#4e5a5b;">${esc(context)}</p>` : ''}
        </td></tr>
        ${
          reportUrl
            ? `<tr><td style="padding:22px 28px 0;">
          <a href="${esc(reportUrl)}" style="display:inline-block;background:#0e5a62;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 20px;border-radius:8px;">See your full report</a>
          <p style="margin:10px 0 0;font-size:12px;color:#7d8a8a;">Including how the other opticians near you did this week.</p>
        </td></tr>`
            : ''
        }
        <tr><td style="padding:24px 28px 28px;">
          <p style="margin:0;font-size:14px;color:#4e5a5b;">Any questions, just reply.</p>
          <p style="margin:12px 0 0;font-size:14px;color:#13191a;">${esc(senderName)}<br><span style="color:#7d8a8a;">${esc(agencyName)}</span></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  return { subject: subjectFor(report), text: lines.join('\n'), html };
}
