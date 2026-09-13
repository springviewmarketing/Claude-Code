"""Pull every directorship for the Hakim-linked officer records on Companies House.

Hakim Group's JV model often leaves the optometrist as majority shareholder, so the
group never appears as a PSC. Board control shows up in the OFFICERS register instead,
which the free bulk data product does not contain -- hence scraping the public site.
"""
import re
import html
import json
import time
import requests

BASE = "https://find-and-update.company-information.service.gov.uk"
S = requests.Session()
S.headers["User-Agent"] = "Mozilla/5.0 (opticians-ownership-research)"


def get(url, tries=4):
    for i in range(tries):
        try:
            r = S.get(url, timeout=45)
            if r.status_code == 200:
                return r.text
            if r.status_code == 404:
                return ""
        except Exception:
            pass
        time.sleep(1.5 * (i + 1))
    return ""


def officer_ids(query):
    """Officer records matching `query`, with name / dob / address context."""
    out = []
    for page in range(1, 6):
        t = get("%s/search/officers?q=%s&page=%d" % (BASE, query.replace(" ", "+"), page))
        if not t:
            break
        blocks = re.split(r'<li class="type-officer', t)[1:]
        found = 0
        for b in blocks:
            m = re.search(r'/officers/([A-Za-z0-9_-]+)/appointments', b)
            if not m:
                continue
            txt = html.unescape(re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', b))).strip()
            n = re.search(r'Total number of appointments (\d+)', txt)
            out.append({"id": m.group(1), "ctx": txt[:180],
                        "count": int(n.group(1)) if n else 0})
            found += 1
        if found == 0:
            break
    # de-dup by id
    seen, res = set(), []
    for o in out:
        if o["id"] not in seen:
            seen.add(o["id"])
            res.append(o)
    return res


def appointments(oid):
    """All company appointments for one officer id."""
    comps = {}
    page = 1
    while page <= 40:
        t = get("%s/officers/%s/appointments?page=%d" % (BASE, oid, page))
        if not t:
            break
        found = re.findall(
            r'<a[^>]+href="/company/([0-9A-Z]{6,10})"[^>]*>\s*([^<]+?)\s*</a>', t)
        if not found:
            break
        before = len(comps)
        for num, name in found:
            comps[num.strip().upper()] = html.unescape(name).strip()
        if len(comps) == before:      # page repeated -> past the end
            break
        page += 1
        time.sleep(0.3)
    return comps


if __name__ == "__main__":
    cands = officer_ids("imran hakim")
    print("officer records found: %d" % len(cands))
    # Hakim Group board seats sit under the Darwen HQ address
    hak = [c for c in cands if "BB3 1AE" in c["ctx"].upper()
           or "INDIA MILL" in c["ctx"].upper()]
    print("Darwen/India Mill records: %d" % len(hak))
    for c in sorted(hak, key=lambda x: -x["count"]):
        print("   %-32s %4d appts  %s" % (c["id"], c["count"], c["ctx"][:95]))

    allc = {}
    for c in sorted(hak, key=lambda x: -x["count"]):
        got = appointments(c["id"])
        print("   -> %s gave %d companies" % (c["id"][:14], len(got)), flush=True)
        allc.update(got)
    json.dump(allc, open("out/hakim_directorships.json", "w"), indent=0)
    print("TOTAL distinct companies via directorships: %d" % len(allc))
