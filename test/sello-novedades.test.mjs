// Sello de versión con novedades (Merovingio, 06-10-2026): cargador común de la suite.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const SRC = fs.readFileSync(new URL('../assets/sello-novedades.js', import.meta.url), 'utf8');

test('el popover vive en body con position:fixed (ningún overflow de un padre lo recorta)', () => {
  assert.match(SRC, /#admira-sello-tip\{position:fixed/);
  assert.match(SRC, /document\.body\.appendChild\(t\)/);
  assert.match(SRC, /getBoundingClientRect/);
});

test('lee el /version.json del propio sitio, marca NUEVO por localStorage y muestra 2-4 líneas', () => {
  assert.match(SRC, /VERSION_URL = ds\.versionUrl \|\| '\/version\.json'/);
  assert.match(SRC, /admira-sello:visto/);
  assert.match(SRC, /\.slice\(0, 4\)/);
  assert.match(SRC, /NUEVO/);
});

test('se apaga en iframes, emisión y kiosco', () => {
  assert.match(SRC, /root\.top !== root/);
  assert.match(SRC, /canal\|player\|virtual-players\|wall\|signage/);
});

test('placeTip encaja el popover en el viewport', () => {
  const listeners = {};
  const doc = {
    readyState: 'complete', body: null, head: { appendChild() {} }, documentElement: { clientWidth: 400, clientHeight: 300, appendChild() {} },
    querySelector: () => null, querySelectorAll: () => [], getElementById: () => null, createElement: () => ({ style: {}, classList: { add() {}, remove() {}, toggle() {} }, setAttribute() {}, appendChild() {}, addEventListener() {} }),
    addEventListener() {}
  };
  const win = { document: doc, location: { search: '', pathname: '/' }, innerWidth: 400, innerHeight: 300, addEventListener: (k, f) => { listeners[k] = f; }, setTimeout: () => 0, setInterval: () => 0 };
  win.top = win;
  const ctx = vm.createContext(Object.assign(win, { window: win, setTimeout: () => 0, setInterval: () => 0, clearTimeout() {} }));
  vm.runInContext(SRC, ctx);
  const place = ctx.AdmiraSello._placeTip;
  const tip = { offsetWidth: 300, offsetHeight: 120, style: {} };
  // Sello pegado a la derecha y arriba: el tip no se sale ni por la derecha ni por arriba.
  const r = place({ getBoundingClientRect: () => ({ left: 380, right: 398, top: 4, bottom: 20 }) }, tip);
  assert.ok(r.left + r.width <= 400 - 8 + 0.5, 'derecha');
  assert.ok(r.top >= 8, 'arriba');
  // Sello abajo a la izquierda: el tip va encima.
  const r2 = place({ getBoundingClientRect: () => ({ left: 12, right: 120, top: 270, bottom: 288 }) }, tip);
  assert.equal(r2.top, 270 - 120 - 8);
  assert.equal(r2.left, 12);
});
