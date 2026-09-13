import json, re, requests, threading, concurrent.futures as cf
from urllib.parse import urlparse, urljoin
sites=json.load(open("out/nhs_sites_detail.json"))
CHAIN_SITE={"SPECSAVERS":"https://www.specsavers.co.uk","BOOTS":"https://www.boots.com/opticians",
 "VISION EXPRESS":"https://www.visionexpress.com","ASDA":"https://opticians.asda.com",
 "TESCO":"https://www.tescoopticians.com","SCRIVENS":"https://www.scrivens.com",
 "COSTCO":"https://www.costco.co.uk/opticians","OPTICAL EXPRESS":"https://www.opticalexpress.co.uk",
 "LEIGHTONS":"https://www.leightons.co.uk","VISIONPLUS":"https://www.visionplus.co.uk"}
tl=threading.local()
def S():
    if not hasattr(tl,"s"):
        tl.s=requests.Session(); tl.s.headers["User-Agent"]="Mozilla/5.0 (compatible; research)"
        tl.s.mount("https://",requests.adapters.HTTPAdapter(pool_connections=30,pool_maxsize=30))
    return tl.s
def cands(name):
    n=name.upper()
    n=re.sub(r'\(.*?\)',' ',n)                 # drop bracketed location
    n=re.split(r'\s-\s|\bT/?A\b',n)[0]          # drop after " - " / trading-as
    n=re.sub(r'\b(LTD|LIMITED|PLC|LLP)\b',' ',n)
    amp=n.replace('&',' AND '); noamp=n.replace('&',' ')
    out=[]
    for v in (amp,noamp):
        v=re.sub(r'[^A-Z0-9 ]',' ',v); w=[x for x in v.split() if x]
        if not w: continue
        forms=[''.join(w)]
        if len(w)>1 and w[-1] in ("OPTICIANS","OPTICIAN","OPTOMETRISTS","OPTOMETRIST","OPTICAL","EYECARE","OPTICS"):
            forms.append(''.join(w[:-1]))
        if len(w)>2: forms.append(''.join(w[:2]))
        for b in forms:
            b=b.lower()
            if 4<=len(b)<=42: out += [(b,b+".co.uk"),(b,b+".com")]
    return list(dict.fromkeys(out))[:8]
EMAIL=re.compile(r'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}')
BAD=re.compile(r'(\.png|\.jpg|\.gif|\.webp|example\.|sentry|wixpress|godaddy|@2x|\.svg)',re.I)
def emails_from(text):
    out=[]
    for e in EMAIL.findall(text or ""):
        if BAD.search(e): continue
        if len(e)>60: continue
        out.append(e.lower())
    return list(dict.fromkeys(out))
def probe(base,dom):
    try:
        r=S().get("https://"+dom,timeout=9,allow_redirects=True)
        if r.status_code>=400: return None
        host=urlparse(r.url).netloc.lower().replace("www.","")
        if base[:max(6,len(base)//2)] not in host: return None
        if not re.search(r'optic|eyecare|spectacle|optometr|eye test|eye exam|glasses|contact lens',r.text,re.I): return None
        return r
    except Exception: return None
def work(s):
    nm=s["Name"].upper()
    for k,v in CHAIN_SITE.items():
        if k in nm: return {"OrgId":s["OrgId"],"Website":v,"Email":"","Src":"chain"}
    for b,d in cands(s["Name"]):
        r=probe(b,d)
        if not r: continue
        em=emails_from(r.text)
        if not em:
            for path in ("/contact","/contact-us","/contact-us/","/about/contact"):
                try:
                    r2=S().get(urljoin(r.url,path),timeout=8)
                    if r2.status_code<400:
                        em=emails_from(r2.text)
                        if em: break
                except Exception: pass
        return {"OrgId":s["OrgId"],"Website":r.url,"Email":em[0] if em else "","Src":"discovered"}
    return {"OrgId":s["OrgId"],"Website":"","Email":"","Src":""}
res=[]; lock=threading.Lock(); n=0
with cf.ThreadPoolExecutor(24) as ex:
    for out in ex.map(work,sites):
        res.append(out)
        with lock:
            n+=1
            if n%250==0: print(f"  {n}/{len(sites)} web={sum(1 for r in res if r['Website'])}",flush=True)
json.dump(res,open("out/enrichment.json","w"))
print("DONE websites:",sum(1 for r in res if r["Website"]),"emails:",sum(1 for r in res if r["Email"]))
