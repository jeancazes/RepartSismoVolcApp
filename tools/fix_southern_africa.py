"""Retire la limite Nubie/Somalie (PB2002) au sud du rift du Malawi : tracé hypothétique
qui traverse le Mozambique et l'Afrique du Sud puis rejoint la dorsale sud-ouest indienne."""
import json, sys
repo = sys.argv[1] if len(sys.argv) > 1 else '.'
B = repo + '/data/boundaries3.json'; P = repo + '/data/plates.json'
b = json.load(open(B))
def inbox(l, lo0, lo1, la0, la1): return all(lo0 <= p[0] <= lo1 and la0 <= p[1] <= la1 for p in l)
rules = {
  'CRB': lambda l: inbox(l, 24, 38, -30, -16.84),          # sud de la vallée de la Shire
  'CTF': lambda l: inbox(l, 24, 38, -35, -16.84),
  'CCB': lambda l: inbox(l, 24, 38, -35, -16.84),
  'OTF': lambda l: inbox(l, 29, 35, -35, -31),
  'OCB': lambda l: inbox(l, 32, 38, -47.01, -34),
}
skip = set(); n = 0
for f in b['features']:
    k = f['properties']['kind']; r = rules.get(k)
    if not r: continue
    keep = []
    for l in f['geometry']['coordinates']:
        if r(l):
            n += 1
            for p in l: skip.add('%.2f,%.2f' % (p[0], p[1]))
        else: keep.append(l)
    f['geometry']['coordinates'] = keep
json.dump(b, open(B, 'w'), separators=(',', ':'))
p = json.load(open(P))
# les polygones de plaques ont des sommets légèrement décalés (arrondis) : tolérance 0,03°
pts = [tuple(map(float, k.split(','))) for k in skip]
def near(q): return any(abs(q[0]-x) <= .03 and abs(q[1]-y) <= .03 for x, y in pts)
for f in p['features']:
    g = f['geometry']; polys = [g['coordinates']] if g['type'] == 'Polygon' else g['coordinates']
    for poly in polys:
        for r in poly:
            for q in r:
                if 24 <= q[0] <= 38.5 and -47.1 <= q[1] <= -16.8 and near(q): skip.add('%.2f,%.2f' % (q[0], q[1]))
p['skip'] = sorted(set(p.get('skip', [])) | skip)
json.dump(p, open(P, 'w'), separators=(',', ':'))
print('lignes retirées', n, 'sommets', len(skip))
