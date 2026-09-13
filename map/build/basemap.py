import json, math
d=json.load(open("raw/countries-10m.json"))
tr=d["transform"]; sc=tr["scale"]; tl=tr["translate"]
raw_arcs=d["arcs"]
def decode(i):
    a=raw_arcs[i]; x=y=0; out=[]
    for dx,dy in a:
        x+=dx; y+=dy
        out.append((x*sc[0]+tl[0], y*sc[1]+tl[1]))
    return out
ARC=[decode(i) for i in range(len(raw_arcs))]
def ring(idxs):
    pts=[]
    for i in idxs:
        a=ARC[~i][::-1] if i<0 else ARC[i]
        pts.extend(a if not pts else a[1:])
    return pts
def poly(g):
    if g["type"]=="Polygon": return [[ring(r) for r in g["arcs"]]]
    return [[ring(r) for r in p] for p in g["arcs"]]

def simplify_ring(pts, eps):
    """RDP on a closed ring: split at the point furthest from pts[0] so the
    baseline is never degenerate, simplify each half, then re-close."""
    closed = len(pts)>2 and pts[0]==pts[-1]
    body = pts[:-1] if closed else pts[:]
    if len(body)<4: return pts
    x0,y0=body[0]
    far=max(range(1,len(body)), key=lambda i: (body[i][0]-x0)**2+(body[i][1]-y0)**2)
    a=rdp(body[:far+1],eps); b=rdp(body[far:],eps)
    out=a[:-1]+b
    if closed: out=out+[out[0]]
    return out

def rdp(pts, eps):
    if len(pts)<3: return pts
    dmax=0; idx=0
    x1,y1=pts[0]; x2,y2=pts[-1]
    dx,dy=x2-x1,y2-y1; den=math.hypot(dx,dy) or 1e-12
    for i in range(1,len(pts)-1):
        x0,y0=pts[i]
        dist=abs(dy*x0-dx*y0+x2*y1-y2*x1)/den
        if dist>dmax: dmax=dist; idx=i
    if dmax>eps:
        return rdp(pts[:idx+1],eps)[:-1]+rdp(pts[idx:],eps)
    return [pts[0],pts[-1]]
import sys
sys.setrecursionlimit(100000)

want={"United Kingdom":"UK","Ireland":"IE","Isle of Man":"IM"}
feats=[]
for g in d["objects"]["countries"]["geometries"]:
    n=g.get("properties",{}).get("name","")
    if n not in want: continue
    polys=poly(g)
    keep=[]
    for p in polys:
        outer=p[0]
        # drop tiny islands (area proxy) to cut size, keep anything reasonably sized
        xs=[q[0] for q in outer]; ys=[q[1] for q in outer]
        span=max(max(xs)-min(xs), max(ys)-min(ys))
        if span<0.06 and n!="Isle of Man": continue
        simp=[simplify_ring(r,0.004) for r in p]
        simp=[[[round(x,4),round(y,4)] for x,y in r] for r in simp if len(r)>=4]
        if simp: keep.append(simp)
    feats.append({"code":want[n],"polys":keep})
out={"features":feats}
json.dump(out, open("out/uk_basemap.json","w"), separators=(",",":"))
import os
pts=sum(len(r) for f in feats for p in f["polys"] for r in p)
print(f"basemap: {len(feats)} countries, {sum(len(f['polys']) for f in feats)} polygons, {pts:,} points, {os.path.getsize('out/uk_basemap.json')/1024:.0f} KB")
