import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { encode } from '../functions/pruebas/_jpeg/encoder.js';
import { onRequest as pruebas } from '../functions/pruebas/_middleware.js';
import { encajar, medidasJpeg, origenPermitido, servirImagen } from '../functions/pruebas/visor/img.js';

const leer = (ruta) => readFile(new URL(ruta, import.meta.url), 'utf8');

function jpegAncho(ancho, alto) {
  const data = new Uint8Array(ancho * alto * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 180;
    data[i + 1] = 90;
    data[i + 2] = 40;
    data[i + 3] = 255;
  }
  return encode({ data, width: ancho, height: alto }, 70).data;
}

test('la tarjeta Ahora lleva la foto, la posición y no repite Admira', async () => {
  const html = await leer('../pruebas/visor/index.html');
  const css = await leer('../pruebas/visor/visor.css');
  const js = await leer('../pruebas/visor/visor.js');
  const sw = await leer('../pruebas/visor/sw.js');
  assert.match(html, /id="foto"/);
  assert.match(html, /id="pos"/);
  assert.match(html, /id="marca"><\/p>/);
  assert.doesNotMatch(html, /<video/i);
  assert.match(css, /object-fit:\s*contain/);
  assert.match(css, /max-width:\s*600px/);
  assert.match(css, /max-height:\s*600px/);
  assert.match(js, /\(indice \+ 1\) \+ '\/' \+ lista\.length/);
  assert.match(js, /return 10/);
  assert.match(js, /virtual-frescaria/);
  assert.doesNotMatch(js, /textContent = ['"]Admira['"]/);
  assert.match(sw, /visor-5605-v1/);
  assert.match(sw, /\/pruebas\/visor\/img/);
  assert.match(sw, /visor\\\/img/);
  assert.match(sw, /20261010-visor-5605/);
});

test('el proxy solo admite el Stock y deja el lado largo en 600', async () => {
  assert.equal(origenPermitido('http://stock.admira.store/a.jpg'), null);
  assert.equal(origenPermitido('https://otro.ejemplo/a.jpg'), null);
  assert.equal(origenPermitido('https://user:pass@stock.admira.store/a.jpg'), null);
  assert.equal(origenPermitido('https://stock.admira.store/../secreto.jpg'), null);
  assert.ok(origenPermitido('https://stock.admira.store/stock/a.jpg'));

  const pequeno = encajar({ data: new Uint8Array(16), width: 2, height: 2 }, 600);
  assert.equal(pequeno.width, 2);
  const ancho = jpegAncho(800, 40);
  const antes = medidasJpeg(ancho);
  assert.equal(antes.w, 800);
  const visto = await servirImagen('https://stock.admira.store/foto.jpg', async () => new Response(ancho, { status: 200 }));
  assert.equal(visto.status, 200);
  assert.match(visto.headers.get('content-type'), /image\/jpeg/);
  const cuerpo = new Uint8Array(await visto.arrayBuffer());
  const despues = medidasJpeg(cuerpo);
  assert.ok(despues.w <= 600 && despues.h <= 600);
  assert.equal(despues.w, 600);
  assert.ok(cuerpo.byteLength < 180000);

  const ajena = await servirImagen('https://example.com/a.jpg', async () => { throw new Error('no debe pedirla'); });
  assert.equal(ajena.status, 400);
});

test('sin enlace, /pruebas/visor/img no llega a la función', async () => {
  let llamado = false;
  const res = await pruebas({
    request: new Request('https://www.admiranext.com/pruebas/visor/img?src=https%3A%2F%2Fstock.admira.store%2Fa.jpg'),
    env: { WEBMASTER_SIGNING_KEY: 'clave-de-prueba' },
    next: async () => { llamado = true; return new Response('no'); },
  });
  assert.equal(res.status, 401);
  assert.equal(llamado, false);
  assert.match(await res.text(), /Sin sesión/);
});
