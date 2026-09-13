import json, collections, re, os
practices=json.load(open("out/practices.json"))
geo=json.load(open("out/postcode_geo.json"))
enr={e["OrgId"]:e for e in json.load(open("out/enrichment.json"))}
PLACEHOLDER=re.compile(r'@(domain|example|yourdomain|yoursite|mysite|email|company|test|sample|acme|website)\.',re.I)
JUNK=re.compile(r'(sentry|wixpress|godaddy|squarespace|\.png|\.jpg|\.svg|noreply@|no-reply@)',re.I)
CATS=["Independent - standalone","Independent group (2-5)","Hakim Group","Other group / consolidator","National chain"]
def catcode(c):
    if c.startswith("Independent - standalone"): return 0
    if c.startswith("Independent - small group"): return 1
    if c.startswith("Hakim"): return 2
    if c.startswith("Group-owned"): return 3
    return 4
class Dict:
    def __init__(self): self.m={}; self.a=[]
    def i(self,v):
        v=v or ""
        if v not in self.m: self.m[v]=len(self.a); self.a.append(v)
        return self.m[v]
Dgrp, Down, Dreg, Ddis, Dleg, Dtown, Dhq = (Dict() for _ in range(7))
rows=[]; missing=0
for p in practices:
    g=geo.get(p["Postcode"].strip().upper())
    if not g or g.get("lat") is None: missing+=1; continue
    e=enr.get(p["OrgId"],{})
    em=(e.get("Email","") or "")
    if em and (PLACEHOLDER.search(em) or JUNK.search(em) or em.count("@")!=1): em=""
    web=(e.get("Website","") or "").replace("https://","").replace("http://","").rstrip("/")
    addr=", ".join(x for x in [p.get("Address1",""),p.get("Address2","")] if x)
    rows.append([p["PracticeName"],addr,Dtown.i(p.get("Town","").title()),p["Postcode"],
        round(g["lat"],5),round(g["lon"],5),catcode(p["OwnershipCategory"]),
        Dgrp.i(p["OwnershipGroup"]),Down.i(p["UltimateOwner"]),int(p["PracticesUnderSameOwner"]),
        web,em,Dreg.i(g.get("region","")),Ddis.i(g.get("district","")),
        p.get("CompanyNumber",""),Dleg.i(p.get("LegalForm","")),Dhq.i(p.get("OperatingHQ",""))])
def centroids(fn):
    acc=collections.defaultdict(lambda:[0,0,0])
    for r in rows:
        k=fn(r)
        if not k: continue
        a=acc[k]; a[0]+=r[4]; a[1]+=r[5]; a[2]+=1
    return {k:[round(v[0]/v[2],4),round(v[1]/v[2],4)] for k,v in acc.items()}
places={}
for src in (centroids(lambda r: r[3].split()[0].upper() if r[3].strip() else ""),
            centroids(lambda r: Dtown.a[r[2]]),
            centroids(lambda r: Ddis.a[r[13]])):
    for k,v in src.items():
        if k and k not in places: places[k]=v
bundle={"cats":CATS,"rows":rows,"places":places,
 "d":{"grp":Dgrp.a,"own":Down.a,"reg":Dreg.a,"dis":Ddis.a,"leg":Dleg.a,"town":Dtown.a,"hq":Dhq.a},
 "generated":"2026-09-13"}
json.dump(bundle, open("out/mapdata.json","w"), separators=(",",":"))
print(f"mapped {len(rows):,} practices ({missing} without coords)")
print(f"mapdata.json: {os.path.getsize('out/mapdata.json')/1024:.0f} KB  places:{len(places)}")
print("dicts:", {k:len(v) for k,v in bundle["d"].items()})
print("cats:", collections.Counter(CATS[r[6]] for r in rows))
print("website:",sum(1 for r in rows if r[10]),"email:",sum(1 for r in rows if r[11]))
