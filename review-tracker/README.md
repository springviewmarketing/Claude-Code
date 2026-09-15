# Review tracker

Reads the Google review count for a set of optician practices and their local
rivals once a week, works out who gained what, and writes a report per practice.

No dependencies, no build step, no database. Node 22 or newer.

```
npm run demo        # see the output before you have a key or a config
npm test            # 30 tests, no network
npm run weekly      # the real thing: read the profiles, write the reports
```

`npm run demo` writes a worked example to `reports/demo/`. Open
`reports/demo/demo-hillsborough.html`. Every practice in it is invented.

## What it actually measures, and what it cannot

This is the part to read before showing a number to a client.

Google's API publishes a **live review count**, not a dated list of reviews. So
"new reviews this week" here is the difference between this week's reading and
last week's. Three consequences follow, and the report states all three on its
own face:

- **It is a net figure.** Seven reviews gained and one removed reads as six.
  Google removes reviews it judges to be spam, so a total can fall without
  anyone having done anything wrong. The tool reports a negative honestly rather
  than clamping it to zero.
- **It counts ratings, not just written reviews.** A star left with no text is in
  the number, because that is what Google's count contains.
- **It only knows what it has read.** The first run sets a baseline and reports
  no weekly figure at all. A missed run is reported over its real span, so a
  fortnight is labelled as fourteen days rather than passed off as a week.

If you need the actual date each individual review landed, this is the wrong
tool and there isn't a cheap right one. The API returns at most five review
bodies per place, so per-review dating is not available at any price through the
official route. Scraping Google Maps would get it and would breach their terms.
Third-party services sell it. For the job here, which is week-on-week momentum
against named rivals, the count difference is the right instrument.

## Running it without installing anything

Everything below can be done from the GitHub website. You never need Node, a
terminal, or a copy of this repository on your machine.

1. **Make the key** (Google Cloud console, see the next section). Google
   requires a card on the account even though you will not be charged.
2. **Add the key to GitHub.** Repository, Settings, Secrets and variables,
   Actions, New repository secret. Name it `GOOGLE_MAPS_API_KEY`.
3. **Find the place IDs.** Actions tab, "Find place IDs", "Run workflow", type
   a search such as `opticians in Hillsborough Sheffield`. The results appear in
   the run summary with a `placeId` for each match.
4. **Write the config.** In the repository, open
   `review-tracker/config/practices.example.json`, press the pencil icon, save
   it as `review-tracker/config/practices.json` with the real names and place
   IDs, and commit.
5. **Run it.** Actions tab, "Weekly review tracker", "Run workflow". It reads
   every profile, commits the reading, and attaches the reports to the run as a
   download. After that it runs itself every Monday.

The local route below is faster to iterate on if you do have Node installed, but
it is optional.

## Setting it up

### 1. Get a key

In the [Google Cloud console](https://console.cloud.google.com/), create a
project, enable **Places API (New)**, and create an API key. Restrict the key to
the Places API.

Google has required a billing account with a card on it since 2018, and that
still applies to the free allowance. You will be asked for card details. At the
volume this tool uses you should never be charged, but put a budget alert on the
project anyway, at say £5, so you find out if that ever stops being true.

```bash
cp .env.example .env
# put the key in .env, which is gitignored
```

### 2. Find the place IDs

From the Actions tab, run "Find place IDs" and type the search. Or locally:

```bash
npm run discover -- "opticians in Hillsborough Sheffield"
npm run discover -- "Hillsborough Eyecare Sheffield"
```

It prints each match with its address, review count and a `"placeId"` line ready
to paste. Search the area to build a rival list, then search each practice by
name to confirm you have the right one. Check the address, not just the name:
chains have many branches and they each have their own profile and their own
reviews.

### 3. Write the config

```bash
cp config/practices.example.json config/practices.json
```

```json
{
  "agency": { "name": "Spring View Marketing", "regionCode": "GB", "languageCode": "en-GB" },
  "clients": [
    {
      "id": "hillsborough-eyecare",
      "name": "Hillsborough Eyecare",
      "placeId": "ChIJ...",
      "area": "Hillsborough, Sheffield",
      "searchTerm": "opticians near me",
      "competitors": [
        { "name": "Northside Opticians", "placeId": "ChIJ..." }
      ]
    }
  ]
}
```

`id` becomes the report filename, so keep it lowercase with hyphens. Pick
competitors that actually rank for the terms you report on in the geogrid, not
just the nearest practices. Four or five is the useful number: enough to be a
real table, few enough that the client can hold it in their head.

### 4. Run it

```bash
npm run weekly
```

Reports land in `reports/`:

- `<client-id>.html`, the practice's report. One self-contained file with no
  external requests, so it can be attached to an email, opened offline or
  printed straight from the browser.
- `<client-id>.txt`, the same week written as a short message, ready to paste
  into an email or a WhatsApp to the practice manager.
- `index.html`, every client on one page, for your own view.
- `history.csv`, the current week's rows for every tracked place.

Readings accumulate in `data/snapshots.json`. Commit that file. It is the whole
history and there is no other copy.

## Running it weekly without remembering to

`.github/workflows/review-tracker.yml` runs it every Monday at 07:00 UTC,
commits the reading and the reports back, and attaches the reports to the run as
a download. It needs one repository secret, `GOOGLE_MAPS_API_KEY`, under
Settings, Secrets and variables, Actions.

You can also trigger it by hand from the Actions tab.

If you would rather run it from your own machine, `npm run weekly` on a Monday
does exactly the same thing. The only thing that matters is the roughly seven
day spacing; the tool tolerates a run landing a couple of days either side and
tells you when it did not.

## What it costs

`rating` and `userRatingCount` are Enterprise-tier fields in the Places API, so
every profile read is one Place Details (Enterprise) call. Google gives 1,000 of
those free per month, then charges $20 per 1,000.

Ten practices with five rivals each is 60 profiles, read once a week: about 260
calls a month. That is inside the free allowance with room to spare. You would
need to be tracking roughly 230 profiles before the first bill arrived, and it
would be pennies when it did. Set a budget alert on the Cloud project anyway.

`discover` uses Text Search, a different SKU with its own free allowance, and you
only run it when onboarding.

## Using it with a practice

The report is built to be handed over, not just filed. The order it puts things
in is deliberate: what you gained, how that compares to the practice up the road,
and what it would take to overtake them. That last panel is the one that moves
behaviour. "You are 102 reviews behind Northside, and at your current pace you
pass them in 22 weeks" gets asked for at the front desk in a way that "keep
asking for reviews" never does.

The streak count is worth pointing at. A practice that has gone twelve weeks
without a blank week will work to protect that, which is exactly the habit that
feeds the geogrid.

One caution on framing. The weekly number is small and it is meant to be. A
practice that gains four reviews a week gains 200 a year, and that is the number
that moves local ranking. Sell the run, not the week.

### What not to do

The report's footer carries this, and it is not boilerplate:

- **Never offer anything in return for a review.** No discount, no prize draw, no
  free lens clean. It breaches Google's policies and the UK's Digital Markets,
  Competition and Consumers Act, and the CMA enforces it.
- **Never gate reviews**, meaning route happy patients to Google and unhappy ones
  to a private form first. Explicitly prohibited, not a grey area.
- **Do not chase a perfect five.** Purchase intent peaks around 4.2 to 4.5 stars.
  An unbroken wall of fives reads as bought.

Asking every patient, in person, at the point they say they are pleased, is the
whole method. The tool exists to make that habit visible, not to replace it.

## Layout

```
src/
  cli.js          commands: snapshot, report, weekly, discover, demo
  config.js       config loading and validation, .env reading
  places.js       the Google Places API client
  store.js        the snapshot history
  metrics.js      weekly deltas, ranks, streaks, pace, the chase
  demo-data.js    invented data for the worked example
  render/
    html.js       the report and the index
    text.js       the terminal summary and the message for the practice
    csv.js        the spreadsheet export
config/           practices.json lives here
data/             snapshots.json, the history, commit it
reports/          generated output
test/             30 tests, no network
```

## Commands

| Command | What it does |
| --- | --- |
| `npm run weekly` | Read every profile, store the reading, write the reports |
| `npm run snapshot` | Read and store, without writing reports |
| `npm run report` | Rebuild the reports from stored history, no API calls |
| `npm run discover -- "<query>"` | Find place IDs |
| `npm run demo` | Write the worked example, no key needed |
| `npm test` | Run the tests |

`report` takes `--as-of <date>` to rebuild a past week and `--weeks <n>` to change
how much history the trend chart shows.
