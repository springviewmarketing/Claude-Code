import json, csv, re, collections
def norm(n):
    n=(n or "").upper(); n=re.sub(r'\b(LIMITED|LTD|PLC|LLP)\b',' ',n)
    n=n.replace('&',' AND '); n=re.sub(r'[^A-Z0-9 ]',' ',n)
    return re.sub(r'\s+',' ',n).strip()

sites=json.load(open("out/nhs_sites_detail.json"))
# dedupe: same trading name + postcode = ODS record left over from an operator change; keep newest
_lc={o["OrgId"]:o.get("LastChangeDate","") for o in json.load(open("out/nhs_optical_sites.json"))}
_best={}
for _s in sites:
    _k=(re.sub(r'[^A-Z0-9]','',_s["Name"].upper()), (_s.get("PostCode") or "").upper().replace(" ",""))
    if _k not in _best or _lc.get(_s["OrgId"],"") > _lc.get(_best[_k]["OrgId"],""): _best[_k]=_s
_removed=len(sites)-len(_best)
sites=list(_best.values())
print(f"deduped {_removed} duplicate practice records -> {len(sites):,} practices")
hqs={h["OrgId"]:h for h in json.load(open("out/nhs_optical_hq.json"))}
hq2co=json.load(open("out/hq_to_company.json"))          # normalized HQ name -> company
psc=collections.defaultdict(list)
for line in open("out/psc_final.jsonl",encoding="utf-8"):
    r=json.loads(line); d=r.get("data",{})
    if d.get("ceased_on"): continue
    psc[r["company_number"].strip().upper()].append(d)

HAKIM=re.compile(r'HO2 MANAGEMENT|HAKIM GROUP|EYE ACADEMY',re.I)
HAKIM_COS=set(json.load(open("out/hakim_all_companies.json")).keys())
CHAINS=[("SPECSAVERS","Specsavers"),("BOOTS","Boots Opticians"),("VISION EXPRESS","Vision Express"),
 ("ASDA","Asda Opticians"),("TESCO","Tesco Opticians"),("SCRIVENS","Scrivens"),
 ("COSTCO","Costco Opticians"),("OPTICAL EXPRESS","Optical Express"),("LUXOTTICA","Luxottica/Sunglass Hut"),
 ("LEIGHTONS","Leightons"),("OPTIMAX","Optimax"),("ULTRALASE","Ultralase"),("HAKIM GROUP","Hakim Group")]

recs=[]
for s in sites:
    h=hqs.get(s["HQ"]) or {}
    hqname=h.get("Name","")
    co=hq2co.get(norm(hqname))
    cnum=co["num"] if co else ""
    ds=psc.get(cnum,[]) if cnum else []
    corp=[d for d in ds if "corporate" in d.get("kind","") or "legal-person" in d.get("kind","")]
    ind=[d for d in ds if "individual" in d.get("kind","")]

    group=""; owner=""
    corpnames=" | ".join(d.get("name","") for d in corp).upper()
    blob=f"{s['Name']} {hqname} {corpnames}".upper()
    if cnum and cnum in HAKIM_COS:
        group="Hakim Group"; owner="HO2 Management Ltd (Hakim Group)"
    for pat,label in CHAINS:
        if group: break
        if re.search(r'\b'+re.escape(pat),blob): group=label; owner=label; break
    if not group:
        if any(HAKIM.search(d.get("name","")) or (d.get("address",{}).get("postal_code","").upper().strip()=="BB3 1AE") for d in corp):
            group="Hakim Group"; owner="HO2 Management Ltd (Hakim Group)"
        elif corp:
            owner=corp[0].get("name","").title(); group="__CORP__"
        elif ind:
            owner="; ".join(d.get("name","").title() for d in ind[:2]); group="__IND__"
        else:
            owner=""; group="__UNINC__" if not cnum else "__IND__"
    recs.append({"OrgId":s["OrgId"],"PracticeName":s["Name"],
      "Address1":s.get("AddrLn1",""),"Address2":s.get("AddrLn2",""),"Town":s.get("Town",""),
      "County":s.get("County",""),"Postcode":s.get("PostCode",""),"Country":s.get("Country",""),
      "OperatingHQ":hqname,"HQ_OrgId":s["HQ"],"CompanyNumber":cnum,
      "CompanyName":co["nm"] if co else "","CompanyStatus":co["st"] if co else "",
      "_group":group,"_owner":owner})

# ultimate-owner key for grouping
def key(r):
    if r["_group"] not in ("__CORP__","__IND__","__UNINC__"): return ("CHAIN",r["_group"])
    if r["_group"]=="__CORP__": return ("CORP",norm(r["_owner"]))
    if r["_group"]=="__IND__":  return ("IND", norm(r["_owner"]) or r["CompanyNumber"] or r["HQ_OrgId"])
    return ("UNINC", r["HQ_OrgId"])
cnt=collections.Counter(key(r) for r in recs)
for r in recs:
    k=key(r); n=cnt[k]; r["PracticesUnderSameOwner"]=n
    r["StandalonePractice"]="Yes" if n==1 else "No"
    if k[0]=="CHAIN":
        r["OwnershipGroup"]=r["_group"]
        r["OwnershipCategory"]="Hakim Group (consolidator)" if r["_group"]=="Hakim Group" else "Multiple / national chain"
        r["UltimateOwner"]=r["_owner"]
    else:
        r["UltimateOwner"]=r["_owner"] or (r["OperatingHQ"] or "Unknown")
        if k[0]=="UNINC": r["UltimateOwner"]=r["OperatingHQ"] or "Unincorporated"
        if n>=6:   r["OwnershipGroup"]="Other group / consolidator"; r["OwnershipCategory"]="Group-owned (6+ practices)"
        elif n>=2: r["OwnershipGroup"]="Independent mini-group";     r["OwnershipCategory"]=f"Independent - small group ({n} practices)"
        else:      r["OwnershipGroup"]="Independent";                r["OwnershipCategory"]="Independent - standalone"
    if r["CompanyNumber"]: r["LegalForm"]="Limited company"
    elif re.search(r'\b(LTD|LIMITED|PLC|LLP|CYF|CYFYNGEDIG)\b', (r["OperatingHQ"] or "").upper()):
        r["LegalForm"]="Limited company (not matched on Companies House)"
    else: r["LegalForm"]="Unincorporated (sole trader/partnership)"
    del r["_group"], r["_owner"]
json.dump(recs, open("out/practices.json","w"))
print(f"PRACTICES (England & Wales, NHS-listed, active): {len(recs):,}\n")
for k,v in collections.Counter(r["OwnershipCategory"] for r in recs).most_common(): print(f"  {v:>5}  {k}")
print("\n=== by group ===")
for k,v in collections.Counter(r["OwnershipGroup"] for r in recs).most_common(15): print(f"  {v:>5}  {k}")
