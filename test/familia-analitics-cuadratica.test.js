import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir, stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

// GUARDIÁN DE LA NAVEGACIÓN CUADRÁTICA DE /analitics Y SUS DERIVADAS (FLT-101373).
//
// Encargo de Carlos (2-oct-2026): «admiranext.com/analitics y sus derivadas no
// están respetando la navegación cuadrática. Hay que añadir los iconos a la
// izquierda de AdmiraNeXT y a la derecha de acceso privado». La barra de la
// familia es:
//
//   [☰] admiraNeXT · Proyectos · Usuarios · Webmaster · Analitics · Agentes · Presentaciones · … ● Acceso privado [▤] [⌘]
//
// La pone assets/admira-frame.js en MODO CABECERA: la página conserva su cabecera
// (<header data-yk-head>) y el armazón inserta ☰ antes de la marca y ▤ ⌘ después
// del acceso. Este test lo comprueba EJECUTANDO el armazón sobre la cabecera real
// de cada página, no buscando glifos en el HTML (los glifos los pone JavaScript).
//
// Y no depende de que alguien se acuerde de apuntar su página: una página entra en
// la familia si la puerta de login la tiene como destino, si una Function la sirve
// tras exigir sesión, si está en la navegación del grupo o si dice «Acceso
// privado». Entonces o ADOPTA la barra o figura en EXCEPCIONES con su motivo.

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const SKIP = new Set(['node_modules', '.git', 'old', 'backups', 'webmaster-shots', 'tools']);

// Páginas que adoptan la barra. acceso: lo que dice la barra —«Acceso privado» si
// sólo se sirve con sesión, «Página pública» si no; la barra no miente—.
// actual: el enlace del grupo que va marcado, si no es la propia ruta (la galería
// vive en /presentaciones/galeria pero en el grupo es «Presentaciones»).
// funcion: la Function que sirve la página; el test lee lo que ella entrega (el
// generador recibe el armazón y sus scripts por inyección), no el fichero suelto.
const ADOPTADAS = {
  'analitics/index.html': {ruta: '/analitics', acceso: 'privado'},
  'webmaster.html': {ruta: '/webmaster', acceso: 'privado'},
  'usuarios.html': {ruta: '/usuarios', acceso: 'privado'},
  'xpace/manage.html': {ruta: '/xpace/manage', acceso: 'privado'},
  'proyectos/index.html': {ruta: '/proyectos/', acceso: 'publico'},
  'flota.html': {ruta: '/flota', acceso: 'privado'}, // zona protegida desde el 06-10-2026 (functions/flota.js)
  // Carlos (3-oct-2026): «que Presentaciones lleve también la barra de la intranet».
  'presentaciones/generador.html': {ruta: '/presentaciones/', acceso: 'privado', funcion: 'functions/presentaciones/generador.js'},
  'presentaciones/index.html': {ruta: '/presentaciones/galeria', acceso: 'privado', actual: '/presentaciones/', funcion: 'functions/presentaciones/galeria.js'},
  // Carlos (3-oct-2026, con una captura de /mcp/: «no hay metaestilo en esta página»;
  // y «la barra superior tiene que ser igual en todas las páginas de un sitio»). Las
  // páginas públicas que no son de la navegación del grupo llevan la MISMA barra, sin
  // enlace marcado (actual: null) y con «○ Página pública». Lo suyo va a ☰ ▤ ⌘.
  'mcp/index.html': {ruta: '/mcp/', acceso: 'publico', actual: null},
  'mcp/generador.html': {ruta: '/mcp/generador', acceso: 'publico', actual: null},
  // Páginas de contenido en modo cabecera + automático (<body data-yk-frame="cabecera"
  // data-yk-auto="on">): ☰ el grupo y el mapa del sitio, ▤ «Ir a» sus secciones, ⌘ el CLI.
  'academia.html': {ruta: '/academia', acceso: 'publico', actual: null, auto: true},
  'consejero.html': {ruta: '/consejero', acceso: 'publico', actual: null, auto: true},
  'filosofia.html': {ruta: '/filosofia', acceso: 'publico', actual: null, auto: true},
  'mandamientos.html': {ruta: '/mandamientos', acceso: 'publico', actual: null, auto: true},
  'normativa.html': {ruta: '/normativa', acceso: 'publico', actual: null, auto: true},
  'help/index.html': {ruta: '/help/', acceso: 'publico', actual: null, auto: true},
  'informes/index.html': {ruta: '/informes/', acceso: 'publico', actual: null, auto: true},
  'informes/handon-contenidos-2026-09-14.html': {ruta: '/informes/handon-contenidos-2026-09-14', acceso: 'publico', actual: null, auto: true},
  'telegram/index.html': {ruta: '/telegram/', acceso: 'publico', actual: null, auto: true},
  'presentar.html': {ruta: '/presentar', acceso: 'publico', actual: null, auto: true},
  'consejo/index.html': {ruta: '/consejo/', acceso: 'publico', actual: null, auto: true},
  'organigrama.html': {ruta: '/organigrama', acceso: 'privado', actual: null, auto: true}, // zona protegida desde el 06-10-2026
  'roadmap.html': {ruta: '/roadmap', acceso: 'publico', actual: '/roadmap', auto: true},
  // Organigrama tecnológico (9-oct-2026): pública, para que cualquiera entienda cómo se relacionan las webs.
  'arquitectura.html': {ruta: '/arquitectura', acceso: 'publico', actual: null, auto: true},
  // Editor de demos (encargo #5466): misma cabecera pública que /arquitectura. Lo suyo va a ☰ ▤ ⌘.
  'demos/editor/index.html': {ruta: '/demos/editor/', acceso: 'publico', actual: null, auto: true},
  // Encargo 5435: la 404 ligera y el censo de clientes llevan la misma barra pública.
  '404.html': {ruta: '/404.html', acceso: 'publico', actual: null, auto: true},
  'clientes/index.html': {ruta: '/clientes/', acceso: 'publico', actual: null, auto: true}
};

// Miembros de la familia que NO llevan la barra, con su motivo. Una excepción que
// ya no se detecta (o que ya adopta la barra) también hace fallar el test.
const EXCEPCIONES = {
  'libro-de-estilo.html': 'Style Book: zona protegida desde el 06-10-2026 (destino de la puerta de login), pero es el libro de estilo con su propia maqueta editorial y no lleva la barra del grupo.',
  '/avatar-metricas': 'Panel de métricas del avatar para clientes (Starbucks): lo genera en el edge functions/avatar-metricas.js con maqueta de marca clara para enseñarlo al cliente, sin la barra interna del grupo.',
  '/github': 'Zona militarizada: el HTML lo genera en el edge functions/github.js sin ningún script; meter el armazón exige tocar esa Function y su perímetro, fuera de este encargo.',
  '/neo58/': 'Prueba en vivo de Neo (09-10-2026): la página no es del sitio, la sirve un Mac a través de functions/neo58 tras exigir sesión; es un banco de pruebas temporal a pantalla completa y no lleva la barra del grupo.',
  'pruebas/index.html': 'Zona de pruebas (10-10-2026): copia de la portada Bits and Atoms del encargo #5547, servida por functions/pruebas/_middleware.js tras exigir sesión; es la portada candidata, no una página del grupo, y debe verse igual que se vería en público.'
};

const NAV_GRUPO = ['/proyectos/', '/usuarios', '/webmaster', '/analitics', '/flota', '/organigrama', '/roadmap', '/presentaciones/', '/xpace/manage'];
const NAV_BARRA = ['/proyectos/', '/usuarios', '/webmaster', '/analitics', '/flota', '/organigrama', '/roadmap', '/presentaciones/'];
// Entradas INTERNAS (06-10-2026): el marcado de la barra sigue siendo idéntico en todas las páginas,
// pero estas llevan data-yk-interno y el visitante anónimo no las ve (admira-frame.css las esconde
// sin .admira-con-sesion y admira-frame.js las quita del DOM si /api/sello dice que no hay sesión).
const NAV_INTERNOS = ['/usuarios', '/webmaster', '/analitics', '/flota', '/organigrama', '/presentaciones/', '/xpace/manage'];
const GLIFOS = {ykOptionsToggle: '☰', ykAdvancedToggle: '▤', ykExpertToggle: '⌘'};

const leer = (rel) => readFile(path.join(ROOT, rel), 'utf8');

// Lo que el navegador recibe: el fichero, o lo que entrega la Function que lo sirve
// (con un ASSETS que lee del repo, como Pages).
async function servida(rel) {
  const {funcion} = ADOPTADAS[rel] || {};
  if (!funcion) return leer(rel);
  const {onRequestGet} = await import(new URL('../' + funcion, import.meta.url));
  const assets = {fetch: async (u) => new Response(await leer(new URL(String(u)).pathname.slice(1)))};
  const ruta = ADOPTADAS[rel].ruta;
  const respuesta = await onRequestGet({request: new Request('https://www.admiranext.com' + ruta), env: {ASSETS: assets}});
  assert.equal(respuesta.status, 200, `${funcion} sirve ${ruta}`);
  return respuesta.text();
}
const existe = (rel) => stat(path.join(ROOT, rel)).then(() => true, () => false);

async function archivos(dir, extension, out = []) {
  for (const entry of await readdir(path.join(ROOT, dir), {withFileTypes: true})) {
    if (entry.name.startsWith('.') || SKIP.has(entry.name)) continue;
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) await archivos(rel, extension, out);
    else if (entry.name.endsWith(extension)) out.push(rel);
  }
  return out;
}

async function ficheroDeRuta(ruta) {
  const limpia = ruta.replace(/^\//, '').replace(/\/$/, '');
  for (const candidato of [limpia + '.html', limpia + '/index.html']) if (await existe(candidato)) return candidato;
  return null;
}

// ── La familia, descubierta ─────────────────────────────────────────────────
async function familia() {
  const miembros = new Map();   // clave (fichero o ruta sin fichero) → por qué es de la familia
  const apuntar = async (ruta, motivo) => {
    const fichero = await ficheroDeRuta(ruta);
    const clave = fichero || ruta;
    if (!miembros.has(clave)) miembros.set(clave, motivo);
  };
  // 1) Destinos de la puerta de login.
  const puerta = await leer('functions/_webmaster-gate.js');
  const linea = puerta.split('\n').find((l) => l.includes('safeConnection(path)') && l.includes("path === '/"));
  assert.ok(linea, 'la lista de destinos de la puerta de login sigue en _webmaster-gate.js');
  for (const [, ruta] of linea.matchAll(/path === '([^']+)'/g)) await apuntar(ruta, 'destino de la puerta de login');
  // 2) Functions que sirven el HTML estático tras exigir sesión (no las APIs).
  for (const rel of await archivos('functions', '.js')) {
    // (/version.json y /novedades.json sirven datos, no una página: 06-10-2026)
    if (rel.startsWith('functions/api/') || /\.json\.js$/.test(rel) || path.basename(rel).startsWith('_') && !rel.endsWith('_middleware.js')) continue;
    const fuente = await leer(rel);
    if (!/exigirRol|sesionCompleta/.test(fuente) || !/next\(\)/.test(fuente)) continue;
    const ruta = '/' + rel.replace(/^functions\//, '').replace(/\/?_middleware\.js$/, '').replace(/\.js$/, '');
    if (/logout$/.test(ruta)) continue;
    await apuntar(ruta, 'servida por ' + rel + ' tras exigir sesión');
  }
  // 2b) La puerta propia de /presentaciones/ (functions/presentaciones/_middleware.js):
  //     el generador y la galería son área interna, sólo con sesión. Las Functions que
  //     las sirven leen su HTML de ASSETS.
  const puertaPres = await leer('functions/presentaciones/_middleware.js');
  const interna = puertaPres.match(/const isInternalArea = ([^;]+);/);
  assert.ok(interna && /\bisGeneratorPage\b/.test(interna[1]) && /\bisGalleryPage\b/.test(interna[1]), 'la puerta de /presentaciones/ sigue tratando el generador y la galería como área interna');
  for (const rel of await archivos('functions/presentaciones', '.js')) {
    if (path.basename(rel).startsWith('_') || path.dirname(rel) !== 'functions/presentaciones') continue;
    const html = (await leer(rel)).match(/new URL\('\/(presentaciones\/[^']+\.html)'/);
    if (html && !miembros.has(html[1])) miembros.set(html[1], 'servida por ' + rel + ' tras exigir sesión (puerta de functions/presentaciones/_middleware.js)');
  }
  // 3) La navegación del grupo.
  for (const ruta of NAV_GRUPO) await apuntar(ruta, 'navegación del grupo');
  // 4) Cualquier página que diga «Acceso privado» o declare la cabecera del grupo.
  for (const rel of await archivos('.', '.html')) {
    const fuente = await leer(rel);
    if (/Acceso privado|data-yk-head|data-yk-frame="cabecera"/.test(fuente) && !miembros.has(rel)) miembros.set(rel, 'dice «Acceso privado» o declara la cabecera del grupo');
  }
  return miembros;
}

test('toda página de la familia adopta la barra o es una excepción con motivo', async () => {
  const miembros = await familia();
  const sinBarra = [...miembros].filter(([clave]) => !ADOPTADAS[clave] && !EXCEPCIONES[clave])
    .map(([clave, motivo]) => `${clave} (${motivo})`);
  assert.deepEqual(sinBarra, [], 'una página nueva de la familia de /analitics tiene que llevar la barra cuadrática (o ir a EXCEPCIONES con su motivo)');
  for (const clave of [...Object.keys(ADOPTADAS), ...Object.keys(EXCEPCIONES)]) {
    assert.ok(miembros.has(clave), `${clave} figura en el guardián pero ya no es de la familia: quítala de la lista`);
  }
  for (const [clave, motivo] of Object.entries(EXCEPCIONES)) {
    assert.ok(motivo.length > 40, `la excepción ${clave} explica su motivo`);
    if (clave.endsWith('.html')) assert.doesNotMatch(await leer(clave), /data-yk-frame="cabecera"/, `${clave} ya adopta la barra: sácala de EXCEPCIONES`);
  }
});

// ── Lectura estática de cada página adoptada ────────────────────────────────
function cabeceraDe(html) {
  const inicio = html.search(/<header\b[^>]*\bdata-yk-head\b/);
  assert.ok(inicio >= 0, 'falta <header data-yk-head>');
  return html.slice(inicio, html.indexOf('</header>', inicio) + '</header>'.length);
}

for (const [rel, {ruta, acceso, actual}] of Object.entries(ADOPTADAS)) {
  test(`${rel}: carga el armazón y declara la cabecera del grupo`, async () => {
    const html = await servida(rel);
    const css = html.match(/<link[^>]+href="\/assets\/admira-frame\.css\?v=([^"]+)"/);
    const js = html.match(/<script([^>]*)\bsrc="\/assets\/admira-frame\.js\?v=([^"]+)"([^>]*)>/);
    assert.ok(css && js, 'carga /assets/admira-frame.css y /assets/admira-frame.js');
    assert.equal(css[1], js[2], 'el css y el js del armazón van con la misma clave de caché');
    assert.match(js[1] + js[3], /\bdefer\b/, 'el armazón se monta con defer, con el DOM ya leído');
    assert.ok(html.indexOf(css[0]) > html.lastIndexOf('</style>') || html.lastIndexOf('</style>') > html.indexOf('<body'), 'el css del armazón va después de los estilos de la página');
    assert.ok(html.indexOf(css[0]) < html.search(/<body\b/), 'el css del armazón va en el <head>');
    assert.match(html, /<body\b[^>]*\bdata-yk-frame="cabecera"/, '<body data-yk-frame="cabecera">');
    assert.equal((html.match(/\bdata-yk-head\b/g) || []).length, 1, 'una sola cabecera del grupo');
    const tras = html.slice(html.search(/<body\b/)).replace(/^<body\b[^>]*>\s*/, '');
    assert.match(tras, /^<header\b[^>]*\bdata-yk-head\b/, 'la cabecera es lo primero del <body>');

    const cab = cabeceraDe(html);
    const piezas = [...cab.matchAll(/<(a class="brand"|nav\b|span[^>]*data-yk-access)/g)].map((m) => m[1].split(/[\s>]/)[0]);
    assert.deepEqual(piezas, ['a', 'nav', 'span'], 'dentro: marca, navegación y acceso, en ese orden');
    assert.match(cab, /<a class="brand" href="\/"/, 'la marca lleva a la home');
    // (los pies pueden enlazarla, como en el modo automático: test/admira-frame-sitio.test.js)
    const sinPies = html.replace(/<footer[\s\S]*?<\/footer>/g, '');
    assert.equal((sinPies.match(/href="\/"/g) || []).length, 1, 'la marca es el ÚNICO enlace a la home');
    assert.doesNotMatch(sinPies, /<a[^>]*href="(https:\/\/www\.admiranext\.com\/?|\.\.\/)"[^>]*>\s*←\s*admiranext\.com/i, 'sin un «← admiranext.com» que duplique la marca');
    const hrefs = [...cab.matchAll(/<a\b[^>]*href="([^"]+)"/g)].map((m) => m[1]).slice(1);
    assert.deepEqual(hrefs, NAV_GRUPO, 'la navegación del grupo es la misma en todas las páginas');
    const enBarra = [...cab.matchAll(/<a\b([^>]*)href="([^"]+)"([^>]*)>/g)].slice(1).filter((m) => !/data-yk-rail-only/.test(m[1] + m[3])).map((m) => m[2]);
    assert.deepEqual(enBarra, NAV_BARRA, 'en la barra quedan Proyectos · Usuarios · Webmaster · Analitics · Agentes · Organigrama · RoadMap · Presentaciones; el resto, en ☰');
    const internos = [...cab.matchAll(/<a\b([^>]*)href="([^"]+)"([^>]*)>/g)].slice(1).filter((m) => /\bdata-yk-interno\b/.test(m[1] + m[3])).map((m) => m[2]);
    assert.deepEqual(internos, NAV_INTERNOS, 'las entradas internas van marcadas igual en todas las páginas (data-yk-interno): sin sesión no se ven');
    if (actual === null) {
      // Página fuera de la navegación del grupo: la barra es la misma, sin nada marcado.
      assert.equal((cab.match(/aria-current="page"/g) || []).length, 0, 'ninguna página del grupo marcada: ésta no es del grupo');
    } else {
      assert.match(cab, new RegExp(`href="${(actual || ruta).replace(/[/]/g, '\\/')}"[^>]*aria-current="page"`), 'la página actual va marcada');
      assert.equal((cab.match(/aria-current="page"/g) || []).length, 1, 'una sola página marcada en la barra');
    }
    const etiqueta = acceso === 'privado' ? 'Acceso privado' : 'Página pública';
    assert.match(cab, new RegExp(`data-yk-access="${acceso}"[^>]*>[^<]*<span class="yk-access-txt"> ${etiqueta}</span>`), `la barra dice «${etiqueta}»`);
  });
}

test('lo que la barra dice del acceso es verdad: privada solo si la sirve una puerta', async () => {
  const miembros = await familia();
  for (const [rel, {acceso}] of Object.entries(ADOPTADAS)) {
    const motivo = miembros.get(rel) || '';
    const tienePuerta = /puerta de login|tras exigir sesión/.test(motivo);
    assert.equal(acceso === 'privado', tienePuerta, `${rel}: «${acceso}» pero ${tienePuerta ? 'sólo se sirve con sesión' : 'se sirve sin sesión'}`);
  }
});

// ── El armazón, ejecutado sobre la cabecera real ────────────────────────────
class Nodo {
  constructor(tag, atributos = {}) {
    this.tagName = tag.toUpperCase();
    this.hijos = [];
    this.padre = null;
    this.atributos = {...atributos};
    this.oyentes = {};
    this.texto = '';
    this.innerHTML = '';
    this.style = {setProperty() {}};
  }
  get id() { return this.atributos.id || ''; }
  set id(v) { this.atributos.id = String(v); }
  get hidden() { return 'hidden' in this.atributos; }
  set hidden(v) { if (v) this.atributos.hidden = ''; else delete this.atributos.hidden; }
  get dataset() {
    const salida = {};
    for (const [k, v] of Object.entries(this.atributos)) if (k.startsWith('data-')) salida[k.slice(5).replace(/-([a-z])/g, (_, l) => l.toUpperCase())] = v;
    return salida;
  }
  get className() { return this.atributos.class || ''; }
  set className(v) { this.atributos.class = String(v); }
  get classList() {
    const nodo = this;
    const lista = () => new Set(nodo.className.split(/\s+/).filter(Boolean));
    return {
      add: (...n) => { const l = lista(); n.forEach((x) => l.add(x)); nodo.className = [...l].join(' '); },
      remove: (...n) => { const l = lista(); n.forEach((x) => l.delete(x)); nodo.className = [...l].join(' '); },
      contains: (n) => lista().has(n),
      toggle: (n, f) => { const l = lista(); const on = f === undefined ? !l.has(n) : !!f; if (on) l.add(n); else l.delete(n); nodo.className = [...l].join(' '); return on; }
    };
  }
  get textContent() { return this.texto + this.hijos.map((h) => h.textContent).join(''); }
  set textContent(v) { this.texto = String(v); this.hijos = []; }
  get children() { return this.hijos; }
  get firstChild() { return this.hijos[0] || null; }
  get parentNode() { return this.padre; }
  get nextSibling() { return this.padre ? this.padre.hijos[this.padre.hijos.indexOf(this) + 1] || null : null; }
  setAttribute(k, v) { this.atributos[k] = String(v); }
  getAttribute(k) { return k in this.atributos ? this.atributos[k] : null; }
  removeAttribute(k) { delete this.atributos[k]; }
  appendChild(n) { n.remove(); n.padre = this; this.hijos.push(n); return n; }
  insertBefore(n, ref) {
    n.remove(); n.padre = this;
    const i = ref ? this.hijos.indexOf(ref) : -1;
    if (i < 0) this.hijos.push(n); else this.hijos.splice(i, 0, n);
    return n;
  }
  remove() { if (this.padre) { this.padre.hijos = this.padre.hijos.filter((h) => h !== this); this.padre = null; } }
  cloneNode() {
    const c = new Nodo(this.tagName, this.atributos);
    c.texto = this.texto;
    this.hijos.forEach((h) => c.appendChild(h.cloneNode(true)));
    return c;
  }
  addEventListener(tipo, f) { (this.oyentes[tipo] ||= []).push(f); }
  contains(n) { for (let x = n; x; x = x.padre) if (x === this) return true; return false; }
  closest() { return null; }
  descendientes(out = []) { for (const h of this.hijos) { out.push(h); h.descendientes(out); } return out; }
  coincide(sel) {
    const m = sel.match(/^(\w+)?(?:\[([\w-]+)(?:="([^"]*)")?\])?$/);
    if (!m) throw new Error('selector no contemplado por el DOM de prueba: ' + sel);
    const [, tag, attr, valor] = m;
    if (tag && this.tagName !== tag.toUpperCase()) return false;
    if (attr && !(attr in this.atributos)) return false;
    if (attr && valor !== undefined && this.atributos[attr] !== valor) return false;
    return true;
  }
  querySelectorAll(selector) {
    const partes = selector.trim().split(/\s+/);
    let base = this.descendientes().filter((n) => n.coincide(partes[0]));
    for (const parte of partes.slice(1)) base = [...new Set(base.flatMap((n) => n.descendientes().filter((d) => d.coincide(parte))))];
    return base;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
}

// Un parser mínimo: basta para la cabecera (sin elementos vacíos ni comentarios).
function parsear(fragmento) {
  const raiz = new Nodo('#fragment');
  let actual = raiz;
  for (const [, cierre, tag, attrs, texto] of fragmento.matchAll(/<(\/?)(\w+)([^>]*)>|([^<]+)/g)) {
    if (texto !== undefined) { actual.appendChild(Object.assign(new Nodo('#text'), {texto})); continue; }
    if (cierre) { actual = actual.padre || raiz; continue; }
    const atributos = {};
    for (const [, k, v] of attrs.matchAll(/([\w-]+)(?:="([^"]*)")?/g)) atributos[k] = v ?? '';
    actual = actual.appendChild(new Nodo(tag, atributos));
  }
  return raiz.hijos.filter((n) => n.tagName !== '#TEXT');
}

async function montar(rel) {
  const {ruta} = ADOPTADAS[rel];
  const html = await servida(rel);
  const raiz = new Nodo('html');
  // El <body> con sus atributos reales (data-yk-frame, data-yk-auto…).
  const atributosBody = {};
  for (const [, k, v] of (html.match(/<body\b([^>]*)>/) || ['', ''])[1].matchAll(/([\w-]+)(?:="([^"]*)")?/g)) atributosBody[k] = v ?? '';
  const cuerpo = raiz.appendChild(new Nodo('body', atributosBody));
  const cabeza = new Nodo('head');
  const sello = html.match(/<meta name="admiranext-version" content="([^"]*)"/);
  if (sello) cabeza.appendChild(new Nodo('meta', {name: 'admiranext-version', content: sello[1]}));
  raiz.insertBefore(cabeza, cuerpo);
  for (const n of parsear(cabeceraDe(html))) cuerpo.appendChild(n);
  // Los bloques que la página manda a los paneles (vacíos: aquí importa adónde van).
  for (const [, tag, attrs] of html.matchAll(/<(\w+)\b([^>]*\bdata-yk-slot="[^"]+"[^>]*)>/g)) {
    const atributos = {};
    for (const [, k, v] of attrs.matchAll(/([\w-]+)(?:="([^"]*)")?/g)) atributos[k] = v ?? '';
    cuerpo.appendChild(new Nodo(tag, atributos));
  }
  const oyentes = {};
  const documento = {
    documentElement: raiz, body: cuerpo, title: rel,
    createElement: (t) => new Nodo(t),
    getElementById: (id) => raiz.descendientes().find((n) => n.id === id) || new Nodo('div', {id}),
    querySelector: (s) => raiz.querySelector(s),
    querySelectorAll: (s) => raiz.querySelectorAll(s),
    addEventListener: (t, f) => { (oyentes[t] ||= []).push(f); }
  };
  const contexto = vm.createContext({document: documento, location: {pathname: ruta}, Event: class {}, navigator: {}, console});
  contexto.window = contexto;
  // Los verbos de la página se declaran ANTES del armazón: en línea (corren antes
  // que los defer) o en un script defer que va antes que admira-frame.js.
  const posArmazon = html.search(/<script[^>]+admira-frame\.js/);
  for (const [bloque, src, cuerpoScript] of [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)].map((m) => [m[0], m[1].match(/src="([^"?]+)/)?.[1], m[2]])) {
    // Los scripts de la propia web se leen del repo (analitics/expert.js, el del generador…).
    if (src === '/assets/admira-frame.js') continue;
    const codigo = src ? (src.startsWith('/') && await existe(src.slice(1)) ? await leer(src.slice(1)) : '') : cuerpoScript;
    if (!/ADMIRA_FRAME_VERBS/.test(codigo)) continue;
    if (src) assert.ok(html.indexOf(bloque) < posArmazon, `${src} va antes que el armazón`);
    vm.runInContext(codigo, contexto);
  }
  vm.runInContext(await leer('assets/admira-frame.js'), contexto);
  return {raiz, cuerpo, contexto, html};
}

const resumen = (n) => n.tagName === 'BUTTON' ? GLIFOS[n.id] || n.id : n.tagName === 'A' ? 'marca' : n.tagName === 'NAV' ? 'nav' : n.getAttribute('data-yk-access') !== null ? 'acceso' : n.classList.contains('yk-meta') ? n.hijos.map(resumen).join('') : n.tagName;

for (const rel of Object.keys(ADOPTADAS)) {
  test(`${rel}: el armazón pone ☰ antes de la marca y ▤ ⌘ después del acceso`, async () => {
    const {raiz, contexto, cuerpo} = await montar(rel);
    // El fondo común (puntos que se iluminan con el ratón, 3-oct-2026): el armazón lo
    // pone como primera capa del <body>, detrás de todo.
    const puntos = cuerpo.hijos[0];
    assert.ok(puntos && puntos.classList.contains('yk-dots'), 'el armazón pone el fondo común .yk-dots');
    assert.equal(puntos.getAttribute('aria-hidden'), 'true');
    for (const capa of ['yk-dots-base', 'yk-dots-idle', 'yk-dots-halo']) assert.match(puntos.innerHTML, new RegExp(`class="${capa}"`));
    const cab = raiz.querySelector('[data-yk-head]');
    assert.deepEqual(cab.hijos.filter((n) => n.tagName !== '#TEXT').map(resumen), ['☰', 'marca', 'nav', 'acceso', '▤⌘'],
      '[☰] admiraNeXT · nav · … ● Acceso privado [▤] [⌘]');
    for (const [id, cajon] of [['ykOptionsToggle', 'ykOptionsRail'], ['ykAdvancedToggle', 'ykAdvancedRail'], ['ykExpertToggle', 'ykExpertRail']]) {
      const boton = raiz.descendientes().find((n) => n.id === id);
      assert.equal(boton.getAttribute('aria-controls'), cajon);
      assert.equal(boton.getAttribute('aria-expanded'), 'false', 'nace plegado');
      assert.ok(raiz.descendientes().find((n) => n.id === cajon), `existe #${cajon}`);
    }
    // ☰ repite la navegación del grupo (en móvil es la única).
    const rail = raiz.descendientes().find((n) => n.id === 'ykOptionsRail');
    assert.deepEqual(rail.querySelectorAll('a').filter((a) => a.classList.contains('yk-rail-navlink')).map((a) => a.getAttribute('href')), NAV_GRUPO);
    // ▤ no está vacío: cada página manda algo a Avanzado.
    assert.ok(raiz.descendientes().find((n) => n.id === 'ykAdvancedRail').hijos.some((n) => n.classList.contains('yk-slot')), '▤ Avanzado tiene contenido de la página');
    // ⌘: el CLI y su /help, generado del registro, con verbos de la página.
    contexto.AdmiraFrame.ejecutar('/help');
    const salida = raiz.descendientes().find((n) => n.classList.contains('yk-cli-out'));
    const verbos = salida.hijos.map((l) => l.textContent).filter((t) => /^\/\w/.test(t)).map((t) => t.split(/\s/)[0]);
    for (const comun of ['/help', '/limpiar', '/ir']) assert.ok(verbos.includes(comun), `/help lista ${comun}`);
    assert.ok(verbos.length >= 5, `${rel} declara verbos propios (hay ${verbos.join(' ')})`);
  });
}

test('/analitics: el Experto trae los verbos del encargo y ▤ los filtros que no son de diario', async () => {
  const {raiz, contexto, html} = await montar('analitics/index.html');
  contexto.AdmiraFrame.ejecutar('/help');
  const lineas = raiz.descendientes().find((n) => n.classList.contains('yk-cli-out')).hijos.map((l) => l.textContent);
  for (const v of ['/periodo', '/site', '/ahora', '/refrescar', '/json', '/audiencia', '/globo', '/buscar', '/estado']) {
    assert.ok(lineas.some((l) => l.startsWith(v + ' ')), `/help lista ${v}`);
  }
  // Los filtros rápidos (sitio, periodo, actualizar) se quedan arriba; Carbono/Silicio
  // pasa a ▤ y arriba queda una pastilla que dice qué se mira y abre ▤.
  const filtros = html.slice(html.indexOf('<div class="filters">'), html.indexOf('<p id="message"'));
  for (const id of ['site', 'refresh', 'audienceChip']) assert.match(filtros, new RegExp(`id="${id}"`));
  assert.match(filtros, /data-days="-1"/);
  assert.doesNotMatch(filtros, /id="carbono"/);
  const avanzado = html.slice(html.indexOf('data-yk-label="Tipo de visitante"'));
  assert.match(avanzado, /id="carbono"[\s\S]*id="silicio"/, 'Carbono y Silicio viven en ▤ Avanzado, con sus mismos ids');
  assert.match(html, /id="audienceChip"[^>]*data-yk-toggle="right"/, 'la pastilla abre ▤ sin que el clic fuera lo cierre');
});

// ── Presentaciones, con la barra de la intranet (Carlos, 3-oct-2026) ─────────
// «La coherencia: la barra superior tiene que ser igual en todas las páginas de un
// sitio». El generador y la galería traían otra barra (modo barra: rótulo
// «GENERADOR», pestañas propias y sin «Acceso privado»). Ahora su cabecera es,
// carácter a carácter, la de la familia; sólo cambia qué enlace va marcado.
test('Presentaciones lleva la MISMA cabecera que el resto de la intranet', async () => {
  const sinMarca = (cab) => cab.replace(/\s+aria-current="page"/g, '');
  const modelo = sinMarca(cabeceraDe(await leer('analitics/index.html')));   // privada, como las dos
  for (const rel of ['presentaciones/generador.html', 'presentaciones/index.html']) {
    const cab = cabeceraDe(await servida(rel));
    assert.equal(sinMarca(cab), modelo, `${rel}: la cabecera es la de /analitics (salvo el enlace marcado)`);
    assert.match(cab, /<a href="\/presentaciones\/" aria-current="page"( data-yk-interno)?>Presentaciones<\/a>/, `${rel}: marca Presentaciones`);
    assert.doesNotMatch(cab, /GENERADOR|data-yk-slot|yk-page/, `${rel}: sin rótulo ni pestañas propias en la barra`);
  }
  // Y la de /proyectos/ es la misma salvo el acceso: aquella es pública y lo dice.
  const acceso = /<span class="private"[^>]*>[^<]*<span class="yk-access-txt">[^<]*<\/span><\/span>/;
  assert.equal(sinMarca(cabeceraDe(await leer('proyectos/index.html'))).replace(acceso, ''), modelo.replace(acceso, ''));
});

for (const [rel, propios, enlaces] of [
  ['presentaciones/generador.html', ['/validar', '/config', '/estado', '/seccion', '/galeria', '/accesos'], ['/presentaciones/', '/presentaciones/galeria', '/presentaciones/control/', '/marcablanca/', '/mcp/generador']],
  ['presentaciones/index.html', ['/buscar', '/vista', '/fecha', '/pestana', '/generador', '/accesos'], ['/presentaciones/', '/presentaciones/galeria', '/presentaciones/control/']]
]) {
  test(`${rel}: lo propio de Presentaciones sigue en ☰ ▤ ⌘`, async () => {
    const {raiz, contexto, html} = await montar(rel);
    // ☰: la navegación del grupo y, debajo, el bloque «Presentaciones» con sus páginas.
    const rail = raiz.descendientes().find((n) => n.id === 'ykOptionsRail');
    const rotulos = rail.hijos.filter((n) => n.classList.contains('yk-rail-sub')).map((n) => n.textContent);
    assert.deepEqual(rotulos.slice(0, 2), ['Navegación del grupo', 'Presentaciones'], '☰: el grupo y, debajo, las páginas de Presentaciones');
    const bloque = html.match(/<nav data-yk-slot="left" data-yk-label="Presentaciones"[^>]*>([\s\S]*?)<\/nav>/);
    assert.ok(bloque, 'el bloque «Presentaciones» va a ☰');
    assert.deepEqual([...bloque[1].matchAll(/href="([^"]+)"/g)].map((m) => m[1]), enlaces);
    // ⌘: sus verbos, en el /help del CLI del armazón.
    contexto.AdmiraFrame.ejecutar('/help');
    const lineas = raiz.descendientes().find((n) => n.classList.contains('yk-cli-out')).hijos.map((l) => l.textContent);
    for (const v of propios) assert.ok(lineas.some((l) => l.startsWith(v + ' ')), `/help lista ${v}`);
  });
}

// ── Una sola barra en todo el sitio (Carlos, 3-oct-2026) ─────────────────────
// «La barra superior tiene que ser igual en todas las páginas de un sitio.» Cada
// página adoptada lleva, carácter a carácter, la cabecera de /proyectos/: sólo
// cambian el enlace marcado y la etiqueta de acceso («● Acceso privado» u «○ Página
// pública»). Lo propio de cada página va a ☰ ▤ ⌘, nunca a la barra.
test('todas las páginas adoptadas llevan la MISMA barra que /proyectos/', async () => {
  // Fuera del texto: el enlace marcado y el estado que pone la sesión en /webmaster
  // (sus enlaces de administración nacen con hidden y uno lleva id para mostrarlo).
  const sinMarca = (cab) => cab.replace(/\s+aria-current="page"/g, '').replace(/(<a\b[^>]*?)\s+(?:hidden|id="[^"]*")(?=[\s>])/g, '$1').replace(/(<a\b[^>]*?)\s+(?:hidden|id="[^"]*")(?=[\s>])/g, '$1');
  const acceso = /<span class="private"[^>]*>[^<]*<span class="yk-access-txt">[^<]*<\/span><\/span>/;
  const modelo = sinMarca(cabeceraDe(await leer('proyectos/index.html'))).replace(acceso, '');
  for (const rel of Object.keys(ADOPTADAS)) {
    const cab = cabeceraDe(await servida(rel));
    assert.equal(sinMarca(cab).replace(acceso, ''), modelo, `${rel}: la barra es la de /proyectos/ (salvo enlace marcado y acceso)`);
    assert.doesNotMatch(cab, /data-yk-slot|yk-page|data-yk-title/, `${rel}: sin rótulo ni pestañas propias en la barra`);
    const html = await servida(rel);
    assert.doesNotMatch(html.match(/<body\b[^>]*>/)[0], /data-yk-title=/, `${rel}: sin el rótulo del modo barra`);
    assert.doesNotMatch(html.match(/<html\b[^>]*>/)[0], /yk-framed/, `${rel}: sin la clase del modo barra`);
  }
});

// /mcp/ y /mcp/generador: sus antiguas pestañas (Hub MCP, Generador) y su navegación
// van a ☰ en el bloque «MCP», bajo la navegación del grupo; ▤ trae «Ir a» (y en el
// generador «Conectar»); ⌘ conserva sus verbos.
for (const [rel, propios, derecha] of [
  ['mcp/index.html', ['/seccion', '/generador', '/manifest', '/llms'], ['Ir a', 'Para agentes']],
  ['mcp/generador.html', ['/seccion', '/tools', '/copiar', '/endpoint', '/manifest'], ['Conectar', 'Ir a']]
]) {
  test(`${rel}: lo propio del MCP va a ☰ ▤ ⌘ y la barra es la del sitio`, async () => {
    const {raiz, contexto, html} = await montar(rel);
    const rail = raiz.descendientes().find((n) => n.id === 'ykOptionsRail');
    const rotulos = rail.hijos.filter((n) => n.classList.contains('yk-rail-sub')).map((n) => n.textContent);
    assert.deepEqual(rotulos.slice(0, 2), ['Navegación del grupo', 'MCP'], '☰: el grupo y, debajo, el bloque «MCP»');
    const bloque = html.match(/<nav data-yk-slot="left" data-yk-label="MCP"[^>]*>([\s\S]*?)<\/nav>/);
    assert.ok(bloque, 'el bloque «MCP» va a ☰');
    const enlaces = [...bloque[1].matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    for (const h of ['/mcp/', '/mcp/generador', '/mcp/manifest.json']) assert.ok(enlaces.includes(h), `☰ «MCP» lleva ${h}`);
    assert.equal((bloque[1].match(/aria-current="page"/g) || []).length, 1, 'la página actual va marcada en su bloque');
    const der = raiz.descendientes().find((n) => n.id === 'ykAdvancedRail');
    assert.deepEqual(der.hijos.filter((n) => n.classList.contains('yk-rail-sub')).map((n) => n.textContent), derecha, '▤ Avanzado');
    contexto.AdmiraFrame.ejecutar('/help');
    const lineas = raiz.descendientes().find((n) => n.classList.contains('yk-cli-out')).hijos.map((l) => l.textContent);
    for (const v of propios) assert.ok(lineas.some((l) => l.startsWith(v + ' ')), `/help lista ${v}`);
  });
}

// Las páginas de contenido (modo cabecera + automático): ☰ el grupo y después el mapa
// del sitio sin repetir el grupo; ▤ «Ir a»; ⌘ /ir (grupo + sitio), /seccion y /arriba.
for (const rel of Object.keys(ADOPTADAS).filter((r) => ADOPTADAS[r].auto)) {
  test(`${rel}: modo automático con la barra del sitio`, async () => {
    const {raiz, contexto, html} = await montar(rel);
    assert.match(html, /<body data-yk-frame="cabecera" data-yk-auto="on"/);
    const rail = raiz.descendientes().find((n) => n.id === 'ykOptionsRail');
    assert.equal(rail.hijos.filter((n) => n.classList.contains('yk-rail-sub'))[0].textContent, 'Navegación del grupo', '☰ empieza por el grupo');
    const sitio = rail.descendientes().filter((n) => n.classList.contains('yk-auto-hd')).map((n) => n.textContent);
    for (const g of ['La casa', 'Operación', 'Estudio']) assert.ok(sitio.includes(g), `☰ lleva el mapa del sitio («${g}»)`);
    const enlacesSitio = rail.descendientes().filter((n) => n.classList.contains('yk-auto-act') && n.href).map((n) => n.href);
    for (const g of ['/proyectos/', '/flota']) assert.ok(!enlacesSitio.includes(g), `el mapa no repite ${g}, que ya está en el grupo`);
    const der = raiz.descendientes().find((n) => n.id === 'ykAdvancedRail');
    assert.ok(der.descendientes().some((n) => n.classList.contains('yk-auto-hd') && n.textContent === 'Ir a'), '▤ trae «Ir a»');
    contexto.AdmiraFrame.ejecutar('/help');
    const lineas = raiz.descendientes().find((n) => n.classList.contains('yk-cli-out')).hijos.map((l) => l.textContent);
    for (const v of ['/ir', '/seccion', '/arriba']) assert.ok(lineas.some((l) => l.startsWith(v + ' ')), `/help lista ${v}`);
    assert.ok(lineas.find((l) => l.startsWith('/ir ')).includes('webmaster'), '/ir abre también las páginas del grupo');
  });
}
