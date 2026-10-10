import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

// 3-oct-2026: la galería lleva la BARRA DE LA INTRANET (admira-frame.js en modo
// cabecera, la misma de /proyectos/); este test monta esa cabecera real y comprueba
// que los tres niveles siguen en sus cajones.
//
// La galería de presentaciones ya no monta su propia UX cuadrática: desde
// «/presentaciones adopta la cuadricula de la casa» (846bfa2) los tres niveles son
// los tres cajones del armazón compartido, y la página solo declara qué va en cada
// lado con data-yk-slot. Este test dejó de mirar los botones que la página traía
// escritos —que ya no existen— y mira lo que de verdad protege: que cada nivel
// tenga su icono en la barra, que el icono diga qué cajón abre y que todo nazca
// plegado. La jerarquía se comprueba EJECUTANDO el armazón, no leyendo el HTML:
// quien la construye es JavaScript, y un grep sobre el fichero no ve nada de eso.
//
// Lo que se escapó por mirar solo el HTML: el motor viejo
// (assets/presentations-quadratic-ui.js) siguió cargado tras la mudanza, buscaba
// unos botones que ya no estaban y ponía hidden a los tres paneles para siempre.
// Los cajones abrían VACÍOS en producción y ningún test lo notaba.

const NIVELES = [
  {lado: 'left', icono: 'ykOptionsToggle', cajon: 'ykOptionsRail', panel: 'ykOptionsPanel', clase: 'yk-open-left'},
  {lado: 'right', icono: 'ykAdvancedToggle', cajon: 'ykAdvancedRail', panel: 'ykAdvancedPanel', clase: 'yk-open-right'},
  {lado: 'bottom', icono: 'ykExpertToggle', cajon: 'ykExpertRail', panel: 'ykExpertPanel', clase: 'yk-open-bottom'}
];

const galeria = () => readFile(new URL('../presentaciones/index.html', import.meta.url), 'utf8');

// ── Un DOM mínimo: lo justo que admira-frame.js toca ────────────────────────────
class Nodo {
  constructor(tag, atributos = {}) {
    this.tagName = tag.toUpperCase();
    this.hijos = [];
    this.padre = null;
    this.atributos = {...atributos};
    this.oyentes = {};
    this.texto = '';
    this.innerHTML = '';
  }
  get id() { return this.atributos.id || ''; }
  set id(v) { this.atributos.id = String(v); }
  get hidden() { return 'hidden' in this.atributos; }
  set hidden(v) { if (v) this.atributos.hidden = ''; else delete this.atributos.hidden; }
  get dataset() {
    const nodo = this;
    return new Proxy({}, {
      get: (_, k) => nodo.atributos['data-' + String(k).replace(/[A-Z]/g, (l) => '-' + l.toLowerCase())],
      set: (_, k, v) => { nodo.atributos['data-' + String(k).replace(/[A-Z]/g, (l) => '-' + l.toLowerCase())] = String(v); return true; }
    });
  }
  get clases() { return new Set(String(this.atributos.class || '').split(/\s+/).filter(Boolean)); }
  get className() { return this.atributos.class || ''; }
  set className(v) { this.atributos.class = String(v); }
  get classList() {
    const nodo = this;
    const poner = (l) => { nodo.className = [...l].join(' '); };
    return {
      add: (...n) => { const l = nodo.clases; n.forEach((x) => l.add(x)); poner(l); },
      remove: (...n) => { const l = nodo.clases; n.forEach((x) => l.delete(x)); poner(l); },
      contains: (n) => nodo.clases.has(n),
      toggle: (n, f) => { const l = nodo.clases; const on = f === undefined ? !l.has(n) : Boolean(f); if (on) l.add(n); else l.delete(n); poner(l); return on; }
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
  appendChild(nodo) { nodo.remove(); nodo.padre = this; this.hijos.push(nodo); return nodo; }
  insertBefore(nodo, referencia) {
    nodo.remove();
    nodo.padre = this;
    const indice = referencia ? this.hijos.indexOf(referencia) : -1;
    if (indice < 0) this.hijos.push(nodo); else this.hijos.splice(indice, 0, nodo);
    return nodo;
  }
  remove() {
    if (!this.padre) return;
    this.padre.hijos = this.padre.hijos.filter((hijo) => hijo !== this);
    this.padre = null;
  }
  cloneNode() {
    const copia = new Nodo(this.tagName, this.atributos);
    copia.texto = this.texto;
    this.hijos.forEach((h) => copia.appendChild(h.cloneNode()));
    return copia;
  }
  addEventListener(tipo, oyente) { (this.oyentes[tipo] ||= []).push(oyente); }
  contains(n) { for (let x = n; x; x = x.padre) if (x === this) return true; return false; }
  closest(selector) {
    for (let nodo = this; nodo; nodo = nodo.padre) if (nodo.coincide(selector)) return nodo;
    return null;
  }
  coincide(sel) {
    if (sel.startsWith('.')) return this.clases.has(sel.slice(1));
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
    let base = descendientes(this).filter((n) => n.coincide(partes[0]));
    for (const parte of partes.slice(1)) base = [...new Set(base.flatMap((n) => descendientes(n).filter((d) => d.coincide(parte))))];
    return base;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
}

function descendientes(nodo, salida = []) {
  for (const hijo of nodo.hijos) { salida.push(hijo); descendientes(hijo, salida); }
  return salida;
}

const atributosDe = (texto) => Object.fromEntries([...texto.matchAll(/([\w-]+)(?:="([^"]*)")?/g)].map(([, k, v]) => [k, v ?? '']));

// Un parser mínimo, suficiente para la cabecera (sin elementos vacíos).
function parsear(fragmento, padre) {
  let actual = padre;
  for (const [, cierre, etiqueta, attrs, texto] of fragmento.matchAll(/<(\/?)(\w+)([^>]*)>|([^<]+)/g)) {
    if (texto !== undefined) { if (texto.trim()) actual.appendChild(Object.assign(new Nodo('#text'), {texto})); continue; }
    if (cierre) { actual = actual.padre || padre; continue; }
    actual = actual.appendChild(new Nodo(etiqueta, atributosDe(attrs)));
  }
}

// Levanta el DOM que el armazón va a encontrar A PARTIR DE LA PÁGINA REAL: el <body>
// con sus data-yk-*, la cabecera del grupo y los elementos con data-yk-slot. Si la
// galería deja de declarar un lado (o la cabecera), este montaje se queda sin él y
// el test lo canta.
function montarGaleria(html) {
  const raiz = new Nodo('html');
  const cuerpo = raiz.appendChild(new Nodo('body', atributosDe(html.match(/<body\b([^>]*)>/i)?.[1] || '')));
  const inicio = html.search(/<header\b[^>]*\bdata-yk-head\b/);
  if (inicio >= 0) parsear(html.slice(inicio, html.indexOf('</header>', inicio) + '</header>'.length), cuerpo);
  for (const [, etiqueta, atributos] of html.matchAll(/<(\w+)\b([^>]*\bdata-yk-slot="[^"]+"[^>]*)>/g)) {
    cuerpo.appendChild(new Nodo(etiqueta, atributosDe(atributos)));
  }
  return {raiz, cuerpo};
}

async function armazonMontado() {
  const [html, fuente] = await Promise.all([
    galeria(),
    readFile(new URL('../assets/admira-frame.js', import.meta.url), 'utf8')
  ]);
  const {raiz, cuerpo} = montarGaleria(html);
  const oyentesDoc = {};
  const documento = {
    documentElement: raiz,
    body: cuerpo,
    title: 'Presentaciones',
    createElement: (etiqueta) => new Nodo(etiqueta),
    getElementById: (id) => descendientes(raiz).find((nodo) => nodo.id === id) || null,
    addEventListener: (tipo, oyente) => { (oyentesDoc[tipo] ||= []).push(oyente); },
    querySelector: (selector) => raiz.querySelector(selector),
    querySelectorAll: (selector) => raiz.querySelectorAll(selector)
  };

  vm.runInNewContext(fuente, {document: documento, location: {pathname: '/presentaciones/galeria'}});

  const pulsar = (nodo) => {
    const evento = {target: nodo, preventDefault() {}};
    for (const oyente of nodo.oyentes.click || []) oyente(evento);
    for (const oyente of oyentesDoc.click || []) oyente(evento);
  };
  const teclear = (key) => {
    const evento = {key, preventDefault() {}};
    for (const oyente of oyentesDoc.keydown || []) oyente(evento);
  };
  return {raiz, cuerpo, documento, pulsar, teclear};
}

test('la galería declara sus tres niveles en los tres lados del marco', async () => {
  const html = await galeria();

  for (const nivel of NIVELES) {
    const seccion = html.match(new RegExp(`<[^>]+\\bid="${nivel.panel}"[^>]*>`, 'i'))?.[0] || '';
    assert.ok(seccion, `falta la sección #${nivel.panel}`);
    assert.match(seccion, new RegExp(`\\bdata-yk-slot="${nivel.lado}"`), `#${nivel.panel} tiene que ir al lado ${nivel.lado}`);
    // Nacer con hidden era el síntoma del motor huérfano: el cajón abría y dentro
    // no había nada. Plegar es cosa del cajón, no del panel.
    assert.doesNotMatch(seccion, /\bhidden(?=[\s>])/, `#${nivel.panel} no se oculta a sí mismo`);
  }

  assert.match(html, /<script[^>]+src="\/assets\/admira-frame\.js[^"]*"/i, 'el marco lo monta el armazón de la casa');
  // UN solo motor cuadrático. Dos motores sobre los mismos paneles fue exactamente
  // el fallo: el segundo los ocultaba y el primero no sabía nada de él.
  assert.deepEqual(html.match(/<script[^>]*quadratic[^>]*>/gi), null, 'la galería no carga un segundo motor cuadrático propio');
});

test('cada nivel tiene su icono en la barra, dice qué cajón abre y nace plegado', async () => {
  const {documento} = await armazonMontado();

  for (const nivel of NIVELES) {
    const icono = documento.getElementById(nivel.icono);
    const cajon = documento.getElementById(nivel.cajon);
    assert.ok(icono, `falta el icono #${nivel.icono} en la barra`);
    assert.ok(cajon, `falta el cajón #${nivel.cajon}`);
    assert.equal(icono.tagName, 'BUTTON');
    assert.equal(icono.getAttribute('aria-controls'), nivel.cajon, `#${nivel.icono} tiene que declarar qué abre`);
    assert.ok(icono.getAttribute('aria-label'), `#${nivel.icono} es solo el glifo: el rótulo va en aria-label`);
    assert.equal(icono.getAttribute('aria-expanded'), 'false', 'todo plegado por defecto');
    assert.equal(cajon.inert, true, 'un cajón plegado se sale del recorrido del tabulador');

    // Y el cajón lleva DENTRO el panel que la página mandó a ese lado: sin esto el
    // icono abre una caja vacía, que es como estaba producción.
    const panel = documento.getElementById(nivel.panel);
    assert.equal(panel.closest('.yk-rail'), cajon, `#${nivel.panel} vive dentro de #${nivel.cajon}`);
    assert.equal(panel.hidden, false, `#${nivel.panel} no puede quedarse oculto dentro de su cajón`);
  }

  // La barra es la de la intranet (Carlos, 3-oct-2026): ☰ antes de la marca, la
  // navegación del grupo, «● Acceso privado» y, en el extremo, ▤ y ⌘.
  const barra = descendientes(documento.documentElement).find((nodo) => nodo.clases.has('yk-head'));
  assert.ok(barra, 'la galería lleva la cabecera de la intranet (modo cabecera)');
  assert.equal(descendientes(documento.documentElement).find((nodo) => nodo.clases.has('yk-bar')), undefined, 'y no la barra propia del modo barra');
  const piezas = barra.hijos.map((n) => n.tagName === 'BUTTON' ? n.id : n.tagName === 'A' ? 'marca' : n.tagName === 'NAV' ? 'nav' : n.getAttribute('data-yk-access') !== null ? 'acceso' : n.clases.has('yk-meta') ? n.hijos.map((b) => b.id).filter((id) => id !== 'ykLangPre').join('+') : n.tagName);
  // #ykLangPre (ES · EN) ocupa el hueco de ⌘ solo sin sesión (norma 32); el CSS lo retira con sesión.
  assert.deepEqual(piezas, ['ykOptionsToggle', 'marca', 'nav', 'acceso', 'ykAdvancedToggle+ykExpertToggle']);
  assert.equal(barra.querySelector('[data-yk-access]').getAttribute('data-yk-access'), 'privado', 'la galería sólo se sirve con sesión: «● Acceso privado»');
});

// Canon de la Galaxia (FLT-101373, 2-oct-2026): los tres paneles son INDEPENDIENTES
// —abrir uno no cierra los otros, como en admira.app, Pixeria, XpaceOS y Yokup— y
// Esc cierra el panel enfocado o, sin foco en ninguno, el último que se abrió.
// Antes este test exigía lo contrario (abrir uno cerraba los otros y Esc los
// plegaba todos de golpe).
test('los niveles se abren por separado, y Escape pliega el último abierto', async () => {
  const {raiz, documento, pulsar, teclear} = await armazonMontado();
  const estado = () => NIVELES.map((nivel) => documento.getElementById(nivel.icono).getAttribute('aria-expanded'));

  NIVELES.forEach((abierto, i) => {
    pulsar(documento.getElementById(abierto.icono));
    assert.deepEqual(estado(), NIVELES.map((nivel, j) => String(j <= i)), `abrir ${abierto.lado} no cierra los que ya estaban abiertos`);
    assert.ok(raiz.clases.has(abierto.clase), `el armazón marca ${abierto.clase}`);
    assert.equal(documento.getElementById(abierto.cajon).inert, false, 'el cajón abierto sí recibe el tabulador');
  });

  pulsar(documento.getElementById(NIVELES[0].icono));
  assert.deepEqual(estado(), ['false', 'true', 'true'], 'el icono vuelve a plegar SU panel y solo el suyo');

  teclear('Escape');
  assert.deepEqual(estado(), ['false', 'true', 'false'], 'Escape pliega el último que se abrió (⌘)');
  teclear('Escape');
  assert.deepEqual(estado(), ['false', 'false', 'false'], 'y el siguiente Escape, el anterior');
  assert.deepEqual([...raiz.clases].filter((c) => c.startsWith('yk-open-')), [], 'sin ningún lado marcado como abierto');
});

test('los iconos son los del canon: ☰ Opciones, ▤ Avanzado y ⌘ Experto', async () => {
  const fuente = await readFile(new URL('../assets/admira-frame.js', import.meta.url), 'utf8');
  assert.match(fuente, /GLIFOS = \{left: '☰', right: '▤', bottom: '⌘'\}/);
  assert.doesNotMatch(fuente, /aria-hidden="true">(⋯|⌄)</, 'los glifos viejos ⋯ y ⌄ no vuelven');
  const {documento} = await armazonMontado();
  for (const [id, glifo] of [['ykOptionsToggle', '☰'], ['ykAdvancedToggle', '▤'], ['ykExpertToggle', '⌘']]) {
    assert.match(documento.getElementById(id).innerHTML, new RegExp(glifo));
  }
});

test('el rediseño conserva el control de accesos y la entrada al presentador', async () => {
  const html = await galeria();

  assert.match(html, /href=["']\/presentaciones\/control\/["']/i);
  assert.match(html, /href=["']\/presentaciones\/["']/i);
});
