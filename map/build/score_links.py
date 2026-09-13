"""Score CH search candidates against each practice and accept only confident links.

Precision matters more than recall here: a wrong company link produces a wrong
ownership verdict, which is worse than leaving a practice unlinked. So a match needs
a shared DISTINCTIVE token (not a generic optical word, not the town name), and the
company has to look like an optical business unless it is registered at the practice
address itself.
"""
import json
import csv
import re
import collections
import chsearch as C

csv.field_size_limit(10**9)
recs = json.load(open("out/practices.json"))
raw = json.load(open("out/hq_search_raw.json"))

# generic words that say nothing about WHICH business this is
GENERIC = {
    "LIMITED", "LTD", "PLC", "LLP", "THE", "AND", "CO", "COMPANY", "GROUP", "HOLDINGS",
    "OPTICIANS", "OPTICIAN", "OPTOMETRISTS", "OPTOMETRIST", "OPTOMETRY", "OPTICAL",
    "OPTICALS", "OPTICS", "OPTOM", "OPTOMS", "EYECARE", "EYE", "EYES", "CARE",
    "SPEC", "SPECS", "SPECTACLE", "SPECTACLES", "EYEWEAR", "VISION", "VISIONCARE",
    "SIGHT", "SIGHTCARE", "CLINIC", "CLINICS", "CENTRE", "CENTER", "CENTRES",
    "PRACTICE", "SERVICES", "SERVICE", "HOME", "AT", "VISIT", "UK", "GB", "NEW",
    "FAMILY", "TOTAL", "FIRST", "PREMIER", "QUALITY", "LOCAL", "INDEPENDENT",
    "PROFESSIONAL", "CONSULTING", "CONSULTANTS", "ASSOCIATES", "PARTNERS", "SON",
    "SONS", "BROTHERS", "STUDIO", "BOUTIQUE", "HEALTH", "HEALTHCARE", "MEDICAL",
}

# place names: a shared town name is geography, not identity
PLACES = {p[0].upper() for p in json.load(open("out/places_labels.json"))}
for r in recs:
    if r.get("Town"):
        PLACES.add(r["Town"].upper())
    if r.get("County"):
        PLACES.add(r["County"].upper())


def distinctive(name):
    return {t for t in C.tokens(name) if t not in GENERIC and t not in PLACES and len(t) > 2}


nums = {n for hits in raw.values() for (n, _nm, _sn) in hits}
info = {}
with open("raw/BasicCompanyDataAsOneFile-2026-09-01.csv", newline='',
          encoding='utf-8', errors='replace') as f:
    rd = csv.DictReader(f)
    rd.fieldnames = [c.strip() for c in rd.fieldnames]
    for row in rd:
        n = row["CompanyNumber"].strip().upper()
        if n in nums:
            sics = " ".join((row.get("SICCode.SicText_%d" % i) or "") for i in range(1, 5))
            info[n] = {"nm": row["CompanyName"].strip(),
                       "pc": (row.get("RegAddress.PostCode") or "").strip().upper().replace(" ", ""),
                       "sic": re.findall(r'\b\d{5}\b', sics),
                       "st": (row.get("CompanyStatus") or "").strip()}
print("candidates: %d, enriched: %d" % (len(nums), len(info)))

OPT = {"47782"}
HEALTH = {"86900", "86220", "86230"}

# Rarity weighting: a shared rare surname (GAGE) is strong evidence; a shared common
# forename (ALEXANDER) is weak. Without this, "Alexander Opticians" outranks the
# correct "Alexander Gage Opticians" for a practice trading as "Alex Gage".
import math
_freq = collections.Counter()
for _d in info.values():
    for _t in distinctive(_d["nm"]):
        _freq[_t] += 1
for _r in recs:
    for _t in distinctive(_r["OperatingHQ"]) | distinctive(_r["PracticeName"]):
        _freq[_t] += 1
_N = max(2, len(info) + len(recs))


def idf(t):
    return math.log(_N / (1.0 + _freq.get(t, 0)))


def score(hq, pname, pc, num):
    d = info.get(num)
    if not d:
        return 0.0, ""
    hq_d, cand_d = distinctive(hq), distinctive(d["nm"])
    pn_d = distinctive(pname)
    ours = hq_d | pn_d
    ident = ours & cand_d
    partial = set()
    # forename abbreviation, e.g. ALEX -> ALEXANDER, counted at half weight
    for a in ours - ident:
        for b in cand_d:
            if len(a) >= 4 and len(b) >= 4 and (b.startswith(a) or a.startswith(b)):
                partial.add(a)
                break
    pcc = pc.upper().replace(" ", "")
    same_pc = bool(pcc) and d["pc"] == pcc
    is_opt = any(x in OPT for x in d["sic"])
    is_health = any(x in HEALTH for x in d["sic"])

    # HARD GATES -----------------------------------------------------------
    if not ident and not partial and not same_pc:
        return 0.0, "no-distinctive-token"
    if d["sic"] and not is_opt and not is_health and not same_pc:
        return 0.0, "wrong-sector"
    if not d["st"].startswith("Active"):
        return 0.0, "not-active"

    # SCORE ----------------------------------------------------------------
    matched = sum(idf(t) for t in ident) + 0.5 * sum(idf(t) for t in partial)
    total = sum(idf(t) for t in ours) or 1.0
    s = matched / total
    why = []
    if ident:
        why.append("id:" + "/".join(sorted(ident))[:30])
    if partial:
        why.append("abbrev:" + "/".join(sorted(partial))[:18])
    # penalise candidates carrying a lot of unexplained distinctive name
    extra = cand_d - ident
    if extra:
        s *= 1.0 / (1.0 + 0.55 * sum(idf(t) for t in extra) / (total or 1.0))
    if same_pc:
        s += 0.55
        why.append("same-postcode")
    elif pcc and d["pc"][:3] == pcc[:3]:
        s += 0.10
        why.append("same-district")
    if is_opt:
        s += 0.35
        why.append("SIC-optician")
    elif is_health:
        s += 0.20
        why.append("SIC-health")
    return s, ",".join(why)


THRESH = 0.85
out = {}
dist = collections.Counter()
rej = collections.Counter()
for r in recs:
    if r["CompanyNumber"]:
        continue
    hq = r["OperatingHQ"]
    best = (0.0, None, "")
    for (num, _nm, _sn) in raw.get(hq, []):
        s, why = score(hq, r["PracticeName"], r["Postcode"], num)
        if s > best[0]:
            best = (s, num, why)
        if s == 0.0 and why:
            rej[why] += 1
    dist[round(min(best[0], 2.0) * 4) / 4] += 1
    if best[1] and best[0] >= THRESH:
        out[r["OrgId"]] = {"num": best[1], "nm": info[best[1]]["nm"],
                           "score": round(best[0], 2), "why": best[2]}

json.dump(out, open("out/relinked.json", "w"), indent=0)
unl = sum(1 for r in recs if not r["CompanyNumber"])
print("\nreject reasons:", dict(rej.most_common()))
print("score distribution:")
for k in sorted(dist):
    print("   %4.2f  %s %d" % (k, "#" * min(55, dist[k] // 14), dist[k]))
print("\nlinked at >= %.2f : %d of %d unlinked (%.0f%%)"
      % (THRESH, len(out), unl, 100 * len(out) / unl))
