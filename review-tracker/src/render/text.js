/**
 * Plain-text output: a terminal summary for the run, and a message the account
 * manager can paste straight to the practice.
 *
 * House rules apply to anything a practice will read: British English, no em
 * dashes, "patients" rather than "customers", and nothing that nudges towards
 * incentivised or gated reviews, both of which breach Google policy and the
 * DMCCA.
 */

const gb = (iso, opts = { day: 'numeric', month: 'short', year: 'numeric' }) =>
  iso ? new Intl.DateTimeFormat('en-GB', { ...opts, timeZone: 'Europe/London' }).format(new Date(iso)) : 'unknown';

const plural = (n, one, many) => `${n} ${Math.abs(n) === 1 ? one : many}`;
const signed = (n) => (n > 0 ? `+${n}` : `${n}`);
const pct = (value) => `${Math.round(value * 100)}%`;

export function formatPeriod(row) {
  if (row.days === null) return 'this period';
  if (row.exactWeek) return 'this week';
  return `over the last ${plural(row.days, 'day', 'days')}`;
}

/** The message for the practice. One short paragraph per idea, no padding. */
export function practiceMessage(report) {
  const { row, group, chase, lead } = report;
  const lines = [];
  const week = gb(report.weekEnding);

  lines.push(`${report.client.name}, Google reviews to ${week}`);
  lines.push('');

  if (row.status !== 'ok') {
    lines.push(
      `We could not read your Google profile this week (${row.error ?? row.status}). Nothing is wrong at your end as far as we can tell, and we will pick it up on the next run.`
    );
    return lines.join('\n');
  }

  if (row.baseline) {
    lines.push(
      `First reading taken. You are on ${plural(row.total, 'review', 'reviews')} with a ${row.rating ?? 'n/a'} star average. From next week this report shows what you have added.`
    );
    return lines.join('\n');
  }

  const period = formatPeriod(row);
  if (row.newReviews > 0) {
    lines.push(
      `You picked up ${plural(row.newReviews, 'new review', 'new reviews')} ${period}. That takes you to ${plural(row.total, 'review', 'reviews')} at ${row.rating ?? 'n/a'} stars.`
    );
  } else if (row.newReviews === 0) {
    lines.push(
      `No new reviews ${period}. You are holding at ${plural(row.total, 'review', 'reviews')}, ${row.rating ?? 'n/a'} stars.`
    );
  } else {
    lines.push(
      `Your total moved by ${signed(row.newReviews)} ${period}, to ${plural(row.total, 'review', 'reviews')}. Google removes reviews it judges to be spam, so a total can dip without anyone doing anything wrong.`
    );
  }
  lines.push('');

  // How the week went against the rest of the local pack.
  if (group.size > 1 && row.rankByNew) {
    if (row.rankByNew === 1 && row.newReviews > 0) {
      lines.push(
        `That is more than any other optician we track near you. ${pct(group.shareOfNew)} of every new review in the area ${period === 'this week' ? 'this week' : 'in that time'} came to you.`
      );
    } else if (group.rivalNewTotal > 0) {
      const ahead = report.table.filter((r) => (r.newReviews ?? -1) > row.newReviews).length;
      lines.push(
        `${plural(ahead, 'practice', 'practices')} near you did better ${period}, and the area gained ${plural(group.rivalNewTotal, 'review', 'reviews')} between them. Your share was ${group.shareOfNew === null ? 'none of them' : pct(group.shareOfNew)}.`
      );
    }
    lines.push('');
  }

  if (row.streak >= 2) {
    lines.push(`That is ${plural(row.streak, 'week', 'weeks')} in a row with at least one new review. Worth keeping going.`);
    lines.push('');
  }

  if (lead) {
    lines.push(
      `You are top of the local table, ${plural(lead.margin, 'review', 'reviews')} clear of ${lead.name}.`
    );
  } else if (chase) {
    const line = `Next up the table is ${chase.name} on ${plural(chase.gap + row.total, 'review', 'reviews')}, so you are ${plural(chase.gap, 'review', 'reviews')} behind.`;
    if (chase.weeksToOvertake) {
      lines.push(`${line} At the pace of the last month you pass them in about ${plural(chase.weeksToOvertake, 'week', 'weeks')}.`);
    } else if (chase.closingPerWeek !== null && chase.closingPerWeek <= 0) {
      lines.push(`${line} They are currently gaining reviews faster than you are, so that gap is widening.`);
    } else {
      lines.push(line);
    }
  }

  return lines.join('\n').trim();
}

/** What gets printed in the terminal after a run. */
export function terminalSummary(reports) {
  const lines = [];
  for (const report of reports) {
    const { row } = report;
    lines.push('');
    lines.push(`  ${report.client.name}  ${gb(report.weekEnding)}`);
    if (row.status !== 'ok') {
      lines.push(`    could not read this profile: ${row.error ?? row.status}`);
    } else if (row.baseline) {
      lines.push(`    baseline set: ${row.total} reviews, ${row.rating ?? 'n/a'} stars`);
    } else {
      const share = report.group.shareOfNew === null ? 'n/a' : pct(report.group.shareOfNew);
      lines.push(
        `    ${signed(row.newReviews)} this ${row.exactWeek ? 'week' : `${row.days}d period`}   total ${row.total}   ${row.rating ?? 'n/a'} stars   rank ${row.rank ?? '?'}/${report.group.size}   ${share} of the area's new reviews`
      );
    }
    for (const rival of report.competitors) {
      if (rival.status !== 'ok') {
        lines.push(`      ${rival.name}: unreadable (${rival.status})`);
      } else {
        lines.push(
          `      ${rival.name}: ${rival.newReviews === null ? 'baseline' : signed(rival.newReviews)}, total ${rival.total}, ${rival.rating ?? 'n/a'} stars`
        );
      }
    }
    if (report.problems.length > 0) {
      lines.push(`    ${report.problems.length} profile(s) need attention, see the report footer`);
    }
  }
  return lines.join('\n');
}

export { gb as formatDate };
