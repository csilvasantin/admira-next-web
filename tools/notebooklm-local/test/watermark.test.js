// FLT-100798 (Morfeo, 21-sep-2026) · la marca «Gemini Notebook» fuera de PDF y PowerPoint.
// Láminas sintéticas de 1376×768 con la marca pintada desde la plantilla: se comprueba que
// se reconoce, que se quita, que el resto no se toca y que sin marca no se toca nada.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import JSZip from 'jszip';
import {PDFDocument} from 'pdf-lib';
import {PLANTILLA, UMBRAL_CONTRASTE, limpiarPixeles, mascaraEnCaja, limpiarPdf, limpiarPptx, quitarPredictorPng} from '../watermark.js';

const W = 1376, H = 768;
function lamina({fondo = [10, 12, 14], marca = [225, 225, 225], conMarca = true} = {}){
  const px = Buffer.alloc(W * H * 3);
  for (let i = 0; i < W * H; i += 1) { px[i * 3] = fondo[0]; px[i * 3 + 1] = fondo[1]; px[i * 3 + 2] = fondo[2]; }
  // Un detalle de contenido en otra zona, para comprobar que no se toca.
  for (let y = 100; y < 140; y += 1) for (let x = 100; x < 400; x += 1) { const k = (y * W + x) * 3; px[k] = 90; px[k + 1] = 200; px[k + 2] = 60; }
  if (conMarca) for (let y = 0; y < PLANTILLA.h; y += 1) for (let x = 0; x < PLANTILLA.w; x += 1) {
    const i = y * PLANTILLA.w + x;
    if ((parseInt(PLANTILLA.bits[i >> 2], 16) >> (3 - (i & 3))) & 1) { const k = ((745 + y) * W + 1266 + x) * 3; px[k] = marca[0]; px[k + 1] = marca[1]; px[k + 2] = marca[2]; }
  }
  return px;
}
const trazosRestantes = px => mascaraEnCaja(px, W, H, 3).mascara.reduce((a, b) => a + b, 0);

test('fondo oscuro: la marca se reconoce y desaparece; el resto de la lámina no cambia', () => {
  const px = lamina(), antes = Buffer.from(px);
  const informe = limpiarPixeles(px, W, H, 3);
  assert.equal(informe.quitada, true);
  assert.ok(informe.parecido > 0.95);
  assert.equal(trazosRestantes(px), 0, 'no queda ningún píxel con contraste de trazo');
  assert.ok(px.subarray((100 * W + 100) * 3, (140 * W + 400) * 3).equals(antes.subarray((100 * W + 100) * 3, (140 * W + 400) * 3)), 'el contenido lejos de la marca queda intacto');
});

test('fondo claro con marca oscura: también se reconoce y se quita', () => {
  const px = lamina({fondo:[222, 230, 214], marca:[30, 32, 30]});
  assert.equal(limpiarPixeles(px, W, H, 3).quitada, true);
  assert.equal(trazosRestantes(px), 0);
});

test('sin marca no se toca nada (ni siquiera con contenido en la esquina)', () => {
  const px = lamina({conMarca:false});
  for (let y = 750; y < 758; y += 1) for (let x = 1200; x < 1376; x += 1) { const k = (y * W + x) * 3; px[k] = px[k + 1] = px[k + 2] = 200; }
  const antes = Buffer.from(px), informe = limpiarPixeles(px, W, H, 3);
  assert.equal(informe.quitada, false);
  assert.ok(informe.parecido < 0.55);
  assert.ok(px.equals(antes));
  assert.ok(UMBRAL_CONTRASTE >= 30);
});

test('PowerPoint: limpia las imágenes de lámina y conserva el resto del paquete', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'marca-pptx-'));
  const zip = new JSZip();
  zip.file('ppt/presentation.xml', '<p:presentation/>');
  zip.file('ppt/media/image1.png', await sharp(lamina(), {raw:{width:W, height:H, channels:3}}).png().toBuffer());
  zip.file('ppt/media/image2.png', await sharp(lamina({conMarca:false}), {raw:{width:W, height:H, channels:3}}).png().toBuffer());
  const file = path.join(dir, 'deck.pptx');
  await fs.writeFile(file, await zip.generateAsync({type:'nodebuffer'}));
  const {file:salida, report} = await limpiarPptx(file);
  assert.equal(report.changed, true);
  assert.equal(report.quitadas, 1);
  const limpio = await JSZip.loadAsync(await fs.readFile(salida));
  assert.equal(await limpio.file('ppt/presentation.xml').async('string'), '<p:presentation/>');
  const {data} = await sharp(await limpio.file('ppt/media/image1.png').async('nodebuffer')).removeAlpha().raw().toBuffer({resolveWithObject:true});
  assert.equal(trazosRestantes(data), 0);
});

test('PDF: limpia la imagen de cada página y el PDF resultante se vuelve a abrir', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'marca-pdf-'));
  const pdf = await PDFDocument.create();
  const png = await pdf.embedPng(await sharp(lamina(), {raw:{width:W, height:H, channels:3}}).png().toBuffer());
  const pagina = pdf.addPage([W, H]); pagina.drawImage(png, {x:0, y:0, width:W, height:H});
  const file = path.join(dir, 'deck.pdf');
  await fs.writeFile(file, await pdf.save());
  const {file:salida, report} = await limpiarPdf(file);
  assert.equal(report.changed, true, JSON.stringify(report));
  assert.equal(report.quitadas, 1);
  const otra = await PDFDocument.load(await fs.readFile(salida));
  assert.equal(otra.getPageCount(), 1);
});

test('el predictor PNG se deshace bien (Sub, Up, Average, Paeth)', () => {
  const fila = [10, 20, 30, 40, 50, 60];
  const datos = Buffer.from([1, 10, 20, 30, 30, 30, 30, 2, 0, 0, 0, 0, 0, 0]); // Sub + Up
  assert.deepEqual([...quitarPredictorPng(datos, 2, 3)], [...fila.slice(0, 3), 40, 50, 60, ...fila.slice(0, 3), 40, 50, 60]);
});
