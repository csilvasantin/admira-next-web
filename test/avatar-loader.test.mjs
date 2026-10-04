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
  assert.equal(A.decide('/avatar'), 'toggle');
  assert.equal(A.decide('avatar on'), 'on');
  assert.equal(A.decide('/avatar ocultar'), 'off');
  assert.equal(A.decide('/avatar reset'), 'reset');
  assert.equal(A.decide('/avatar xyz'), 'bad');
  assert.equal(A.decide('/avatarDigital'), 'toggle');
  assert.equal(A.decide('/digitalAvatar off'), 'off');
  assert.equal(A.decide('/cli ayudante on'), 'on');
  assert.equal(A.decide('/cli helper'), 'toggle');
  assert.equal(A.decide('/cli demo'), null);
  assert.equal(A.decide('/help'), null);
  assert.equal(A.decide('/avatares'), null);
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

test('una sola URL del embed y relé central en admiranext.com', () => {
  assert.equal(A.EMBED_URL, 'https://digitalavatar.ai/embed.js');
  assert.equal((src.match(/digitalavatar\.ai\/embed\.js/g) || []).length, 2); // cabecera + constante
  assert.equal(A.CENTRAL_BRAIN, 'https://www.admiranext.com/api/avatar-ask');
  assert.equal(A.FLAGS_URL, 'https://www.admiranext.com/api/avatar/flags');
});

test('el encendido automático no guarda la elección del usuario', () => {
  const boot = src.slice(src.indexOf('function boot()'));
  const body = boot.slice(0, boot.indexOf('\n  }\n'));
  assert.doesNotMatch(body, /set\(KEY/);
  assert.match(body, /show\(false\)/); // burbuja cerrada
});
