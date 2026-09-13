"""Link an NHS optical HQ name to a Companies House company via CH search + verification.

Exact-name matching missed 57% of practices, including Hakim-owned ALEX GAGE OPTICIANS
(registered as ALEXANDER GAGE OPTICIANS LIMITED). CH search handles the name variance;
everything it returns is then verified before being accepted.
"""
import re
import html
import json
import time
import threading
import requests

BASE = "https://find-and-update.company-information.service.gov.uk"
STOP = {"LIMITED", "LTD", "PLC", "LLP", "THE", "AND", "OPTICIANS", "OPTICIAN",
        "OPTOMETRISTS", "OPTOMETRIST", "OPTICAL", "OPTICS", "EYECARE", "EYE",
        "CARE", "CENTRE", "CENTER", "VISION", "GROUP", "PRACTICE", "CO"}
_tl = threading.local()


def sess():
    if not hasattr(_tl, "s"):
        _tl.s = requests.Session()
        _tl.s.headers["User-Agent"] = "Mozilla/5.0 (opticians-ownership-research)"
        _tl.s.mount("https://", requests.adapters.HTTPAdapter(
            pool_connections=12, pool_maxsize=12))
    return _tl.s


def norm(n):
    n = (n or "").upper().replace("&", " AND ")
    n = re.sub(r'\(.*?\)', ' ', n)
    n = re.sub(r'[^A-Z0-9 ]', ' ', n)
    return re.sub(r'\s+', ' ', n).strip()


def tokens(n):
    return [t for t in norm(n).split() if t not in STOP and len(t) > 1]


def search(q, tries=3):
    """Return [(number, name, address_snippet)] from CH search."""
    url = "%s/search/companies?q=%s" % (BASE, requests.utils.quote(q))
    for i in range(tries):
        try:
            r = sess().get(url, timeout=40)
            if r.status_code == 200:
                out = []
                for blk in re.split(r'<li class="type-company', r.text)[1:]:
                    m = re.search(r'href="/company/([0-9A-Z]{6,10})"', blk)
                    if not m:
                        continue
                    nm = re.search(r'href="/company/[0-9A-Z]+"[^>]*>\s*([^<]+?)\s*<', blk)
                    txt = html.unescape(re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', blk))).strip()
                    out.append((m.group(1).upper(),
                                html.unescape(nm.group(1)).strip() if nm else "",
                                txt[:260]))
                return out
        except Exception:
            pass
        time.sleep(1.2 * (i + 1))
    return []


def score(hq_name, practice_name, pc, cand_name, snippet):
    """How confident are we that this CH company is the practice's operator?"""
    ht, ct = set(tokens(hq_name)), set(tokens(cand_name))
    if not ht or not ct:
        return 0.0
    inter = ht & ct
    s = len(inter) / max(1, len(ht))
    # a shared distinctive token (surname/placename) is the real signal
    if not inter:
        # allow forename abbreviation: ALEX -> ALEXANDER
        for a in ht:
            for b in ct:
                if len(a) >= 3 and len(b) >= 3 and (b.startswith(a) or a.startswith(b)):
                    s = max(s, 0.55)
    pn = set(tokens(practice_name))
    if pn & ct:
        s += 0.15
    up = snippet.upper()
    pc_c = pc.upper().replace(" ", "")
    if pc_c and pc_c in up.replace(" ", ""):
        s += 0.45                      # registered at the practice address
    elif pc_c[:3] and re.search(r'\b' + re.escape(pc_c[:3]), up.replace(" ", "")):
        s += 0.12                      # same postcode district
    if "DISSOLVED" in up:
        s -= 0.5
    return s
