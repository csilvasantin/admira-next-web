"""Paso 1 · alta OFICIAL por el MCP del generador (reserva slug, job, contraseña servidor, versión inicial)."""
import json, sys, time
import content as C, build as B, mcp
which = sys.argv[1]
if which == 'insert':
    ideas = B.insert_ideas()
    args = {'displayName': C.INSERT_NAME, 'slug': C.INSERT, 'website': C.WEBSITE, 'inspirationUrl': C.INSPIRATION,
            'languages': ['es', 'en'], 'outputs': ['website'], 'title': ideas['hero']['title'], 'summary': ideas['hero']['summary'],
            'objective': ideas['objective'], 'slides': B.slides_for_create(ideas),
            'closingTitle': ideas['closing']['title'], 'closingAction': ideas['closing']['action']}
else:
    ideas = B.main_ideas()
    args = {'displayName': C.MAIN_NAME, 'slug': C.MAIN, 'website': C.WEBSITE, 'inspirationUrl': C.INSPIRATION,
            'languages': ['es', 'en'], 'outputs': ['website', 'documents'], 'problem': C.PROBLEM, 'audience': C.AUDIENCE,
            'title': ideas['hero']['title'], 'summary': ideas['hero']['summary'], 'objective': ideas['objective'],
            'structure': 'admiranext', 'slides': B.slides_for_create(ideas),
            'insertDeck': {'slug': C.INSERT, 'afterBlock': 'store-c'},
            'footer': {'text': 'Estructura AdmiraNeXT', 'showSlideNumber': True, 'showBrand': True},
            'closingTitle': ideas['closing']['title'], 'closingAction': ideas['closing']['action']}
res = mcp.call('create_presentation', args)
print(mcp.text_of(res)[:1500])
slug = args['slug']
for i in range(60):
    time.sleep(10)
    st = mcp.text_of(mcp.call('generation_status', {'client': slug}))
    try: d = json.loads(st)
    except Exception: d = {'raw': st[:300]}
    status = d.get('status') or (d.get('job') or {}).get('status')
    print(i, status, str(d.get('error') or (d.get('job') or {}).get('error') or '')[:200])
    if status in ('saved', 'failed'): print(json.dumps(d, ensure_ascii=False)[:1500]); break
