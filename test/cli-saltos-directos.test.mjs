// Saltos directos del CLI de la portada (Carlos, 2-oct-2026): escribir
// «analitics», «presentations» o «webmaster» lleva directamente a la solución.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../assets/app.js', import.meta.url), 'utf8');

function cargarSaltos() {
  const inicio = app.indexOf('  const SALTOS = [');
  const fin = app.indexOf("  window.AdmiraSaltos = ", inicio);
  assert.ok(inicio > 0 && fin > inicio, 'la tabla SALTOS existe');
  const codigo = app.slice(inicio, fin) + '\nreturn { SALTOS, buscarSalto };';
  return new Function(codigo)();
}

test('las palabras que pidió Carlos saltan a su solución, con o sin barra y sin acentos', () => {
  const { buscarSalto } = cargarSaltos();
  const casos = {
    'analitics': '/analitics', '/analitics': '/analitics', 'Analytics': '/analitics', 'analítica': '/analitics',
    'presentations': '/presentaciones/', 'presentaciones': '/presentaciones/', '/Presentaciones/': '/presentaciones/',
    'webmaster': '/webmaster', '/webmaster': '/webmaster',
    'studio': 'https://www.admira.studio/', 'store': 'https://www.admira.store/',
    'app': 'https://www.admira.app/', 'biz': 'https://www.admira.biz/',
  };
  for (const [entrada, url] of Object.entries(casos)) {
    assert.equal(buscarSalto(entrada)?.url, url, entrada);
  }
  assert.equal(buscarSalto('/help'), null);
  assert.equal(buscarSalto('about'), null);
});

test('ningún alias apunta a dos soluciones y todos los destinos son internos o de las 4 patas', () => {
  const { SALTOS } = cargarSaltos();
  const vistos = new Map();
  for (const s of SALTOS) {
    assert.ok(s.es && s.en, `${s.id} tiene texto ES/EN`);
    assert.match(s.url, /^(\/[a-z-]+\/?|https:\/\/www\.admira\.(studio|store|app|biz)\/)$/, s.url);
    for (const a of s.alias) {
      assert.ok(!vistos.has(a), `alias repetido: ${a}`);
      vistos.set(a, s.id);
    }
  }
});

test('el salto se resuelve antes que el resto de comandos y aparece en /help', () => {
  const exec = app.indexOf('function executeCommand(input)');
  const hook = app.indexOf('const salto = buscarSalto(raw);', exec);
  const ocultos = app.indexOf('const hiddenFn = HIDDEN_COMMANDS[raw];', exec);
  assert.ok(exec > 0 && hook > exec && hook < ocultos, 'el salto va antes que los comandos ocultos');
  assert.match(app.slice(hook, hook + 1200), /window\.location\.assign\(salto\.url\)/, 'navega en la misma pestaña');
  const ayuda = app.slice(app.indexOf('function buildHelpLines'), app.indexOf('function renderHelpLinesInto'));
  assert.match(ayuda, /Saltar directamente a/);
  assert.match(ayuda, /SALTOS\.forEach/);
});
