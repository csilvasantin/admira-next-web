// /arquitecto (Carlos, 14-oct-2026, DCL-66d9ae0d5e756d0067127f24): «si escribimos en modo experto /arquitecto, admirito
// se disfrace de arquitecto y le podamos pedir crear, reformar o inventariar». El Arquitecto es un personaje más de la
// tabla de Bugito (avatar.js PERSONAJES y suite/experto.js PERSONAJES_SUITE): su cara es la nube con
// ?personaje=arquitecto y su página, el estudio de admira.biz (arquitecto.html, que registra window.AdmiraArquitecto).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));
const experto = readFileSync(join(dir, '../suite/experto.js'), 'utf8');
const avatar = readFileSync(join(dir, '../assets/avatar.js'), 'utf8');

function cargador() {
  const module = { exports: {} };
  vm.runInNewContext(avatar, { module, globalThis: {}, window: undefined });
  return module.exports;
}
const A = cargador();

// El cargador entero en una ventana de mentira (para run()/handle()).
function ventana({ AdmiraArquitecto = null, lang = 'es', host = 'www.admira.store' } = {}) {
  const fuera = [];
  const el = () => ({ style: { setProperty() {}, removeProperty() {}, getPropertyValue: () => '' }, classList: { add() {}, remove() {}, contains: () => false, toggle() {} }, setAttribute() {}, getAttribute: () => null,
    removeAttribute() {}, appendChild() {}, addEventListener() {}, querySelector: () => null, querySelectorAll: () => [], dataset: {}, textContent: '' });
  const document = { documentElement: { ...el(), lang }, currentScript: { dataset: {} }, readyState: 'complete', body: el(), head: el(),
    getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: el, addEventListener() {} };
  const storage = { _m: {}, getItem(k) { return k in this._m ? this._m[k] : null; }, setItem(k, v) { this._m[k] = String(v); }, removeItem(k) { delete this._m[k]; } };
  const w = { document, localStorage: storage, sessionStorage: storage, URLSearchParams, URL, setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0,
    location: { host, hostname: host, origin: 'https://' + host, search: '', assign: (u) => fuera.push(u) }, addEventListener() {}, dispatchEvent: () => true,
    fetch: async () => ({ ok: false, json: async () => ({}) }), getComputedStyle: () => ({}), innerWidth: 1280, innerHeight: 800, MutationObserver: class { observe() {} } };
  if (AdmiraArquitecto) w.AdmiraArquitecto = AdmiraArquitecto;
  w.window = w; w.globalThis = w;
  vm.runInNewContext(avatar, w, { filename: 'avatar.js' });
  return { A: w.AdmiraAvatar, fuera };
}

test('el cargador conoce al Arquitecto: un personaje más, con su cara y su estudio', () => {
  assert.equal(A.decide('/arquitecto'), 'arquitecto');
  assert.equal(A.decide('/Arquitecto crear cafetería'), 'arquitecto');
  assert.equal(A.decide('arquitecto inventariar'), 'arquitecto');
  assert.equal(A.decide('/arquitectura'), null, '/arquitectura sigue siendo el organigrama de la suite');
  assert.equal(A.decide('/arquitectos'), null);
  assert.deepEqual(A.PERSONAJES.arquitecto.gancho, 'AdmiraArquitecto');
  assert.equal(A.personajeArg('arquitecto', '/arquitecto'), '');
  assert.equal(A.personajeArg('arquitecto', '/arquitecto crear cafetería'), 'crear-cafeteria');
  assert.equal(A.personajeArg('arquitecto', '/arquitecto <script>'), 'script');
  assert.equal(A.personajeUrl('arquitecto', { lang: 'en' }), 'https://digitalavatar.ai/nube.html?dock=1&contract=20261016-180&langui=host&personaje=arquitecto&lang=en&tier=good');
  assert.equal(A.personajePagina('arquitecto', 'crear-cafeteria', 'es'), 'https://www.admira.biz/arquitecto.html?lang=es&arg=crear-cafeteria');
  assert.equal(A.personajePagina('arquitecto', '', 'en'), 'https://www.admira.biz/arquitecto.html?lang=en');
  assert.match(A.message('arquitecto-ir', false), /crear \[tipo\] · \/arquitecto reformar · \/arquitecto inventariar/);
  assert.match(A.message('arquitecto-ir', true), /opening his studio on admira\.biz/);
  assert.equal(A.PERSONAJES.arquitecto.param, 'arg');
  assert.match(A.message('arquitecto-lanza', false, 'reformar'), /abriendo «reformar» en el estudio/);
  assert.match(A.message('arquitecto-fallo', true), /could not do it/);
  assert.equal('arquitecto' in A.LEVELS, false, 'nunca pasa a ser la cara por defecto de un sitio');
});

test('fuera del estudio, /arquitecto lo abre (con la orden); dentro, se lo pasa a window.AdmiraArquitecto', () => {
  const fuera = ventana();
  assert.match(fuera.A.run('/arquitecto'), /abriendo su estudio/);
  assert.match(fuera.A.run('/arquitecto crear cafetería'), /Órdenes/);
  assert.deepEqual(fuera.fuera, ['https://www.admira.biz/arquitecto.html?lang=es', 'https://www.admira.biz/arquitecto.html?lang=es&arg=crear-cafeteria']);
  const pedidos = [];
  const estudio = ventana({ host: 'www.admira.biz', AdmiraArquitecto: { toggle: () => 'Arquitecto: /arquitecto crear [tipo] · …', lanzar: (x) => { pedidos.push(x); return 'Arquitecto: orden abierta'; } } });
  assert.match(estudio.A.run('/arquitecto'), /crear \[tipo\]/);
  assert.equal(estudio.A.run('/arquitecto reformar'), 'Arquitecto: orden abierta');
  assert.deepEqual(pedidos, ['reformar']);
  assert.deepEqual(estudio.fuera, [], 'en su estudio no navega');
  assert.equal(typeof fuera.A.personaje('arquitecto').url, 'function');
});

// ── El verbo en el ⌘ Experto compartido ──
function consola({ AdmiraAvatar = null, AdmiraArquitecto = null, lang = 'es' } = {}) {
  const documentElement = { lang, dataset: {}, setAttribute() {}, getAttribute() { return null; }, classList: { contains: () => false, add() {}, toggle() {} } };
  const fuera = [];
  const document = {
    documentElement, currentScript: { dataset: {} }, readyState: 'complete',
    querySelector: () => null, querySelectorAll: () => [],
    createElement: (tag) => ({ tagName: String(tag).toUpperCase(), classList: { add() {}, contains: () => false, toggle() {} }, setAttribute() {}, getAttribute: () => null,
      appendChild() {}, style: {}, addEventListener() {}, querySelector: () => null, querySelectorAll: () => [], textContent: '', children: [], insertBefore() {}, removeAttribute() {} }),
    addEventListener() {}, head: { appendChild() {} }, body: { appendChild() {} }, dispatchEvent() {},
  };
  const location = { hostname: 'www.admira.tv', host: 'www.admira.tv', href: 'https://www.admira.tv/', pathname: '/', search: '', hash: '', origin: 'https://www.admira.tv', assign: (u) => fuera.push(u) };
  const storage = { _m: {}, getItem(k) { return k in this._m ? this._m[k] : null; }, setItem(k, v) { this._m[k] = String(v); }, removeItem(k) { delete this._m[k]; } };
  const sandbox = {
    document, location, localStorage: storage, sessionStorage: storage, URL, URLSearchParams,
    dispatchEvent() {}, addEventListener() {}, MutationObserver: class { observe() {} disconnect() {} },
    CustomEvent: class { constructor(t, i) { this.type = t; this.detail = i && i.detail; } }, Event: class { constructor(t) { this.type = t; } },
    fetch: async () => ({ ok: false, json: async () => ({}) }), setTimeout: (f) => { f(); return 0; }, clearTimeout() {},
  };
  if (AdmiraAvatar) sandbox.AdmiraAvatar = AdmiraAvatar;
  if (AdmiraArquitecto) sandbox.AdmiraArquitecto = AdmiraArquitecto;
  sandbox.window = sandbox; sandbox.globalThis = sandbox;
  vm.runInNewContext(experto, sandbox, { filename: 'experto.js' });
  const log = { children: [], tagName: 'OL', querySelector: () => null, insertBefore(x) { this.children.unshift(x); }, appendChild(x) { this.children.push(x); }, removeChild() {}, get firstChild() { return this.children[0]; }, scrollTop: 0, scrollHeight: 0 };
  return { api: sandbox.AdmiraExperto, fuera, run: (t) => sandbox.AdmiraExperto.exec(t, log, { echo: false }), texto: () => log.children.map((li) => li.textContent).join('\n') };
}

test('/arquitecto está en el ⌘ Experto de las cinco patas y en /help, junto a /bugito', async () => {
  const c = consola();
  assert.equal(c.api.has('arquitecto'), true);
  assert.equal(c.api.has('bugito'), true);
  await c.run('/help');
  assert.match(c.texto(), /\/arquitecto \[crear \[tipo\]\|reformar\|inventariar\] — sin nada, saca al Arquitecto/);
  const en = consola({ lang: 'en' });
  await en.run('/help');
  assert.match(en.texto(), /brings out the Architect \(Admirito in a hard hat\)/);
  assert.match(experto, /\{name: 'arquitecto', gancho: 'AdmiraArquitecto', pagina: 'https:\/\/www\.admira\.biz\/arquitecto\.html'/);
});

test('/arquitecto va por el cargador avatar.js; con uno anterior, por la página o abriendo el estudio', async () => {
  const llamadas = [];
  const AdmiraAvatar = { handle: (t) => { llamadas.push(t); return Promise.resolve('Arquitecto: orden abierta'); }, personaje: (id) => (['bugito', 'arquitecto'].includes(id) ? { url() {} } : null) };
  const c = consola({ AdmiraAvatar });
  await c.run('/arquitecto crear cafetería');
  await c.run('/arquitecto');
  assert.deepEqual(llamadas, ['/arquitecto crear cafetería', '/arquitecto']);
  assert.match(c.texto(), /orden abierta/);
  const viejo = { handle: () => Promise.resolve('Usa /avatar avatar…') };
  const pedidos = [];
  const enEstudio = consola({ AdmiraAvatar: viejo, AdmiraArquitecto: { toggle: () => 'Arquitecto a la vista', lanzar: (x) => { pedidos.push(x); return 'Lanzado ' + x; } } });
  await enEstudio.run('/arquitecto');
  await enEstudio.run('/arquitecto inventariar');
  assert.deepEqual(pedidos, ['inventariar']);
  assert.match(enEstudio.texto(), /Arquitecto a la vista/);
  const fuera = consola({ AdmiraAvatar: viejo });
  await fuera.run('/arquitecto');
  await fuera.run('/arquitecto crear cafetería');
  assert.deepEqual(fuera.fuera, ['https://www.admira.biz/arquitecto.html?lang=es', 'https://www.admira.biz/arquitecto.html?lang=es&arg=crear-cafeteria'], 'param:"arg" también sin el avatar.js nuevo');
  assert.match(experto, /\{name: 'arquitecto', gancho: 'AdmiraArquitecto', pagina: 'https:\/\/www\.admira\.biz\/arquitecto\.html', param: 'arg'/);
  assert.match(fuera.texto(), /abriendo su estudio en admira\.biz/);
});

test('en piel (la pata conserva su CLI), /arquitecto es de la suite como /bugito; /arquitectura no cambia', async () => {
  const shared = experto.slice(experto.indexOf('var PERSONAJE_RE'), experto.indexOf('\n', experto.indexOf('var PERSONAJE_RE')));
  const RE = new RegExp('^\\/(bugito|arquitecto)(?:\\s|$)', 'i');
  assert.match(shared, /PERSONAJES_SUITE\.map/);
  for (const t of ['/arquitecto', '/arquitecto crear', '/Arquitecto reformar']) assert.equal(RE.test(t), true, t);
  for (const t of ['/arquitectura', '/arquitectos', 'arquitecto']) assert.equal(RE.test(t), false, t);
  const c = consola();
  await c.run('/arquitectura');
  assert.deepEqual(c.fuera, ['https://www.admiranext.com/arquitectura?lang=es'], 'sigue abriendo el organigrama');
  assert.match(experto, /var AVATAR_SRC = 'https:\/\/www\.admiranext\.com\/assets\/avatar\.js\?v=20261018-variants-2';/, 'avatar.js con personajes y actualización de cargadores antiguos');
});
