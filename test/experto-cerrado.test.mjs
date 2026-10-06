// ⌘ Experto CERRADO por defecto (Carlos, 6-oct-2026): quien entra por primera vez en una pata de la
// suite (sin almacenamiento ni parámetros) no ve el modo Experto; solo aparece al abrirlo a propósito.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(dir, '../suite/experto.js'), 'utf8');
const admiranext = readFileSync(join(dir, '../assets/experto-admiranext.js'), 'utf8');

function cargar(dataset, guardado) {
  const store = () => ({ _m: {}, getItem(k) { return k in this._m ? this._m[k] : null; }, setItem(k, v) { this._m[k] = String(v); }, removeItem(k) { delete this._m[k]; } });
  const localStorage = store(), sessionStorage = store();
  Object.assign(localStorage._m, guardado || {});
  const documentElement = { lang: 'es', dataset: {}, setAttribute() {}, getAttribute() { return null; }, classList: { contains: () => false, add() {}, toggle() {} } };
  const document = {
    documentElement, currentScript: { dataset: dataset || {} }, readyState: 'complete',
    querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, dispatchEvent() {},
    head: { appendChild() {} }, body: { appendChild() {} },
  };
  const location = { hostname: 'admira.app', href: 'https://admira.app/', pathname: '/', search: '', hash: '', origin: 'https://admira.app', assign() {} };
  const sandbox = {
    document, location, localStorage, sessionStorage, URL, setTimeout, clearTimeout,
    fetch: async () => ({ ok: false, json: async () => ({}) }),
    MutationObserver: class { observe() {} disconnect() {} },
    CustomEvent: class { constructor(t) { this.type = t; } }, Event: class { constructor(t) { this.type = t; } },
    dispatchEvent() {}, addEventListener() {},
  };
  sandbox.window = sandbox; sandbox.globalThis = sandbox;
  vm.runInNewContext(src, sandbox, { filename: 'experto.js' });
  return { api: sandbox.AdmiraExperto, localStorage, sessionStorage };
}

test('la clave antigua de localStorage que reabría el Experto en cada visita se borra al cargar', () => {
  const { api, localStorage } = cargar({}, { 'ax-experto-abierto': '1', 'mb:otro': 'x' });
  assert.equal(localStorage.getItem('ax-experto-abierto'), null);
  assert.equal(localStorage.getItem('mb:otro'), 'x');
  assert.equal(api.isOpen(), false, 'sin panel montado no está abierto');
});

test('cerrado = oculto por defecto; la línea solo con data-min="line" o modo propio sin ⌘', () => {
  assert.match(src, /minHide: ds\.min === 'hide' \|\| \(ds\.min !== 'line' && !\(ds\.mount && ds\.toggle === ''\)\)/);
});

test('abierto/cerrado solo se recuerda en la pestaña (sessionStorage), nunca entre visitas', () => {
  assert.match(src, /function dockStore\(\) \{ try \{ return root\.sessionStorage; \}/);
  assert.doesNotMatch(src, /cfg\.minHide \? root\.sessionStorage : root\.localStorage/);
  // Al montar, solo un «1» de esta pestaña lo abre; sin nada guardado arranca cerrado.
  assert.match(src, /open = dockStore\(\)\.getItem\(DOCK_KEY\) === '1'/);
  assert.match(src, /var open = false;/);
});

test('admiranext.com: la home conserva el asa de una línea (data-min="line")', () => {
  assert.match(admiranext, /mount: '#axAdmiranextExperto', 'mount-body': '\.ax-host-bd', min: 'line'/);
});
