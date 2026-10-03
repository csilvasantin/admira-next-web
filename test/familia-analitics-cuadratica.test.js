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
const ADOPTADAS = {
  'analitics/index.html': {ruta: '/analitics', acceso: 'privado'},
  'webmaster.html': {ruta: '/webmaster', acceso: 'privado'},
  'usuarios.html': {ruta: '/usuarios', acceso: 'privado'},
  'xpace/manage.html': {ruta: '/xpace/manage', acceso: 'privado'},
  'proyectos/index.html': {ruta: '/proyectos/', acceso: 'publico'},
  'flota.html': {ruta: '/flota', acceso: 'publico'}
};

// Miembros de la familia que NO llevan la barra, con su motivo. Una excepción que
// ya no se detecta (o que ya adopta la barra) también hace fallar el test.
const EXCEPCIONES = {
  'presentaciones/index.html': 'Galería del generador de presentaciones: ya lleva el armazón cuadrático en MODO BARRA (☰ ▤ ⌘, assets/admira-frame.js con data-yk-*), con su propia navegación y su puerta de acceso; se enlaza desde la barra de la intranet (Carlos, 3-oct-2026) pero no se le cambia la cabecera.',
  '/github': 'Zona militarizada: el HTML lo genera en el edge functions/github.js sin ningún script; meter el armazón exige tocar esa Function y su perímetro, fuera de este encargo.',
  'presentaciones/generador.html': 'Generador de presentaciones: adopta el armazón en MODO BARRA (el de /presentaciones/galeria), que le monta la Function del generador con assets/presentation-generator-quadratic.js; «Acceso privado» es un bloque de su formulario, no la cabecera del grupo.'
};

const NAV_GRUPO = ['/proyectos/', '/usuarios', '/webmaster', '/analitics', '/flota', '/presentaciones/', '/xpace/manage'];
const NAV_BARRA = ['/proyectos/', '/usuarios', '/webmaster', '/analitics', '/flota', '/presentaciones/'];
const GLIFOS = {ykOptionsToggle: '☰', ykAdvancedToggle: '▤', ykExpertToggle: '⌘'};

const leer = (rel) => readFile(path.join(ROOT, rel), 'utf8');
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
    if (rel.startsWith('functions/api/') || path.basename(rel).startsWith('_') && !rel.endsWith('_middleware.js')) continue;
    const fuente = await leer(rel);
    if (!/exigirRol|sesionCompleta/.test(fuente) || !/next\(\)/.test(fuente)) continue;
    const ruta = '/' + rel.replace(/^functions\//, '').replace(/\/?_middleware\.js$/, '').replace(/\.js$/, '');
    if (/logout$/.test(ruta)) continue;
    await apuntar(ruta, 'servida por ' + rel + ' tras exigir sesión');
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

for (const [rel, {ruta, acceso}] of Object.entries(ADOPTADAS)) {
  test(`${rel}: carga el armazón y declara la cabecera del grupo`, async () => {
    const html = await leer(rel);
    const css = html.match(/<link[^>]+href="\/assets\/admira-frame\.css\?v=([^"]+)"/);
    const js = html.match(/<script([^>]*)\bsrc="\/assets\/admira-frame\.js\?v=([^"]+)"/);
    assert.ok(css && js, 'carga /assets/admira-frame.css y /assets/admira-frame.js');
    assert.equal(css[1], js[2], 'el css y el js del armazón van con la misma clave de caché');
    assert.match(js[1], /\bdefer\b/, 'el armazón se monta con defer, con el DOM ya leído');
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
    assert.equal((html.match(/href="\/"/g) || []).length, 1, 'la marca es el ÚNICO enlace a la home');
    const hrefs = [...cab.matchAll(/<a\b[^>]*href="([^"]+)"/g)].map((m) => m[1]).slice(1);
    assert.deepEqual(hrefs, NAV_GRUPO, 'la navegación del grupo es la misma en todas las páginas');
    const enBarra = [...cab.matchAll(/<a\b([^>]*)href="([^"]+)"([^>]*)>/g)].slice(1).filter((m) => !/data-yk-rail-only/.test(m[1] + m[3])).map((m) => m[2]);
    assert.deepEqual(enBarra, NAV_BARRA, 'en la barra quedan Proyectos · Usuarios · Webmaster · Analitics · Agentes · Presentaciones; el resto, en ☰');
    assert.match(cab, new RegExp(`href="${ruta.replace(/[/]/g, '\\/')}"[^>]*aria-current="page"`), 'la página actual va marcada');
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
  const html = await leer(rel);
  const raiz = new Nodo('html');
  const cuerpo = raiz.appendChild(new Nodo('body', {'data-yk-frame': 'cabecera'}));
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
    const codigo = src ? (src.startsWith('/analitics/') && src.endsWith('expert.js') ? await leer(src.slice(1)) : '') : cuerpoScript;
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
    const {raiz, contexto} = await montar(rel);
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
