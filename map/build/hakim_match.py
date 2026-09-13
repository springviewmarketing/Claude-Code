"""Match the KNOWN Hakim company list directly onto practices.

General-purpose linkage has to be conservative because any company in the register
could be the match. Here the candidate set is only ~590 companies that are certainly
Hakim-controlled, so a name match carries far more weight and we can catch practices
that generic linkage leaves unlinked.

Hakim set = PSC-derived (HO2 Management et al.) UNION directorship-derived
(Imran Hakim's 528 board seats). The directorship half is what a PSC-only method
misses entirely, because Hakim's JV model often leaves the optometrist as majority
shareholder while Hakim takes a board seat.
"""
import json
import csv
import re
import math
import collections
import chsearch as C
from score_links import GENERIC, PLACES, distinctive  # reuse the same notion of identity

csv.field_size_limit(10**9)

psc = set(json.load(open("out/hakim_all_companies.json")))
dirs = json.load(open("out/hakim_directorships.json"))
hakim_nums = psc | set(dirs)
print("Hakim companies: PSC %d + directorships %d -> union %d"
      % (len(psc), len(dirs), len(hakim_nums)))

# names / SIC / postcode for every Hakim company
hak = {}
with open("raw/BasicCompanyDataAsOneFile-2026-09-01.csv", newline='',
          encoding='utf-8', errors='replace') as f:
    rd = csv.DictReader(f)
    rd.fieldnames = [c.strip() for c in rd.fieldnames]
    for row in rd:
        n = row["CompanyNumber"].strip().upper()
        if n in hakim_nums:
            sics = " ".join((row.get("SICCode.SicText_%d" % i) or "") for i in range(1, 5))
            hak[n] = {"nm": row["CompanyName"].strip(),
                      "pc": (row.get("RegAddress.PostCode") or "").strip().upper().replace(" ", ""),
                      "sic": re.findall(r'\b\d{5}\b', sics),
                      "st": (row.get("CompanyStatus") or "").strip(),
                      "src": ("PSC+director" if (n in psc and n in dirs)
                              else ("PSC" if n in psc else "director"))}
print("matched in register: %d" % len(hak))
optical = {n: d for n, d in hak.items()
           if any(s in ("47782", "86900", "86220") for s in d["sic"])}
print("of which optical/health SIC: %d" % len(optical))

recs = json.load(open("out/practices.json"))

# rarity weights over the practice-name vocabulary
freq = collections.Counter()
for r in recs:
    for t in distinctive(r["OperatingHQ"]) | distinctive(r["PracticeName"]):
        freq[t] += 1
for d in hak.values():
    for t in distinctive(d["nm"]):
        freq[t] += 1
N = max(2, len(recs) + len(hak))


def idf(t):
    return math.log(N / (1.0 + freq.get(t, 0)))


# a token is "rare" if it is in the top decile of idf across the vocabulary
_idfs = sorted(idf(t) for t in freq)
RARE_CUT = _idfs[int(len(_idfs) * 0.80)] if _idfs else 99.0
print("rare-token idf cutoff: %.2f" % RARE_CUT)

# index Hakim companies by each distinctive token
by_tok = collections.defaultdict(list)
for n, d in optical.items():
    for t in distinctive(d["nm"]):
        by_tok[t].append(n)

out = {}
for r in recs:
    ours = distinctive(r["OperatingHQ"]) | distinctive(r["PracticeName"])
    if not ours:
        continue
    cands = {n for t in ours for n in by_tok.get(t, [])}
    best = (0.0, None, "")
    for n in cands:
        d = hak[n]
        cand_d = distinctive(d["nm"])
        ident = ours & cand_d
        if not ident:
            continue
        matched = sum(idf(t) for t in ident)
        total = sum(idf(t) for t in ours) or 1.0
        s = matched / total
        extra = cand_d - ident
        if extra:
            s *= 1.0 / (1.0 + 0.4 * sum(idf(t) for t in extra) / total)
        same_pc = r["Postcode"].upper().replace(" ", "") == d["pc"]
        if same_pc:
            s += 0.5
        # A single shared common surname (LODGE, KINGS, BIRD) is not evidence of
        # ownership. Demand two shared tokens, a shared rare one, or the company
        # being registered at the practice address itself.
        rare = max((idf(t) for t in ident), default=0.0)
        strong = (len(ident) >= 2) or same_pc or (rare >= RARE_CUT and not (cand_d - ident))
        if not strong:
            continue
        if s > best[0]:
            best = (s, n, "id:" + "/".join(sorted(ident))[:34])
    if best[1] and best[0] >= 0.95:
        out[r["OrgId"]] = {"num": best[1], "nm": hak[best[1]]["nm"],
                           "score": round(best[0], 2), "why": best[2],
                           "src": hak[best[1]]["src"]}

json.dump(out, open("out/hakim_practice_match.json", "w"), indent=0)
already = sum(1 for r in recs if r["OwnershipGroup"] == "Hakim Group")
new = [o for o in out if next(r for r in recs if r["OrgId"] == o)["OwnershipGroup"] != "Hakim Group"]
print("\npractices matched to a Hakim company: %d" % len(out))
print("   already flagged Hakim : %d" % (len(out) - len(new)))
print("   NEWLY identified      : %d" % len(new))
print("   (previous Hakim total : %d)" % already)
json.dump(hak, open("out/hakim_company_detail.json", "w"), indent=0)
