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
import {PLANTILLA, UMBRAL_CONTRASTE, limpiarPixeles, mascaraEnCaja, limpiarPdf, limpiarPptx, quitarPredictorPng, residuo, pildora} from '../watermark.js';

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

// Portada de NVIDIA en castellano (21-09-2026): la marca cae junto al logo del partner. La
// primera versión tomaba como zona «todo lo que se aparta del fondo» y se comía la base del
// logo; ahora la zona sale de la plantilla alineada y el relleno no usa el contenido.
test('una marca pegada a un logo se quita sin tocar el logo', () => {
  const px = lamina();
  const logo = [];
  for (let y = 722; y < 748; y += 1) for (let x = 1236; x < 1320; x += 1) { const k = (y * W + x) * 3; px[k] = 120; px[k + 1] = 200; px[k + 2] = 40; logo.push(k); }
  // La marca vuelve a pintarse encima (el logo acaba justo donde empieza la marca).
  for (let y = 0; y < PLANTILLA.h; y += 1) for (let x = 0; x < PLANTILLA.w; x += 1) {
    const i = y * PLANTILLA.w + x;
    if ((parseInt(PLANTILLA.bits[i >> 2], 16) >> (3 - (i & 3))) & 1) { const k = ((745 + y) * W + 1266 + x) * 3; px[k] = px[k + 1] = px[k + 2] = 225; }
  }
  const antes = Buffer.from(px), informe = limpiarPixeles(px, W, H, 3);
  assert.equal(informe.quitada, true, JSON.stringify(informe));
  assert.equal(informe.residuo, 0, 'no queda nada de la silueta respecto al fondo cercano');
  // Todo el logo por encima de la franja de la marca (y < 742) sigue exactamente igual.
  const intactos = logo.filter(k => Math.floor(k / 3 / W) < 742).every(k => px[k] === antes[k] && px[k + 1] === antes[k + 1] && px[k + 2] === antes[k + 2]);
  assert.ok(intactos, 'la parte del logo fuera de la marca no cambia');
  assert.equal(residuo(antes, W, H, 3) > 0.5, true, 'antes de limpiar, el residuo detecta la marca');
});

// FLT-100799: en algunas láminas (NVIDIA es 6/7/11/13/14) Gemini pinta la marca sobre una
// píldora esmerilada, x 1263–1372, y 740–765, un poco más clara que el fondo. Quitado el texto
// quedaba la píldora vacía; ahora se pinta con el fondo, y sólo si su borde se ve en tres lados.
function conPildora(px, {tinte = 10, radio = 6} = {}){
  for (let y = 740; y <= 765; y += 1) for (let x = 1263; x <= 1372; x += 1) {
    const cx = Math.min(Math.max(x, 1263 + radio), 1372 - radio), cy = Math.min(Math.max(y, 740 + radio), 765 - radio);
    if ((x - cx) ** 2 + (y - cy) ** 2 > radio * radio) continue;
    const k = (y * W + x) * 3; for (let c = 0; c < 3; c += 1) px[k + c] = Math.min(255, px[k + c] + tinte);
  }
  return px;
}
function repintarMarca(px, tono = 225){
  for (let y = 0; y < PLANTILLA.h; y += 1) for (let x = 0; x < PLANTILLA.w; x += 1) {
    const i = y * PLANTILLA.w + x;
    if ((parseInt(PLANTILLA.bits[i >> 2], 16) >> (3 - (i & 3))) & 1) { const k = ((745 + y) * W + 1266 + x) * 3; px[k] = px[k + 1] = px[k + 2] = tono; }
  }
  return px;
}
const fueraDeCaja = (antes, despues, caja) => {
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    if (x >= caja.x0 && x <= caja.x1 && y >= caja.y0 && y <= caja.y1) continue;
    const k = (y * W + x) * 3; if (antes[k] !== despues[k] || antes[k + 1] !== despues[k + 1] || antes[k + 2] !== despues[k + 2]) return false;
  }
  return true;
};

test('la píldora esmerilada detrás de la marca se pinta con el fondo, y nada más', () => {
  // Como en las láminas reales: el logo del cliente asoma por encima y su base queda bajo la
  // píldora. Carlos (21-09-2026): lo que asoma se quita también («quita también la tira»).
  const base = lamina({conMarca:false});
  // Bajo el cristal el logo se ve difuminado y apagado (medido: 45–80 de luminancia sobre 25).
  for (let y = 728; y < 752; y += 1) for (let x = 1270; x < 1340; x += 1) {
    const k = (y * W + x) * 3, tapado = y >= 740; base[k] = tapado ? 40 : 120; base[k + 1] = tapado ? 55 : 200; base[k + 2] = tapado ? 20 : 40;
  }
  // Borde del logo: verde oscuro saturado, casi con la luminancia del fondo (20 frente a 11,5).
  for (let x = 1269; x <= 1340; x += 1) { const k = (727 * W + x) * 3; base[k] = 8; base[k + 1] = 30; base[k + 2] = 8; }
  for (let y = 727; y < 740; y += 1) for (const x of [1269, 1340]) { const k = (y * W + x) * 3; base[k] = 8; base[k + 1] = 30; base[k + 2] = 8; }
  // …y una cola de ese verde a más de 3 px del logo, pegada a la píldora (los puntos sueltos de la pág. 14).
  for (let x = 1256; x <= 1265; x += 1) { const k = (738 * W + x) * 3; base[k] = 8; base[k + 1] = 30; base[k + 2] = 8; }
  // …y un resto a la izquierda de la píldora, por debajo de su borde de arriba (pág. 14: x 1261, y 742).
  for (let y = 744; y <= 748; y += 1) for (let x = 1258; x <= 1261; x += 1) { const k = (y * W + x) * 3; base[k] = 60; base[k + 1] = 110; base[k + 2] = 20; }
  const px = repintarMarca(conPildora(base));
  assert.equal(pildora(px, W, H, 3).hay, true);
  const antes = Buffer.from(px), informe = limpiarPixeles(px, W, H, 3);
  assert.equal(informe.quitada, true);
  assert.equal(informe.pildora, true, JSON.stringify(informe));
  assert.equal(informe.residuo, 0);
  assert.equal(informe.tira, true);
  let peor = 0;
  for (let y = 720; y <= 766; y += 1) for (let x = 1252; x <= 1373; x += 1) { const k = (y * W + x) * 3; peor = Math.max(peor, Math.abs(px[k] - 10), Math.abs(px[k + 1] - 12), Math.abs(px[k + 2] - 14)); }
  assert.ok(peor <= 2, `píldora y tira del logo quedan del color del fondo (desvío máximo ${peor})`);
  assert.ok(fueraDeCaja(antes, px, {x0:1251, y0:713, x1:1375, y1:767}), 'fuera de la esquina no cambia nada');
});

test('lo que toca la píldora pero sube más allá de la franja no es una tira: no se quita', () => {
  const base = lamina({conMarca:false});
  // Una columna de contenido que baja desde y 690 hasta tocar la píldora.
  for (let y = 690; y < 740; y += 1) for (let x = 1300; x < 1310; x += 1) { const k = (y * W + x) * 3; base[k] = 200; base[k + 1] = 200; base[k + 2] = 200; }
  const px = repintarMarca(conPildora(base)), antes = Buffer.from(px), informe = limpiarPixeles(px, W, H, 3);
  assert.equal(informe.pildora, true);
  assert.equal(informe.tira, false, JSON.stringify(informe));
  assert.ok(fueraDeCaja(antes, px, {x0:1262, y0:739, x1:1373, y1:766}), 'sólo se pinta la píldora; la columna sigue');
  let peor = 0;
  for (let y = 741; y <= 766; y += 1) for (let x = 1262; x <= 1373; x += 1) { const k = (y * W + x) * 3; peor = Math.max(peor, Math.abs(px[k] - 10), Math.abs(px[k + 1] - 12), Math.abs(px[k + 2] - 14)); }
  assert.ok(peor <= 2, `el blanco de la columna no tiñe la píldora (desvío máximo ${peor})`);
});

test('sin píldora no se pinta: ni con la franja de la portada ni con una línea bajo la esquina', () => {
  // Franja verde pegada al borde derecho (portada de NVIDIA): marca UN lado, no tres.
  const franja = repintarMarca(lamina({conMarca:false}));
  for (let y = 690; y < H; y += 1) for (let x = 1373; x < W; x += 1) { const k = (y * W + x) * 3; franja[k] = 120; franja[k + 1] = 200; franja[k + 2] = 40; }
  // Línea de tabla justo debajo (consumos): tampoco.
  const linea = repintarMarca(lamina({fondo:[222, 230, 214], conMarca:false}), 30);
  for (let x = 1200; x < W; x += 1) for (let y = 766; y < H; y += 1) { const k = (y * W + x) * 3; linea[k] = linea[k + 1] = linea[k + 2] = 150; }
  for (const px of [franja, linea]) {
    const antes = Buffer.from(px), informe = limpiarPixeles(px, W, H, 3);
    assert.equal(informe.quitada, true);
    assert.equal(informe.pildora, false, JSON.stringify(informe));
    assert.ok(fueraDeCaja(antes, px, {x0:1263, y0:742, x1:1372, y1:763}), 'sólo cambia la zona de la marca');
  }
});
