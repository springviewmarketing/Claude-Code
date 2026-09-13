import json, csv, re, collections
def norm(n):
    n=(n or "").upper(); n=re.sub(r'\b(LIMITED|LTD|PLC|LLP)\b',' ',n)
    n=n.replace('&',' AND '); n=re.sub(r'[^A-Z0-9 ]',' ',n)
    return re.sub(r'\s+',' ',n).strip()
rows=list(csv.DictReader(open("out/universe.csv",encoding="utf-8")))
HAKIM_COS=set(json.load(open("out/hakim_all_companies.json")).keys())
psc=collections.defaultdict(list)
for line in open("out/psc_final.jsonl",encoding="utf-8"):
    r=json.loads(line); d=r.get("data",{})
    if d.get("ceased_on"): continue
    psc[r["company_number"].strip().upper()].append(d)
CHAINS=[("SPECSAVERS","Specsavers"),("BOOTS OPTICIANS","Boots Opticians"),("VISION EXPRESS","Vision Express"),
 ("ASDA","Asda Opticians"),("TESCO","Tesco Opticians"),("SCRIVENS","Scrivens"),("COSTCO","Costco Opticians"),
 ("OPTICAL EXPRESS","Optical Express"),("LUXOTTICA","Luxottica"),("LEIGHTONS","Leightons"),
 ("BAYFIELDS","Bayfields"),("CUBITTS","Cubitts"),("DUNCAN AND TODD","Duncan & Todd"),("OPTIMAX","Optimax")]
ctrl=collections.defaultdict(set)
for cn,ds in psc.items():
    for d in ds:
        if "corporate" in d.get("kind","") or "legal-person" in d.get("kind",""):
            ctrl[norm(d.get("name"))].add(cn)
out=[]
for r in rows:
    cn=r["CompanyNumber"].strip().upper(); ds=psc.get(cn,[])
    corp=[d for d in ds if "corporate" in d.get("kind","") or "legal-person" in d.get("kind","")]
    ind=[d for d in ds if "individual" in d.get("kind","")]
    blob=(r["CompanyName"]+" "+" | ".join(d.get("name","") for d in corp)).upper()
    group=cat=owner=""
    if cn in HAKIM_COS:
        group,cat,owner="Hakim Group","Hakim Group (consolidator)","HO2 Management Ltd (Hakim Group)"
    if not group:
        for pat,label in CHAINS:
            if re.search(r'\b'+re.escape(pat),blob): group,cat,owner=label,"Multiple / national chain",label; break
    if not group:
        sizes=sorted(((norm(d.get("name")),len(ctrl[norm(d.get("name"))])) for d in corp), key=lambda x:-x[1])
        if sizes and sizes[0][1]>=2:
            owner=sizes[0][0].title(); n=sizes[0][1]
            group,cat=(("Other group / consolidator",f"Group-owned ({n} companies)") if n>=6
                       else ("Independent mini-group",f"Independent - small group ({n} companies)"))
        else:
            group,cat="Independent","Independent - standalone"
            owner="; ".join(d.get("name","").title() for d in ind[:2]) or (corp[0].get("name","").title() if corp else "")
    out.append({"CompanyName":r["CompanyName"],"CompanyNumber":cn,
      "Postcode":r["RegAddress.PostCode"],"Town":r["RegAddress.PostTown"],"County":r["RegAddress.County"],
      "Address1":r["RegAddress.AddressLine1"],"Address2":r["RegAddress.AddressLine2"],
      "CompanyStatus":r["CompanyStatus"],"Incorporated":r["IncorporationDate"],
      "SIC1":r["SICCode.SicText_1"],"ConfidenceTier":r["ConfidenceTier"],
      "OwnershipGroup":group,"OwnershipCategory":cat,"UltimateOwner":owner,
      "CompaniesHouseURL":f"https://find-and-update.company-information.service.gov.uk/company/{cn}"})
json.dump(out, open("out/companies_classified.json","w"))
print(f"UK COMPANIES: {len(out):,}")
for k,v in collections.Counter(o["OwnershipCategory"] for o in out).most_common(): print(f"  {v:>5}  {k}")
print("\n--- nation split (by company number prefix) ---")
def nat(n): return "Scotland" if n.startswith("SC") else "N. Ireland" if n.startswith("NI") else "Eng/Wales"
print(collections.Counter(nat(o["CompanyNumber"]) for o in out))
print("\nHakim companies in universe:",sum(1 for o in out if o["OwnershipGroup"]=="Hakim Group"))
