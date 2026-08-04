import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {onRequestGet} from '../functions/presentaciones/generador.js';

// El Generador cargaba su bundle por DOS caminos con DOS claves distintas: la
// función de Pages reescribía el <script> a ?v=20260724-media-library y, fuera
// de </html>, un bloque suelto reinyectaba el MISMO fichero de 51 KB con
// ?v=20260724-credits-postcredits si no encontraba el panel de idiomas. Encima
// la consola de experto del generador enseña window.__ADMIRA_GENERATOR_VERSION__,
// que declaraba «credits-postcredits» mientras se servía la clave «media-library»:
// el operador leía una versión que no era la que estaba corriendo.
//
// Ahora hay un solo camino y una sola clave, y esta prueba impide que vuelvan a
// separarse. (NeoMBP16 · MacBook Pro 16, 4 de agosto de 2026.)

const BUNDLE = 'presentation-generator-20260721-11.js';

async function sources() {
  const [html, bundle, edge] = await Promise.all([
    readFile(new URL('../presentaciones/generador.html', import.meta.url), 'utf8'),
    readFile(new URL(`../assets/${BUNDLE}`, import.meta.url), 'utf8'),
    readFile(new URL('../functions/presentaciones/generador.js', import.meta.url), 'utf8')
  ]);
  return {html, bundle, edge};
}

test('el Generador carga su bundle desde el propio HTML, sin inyecciones fuera de </html>', async () => {
  const {html} = await sources();
  assert.match(html, new RegExp(`<script src="/assets/${BUNDLE.replace(/\./g, '\\.')}\\?v=[^"]+"></script>`),
    'el HTML estático tiene que cargar el bundle real: si depende de que la función lo reescriba, una petición directa al .html sirve un formulario muerto');
  const cola = html.split('</html>')[1] || '';
  assert.equal(cola.replace(/\s+/g, ''), '',
    'nada detrás de </html>: lo que va ahí no lo ve ningún test, ningún linter y ninguna migración');
});

test('la clave del bundle es la misma en el HTML, en la función de borde y en la propia consola', async () => {
  const {html, bundle, edge} = await sources();
  const enHtml = html.match(new RegExp(`${BUNDLE.replace(/\./g, '\\.')}\\?v=([^"]+)"`))?.[1];
  const enEdge = edge.match(new RegExp(`${BUNDLE.replace(/\./g, '\\.')}\\?v=([^"]+)"`))?.[1];
  const declarada = bundle.match(/__ADMIRA_GENERATOR_VERSION__\s*=\s*'([^']+)'/)?.[1];
  assert.ok(enHtml && enEdge && declarada, 'las tres declaraciones tienen que existir');
  assert.equal(enEdge, enHtml, 'la función de borde y el HTML sirven el mismo fichero: la misma clave o el navegador se lo baja dos veces');
  assert.equal(declarada, enHtml, 'la consola de experto enseña esta constante: si no es la clave servida, miente sobre qué build corre');
});

test('la función de borde sigue inyectando el envoltorio cuadrático sobre el HTML vivo', async () => {
  const {html} = await sources();
  const response = await onRequestGet({
    request: new Request('https://admiranext.test/presentaciones/generador/'),
    env: {ASSETS: {fetch: async () => new Response(html)}}
  });
  const salida = await response.text();
  assert.match(salida, /presentation-generator-quadratic\.css\?v=1/);
  assert.match(salida, /presentation-generator-quadratic\.js\?v=1/);
  assert.match(salida, /presentation-media-library\.(css|js)\?v=/);
  assert.match(salida, /form id="generator"/);
  // Una sola etiqueta del bundle: si la reescritura de compatibilidad volviera a
  // engancharse sobre el HTML nuevo, el generador se ejecutaría dos veces.
  assert.equal((salida.match(new RegExp(BUNDLE.replace(/\./g, '\\.'), 'g')) || []).length, 1,
    'el bundle del generador se carga UNA vez');
});
