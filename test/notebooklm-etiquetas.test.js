import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

// Las etiquetas de este test NO son inventadas: son las que devolvió Gemini Notebook el
// 2-sep-2026 con la sesión real abierta. El productor comparaba por igualdad exacta y la UI
// nueva pega el nombre del icono al texto, así que TODOS los clics esperaban 30 s y morían.
const worker = () => readFile(new URL('../tools/notebooklm-local/worker.js', import.meta.url), 'utf8');

async function limpiador() {
  const fuente = await worker();
  const declaracion = fuente.match(/const ETIQUETA_LIMPIA=\[[\s\S]*?\]\.join\('\\n'\);/)?.[0];
  assert.ok(declaracion, 'no encuentro el normalizador de etiquetas en worker.js');
  const cuerpo = new Function(declaracion.replace('const ETIQUETA_LIMPIA=', 'return '))();
  return new Function(`return ${cuerpo}`)();
}

test('el nombre del icono no impide reconocer el botón', async () => {
  const formas = await limpiador();
  const reconoce = (valor, etiqueta) => formas(valor).includes(etiqueta);
  assert.ok(reconoce('content_pasteTexto copiado', 'Texto copiado'), 'pegado sin espacio');
  assert.ok(reconoce('delete Eliminar', 'Eliminar'), 'separado por espacio');
  assert.ok(reconoce('trending_upAnalíticas', 'Analíticas'), 'con acento detrás');
  assert.ok(reconoce('publicDescubrir', 'Descubrir'));
  assert.ok(reconoce('keep_pinGuardar en una nota', 'Guardar en una nota'));
  assert.ok(reconoce('Insertar', 'Insertar'), 'una etiqueta limpia sigue valiendo');
});

test('no se recorta lo que no es un icono', async () => {
  const formas = await limpiador();
  // «español» es el valor del selector de idioma: si lo recortáramos, el worker creería
  // que el idioma no está puesto y volvería a abrir el desplegable en bucle.
  assert.deepEqual(formas('español'), ['español'], 'sin icono que quitar, una sola forma');
  assert.ok(formas('Resumen de vídeo').includes('Resumen de vídeo'));
  assert.ok(formas('Generar').includes('Generar'));
});

test('el productor apunta al dominio vivo, no al que redirige', async () => {
  const fuente = await worker();
  assert.doesNotMatch(fuente, /notebooklm\.google\.com/, 'notebooklm.google.com responde 301 a notebook.google.com');
  assert.match(fuente, /https:\/\/notebook\.google\.com\//);
});

test('el selector de idioma se busca por su valor, no por un aria-label que ya no existe', async () => {
  const fuente = await worker();
  assert.doesNotMatch(fuente, /'Seleccionar idioma'/, 'ese aria-label no existe en Gemini Notebook');
  assert.match(fuente, /No encuentro el selector de idioma/, 'y si vuelve a cambiar, que lo diga claro');
});
