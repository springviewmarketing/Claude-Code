"""Search Companies House for every unmatched NHS optical HQ name."""
import json
import threading
import concurrent.futures as cf
import chsearch as C

recs = json.load(open("out/practices.json"))
unl = [r for r in recs if not r["CompanyNumber"]]
names = sorted({r["OperatingHQ"] for r in unl if r["OperatingHQ"].strip()})
print("distinct unmatched HQ names: %d" % len(names), flush=True)

lock = threading.Lock()
done = [0]
res = {}


def work(n):
    hits = C.search(n)
    with lock:
        done[0] += 1
        if done[0] % 100 == 0:
            print("   %d/%d" % (done[0], len(names)), flush=True)
    return n, hits[:6]


with cf.ThreadPoolExecutor(6) as ex:
    for n, hits in ex.map(work, names):
        res[n] = hits

json.dump(res, open("out/hq_search_raw.json", "w"))
got = sum(1 for v in res.values() if v)
print("HQ names with at least one CH candidate: %d (%.0f%%)" % (got, 100 * got / len(names)))
