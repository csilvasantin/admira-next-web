#!/usr/bin/env python3
"""Paso 2 · clon fiel JTI -> Alsea sobre las presentaciones ya dadas de alta por la vía oficial.

- Backup previo de TODA clave que se escribe (backup/<ts>/).
- Conserva lo que el alta oficial puso bien (slug, passwordVerifier, createdAt, compatibilityLab,
  roomDeviceLab, sourceTraceability, sequence, structure, generation.tasks).
- Copia de JTI: inspiration + theme (look clearchannel.tv), footer, logo Clear Channel (R2).
- Reescribe ideas / ideas-base con content.py (ES + EN), regenera generation.sourceText
  (mismo formato que buildSource de api/generate.js).
- Renders de la cafetería (Stock) -> R2 privado + media-library + slideMedia
  (acceptedByCarlos:false; derechos 'owned' de AdmiraNeXT -> usables).
- Registra una versión con el mismo formato que _versions.js captureVersion.
Uso: python3 apply.py [--dry]
"""
import copy, datetime, json, os, random, subprocess, sys, tempfile, uuid
import content as C, build as B

HERE = os.path.dirname(os.path.abspath(__file__))
NS = '865b826b5e0f4093b693583d46fe69e0'
BUCKET = 'admiranext-presentations'
DRY = '--dry' in sys.argv
NOW = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.') + f'{datetime.datetime.now().microsecond // 1000:03d}Z'
TS = datetime.datetime.now().strftime('%Y%m%d-%H%M%S')
BK = os.path.join(HERE, 'backup', f'pre-apply-{TS}')
os.makedirs(BK, exist_ok=True)
ENV = {k: v for k, v in os.environ.items() if k != 'CLOUDFLARE_API_TOKEN'}  # OAuth de wrangler


def kv_get(key):
    r = subprocess.run(['npx', 'wrangler', 'kv', 'key', 'get', key, f'--namespace-id={NS}', '--remote'], capture_output=True, text=True, env=ENV, cwd=HERE)
    out = r.stdout.strip()
    if r.returncode != 0 or not out or out.startswith('Value not found'):
        return None
    try:
        return json.loads(out)
    except Exception:
        return out


def backup(key):
    val = kv_get(key)
    with open(os.path.join(BK, key.replace(':', '_').replace('/', '_') + '.json'), 'w') as f:
        json.dump(val, f, ensure_ascii=False)
    return val


def kv_put(key, value):
    if DRY:
        print('DRY put', key, len(json.dumps(value)))
        return
    with tempfile.NamedTemporaryFile('w', suffix='.json', delete=False, dir=HERE) as f:
        json.dump(value, f, ensure_ascii=False, separators=(',', ':'))
        path = f.name
    r = subprocess.run(['npx', 'wrangler', 'kv', 'key', 'put', key, f'--path={path}', f'--namespace-id={NS}', '--remote'], capture_output=True, text=True, env=ENV, cwd=HERE)
    os.unlink(path)
    if r.returncode != 0:
        raise SystemExit(f'KV put {key} falló: {r.stderr[-400:]}')
    print('put', key)


def r2_put(key, path, content_type, meta=None):
    if DRY:
        print('DRY r2', key)
        return
    cmd = ['npx', 'wrangler', 'r2', 'object', 'put', f'{BUCKET}/{key}', f'--file={path}', f'--content-type={content_type}', '--cache-control=private, max-age=3600', '--remote']
    r = subprocess.run(cmd, capture_output=True, text=True, env=ENV, cwd=HERE)
    if r.returncode != 0:
        raise SystemExit(f'R2 put {key} falló: {r.stderr[-400:]}')
    print('r2 put', key)


def r2_backup(key):
    dest = os.path.join(BK, 'r2_' + key.replace('/', '_'))
    subprocess.run(['npx', 'wrangler', 'r2', 'object', 'get', f'{BUCKET}/{key}', f'--file={dest}', '--remote'], capture_output=True, text=True, env=ENV, cwd=HERE)


def clean_excerpt(s):
    import re
    m = re.search(r'(?i)xtanco|estanco|\bjti\b|tobacco|starbucks|domino', s or '')
    return s if not m else s[:m.start()].rsplit(' ', 1)[0].rstrip(' ·')


def source_text(d):
    """Puerto literal de buildSource (functions/presentaciones/api/generate.js)."""
    def blocks(sk):
        return '\n\n'.join(f"{i + 1}. {it['title']}\nIdea principal: {it['message']}\nDesarrollo: {it['detail']}" for i, it in enumerate([x for x in sk if x.get('enabled') is not False]))
    insp = d.get('inspiration')
    inspiration = (f"\nDIRECCIÓN VISUAL INSPIRADORA\n- Referencia: {insp['url']}\n- Perfil: {insp['profile']}; modo {insp['mode']}; tipografía {insp['fontStyle']}; geometría {insp['radiusStyle']}; densidad {insp['density']}; composición {insp['layout']}.\n- Paleta extraída: {', '.join(insp.get('palette') or [])}.\n- Interpretar estos rasgos en clave ADmiraNeXT × {d['displayName']}; no copiar código, textos, logotipos ni elementos propietarios de la web inspiradora.\n") if insp else ''
    brand = (f"\nIDENTIDAD OFICIAL DEL CLIENTE\n- Fuente oficial: {d['brand']['website']}\n- El logo oficial de {d['displayName']} es obligatorio y debe aparecer de forma consistente en toda la presentación, cada diapositiva y cada pieza visual.\n- Mantener proporciones, colores y área de respeto; no redibujar, reinterpretar ni sustituir el logo por texto.\n") if d.get('brand') else ''
    translated = ''
    for lang in [l for l in d.get('languages', []) if l != 'es' and d.get('translations', {}).get(l)]:
        c = d['translations'][lang]
        translated += f"\n\nVERSIÓN {lang.upper()}\nTitular: {c['hero']['title']}\nEntradilla: {c['hero']['summary']}\nObjetivo: {c['objective']}\n\n{blocks(c['skeleton'])}\n\nCIERRE\n{c['closing']['title']}\nSiguiente acción: {c['closing']['action']}"
    langs = ', '.join(d.get('languages', [])).upper()
    return (f"ADMIRANEXT × {d['displayName']}\nGUION MAESTRO DE PRESENTACIÓN\n\n"
            f"Titular: {d['hero']['title']}\nEntradilla: {d['hero']['summary']}\nObjetivo: {d['objective']}\n\n{blocks(d['skeleton'])}\n\n"
            f"CIERRE\n{d['closing']['title']}\nSiguiente acción: {d['closing']['action']}\n{inspiration}{brand}\n"
            f"CRITERIOS DE PRODUCCIÓN\n- La identidad editorial y visual es AdmiraNeXT × {d['displayName']}; ambas marcas deben convivir.\n"
            f"- Crear una versión completa por cada idioma solicitado: {langs}.\n"
            f"- No mostrar referencias gráficas al proveedor de producción; las marcas visibles son AdmiraNeXT y el logo oficial de {d['displayName']}.\n"
            f"- En vídeo, eliminar únicamente la tarjeta final del proveedor y prolongar el último fotograma limpio durante ese tramo.\n"
            f"- Mantener la misma dirección visual inspiradora en website, PDF, PowerPoint, documentos e infografía.\n"
            f"- No sustituir el cierre por otra plantilla ni cambiar paleta, tipografía, textura, composición o duración.{translated}")


def capture_version(client, reason, values, index):
    vid = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d%H%M%S') + '-' + uuid.uuid4().hex[:8]
    snapshot = {'schemaVersion': 1, 'id': vid, 'client': client, 'reason': reason, 'createdAt': NOW, 'values': values}
    p, i = values['presentation'], values['ideas']
    meta = {'id': vid, 'reason': reason, 'createdAt': NOW, 'displayName': p['displayName'],
            'languages': p.get('languages') or i.get('languages') or [], 'outputs': p.get('outputs') or i.get('outputs') or [],
            'revision': i.get('updatedAt') or p.get('updatedAt') or NOW}
    index = index or {'schemaVersion': 1, 'client': client, 'versions': []}
    index['versions'] = [meta] + [v for v in index.get('versions', []) if v.get('id') != vid][:99]
    kv_put(f'version:{client}:{vid}', snapshot)
    kv_put(f'versions:{client}', index)
    return vid


def brand_for(slug, name):
    return {'logoKey': f'presentations/{slug}/brand/logo.svg', 'logoUrl': f'/presentaciones/{slug}/brand/logo',
            'sourceUrl': 'https://www.clearchannel.es/', 'website': C.WEBSITE, 'contentType': 'image/svg+xml',
            'alt': f'Logo de {name}', 'capturedAt': NOW}


def media_for(slug):
    """Sube los renders a R2 privado y devuelve (library, slideMedia)."""
    library, slide_media = [], []
    for n, r in enumerate(C.RENDERS):
        src = os.path.join(HERE, 'img', r['stock'] + '.bin')
        file_id = str(int(r['stock'].split('-')[0]))[-13:]
        filename = f'library-es-{file_id}.png'
        key = f'presentations/{slug}/es/{filename}'
        r2_put(key, src, 'image/png')
        asset_id = uuid.uuid4().hex[:16]
        stock_url = f"https://api.admira.store/stock/asset/{r['stock']}"
        library.append({'id': asset_id, 'name': r['caption_name'], 'kind': 'image', 'contentType': 'image/png',
                        'size': os.path.getsize(src), 'url': f'/presentaciones/{slug}/media/{filename}', 'objectKey': key,
                        'uploadedAt': NOW, 'acceptedByCarlos': False, 'acceptedAt': '',
                        'approvalNote': f'Pendiente de la aceptación de Carlos. Render 3D propio (Trinity · Blender, sin logos) importado de Pixeria Stock {stock_url} por subNeo · MBP14.',
                        'uploadedBy': 'subNeo · NeoMBP14 <csilva@admira.com>', 'uploadedVia': 'kv-clone',
                        'assignedSlides': [r['slide']]})
        slide_media.append({'slide': r['slide'], 'type': 'image', 'src': f'/presentaciones/{slug}/media/{filename}',
                            'caption': r['caption'],
                            'fallback': 'El render de la Cafebrería no está disponible. Continúa con el relato de la diapositiva.',
                            'preload': 'metadata', 'autoplay': False, 'loop': False,
                            'rights': {'source': f'Pixeria Stock · {stock_url} (encargo #4365)', 'permission': 'owned',
                                       'license': 'Render 3D propio de AdmiraNeXT (Trinity · Blender), sin logos',
                                       'holder': 'AdmiraNeXT', 'attribution': 'Render: Trinity · AdmiraNeXT',
                                       'acceptedByCarlos': False, 'acceptedAt': '', 'approvalNote': 'Pendiente de la aceptación de Carlos.'}})
    library.reverse()  # la biblioteca guarda lo último primero
    return library, slide_media


def do(slug, jti, name, ideas_new, ideas_base_new, with_media):
    keys = [f'presentation:{slug}', f'ideas:{slug}', f'ideas-base:{slug}', f'generation:{slug}', f'versions:{slug}', f'media-library:{slug}']
    cur = {k.split(':')[0]: backup(k) for k in keys}
    r2_backup(f'presentations/{slug}/brand/logo.svg')
    jti_p = json.load(open(os.path.join(HERE, 'orig', f'presentation--{jti}.json')))
    pres = copy.deepcopy(cur['presentation'])
    assert pres and pres['slug'] == slug and pres.get('passwordVerifier'), 'alta oficial no encontrada'
    pres['inspiration'] = copy.deepcopy(jti_p['inspiration'])
    pres['inspiration']['contentExcerpt'] = clean_excerpt(pres['inspiration'].get('contentExcerpt', ''))
    pres['theme'] = copy.deepcopy(jti_p['theme'])
    pres['footer'] = copy.deepcopy(jti_p.get('footer'))
    pres['outputs'] = list(jti_p['outputs']); pres['languages'] = list(jti_p['languages'])
    pres['brand'] = brand_for(slug, name)
    pres['updatedAt'] = NOW
    # logo: el mismo SVG de Clear Channel que usa el deck JTI (el capturado de alsea.net era el de Domino's)
    r2_put(f'presentations/{slug}/brand/logo.svg', os.path.join(HERE, 'r2', f'presentations_{jti}_brand_logo.svg'), 'image/svg+xml')
    library = cur.get('media-library') if isinstance(cur.get('media-library'), list) else []
    if with_media:
        library, slide_media = media_for(slug)
        pres['slideMedia'] = slide_media
    for ideas in (ideas_new, ideas_base_new):
        ideas['brand'] = copy.deepcopy(pres['brand'])
        ideas['inspiration'] = copy.deepcopy(pres['inspiration'])
        ideas['updatedAt'] = NOW
        ideas.pop('translationPending', None); ideas.pop('translationError', None)
    gen = copy.deepcopy(cur['generation'])
    gen['sourceText'] = source_text({**ideas_new, 'languages': pres['languages']})
    gen['updatedAt'] = NOW
    kv_put(f'presentation:{slug}', pres)
    kv_put(f'ideas:{slug}', ideas_new)
    kv_put(f'ideas-base:{slug}', ideas_base_new)
    kv_put(f'generation:{slug}', gen)
    if with_media:
        kv_put(f'media-library:{slug}', library)
    vid = capture_version(slug, 'clon fiel del circuito de referencia · Xpacio Cafebrería (subNeo · MBP14)',
                          {'presentation': pres, 'ideas': ideas_new, 'generation': gen, 'image-set': None}, cur['versions'])
    print(slug, 'versión', vid)


if __name__ == '__main__':
    print('backup ->', BK)
    B_ins = B.build_ideas(B.load('ideas-base--jti-xtanco-inserto.json'), C.INSERT_ES, C.INSERT_EN, C.INSERT, C.INSERT_NAME, C.INSERT_NOTES)
    B_main = B.build_ideas(B.load('ideas-base--jti-xtanco-circuito.json'), C.MAIN_ES, C.MAIN_EN, C.MAIN, C.MAIN_NAME, C.MAIN_NOTES)
    do(C.INSERT, 'jti-xtanco-inserto', C.INSERT_NAME, B.insert_ideas(), B_ins, with_media=False)
    do(C.MAIN, 'jti-xtanco-circuito', C.MAIN_NAME, B.main_ideas(), B_main, with_media=True)
