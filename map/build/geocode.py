import json, requests, time
practices=json.load(open("out/practices.json"))
pcs=sorted({p["Postcode"].strip().upper() for p in practices if p["Postcode"].strip()})
print("distinct postcodes:",len(pcs))
S=requests.Session(); S.headers["Content-Type"]="application/json"
res={}
for i in range(0,len(pcs),100):
    chunk=pcs[i:i+100]
    for attempt in range(4):
        try:
            r=S.post("https://api.postcodes.io/postcodes",json={"postcodes":chunk},timeout=60)
            if r.status_code==200:
                for item in r.json().get("result",[]):
                    q=item.get("query"); o=item.get("result")
                    if o: res[q.upper()]={"lat":o["latitude"],"lon":o["longitude"],
                        "region":o.get("region") or o.get("country") or "",
                        "district":o.get("admin_district") or "","country":o.get("country") or "",
                        "ward":o.get("admin_ward") or ""}
                break
        except Exception as e:
            time.sleep(2*(attempt+1))
    if (i//100)%10==0: print(f"  {i+len(chunk)}/{len(pcs)} resolved={len(res)}",flush=True)
json.dump(res, open("out/postcode_geo.json","w"))
print(f"DONE resolved {len(res)}/{len(pcs)} ({len(res)/len(pcs)*100:.1f}%)")
