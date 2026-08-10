// El aviso de versión no le roba el clic a la página (Carlos, 2026-08-10 · #1334 c).
//
// El panel es position:fixed abajo a la derecha, con el z-index más alto que hay y
// width:min(360px,100vw-28px) — casi todo el ancho en una pantalla estrecha. Se plantaba
// encima del botón «Generar presentación» y se tragaba la pulsación: el botón se veía, se
// podía apuntar, y no pasaba nada. En todo el fichero no había ni un `pointer-events`.
//
// Aquí no se comprueba una cadena: se REPRODUCE el solapamiento. Se resuelve a mano qué
// elemento recibe el clic en un punto, aplicando la regla de pointer-events, y se exige
// que en ese punto gane el botón de la página y no el panel — y que los controles del
// propio panel sigan siendo pulsables.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source = await readFile(new URL('../assets/admira-version-watch.js', import.meta.url), 'utf8');

// El CSS tal cual lo escribe el fichero, sin copiarlo.
const css = (() => {
  const m = /css\.textContent =([\s\S]*?);\n/.exec(source);
  assert.ok(m, 'no se pudo extraer el CSS del panel');
  // Sólo hay literales de cadena y concatenación: se evalúa el propio fuente.
  return eval(m[1]); // eslint-disable-line no-eval
})();

// Parseo mínimo: cada regla puede traer VARIOS selectores separados por coma, así que
// no vale con buscar «selector{». Se recorren todas y gana la última declaración, como
// en la cascada real.
const REGLAS = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].map(([, sel, cuerpo]) => ({
  selectores: sel.split(',').map((x) => x.trim()).filter(Boolean),
  cuerpo,
}));
const reglaDe = (selector) =>
  REGLAS.filter((r) => r.selectores.includes(selector)).map((r) => r.cuerpo).join(';');
const propiedad = (selector, prop) => {
  const todas = [...reglaDe(selector).matchAll(new RegExp(prop + ':([^;}]+)', 'g'))];
  return todas.length ? todas[todas.length - 1][1].trim() : null;
};

// pointer-events se hereda: un hijo sin regla propia toma la del contenedor.
function recibeElClic(cadena) {
  for (let i = cadena.length - 1; i >= 0; i--) {
    const propio = propiedad(cadena[i], 'pointer-events');
    if (propio === 'auto') return cadena[i];
    if (propio === 'none') return null;          // transparente: sigue buscando hacia abajo
  }
  return cadena[cadena.length - 1] || null;
}

test('el rectángulo del panel deja pasar el clic', () => {
  assert.equal(propiedad('.admira-version', 'pointer-events'), 'none');
});

test('el panel tapa de verdad el botón, y aun así el clic llega al botón', () => {
  // El solapamiento es real: fixed, abajo, ancho casi completo y z-index máximo.
  const contenedor = reglaDe('.admira-version');
  assert.match(contenedor, /position:fixed/);
  assert.match(contenedor, /bottom:14px/);
  assert.match(contenedor, /width:min\(360px,calc\(100vw - 28px\)\)/);
  assert.ok(Number(propiedad('.admira-version', 'z-index')) > 1000000);

  // Punto sobre el botón de la página, con el panel encima: gana el botón.
  const ganador = recibeElClic(['.admira-version', '.admira-version__guidance']);
  assert.equal(ganador, null, 'el texto del panel no puede quedarse el clic');
});

test('los controles del propio panel siguen siendo pulsables', () => {
  for (const control of ['.admira-version__action', '.admira-version__tech summary', '.admira-version a'])
    assert.equal(recibeElClic(['.admira-version', control]), control, control + ' debe recoger su clic');
});

test('el texto del panel no recupera el clic por la puerta de atrás', () => {
  for (const solo of ['.admira-version__grid', '.admira-version__top', '.admira-version__release'])
    assert.notEqual(propiedad(solo, 'pointer-events'), 'auto', solo + ' es texto: no debe capturar');
});
