# Review tracker

Reads the Google review count for a set of optician practices and their local
rivals once a week, works out who gained what, and writes a report per practice.

No dependencies, no build step, no database. Node 22 or newer.

```
npm run demo        # see the output before you have a key or a config
npm test            # 87 tests, no network
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
3. **Find the competitors.** Actions tab, "Find nearby competitors", "Run
   workflow", give it the practice name and a radius in miles. The run summary
   lists everything nearby with its distance and ends with a config block ready
   to paste. ("Find place IDs" is the older, name-only search, still there for
   looking up one specific practice.)
4. **Write the config.** In the repository, open
   `review-tracker/config/practices.example.json`, press the pencil icon, save
   it as `review-tracker/config/practices.json` with the real names and place
   IDs, and commit.
5. **Run it.** Actions tab, "Weekly review tracker", "Run workflow". It reads
   every profile, commits the reading, and attaches the reports to the run as a
   download. After that it runs itself every Monday.

The local route below is faster to iterate on if you do have Node installed, but
it is optional.

## Adding a practice, after the first time

One button. Actions tab, **"Add a client"**, type the practice name and town,
press Run. It finds the practice, picks its local competitors, saves them to the
config, commits, and takes the first reading. Nothing to copy by hand.

```bash
npm run add-client -- "Murgatroyd Holmes Opticians Staveley" --miles 5
```

It prints a short summary rather than the whole search: what it added, the table
the practice now sits in, who is next to catch, and a count of what was left
out. Add `--verbose` to see every business it looked at.

**The one thing worth checking** is the practice it centred on. It matches by
name, and a chain or a practice with branches can match the wrong one. The
summary leads with the address and a Google Maps link for exactly that reason.
Everything downstream is wrong if the anchor is wrong. Re-run with the place ID
if it picked the wrong branch.

Running it again for the same practice updates that practice rather than adding
a second copy, whether it is matched by id or by place ID.

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

Two ways, and the second is usually the one you want.

**By radius, when you want the competitor list.** Text search only matches the
words you type, so "opticians Conisbrough" finds practices named after
Conisbrough rather than practices near it. This searches a circle around the
client instead, and writes the config block for you:

```bash
npm run nearby -- "Murgatroyd Opticians Conisbrough" --miles 5
```

It prints everything it found with its distance, marks the ones it would
shortlist, and ends with a block ready to paste. From the Actions tab the same
thing is "Find nearby competitors".

Because Google has no "optician" place type, in either of its filterable tables,
the search stays keyword-driven and tries several wordings (opticians,
optometrist, eye care), merging the results. The radius is real: Text Search
restricts only to a rectangle, so the tool asks for the box around the circle
and then drops anything outside the circle by actual distance.

Text Search is loose about what it considers a match. Live runs have returned
two supermarkets, a car park, an NHS commissioning body, a GP health centre, a
recruitment agency for the optical trade, a hospital A&E eye clinic and a
hospital eye department, all alongside the actual opticians. Ranking a practice
against a health centre is worse than not reporting at all, so results are
filtered on the name and on Google's own type label before anything reaches the
shortlist. The ones rejected are printed rather than hidden, because the test is
a judgement call and a practice with an unusual name could be missed.

**By name, when you want one specific practice.** From the Actions tab, run
"Find place IDs". Or locally:

```bash
npm run discover -- "Murgatroyd Opticians Conisbrough"
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

`id` becomes the report filename, so keep it lowercase with hyphens.

One file holds every client. A second practice is another entry in the same
`clients` array, not a second file.

**Who to put in the competitor list matters more than anything else in the
config.** Four or five is the useful number: enough to be a real table, few
enough that the client can hold it in their head. Pick practices in the same
league, not simply the nearest doors.

A national chain with a decade of reviews is the wrong target. If the client has
11 reviews and the chain has 1,195, the client is last every week forever, the
gap never closes, and the chain's weekly intake swamps the share-of-new-reviews
figure so it never moves either. That is a scoreboard, not a game, and it does
the opposite of what this tool is for.

`npm run nearby` applies three rules, in order. Anything that is not an
opticians practice goes first, whatever its size. Chains and supermarket
concessions go next, by name: Specsavers, Boots, Vision Express, Asda, Tesco,
Scrivens and the rest. Only then does size come into it, excluding anything more
than about twelve times the client's total, or with almost no reviews.

Chains are excluded by name rather than by size because size cannot do it. The
ceiling scales with the client, so a practice on 100 reviews gets a ceiling of
1,200 and every chain in the area clears it. A chain is uncatchable at any size,
so it is kept out on what it is. `--include-chains yes` puts them back, for a
practice large enough to genuinely compete with one.

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

## The weekly email

Each Monday the workflow publishes every report to the site folder and emails
the practice a short note: the number, one line of context, and a link.

Three things have to be in place.

**A contact address per client.** Add `contactEmail` to a client in
`practices.json`. A client without one still gets a report, just no email.

**The site URL.** Add `siteUrl` to the `agency` block, for example
`https://springviewmarketing.github.io/Claude-Code`. Without it the emails go
out with no link rather than a broken one.

**Four repository secrets**, under Settings, Secrets and variables, Actions:

| Secret | What it is |
| --- | --- |
| `GMAIL_USER` | The Google Workspace address that authenticates, e.g. `tom@springviewmarketing.co.uk` |
| `GMAIL_APP_PASSWORD` | A Google app password, not the account password |
| `MAIL_FROM` | The address the client sees and replies to |
| `MAIL_FROM_NAME` | The name beside it, e.g. `Tom at Spring View Marketing` |

**Nothing is emailed automatically.** The Monday run writes the drafts to
`docs/outbox.json` and stops. They go out by hand, after a person has read them
and added the things only a person knows. Ticking **Send emails** on a manual
run is the only way anything leaves here, and each client is sent by its own job
so one bad address does not stop the others.

That switch exists for later, when the client list is long enough that writing
each one by hand stops being worth it. Until then the draft is the deliverable.

### Why the links are ugly

Each report is published at `r/<client-id>-<token>.html`, where the token is
random. A Pages site is public even when its repository is private, so that
token is the only thing keeping a report away from the competitors it names.
`robots.txt` and a noindex keep search engines out, which stops the report being
found, not someone who has the link.

The token is generated once per client and kept through later runs, so a link
already sitting in a client's inbox keeps working.

### What the email says

It picks one line of context, in this order: a quiet spell of three weeks or
more, then beating the area this week, then a run of three good weeks, then a
rival within ten reviews, then the position in the table. Only one appears, so
the email stays to four lines.

Nothing in it suggests offering anything for a review or choosing who to ask.
Both breach Google policy and the DMCCA, and the tests check the copy for it.

## The Monday briefing

A scheduled Claude routine fires at 10:00 UTC every Monday, a good two and a
half hours after the tracker runs. The gap is deliberately generous: GitHub can
delay a scheduled workflow under load, and a briefing that reads yesterday's
numbers is worse than one that arrives late. It reads the week's reading and reports back:
what each practice gained, where they sit locally, who they are chasing, and a
draft email per client to rewrite and send. It also checks the tracker actually
ran, and says so loudly if it did not.

It never emails a client and never commits anything. It reads and reports.

## Running it weekly without remembering to

`.github/workflows/review-tracker.yml` runs it every Monday at 07:23 UTC,
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
  geo.js          distances, and the box that contains a circle
  nearby.js       the radius search, the optician test, the shortlist
  client-file.js  merging a practice into practices.json without losing the rest
  render/
    email.js      the weekly email to the practice
    html.js       the report and the index
    text.js       the terminal summary and the message for the practice
    csv.js        the spreadsheet export
config/           practices.json lives here
data/             snapshots.json, the history, commit it
reports/          generated output
test/             87 tests, no network
```

## Commands

| Command | What it does |
| --- | --- |
| `npm run weekly` | Read every profile, store the reading, write the reports |
| `npm run snapshot` | Read and store, without writing reports |
| `npm run report` | Rebuild the reports from stored history, no API calls |
| `npm run discover -- "<query>"` | Find a place ID by name |
| `npm run add-client -- "<practice>" --miles 5` | Find a practice and its rivals, and save it to the config |
| `npm run nearby -- "<practice>" --miles 5` | The same search, printed rather than saved |
| `npm run nearby -- "<practice>" --include-chains yes` | The same, but with the chains left in |
| `npm run demo` | Write the worked example, no key needed |
| `npm test` | Run the tests |

`report` takes `--as-of <date>` to rebuild a past week and `--weeks <n>` to change
how much history the trend chart shows.
