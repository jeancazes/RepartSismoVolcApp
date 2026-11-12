"""Marque « avancé seulement » (adv) les limites internes de micro-plaques hypothétiques
(Amour, Yangtsé, Altiplano, Nord-Andes) : masquées en mode Collège."""
import json, sys
from collections import defaultdict
repo = sys.argv[1] if len(sys.argv) > 1 else '.'
B = repo + '/data/boundaries3.json'; P = repo + '/data/plates.json'
HIDE = [{'AM','EU'},{'AM','YA'},{'YA','EU'},{'YA','SU'},{'AP','SA'},{'ND','SA'}]
p = json.load(open(P)); b = json.load(open(B))
G = 0.05
cell = defaultdict(set)   # grille -> plaques ayant un sommet proche
def key(q): return (round(q[0]/G), round(q[1]/G))
for f in p['features']:
    c = f['properties']['code']; g = f['geometry']
    for poly in ([g['coordinates']] if g['type'] == 'Polygon' else g['coordinates']):
        for r in poly:
            for q in r:
                kx, ky = key(q)
                for dx in (-1,0,1):
                    for dy in (-1,0,1): cell[(kx+dx, ky+dy)].add(c)
def plates_at(q): return cell.get(key(q), set())
def hidden_pair(s): return any(h <= s for h in HIDE)
# frontières : déplace les lignes concernées dans des entités « adv »
b['features'] = [f for f in b['features'] if not f['properties'].get('adv')]
new = []; n = 0
for f in b['features']:
    keep, adv = [], []
    for l in f['geometry']['coordinates']:
        # extrémités = sommets PB2002 partagés avec les polygones de plaques
        (adv if hidden_pair(plates_at(l[0]) & plates_at(l[-1])) else keep).append(l)
    f['geometry']['coordinates'] = keep
    if adv:
        n += len(adv)
        new.append({'type': 'Feature', 'properties': dict(f['properties'], adv=1), 'geometry': {'type': 'MultiLineString', 'coordinates': adv}})
b['features'] += new
json.dump(b, open(B, 'w'), separators=(',', ':'))
# contours : sommets des arêtes entre ces paires
adv = set()
for f in p['features']:
    c = f['properties']['code']; g = f['geometry']
    for poly in ([g['coordinates']] if g['type'] == 'Polygon' else g['coordinates']):
        for r in poly:
            for i in range(len(r) - 1):
                a, z = plates_at(r[i]), plates_at(r[i+1])
                if hidden_pair(a & z):
                    adv.add('%.2f,%.2f' % (r[i][0], r[i][1])); adv.add('%.2f,%.2f' % (r[i+1][0], r[i+1][1]))
p['advskip'] = sorted(adv)
json.dump(p, open(P, 'w'), separators=(',', ':'))
print('lignes de frontière adv', n, 'sommets contours', len(adv))
