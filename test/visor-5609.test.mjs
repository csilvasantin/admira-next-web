import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { onRequest as pruebas } from '../functions/pruebas/_middleware.js';
import { medidasMp4, nombreDerivado, origenPermitido, servirVideo } from '../functions/pruebas/visor/vid.js';

const leer = (ruta) => readFile(new URL(ruta, import.meta.url));

function caja(tipo, payload) {
  const out = new Uint8Array(8 + payload.length);
  const size = out.length;
  out[0] = size >>> 24; out[1] = size >>> 16; out[2] = size >>> 8; out[3] = size;
  out.set(tipo, 4);
  out.set(payload, 8);
  return out;
}

function tkhd(w, h) {
  const payload = new Uint8Array(84);
  const ww = Math.round(w * 65536);
  const hh = Math.round(h * 65536);
  payload[76] = ww >>> 24; payload[77] = ww >>> 16; payload[78] = ww >>> 8; payload[79] = ww;
  payload[80] = hh >>> 24; payload[81] = hh >>> 16; payload[82] = hh >>> 8; payload[83] = hh;
  return caja([0x74, 0x6b, 0x68, 0x64], payload);
}

test('la tarjeta reproduce el vídeo mudo y el contador usa toda la lista', async () => {
  const html = await leer('../pruebas/visor/index.html').then((b) => b.toString());
  const js = await leer('../pruebas/visor/visor.js').then((b) => b.toString());
  const sw = await leer('../pruebas/visor/sw.js').then((b) => b.toString());
  assert.match(html, /<video id="clip" muted playsinline autoplay hidden>/);
  assert.match(js, /\/pruebas\/visor\/vid\?src=/);
  assert.match(js, /tipo === 'video'/);
  assert.match(js, /onended/);
  assert.match(js, /clip\.muted = true/);
  assert.match(js, /playsInline = true/);
  assert.match(js, /\(indice \+ 1\) \+ '\/' \+ lista\.length/);
  assert.match(js, /actual\.tipo === 'video'/);
  assert.doesNotMatch(js, /tipo === 'video' \|\| tipo === 'animation'/);
  assert.match(sw, /\/pruebas\/visor\/vid/);
  assert.match(sw, /visor-5609-v1/);
});

test('el vídeo grande no sale tal cual: se sirve la copia de 600 px', async () => {
  assert.equal(origenPermitido('http://stock.admira.store/a.mp4'), null);
  assert.equal(origenPermitido('https://otro.ejemplo/a.mp4'), null);
  const grande = caja([0x6d, 0x6f, 0x6f, 0x76], tkhd(720, 1280));
  assert.deepEqual(medidasMp4(grande), { w: 720, h: 1280 });
  const pesado = await servirVideo('https://stock.admira.store/clip.mp4', async () => new Response(grande, { status: 200 }), null, null);
  assert.equal(pesado.status, 415);

  const nombre = await nombreDerivado('https://stock.admira.store/clip.mp4');
  const archivos = await readdir(new URL('../pruebas/visor/media/', import.meta.url));
  const propio = archivos.find((n) => n.endsWith('.mp4'));
  assert.ok(propio);
  const bytes = new Uint8Array(await leer('../pruebas/visor/media/' + propio));
  const lado = medidasMp4(bytes);
  assert.ok(lado.w <= 600 && lado.h <= 600);
  assert.ok(bytes.byteLength < 400000);
  const visto = await servirVideo(
    'https://stock.admira.store/clip.mp4',
    async () => { throw new Error('no debe pedir el original si hay copia'); },
    async (url) => (url.endsWith('/' + nombre + '.mp4') ? new Response(bytes, { status: 200 }) : new Response(null, { status: 404 })),
    new Request('https://www.admiranext.com/pruebas/visor/vid'),
  );
  assert.equal(visto.status, 200);
  assert.match(visto.headers.get('content-type'), /video\/mp4/);
  const cuerpo = new Uint8Array(await visto.arrayBuffer());
  const salida = medidasMp4(cuerpo);
  assert.ok(salida.w <= 600 && salida.h <= 600);
  assert.equal(salida.h, 600);
});

test('sin enlace, /pruebas/visor/vid no llega a la función', async () => {
  let llamado = false;
  const res = await pruebas({
    request: new Request('https://www.admiranext.com/pruebas/visor/vid?src=https%3A%2F%2Fstock.admira.store%2Fa.mp4'),
    env: { WEBMASTER_SIGNING_KEY: 'clave-de-prueba' },
    next: async () => { llamado = true; return new Response('no'); },
  });
  assert.equal(res.status, 401);
  assert.equal(llamado, false);
  assert.match(await res.text(), /Sin sesión/);
});
