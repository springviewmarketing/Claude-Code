# UK Opticians: Market Structure & Group Ownership

`UK_Opticians_Ownership_Analysis.xlsx` — every UK optician classified by who actually owns it,
with a focus on Hakim Group and other non-independent group ownership.

## Headline (England & Wales, NHS-registered practices)

| Category | Practices | Share |
|---|---:|---:|
| Total practices | 6,875 | 100% |
| Genuinely independent | 3,508 | 51.0% |
| — standalone single practice | 2,215 | 32.2% |
| — owner-operated group of 2-5 | 1,293 | 18.8% |
| Hakim Group (trades as independent) | 284 | 4.1% |
| Other groups / consolidators (6+) | 516 | 7.5% |
| National multiples | 2,567 | 37.3% |

UK-wide at company level: 7,205 optician companies, of which 5,332 independently owned,
314 Hakim-owned. Includes 359 Scottish and 156 Northern Irish companies.

## Sheets

1. **Headline Figures** — all summary numbers
2. **All Practices (E&W)** — 6,875 rows
3. **Independent Practices** — 3,508 rows (prospect list)
4. **Hakim Group Practices** — 284 rows
5. **Owner League Table** — every owner with 2+ practices
6. **UK Companies (Companies House)** — 7,205 rows, covers Scotland & N. Ireland
7. **Geographic Summary** — ownership mix by postcode area
8. **Method & Caveats**

## Method

Three free public sources chained together:

1. **Companies House bulk company data** (snapshot 01 Sep 2026, 5,689,367 companies) —
   SIC 47782 "Retail sale by opticians", plus optical businesses registered under health
   SICs 86900/86220.
2. **Companies House PSC snapshot** (12 Sep 2026, 15.9m records) — who controls each company.
3. **NHS Organisation Data Service API** — role RO167 "Optical Site" gives real trading
   premises; each links via relationship RE6 to an RO166 "Optical Headquarters", which was
   matched to Companies House and then to PSC control.

**Hakim Group** practices retain their original local trading names, so name matching fails.
They are identified through PSC control by **HO2 Management Ltd** and related vehicles at
Unit 317, India Mill Business Centre, Darwen BB3 1AE. Validated against Hakim's own published
practices (BBR Optometry, Carolyn Parker, Skye Optometrists all correctly flagged; the
unrelated BBR Opticians in Oswestry correctly left independent).

## Caveats

- Practice-level data is **England & Wales only**. NHS Scotland publishes no equivalent
  optometry list (all 104 datasets on opendata.nhs.scot checked). Scotland and N. Ireland
  are covered in the company-level sheet.
- About half of NHS optical HQs have no Companies House entry. These are sole traders and
  partnerships — independent by definition, and classified as such.
- Website/email coverage is partial by design: 41% of independents have a verified website,
  27% an email. Matches were accepted only where the domain resolved without cross-domain
  redirect and page content confirmed an opticians. **A blank means "not confidently found",
  not "does not exist".**
- Ownership reflects the PSC snapshot date; acquisitions after 12 Sep 2026 will not appear.
- A brand split across several companies may appear as multiple smaller groups, so the
  Owner League Table slightly understates a few regional chains.
