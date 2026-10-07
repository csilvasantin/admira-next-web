// /subdemos (7-oct-2026): catálogo de demos globales y subdemos, y guion por proyecto.
import test from 'node:test';
import assert from 'node:assert/strict';
import {GLOBALES, PROYECTOS_INICIALES, resolver, guion, guionTexto} from '../subdemos/catalogo.mjs';

test('cinco demos globales, las mismas que /demo del Experto', () => {
  assert.deepEqual(GLOBALES.map((g) => g.id), ['studio', 'store', 'tv', 'app', 'biz']);
  for (const g of GLOBALES) { assert.ok(g.subdemos.length); for (const s of g.subdemos) assert.match(s.url, /^https:\/\//); }
});
test('subdemos pedidas: tpv, digital signage y audiencia', () => {
  assert.equal(resolver('store/tpv').sub.cmd, '/demo tpv');
  assert.ok(resolver('store/signage').sub);
  assert.ok(resolver('tv/audiencia').sub);
  assert.equal(resolver('store/nada'), null);
  assert.equal(resolver('foo'), null);
});
test('guion en orden del catálogo y en texto', () => {
  const pasos = guion(['biz', 'store/tpv', 'studio']);
  assert.deepEqual(pasos.map((p) => p.clave), ['studio', 'store/tpv', 'biz']);
  const t = guionTexto(PROYECTOS_INICIALES[0]);
  assert.match(t, /^Alsea · Starbucks · guion de demo/);
  assert.match(t, /Experto: \/demo tpv/);
});
