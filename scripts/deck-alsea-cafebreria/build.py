"""Construye los objetos Alsea (ideas ES+EN) a partir de los originales JTI + content.py."""
import copy, json, os
import content as C
HERE = os.path.dirname(os.path.abspath(__file__))
def load(name): return json.load(open(os.path.join(HERE, 'orig', name)))

def apply_locale(loc, over):
    loc = copy.deepcopy(loc)
    if 'hero' in over: loc['hero'] = {**loc.get('hero', {}), **over['hero']}
    if 'objective' in over: loc['objective'] = over['objective']
    if 'closing' in over: loc['closing'] = {**loc.get('closing', {}), **over['closing']}
    for block in loc.get('skeleton', []):
        block.update(over.get('skeleton', {}).get(block['id'], {}))
    return loc

def build_ideas(orig, es, en, slug, name, notes):
    ideas = apply_locale(orig, es)
    ideas['translations']['en'] = apply_locale(orig['translations']['en'], en)
    ideas['client'] = slug; ideas['displayName'] = name; ideas['notes'] = notes
    return ideas

def slides_for_create(ideas):
    out = []
    for b in ideas['skeleton']:
        out.append({k: b[k] for k in ('title', 'message', 'detail', 'promise', 'act', 'role', 'chapter', 'product') if b.get(k) is not None} | {'code': b['id'], 'minutes': b.get('minutes', 5)})
    return out

def main_ideas(): return build_ideas(load('ideas--jti-xtanco-circuito.json'), C.MAIN_ES, C.MAIN_EN, C.MAIN, C.MAIN_NAME, C.MAIN_NOTES)
def insert_ideas(): return build_ideas(load('ideas--jti-xtanco-inserto.json'), C.INSERT_ES, C.INSERT_EN, C.INSERT, C.INSERT_NAME, C.INSERT_NOTES)
if __name__ == '__main__':
    for i in (main_ideas(), insert_ideas()):
        print(json.dumps({k: i[k] for k in ('hero', 'objective')}, ensure_ascii=False, indent=1))
        for b, e in zip(i['skeleton'], i['translations']['en']['skeleton']): print(' ', b['id'], '|', b['title'], '|', b['message'][:110], '||', e['title'][:60])
