import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

// LOS PANELES SE SUPERPONEN: EL CONTENIDO NO SE MUEVE (Carlos, 3-oct-2026).
//
// «El cuerpo central del site (contenido) no se desplaza al abrir las barras
// opcionales, ni verticales ni la horizontal inferior.» Hasta ese día, en ≥1100 px,
// admira-frame.js publicaba --yk-dock-l / --yk-dock-r / --yk-bottom y el CSS
// apartaba el <body> con ellos: al abrir ☰ en /flota todo saltaba a la derecha y el
// globo de /analitics se redimensionaba. Ahora ☰ ▤ ⌘ flotan encima en cualquier
// ancho y entran cerrados en cada página.
//
// Sin motor de maquetación no hay getBoundingClientRect, así que el test cierra las
// dos vías por las que el contenido podría moverse: (1) ninguna hoja de estilos del
// sitio cambia nada que no sea un panel según el estado .yk-open-*, y (2) el armazón,
// ejecutado de verdad, no toca el <body> ni publica ninguna variable al abrir y
// cerrar los paneles (salvo los tamaños de los propios paneles).

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const SKIP = new Set(['node_modules', '.git', 'old', 'backups', 'webmaster-shots', 'tools']);
const leer = (rel) => readFile(path.join(ROOT, rel), 'utf8');

async function ficheros(dir = '.', out = []) {
  for (const e of await readdir(path.join(ROOT, dir), {withFileTypes: true})) {
    if (e.name.startsWith('.') || SKIP.has(e.name)) continue;
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) await ficheros(rel, out);
    else if (/\.(css|html)$/.test(e.name)) out.push(rel);
  }
  return out;
}

// Los selectores de una hoja (sin anidar @media: basta con su contenido).
function reglas(css) {
  const limpio = css.replace(/\/\*[\s\S]*?\*\//g, '');
  return [...limpio.matchAll(/([^{}@]+)\{([^{}]*)\}/g)].map((m) => ({selector: m[1].trim(), cuerpo: m[2]}));
}

test('ninguna hoja del sitio mueve el contenido según el estado de los paneles', async () => {
  const fallos = [];
  for (const rel of await ficheros()) {
    const fuente = await leer(rel);
    const hojas = rel.endsWith('.css') ? [fuente] : [...fuente.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]);
    for (const hoja of hojas) {
      for (const {selector} of reglas(hoja)) {
        for (const parte of selector.split(',').map((p) => p.trim()).filter((p) => /yk-open-|yk-dock/.test(p))) {
          // Lo que cambia con un panel abierto tiene que ser el propio panel, su tirador
          // o un aviso fijo que sube por encima de ⌘ (admira-version).
          const sujeto = parte.split(/\s+|>/).filter(Boolean).pop();
          if (!/^\.(yk-rail|yk-resize|admira-version)/.test(sujeto)) fallos.push(`${rel}: «${parte}»`);
        }
      }
    }
  }
  assert.deepEqual(fallos, [], 'con un panel abierto sólo cambian los paneles: el contenido no se aparta');
});

test('el armazón ya no tiene acople: ni variables que aparten el contenido ni paneles recordados abiertos', async () => {
  const [js, css] = await Promise.all([leer('assets/admira-frame.js'), leer('assets/admira-frame.css')]);
  for (const v of ['--yk-dock-l', '--yk-dock-r', '--yk-bottom']) {
    assert.doesNotMatch(js.replace(/^\s*\/\/.*$/gm, ''), new RegExp(`setProperty\\('${v}'`), `admira-frame.js no publica ${v}`);
    assert.doesNotMatch(css.replace(/\/\*[\s\S]*?\*\//g, ''), new RegExp(`${v}\\b`), `admira-frame.css no usa ${v}`);
  }
  assert.doesNotMatch(js, /function acoplable/, 'sin el modo acoplado');
  const cuerpo = reglas(css).filter((r) => r.selector === 'html.yk-head-mode body').map((r) => r.cuerpo.trim());
  assert.deepEqual(cuerpo, ['padding-top: var(--yk-bar-h);'], 'el <body> sólo baja el alto de la cabecera, constante');
  // Entran cerrados: el estado que guardaban las versiones anteriores ya no se lee.
  assert.doesNotMatch(js, /getItem\(\s*(CLAVE\b|'admiranext_frame_panels_v1')/, 'los paneles no se restauran abiertos al entrar');
  assert.match(js, /removeItem\('admiranext_frame_panels_v1'\)/, 'y se borra lo que quedó guardado');
});

// ── El armazón, ejecutado sobre una cabecera de la familia ──────────────────
class Nodo {
  constructor(tag, atributos = {}) {
    this.tagName = tag.toUpperCase(); this.hijos = []; this.padre = null; this.atributos = {...atributos};
    this.oyentes = {}; this.texto = ''; this.innerHTML = '';
    this.style = {setProperty: () => {}, removeProperty: () => {}};
  }
  get id() { return this.atributos.id || ''; }
  set id(v) { this.atributos.id = String(v); }
  get dataset() {
    const o = {};
    for (const [k, v] of Object.entries(this.atributos)) if (k.startsWith('data-')) o[k.slice(5).replace(/-([a-z])/g, (_, l) => l.toUpperCase())] = v;
    return o;
  }
  get className() { return this.atributos.class || ''; }
  set className(v) { this.atributos.class = String(v); }
  get classList() {
    const n = this; const l = () => new Set(n.className.split(/\s+/).filter(Boolean));
    return {
      add: (...x) => { const s = l(); x.forEach((c) => s.add(c)); n.className = [...s].join(' '); },
      remove: (...x) => { const s = l(); x.forEach((c) => s.delete(c)); n.className = [...s].join(' '); },
      contains: (c) => l().has(c),
      toggle: (c, f) => { const s = l(); const on = f === undefined ? !s.has(c) : !!f; if (on) s.add(c); else s.delete(c); n.className = [...s].join(' '); return on; }
    };
  }
  get textContent() { return this.texto + this.hijos.map((h) => h.textContent).join(''); }
  set textContent(v) { this.texto = String(v); this.hijos = []; }
  get firstChild() { return this.hijos[0] || null; }
  get parentNode() { return this.padre; }
  get nextSibling() { return this.padre ? this.padre.hijos[this.padre.hijos.indexOf(this) + 1] || null : null; }
  setAttribute(k, v) { this.atributos[k] = String(v); }
  getAttribute(k) { return k in this.atributos ? this.atributos[k] : null; }
  removeAttribute(k) { delete this.atributos[k]; }
  appendChild(n) { n.remove(); n.padre = this; this.hijos.push(n); return n; }
  insertBefore(n, ref) { n.remove(); n.padre = this; const i = ref ? this.hijos.indexOf(ref) : -1; if (i < 0) this.hijos.push(n); else this.hijos.splice(i, 0, n); return n; }
  remove() { if (this.padre) { this.padre.hijos = this.padre.hijos.filter((h) => h !== this); this.padre = null; } }
  cloneNode() { const c = new Nodo(this.tagName, this.atributos); c.texto = this.texto; this.hijos.forEach((h) => c.appendChild(h.cloneNode())); return c; }
  addEventListener(t, f) { (this.oyentes[t] ||= []).push(f); }
  contains(n) { for (let x = n; x; x = x.padre) if (x === this) return true; return false; }
  closest() { return null; }
  todos(out = []) { for (const h of this.hijos) { out.push(h); h.todos(out); } return out; }
  coincide(sel) {
    const m = sel.match(/^(\w+)?(?:\[([\w-]+)(?:="([^"]*)")?\])?$/);
    if (!m) throw new Error('selector no contemplado: ' + sel);
    const [, tag, attr, valor] = m;
    return (!tag || this.tagName === tag.toUpperCase()) && (!attr || (attr in this.atributos && (valor === undefined || this.atributos[attr] === valor)));
  }
  querySelectorAll(sel) {
    const partes = sel.trim().split(/\s+/);
    let base = this.todos().filter((n) => n.coincide(partes[0]));
    for (const p of partes.slice(1)) base = [...new Set(base.flatMap((n) => n.todos().filter((d) => d.coincide(p))))];
    return base;
  }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
}

function parsear(fragmento, padre) {
  let actual = padre;
  for (const [, cierre, tag, attrs, texto] of fragmento.matchAll(/<(\/?)(\w+)([^>]*)>|([^<]+)/g)) {
    if (texto !== undefined) continue;
    if (cierre) { actual = actual.padre || padre; continue; }
    actual = actual.appendChild(new Nodo(tag, Object.fromEntries([...attrs.matchAll(/([\w-]+)(?:="([^"]*)")?/g)].map(([, k, v]) => [k, v ?? '']))));
  }
}

for (const rel of ['flota.html', 'analitics/index.html', 'proyectos/index.html']) {
  test(`${rel}: abrir y cerrar ☰ ▤ ⌘ no toca el contenido`, async () => {
    const html = await leer(rel);
    const raiz = new Nodo('html');
    const publicadas = [];
    raiz.style = {setProperty: (k, v) => publicadas.push(k), removeProperty: () => {}};
    const cuerpo = raiz.appendChild(new Nodo('body', {'data-yk-frame': 'cabecera'}));
    const ini = html.search(/<header\b[^>]*\bdata-yk-head\b/);
    parsear(html.slice(ini, html.indexOf('</header>', ini) + 9), cuerpo);
    const main = cuerpo.appendChild(new Nodo('main', {class: 'contenido'}));
    const huella = () => JSON.stringify([cuerpo.atributos, main.atributos, cuerpo.hijos.indexOf(main)]);
    const oyentes = {};
    const documento = {
      documentElement: raiz, body: cuerpo, title: rel,
      createElement: (t) => new Nodo(t),
      getElementById: (id) => raiz.todos().find((n) => n.id === id) || null,
      querySelector: (s) => raiz.querySelector(s), querySelectorAll: (s) => raiz.querySelectorAll(s),
      addEventListener: (t, f) => { (oyentes[t] ||= []).push(f); }
    };
    // Una pantalla ancha: donde antes se acoplaban los paneles.
    const ctx = vm.createContext({document: documento, location: {pathname: '/' + rel}, matchMedia: () => ({matches: true}), innerWidth: 1440, innerHeight: 900, console});
    ctx.window = ctx;
    vm.runInContext(await leer('assets/admira-frame.js'), ctx);
    const antes = huella();
    const inicial = publicadas.splice(0);
    assert.ok(inicial.every((k) => k === '--yk-bar-h' || /^--yk-(w-left|w-right|h-bottom)$/.test(k)), `al montar sólo se publica el alto de la cabecera (${inicial.join(', ')})`);
    for (const lado of ['left', 'right', 'bottom']) {
      ctx.AdmiraFrame.abrir(lado, true);
      assert.ok(ctx.AdmiraFrame.abierto(lado), `${lado} abierto`);
      assert.equal(huella(), antes, `abrir ${lado} no cambia el <body> ni el contenido`);
    }
    for (const lado of ['left', 'right', 'bottom']) ctx.AdmiraFrame.abrir(lado, false);
    assert.equal(huella(), antes, 'cerrar tampoco');
    assert.deepEqual(publicadas.filter((k) => k !== '--yk-bar-h'), [], 'abrir y cerrar no publica variables que aparten el contenido');
  });
}
