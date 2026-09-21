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
//     El resto de la esquina queda intacto: si pasa el borde de una forma, se conserva;
//  3) si además la marca iba sobre la píldora esmerilada de Gemini, la píldora se pinta con
//     el fondo que la rodea, y con ella la tira del logo que asomaba por encima (FLT-100799).
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
// Píldora (FLT-100799): en algunas láminas Gemini pinta la marca sobre una píldora de cristal
// esmerilado. Quitado el texto quedaba la píldora vacía, con el logo del cliente difuminado en
// su parte alta. Medida en NVIDIA es 6/7/11/13/14: x 1263–1372, y 740–765, bordes nítidos.
const PILDORA = {x0:1263, y0:740, x1:1372, y1:765};
export const UMBRAL_PILDORA = 3;     // salto de luminancia mínimo (mediana) en cada lado del borde

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
export function parecido(m, w, h){ return alineacion(m, w, h).score; }
export function alineacion(m, w, h){
  const t = plantillaA(w, h);
  let mejor = 0, mdx = 0, mdy = 0;
  for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
    let inter = 0, union = 0;
    for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
      const a = m[y * w + x], sy = y + dy, sx = x + dx;
      const c = sy >= 0 && sy < h && sx >= 0 && sx < w ? t[sy * w + sx] : 0;
      inter += a & c; union += a | c;
    }
    if (union && inter / union > mejor) { mejor = inter / union; mdx = dx; mdy = dy; }
  }
  return {score:mejor, dx:mdx, dy:mdy, plantilla:t};
}
// Plantilla colocada en la caja con el desplazamiento encontrado (la máscara en (x, y) se
// alinea con la plantilla en (x + dx, y + dy)).
function plantillaColocada(al, w, h){
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
    const sx = x + al.dx, sy = y + al.dy;
    if (sx >= 0 && sx < w && sy >= 0 && sy < h && al.plantilla[sy * w + sx]) out[y * w + x] = 1;
  }
  return out;
}
// Residuo tras limpiar: fracción de píxeles de la silueta que siguen apartándose del fondo
// cercano (media de lo que no es silueta ni contenido a ≤3 px). Es la comprobación que mira
// si queda ALGO de la marca, no si la marca se sigue pareciendo a la plantilla.
export function residuo(px, width, height, channels, alineada = null){
  const {mascara, w, h, caja:b, fondo} = mascaraEnCaja(px, width, height, channels);
  const al = alineada || alineacion(mascara, w, h), sil = plantillaColocada(al.score > 0 || alineada ? al : {dx:0, dy:0, plantilla:al.plantilla}, w, h);
  let total = 0, quedan = 0;
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
    if (!sil[y * w + x]) continue;
    let suma = 0, n = 0;
    for (let yy = Math.max(0, y - 3); yy <= Math.min(h - 1, y + 3); yy += 1) for (let xx = Math.max(0, x - 3); xx <= Math.min(w - 1, x + 3); xx += 1) {
      if (sil[yy * w + xx]) continue;
      const l = lum(px, ((b.y0 + yy) * width + b.x0 + xx) * channels);
      if (Math.abs(l - fondo) > UMBRAL_CONTRASTE) continue; suma += l; n += 1;
    }
    if (!n) continue;
    total += 1;
    if (Math.abs(lum(px, ((b.y0 + y) * width + b.x0 + x) * channels) - suma / n) > 25) quedan += 1;
  }
  return total ? quedan / total : 0;
}

function cajaPildora(width, height){
  const sx = width / REF.w, sy = height / REF.h;
  return {x0:Math.round(PILDORA.x0 * sx), y0:Math.round(PILDORA.y0 * sy), x1:Math.round(PILDORA.x1 * sx), y1:Math.round(PILDORA.y1 * sy)};
}
// Hay píldora sólo si su borde se ve en TRES lados (abajo, izquierda y derecha): dentro y
// fuera se apartan con el mismo signo a lo largo de todo el borde. Arriba no se mira: ahí va el
// logo difuminado. Un contenido que llega a la esquina (la franja verde de la portada de
// NVIDIA, una línea de tabla) marca un lado, no los tres. En las 41 láminas reales: las 5 con
// píldora dan ≥ 3,6 en los tres lados; ninguna otra pasa de uno.
export function pildora(px, width, height, channels){
  const p = cajaPildora(width, height);
  if (p.x0 < 3 || p.x1 + 2 >= width || p.y1 + 2 >= height) return {hay:false};
  const L = (x, y) => lum(px, (y * width + x) * channels);
  const abajo = [], izquierda = [], derecha = [];
  for (let x = p.x0 + 12; x <= p.x1 - 12; x += 1) abajo.push((L(x, p.y1 - 2) + L(x, p.y1 - 1) + L(x, p.y1)) / 3 - (L(x, p.y1 + 1) + L(x, p.y1 + 2)) / 2);
  for (let y = p.y0 + 8; y <= p.y1 - 4; y += 1) {
    izquierda.push((L(p.x0, y) + L(p.x0 + 1, y)) / 2 - (L(p.x0 - 3, y) + L(p.x0 - 2, y)) / 2);
    derecha.push((L(p.x1, y) + L(p.x1 - 1, y)) / 2 - (L(p.x1 + 1, y) + L(p.x1 + 2, y)) / 2);
  }
  const lados = [abajo, izquierda, derecha].map(d => {
    const orden = [...d].sort((a, c) => a - c), mediana = orden[orden.length >> 1];
    return {mediana, constante:d.filter(v => Math.sign(v) === Math.sign(mediana) && Math.abs(v) >= 2).length / d.length};
  });
  const signo = Math.sign(lados[0].mediana);
  const hay = lados.every(l => Math.abs(l.mediana) >= UMBRAL_PILDORA && Math.sign(l.mediana) === signo && l.constante >= 0.9);
  return {hay, saltos:lados.map(l => Number(l.mediana.toFixed(1)))};
}
// Pinta la píldora (y 1 px alrededor, por el borde suavizado) con el fondo que la rodea: se
// difunde desde un anillo de 3 px fuera de ella, sin tomar el contenido (el logo de encima).
// Lo que el cristal tapaba del logo no se puede recuperar: el logo queda cortado en su borde.
function pintarPildora(px, width, height, channels){
  const p = cajaPildora(width, height);
  const X0 = Math.max(0, p.x0 - 1), Y0 = Math.max(0, p.y0 - 1), X1 = Math.min(width - 1, p.x1 + 1), Y1 = Math.min(height - 1, p.y1 + 1);
  const dentro = (x, y) => x >= X0 && x <= X1 && y >= Y0 && y <= Y1;
  const anillo = [];
  for (let y = Math.max(0, Y0 - 3); y <= Math.min(height - 1, Y1 + 3); y += 1) for (let x = Math.max(0, X0 - 3); x <= Math.min(width - 1, X1 + 3); x += 1) {
    if (!dentro(x, y)) anillo.push(lum(px, (y * width + x) * channels));
  }
  const fondo = [...anillo].sort((a, c) => a - c)[anillo.length >> 1];
  // El suavizado del logo (30–60 sobre un fondo de 15) también es contenido: umbral estrecho.
  const esFondo = (x, y) => Math.abs(lum(px, (y * width + x) * channels) - fondo) <= 12;
  const base = [0, 0, 0]; let n = 0;
  for (let y = Math.max(0, Y0 - 3); y <= Math.min(height - 1, Y1 + 3); y += 1) for (let x = Math.max(0, X0 - 3); x <= Math.min(width - 1, X1 + 3); x += 1) {
    if (dentro(x, y) || !esFondo(x, y)) continue;
    const k = (y * width + x) * channels; base[0] += px[k]; base[1] += px[k + 1]; base[2] += px[k + 2]; n += 1;
  }
  if (!n) return 0;
  for (let y = Y0; y <= Y1; y += 1) for (let x = X0; x <= X1; x += 1) {
    const k = (y * width + x) * channels; for (let c = 0; c < 3; c += 1) px[k + c] = Math.round(base[c] / n);
  }
  for (let pasada = 0; pasada < 300; pasada += 1) {
    for (let y = Y0; y <= Y1; y += 1) for (let x = X0; x <= X1; x += 1) {
      const suma = [0, 0, 0]; let m = 0;
      for (const [vx, vy] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
        if (vx < 0 || vy < 0 || vx >= width || vy >= height) continue;
        if (!dentro(vx, vy) && !esFondo(vx, vy)) continue;
        const j = (vy * width + vx) * channels; suma[0] += px[j]; suma[1] += px[j + 1]; suma[2] += px[j + 2]; m += 1;
      }
      if (!m) continue;
      const k = (y * width + x) * channels; for (let c = 0; c < 3; c += 1) px[k + c] = Math.round(suma[c] / m);
    }
  }
  return (X1 - X0 + 1) * (Y1 - Y0 + 1);
}
// Lo que asomaba alrededor de la píldora (Carlos, 21-09-2026: «quita también la tira»). El
// cristal tapaba la mitad de abajo del logo del cliente y eso no se recupera: pintada la
// píldora, quedaba una tira suelta de su borde de arriba (y algún píxel a su lado) que parecía
// un defecto. Se quita lo que toca la píldora por arriba o por los lados, con su brillo, antes
// de pintarla (si no, su relleno arrastra el verde del logo). Siempre que sea pequeño: si llega
// al techo de la franja que se mira o a su borde izquierdo, es otra cosa y no se toca.
function quitarTira(px, width, height, channels){
  const p = cajaPildora(width, height), sy = height / REF.h;
  const alto = Math.round(26 * sy), X0 = Math.max(0, p.x0 - 12), X1 = Math.min(width - 1, p.x1 + 2);
  const techo = Math.max(0, p.y0 - 1 - alto), Y1 = Math.min(height - 1, p.y1 + 1);
  if (techo < 4) return 0;
  // La píldora con su margen de 1 px la pinta pintarPildora: aquí ni se sigue ni se usa.
  const enPildora = (x, y) => x >= p.x0 - 1 && x <= p.x1 + 1 && y >= p.y0 - 1 && y <= p.y1 + 1;
  const referencia = [0, 0, 0]; let n = 0;
  for (let y = techo - 4; y < techo; y += 1) for (let x = X0; x <= X1; x += 1) {
    const k = (y * width + x) * channels; referencia[0] += px[k]; referencia[1] += px[k + 1]; referencia[2] += px[k + 2]; n += 1;
  }
  // Por COLOR, no por luminancia: el borde del logo es verde oscuro saturado, casi con la misma
  // luminancia que el fondo, y con luminancia se quedaban puntos verdes sueltos.
  const color = referencia.map(v => v / n);
  const destaca = (x, y) => { const k = (y * width + x) * channels; return Math.max(Math.abs(px[k] - color[0]), Math.abs(px[k + 1] - color[1]), Math.abs(px[k + 2] - color[2])) > 8; };
  const ancho = X1 - X0 + 1, idx = (x, y) => (y - techo) * ancho + (x - X0), tira = new Uint8Array(ancho * (Y1 - techo + 1));
  const pila = [], semilla = (x, y) => { if (x >= X0 && x <= X1 && !tira[idx(x, y)] && destaca(x, y)) { tira[idx(x, y)] = 1; pila.push([x, y]); } };
  for (let x = p.x0 - 1; x <= p.x1 + 1; x += 1) semilla(x, p.y0 - 2);
  for (let y = p.y0 - 1; y <= Y1; y += 1) { semilla(p.x0 - 2, y); semilla(p.x1 + 2, y); }
  if (!pila.length) return 0;
  while (pila.length) {
    const [x, y] = pila.pop();
    for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
      const u = x + dx, v = y + dy;
      if (u < X0 || u > X1 || v < techo || v > Y1 || tira[idx(u, v)] || enPildora(u, v) || !destaca(u, v)) continue;
      if (v === techo || u === X0) return 0; // sigue más allá: no es una tira, es contenido de la lámina
      tira[idx(u, v)] = 1; pila.push([u, v]);
    }
  }
  // Zona: la tira y 3 px alrededor (el brillo del logo), sin salir de la franja ni entrar en la píldora.
  const zona = new Uint8Array(tira.length);
  for (let y = techo; y <= Y1; y += 1) for (let x = X0; x <= X1; x += 1) if (tira[idx(x, y)]) {
    for (let v = Math.max(techo, y - 3); v <= Math.min(Y1, y + 3); v += 1) for (let u = Math.max(X0, x - 3); u <= Math.min(X1, x + 3); u += 1) if (!enPildora(u, v)) zona[idx(u, v)] = 1;
  }
  const enZona = (x, y) => x >= X0 && x <= X1 && y >= techo && y <= Y1 && zona[idx(x, y)];
  // Arranca del color de referencia, para que el logo no tiña el relleno.
  for (let y = techo; y <= Y1; y += 1) for (let x = X0; x <= X1; x += 1) if (zona[idx(x, y)]) {
    const k = (y * width + x) * channels; for (let c = 0; c < 3; c += 1) px[k + c] = Math.round(color[c]);
  }
  for (let pasada = 0; pasada < 300; pasada += 1) {
    for (let y = techo; y <= Y1; y += 1) for (let x = X0; x <= X1; x += 1) {
      if (!zona[idx(x, y)]) continue;
      const suma = [0, 0, 0]; let m = 0;
      for (const [u, v] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
        if (u < 0 || v < 0 || u >= width || v >= height || enPildora(u, v)) continue;
        if (!enZona(u, v) && destaca(u, v)) continue;
        const j = (v * width + u) * channels; suma[0] += px[j]; suma[1] += px[j + 1]; suma[2] += px[j + 2]; m += 1;
      }
      if (!m) continue;
      const k = (y * width + x) * channels; for (let c = 0; c < 3; c += 1) px[k + c] = Math.round(suma[c] / m);
    }
  }
  return zona.reduce((a, b) => a + b, 0);
}

// Limpia la marca en un buffer de píxeles (RGB o RGBA, entrelazado). Devuelve el informe.
export function limpiarPixeles(px, width, height, channels){
  if (width < 400 || height < 200) return {quitada:false, motivo:'imagen demasiado pequeña'};
  const {mascara, w, h, caja:b, fondo} = mascaraEnCaja(px, width, height, channels);
  const al = alineacion(mascara, w, h), score = al.score;
  if (score < UMBRAL_PARECIDO) return {quitada:false, parecido:Number(score.toFixed(3))};
  // La píldora se mira ANTES de tocar nada y sólo con la marca ya reconocida: sin marca no
  // hay píldora que quitar.
  const conPildora = pildora(px, width, height, channels);
  // La silueta se toma de la PLANTILLA alineada, no de «lo que se aparta del fondo»: si la
  // marca cae junto a un logo (portada de NVIDIA en castellano), el logo también se aparta del
  // fondo y acababa borrado. Así sólo se toca la marca.
  const silueta = plantillaColocada(al, w, h);
  // Zona a reconstruir: el trazo, 2 px alrededor, y además el brillo tenue del suavizado del
  // texto (contraste > UMBRAL_HALO) que quede a ≤ 3 px del trazo. Con sólo 1 px de halo quedaba
  // un rastro visible de las letras en las láminas oscuras (comprobado a ojo, 21-09-2026).
  // Lo que está más lejos —el fondo, el borde de una forma— no se toca.
  const distancia = new Uint8Array(w * h).fill(255);
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) if (silueta[y * w + x]) {
    for (let yy = Math.max(0, y - 3); yy <= Math.min(h - 1, y + 3); yy += 1) for (let xx = Math.max(0, x - 3); xx <= Math.min(w - 1, x + 3); xx += 1) {
      const d = Math.max(Math.abs(yy - y), Math.abs(xx - x)); if (d < distancia[yy * w + xx]) distancia[yy * w + xx] = d;
    }
  }
  const zona = new Uint8Array(w * h);
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
    const i = y * w + x, d = distancia[i];
    if (d <= 2 || (d <= 3 && Math.abs(lum(px, ((b.y0 + y) * width + b.x0 + x) * channels) - fondo) > UMBRAL_HALO)) zona[i] = 1;
  }
  // Contenido que NO es marca (logo, formas): no se usa como fuente del relleno, para no
  // arrastrar su color a donde estaba el texto.
  const contenido = (gx, gy) => Math.abs(lum(px, (gy * width + gx) * channels) - fondo) > UMBRAL_CONTRASTE;
  // Difusión: cada píxel de la zona toma la media de sus vecinos, muchas pasadas. Arranca
  // del color medio de lo que NO es trazo en la caja, para converger rápido; los píxeles
  // fuera de la zona no cambian.
  const idx = (x, y) => ((b.y0 + y) * width + b.x0 + x) * channels;
  const base = [0, 0, 0]; let fuera = 0, pixeles = 0;
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
    if (zona[y * w + x]) { pixeles += 1; continue; }
    if (contenido(b.x0 + x, b.y0 + y)) continue;
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
        const dentro = vx >= 0 && vy >= 0 && vx < w && vy < h && zona[vy * w + vx];
        if (!dentro && contenido(gx, gy)) continue;
        const j = (gy * width + gx) * channels;
        suma[0] += px[j]; suma[1] += px[j + 1]; suma[2] += px[j + 2]; n += 1;
      }
      if (!n) continue;
      const k = idx(x, y);
      for (let c = 0; c < 3; c += 1) px[k + c] = Math.round(suma[c] / n);
    }
  }
  let tira = 0;
  if (conPildora.hay) { tira = quitarTira(px, width, height, channels); pixeles += tira + pintarPildora(px, width, height, channels); }
  return {quitada:true, parecido:Number(score.toFixed(3)), pixeles, pildora:conPildora.hay, tira:tira > 0, residuo:Number(residuo(px, width, height, channels, al).toFixed(3))};
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
  return {file:out, report:{changed:true, mode:'gemini-watermark', quitadas, pildoras:laminas.filter(l => l.pildora).length, total:laminas.length, laminas}};
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
  return {file:out, report:{changed:true, mode:'gemini-watermark', quitadas, pildoras:paginas.filter(p => p.pildora).length, total:paginas.length, paginas}};
}
