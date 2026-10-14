// /bugito (Carlos, 14-oct-2026, DCL-5da4653d859552490fd5ae1d): Bugito es Admirito con piel de diablillo, el
// creador de incidencias del banco de pruebas de admira.biz. Mismo cargador (assets/avatar.js) y mismo camino
// que /admirito (avatarRun) desde el ⌘ Experto de las cinco patas.
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

test('el cargador reconoce /bugito y su argumento, sin tocar /admirito', () => {
  assert.equal(A.decide('/bugito'), 'bugito');
  assert.equal(A.decide('/Bugito popup'), 'bugito');
  assert.equal(A.decide('bugito girar'), 'bugito');
  assert.equal(A.decide('/admirito'), 'mascota');
  assert.equal(A.decide('/bugitos'), null);
  assert.equal(A.bugitoArg('/bugito'), '');
  assert.equal(A.bugitoArg('/bugito Ábrela a medias'), 'abrela-a-medias');
  assert.equal(A.bugitoArg('/bugito popup-encima'), 'popup-encima');
  assert.equal(A.bugitoArg('/bugito <script>alert(1)</script>'), 'script-alert-1-script');
  assert.equal(A.bugitoArg('/admirito'), null);
});

test('Bugito es la cara de Admirito con ?personaje=bugito, y no un nivel más', () => {
  assert.equal(A.BUGITO, 'https://digitalavatar.ai/nube.html?dock=1&personaje=bugito');
  assert.equal(A.bugitoUrl({ lang: 'en', loc: 'x' }), 'https://digitalavatar.ai/nube.html?dock=1&personaje=bugito&lang=en&tier=good');
  assert.equal(A.bugitoUrl({}), 'https://digitalavatar.ai/nube.html?dock=1&personaje=bugito&tier=good');
  assert.equal('bugito' in A.LEVELS, false, 'nunca pasa a ser la cara por defecto de un sitio');
  assert.equal(A.pickLevel('bugito', '', ''), 'good');
});

test('el banco de pruebas de admira.biz, con la incidencia sólo preseleccionada', () => {
  assert.equal(A.BUGITO_BANCO, 'https://www.admira.biz/bugito.html');
  assert.equal(A.bugitoBanco('', 'es'), 'https://www.admira.biz/bugito.html?lang=es');
  assert.equal(A.bugitoBanco('popup', 'en'), 'https://www.admira.biz/bugito.html?lang=en&incidencia=popup');
  assert.equal(A.bugitoBanco('mal&x=1', 'xx'), 'https://www.admira.biz/bugito.html');
  assert.match(A.message('bugito-ir', false), /banco de pruebas en admira\.biz/);
  assert.match(A.message('bugito-ir', true), /test bench on admira\.biz/);
  // run(): /bugito va por bugitoRun → en el banco, la página (AdmiraBugito); fuera, el banco.
  assert.match(avatar, /if \(mode === 'bugito'\) return bugitoRun\(bugitoArg\(text\) \|\| ''\);/);
  assert.match(avatar, /if \(B && typeof B\.toggle === 'function' && typeof B\.lanzar === 'function'\) return arg \? B\.lanzar\(arg\) : B\.toggle\(\);/);
  assert.match(avatar, /root\.location\.assign\(bugitoBanco\(arg, english \? 'en' : 'es'\)\);/);
});

// ── El verbo en el ⌘ Experto compartido ──
function consola({ AdmiraAvatar = null, AdmiraBugito = null, lang = 'es' } = {}) {
  const documentElement = { lang, dataset: {}, setAttribute() {}, getAttribute() { return null; }, classList: { contains: () => false, add() {}, toggle() {} } };
  const fuera = [];
  const document = {
    documentElement, currentScript: { dataset: {} }, readyState: 'complete',
    querySelector: () => null, querySelectorAll: () => [],
    createElement: (tag) => ({ tagName: String(tag).toUpperCase(), classList: { add() {}, contains: () => false, toggle() {} }, setAttribute() {}, getAttribute: () => null,
      appendChild() {}, style: {}, addEventListener() {}, querySelector: () => null, querySelectorAll: () => [], textContent: '', children: [], insertBefore() {}, removeAttribute() {} }),
    addEventListener() {}, head: { appendChild() {} }, body: { appendChild() {} }, dispatchEvent() {},
  };
  const location = { hostname: 'www.admira.store', host: 'www.admira.store', href: 'https://www.admira.store/', pathname: '/', search: '', hash: '', origin: 'https://www.admira.store', assign: (u) => fuera.push(u) };
  const storage = { _m: {}, getItem(k) { return k in this._m ? this._m[k] : null; }, setItem(k, v) { this._m[k] = String(v); }, removeItem(k) { delete this._m[k]; } };
  const sandbox = {
    document, location, localStorage: storage, sessionStorage: storage, URL, URLSearchParams,
    dispatchEvent() {}, addEventListener() {}, MutationObserver: class { observe() {} disconnect() {} },
    CustomEvent: class { constructor(t, i) { this.type = t; this.detail = i && i.detail; } }, Event: class { constructor(t) { this.type = t; } },
    fetch: async () => ({ ok: false, json: async () => ({}) }), setTimeout: (f) => { f(); return 0; }, clearTimeout() {},
  };
  if (AdmiraAvatar) sandbox.AdmiraAvatar = AdmiraAvatar;
  if (AdmiraBugito) sandbox.AdmiraBugito = AdmiraBugito;
  sandbox.window = sandbox; sandbox.globalThis = sandbox;
  vm.runInNewContext(experto, sandbox, { filename: 'experto.js' });
  const log = { children: [], tagName: 'OL', querySelector: () => null, insertBefore(x) { this.children.unshift(x); }, appendChild(x) { this.children.push(x); }, removeChild() {}, get firstChild() { return this.children[0]; }, scrollTop: 0, scrollHeight: 0 };
  return { api: sandbox.AdmiraExperto, fuera, run: (t) => sandbox.AdmiraExperto.exec(t, log, { echo: false }), texto: () => log.children.map((li) => li.textContent).join('\n') };
}

test('/bugito está en el ⌘ Experto y en /help, en castellano y en inglés', async () => {
  const c = consola();
  assert.equal(c.api.has('bugito'), true);
  await c.run('/help');
  assert.match(c.texto(), /\/bugito/);
  assert.match(c.texto(), /banco de pruebas de Bugito/);
  const en = consola({ lang: 'en' });
  await en.run('/help');
  assert.match(en.texto(), /Bugito's test bench/);
});

test('/bugito va por el mismo camino que /admirito: el cargador avatar.js', async () => {
  const llamadas = [];
  const AdmiraAvatar = { handle: (t) => { llamadas.push(t); return Promise.resolve(t === '/bugito popup' ? 'Bugito: ¡Popup va!' : 'ok'); }, bugito: { url() {} } };
  const c = consola({ AdmiraAvatar });
  await c.run('/bugito popup');
  await c.run('/admirito');
  assert.deepEqual(llamadas, ['/bugito popup', '/admirito']);
  assert.match(c.texto(), /¡Popup va!/);
  assert.match(experto, /var AVATAR_SRC = 'https:\/\/www\.admiranext\.com\/assets\/avatar\.js\?v=20261014-bugito-1';/, 'carga el avatar.js que conoce a Bugito');
});

test('con un avatar.js anterior (sin Bugito): en el banco usa la página; fuera, abre el banco', async () => {
  const viejo = { handle: () => Promise.resolve('Usa /avatar avatar…') };
  const pedidos = [];
  const enBanco = consola({ AdmiraAvatar: viejo, AdmiraBugito: { toggle: () => 'Bugito oculto', lanzar: (x) => { pedidos.push(x); return 'Lanzado ' + x; } } });
  await enBanco.run('/bugito');
  await enBanco.run('/bugito popup');
  assert.deepEqual(pedidos, ['popup']);
  assert.match(enBanco.texto(), /Bugito oculto/);
  const fuera = consola({ AdmiraAvatar: viejo });
  await fuera.run('/bugito');
  assert.deepEqual(fuera.fuera, ['https://www.admira.biz/bugito.html?lang=es']);
  assert.match(fuera.texto(), /abriendo su banco de pruebas/);
});

test('en piel (la pata conserva su CLI), la suite intercepta /bugito igual que /demo e /idioma', () => {
  const i = experto.indexOf('function sharedCommand(');
  const cuerpo = experto.slice(i, experto.indexOf('\n  }', i));
  assert.match(cuerpo, /\/\^\\\/bugito\(\?:\\s\|\$\)\/i\.test\(t\)/);
  assert.match(experto, /if \(!val \|\| \(!adapterOwnsInput && !cfg\.mount && !sharedCommand\(val\)\)\) return;/);
});
