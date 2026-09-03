import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

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
  constructor(tag) {
    this.tagName = tag.toUpperCase();
    this.hijos = [];
    this.padre = null;
    this.id = '';
    this.dataset = {};
    this.atributos = {};
    this.oyentes = {};
    this.clases = new Set();
    this.innerHTML = '';
  }
  get className() { return [...this.clases].join(' '); }
  set className(valor) { this.clases = new Set(String(valor).split(/\s+/).filter(Boolean)); }
  get classList() {
    const clases = this.clases;
    return {
      add: (...nombres) => nombres.forEach((n) => clases.add(n)),
      remove: (...nombres) => nombres.forEach((n) => clases.delete(n)),
      contains: (nombre) => clases.has(nombre),
      toggle: (nombre, forzar) => {
        const encendido = forzar === undefined ? !clases.has(nombre) : Boolean(forzar);
        if (encendido) clases.add(nombre); else clases.delete(nombre);
        return encendido;
      }
    };
  }
  get children() { return this.hijos; }
  get firstChild() { return this.hijos[0] || null; }
  setAttribute(clave, valor) { this.atributos[clave] = String(valor); }
  getAttribute(clave) { return clave in this.atributos ? this.atributos[clave] : null; }
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
  addEventListener(tipo, oyente) { (this.oyentes[tipo] ||= []).push(oyente); }
  closest(selector) {
    const clase = selector.replace(/^\./, '');
    for (let nodo = this; nodo; nodo = nodo.padre) if (nodo.clases.has(clase)) return nodo;
    return null;
  }
}

function descendientes(nodo, salida = []) {
  for (const hijo of nodo.hijos) { salida.push(hijo); descendientes(hijo, salida); }
  return salida;
}

// Levanta el DOM que el armazón va a encontrar A PARTIR DE LA PÁGINA REAL: los
// elementos con data-yk-slot y los enlaces del nav. Si la galería deja de declarar
// un lado, este montaje se queda sin él y el test lo canta.
function montarGaleria(html) {
  const raiz = new Nodo('html');
  const cuerpo = new Nodo('body');
  raiz.appendChild(cuerpo);

  const atributosBody = html.match(/<body\b([^>]*)>/i)?.[1] || '';
  for (const [, clave, valor] of atributosBody.matchAll(/data-yk-([a-z-]+)="([^"]*)"/gi)) {
    cuerpo.dataset[clave.replace(/-([a-z])/g, (_, letra) => letra.toUpperCase())] = valor;
  }

  for (const [, etiqueta, atributos, slot] of html.matchAll(/<(\w+)\b([^>]*\bdata-yk-slot="([^"]+)"[^>]*)>/g)) {
    const nodo = new Nodo(etiqueta);
    nodo.id = atributos.match(/\bid="([^"]+)"/)?.[1] || '';
    nodo.dataset.ykSlot = slot;
    nodo.hidden = /\bhidden(?=[\s>]|$)/.test(atributos);
    cuerpo.appendChild(nodo);
    if (slot !== 'nav') continue;
    const bloque = html.slice(html.indexOf(atributos)).split(/<\/nav>/i)[0];
    for (const [, destino] of bloque.matchAll(/<a\b[^>]*\bhref="([^"]+)"/g)) {
      const enlace = new Nodo('a');
      enlace.setAttribute('href', destino);
      nodo.appendChild(enlace);
    }
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
    createElement: (etiqueta) => new Nodo(etiqueta),
    getElementById: (id) => descendientes(raiz).find((nodo) => nodo.id === id) || null,
    addEventListener: (tipo, oyente) => { (oyentesDoc[tipo] ||= []).push(oyente); },
    querySelectorAll(selector) {
      const partes = selector.match(/^\[data-yk-slot="([^"]+)"\](?:\s+(\w+))?$/);
      if (!partes) throw new Error(`selector no contemplado por el DOM de prueba: ${selector}`);
      const base = descendientes(raiz).filter((nodo) => nodo.dataset.ykSlot === partes[1]);
      if (!partes[2]) return base;
      return base.flatMap((nodo) => descendientes(nodo).filter((hijo) => hijo.tagName === partes[2].toUpperCase()));
    }
  };

  vm.runInNewContext(fuente, {document: documento, location: {pathname: '/presentaciones/'}});

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

  // El canon de la casa: OPCIONES sola arriba-izquierda; a la derecha AVANZADO y,
  // en el extremo, EXPERTO.
  const barra = descendientes(documento.documentElement).find((nodo) => nodo.clases.has('yk-bar'));
  const iconos = descendientes(barra).filter((nodo) => nodo.tagName === 'BUTTON').map((nodo) => nodo.id);
  assert.deepEqual(iconos, ['ykOptionsToggle', 'ykAdvancedToggle', 'ykExpertToggle']);
});

test('abrir un nivel cierra los otros, y Escape los pliega todos', async () => {
  const {raiz, documento, pulsar, teclear} = await armazonMontado();
  const estado = () => NIVELES.map((nivel) => documento.getElementById(nivel.icono).getAttribute('aria-expanded'));

  for (const abierto of NIVELES) {
    pulsar(documento.getElementById(abierto.icono));
    assert.deepEqual(estado(), NIVELES.map((nivel) => String(nivel === abierto)), `solo ${abierto.lado} queda abierto`);
    assert.ok(raiz.clases.has(abierto.clase), `el armazón marca ${abierto.clase}`);
    assert.equal(documento.getElementById(abierto.cajon).inert, false, 'el cajón abierto sí recibe el tabulador');
  }

  teclear('Escape');
  assert.deepEqual(estado(), ['false', 'false', 'false'], 'Escape devuelve el marco a plegado');
  assert.deepEqual([...raiz.clases], [], 'y no deja ningún lado marcado como abierto');
});

test('el rediseño conserva el control de accesos y la entrada al presentador', async () => {
  const html = await galeria();

  assert.match(html, /href=["']\/presentaciones\/control\/["']/i);
  assert.match(html, /href=["']\/presentaciones\/["']/i);
});
