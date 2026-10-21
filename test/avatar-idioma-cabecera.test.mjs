// Idioma del avatar en la cabecera del panel (Carlos, 18-oct-2026): «el idioma del avatar se pone arriba a la derecha de
// Admirito y a la izquierda de la cruz de cerrar para dejar espacio para el campo de texto». Las caras se abren con
// langui=host (digitalavatar.ai esconde sus pastillas ESP/ENG) y cambian de idioma con {type:'da-context', lang}.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const avatar = readFileSync(new URL('../assets/avatar.js', import.meta.url), 'utf8');

function cargador() {
  const module = { exports: {} };
  vm.runInNewContext(avatar, { module, globalThis: {}, window: undefined });
  return module.exports;
}
// El cargador entero en una ventana de mentira, con el idioma de la página y lo guardado en la pestaña.
function ventana({ lang = 'es', elegido = null } = {}) {
  const el = () => ({ style: { setProperty() {}, removeProperty() {}, getPropertyValue: () => '' }, classList: { add() {}, remove() {}, contains: () => false, toggle() {} }, setAttribute() {}, getAttribute: () => null,
    removeAttribute() {}, appendChild() {}, addEventListener() {}, querySelector: () => null, querySelectorAll: () => [], dataset: {}, textContent: '' });
  const document = { documentElement: { ...el(), lang }, currentScript: { dataset: {} }, readyState: 'complete', body: el(), head: el(),
    getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: el, addEventListener() {} };
  const storage = () => ({ _m: {}, getItem(k) { return k in this._m ? this._m[k] : null; }, setItem(k, v) { this._m[k] = String(v); }, removeItem(k) { delete this._m[k]; } });
  const sesion = storage();
  if (elegido) sesion.setItem('admira-avatar:idioma', elegido);
  const w = { document, localStorage: storage(), sessionStorage: sesion, URLSearchParams, URL, setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0,
    location: { host: 'www.admira.store', hostname: 'www.admira.store', origin: 'https://www.admira.store', search: '', assign() {} }, addEventListener() {}, dispatchEvent: () => true,
    fetch: async () => ({ ok: false, json: async () => ({}) }), getComputedStyle: () => ({}), innerWidth: 1280, innerHeight: 800, MutationObserver: class { observe() {} } };
  w.window = w; w.globalThis = w;
  vm.runInNewContext(avatar, w, { filename: 'avatar.js' });
  return w.AdmiraAvatar;
}

test('las tres caras y los personajes se abren con langui=host: la cara no pinta sus pastillas ESP/ENG', () => {
  const A = cargador();
  for (const lv of ['good', 'better', 'best']) assert.match(A.LEVELS[lv], /[?&]langui=host(?:&|$)/, lv);
  for (const id of ['bugito', 'arquitecto', 'supervisor']) assert.match(A.personajeUrl(id, { lang: 'en' }), /[?&]langui=host&v=20261021-assistants-1&personaje=/, id);
  assert.match(A.levelUrl('good', { lang: 'en' }), /langui=host.*&lang=en&tier=good/);
});

test('cabecera del panel: pastilla del avatar, luego ESP/ENG y a su derecha ✕', () => {
  const i = avatar.indexOf('id="da-suite-label"'), j = avatar.indexOf('id="da-suite-lang"'), k = avatar.indexOf('id="da-suite-x"');
  assert.ok(i > 0 && i < j && j < k, 'orden: AVATAR · Admirito › · ESP ENG · ✕');
  assert.match(avatar, /<span id="da-suite-lang" class="da-lang" role="group" aria-label="' \+ \(en\(\) \? 'Avatar language' : 'Idioma del avatar'\) \+ '"><button type="button" data-lang="es" aria-label="Español">ESP<\/button><button type="button" data-lang="en" aria-label="English">ENG<\/button><\/span>/);
  assert.match(avatar, /\.da-lang button\[aria-pressed=true\]\{background:#c0f3e6;color:#09281f\}/, 'el mismo aspecto que tenían en la barra de la cara');
  assert.match(avatar, /#da-suite-label\{min-width:0\}#da-suite-label \.da-pill-txt\{overflow:hidden;text-overflow:ellipsis;white-space:nowrap\}/, 'en un panel estrecho se recorta el nombre, no los botones');
});

test('lo elegido en la cabecera manda en la cara hasta que la página cambia de idioma', () => {
  assert.equal(ventana({ lang: 'es' }).state().context.lang, 'es', 'sin elección, el de la página');
  assert.equal(ventana({ lang: 'es', elegido: 'en' }).state().context.lang, 'en', 'con ENG en la cabecera, la cara en inglés');
  assert.equal(ventana({ lang: 'en', elegido: 'es' }).state().context.lang, 'es');
  assert.equal(ventana({ lang: 'es', elegido: 'fr' }).state().context.lang, 'es', 'un valor raro no vale');
  assert.match(avatar, /function elegirIdioma\(lang\) \{[\s\S]{0,200}s\.setItem\(IDIOMA_KEY, lang\)[\s\S]{0,80}pintarIdioma\(\); postContext\(\);/, 'al elegir, se manda a la cara con da-context');
  assert.match(avatar, /new MutationObserver\(idiomaDePagina\)\.observe\(doc\.documentElement, \{attributes: true, attributeFilter: \['lang'\]\}\)/, 'si la página cambia de idioma, manda la página');
  assert.match(avatar, /function idiomaDePagina\(\) \{\n    var s = session\(\); try \{ if \(s\) s\.removeItem\(IDIOMA_KEY\); \} catch \(_\) \{\}/);
});
