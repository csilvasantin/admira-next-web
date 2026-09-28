"""Paso 3 · limpia el rastro JTI/Xtanco/estanco/Starbucks que NO es contenido del deck:
- inspiration.contentExcerpt (raspado de clearchannel.tv, que lista los circuitos de otros clientes)
- el motivo de la versión del clon.
Backup previo de cada clave (backup/pre-sanitize-<ts>/)."""
import json, re, os, glob
import apply as A
PAT = re.compile(r'(?i)xtanco|estanco|\bjti\b|tobacco|starbucks|domino')
def clean_excerpt(s):
    m = PAT.search(s or '')
    return s if not m else s[:m.start()].rsplit(' ', 1)[0].rstrip(' ·')
def fix(o):
    if isinstance(o, dict):
        for k, v in list(o.items()):
            if k == 'contentExcerpt' and isinstance(v, str): o[k] = clean_excerpt(v)
            elif k == 'reason' and isinstance(v, str) and 'clon fiel' in v: o[k] = 'clon fiel del circuito de referencia · Xpacio Cafebrería (subNeo · MBP14)'
            else: fix(v)
    elif isinstance(o, list):
        for v in o: fix(v)
    return o
keys = [l.strip() for l in open(os.path.join(A.HERE, 'final', 'keys.txt')) if l.strip()]
for k in keys:
    val = A.backup(k)
    if not isinstance(val, (dict, list)): continue
    before = json.dumps(val, ensure_ascii=False)
    new = fix(json.loads(before))
    after = json.dumps(new, ensure_ascii=False)
    if after != before:
        A.kv_put(k, new)
    left = PAT.findall(after)
    if left: print('QUEDA', k, sorted(set(x.lower() for x in left)))
print('backup', A.BK)
