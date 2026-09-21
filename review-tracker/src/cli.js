#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';

import { loadConfig, loadEnv, allPlaces } from './config.js';
import { PlacesClient, fetchAll } from './places.js';
import { loadHistory, saveHistory, addSnapshot, toPlaceMap } from './store.js';
import { buildAllReports } from './metrics.js';
import { renderReport, renderIndex } from './render/html.js';
import { practiceMessage, terminalSummary, formatDate } from './render/text.js';
import { toCsv } from './render/csv.js';
import { demoConfig, demoHistory } from './demo-data.js';
import { resolveAnchor, findNearby, shortlist } from './nearby.js';
import { milesToMetres } from './geo.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const USAGE = `
review-tracker, weekly Google review counts for practices and their local rivals

  snapshot            read every tracked profile and store this week's totals
  report              rebuild the reports from stored history, no API calls
  weekly              snapshot, then report (this is what the schedule runs)
  discover "<query>"  find place IDs by name, for setting a practice up
  nearby "<practice>" find every optician within a radius of a practice, and
                      write the config block for it. Takes --miles, --limit
  demo                write a worked example report from sample data, no API key

Options
  --config <path>   default config/practices.json
  --data <path>     default data/snapshots.json
  --out <dir>       default reports/
  --as-of <date>    treat this ISO date as "now" when reporting
  --weeks <n>       weeks of history to chart, default 12
  --miles <n>       radius for the nearby search, default 5
  --limit <n>       how many competitors the nearby search shortlists, default 5
  --id <slug>       the client id to write, default taken from the name
  --include-chains yes   put Specsavers, Boots and the rest back in
  --quiet           print less
`;

function parseArgs(argv) {
  const [command = 'help', ...rest] = argv;
  const options = { command, positional: [] };
  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      if (key === 'quiet') options.quiet = true;
      else options[key] = rest[++i];
    } else {
      options.positional.push(arg);
    }
  }
  return options;
}

const resolve = (value, fallback) => path.resolve(ROOT, value ?? fallback);

async function writeReports(reports, { outDir, agencyName, quiet }) {
  await mkdir(outDir, { recursive: true });
  const written = [];
  for (const report of reports) {
    const message = report.row.status === 'ok' ? practiceMessage(report) : null;
    const file = path.join(outDir, `${report.client.id}.html`);
    await writeFile(file, renderReport(report, { agencyName, message }), 'utf8');
    written.push(file);
    if (message) {
      const messageFile = path.join(outDir, `${report.client.id}.txt`);
      await writeFile(messageFile, `${message}\n`, 'utf8');
      written.push(messageFile);
    }
  }
  if (reports.length > 0) {
    const indexFile = path.join(outDir, 'index.html');
    await writeFile(indexFile, renderIndex(reports, { agencyName }), 'utf8');
    written.push(indexFile);
    const csvFile = path.join(outDir, 'history.csv');
    await writeFile(csvFile, toCsv(reports), 'utf8');
    written.push(csvFile);
  }
  if (!quiet) {
    console.log(`\n  Wrote ${written.length} files to ${path.relative(ROOT, outDir) || '.'}/`);
  }
  return written;
}

async function commandSnapshot(options) {
  const config = await loadConfig(resolve(options.config, 'config/practices.json'));
  const dataFile = resolve(options.data, 'data/snapshots.json');
  const places = allPlaces(config);

  const client = new PlacesClient({
    apiKey: process.env.GOOGLE_MAPS_API_KEY,
    regionCode: config.agency?.regionCode ?? 'GB',
    languageCode: config.agency?.languageCode ?? 'en-GB',
  });

  if (!options.quiet) console.log(`  Reading ${places.length} Google profiles...`);
  const results = await fetchAll(client, places, {
    onResult: (record) => {
      if (options.quiet) return;
      const label = record.name ?? record.configName;
      console.log(
        record.status === 'ok'
          ? `    ok    ${label}: ${record.totalReviews} reviews, ${record.rating ?? 'n/a'} stars`
          : `    FAIL  ${label}: ${record.error}`
      );
    },
  });

  const failures = results.filter((result) => result.status !== 'ok');
  const history = await loadHistory(dataFile);
  const { merged } = addSnapshot(history, {
    takenAt: new Date().toISOString(),
    places: toPlaceMap(results),
  });
  await saveHistory(dataFile, history);

  // A place ID Google has re-issued keeps working for now but will not forever.
  for (const result of results) {
    if (result.status === 'ok' && result.currentPlaceId && result.currentPlaceId !== result.placeId) {
      console.warn(
        `  Note: Google now returns a different place ID for ${result.name}. Update the config to ${result.currentPlaceId}`
      );
    }
  }

  if (!options.quiet) {
    console.log(
      `  ${merged ? 'Merged into' : 'Stored as'} the reading for ${formatDate(history.snapshots.at(-1).takenAt)}. ${failures.length} failed. ${client.callCount} API calls.`
    );
  }
  return { config, history, failures };
}

async function commandReport(options, preloaded) {
  const config = preloaded?.config ?? (await loadConfig(resolve(options.config, 'config/practices.json')));
  const history = preloaded?.history ?? (await loadHistory(resolve(options.data, 'data/snapshots.json')));

  if (history.snapshots.length === 0) {
    console.error('  No readings stored yet. Run: npm run snapshot');
    process.exitCode = 1;
    return;
  }

  const reports = buildAllReports(config, history, {
    asOf: options['as-of'],
    weeks: Number(options.weeks ?? 12),
  });
  if (!options.quiet) console.log(terminalSummary(reports));
  await writeReports(reports, {
    outDir: resolve(options.out, 'reports'),
    agencyName: config.agency?.name ?? 'Spring View Marketing',
    quiet: options.quiet,
  });
}

async function commandDiscover(options) {
  const query = options.positional.join(' ');
  if (!query) {
    console.error('  Give it something to search for, e.g. discover "opticians in Hillsborough Sheffield"');
    process.exitCode = 1;
    return;
  }
  const client = new PlacesClient({ apiKey: process.env.GOOGLE_MAPS_API_KEY });
  const places = await client.searchText(query);
  if (places.length === 0) {
    console.log('  Nothing found. Try the practice name with its town.');
    return;
  }
  console.log(`\n  ${places.length} results for "${query}"\n`);
  for (const place of places) {
    console.log(`  ${place.name}`);
    console.log(`    ${place.address ?? ''}`);
    console.log(`    ${place.totalReviews} reviews, ${place.rating ?? 'n/a'} stars${place.businessStatus && place.businessStatus !== 'OPERATIONAL' ? `, ${place.businessStatus}` : ''}`);
    console.log(`    "placeId": "${place.placeId}"`);
    console.log('');
  }
  console.log('  Paste the placeId lines into config/practices.json.\n');
}

const slug = (name) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'practice';

function configBlock(anchor, rivals, id) {
  return JSON.stringify(
    {
      id,
      name: anchor.name,
      placeId: anchor.placeId,
      area: anchor.address ?? null,
      searchTerm: 'opticians near me',
      competitors: rivals.map((rival) => ({ name: rival.name, placeId: rival.placeId })),
    },
    null,
    2
  );
}

async function commandNearby(options) {
  const target = options.positional.join(' ');
  if (!target) {
    console.error('  Give it a practice, e.g. nearby "Murgatroyd Opticians Conisbrough" --miles 5');
    process.exitCode = 1;
    return;
  }

  const miles = Number(options.miles ?? 5);
  if (!Number.isFinite(miles) || miles <= 0 || miles > 31) {
    console.error('  --miles must be between 0 and 31. Google will not restrict a search wider than 50km.');
    process.exitCode = 1;
    return;
  }

  const client = new PlacesClient({ apiKey: process.env.GOOGLE_MAPS_API_KEY });
  const anchor = await resolveAnchor(client, target);

  console.log(`\n  Centred on ${anchor.name}`);
  console.log(`    ${anchor.address ?? ''}`);
  console.log(`    ${anchor.totalReviews ?? '?'} reviews, ${anchor.rating ?? 'n/a'} stars`);
  if (anchor.matched) console.log('    (matched by name. If that is the wrong branch, re-run with its place ID.)');
  console.log(`\n  Searching ${miles} miles around it...\n`);

  const radius = milesToMetres(miles);
  const places = await findNearby(client, { center: anchor.location, radiusMetres: radius });
  const anchorTotal = places.find((p) => p.placeId === anchor.placeId)?.totalReviews ?? anchor.totalReviews ?? 0;

  const includeChains = options['include-chains'] === 'yes' || options['include-chains'] === true;
  const { ladder, tooBig, tooSmall, notOpticians, chains, ceiling } = shortlist(places, {
    anchorPlaceId: anchor.placeId,
    anchorTotal,
    limit: Number(options.limit ?? 5),
    includeChains,
  });

  const chosen = new Set(ladder.map((p) => p.placeId));
  const line = (place, mark) =>
    `  ${mark} ${String(place.miles).padStart(4)}mi  ${String(place.totalReviews).padStart(5)} reviews  ${String(place.rating ?? 'n/a').padStart(3)}*  ${place.name}`;

  const excluded = new Set([...chains, ...notOpticians].map((p) => p.placeId));
  const opticians = places.filter((place) => place.isOptician !== false && !excluded.has(place.placeId));
  console.log(`  ${opticians.length} opticians within ${miles} miles. A + marks the ones shortlisted.\n`);
  for (const place of opticians) {
    const mark = place.placeId === anchor.placeId ? ' *' : chosen.has(place.placeId) ? ' +' : '  ';
    const why =
      place.placeId === anchor.placeId
        ? 'the practice itself'
        : chosen.has(place.placeId)
          ? ''
          : place.totalReviews > ceiling
            ? `too far ahead to chase, over ${ceiling}`
            : place.totalReviews < 5
              ? 'too few reviews to be a benchmark'
              : 'comparable, but outside the shortlist';
    console.log(line(place, mark));
    if (why) console.log(`          ${why}`);
  }

  if (chains.length > 0) {
    console.log(`\n  Chains and supermarket concessions, left out on purpose:\n`);
    for (const place of chains) console.log(line(place, '  '));
    console.log('\n  A chain is not a target anyone can catch, at any size. Add --include-chains if');
    console.log('  this practice is big enough to genuinely compete with one.');
  }

  // Shown rather than silently dropped: the name test is a judgement call, and
  // a genuine practice with an unusual name would otherwise vanish unnoticed.
  if (notOpticians.length > 0) {
    console.log(`\n  Ignored, because they do not look like opticians:\n`);
    for (const place of notOpticians) console.log(line(place, '  '));
    console.log('\n  If a real practice is in that list, add it to the block below by hand.');
  }

  if (ladder.length === 0) {
    console.log('\n  Nothing comparable found. Widen the radius with --miles, or check the anchor is right.');
    return;
  }

  console.log(
    `\n  Shortlisted ${ladder.length}. Skipped ${chains.length} chains, ${tooBig.length} as too far ahead, ${tooSmall.length} as too small, ${notOpticians.length} as not opticians.`
  );
  console.log(`\n  Paste this into the "clients" array in config/practices.json:\n`);
  console.log(configBlock(anchor, ladder, options.id ?? slug(anchor.name)));
  console.log(`\n  ${client.callCount} API calls used.\n`);
}

async function commandDemo(options) {
  const outDir = resolve(options.out, 'reports/demo');
  const reports = buildAllReports(demoConfig, demoHistory(), { weeks: 12 });
  if (!options.quiet) console.log(terminalSummary(reports));
  await writeReports(reports, { outDir, agencyName: 'Spring View Marketing', quiet: options.quiet });
}

async function main() {
  loadEnv(ROOT);
  const options = parseArgs(process.argv.slice(2));

  switch (options.command) {
    case 'snapshot': {
      const state = await commandSnapshot(options);
      if (state.failures.length > 0) process.exitCode = 1;
      break;
    }
    case 'report':
      await commandReport(options);
      break;
    case 'weekly': {
      const state = await commandSnapshot(options);
      await commandReport(options, state);
      if (state.failures.length > 0) process.exitCode = 1;
      break;
    }
    case 'discover':
      await commandDiscover(options);
      break;
    case 'nearby':
      await commandNearby(options);
      break;
    case 'demo':
      await commandDemo(options);
      break;
    default:
      console.log(USAGE);
  }
}

main().catch((error) => {
  // An expected failure is a config or key problem the user can fix; a stack
  // trace there is noise. Anything else is a bug and deserves the full trace.
  if (error.expected) {
    console.error(`\n  ${error.message}\n`);
  } else {
    console.error(error);
  }
  process.exitCode = 1;
});
