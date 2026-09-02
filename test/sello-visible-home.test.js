import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

// La regla 07 pide que el sello visible y el <meta> digan lo mismo, pero su guardia solo
// mira dentro de <footer>. La home no tiene footer: enseña la versión en su pantalla de
// arranque, y ahí se quedó escrita a mano «v.04.08.2026.r9.20:36» desde el 4 de agosto —un
// mes anunciando una versión que ya no era, mientras el verificador decía «al día».
const home = () => readFile(new URL('../index.html', import.meta.url), 'utf8');
const SELLO = /v\.\d{2}\.\d{2}\.\d{4}\.r\d+\.\d{2}:\d{2}/g;

test('la home no lleva ningún sello escrito a mano fuera del <meta>', async () => {
  const fuente = await home();
  const sinMeta = fuente.replace(/<meta name="admiranext-version"[^>]*>/g, '');
  // El comentario que explica el arreglo cita el sello viejo a propósito: no cuenta.
  const sinComentarios = sinMeta.replace(/\/\/[^\n]*\n/g, '\n').replace(/<!--[\s\S]*?-->/g, '');
  const sueltos = sinComentarios.match(SELLO) || [];
  assert.deepEqual(sueltos, [], 'un sello copiado a mano sólo puede envejecer');
});

test('la pantalla de arranque toma su versión del <meta>', async () => {
  const fuente = await home();
  assert.match(fuente, /meta\[name="admiranext-version"\]/, 'el arranque tiene que leer el sello canónico');
  assert.match(fuente, /'boot\.l14'\] = d\['boot\.l14'\]\.replace/, 'y escribirlo en la línea del arranque');
  assert.doesNotMatch(fuente, /'boot\.l14': 'ADmiraNeXT v\./, 'el diccionario no vuelve a llevar versión dentro');
});
