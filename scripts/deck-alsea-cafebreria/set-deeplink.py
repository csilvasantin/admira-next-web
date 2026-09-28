#!/usr/bin/env python3
"""Cambia en UNA operación el deep-link del punto de la demo en alsea-cafebreria-circuito.
   python3 set-deeplink.py <url_es> <url_en>
Sustituye en ideas + ideas-base (lámina 3a ES/EN y notas) y en generation.sourceText, con backup
previo, y registra una versión «deep-link actualizado». Actualiza también content.py para que el
guion siga siendo reproducible."""
import json, os, re, sys
import apply as A, content as C

if len(sys.argv) != 3 or not all(u.startswith('https://') for u in sys.argv[1:]):
    raise SystemExit(__doc__)
new_es, new_en = sys.argv[1], sys.argv[2]
old_es, old_en = C.DEEPLINK_ES, C.DEEPLINK_EN
slug = C.MAIN
cur = {k: A.backup(f'{k}:{slug}') for k in ('presentation', 'ideas', 'ideas-base', 'generation', 'versions')}
count = 0
def swap(obj):
    global count
    s = json.dumps(obj, ensure_ascii=False)
    n = s.count(old_es) + s.count(old_en)
    count += n
    return json.loads(s.replace(old_es, new_es).replace(old_en, new_en))
ideas, base, gen = swap(cur['ideas']), swap(cur['ideas-base']), swap(cur['generation'])
if not count:
    raise SystemExit('No se encontró el deep-link anterior; nada que cambiar.')
ideas['updatedAt'] = base['updatedAt'] = gen['updatedAt'] = A.NOW
A.kv_put(f'ideas:{slug}', ideas); A.kv_put(f'ideas-base:{slug}', base); A.kv_put(f'generation:{slug}', gen)
A.capture_version(slug, 'deep-link del punto de la demo actualizado', {'presentation': cur['presentation'], 'ideas': ideas, 'generation': gen, 'image-set': None}, cur['versions'])
path = os.path.join(A.HERE, 'content.py')
src = open(path).read()
src = re.sub(r"DEEPLINK_ES = '[^']*'", f"DEEPLINK_ES = '{new_es}'", src)
src = re.sub(r"DEEPLINK_EN = '[^']*'", f"DEEPLINK_EN = '{new_en}'", src)
open(path, 'w').write(src)
print(f'{count} apariciones cambiadas · backup en {A.BK}')
