// QUITAR LA MARCA «Gemini Notebook» DE PDF Y POWERPOINT (MorfeoMacMini, 21-09-2026 · FLT-100798).
//
// Gemini Notebook entrega las presentaciones como UNA imagen por lámina (PowerPoint: una
// sola imagen a lámina completa; PDF: una imagen FlateDecode por página, 1376×768) con la
// marca «◠ Gemini Notebook» pintada DENTRO de los píxeles, abajo a la derecha. Por eso la
// limpieza por huella de sanitizePowerPointBranding no encontraba nada que quitar.
//
// Se quita así, y sólo así:
//  1) se RECONOCE: en la esquina se separan los píxeles que se apartan del fondo y su
//     silueta se compara con la plantilla de la marca (sirve igual para texto claro sobre
//     fondo oscuro que al revés). Si no se parece lo bastante, NO se toca nada;
//  2) se RECONSTRUYEN sólo esos píxeles (y un halo de 1 px) por difusión desde su entorno.
//     El resto de la esquina queda intacto: si pasa el borde de una forma, se conserva.
// Cada fichero devuelve su informe (qué láminas, puntuación, cuántos píxeles).
import zlib from 'node:zlib';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import JSZip from 'jszip';
import {PDFDocument, PDFName, PDFRawStream} from 'pdf-lib';

// Geometría medida en las láminas de 1376×768 (21-09-2026): la marca ocupa x 1270–1365,
// y 749–756. Se guarda en fracciones para escalar si cambia la resolución.
const REF = {w:1376, h:768, x0:1266, y0:745, x1:1369, y1:760};
// Plantilla de la silueta (1 = trazo) en la caja de referencia, 103×15, medida sobre la
// lámina 1 de NVIDIA. Se genera y se comprueba en test/notebooklm-marca.test.js.
export const PLANTILLA = {w:103, h:15, bits:'000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000f00f0000606210000c00010007f03f0000c0c62030180002001ff0c03becbc8e4e73be38e4c07ff19effffff1ebffffefbeb00c7e33ffcdf9e37c7bfcf1c7c018fc61ff9bf3c6f8f7d9e38fc031f87e7f37e78cdf7fff7df4c0415078724545109c677c71c98000000000000000000000000000000000000000000000000000000000000000000000000000000'};
export const UMBRAL_CONTRASTE = 45;   // diferencia de luminancia con el fondo para ser «trazo»
export const UMBRAL_PARECIDO = 0.55;  // IoU mínimo con la plantilla para darla por reconocida
export const UMBRAL_HALO = 10;       // contraste del brillo del suavizado alrededor del trazo

function caja(width, height){
  const sx = width / REF.w, sy = height / REF.h;
  return {x0:Math.floor(REF.x0 * sx), y0:Math.floor(REF.y0 * sy), x1:Math.ceil(REF.x1 * sx), y1:Math.ceil(REF.y1 * sy)};
}
const lum = (px, i) => 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];

// Máscara de trazo dentro de la caja: píxeles cuya luminancia se aparta de la mediana del
// borde de la caja más de UMBRAL_CONTRASTE.
export function mascaraEnCaja(px, width, height, channels){
  const b = caja(width, height), borde = [];
  for (let x = b.x0; x < b.x1; x += 1) { borde.push(lum(px, ((b.y0 - 1) * width + x) * channels)); borde.push(lum(px, (Math.min(height - 1, b.y1) * width + x) * channels)); }
  for (let y = b.y0; y < b.y1; y += 1) borde.push(lum(px, (y * width + b.x0 - 1) * channels));
  borde.sort((a, c) => a - c);
  const fondo = borde[borde.length >> 1], w = b.x1 - b.x0, h = b.y1 - b.y0, m = new Uint8Array(w * h);
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
    m[y * w + x] = Math.abs(lum(px, ((b.y0 + y) * width + b.x0 + x) * channels) - fondo) > UMBRAL_CONTRASTE ? 1 : 0;
  }
  return {mascara:m, w, h, caja:b, fondo};
}

function plantillaA(w, h){
  const t = PLANTILLA, out = new Uint8Array(w * h);
  if (!t.bits) return out;
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
    const tx = Math.min(t.w - 1, Math.floor(x * t.w / w)), ty = Math.min(t.h - 1, Math.floor(y * t.h / h)), i = ty * t.w + tx;
    out[y * w + x] = (parseInt(t.bits[i >> 2], 16) >> (3 - (i & 3))) & 1;
  }
  return out;
}

// IoU entre la máscara y la plantilla, tolerando ±1 px de desplazamiento.
export function parecido(m, w, h){
  const t = plantillaA(w, h);
  let mejor = 0;
  for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
    let inter = 0, union = 0;
    for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
      const a = m[y * w + x], sy = y + dy, sx = x + dx;
      const c = sy >= 0 && sy < h && sx >= 0 && sx < w ? t[sy * w + sx] : 0;
      inter += a & c; union += a | c;
    }
    if (union) mejor = Math.max(mejor, inter / union);
  }
  return mejor;
}

// Limpia la marca en un buffer de píxeles (RGB o RGBA, entrelazado). Devuelve el informe.
export function limpiarPixeles(px, width, height, channels){
  if (width < 400 || height < 200) return {quitada:false, motivo:'imagen demasiado pequeña'};
  const {mascara, w, h, caja:b, fondo} = mascaraEnCaja(px, width, height, channels);
  const score = parecido(mascara, w, h);
  if (score < UMBRAL_PARECIDO) return {quitada:false, parecido:Number(score.toFixed(3))};
  // Zona a reconstruir: el trazo, 2 px alrededor, y además el brillo tenue del suavizado del
  // texto (contraste > UMBRAL_HALO) que quede a ≤ 3 px del trazo. Con sólo 1 px de halo quedaba
  // un rastro visible de las letras en las láminas oscuras (comprobado a ojo, 21-09-2026).
  // Lo que está más lejos —el fondo, el borde de una forma— no se toca.
  const distancia = new Uint8Array(w * h).fill(255);
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) if (mascara[y * w + x]) {
    for (let yy = Math.max(0, y - 3); yy <= Math.min(h - 1, y + 3); yy += 1) for (let xx = Math.max(0, x - 3); xx <= Math.min(w - 1, x + 3); xx += 1) {
      const d = Math.max(Math.abs(yy - y), Math.abs(xx - x)); if (d < distancia[yy * w + xx]) distancia[yy * w + xx] = d;
    }
  }
  const zona = new Uint8Array(w * h);
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
    const i = y * w + x, d = distancia[i];
    if (d <= 2 || (d <= 3 && Math.abs(lum(px, ((b.y0 + y) * width + b.x0 + x) * channels) - fondo) > UMBRAL_HALO)) zona[i] = 1;
  }
  // Difusión: cada píxel de la zona toma la media de sus vecinos, muchas pasadas. Arranca
  // del color medio de lo que NO es trazo en la caja, para converger rápido; los píxeles
  // fuera de la zona no cambian.
  const idx = (x, y) => ((b.y0 + y) * width + b.x0 + x) * channels;
  const base = [0, 0, 0]; let fuera = 0, pixeles = 0;
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
    if (zona[y * w + x]) { pixeles += 1; continue; }
    const k = idx(x, y); base[0] += px[k]; base[1] += px[k + 1]; base[2] += px[k + 2]; fuera += 1;
  }
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) if (zona[y * w + x]) {
    const k = idx(x, y); for (let c = 0; c < 3; c += 1) px[k + c] = Math.round(base[c] / Math.max(1, fuera));
  }
  for (let pasada = 0; pasada < 160; pasada += 1) {
    for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
      if (!zona[y * w + x]) continue;
      const suma = [0, 0, 0]; let n = 0;
      for (const [vx, vy] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
        const gx = b.x0 + vx, gy = b.y0 + vy;
        if (gx < 0 || gy < 0 || gx >= width || gy >= height) continue;
        const j = (gy * width + gx) * channels;
        suma[0] += px[j]; suma[1] += px[j + 1]; suma[2] += px[j + 2]; n += 1;
      }
      const k = idx(x, y);
      for (let c = 0; c < 3; c += 1) px[k + c] = Math.round(suma[c] / n);
    }
  }
  return {quitada:true, parecido:Number(score.toFixed(3)), pixeles};
}

async function limpiarImagen(bytes){
  const {format} = await sharp(bytes).metadata();
  const {data, info} = await sharp(bytes).raw().toBuffer({resolveWithObject:true});
  const informe = limpiarPixeles(data, info.width, info.height, info.channels);
  if (!informe.quitada) return {bytes, informe};
  // Mismo formato que el original: el nombre y el tipo del fichero dentro del .pptx no cambian.
  const lienzo = sharp(data, {raw:{width:info.width, height:info.height, channels:info.channels}});
  return {bytes:await (format === 'jpeg' ? lienzo.jpeg({quality:95}) : lienzo.png()).toBuffer(), informe};
}

// ── PowerPoint ────────────────────────────────────────────────────────────────
export async function limpiarPptx(file){
  const zip = await JSZip.loadAsync(await fs.readFile(file));
  const medios = Object.keys(zip.files).filter(n => /^ppt\/media\/[^/]+\.(png|jpe?g)$/i.test(n)).sort();
  const laminas = [];
  for (const nombre of medios) {
    const {bytes, informe} = await limpiarImagen(await zip.file(nombre).async('nodebuffer'));
    if (informe.quitada) zip.file(nombre, bytes);
    laminas.push({imagen:path.basename(nombre), ...informe});
  }
  const quitadas = laminas.filter(l => l.quitada).length;
  if (!quitadas) return {file, report:{changed:false, mode:'gemini-watermark', laminas}};
  const out = file.replace(/\.pptx$/i, '.sin-marca.pptx');
  await fs.writeFile(out, await zip.generateAsync({type:'nodebuffer', compression:'DEFLATE'}));
  return {file:out, report:{changed:true, mode:'gemini-watermark', quitadas, total:laminas.length, laminas}};
}

// ── PDF ───────────────────────────────────────────────────────────────────────
function paeth(a, b, c){ const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
// Deshace el predictor PNG (Predictor ≥ 10) de un flujo FlateDecode ya inflado.
export function quitarPredictorPng(datos, columnas, colores, bpc = 8){
  const bpp = Math.max(1, (colores * bpc) >> 3), fila = columnas * bpp, filas = datos.length / (fila + 1);
  const out = Buffer.alloc(fila * filas);
  for (let r = 0; r < filas; r += 1) {
    const tipo = datos[r * (fila + 1)], src = r * (fila + 1) + 1, dst = r * fila;
    for (let i = 0; i < fila; i += 1) {
      const x = datos[src + i], a = i >= bpp ? out[dst + i - bpp] : 0, b = r ? out[dst - fila + i] : 0, c = r && i >= bpp ? out[dst - fila + i - bpp] : 0;
      out[dst + i] = (tipo === 0 ? x : tipo === 1 ? x + a : tipo === 2 ? x + b : tipo === 3 ? x + ((a + b) >> 1) : x + paeth(a, b, c)) & 255;
    }
  }
  return out;
}
function decodificar(pdf, stream){
  const d = stream.dict, filtro = String(d.lookup(PDFName.of('Filter')) || '');
  if (filtro !== '/FlateDecode') return null;
  let datos = zlib.inflateSync(Buffer.from(stream.contents));
  const parms = d.lookup(PDFName.of('DecodeParms'));
  const pred = parms?.lookup?.(PDFName.of('Predictor'))?.asNumber?.() || 1;
  const w = d.lookup(PDFName.of('Width')).asNumber(), h = d.lookup(PDFName.of('Height')).asNumber();
  const cs = String(d.lookup(PDFName.of('ColorSpace')) || ''), canales = cs === '/DeviceGray' ? 1 : 3;
  if (pred >= 10) datos = quitarPredictorPng(datos, parms.lookup(PDFName.of('Columns'))?.asNumber?.() || w, parms.lookup(PDFName.of('Colors'))?.asNumber?.() || canales);
  if (datos.length !== w * h * canales) return null;
  return {datos, w, h, canales};
}
export async function limpiarPdf(file){
  const pdf = await PDFDocument.load(await fs.readFile(file));
  const paginas = [];
  for (const [n, pagina] of pdf.getPages().entries()) {
    const xo = pagina.node.Resources()?.lookup(PDFName.of('XObject'));
    for (const clave of xo ? xo.keys() : []) {
      const stream = pdf.context.lookup(xo.get(clave));
      if (!(stream instanceof PDFRawStream) || String(stream.dict.lookup(PDFName.of('Subtype'))) !== '/Image') continue;
      const img = decodificar(pdf, stream);
      if (!img || img.canales !== 3) { paginas.push({pagina:n + 1, quitada:false, motivo:'formato de imagen no previsto'}); continue; }
      const informe = limpiarPixeles(img.datos, img.w, img.h, 3);
      if (informe.quitada) {
        // Mismo diccionario (SMask, espacio de color, tamaño) y misma referencia: sólo cambia
        // el contenido, ya sin predictor. pdf-lib recalcula /Length al guardar.
        const dict = stream.dict.clone(pdf.context);
        dict.delete(PDFName.of('DecodeParms'));
        pdf.context.assign(xo.get(clave), PDFRawStream.of(dict, zlib.deflateSync(img.datos)));
      }
      paginas.push({pagina:n + 1, ...informe});
    }
  }
  const quitadas = paginas.filter(p => p.quitada).length;
  if (!quitadas) return {file, report:{changed:false, mode:'gemini-watermark', paginas}};
  const out = file.replace(/\.pdf$/i, '.sin-marca.pdf');
  await fs.writeFile(out, await pdf.save({useObjectStreams:false}));
  return {file:out, report:{changed:true, mode:'gemini-watermark', quitadas, total:paginas.length, paginas}};
}
