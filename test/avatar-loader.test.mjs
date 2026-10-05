// Cargador compartido del avatar (assets/avatar.js): piezas puras y precedencia.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const src = readFileSync(new URL('../assets/avatar.js', import.meta.url), 'utf8');
function load() {
  const module = {exports: {}};
  vm.runInNewContext(src, {module, globalThis: {}, window: undefined});
  return module.exports;
}
const A = load();
const R = (o, f) => JSON.parse(JSON.stringify(A.resolve(o, f)));

test('verbos nuevos y alias antiguos', () => {
  assert.equal(A.decide('/avatarON'), 'on');
  assert.equal(A.decide('/avatarOFF'), 'off');
  assert.equal(A.decide('/avatar'), 'status');
  assert.equal(A.decide('/avatar good'), 'good');
  assert.equal(A.decide('/avatar better'), 'better');
  assert.equal(A.decide('/avatar best'), 'best');
  assert.equal(A.decide('avatar on'), 'on');
  assert.equal(A.decide('/avatar ocultar'), 'off');
  assert.equal(A.decide('/avatar reset'), 'reset');
  assert.equal(A.decide('/avatar xyz'), 'bad');
  assert.equal(A.decide('/avatarDigital'), 'mascota');
  assert.equal(A.decide('/avatar Digital'), 'mascota');
  assert.equal(A.decide('/AVATAR digital'), 'mascota');
  assert.equal(A.decide('/admirito'), 'mascota');
  assert.equal(A.decide('/Admirito off'), 'off');
  assert.equal(A.decide('/avatar digital on'), 'on');
  assert.equal(A.decide('/avatar'), 'status');
  assert.equal(A.decide('/digitalAvatar'), 'status');
  assert.equal(A.decide('/digitalAvatar off'), 'off');
  assert.equal(A.decide('/cli ayudante on'), 'on');
  assert.equal(A.decide('/cli helper'), 'toggle');
  assert.equal(A.decide('/cli demo'), null);
  assert.equal(A.decide('/help'), null);
  assert.equal(A.decide('/avatares'), null);
});

test('good es el calvo, better la chica y best Neo', () => {
  assert.equal(A.LEVELS.good, 'https://digitalavatar.ai/better.html?dock=1');
  assert.equal(A.LEVELS.better, 'https://digitalavatar.ai/best.html?dock=1&kiosk=0');
  assert.equal(A.LEVELS.best, 'https://digitalavatar.ai/metahuman.html?dock=1');
  assert.match(A.message('status', false), /good/);
  assert.match(A.message('status', false), /better/);
  assert.match(A.message('status', false), /best/);
  assert.match(A.message('best', false), /MetaHuman/);
  assert.doesNotMatch(A.message('best', false), /chica|apagado/);
  assert.match(A.message('status', false), /Neo, MetaHuman/);
  assert.doesNotMatch(A.message('status', false), /apagado/);
});

test('el panel respeta mínimo, máximo y el tope de 64 px', () => {
  assert.equal(A.SIZE_KEY, 'admira-avatar:size');
  const plain = (o) => JSON.parse(JSON.stringify(o));
  const desk = {w: 1280, h: 800, top: 64, bottom: 20};
  assert.deepEqual(plain(A.clampPanelSize(100, 100, desk)), {w: 240, h: 180});
  assert.deepEqual(plain(A.clampPanelSize(400, 680, desk)), {w: 400, h: 680});
  assert.deepEqual(plain(A.clampPanelSize(5000, 5000, desk)), {w: 1248, h: 716});
  assert.deepEqual(plain(A.clampPanelSize(5000, 5000, {w: 1280, h: 800, top: 10, bottom: 20})), {w: 1248, h: 716});
  assert.deepEqual(plain(A.clampPanelSize(5000, 5000, {w: 1280, h: 800, top: 120, bottom: 20})), {w: 1248, h: 660});
  assert.deepEqual(
    plain(A.panelSizeAfterDrag({w: 400, h: 300}, {x: 100, y: 80}, {x: 160, y: 140}, desk)),
    {w: 460, h: 360}
  );
  assert.match(src, /id="da-suite-resize"/);
  assert.match(src, /setPointerCapture/);
  assert.match(src, /touch-action:none/);
  assert.match(src, /pointer-events/);
  assert.match(src, /width:44px;height:44px/);
  assert.equal(A.LEVELS.best, 'https://digitalavatar.ai/metahuman.html?dock=1');
  assert.doesNotMatch(src, /ts\.net/);
  assert.doesNotMatch(src, /probeNeo|neoVerdict|faceChoice|NEO_WS/);
});

test('precedencia: elección del usuario > interruptor del proyecto > apagado', () => {
  assert.deepEqual(R('on', false), {on: true, source: 'usuario'});
  assert.deepEqual(R('off', true), {on: false, source: 'usuario'});
  assert.deepEqual(R(null, true), {on: true, source: 'proyecto'});
  assert.deepEqual(R(null, false), {on: false, source: 'proyecto'});
  assert.deepEqual(R(null, null), {on: false, source: 'defecto'});
});

test('migra el interruptor por sitio de FLT-101350', () => {
  assert.equal(A.legacyValue('1'), 'on');
  assert.equal(A.legacyValue('0'), 'off');
  assert.equal(A.legacyValue(null), null);
});

test('un solo panel y las tres caras viven en digitalavatar.ai', () => {
  assert.equal(Object.keys(A.LEVELS).length, 3);
  assert.equal((src.match(/da-suite/g) || []).length > 0, true);
  assert.match(src, /#da-suite-panel\{display:none\}#da-suite\.open #da-suite-bubble\{display:none\}#da-suite\.open #da-suite-panel\{display:flex\}/);
  assert.doesNotMatch(src, /id="da-suite-panel" style="display:none/);
  assert.equal((src.match(/digitalavatar\.ai\/embed\.js/g) || []).length, 0);
  assert.equal(A.CENTRAL_BRAIN, 'https://www.admiranext.com/api/avatar-ask');
  assert.equal(A.FLAGS_URL, 'https://www.admiranext.com/api/avatar/flags');
});

test('el encendido automático no guarda la elección del usuario', () => {
  const boot = src.slice(src.indexOf('function boot()'));
  const body = boot.slice(0, boot.indexOf('\n  }\n'));
  assert.doesNotMatch(body, /set\(KEY/);
  assert.match(body, /show\(false\)/); // burbuja cerrada
});
