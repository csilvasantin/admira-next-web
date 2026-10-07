// /subdemos (7-oct-2026): catálogo de demos globales y subdemos, y guion por proyecto.
import test from 'node:test';
import assert from 'node:assert/strict';
import {GLOBALES, PROYECTOS_INICIALES, resolver, guion, guionTexto} from '../subdemos/catalogo.mjs';

test('para empezar tres plataformas: biz, store y studio', () => {
  assert.deepEqual(GLOBALES.map((g) => g.id), ['biz', 'store', 'studio']);
  assert.deepEqual(GLOBALES[0].subdemos.map((s) => s.letra + ':' + s.id), ['a:proyecto', 'b:circuito', 'c:gemelo', 'd:iot', 'e:itil']);
  for (const g of GLOBALES) { assert.ok(g.subdemos.length); for (const s of g.subdemos) assert.match(s.url, /^https:\/\//); }
});
test('subdemos: alta en admira.biz, tpv y digital signage', () => {
  assert.equal(resolver('store/tpv').sub.cmd, '/demo tpv');
  assert.ok(resolver('store/signage').sub);
  assert.ok(resolver('biz/itil').sub);
  assert.equal(resolver('tv/audiencia'), null);
  assert.equal(resolver('store/nada'), null);
  assert.equal(resolver('foo'), null);
});
test('guion en orden del catálogo y en texto', () => {
  const pasos = guion(['studio', 'store/tpv', 'biz/gemelo', 'biz']);
  assert.deepEqual(pasos.map((p) => p.clave), ['biz', 'biz/gemelo', 'store/tpv', 'studio']);
  assert.equal(pasos[1].titulo, 'admira.biz · c. Alta de gemelo digital');
  const t = guionTexto(PROYECTOS_INICIALES[0]);
  assert.match(t, /^Alsea · Starbucks · guion de demo/);
  assert.match(t, /Experto: \/demo tpv/);
});
