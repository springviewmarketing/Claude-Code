import json, csv, re, collections

def norm(n):
    n=(n or "").upper().strip(); n=re.sub(r'[.,\']','',n)
    n=re.sub(r'\b(LIMITED|LTD)\b','LTD',n); return re.sub(r'\s+',' ',n).strip()

rows=list(csv.DictReader(open("out/universe.csv",encoding="utf-8")))
psc=collections.defaultdict(list)
for line in open("out/psc_universe.jsonl",encoding="utf-8"):
    r=json.loads(line); d=r.get("data",{})
    if d.get("ceased_on"): continue
    psc[r["company_number"].strip().upper()].append(d)

HAKIM_PC={"BB3 1AE"}
def is_hakim_psc(d):
    nm=norm(d.get("name"))
    if nm.startswith("HO2 MANAGEMENT") or nm.startswith("HAKIM GROUP"): return True
    if nm.startswith("THE EYE ACADEMY"): return True
    pc=(d.get("address",{}).get("postal_code") or "").upper().replace("  "," ").strip()
    if pc in HAKIM_PC: return True
    return False

# corporate PSC -> optician companies controlled
ctrl=collections.defaultdict(set)
for cn,ds in psc.items():
    for d in ds:
        if "corporate" in d.get("kind","") or "legal-person" in d.get("kind",""):
            ctrl[norm(d.get("name"))].add(cn)

CHAINS=[("SPECSAVERS","Specsavers"),("BOOTS OPTICIANS","Boots Opticians"),
 ("VISION EXPRESS (UK)","Vision Express"),("OPTICAL EXPRESS","Optical Express"),
 ("SCRIVENS","Scrivens"),("LEIGHTONS","Leightons"),("CUBITTS","Cubitts"),
 ("BAYFIELDS","Bayfields"),("DUNCAN AND TODD","Duncan & Todd"),
 ("BLACK AND LIZARS","Black & Lizars"),("ASDA","Asda Opticians"),
 ("TESCO","Tesco Opticians"),("OPTEGRA","Optegra"),("OUTSIDE CLINIC","The Outside Clinic")]

out=[]
for r in rows:
    cn=r["CompanyNumber"].strip().upper(); nm=norm(r["CompanyName"])
    ds=psc.get(cn,[])
    corp=[d for d in ds if "corporate" in d.get("kind","") or "legal-person" in d.get("kind","")]
    ind=[d for d in ds if "individual" in d.get("kind","")]
    regpc=(r["RegAddress.PostCode"] or "").upper().strip()

    group=None; tier=None; owner=""
    if any(is_hakim_psc(d) for d in corp) or regpc in HAKIM_PC or nm.startswith("HAKIM GROUP"):
        group,tier,owner="Hakim Group","Consolidator-owned (trades as independent)","HO2 Management Ltd / Hakim Group"
    if group is None:
        for pat,label in CHAINS:
            if nm.startswith(pat) or any(norm(d.get("name")).startswith(pat) for d in corp):
                group,tier,owner=label,"Multiple / national chain",label; break
    if group is None:
        big=[(norm(d.get("name")),len(ctrl[norm(d.get("name"))])) for d in corp]
        big=[b for b in big if b[1]>=2]
        if big:
            big.sort(key=lambda x:-x[1]); owner=big[0][0].title(); n=big[0][1]
            if n>=6: group,tier="Other group / consolidator","Group-owned (6+ practices)"
            else:    group,tier="Independent mini-group",f"Independent — small group ({n} cos)"
        else:
            group,tier="Independent","Independent — standalone"
            owner="; ".join((d.get("name") or "").title() for d in ind[:3])
    out.append({**r,"OwnershipGroup":group,"OwnershipTier":tier,"UltimateOwner":owner,
                "NumCorporatePSC":len(corp),"NumIndividualPSC":len(ind)})

with open("out/classified_full.csv","w",newline='',encoding="utf-8") as f:
    w=csv.DictWriter(f,fieldnames=list(out[0].keys())); w.writeheader(); w.writerows(out)

print(f"TOTAL SIC 47782 companies: {len(out):,}\n")
for k,v in collections.Counter(o["OwnershipTier"] for o in out).most_common():
    print(f"  {v:>5}  {k}")
print("\n=== by group ===")
for k,v in collections.Counter(o["OwnershipGroup"] for o in out).most_common(12):
    print(f"  {v:>5}  {k}")
act=[o for o in out if o["CompanyStatus"].startswith("Active")]
print(f"\nActive only: {len(act):,}")
print(f"  Hakim Group (active): {sum(1 for o in act if o['OwnershipGroup']=='Hakim Group')}")
