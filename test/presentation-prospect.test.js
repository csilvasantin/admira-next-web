// PROSPECT · la presentación se viste con la marca del destinatario (Carlos, 01-10-2026).
// Marca blanca (/marcablanca) × generador de presentaciones: alta, guardado, render y demo.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {crearMarca, normalizarMarca, contraste, paletaDesdeColores, variablesMarca} from '../marcablanca/marca.js';
import {pintar} from '../marcablanca/maquetas.js';
import {onRequestPut} from '../functions/presentaciones/api/generate.js';
import {onRequestGet as renderDeck} from '../functions/presentaciones/[client]/presentacion.js';
import {onRequestGet as demoGet, onRequestPost as demoPost} from '../functions/marcablanca/presentacion.js';
import {onRequestGet as listClients} from '../functions/presentaciones/api/clients.js';
import {onRequestGet as logoGet} from '../functions/presentaciones/[client]/brand/logo.js';
import {onRequestGet as generatorGet} from '../functions/presentaciones/index.js';
import {plataformaDeBloque, prospectSource} from '../functions/presentaciones/_prospect.js';

const ROOT = new URL('../', import.meta.url);
const TYPES = {'.json': 'application/json', '.svg': 'image/svg+xml', '.css': 'text/css', '.html': 'text/html'};
const ASSETS = {async fetch(input){
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
  try { const body = await readFile(new URL('.' + url.pathname, ROOT)); return new Response(body, {headers: {'content-type': TYPES[url.pathname.slice(url.pathname.lastIndexOf('.'))] || 'application/octet-stream'}}); }
  catch (_) { return new Response('404', {status: 404}); }
}};
function kv(){
  const values = new Map();
  return {values, async get(key, o){ const v = values.get(key); if (v == null) return null; return o?.type === 'json' ? JSON.parse(v) : v; },
    async put(key, value){ values.set(key, String(value)); }, async list(o){ return {keys: [...values.keys()].filter(k => !o?.prefix || k.startsWith(o.prefix)).map(name => ({name}))}; }};
}
function r2(){ const objects = new Map(); return {objects, async put(key, bytes, meta){ objects.set(key, {bytes, meta}); }}; }
const PNG_1PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

async function put(env, body){
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => { if (String(url).includes('api.x.ai')) throw new Error('ECONNRESET'); throw new Error('fetch inesperado: ' + url); };
  try {
    return await onRequestPut({request: new Request('https://www.admiranext.com/presentaciones/api/generate', {method: 'PUT', headers: {'content-type': 'application/json', Origin: 'https://www.admiranext.com'}, body: JSON.stringify(body)}), env, params: {}, waitUntil(){}});
  } finally { globalThis.fetch = realFetch; }
}
async function deck(env, slug, query = ''){
  const response = await renderDeck({params: {client: slug}, request: new Request(`https://www.admiranext.com/presentaciones/${slug}/presentacion${query}`), env, data: {}, next: () => new Response('next', {status: 404})});
  return response.text();
}

test('crearMarca genera un cliente con el esquema de marcablanca y siempre legible', () => {
  const casos = [['#0A2540', '#635BFF', '#00D4FF'], ['#E30613', '#1D1D1B', '#FFD200'], ['#FFDD00', '#003366', '#FF6600'], ['#7B2D8E', '#F4A6C6', '#2FB67C'], ['#00A651', '#FFFFFF', '#F7941D'], ['#111111', '#999999', '#FF0055']];
  const esquema = ['id', 'nombre', 'logo', 'favicon', 'modo', 'tipografia', 'radios', 'sombras', 'tono', 'colores'];
  for (const [primario, secundario, acento] of casos) {
    for (const tipografia of ['grotesca', 'serif', 'condensada', 'redondeada', 'geometrica', 'moderna']) {
      const m = crearMarca({nombre: 'Café Prueba Ñ', primario, secundario, acento, tipografia, logo: 'https://cdn.example.com/logo.png'});
      for (const k of esquema) assert.ok(k in m, `falta ${k}`);
      assert.equal(m.id, 'cafe-prueba-n');
      assert.equal(m.logo.imagen, 'https://cdn.example.com/logo.png');
      assert.ok(m.tipografia.fuentes.every(f => f.url.startsWith('/marcablanca/fuentes/')));
      for (const modo of ['claro', 'oscuro']) {
        const p = m.colores[modo];
        assert.ok(contraste(p.texto, p.fondo) >= 7, `${primario}/${modo}: texto`);
        assert.ok(contraste(p.primarioTexto, p.primario) >= 4.5, `${primario}/${modo}: botón principal`);
        assert.ok(contraste(p.textoSuave, p.fondo) >= 4.5, `${primario}/${modo}: texto suave`);
      }
    }
  }
  assert.equal(crearMarca({nombre: 'Sol', primario: '#FFDD00'}).modo, 'oscuro', 'un primario muy claro pide modo oscuro');
});

test('la paleta automática ignora blancos y grises y separa primario, secundario y acento', () => {
  const p = paletaDesdeColores([{hex: '#FFFFFF', peso: 900}, {hex: '#E30613', peso: 300}, {hex: '#1D1D1B', peso: 200}, {hex: '#FFD200', peso: 50}]);
  assert.deepEqual(p, {primario: '#E30613', secundario: '#1D1D1B', acento: '#FFD200'});
});

test('normalizarMarca neutraliza lo que llega de fuera (CSS, URLs y SVG ajenos)', () => {
  const m = normalizarMarca({id: '../../x', nombre: '<script>x</script>', logo: {svg: 'https://evil.example/l.svg'}, favicon: 'javascript:alert(1)',
    tipografia: {titulos: "x;}body{display:none", fuentes: [{familia: 'X', url: 'https://evil.example/f.woff2'}]}, radios: {sm: '1px;}'}, sombras: {md: 'url(https://evil)'},
    colores: {claro: {primario: 'red;}', fondo: '#fff'}}});
  assert.equal(m.logo.svg, undefined, 'un SVG ajeno nunca se incrusta');
  assert.equal(m.logo.imagen, 'https://evil.example/l.svg', 'va como <img>');
  assert.equal(m.favicon, '');
  assert.doesNotMatch(m.tipografia.titulos, /[;{}]/);
  assert.deepEqual(m.tipografia.fuentes, []);
  assert.doesNotMatch(Object.values(variablesMarca(m, 'claro')).join('|'), /[;{}]|url\(/);
  assert.match(m.colores.claro.primario, /^#[0-9A-F]{6}$/);
  assert.doesNotMatch(m.nombre, /[<>]/);
});

test('alta con prospect del catálogo: sin web obligatoria, marca guardada y tema derivado', async () => {
  const env = {PRESENTATION_IDEAS: kv(), PRESENTATION_MEDIA: r2(), PRES_SIGNING_KEY: 'k', XAI_API_KEY: 'x', ASSETS};
  const sinProspect = await put(env, {displayName: 'Sin Web', outputs: ['website']});
  assert.equal(sinProspect.status, 400, 'sin prospect la web sigue siendo obligatoria');
  const res = await put(env, {displayName: 'Lumbre Café', outputs: ['website', 'pdf'], prospect: JSON.stringify({activo: true, marca: 'lumbre'})});
  const body = await res.json();
  assert.equal(res.status, 201, JSON.stringify(body).slice(0, 300));
  assert.deepEqual(body.prospect, {activo: true, marca: 'lumbre', origen: 'catalogo', nombre: 'Lumbre Café'});
  const saved = JSON.parse(env.PRESENTATION_IDEAS.values.get('presentation:lumbre-cafe'));
  assert.equal(saved.prospect.cliente.id, 'lumbre');
  assert.equal(saved.prospect.cliente.logo.svg, '/marcablanca/logos/lumbre.svg');
  assert.equal(saved.theme.prospect, 'lumbre');
  assert.equal(saved.theme.primary, '#3b2318');
  const generation = JSON.parse(env.PRESENTATION_IDEAS.values.get('generation:lumbre-cafe'));
  assert.match(JSON.stringify(generation), /PROSPECT · MARCA DEL DESTINATARIO/, 'los entregables de terceros reciben la marca');
  const listado = await (await listClients({env})).json();
  assert.deepEqual(listado.clients[0].prospect, {activo: true, marca: 'lumbre', origen: 'catalogo', nombre: 'Lumbre Café'});
  // «Mejorar» sin tocar el campo conserva la marca; marca:'actual' también; '' la quita.
  const kept = await put(env, {displayName: 'Lumbre Café', outputs: ['website'], overwrite: true});
  assert.equal(kept.status, 201);
  assert.equal(JSON.parse(env.PRESENTATION_IDEAS.values.get('presentation:lumbre-cafe')).prospect.marca, 'lumbre');
  const actual = await put(env, {displayName: 'Lumbre Café', outputs: ['website'], overwrite: true, prospect: '{"activo":true,"marca":"actual"}'});
  assert.equal(actual.status, 201);
  assert.equal(JSON.parse(env.PRESENTATION_IDEAS.values.get('presentation:lumbre-cafe')).prospect.marca, 'lumbre');
  const desconocida = await put(env, {displayName: 'Otra', outputs: ['website'], prospect: {activo: true, marca: 'cocacola'}});
  assert.equal(desconocida.status, 400);
});

test('alta con «nueva marca»: logo subido a R2 y cliente generado con el mismo esquema', async () => {
  const media = r2();
  const env = {PRESENTATION_IDEAS: kv(), PRESENTATION_MEDIA: media, PRES_SIGNING_KEY: 'k', XAI_API_KEY: 'x', ASSETS};
  const res = await put(env, {displayName: 'Ópticas Nubia', outputs: ['website'], prospect: {activo: true, marca: 'nueva', nueva: {nombre: 'Ópticas Nubia', logoData: PNG_1PX, primario: '#5B2A86', secundario: '#F2B5D4', acento: '#00B3A4', tipografia: 'geometrica'}}});
  const body = await res.json();
  assert.equal(res.status, 201, JSON.stringify(body).slice(0, 300));
  const saved = JSON.parse(env.PRESENTATION_IDEAS.values.get('presentation:opticas-nubia'));
  assert.equal(saved.prospect.origen, 'nueva');
  assert.equal(saved.prospect.cliente.id, 'opticas-nubia');
  assert.equal(saved.prospect.cliente.logo.imagen, '/presentaciones/opticas-nubia/brand/logo');
  assert.equal(saved.brand.logoKey, 'presentations/opticas-nubia/brand/logo.png');
  assert.ok(media.objects.has('presentations/opticas-nubia/brand/logo.png'));
  assert.match(saved.prospect.cliente.tipografia.titulos, /DM Sans/);
  const sinColor = await put(env, {displayName: 'Nada', outputs: ['website'], prospect: {activo: true, marca: 'nueva', nueva: {nombre: 'Nada'}}});
  assert.equal(sinColor.status, 400, 'sin primario ni web de la que sacarlo no hay marca');
});

test('el render aplica la marca a todo y las presentaciones sin prospect no cambian', async () => {
  const env = {PRESENTATION_IDEAS: kv(), PRESENTATION_MEDIA: r2(), PRES_SIGNING_KEY: 'k', XAI_API_KEY: 'x', ASSETS};
  await put(env, {displayName: 'Lumbre Café', outputs: ['website'], prospect: {activo: true, marca: 'lumbre'}});
  const html = await deck(env, 'lumbre-cafe');
  assert.match(html, /<html[^>]+data-prospect="lumbre"/);
  assert.match(html, /--mb-primario:#3B2318/);
  assert.match(html, /@font-face\{font-family:'Fraunces'/);
  assert.match(html, /class="pc-lockup"><span class="mb-logo pc-logo"><svg class="mb-logo-svg"/, 'portada con el logo del prospect incrustado');
  assert.match(html, /data-slide-key="galaxia-prospect"/);
  for (const p of ['studio', 'store', 'app', 'yokup']) assert.match(html, new RegExp(`class="mk pm-mk" data-plataforma="${p}"`));
  assert.match(html, /lumbre\.admira\.studio\/crear/);
  assert.match(html, /data-mb-maqueta="studio"/, 'la lámina «crear» lleva su maqueta de Studio');
  assert.doesNotMatch(html, /<script[^>]*>[^<]*alert/);
  // La misma presentación con otra marca del catálogo, y de vuelta a Admira.
  const brumelle = await deck(env, 'lumbre-cafe', '?marca=brumelle');
  assert.match(brumelle, /data-prospect="brumelle"/);
  assert.match(brumelle, /--mb-primario:#D4FF3A/);
  const admira = await deck(env, 'lumbre-cafe', '?marca=admira');
  assert.doesNotMatch(admira, /data-prospect=|marcablanca\.css|galaxia-prospect/);
  // Una presentación existente (sin prospect) sale exactamente como antes.
  env.PRESENTATION_IDEAS.values.set('presentation:vieja', JSON.stringify({slug: 'vieja', displayName: 'Vieja', outputs: ['website'], languages: ['es'], theme: {primary: '#12233e', accent: '#ffb000'}}));
  env.PRESENTATION_IDEAS.values.set('ideas:vieja', JSON.stringify({hero: {title: 'Hola'}, objective: 'x', skeleton: [{id: 'crear', title: 'Crear', message: 'Admira.Studio', detail: 'd'}], closing: {title: 'c', action: 'a'}, labels: {}}));
  const vieja = await deck(env, 'vieja');
  assert.doesNotMatch(vieja, /data-prospect=|marcablanca|pm-mk|pc-lockup|galaxia-prospect/);
});

test('cada plataforma de la Galaxia sale junto a la lámina que la cuenta', () => {
  assert.equal(plataformaDeBloque({product: 'admira.studio'}), 'studio');
  assert.equal(plataformaDeBloque({product: 'admira.store'}), 'store');
  assert.equal(plataformaDeBloque({product: 'admira.app'}), 'app');
  assert.equal(plataformaDeBloque({id: 'activar'}), 'store');
  assert.equal(plataformaDeBloque({id: 'x', message: 'Yokup resuelve las incidencias'}), 'yokup');
  assert.equal(plataformaDeBloque({id: 'problema', message: 'nada'}), '');
  assert.match(pintar('yokup', normalizarMarca({nombre: 'X', colores: {claro: {primario: '#123456'}}}), {logo: '<b>X</b>'}), /<b>X<\/b>/);
  assert.equal(prospectSource(null), '');
});

test('demo pública /marcablanca/presentacion: la misma presentación con Lumbre, BRUMELLE y Frescaria', async () => {
  const env = {ASSETS};
  const titulos = {};
  for (const marca of ['lumbre', 'brumelle', 'frescaria']) {
    const res = await demoGet({request: new Request(`https://www.admiranext.com/marcablanca/presentacion?marca=${marca}`), env});
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, new RegExp(`data-prospect="${marca}"`));
    assert.match(html, /data-slide-key="galaxia-prospect"/);
    titulos[marca] = html.match(/<h1 id="coverTitle"[^>]*>([^<]+)</)[1];
  }
  assert.equal(titulos.lumbre, 'Lumbre: cada local puede aprender.');
  assert.equal(titulos.brumelle, 'BRUMELLE: cada local puede aprender.');
  const admira = await (await demoGet({request: new Request('https://www.admiranext.com/marcablanca/presentacion?marca=admira'), env})).text();
  assert.doesNotMatch(admira, /data-prospect=/);
  const form = new FormData();
  form.set('marca', JSON.stringify(crearMarca({nombre: 'Prueba <b>', primario: '#5B2A86', logo: 'javascript:alert(1)'})));
  const custom = await demoPost({request: new Request('https://www.admiranext.com/marcablanca/presentacion', {method: 'POST', body: form}), env});
  const html = await custom.text();
  assert.equal(custom.status, 200);
  assert.match(html, /data-prospect="prueba-b"/);
  assert.doesNotMatch(html, /javascript:alert|<b>'/);
});

test('el generador monta el panel Prospect y no exige la web cuando hay prospect', async () => {
  const html = await readFile(new URL('../presentaciones/generador.html', import.meta.url), 'utf8');
  const res = await generatorGet({request: new Request('https://admiranext.test/presentaciones/'), env: {ASSETS: {fetch: async () => new Response(html)}}});
  const out = await res.text();
  assert.match(out, /<script type="module" src="\/assets\/presentation-prospect\.js\?v=[^"]+"><\/script>/);
  assert.match(out, /presentation-prospect\.css/);
  const bundle = await readFile(new URL('../assets/presentation-generator-20260721-11.js', import.meta.url), 'utf8');
  assert.match(bundle, /window\.AdmiraProspect&&window\.AdmiraProspect\.activo\(\)/);
  const panel = await readFile(new URL('../assets/presentation-prospect.js', import.meta.url), 'utf8');
  assert.match(panel, /name="prospect"/);
  assert.match(panel, /Nueva marca/);
  assert.match(panel, /Extraer paleta del logo/);
  assert.doesNotMatch(panel, /identidad<\/h2>/, 'el raíl del generador busca «identidad» en los títulos: el panel no debe confundirlo');
});

test('create_presentation con marca (id de catálogo) entra en modo prospect sin web', async () => {
  const env = {PRESENTATION_IDEAS: kv(), PRESENTATION_MEDIA: r2(), PRES_SIGNING_KEY: 'k', XAI_API_KEY: 'x', ASSETS};
  const res = await put(env, {displayName: 'Lumbre Café', outputs: ['website', 'pdf'], marca: 'lumbre'});
  const body = await res.json();
  assert.equal(res.status, 201, JSON.stringify(body).slice(0, 400));
  assert.deepEqual(body.prospect, {activo: true, marca: 'lumbre', origen: 'catalogo', nombre: 'Lumbre Café'});
  assert.equal(JSON.parse(env.PRESENTATION_IDEAS.values.get('presentation:lumbre-cafe')).prospect.marca, 'lumbre');
  const lasDos = await put(env, {displayName: 'Otra', outputs: ['website'], marca: 'lumbre', prospectUrl: 'https://www.example.com'});
  assert.equal(lasDos.status, 400);
  assert.match((await lasDos.json()).error, /no las dos/);
});

test('el logo guardado nunca se ejecuta si se abre a pelo', async () => {
  const env = {PRESENTATION_IDEAS: kv(), PRESENTATION_MEDIA: {async get(){ return {body: '<svg/>', httpEtag: '"e"', writeHttpMetadata(h){ h.set('content-type', 'image/svg+xml'); }}; }}};
  env.PRESENTATION_IDEAS.values.set('presentation:x', JSON.stringify({brand: {logoKey: 'presentations/x/brand/logo.svg'}}));
  const res = await logoGet({params: {client: 'x'}, env});
  assert.match(res.headers.get('content-security-policy'), /default-src 'none'.*sandbox/);
});
