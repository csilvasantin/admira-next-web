import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

// El entrenador de ritmo leía data-presenter-seconds por lámina y NADIE lo escribía:
// el ensayo repartía el tiempo a partes iguales entre las láminas de contenido, así que
// «dónde encaja NVIDIA» y «dónde aterriza» valían lo mismo. Este test fija las dos mitades
// del contrato —quien lo lee y quien lo escribe— porque el fallo era justo que no se tocaban.
const renderer = () => readFile(new URL('../functions/presentaciones/[client]/presentacion.js', import.meta.url), 'utf8');
const coach = () => readFile(new URL('../assets/presentation-presenter-mode.js', import.meta.url), 'utf8');

test('el ensayo lee el tiempo por lámina y el render lo escribe', async () => {
  const [pintado, entrenador] = await Promise.all([renderer(), coach()]);
  assert.match(entrenador, /getAttribute\('data-presenter-seconds'\)/,
    'el entrenador de ritmo tiene que seguir leyendo el tiempo declarado por lámina');
  assert.match(pintado, /data-presenter-seconds="/,
    'el render tiene que escribirlo, o el atributo es letra muerta');
  assert.match(pintado, /presenterSeconds\(item\)/,
    'y tiene que salir del bloque del esqueleto, no de una constante');
});

test('un bloque sin tiempo declarado no ensucia el HTML', async () => {
  const pintado = await renderer();
  const fuente = pintado.match(/const presenterSeconds=item=>\{[\s\S]*?\n  \};/)?.[0];
  assert.ok(fuente, 'no encuentro la función que calcula el tiempo por lámina');
  // Se evalúa la función tal cual está escrita en el render: si alguien la cambia por
  // algo que no cumple el contrato, este test se entera. Sin recortes ni parafraseos.
  const presenterSeconds = new Function(`${fuente} return presenterSeconds;`)();
  assert.equal(presenterSeconds({}), '', 'sin minutos declarados no se escribe atributo');
  assert.equal(presenterSeconds({minutes: 3}), ' data-presenter-seconds="180"');
  assert.equal(presenterSeconds({seconds: 95}), ' data-presenter-seconds="95"');
  assert.equal(presenterSeconds({minutes: -2}), '', 'un tiempo imposible no se escribe');
  assert.equal(presenterSeconds({minutes: 999}), ' data-presenter-seconds="3600"', 'con tope de una hora');
});

test('el guardado de ideas conserva los minutos, o el resto no sirve de nada', async () => {
  const fuente = await readFile(new URL('../functions/presentaciones/[client]/api/ideas.js', import.meta.url), 'utf8');
  assert.match(fuente, /\.\.\.minutosDeEnsayo\(item\)/,
    'el esqueleto guardado tiene que arrastrar los minutos declarados');
  const cuerpo = fuente.match(/function minutosDeEnsayo\(item\)\{[\s\S]*?\n\}/)?.[0];
  assert.ok(cuerpo, 'no encuentro la normalizacion de minutos del guardado');
  const minutos = new Function(`${cuerpo} return minutosDeEnsayo;`)();
  assert.deepEqual(minutos({minutes: 3.5}), {minutes: 3.5});
  assert.deepEqual(minutos({seconds: 90}), {minutes: 1.5});
  assert.deepEqual(minutos({}), {}, 'sin declarar no se inventa un tiempo');
  assert.deepEqual(minutos({minutes: 0}), {});
  assert.deepEqual(minutos({minutes: 5000}), {minutes: 60}, 'con el mismo tope que el render');
});

test('la proyeccion a la vista no se come el tiempo declarado', async () => {
  const fuente = await renderer();
  const cuerpo = fuente.match(/function visibleBlock\(value=\{\}\)\{[\s\S]*?\n\}/)?.[0];
  assert.ok(cuerpo, 'no encuentro visibleBlock');
  const visibleBlock = new Function(`${cuerpo} return visibleBlock;`)();
  assert.equal(visibleBlock({id: 'x', minutes: 3.5}).minutes, 3.5, 'los minutos llegan a la lamina');
  assert.equal(visibleBlock({id: 'x', seconds: 90}).seconds, 90);
  assert.equal('minutes' in visibleBlock({id: 'x'}), false, 'sin declarar, el bloque no inventa tiempo');
});
