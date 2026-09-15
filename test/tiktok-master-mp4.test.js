// Vía 1 · FLT-100477: el máster del Composer sale en MP4 con audio y con sus dimensiones reales.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('supportedMime prefiere MP4 con códecs RFC 6381 (avc1 + mp4a) antes que cualquier WebM', async () => {
  const app = await readFile(new URL('../tiktok/app.js', import.meta.url), 'utf8');
  const bloque = app.slice(app.indexOf('function supportedMime()'), app.indexOf('return types.find((type) => MediaRecorder.isTypeSupported(type))'));
  const tipos = [...bloque.matchAll(/'([^']+)'/g)].map((m) => m[1]);
  assert.equal(tipos[0], 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'el primero es el MP4 que Chromium reconoce');
  const primerWebm = tipos.findIndex((t) => t.startsWith('video/webm'));
  const ultimoMp4 = tipos.map((t) => t.startsWith('video/mp4')).lastIndexOf(true);
  assert.ok(ultimoMp4 < primerWebm, 'todos los MP4 van antes que los WebM');
  assert.ok(tipos.every((t) => !t.startsWith('video/mp4') || t === 'video/mp4' || /mp4a|aac/.test(t)), 'cada MP4 con códecs declara pista de audio');
});

test('el veredicto de validación viaja con ancho/alto reales y el servidor los conserva', async () => {
  const app = await readFile(new URL('../tiktok/app.js', import.meta.url), 'utf8');
  assert.match(app, /validacion:\{\.\.\.analisis\.validacion, ancho:dimensiones\.w, alto:dimensiones\.h\}/);
  const fn = await readFile(new URL('../functions/presentaciones/api/video-package.js', import.meta.url), 'utf8');
  const src = fn.slice(fn.indexOf('function saneaValidacion'), fn.indexOf('async function preparePackage'));
  assert.match(src, /ancho:num\(v\.ancho, 8192\), alto:num\(v\.alto, 8192\)/);
  const clean = (x, n) => String(x).slice(0, n);
  const saneaValidacion = new Function('clean', `${src}; return saneaValidacion;`)(clean);
  const out = saneaValidacion({ ok: true, negros: 0, muestras: 12, duracion: 25, ancho: 1080, alto: 1920 });
  assert.equal(out.ancho, 1080); assert.equal(out.alto, 1920);
  assert.equal(saneaValidacion({ ok: true, ancho: 'x' }).ancho, null);
});
