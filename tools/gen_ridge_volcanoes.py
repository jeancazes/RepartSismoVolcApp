import json, math, random, sys
from shapely.geometry import shape, Point
from shapely.ops import unary_union
from shapely.prepared import prep
repo=sys.argv[1]
land=prep(unary_union([shape(f['geometry']).buffer(0) for f in json.load(open(repo+'/data/land.json'))['features']]))
b=json.load(open(repo+'/data/boundaries3.json'))
osr=[f for f in b['features'] if f['properties'].get('kind')=='OSR'][0]['geometry']['coordinates']
def hav(a,b):
    R=6371;la1,la2=math.radians(a[1]),math.radians(b[1]);dl=math.radians(b[0]-a[0]);dp=la2-la1
    return 2*R*math.asin(math.sqrt(math.sin(dp/2)**2+math.cos(la1)*math.cos(la2)*math.sin(dl/2)**2))
segs=[];tot=0
for line in osr:
    for i in range(len(line)-1):
        p,q=line[i],line[i+1]
        if abs(p[0]-q[0])>180: continue
        d=hav(p,q);segs.append((tot,d,p,q));tot+=d
print('total km',round(tot))
rnd=random.Random(20261112)
N=900;mean=tot/N
pos=[];x=rnd.uniform(0,mean)
while x<tot:
    pos.append(x);x+=mean*rnd.uniform(.35,1.65)
out=[];j=0;k=0
for x in pos:
    while j<len(segs)-1 and segs[j][0]+segs[j][1]<x: j+=1
    s0,d,p,q=segs[j];t=(x-s0)/d if d else 0
    lon=p[0]+(q[0]-p[0])*t;lat=p[1]+(q[1]-p[1])*t
    lon+=rnd.uniform(-.12,.12);lat+=rnd.uniform(-.12,.12)
    if land.contains(Point(lon,lat)): continue
    k+=1
    out.append(['D%03d'%k,'Volcan sous-marin de dorsale',round(lat,2),round(lon,2),'Volcan sous-marin (position illustrative)',None,'Fond océanique','ridge','Dorsale océanique / croûte océanique',2])
print(len(pos),len(out))
v=json.load(open(repo+'/data/volcans.json'))
v=[r for r in v if not (isinstance(r[0],str) and r[0].startswith('D') and len(r)>9 and r[9]==2)]
v+=out
open(repo+'/data/volcans.json','w').write(json.dumps(v,ensure_ascii=False,separators=(',',':')))
print('total volcans',len(v))
