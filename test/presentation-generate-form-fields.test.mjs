// El alta desde la UI no manda las casillas sueltas (language/output): la API rechaza campos
// desconocidos desde el 25-09-2026 y el formulario fallaba con «Campos desconocidos».
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {GENERATE_ALLOWED_KEYS, assertKnownGenerateFields} from '../functions/presentaciones/api/generate.js';

test('el bundle borra language/output antes del PUT y la API sigue siendo estricta', async () => {
  const bundle = await readFile(new URL('../assets/presentation-generator-20260721-11.js', import.meta.url), 'utf8');
  const i = bundle.indexOf('data.languages=[...languagePanel');
  assert.ok(i > 0);
  const tramo = bundle.slice(i, i + 600);
  assert.match(tramo, /delete data\.language;delete data\.output;/);
  assert.ok(!GENERATE_ALLOWED_KEYS.has('language') && !GENERATE_ALLOWED_KEYS.has('output'));
  assert.throws(() => assertKnownGenerateFields({displayName:'x', language:'es'}), /Campos desconocidos: language/);
  // Nombres de los campos del formulario base que sí deben aceptarse.
  const html = await readFile(new URL('../presentaciones/generador.html', import.meta.url), 'utf8');
  const campos = (text) => [...text.matchAll(/<(?:input|textarea|select)\b[^>]*\bname=\\?"([^"\\]+)\\?"/g)].map(m => m[1]);
  assert.deepEqual(campos(html).filter(n => !GENERATE_ALLOWED_KEYS.has(n)), []);
  // Y los paneles que inyecta el bundle: solo language/output quedan fuera (y se borran).
  const fuera = [...new Set(campos(bundle).filter(n => !GENERATE_ALLOWED_KEYS.has(n)))];
  assert.deepEqual(fuera.filter(n => !['language', 'output'].includes(n)), []);
});
