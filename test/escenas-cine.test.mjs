// Escenas ilustradas de las pieles de cine 81–89 (06-10-2026 · petición de Carlos, parte 2).
// Cada piel trae una ilustración vectorial ORIGINAL (marcablanca/escenas/<id>.svg): sin fotogramas,
// carteles, capturas, logotipos ni fan art; sin títulos, nombres de personajes ni parecidos de actores.
// Se ven de fondo en la home (tras el terminal, que sigue ≥ 7:1), en el libro de estilo
// /marcablanca/estilo?marca=<id> y de fondo de página en admira.live.
// Producción: ESCENAS_PROD=1 node --test test/escenas-cine.test.mjs comprueba también www.admiranext.com.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync, statSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import vm from 'node:vm';
import {validarMarca} from '../marcablanca/marca.js';
import {onRequestGet as una} from '../functions/marcablanca/api/marcas/[id]/index.js';
import {absolutizarSemilla} from '../functions/marcablanca/_catalogo.js';

const ROOT = new URL('../', import.meta.url);
const leer = (p) => readFileSync(new URL(p, ROOT), 'utf8');
const PIELES = ['81', '82', '83', '84', '85', '86', '87', '88', '89'];
const marca = (id) => JSON.parse(leer(`marcablanca/clientes/${id}.json`));
// La misma lista que test/marca-cine.test.mjs: títulos, personajes, actores, estudios.
const PROHIBIDO = new RegExp([
    // 81 · aventura en el desierto
    'indiana', '\\bjones\\b', 'raiders', 'lost ark', '\\bark\\b', 'arca perdida', 'busca del arca', 'marion ravenwood', 'belloq', 'sallah', 'harrison ford',
    // 82 · neón bajo la lluvia
    'blade ?runner', 'deckard', 'replicant', 'replicante', 'tyrell', 'nexus', 'voight', 'kampff', 'roy batty', 'rachael', '\\bgaff\\b', 'tears in rain', 'lágrimas en la lluvia', 'ridley scott', 'philip k',
    // 83 · noche de barrio
    'elliott', 'extraterrestre', '\\be\\.?t\\.(?=\\s|$|[^a-z])', 'phone home', 'mi casa', 'reese', 'spielberg', 'lucasfilm',
    // 84 · 85
    'terminator', 'skynet', 'cyberdyne', 'sarah connor', 'kyle reese', 't-?800', 'back to the future', 'regreso al futuro', 'volver al futuro',
    'delorean', 'mcfly', 'doc brown', 'hill valley', 'flux', 'fluzo', 'condensador', '88 ?mph', '1\\.21', 'gigawatt',
    // 86 · aviación
    'top ?gun', '\\bmaverick', '\\bgoose\\b', '\\biceman', 'miramar', 'viper\\b', 'charlie blackwood', 'peligro en las alturas', 'highway to the danger', 'danger zone', 'take my breath',
    // 87 · ciencia ficción policial
    'robo-?cop', 'alex murphy', '\\bocp\\b', 'omni ?consumer', 'ed-?209', 'clarence boddicker', 'delta city', 'anne lewis',
    // 88 · cine negro y animación
    'roger', 'rabbit', 'conejo', 'jessica', 'toontown', 'dibujolandia', 'judge doom', 'juez doom', 'eddie valiant', 'acme', 'baby herman', 'quién engañó', 'quien engaño',
    // 89 · gótico urbano
    'batman', 'bat-?signal', 'bati', 'murci[eé]lago', '\\bbat\\b', 'bruce wayne', '\\bwayne\\b', 'joker', 'jack napier', 'gotham', 'alfred', 'vicki vale', 'tim burton', 'gordon',
    // estudios
    'paramount', 'orion pictures', 'tri-?star', 'warner', 'disney', 'amblin', 'touchstone', 'carolco', 'universal pictures',
  ].join('|'), 'i');

// Lo que pide cada piel (motivo): se comprueba en el título accesible del SVG.
const MOTIVO = {
  81: /sombrero.*látigo.*templo.*desierto/i, 82: /neón.*lluvia.*coche patrulla volador/i, 83: /bicicleta con cesta.*luna llena.*pinos/i,
  84: /ojo rojo.*robot.*ciudad/i, 85: /ala de gaviota.*fuego.*torre del reloj/i, 86: /dos cazas.*atardecer.*portaaviones/i,
  87: /visor.*casco policial cromado.*HUD/i, 88: /guante blanco.*farola.*años 40/i, 89: /reflector.*alada.*nubes.*gótico/i,
};

test('cada piel 81–89 tiene su escena: SVG propio, accesible, ligero y sin material de terceros', () => {
  for (const id of PIELES) {
    const ruta = `marcablanca/escenas/${id}.svg`;
    assert.ok(existsSync(new URL(ruta, ROOT)), ruta);
    const svg = leer(ruta);
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 1600 900"/, 'vector 16:9');
    assert.match(svg, /preserveAspectRatio="xMidYMid slice"/, 'cubre el fondo sin deformarse');
    assert.match(svg, /role="img"/);
    const titulo = svg.match(/<title[^>]*>([^<]+)<\/title>/)?.[1] || '';
    assert.match(titulo, new RegExp(`^Piel ${id} · `), 'título accesible');
    assert.match(titulo, MOTIVO[id], `motivo pedido para ${id}`);
    assert.match(svg, /<desc[^>]*>[^<]*original de Admira[^<]*sin fotogramas, carteles, logotipos, títulos ni personajes de terceros/, 'declara su origen');
    assert.doesNotMatch(svg, /<image|href=|<script|<foreignObject|<text|data:|@import|url\((?!#)/i, 'solo formas propias: sin imágenes incrustadas, texto ni recursos externos');
    assert.doesNotMatch(svg, PROHIBIDO, `${id}: sin títulos, personajes, actores ni estudios`);
    assert.ok(statSync(new URL(ruta, ROOT)).size < 60 * 1024, `${id}: < 60 KB`);
  }
});

test('el catálogo enlaza cada escena (fondos.escena) con su texto alternativo y la API la sirve en /marcablanca/escenas/', async () => {
  const assets = {async fetch(input){
    const url = new URL(typeof input === 'string' ? input : input.url || input.href);
    try { return new Response(await readFile(new URL('.' + url.pathname, ROOT)), {headers: {'content-type': 'application/json'}}); }
    catch (_) { return new Response('404', {status: 404}); }
  }};
  for (const id of PIELES) {
    const m = marca(id);
    assert.deepEqual(validarMarca(m), [], id);
    assert.equal(m.fondos.escena.svg, `../escenas/${id}.svg`);
    assert.ok(existsSync(new URL(m.fondos.escena.svg, new URL('marcablanca/clientes/', ROOT))));
    assert.ok(m.fondos.escena.alt.length > 20, 'texto alternativo');
    assert.doesNotMatch(JSON.stringify(m.fondos), PROHIBIDO, id);
    const res = await una({request: new Request(`https://www.admiranext.com/marcablanca/api/marcas/${id}`), env: {ASSETS: assets}, params: {id}});
    assert.equal(res.status, 200);
    assert.equal((await res.json()).fondos.escena.svg, `/marcablanca/escenas/${id}.svg`, 'la API la da con ruta absoluta del sitio');
  }
});

test('marcablanca.js expone la escena como --mb-escena y marca la raíz con data-mb-escena', async () => {
  const src = leer('marcablanca/marcablanca.js');
  const attrs = {}, estilo = new Map(), props = [];
  const html = {
    getAttribute: (k) => (k in attrs ? attrs[k] : null), setAttribute: (k, v) => { attrs[k] = String(v); }, removeAttribute: (k) => { delete attrs[k]; },
    // style indexable como CSSStyleDeclaration (aplicar() recorre style[i] para quitar las --mb-*)
    style: new Proxy({colorScheme: '', setProperty: (k, v) => { if (!estilo.has(k)) props.push(k); estilo.set(k, v); }, removeProperty: (k) => { estilo.delete(k); const i = props.indexOf(k); if (i >= 0) props.splice(i, 1); }},
      {get: (t, k) => (k === 'length' ? props.length : /^\d+$/.test(String(k)) ? props[k] : t[k])}),
    dispatchEvent() {}, querySelectorAll: () => [],
  };
  const doc = {currentScript: {src: 'https://www.admiranext.com/marcablanca/marcablanca.js?v=x', getAttribute: (k) => (k === 'data-mb-auto' ? 'false' : null)},
    documentElement: html, readyState: 'complete', querySelector: () => null, querySelectorAll: () => [], head: {appendChild() {}}, addEventListener() {}, fonts: null};
  const fetch = async (url) => {
    const u = new URL(url);
    const id = u.pathname.split('/').pop().replace(/\.json$/, '');
    const ruta = u.pathname.includes('/api/marcas/') ? `marcablanca/clientes/${id}.json` : u.pathname.slice(1);
    // Como la API real: las semillas salen con rutas del sitio (../escenas/ → /marcablanca/escenas/).
    const datos = JSON.parse(leer(ruta));
    return {ok: true, json: async () => (u.pathname.includes('/api/marcas/') ? absolutizarSemilla(datos) : datos)};
  };
  const win = {location: {href: 'https://www.admiranext.com/', search: '', hostname: 'www.admiranext.com'}, fetch, console};
  vm.runInNewContext(src, {window: win, document: doc, URL, URLSearchParams, fetch, CustomEvent: class { constructor(t, o) { Object.assign(this, o); } }, DOMParser: class {}, console, setTimeout, Promise});
  const MBL = win.MarcaBlanca;
  for (const id of ['84', '89']) {
    const v = await MBL.variables(id, {plataforma: 'store'});
    assert.equal(v['--mb-escena'], `url("https://www.admiranext.com/marcablanca/escenas/${id}.svg")`);
    await MBL.aplicar(id, {plataforma: 'store', favicon: false, logos: false}).catch(() => {});
    assert.equal(attrs['data-mb-escena'], '', `${id}: data-mb-escena`);
    assert.equal(estilo.get('--mb-escena'), v['--mb-escena']);
  }
  const sin = await MBL.variables('admira', {plataforma: 'store'});
  assert.equal(sin['--mb-escena'], undefined, 'una marca sin escena no la pinta');
  await MBL.aplicar('admira', {plataforma: 'store', favicon: false, logos: false}).catch(() => {});
  assert.equal(attrs['data-mb-escena'], undefined, 'al cambiar a una marca sin escena se quita');
  assert.equal(estilo.has('--mb-escena'), false);
  // Nunca se inyecta CSS: solo URLs http(s) o del sitio, sin comillas ni paréntesis.
  assert.match(src, /\^\(https\?:\\\/\\\/\|\\\/\)\[\^"'\(\)\\s\\\\\]\+\$/);
});

test('home: la escena va de fondo tras el terminal (sin las fotos ni el vídeo del robot) y el terminal sigue opaco', () => {
  const css = leer('assets/marca-blanca.css');
  const bloque = css.slice(css.indexOf('Escenas ilustradas de las pieles 81–89'));
  assert.match(bloque, /:root\[data-mb-escena\]\[data-mb-plataforma="store"\] \.wallpaper\{[^}]*background-image:var\(--mb-escena\)!important/);
  assert.match(bloque, /\.wallpaper :is\(\.wallpaper-blur,\.wallpaper-sharp,\.wallpaper-video,\.boot-video\)\{display:none!important\}/);
  assert.doesNotMatch(bloque, /terminal-window/, 'la escena no toca la ventana del terminal');
  assert.match(css, /\.terminal-window\{\s*background:var\(--mb-superficie\)/, 'ventana del terminal opaca con la superficie de la piel (≥ 7:1 en test/marca-cine.test.mjs)');
  const mb = leer('assets/marca-blanca.js');
  assert.match(mb, /'data-mb-ejemplo', 'data-mb-escena'\]\) html\.removeAttribute/, '/marca off quita la escena');
  assert.match(mb, /BASE \+ 'marcablanca\.js\?v=20261006-escenas-1'/, 'el cargador común se pide con sello nuevo (caché de 4 h)');
});

test('libro de estilo: la escena sale bajo la portada de /marcablanca/estilo?marca=<id>', () => {
  const js = leer('marcablanca/estilo/estilo.js');
  assert.match(js, /\$\{escenaHtml\(m\)\}/);
  assert.match(js, /<figure class="escena"><img src="\$\{esc\(e\.svg\)\}" alt="\$\{esc\(e\.alt \|\| m\.nombre\)\}"/);
  assert.match(js, /\\\/marcablanca\\\/escenas\\\/\[a-z0-9-\]\+\\\.svg\$/, 'solo escenas del propio catálogo');
  assert.match(leer('marcablanca/estilo/index.html'), /estilo\.js\?v=20261006-escenas-1/);
  assert.match(leer('marcablanca/estilo/estilo.css'), /\.escena img\{/);
});

const TIPOS = {'.svg': 'image/svg+xml', '.json': 'application/json', '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css'};
test('cada escena se sirve con 200 e image/svg+xml (servidor estático local del repo)', async () => {
  const srv = createServer(async (req, res) => {
    const ruta = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    try { const body = await readFile(new URL('.' + ruta, ROOT)); res.writeHead(200, {'content-type': TIPOS[ruta.slice(ruta.lastIndexOf('.'))] || 'application/octet-stream'}); res.end(body); }
    catch (_) { res.writeHead(404); res.end('404'); }
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  try {
    for (const id of PIELES) {
      const r = await fetch(`${base}/marcablanca/escenas/${id}.svg`);
      assert.equal(r.status, 200, id);
      assert.equal(r.headers.get('content-type'), 'image/svg+xml');
      assert.match(await r.text(), /^<svg /);
    }
    assert.equal((await fetch(`${base}/marcablanca/escenas/80.svg`)).status, 404, 'y solo existen las de 81–89');
  } finally { srv.close(); }
});

test('producción: www.admiranext.com sirve cada escena con 200 (ESCENAS_PROD=1)', {skip: process.env.ESCENAS_PROD ? false : 'solo con ESCENAS_PROD=1'}, async () => {
  for (const id of PIELES) {
    const r = await fetch(`https://www.admiranext.com/marcablanca/escenas/${id}.svg`, {cache: 'no-store'});
    assert.equal(r.status, 200, id);
    assert.match(r.headers.get('content-type') || '', /image\/svg\+xml/);
    assert.equal(r.headers.get('access-control-allow-origin'), '*', 'admira.live la usa de fondo');
    const m = await (await fetch(`https://www.admiranext.com/marcablanca/api/marcas/${id}`)).json();
    assert.equal(m.fondos.escena.svg, `/marcablanca/escenas/${id}.svg`);
  }
});
