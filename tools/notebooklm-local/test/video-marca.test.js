// FLT-100803 (Morfeo, 21-09-2026) · las marcas «Gemini Notebook» fuera de los vídeos.
// Vídeos sintéticos de 1280×720 hechos con el propio ffmpeg: contenido con la marca de esquina
// mezclada con el mapa medido (negro al α del mapa) y una cortinilla final dibujada desde la
// plantilla. Se comprueba que se reconocen, que se quitan, que el contenido que pasa por detrás
// de la marca se recupera y que un vídeo sin marcas sale tal cual.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import sharp from 'sharp';
import ffmpeg from 'ffmpeg-static';
import {ESQUINA, CORTINILLA, limpiarVideo, buscarCortinilla, marcaEnEsquina, datosVideo, MARGEN_ESQUINA} from '../video-marca.js';

const W = 1280, H = 720;
const alfa = Array.from({length:ESQUINA.ancho * ESQUINA.alto}, (_, i) => parseInt(ESQUINA.alfa.slice(i * 2, i * 2 + 2), 16) / 255);
const bit = i => (parseInt(CORTINILLA.bits[i >> 2], 16) >> (3 - (i & 3))) & 1;

// Contenido: fondo azulado, una barra oscura vertical y una línea gris horizontal que pasan por
// debajo de la marca (lo que la marca tapa y hay que recuperar).
function contenido(){
  const px = Buffer.alloc(W * H * 3);
  for (let i = 0; i < W * H; i += 1) { px[i * 3] = 222; px[i * 3 + 1] = 230; px[i * 3 + 2] = 242; }
  for (let y = 600; y < H; y += 1) for (let x = 1196; x < 1212; x += 1) { const k = (y * W + x) * 3; px[k] = 20; px[k + 1] = 60; px[k + 2] = 200; }
  for (let x = 1100; x < W; x += 1) for (let y = 703; y < 706; y += 1) { const k = (y * W + x) * 3; px[k] = px[k + 1] = px[k + 2] = 120; }
  return px;
}
function cortinilla(){
  const px = Buffer.alloc(W * H * 3);
  for (let i = 0; i < W * H; i += 1) { px[i * 3] = 246; px[i * 3 + 1] = 246; px[i * 3 + 2] = 249; }
  const s = W / CORTINILLA.w;
  for (let y = 0; y < CORTINILLA.alto; y += 1) for (let x = 0; x < CORTINILLA.ancho; x += 1) if (bit(y * CORTINILLA.ancho + x)) {
    for (let v = 0; v < s; v += 1) for (let u = 0; u < s; u += 1) { const k = (((CORTINILLA.y + y) * s + v) * W + (CORTINILLA.x + x) * s + u) * 3; px[k] = 60; px[k + 1] = 64; px[k + 2] = 80; }
  }
  return px;
}
function conMarca(px){
  const out = Buffer.from(px);
  for (let y = 0; y < ESQUINA.alto; y += 1) for (let x = 0; x < ESQUINA.ancho; x += 1) {
    const a = alfa[y * ESQUINA.ancho + x], k = ((ESQUINA.y + y) * W + ESQUINA.x + x) * 3;
    for (let c = 0; c < 3; c += 1) out[k + c] = Math.round(out[k + c] * (1 - a));
  }
  return out;
}
const png = (px, file) => sharp(px, {raw:{width:W, height:H, channels:3}}).png().toFile(file);
async function video(dir, nombre, partes){
  const args = ['-hide_banner', '-loglevel', 'error', '-y'];
  for (const [i, {px, segundos}] of partes.entries()) { const f = path.join(dir, `${nombre}-${i}.png`); await png(px, f); args.push('-loop', '1', '-framerate', '24', '-t', String(segundos), '-i', f); }
  const total = partes.reduce((a, p) => a + p.segundos, 0), voz = partes[0].segundos;
  args.push('-f', 'lavfi', '-t', String(total), '-i', `aevalsrc='if(lt(t,${voz}),0.3*sin(2*PI*440*t),0)':s=44100`);
  args.push('-filter_complex', `${partes.map((_, i) => `[${i}:v]`).join('')}concat=n=${partes.length}:v=1:a=0,format=yuv420p[v]`, '-map', '[v]', '-map', `${partes.length}:a`, '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '12', '-c:a', 'aac', path.join(dir, `${nombre}.mp4`));
  const r = spawnSync(ffmpeg, args, {encoding:'utf8'}); assert.equal(r.status, 0, r.stderr);
  return path.join(dir, `${nombre}.mp4`);
}
function fotograma(file, segundo){
  const r = spawnSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-ss', String(segundo), '-i', file, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], {maxBuffer:1 << 26});
  return r.stdout;
}

test('cortinilla y marca de esquina: se reconocen, se quitan y lo de detrás se recupera', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'video-marca-'));
  const limpio = contenido(), file = await video(dir, 'gemini', [{px:conMarca(limpio), segundos:3}, {px:conMarca(cortinilla()), segundos:2}]);
  const {file:salida, report} = await limpiarVideo(file, {ffmpeg});
  assert.equal(report.changed, true, JSON.stringify(report));
  assert.equal(report.cortinilla.hay, true);
  assert.ok(Math.abs(report.cortinilla.corte - 3) <= 0.1, `corte en ${report.cortinilla.corte}`);
  assert.ok(Math.abs(report.duracionFinal - report.cortinilla.corte) <= 0.1, 'el vídeo acaba donde empezaba la cortinilla');
  assert.equal(report.esquina.hay, true);
  assert.equal(report.controlEsquina.hay, false, 'en lo que sale ya no se ve la marca');
  // Píxel a píxel en la región de la marca: lo que sale se parece a lo de antes de la marca.
  const f = fotograma(salida, 1.5);
  let error = 0, n = 0, error0 = 0;
  const g = fotograma(file, 1.5);
  for (let y = 0; y < ESQUINA.alto; y += 1) for (let x = 0; x < ESQUINA.ancho; x += 1) {
    if (alfa[y * ESQUINA.ancho + x] < 0.2) continue;
    const k = ((ESQUINA.y + y) * W + ESQUINA.x + x) * 3;
    for (let c = 0; c < 3; c += 1) { error += Math.abs(f[k + c] - limpio[k + c]); error0 += Math.abs(g[k + c] - limpio[k + c]); n += 1; }
  }
  assert.ok(error / n < 6, `la marca se deshace (error medio ${(error / n).toFixed(1)} frente a ${(error0 / n).toFixed(1)} con marca)`);
  assert.ok(error0 / n > 30, 'y de verdad había marca');
});

test('un vídeo sin marcas ni cortinilla sale tal cual', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'video-marca-'));
  const file = await video(dir, 'limpio', [{px:contenido(), segundos:2}]);
  const {file:salida, report} = await limpiarVideo(file, {ffmpeg});
  assert.equal(report.changed, false, JSON.stringify(report));
  assert.equal(salida, file);
});

test('un final blanco con otro logo no es la cortinilla de Gemini: no se corta', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'video-marca-'));
  const otro = cortinilla();
  // Otro logo: un bloque macizo en el centro en vez del de Gemini Notebook.
  for (let i = 0; i < W * H; i += 1) { const x = i % W, y = Math.floor(i / W); const k = i * 3; if (y > 300 && y < 420 && x > 500 && x < 780) { otro[k] = 40; otro[k + 1] = 40; otro[k + 2] = 40; } else if (otro[k] < 200) { otro[k] = 246; otro[k + 1] = 246; otro[k + 2] = 249; } }
  const file = await video(dir, 'otro', [{px:contenido(), segundos:2}, {px:otro, segundos:2}]);
  const {report} = await limpiarVideo(file, {ffmpeg});
  assert.equal(report.cortinilla.hay, false, JSON.stringify(report.cortinilla));
  assert.equal(report.changed, false);
});

test('la cortinilla sólo se corta si dura lo esperado (de 0,8 a 6 s)', () => {
  const {w, h} = CORTINILLA, s = W / w;
  // Fotogramas reducidos a 160×90 a partir de las mismas láminas.
  const reducir = px => { const out = Buffer.alloc(w * h * 3); for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) { const k = ((y * s + 3) * W + x * s + 3) * 3, j = (y * w + x) * 3; out[j] = px[k]; out[j + 1] = px[k + 1]; out[j + 2] = px[k + 2]; } return out; };
  const c = reducir(cortinilla()), v = reducir(contenido());
  const corta = buscarCortinilla([...Array(48).fill(v), ...Array(48).fill(c)], 24, 10);
  assert.equal(corta.hay, true); assert.ok(Math.abs(corta.corte - 11.958) < 0.01, String(corta.corte));
  assert.equal(buscarCortinilla(Array(200).fill(c), 24, 0).hay, false, 'todo cortinilla: no hay contenido que conservar');
  assert.equal(buscarCortinilla([...Array(24).fill(v), ...Array(170).fill(c)], 24, 0).hay, false, 'más de 6 s de «cortinilla» es otra cosa');
});

test('la marca de esquina se distingue de una esquina sin marca', () => {
  const recorte = px => { const {x, y, ancho, alto} = ESQUINA, M = MARGEN_ESQUINA, out = Buffer.alloc(ancho * (alto + 2 * M) * 3); for (let v = 0; v < alto + 2 * M; v += 1) px.copy(out, v * ancho * 3, ((y - M + v) * W + x) * 3, ((y - M + v) * W + x + ancho) * 3); return out; };
  const plano = Buffer.alloc(W * H * 3, 235);
  assert.equal(marcaEnEsquina([recorte(conMarca(plano))]).hay, true);
  assert.equal(marcaEnEsquina([recorte(plano)]).hay, false);
  assert.ok(datosVideo(ffmpeg, '/no/existe.mp4').duracion !== datosVideo(ffmpeg, '/no/existe.mp4').duracion, 'sin fichero, duración NaN');
});
