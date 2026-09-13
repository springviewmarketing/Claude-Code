# Optician Landscape — interactive prospecting map

`opticians-map.html` is a self-contained page: 6,857 NHS-registered optical practices
across England & Wales, plotted and colour-coded by who actually owns them.
All data and the UK basemap are inlined, so it works offline with no server.

Published artifact: https://claude.ai/code/artifact/18838dbf-81b4-45d0-8ed0-4348b3dce28c

## Colour coding

| Colour | Meaning | Practices |
|---|---|---:|
| Orange | Independent, standalone | 2,211 |
| Amber | Independent group (2-5 practices) | 1,287 |
| Violet | Hakim Group (trades as independent) | 283 |
| Blue | Other group / consolidator (6+) | 516 |
| Grey | National chain | 2,560 |

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
