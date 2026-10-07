// /subdemos (7-oct-2026): catálogo de demos globales y subdemos, y guion por proyecto.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GLOBALES, PROYECTOS_INICIALES, MANIFIESTOS, aplicarManifiesto, resolver, guion, guionTexto, proyectoLimpio} from '../subdemos/catalogo.mjs';

test('para empezar tres plataformas: biz, store y studio', () => {
  assert.deepEqual(GLOBALES.map((g) => g.id), ['biz', 'store', 'studio']);
  assert.deepEqual(GLOBALES[0].subdemos.map((s) => s.letra + ':' + s.id), ['a:proyecto', 'b:circuito', 'c:gemelo', 'd:iot', 'e:itil']);
  for (const g of GLOBALES) { assert.ok(g.subdemos.length); for (const s of g.subdemos) assert.match(s.url, /^https:\/\//); }
});
test('subdemos: alta en admira.biz, tpv y digital signage anterior conservado', () => {
  assert.equal(resolver('store/tpv').sub.cmd, '/demo 5');
  assert.ok(resolver('store/signage').sub);
  assert.ok(resolver('biz/itil').sub);
  assert.equal(resolver('tv/audiencia'), null);
  assert.equal(resolver('store/nada'), null);
  assert.equal(resolver('foo'), null);
});
test('guion en orden del catálogo y en texto', () => {
  const pasos = guion(['studio', 'store/tpv', 'biz/gemelo', 'biz']);
  assert.deepEqual(pasos.map((p) => p.clave), ['biz', 'biz/gemelo', 'store/tpv', 'studio']);
  assert.equal(pasos[1].titulo, 'admira.biz · c. Dar de alta gemelos digitales · Retail Media');
  const t = guionTexto(PROYECTOS_INICIALES[0]);
  assert.match(t, /^Alsea · Starbucks · guion de demo/);
  assert.match(t, /Experto: \/demo 5/);
});

test('admira.studio: a locución, b música, c imagen, d vídeo, e adaptar formatos; manifiesto publicado igual', () => {
  const studio = GLOBALES.find((g) => g.id === 'studio');
  assert.deepEqual(studio.subdemos.map((s) => s.letra + ':' + s.id), ['a:voz', 'b:musica', 'c:imagen', 'd:video', 'e:adaptar']);
  assert.ok(MANIFIESTOS.includes('studio'));
  const m = JSON.parse(readFileSync(new URL('../subdemos/studio.subdemos.json', import.meta.url), 'utf8'));
  assert.equal(m.plataforma, 'studio');
  assert.deepEqual(m.subdemos.map((s) => s.id), studio.subdemos.map((s) => s.id));
});
test('aplicarManifiesto sustituye las subdemos con steps y rechaza lo inválido', () => {
  const studio = GLOBALES.find((g) => g.id === 'studio'), antes = studio.subdemos;
  try {
    assert.equal(aplicarManifiesto({version: 1, plataforma: 'studio', subdemos: [{id: 'x', letra: 'a', nombre: 'X', desc: 'd', url: 'https://www.admira.studio/', steps: ['uno', 'dos']}]}), 'studio');
    assert.match(guionTexto({nombre: 'P', demos: ['studio/x']}), /- uno\n   - dos/);
    assert.throws(() => aplicarManifiesto({plataforma: 'nada', subdemos: []}));
    assert.throws(() => aplicarManifiesto({plataforma: 'studio', subdemos: [{id: 'y', nombre: 'Y', url: 'javascript:alert(1)'}]}));
    assert.equal(studio.subdemos[0].id, 'x');
  } finally { studio.subdemos = antes; }
});

test('aplicarManifiesto conserva objetos del pack de Trinity (steps, muestra, guion, variantes, alias)', () => {
  const studio = GLOBALES.find((g) => g.id === 'studio'), antes = studio.subdemos;
  try {
    const m = JSON.parse(readFileSync(new URL('../subdemos/studio.subdemos.json', import.meta.url), 'utf8'));
    m.subdemos[0].steps = [{accion: 'di', texto: 'hola'}];
    assert.equal(aplicarManifiesto(m), 'studio');
    const [voz, , , , adaptar] = studio.subdemos;
    assert.deepEqual(voz.steps, [{accion: 'di', texto: 'hola'}]);
    assert.equal(typeof voz.muestra, 'object');
    assert.equal(voz.muestra.url, m.subdemos[0].muestra.url);
    assert.deepEqual(voz.guion, m.subdemos[0].guion);
    assert.deepEqual(voz.aliases, ['locucion', 'voz']);
    assert.equal(adaptar.muestra.variantes.length, m.subdemos[4].muestra.variantes.length);
    assert.equal(typeof adaptar.muestra.variantes[0], 'object');
    const txt = guionTexto({nombre: 'P', demos: ['studio/voz']});
    assert.match(txt, /- di: hola/);
    assert.doesNotMatch(txt, /\[object Object\]/);
    assert.match(txt, /Muestra: https:\/\/www\.pixeria\.com\/assets\/demos\/studio-v1\//);
    // Ids antiguos guardados en un navegador siguen apuntando a la subdemo nueva.
    assert.deepEqual(guion(['studio/locucion', 'studio/formatos']).map((p) => p.clave), ['studio/voz', 'studio/adaptar']);
  } finally { studio.subdemos = antes; }
});

test('proyecto: presentation_id y contexto {marca, loc, circuito} opcionales', () => {
  const alsea = PROYECTOS_INICIALES[0];
  assert.deepEqual(alsea.contexto, {marca: 'starbucks', loc: 'alsea-sbux-021', project: 'starbucks', circuito: 'alsea_starbucks'});
  assert.equal(alsea.presentation_id, undefined);
  assert.deepEqual(proyectoLimpio({id: 'x', nombre: 'X', demos: ['biz']}), {id: 'x', nombre: 'X', nota: '', demos: ['biz']});
  const p = proyectoLimpio({id: 'x', nombre: 'X', demos: [], presentation_id: ' alsea-2026 ', contexto: {marca: 'starbucks', loc: '', otro: 'no'}});
  assert.deepEqual(p, {id: 'x', nombre: 'X', nota: '', demos: [], presentation_id: 'alsea-2026', contexto: {marca: 'starbucks'}});
  assert.match(guionTexto({...alsea, presentation_id: 'alsea-2026'}), /^Alsea · Starbucks · guion de demo\nPresentación: alsea-2026\nmarca starbucks · loc alsea-sbux-021 · project starbucks · circuito alsea_starbucks\n1\./);
});
