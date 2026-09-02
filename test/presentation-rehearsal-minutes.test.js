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
