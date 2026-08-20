# Spring View · Opticians landing page

A single-page, long-form landing page for the independent-optician offer.
Static HTML, no build step, no dependencies.

- `index.html`, the page
- `OFFER.md`, the commercial reasoning: pricing, value stack, bonuses, guarantees
- `fonts/`, Bricolage Grotesque and Instrument Sans, self-hosted (OFL)

## Deploying

Drop `index.html` and `fonts/` onto the server together, keeping the relative
path. Suggested URL is `/opticians`; if it goes somewhere else, update the
`canonical` tag and the `WebPage` URL in the JSON-LD.

Nothing else is required. No JavaScript framework, one inline script for the
sticky bar, no third-party requests at all.

## Before it goes live

Six things, in order of how much they matter.

1. **Point the CTA at the real booking link.** Every button currently goes to
   `https://calendly.com/springviewmarketing/15min`. There are four of them.
2. **Replace the photo slots.** There are marked placeholders. The page argues
   for authentic photography while carrying none, which is the one place it
   currently contradicts itself. Alt text must describe what is actually in the
   frame, not the concept.
3. **Add the headshot** in the byline block near the foot of the FAQ.
4. **Decide on the capacity line.** There is a commented-out block in the closing
   band. If you want it, fill in your real monthly number. It ships empty rather
   than invented, because fabricated scarcity is the one thing on this page that
   would be worth nothing if it were ever checked.
5. **Confirm the AI answer in the FAQ.** "Who actually writes the content?"
   answers honestly rather than claiming no AI is involved anywhere. See the note
   below.
6. **Proof.** There is a marked, empty block above the comparison table. Nothing
   goes in it until a client will go on record.

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

**One highlight box on the whole page**, on "found" in the hero, because being
found is the entire proposition.

**Three figures on the page**, no more: `£3,878` (what doing nothing costs), `0`
(notice period), `£750` (price). One per band, and on those three bands the
headline steps down to lead scale so the figure is the only thing shouting.

**Four CTAs, identical wording.** Hero, after the bonus stack, the closing
vermilion band, and a sticky bottom bar. The sticky bar is the highest-lift
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

**The lifetime-spend figure was corrected.** The earlier draft used £17,471 and
called every lost patient "a five figure loss". The £17,471 is real, from
Optegra/Censuswide via the Association of Optometrists, but £13,592 of it is
daily contact lenses and much of that goes to online retailers rather than to the
practice. The page uses £3,878, the spectacles-only figure, which is conservative,
unambiguously in an optician's addressable market, and easier to defend.

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
