---
name: optician-review-check
description: >-
  Pull the current Google review figures for one of Spring View Marketing's optician clients and turn them into a line Tom can put straight into an email, a call or a WhatsApp. Use this whenever Tom asks how a practice is doing on reviews, asks for the latest review numbers, stats or data for a named optician, wants to check in with a client mid-week about their reviews, asks who a practice is chasing or whether they have overtaken anyone, asks whether a practice has gone quiet, or wants a figure to drop into a message to a practice. Trigger on the practice names as well, not only on the word reviews, so use it for Kemp and Kerrigan, Murgatroyd Holmes, Murgatroyd Opticians, or any practice in the tracker. Also use it when he asks to refresh, re-read or re-run the review data.
---

# Optician review check

Tom runs Spring View Marketing and manages Google review growth for independent
opticians. A tracker reads every client's Google profile, and their local
rivals', once a week and commits the numbers to a public GitHub repository.

This skill turns those numbers into something he can send. He writes the emails
himself, so what he wants back is the figure, the one comparison worth making,
and wording he can cut about. Not a finished email, and not a data dump.

## Where the data is

Everything is in `springviewmarketing/Claude-Code`, on the default branch
`claude/spring-view-landing-page-3sf82c` (there is no `main`). The repository is
public, so these fetch without any credentials:

```
https://raw.githubusercontent.com/springviewmarketing/Claude-Code/claude/spring-view-landing-page-3sf82c/review-tracker/data/snapshots.json
https://raw.githubusercontent.com/springviewmarketing/Claude-Code/claude/spring-view-landing-page-3sf82c/review-tracker/config/practices.json
```

`practices.json` says who is tracked and who counts as their competitors.
`snapshots.json` is every reading ever taken, oldest first:

```
{ "snapshots": [ { "takenAt": "2026-09-21T07:23:00Z",
                   "places": { "<placeId>": { "name", "totalReviews", "rating", "status" } } } ] }
```

A place with `"status"` other than `"ok"` could not be read that week. Treat it
as missing, never as zero, or a practice gets told its reviews vanished.

In a Claude Code session on this repository, read the files from disk instead
and pull first so they are current. `node review-tracker/src/cli.js report
--quiet` rebuilds every report from stored history and makes no API calls, which
is the quickest way to get ranks and gaps without doing the arithmetic by hand.

## Say how old the number is, every time

This is the part that matters most. The tracker runs Monday morning, so by
Wednesday the stored figure is two days old and a review may have landed since.
Tom is about to put this number in front of a client, and a stale figure
presented as today's is the one mistake that costs him credibility.

So always lead with the date of the reading: "as of Monday 21 September". If the
newest reading is more than eight days old the weekly run has probably failed,
which is worth saying plainly rather than quietly reporting old numbers.

If he needs it live, see **Refreshing** below.

## What to work out

Find the client in `practices.json`, then from the snapshots:

- **Total now**, and the star rating
- **Change since the previous reading**, with the number of days between them.
  Do not call it "this week" unless the gap really is about seven days
- **Position** among their own competitor list, ranked on total reviews
- **The gap to the practice immediately above them**, which is the single most
  useful number in the whole thing: it is the next thing they can actually win
- **Anyone level with them on the same total.** A rival on the identical number
  is the most motivating fact available, because one review settles it, and a
  plain ranking hides it by putting one of them arbitrarily above the other
- **Any run of weeks** with at least one review, or how long they have gone
  without one

Only count the places listed as that client's competitors. Every client has
their own list, and rivals overlap between them.

## What to give him back

Keep it to something he can read in twenty seconds and act on:

1. **The figures**, four or five lines, with the reading date on the first one.
2. **The one thing worth saying.** Pick whichever is truest: they have gained
   some, they are within touching distance of overtaking someone, they have gone
   quiet for weeks, or they are holding a lead. One, not all of them.
3. **Two or three sentences he can lift** into his own message. He will add the
   things only he knows, that they have just come back from holiday or that last
   week was half term, so give him the substance and let him add the warmth.

### Example

**Input:** "how are Murgatroyd doing on reviews? thinking of dropping them a line"

**Output:**
```
Murgatroyd Opticians, as of Monday 21 September (2 days ago)

  11 reviews, 4.9 stars
  7th of 11 in their local table
  T English Opticians are level with them on 11
  Priority Eyecare are next up the table, 5 ahead on 16
  First reading, so no weekly change yet

Worth saying: they are dead level with T English Opticians. One review
settles it, and that is a far better thing to put in front of them than a
league position of 7th.

Something you could use:

  You are sitting level with T English on 11 reviews, so there is genuinely
  one review in it. If everyone who leaves happy this week gets asked on the
  way out, that will do it.
```

Notice what the example does with the ranking. Seventh of eleven is
demoralising and not very actionable. Level with a named rival, with one review
in it, is the same data pointed at something they can do on Thursday. Lead with
whichever framing gives them something to act on, and never hide a bad number,
just do not make it the headline when a better true one exists.

## Refreshing for a live figure

The stored numbers can be refreshed on demand by running the tracker's weekly
workflow. In a session with GitHub access, dispatch `review-tracker.yml` on the
default branch with `send_emails: false`, wait about a minute, then re-read.
That takes a fresh reading of every tracked profile, roughly thirty Google
lookups, which is nothing against the monthly free allowance.

Two things to know before doing it. It never emails a client: sending only
happens when `send_emails` is ticked, and it should stay off. And an extra
reading mid-week does not corrupt the weekly figures, because the report
anchors each week to the reading nearest that day and ignores the rest.

Offer this when the stored number is several days old and he is writing to a
client today. Do not do it automatically, since usually the Monday figure is
fine and he would rather have the answer now.

## Writing for a practice

Anything he might forward follows the house rules: British English, no em
dashes, and "patients" rather than customers or clients.

Two things must never appear in copy about reviews, because both break Google's
policies and the UK's Digital Markets, Competition and Consumers Act, and the
CMA enforces them:

- Never suggest offering anything in return for a review. No discount, no prize
  draw, no free lens clean.
- Never suggest asking only the patients who seem pleased, or routing unhappy
  ones somewhere private first. Review gating is explicitly prohibited.

The honest method is asking every patient, in person, at the point they say they
are happy with their visit. That is also what actually works, so there is no
tension here. And do not push a practice towards a perfect five: purchase intent
peaks around 4.2 to 4.5 stars, and an unbroken wall of fives reads as bought.

## What these numbers are not

Google publishes a live review count, not a dated list, so every weekly figure
is the difference between two readings. Three consequences worth knowing before
quoting one:

- It is **net**. Seven gained and one removed by Google's spam filter reads as
  six, and a total can fall without anyone doing anything wrong.
- It counts **ratings**, including stars left with no written text.
- The **first reading** for a practice has nothing to compare against, so it
  shows a total and no change. That is correct, not a fault.

If Tom needs the date an individual review landed, this cannot tell him. Google
returns at most five review bodies per place, so per-review dating is not
available through the official API at any price.
