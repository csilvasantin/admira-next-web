// QUITAR LAS MARCAS «Gemini Notebook» DE LOS VÍDEOS (MorfeoMacMini, 21-09-2026 · FLT-100803).
//
// Los vídeos de Gemini Notebook (1280×720, 24 fps) llevan dos marcas, medidas en los dos vídeos
// de pixeria-beat-emocional (inglés y castellano):
//  1) la CORTINILLA final: tras un corte seco, ~3 s de fondo claro (246,246,249) con el logo
//     «◠ Gemini Notebook» centrado, y en silencio (−91 dB). Se reconoce por plantilla en el último
//     fotograma y se corta el vídeo —imagen y sonido— justo antes de su primer fotograma.
//  2) la MARCA DE ESQUINA, en todos los fotogramas (x 1157–1271, y 700–709): negro con opacidad de
//     hasta el 42,5 %. Ajustando fotograma a fotograma, el color de la marca sale ≈ 0, así que el
//     fondo se recupera EXACTO —también donde pasa contenido por detrás—: fondo = píxel / (1 − α).
//     El mapa de α se midió en la cortinilla (fondo plano y conocido, 72 fotogramas); aplicado al
//     vídeo en castellano deja el mismo error que su propio mapa (1,8 de 255).
// Nada se toca sin reconocerlo: sin plantilla no se corta, y la esquina sólo se limpia si el modelo
// de la mezcla explica lo que hay mucho mejor que «no hay marca». Si no hay nada, el fichero sale
// tal cual, byte a byte.
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import sharp from 'sharp';

// α × 255 por píxel en la región (alineada a pares para el 4:2:0), fila a fila.
export const ESQUINA = {w:1280, h:720, x:1154, y:698, ancho:122, alto:16, alfa:'000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000121f201700000000000000000000001221201600000000000000000000000000000000000000000019210000000000000009280e000000100f0000000012000000000000000000000000000000000000000011000000000000000000000000000000000000000000140000000000000000000000000000001a465e66645c532900000000000000003d5b61615d430b00000000000000000000000000000000000000415600000000000000186625000000475c16000010522300000000000000001d1a0000000000000000155818000000000000000000000000000000000000000e5b1d000000000000000000000000002765696869593d47673b0000000000004460280909244b1200000000000000000000000000000000000000000c00000000000000000f000000004e694c000012592600000000000000004b440000000000000000186017000000000000000000000000000000000000000f641f0000000000000000000000001a6269685d4351602b2e6a310000000025631d000000000000000015434c3f1000232b284b4412234a4a2100212c0d331e3a4c37000a37100000004c48592f0010592400153f4d421b00305b5a3b0e002f4c492700165d293d4e370a00001c434c441100000c3a4e4627000f641e00113d1f00000000000000004b6b5b525f581f3b661e3b610e0000003e530000001319161700175e442d49540a3f69463157604e324c5f133a5216625a393b64370e631f00000051372860120e5923145c4e2f4860222e5c5a3a103e5834395c2d14615b3b365b4d00226145324c5d15095254353e60320e631d105a4a0a0000000000000012674f130918545812534a18612b000000424700000f4f5c5b622d3e56120e195b2e3a5a0a002b641a0010661e3850145e340000464d10631e000000503e004f480d562040510000004453004c400019622d0e0e405419652d00001f5f204b43000000533b295e0d00003357185e2d53480000000000000000002465200000001968232d600e543b0000003559000000101013602b4a5d505051532c3c500000255a11000964213750155b2400003f4e11631e000000523d00165c3351264b3c0000002762004d4200256852525053471f5e1800000852385329000000374c3b4b000000155d265e6564400000000000000000002762190000000a642a28600e543d00000015603300000000265f16464c0a08091200404f0000275912000c6521384d155b2500003f4d0f631f000000513c000034636221484b000000395a004e43001b632100080d0d1863220000165c274e3a0000004a402f59000000265c1d6241276429000000000000000026641a0000000b692c2a640f5540000000002b654727243d603400216334142b53113e520000275c14000c67223951155f260000434d116420000000533e000000506c251c603d1b305f2b004a561b0f4b541c1b483a15645a281e5258002d62311d3a631c115b461e285f3d0e661e003e60160000000000000019431000000000481d1c450a382a00000000001f485c5d4e2500000026515a532c002d3a00001d3f0d0009491a273b11411c00002f380b4616000000392d00000019491c0024505c522d00001c5258150d425a5a430e12402f515b471400002c535c5422000018485c593a000a4617000a4832000000000000000000000000000000000000000000000000000000000008000000000000000900000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000'};
// Logo de la cortinilla (1 = trazo más oscuro que el fondo) en el fotograma reducido a 160×90.
export const CORTINILLA = {w:160, h:90, x:36, y:37, ancho:88, alto:16, bits:'0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000004018000020000000000003f07c001837604080010003f8c0eecfa76eecf3192007fccffffff7fffff7bd600454cff93ef6f9df9ce7c0047447893ef6f9d29ce7c004747de93ef66f7ef7bd6000001040000004040000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000'};
export const UMBRAL_CORTINILLA = 0.6;   // IoU mínimo con la plantilla del logo
export const MARGEN_ESQUINA = 6;        // filas por encima y por debajo para estimar el fondo

const lum = (px, i) => 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
const alfaEsquina = () => Array.from({length:ESQUINA.ancho * ESQUINA.alto}, (_, i) => parseInt(ESQUINA.alfa.slice(i * 2, i * 2 + 2), 16) / 255);
const bitCortinilla = i => (parseInt(CORTINILLA.bits[i >> 2], 16) >> (3 - (i & 3))) & 1;

function fotogramas(ffmpeg, entrada, filtro, ancho, alto){
  const r = spawnSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', ...entrada, '-vf', filtro, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], {maxBuffer:1 << 30});
  if (r.status !== 0) throw new Error(`ffmpeg no pudo leer el vídeo: ${String(r.stderr || '').slice(0, 200)}`);
  const t = ancho * alto * 3, n = Math.floor(r.stdout.length / t);
  return Array.from({length:n}, (_, i) => r.stdout.subarray(i * t, (i + 1) * t));
}
export function datosVideo(ffmpeg, file){
  const info = String(spawnSync(ffmpeg, ['-hide_banner', '-i', file], {encoding:'utf8'}).stderr || '');
  const d = info.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/), v = info.match(/Video:.*?(\d{2,5})x(\d{2,5})/), f = info.match(/(\d+(?:\.\d+)?) fps/);
  return {duracion:d ? Number(d[1]) * 3600 + Number(d[2]) * 60 + Number(d[3]) : NaN, ancho:v ? Number(v[1]) : 0, alto:v ? Number(v[2]) : 0, fps:f ? Number(f[1]) : 24, audio:/Audio:/.test(info)};
}

// ── Cortinilla ───────────────────────────────────────────────────────────────
// Fotograma de 160×90: color de fondo (mediana del borde) y cuánto de él es fondo.
function fondoDe(px){
  const {w, h} = CORTINILLA, borde = [];
  for (let x = 0; x < w; x += 1) { borde.push((x) * 3, ((h - 1) * w + x) * 3); }
  const orden = [...borde].sort((a, b) => lum(px, a) - lum(px, b)), k = orden[orden.length >> 1];
  return [px[k], px[k + 1], px[k + 2]];
}
function planoSobre(px, fondo){
  let n = 0; const total = CORTINILLA.w * CORTINILLA.h;
  for (let i = 0; i < total; i += 1) if (Math.max(Math.abs(px[i * 3] - fondo[0]), Math.abs(px[i * 3 + 1] - fondo[1]), Math.abs(px[i * 3 + 2] - fondo[2])) <= 10) n += 1;
  return n / total;
}
// IoU entre el logo del fotograma y la plantilla, tolerando ±1 px.
export function parecidoCortinilla(px){
  const {w, x:X, y:Y, ancho, alto} = CORTINILLA, fondo = fondoDe(px), claro = 0.299 * fondo[0] + 0.587 * fondo[1] + 0.114 * fondo[2];
  let mejor = 0;
  for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
    let inter = 0, union = 0;
    for (let y = 0; y < alto; y += 1) for (let x = 0; x < ancho; x += 1) {
      const a = lum(px, ((Y + y + dy) * w + X + x + dx) * 3) < claro - 30 ? 1 : 0, b = bitCortinilla(y * ancho + x);
      inter += a & b; union += a | b;
    }
    if (union && inter / union > mejor) mejor = inter / union;
  }
  return mejor;
}
// Recibe los fotogramas finales (160×90) y dónde empiezan; devuelve dónde cortar.
export function buscarCortinilla(finales, fps, inicio){
  if (!finales.length) return {hay:false, motivo:'sin fotogramas'};
  const ultimo = finales[finales.length - 1], fondo = fondoDe(ultimo), parecido = parecidoCortinilla(ultimo);
  const claro = 0.299 * fondo[0] + 0.587 * fondo[1] + 0.114 * fondo[2];
  if (claro < 200 || planoSobre(ultimo, fondo) < 0.85 || parecido < UMBRAL_CORTINILLA) return {hay:false, parecido:Number(parecido.toFixed(3))};
  let i = finales.length - 1;
  while (i > 0 && planoSobre(finales[i - 1], fondo) >= 0.85) i -= 1;
  // Se corta un fotograma antes del primero de la cortinilla: mejor perder 42 ms que dejar un blanco.
  const corte = inicio + (i - 1) / fps, segundos = inicio + finales.length / fps - corte;
  if (i === 0 || segundos < 0.8 || segundos > 6) return {hay:false, parecido:Number(parecido.toFixed(3)), motivo:'la cortinilla no tiene la duración esperada'};
  return {hay:true, corte:Number(corte.toFixed(3)), segundos:Number(segundos.toFixed(2)), parecido:Number(parecido.toFixed(3))};
}

// ── Marca de esquina ─────────────────────────────────────────────────────────
// Recibe recortes de la esquina (ancho × alto + 2·margen). En las columnas con fondo suave
// (arriba ≈ abajo), compara «hay marca» (píxel / (1 − α) ≈ fondo) con «no hay» (píxel ≈ fondo).
export function marcaEnEsquina(recortes){
  const {ancho, alto} = ESQUINA, M = MARGEN_ESQUINA, H = alto + 2 * M, alfa = alfaEsquina();
  let con = 0, sin = 0, muestras = 0;
  for (const b of recortes) for (let x = 0; x < ancho; x += 1) {
    let suave = true;
    for (let c = 0; c < 3; c += 1) {
      if (Math.abs(b[(2 * ancho + x) * 3 + c] - b[((H - 3) * ancho + x) * 3 + c]) > 4 || Math.abs(b[(2 * ancho + x) * 3 + c] - b[x * 3 + c]) > 3) suave = false;
    }
    if (!suave) continue;
    for (let y = 0; y < alto; y += 1) {
      const a = alfa[y * ancho + x]; if (a < 0.1) continue;
      const t = (y + M - 2) / (H - 5);
      for (let c = 0; c < 3; c += 1) {
        const fondo = b[(2 * ancho + x) * 3 + c] * (1 - t) + b[((H - 3) * ancho + x) * 3 + c] * t, v = b[((y + M) * ancho + x) * 3 + c];
        con += Math.abs(Math.min(255, v / (1 - a)) - fondo); sin += Math.abs(v - fondo); muestras += 1;
      }
    }
  }
  return {hay:muestras >= 300 && con < 0.5 * sin, muestras, errorConMarca:muestras ? Number((con / muestras).toFixed(2)) : null, errorSinMarca:muestras ? Number((sin / muestras).toFixed(2)) : null};
}
function recortesEsquina(ffmpeg, file, duracion, n = 40){
  const {x, y, ancho, alto} = ESQUINA, M = MARGEN_ESQUINA;
  return fotogramas(ffmpeg, ['-i', file], `fps=${(n / Math.max(1, duracion)).toFixed(4)},crop=${ancho}:${alto + 2 * M}:${x}:${y - M}`, ancho, alto + 2 * M);
}

// ── Todo junto ───────────────────────────────────────────────────────────────
export async function limpiarVideo(file, {ffmpeg}){
  if (!ffmpeg) throw new Error('Falta ffmpeg para limpiar el vídeo.');
  const datos = datosVideo(ffmpeg, file), base = {mode:'gemini-notebook-video', duracionOriginal:Number(datos.duracion.toFixed(2))};
  if (!Number.isFinite(datos.duracion) || datos.duracion < 2) throw new Error('No se pudo leer la duración del vídeo.');
  const tramo = Math.min(8, datos.duracion), inicio = datos.duracion - tramo;
  const cortinilla = buscarCortinilla(fotogramas(ffmpeg, ['-ss', inicio.toFixed(3), '-i', file], `scale=${CORTINILLA.w}:${CORTINILLA.h}:flags=area`, CORTINILLA.w, CORTINILLA.h), datos.fps, inicio);
  const esquina = datos.ancho === ESQUINA.w && datos.alto === ESQUINA.h ? marcaEnEsquina(recortesEsquina(ffmpeg, file, datos.duracion)) : {hay:false, motivo:`resolución ${datos.ancho}×${datos.alto}`};
  if (!cortinilla.hay && !esquina.hay) return {file, report:{...base, changed:false, cortinilla, esquina}};
  const salida = path.join(path.dirname(file), `${path.basename(file, path.extname(file))}.sin-marca.mp4`);
  const args = ['-hide_banner', '-y', '-loglevel', 'error', '-i', file];
  if (esquina.hay) {
    // Mapa: 255·(1 − α). La mezcla se deshace en RGB sólo en la región de la marca.
    const {x, y, ancho, alto} = ESQUINA, alfa = alfaEsquina();
    const mapa = path.join(path.dirname(file), `${path.basename(file, path.extname(file))}.mapa-marca.png`);
    await sharp(Buffer.from(alfa.map(a => Math.round(255 * (1 - a)))), {raw:{width:ancho, height:alto, channels:1}}).png().toFile(mapa);
    args.push('-loop', '1', '-i', mapa, '-filter_complex',
      `[0:v]split[a][b];[b]crop=${ancho}:${alto}:${x}:${y},format=gbrp[c];[1:v]format=gbrp[m];[c][m]blend=all_expr='if(gte(B\\,255)\\,A\\,min(255\\,A*255/B))':shortest=1[d];[a][d]overlay=${x}:${y},format=yuv420p[v]`,
      '-map', '[v]');
  } else args.push('-map', '0:v');
  if (datos.audio) args.push('-map', '0:a');
  if (cortinilla.hay) args.push('-t', cortinilla.corte.toFixed(3));
  args.push('-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-c:a', 'copy', '-movflags', '+faststart', salida);
  const r = spawnSync(ffmpeg, args, {encoding:'utf8', maxBuffer:1 << 24});
  if (r.status !== 0) throw new Error(`ffmpeg no pudo limpiar el vídeo: ${String(r.stderr || '').slice(0, 300)}`);
  // Comprobación sobre lo que sale: la esquina ya no debe explicarse con la marca.
  const final = datosVideo(ffmpeg, salida), control = esquina.hay ? marcaEnEsquina(recortesEsquina(ffmpeg, salida, final.duracion, 20)) : null;
  return {file:salida, report:{...base, changed:true, duracionFinal:Number(final.duracion.toFixed(2)), cortinilla, esquina, controlEsquina:control}};
}
