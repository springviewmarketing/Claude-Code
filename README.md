# Spring View · Opticians landing page

A single-page, long-form landing page for the independent-optician offer.
Static HTML, no build step, no dependencies.

- `index.html`, the page
- `OFFER.md`, the commercial reasoning: the outcome reframe, StoryBrand audit, pricing, value stack, bonuses, guarantees
- `fonts/`, Bricolage Grotesque and Instrument Sans, self-hosted (OFL)
- `img/`, five practice photographs, cropped and encoded to WebP at two widths each

## Deploying

Drop `index.html` and `fonts/` onto the server together, keeping the relative
path. Suggested URL is `/opticians`; if it goes somewhere else, update the
`canonical` tag and the `WebPage` URL in the JSON-LD.

Nothing else is required. No JavaScript framework, one inline script for the
sticky bar, no third-party requests at all.

## Before it goes live

Six things, in order of how much they matter.

1. **Swap the email CTAs for a booking link when you have one.** With no booking
   system yet, all four primary CTAs open a prefilled email asking for practice
   name, town and good times to call, and the transitional CTA opens a different
   one asking for the practice and website. That is effectively a form with no
   backend and it works today. When a calendar exists, replace the `mailto:` in
   the four "Book a 15 minute call" links and keep the visibility-check one as
   email.
2. **Add the headshot** in the byline block near the foot of the FAQ. It is the
   one image slot still empty.
3. **Decide on the capacity line.** There is a commented-out block in the closing
   band. If you want it, fill in your real monthly number. It ships empty rather
   than invented, because fabricated scarcity is the one thing on this page that
   would be worth nothing if it were ever checked.
4. **Confirm the AI answer in the FAQ.** "Who actually writes the content?"
   answers honestly rather than claiming no AI is involved anywhere. See the note
   below.
5. **Proof.** There is a marked, empty block above the comparison table. Nothing
   goes in it until a client will go on record.
6. **Decide whether the free visibility check is sustainable at volume.** Each one
   is roughly half an hour. It is email-gated so you choose who gets one, but if
   the page starts converting it will need a cap.

## Decisions taken, and why

**Fonts are self-hosted rather than pulled from Google Fonts.** The page then
opens on one connection with no third-party round trip. Load time is the single
most mechanical conversion lever there is: measured conversion runs 4.4% under a
one-second LCP and 3.6% between two and three seconds. Both families are OFL, so
self-hosting is permitted. `fonts/OFL.txt` carries the licence. Only the Latin
subset is included; re-download from Google Fonts to update.

**Bricolage has no true italic.** The figures use a synthesised oblique, which is
what the guidelines describe and what the reference build does.

**The H1 speaks to a person, not to an answer engine.** The earlier draft opened
with "Who does the marketing for an independent optician? I do." That is written
to be quoted by ChatGPT, and it costs conversion with the human reading it. The
AEO work is done instead by the answer block above the fold, the question-format
H2s, the FAQ, and the FAQPage schema, all of which get the same job done without
spending the headline on it. The brand guidelines settle this independently: a
hero headline is capped at roughly 14 characters per line and must carry one
highlight box, and a long question headline cannot do either.

**One highlight box on the whole page**, on "fill" in the hero, because filling
the book is the entire proposition. Ligatures are disabled inside the box: the
`fi` pair closes up at width axis 80 and the word stops reading at a glance.

**Three figures on the page**, no more: `£149` (what an empty chair costs), `0`
(notice period), `£750` (price). One per band, and on those three bands the
headline steps down to lead scale so the figure is the only thing shouting.

**Four primary CTAs, identical wording, plus one transitional CTA.** Hero, after
the bonus stack, the closing vermilion band, and a sticky bottom bar, all reading
"Book a 15 minute call". The transitional CTA, "Show me what my town sees", sits
once, at the foot of the plan, for visitors who are interested but not ready to
talk. It has its own wording because it is a different offer, not a second attempt
at the same one. The sticky bar is the highest-lift
placement in the 2026 test set at +11%, well ahead of an above-fold CTA at +6%.
It is ink chrome with a vermilion button so the page flow still spends its
vermilion only at the close.

**Exclusivity is not in the hero.** The guidelines call it a closing lever raised
when a prospect hesitates, so it sits at the pricing block and in the FAQ, framed
as the reason the price is what it is.

**Every price comparison is a published UK 2026 market rate**, sourced in
`OFFER.md` and summarised in the page footer. Objective claims have to be
substantiated before publication under the CAP Code, and a value stack collapses
anyway if the component prices are not credible.

**The lifetime-spend figure was corrected twice.** The first draft used £17,471
and called every lost patient "a five figure loss". That total is real, from
Optegra/Censuswide via the Association of Optometrists, but £13,592 of it is daily
contact lenses and much of that goes to online retailers rather than to the
practice. The page now uses **£149**, which is the £3,878 spectacles-only figure
divided by the 26 pairs the same survey reports. It is the most conservative
number in the whole dataset, it is unambiguously in an optician's addressable
market, and it is the number the ROI argument runs on.

**The offer sells an outcome, not a list of inputs.** Filling the gaps in the
appointment book, not eight social posts. The inputs are still stated in plain
units, but they sit at the foot of the monthly section as a specification rather
than leading it. See `OFFER.md` section 0 for the reasoning.

**Photography is real and it is Tom's own.** Five images from working practices,
cropped to fixed aspect ratios, encoded to WebP at two widths with `srcset`, and
lazy-loaded below the fold. Alt text describes what is in the frame rather than
what it represents. The hero image is `fetchpriority="high"` because it is the LCP
element. Total page weight is about 265KB.

## Two things needing your ruling

**1. The hero uses vermilion twice.** The highlight box on "found" and the CTA
button are both vermilion, on the same ink surface. Section 2 says vermilion does
exactly one job per surface, with only the wordmark full stop exempt. Section 8
says a button on an ink field is vermilion with ink text and there is no third
variant. Those two rules collide the moment an ink hero carries a highlight box,
which is a gap in the guidelines rather than a choice I could design around.

The options are: exempt the primary CTA the way the wordmark full stop is
exempt, which is what the page currently assumes and what I would recommend; or
drop the hero button and let the sticky bar carry the above-fold CTA, which the
test data says costs only about a percentage point of relative lift. Your call,
and whichever you pick should go into the guidelines.

**2. Secondary text on vermilion moved from `.72` to `.80` alpha.** At `.72` it
measures 4.04:1, which fails WCAG AA for the 10.5px, 12.5px and 13px sizes it is
applied to. `.80` reaches 4.59:1 and is visually indistinguishable. Worth
correcting in the guidelines rather than carrying as a local override.

Every other colour pair in the system passes AA as specified.

## Checks this page passes

- No em dashes anywhere, including in comments and rendered entities
- British English throughout
- "Patients", never "customers" or "clients"
- One highlight box, page-wide
- Vermilion appears on five of ten bands and does one job on each, hero excepted
- No competitor is named
- No unsubstantiated health claim and no promised patient number
- No stock or AI imagery, and none proposed
- Review compliance stated explicitly: no gating, no incentivising
- No horizontal scroll at 390px; wide tables scroll inside their own container
- All contrast pairs pass WCAG AA

## `review-scorecard.html`, the review scorecard tool

A standalone, single-file interactive scorecard for independent opticians.
Twenty-six weighted actions totalling 100 points, plus eight pass/fail
compliance guardrails that cap the score at 45 while any of them is breached.
Ticking an action reveals the evidence behind it.

- Weights are set by yield against effort, so the in-person ask at collection
  (26 points) and the same-day SMS (22 points) carry the engine, and the 55+
  section (16 points) is weighted above replying because it is where an
  optician's best patients are lost.
- Compliance sits outside the 100 deliberately. Gating or incentivising is not
  a lost point, it is a DMCCA exposure with CMA penalties up to 10% of global
  turnover, so it caps the score instead of nibbling at it.
- Answers save to `localStorage`, not to a server. One link can be sent to
  every practice and each one keeps its own private scorecard on its own
  device.
- Fonts come from Google Fonts here rather than `fonts/`, so the file works
  standalone wherever it is dropped. The landing page keeps its self-hosted
  copies.
- Every figure in the tool traces to the source pack. Velocity thresholds,
  the SMS against email multipliers and the QR splits are labelled in the
  footer as practitioner-sourced and directional.

Nothing in it goes to a client without a human read first.
