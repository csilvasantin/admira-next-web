import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {normalizeEmbeds, MAX_EMBEDS_POR_PRESENTACION} from '../functions/presentaciones/_embeds.js';

const lee = (ruta) => readFile(new URL('../' + ruta, import.meta.url), 'utf8');

test('sólo entran URLs https, y sin repetir', () => {
  const salida = normalizeEmbeds([
    'https://www.xpaceos.com/',
    'http://inseguro.test/',          // un iframe http dentro de https lo bloquea el navegador
    'javascript:alert(1)',
    'https://www.xpaceos.com/',       // repetida: no aporta una segunda lámina
    'no-es-una-url'
  ]);
  assert.equal(salida.length, 1);
  assert.equal(salida[0].url, 'https://www.xpaceos.com/');
  assert.equal(salida[0].host, 'www.xpaceos.com');
  assert.equal(salida[0].title, 'xpaceos.com', 'sin título, el host sin www');
});

test('el formulario los pega como texto y también valen', () => {
  const salida = normalizeEmbeds('https://www.xpaceos.com/  XpaceOS\n\nhttps://www.admira.tv/ Admira TV\n');
  assert.deepEqual(salida.map(x => x.title), ['XpaceOS', 'Admira TV']);
  assert.deepEqual(salida.map(x => x.url), ['https://www.xpaceos.com/', 'https://www.admira.tv/']);
});

test('hay un tope, porque cada embebido es una web entera cargándose', () => {
  const muchas = Array.from({length: 9}, (_, i) => `https://demo${i}.test/`);
  assert.equal(normalizeEmbeds(muchas).length, MAX_EMBEDS_POR_PRESENTACION);
});

test('el iframe nace inerte y se carga cuando toca', async () => {
  const deck = await lee('functions/presentaciones/[client]/presentacion.js');
  assert.match(deck, /data-embed-idle="1"/, 'inerte al nacer');
  assert.match(deck, /\[data-embed-idle\] iframe\{pointer-events:none\}/,
    'sin esto la web embebida se traga la rueda y el deck deja de pasar de lámina');
  assert.match(deck, /data-embed-src/, 'la URL no va en src hasta que se necesita');
  assert.match(deck, /IntersectionObserver/, 'cinco webs cargando a la vez hunden la apertura');
  assert.match(deck, /rel="noopener noreferrer"/, 'y siempre hay salida a pestaña propia');
});

test('el generador tiene dónde pegarlas y el alta las acepta', async () => {
  const [form, generate, ideas] = await Promise.all([
    lee('presentaciones/generador.html'),
    lee('functions/presentaciones/api/generate.js'),
    lee('functions/presentaciones/[client]/api/ideas.js')
  ]);
  assert.match(form, /name="embeds"/, 'el campo tiene que estar en el formulario');
  assert.match(generate, /ideas\.embeds=embeds/, 'y llegar al esqueleto al crear');
  assert.match(ideas, /embeds: normalizeEmbeds\(payload\.embeds\)/, 'y sobrevivir al guardado');
});
