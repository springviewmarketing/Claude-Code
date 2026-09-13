# Optician Landscape — interactive prospecting map

`opticians-map.html` is a self-contained page: 6,857 NHS-registered optical practices
across England & Wales, plotted and colour-coded by who actually owns them.
All data and the UK basemap are inlined, so it works offline with no server.

Published artifact: https://claude.ai/code/artifact/18838dbf-81b4-45d0-8ed0-4348b3dce28c

## Colour coding

| Colour | Meaning | Practices |
|---|---|---:|
| Orange | Independent, standalone | 2,118 |
| Amber | Independent group (2-5 practices) | 1,271 |
| Violet | Hakim Group (trades as independent) | 367 |
| Blue | Other group / consolidator (6+) | 538 |
| Grey | National chain | 2,563 |

Warm colours are prospects; cool and grey recede.

## Filters

- Free-text search across practice, town, postcode, owner, operating company
- Ownership category, with live counts
- Outlets under the same owner (dual range)
- Digital presence: no website found / has website / any; email-reachable only
- Distance from a point — type a postcode district, town or district, or shift-click
  the map to drop a point, then set a radius in miles
- Region and legal form

## Opportunity score

Each practice carries a transparent 0-100 score, shown with its inputs in the detail panel:

- Ownership: independent standalone +42, independent group +36, other group +12,
  Hakim +6, national chain +0
- No website found +30, website found +4
- Email address available +12
- Group of 2-5 outlets +10, single site +4

The logic: genuinely independent practices with no findable web presence are the
clearest fit for online-presence marketing, and a 2-5 practice group has budget
while still making its own decisions.

**"No website found" is an unverified signal.** It means automated discovery could not
confidently match a site, not that none exists. Treated as a prompt to check, not a fact.

## Build pipeline

Scripts in `build/`, run in order against the data sources documented in
`../output/README.md`:

1. `classify.py` / `build.py` — practice-level ownership from Companies House + PSC + NHS ODS
2. `company_level.py` — UK-wide company-level ownership
3. `enrich.py` — conservative website and email discovery
4. `geocode.py` — postcodes to coordinates via postcodes.io
5. `basemap.py` — UK outline from world-atlas, ring-aware Douglas-Peucker simplification (92 KB)
6. `mapdata.py` — dictionary-encoded map payload (1.2 MB)
7. `template.html` + payload -> `opticians-map.html`

## Coverage

England & Wales. NHS Scotland and Northern Ireland publish no equivalent practice list,
so only a handful of their practices appear. Scotland and NI companies are covered in the
spreadsheet's company-level sheet instead.

## Cross-browser testing

`build/xbrowser.py` drives Chromium, Firefox and WebKit (the Safari engine) through the
page and asserts it actually works: canvas sized, pixels painted, results rendered,
radius filter, detail panel, dark mode, zoom, reset, no JS errors, no horizontal scroll.
It checks three contexts each: desktop 1440x900, phone 390x844, and embedded in an iframe
that is laid out *after* load (`build/host.html`), which is how the artifact host renders it.

Run with `python3 build/serve.py` then `python3 build/xbrowser.py`.

### Bugs this caught

1. **Blocking web font stopped the page dead.** The Google Fonts stylesheet sat in the
   head, and a pending stylesheet blocks execution of every script after it. When that
   request was slow, blocked or unreachable, the main script never ran and the page stayed
   blank forever, with `document.readyState` stuck at `loading`. Now loaded via
   `media="print"` + `onload`, so fonts can never block the app.
2. **Grid row sized to content.** `.app` had no explicit row track, so the row grew to its
   tallest child (the 250-card results list, ~24,000px) and pushed the map out of view when
   embedded. Fixed with `grid-template-rows:minmax(0,1fr)` and `min-height:0` on children.
3. **`100dvh` with no fallback** collapsed the layout on older Safari and Firefox.
4. **Canvas never resized** if its container was laid out after the script ran. Now tracked
   with a `ResizeObserver`, with a polling fallback, and the initial fit is deferred until
   the canvas has a real size.
5. **`MediaQueryList.addEventListener` threw on older Safari**, and sat before init, so one
   TypeError blanked the whole page. Feature-detected with an `addListener` fallback.
6. **Mojibake** (`Fareham Â· PO14 2LE`) whenever the page was served without a UTF-8
   charset. The page is now pure ASCII, so it renders correctly under any encoding.
7. **Silent failure.** Any startup error now shows a visible message naming the cause
   instead of an empty page.


## Ownership accuracy rebuild

A user reported that Alex Gage Opticians in Sheffield were shown as independent when they
are Hakim Group. Root-causing that surfaced two separate defects.

**1. Linkage, not detection.** `ALEXANDER GAGE OPTICIANS LIMITED (03213042)` was already in
the Hakim set. The NHS record trades as "ALEX GAGE OPTICIANS", Companies House registers
"ALEXANDER GAGE OPTICIANS LIMITED", and linkage was exact-name-only, so no company number
was attached and the practice silently defaulted to independent. This was systemic: **57% of
practices had no company linked at all**, and 1,931 of those were called independent purely
by default. The earlier claim that these were "overwhelmingly sole traders" was wrong.

Fixed by searching Companies House for every unmatched HQ name (`relink.py`) and scoring
each candidate (`score_links.py`) before accepting it. Scoring uses inverse-document-frequency
so a shared rare surname (GAGE) outweighs a common one (ALEXANDER) - without that, "Alexander
Opticians" outranked the correct "Alexander Gage Opticians". Hard gates reject candidates in
the wrong sector, dissolved companies, and matches resting only on a generic optical word or
a town name. That last gate matters: earlier drafts matched *Foleshill Eye Centre* to
*Foleshill MOT Centre*, *Kilburn Eye Centre* to *Kilburn Islamic Centre*, and *Hunmanby
Opticians* to *Hunmanby Fish Bar*.

Linkage coverage went from 43% to 60% of practices, at a threshold chosen for precision over
recall - a wrong company link produces a wrong ownership verdict, which is worse than no link.

**2. PSC-only detection missed board control.** Hakim ownership was tested only against
Persons with Significant Control (25%+ shareholding). Hakim's joint-venture model often
leaves the optometrist as majority shareholder while Hakim takes a board seat, so the group
never appears as a PSC. `officers.py` pulls all 528 of Imran Hakim's directorships from the
Companies House officer register; **75 companies are Hakim-controlled by directorship with no
Hakim PSC at all**. `hakim_match.py` then matches that known company set onto practices,
requiring two shared distinctive tokens, a rare shared token, or a registered-address match.

Hakim practices: **284 to 367** (+29%). Independent standalone: 2,211 to 2,118.

**Residual uncertainty is now shown, not hidden.** Every practice carries an
`OwnershipEvidence` value - verified on Companies House, matched by search, or not verified.
About 1,500 practices (22%) have ownership resting on NHS data and brand name alone. The map
marks them `unverified` and has an "Only verified ownership" filter.

## Map reference layers

Practices were previously plotted on a bare coastline with no way to tell where anything was.
Added a **Places / Plain / Density** mode switch:

- **Places** - town and city labels from the GeoNames GB gazetteer (1,400 settlements,
  tiered by population), drawn with collision avoidance so labels never overlap, and revealed
  progressively as you zoom
- **Plain** - coastline only, for an uncluttered view of the dots
- **Density** - filtered practices binned into an intensity field so clusters read at a glance

The selected practice also gets a callout on the map showing its name, town and postcode.
