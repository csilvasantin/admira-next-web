#!/usr/bin/env node
// valida-videos-catalogo.mjs — prueba de validación REPETIBLE de los vídeos de
// un catálogo del Stock (Yokup #3199, 12-sep-2026).
//
// Recorre GET https://api.admira.store/stock/list?catalogo=<id>&type=video,
// descarga cada máster, mide con ffmpeg la luma media (signalstats) y la
// entropía (information) de cada fotograma, aplica LA MISMA regla que el
// creador (assets/tiktok-validacion.js) y el worker (src/stock-poster.mjs):
//   · fotograma «negro» = luma (0..255) < 16, o < 24 con entropía < 1 bit
//   · máster inválido si > 70 % negros, dura < 10 s o no tiene pista de vídeo
//   · póster = fotograma con luma 40..220 y máxima entropía, evitando los
//     0,8 s iniciales y finales
// y comprueba que la pieza tenga póster (meta.poster) en el Stock.
//
// Uso:
//   node tools/valida-videos-catalogo.mjs --catalogo alcampo-2026-09-10
//   node tools/valida-videos-catalogo.mjs --ids auto-9a75882d2e3a36bce8e6
//   añade --subir   para generar y subir el póster (POST /stock/poster, clave
//                   NOTIFY_KEY en la variable de entorno, nunca se imprime)
//   añade --ocultar para marcar oculto:true + validacion en los inválidos
//   --dir <carpeta> (por defecto ~/Claude/alcampo/videos)  --api <origen>
// Sale con código 1 si algún vídeo es inválido o le falta póster (sin --subir).

import { spawnSync } from 'node:child_process';
import { mkdirSync, existsSync, statSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const args = process.argv.slice(2);
const opt = (name, def = null) => { const i = args.indexOf(name); return i >= 0 ? (args[i + 1] ?? true) : def; };
const flag = (name) => args.includes(name);
const API = opt('--api', 'https://api.admira.store');
const CATALOGO = opt('--catalogo');
const IDS = String(opt('--ids', '') || '').split(',').map((s) => s.trim()).filter(Boolean);
const DIR = opt('--dir', join(homedir(), 'Claude', 'alcampo', 'videos'));
const SUBIR = flag('--subir');
const OCULTAR = flag('--ocultar');
const FFMPEG = process.env.FFMPEG || '/opt/homebrew/bin/ffmpeg';
const FFPROBE = process.env.FFPROBE || '/opt/homebrew/bin/ffprobe';
const KEY = process.env.NOTIFY_KEY || '';

const LUMA_NEGRO = 16, NEGRO_MAX_RATIO = 0.7, DURACION_MIN = 10, MARGEN = 0.8;

if (!CATALOGO && !IDS.length) { console.error('Falta --catalogo <id> o --ids a,b'); process.exit(2); }
if ((SUBIR || OCULTAR) && !KEY) { console.error('Falta NOTIFY_KEY en el entorno (bóveda) para --subir/--ocultar'); process.exit(2); }
mkdirSync(DIR, { recursive: true });

function run(cmd, a) {
  const r = spawnSync(cmd, a, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.error) throw r.error;
  return r;
}

async function listar() {
  const items = [];
  if (CATALOGO) {
    const r = await fetch(`${API}/stock/list?catalogo=${encodeURIComponent(CATALOGO)}&type=video&limit=200&ocultos=1`);
    if (!r.ok) throw new Error(`list HTTP ${r.status}`);
    items.push(...((await r.json()).items || []));
  }
  for (const id of IDS) {
    if (items.some((i) => i.id === id)) continue;
    const r = await fetch(`${API}/stock/list?ocultos=1&limit=200&q=${encodeURIComponent(id)}`).catch(() => null);
    const hit = r && r.ok ? ((await r.json()).items || []).find((i) => i.id === id) : null;
    items.push(hit || { id, url: `${API}/stock/asset/${id}`, title: id, mime: 'video/webm' });
  }
  return items;
}

async function descargar(item) {
  const ext = (item.ext || (item.mime || '').split('/')[1] || 'webm').replace(/[^a-z0-9]/gi, '') || 'webm';
  const file = join(DIR, `${item.id}.${ext}`);
  if (existsSync(file) && item.size && statSync(file).size === item.size) return file;
  const r = await fetch(item.url || `${API}/stock/asset/${item.id}`);
  if (!r.ok) throw new Error(`asset HTTP ${r.status}`);
  writeFileSync(file, Buffer.from(await r.arrayBuffer()));
  return file;
}

function sondear(file) {
  const p = run(FFPROBE, ['-v', 'error', '-show_entries', 'stream=codec_type,codec_name,width,height,r_frame_rate,color_range', '-of', 'json', file]);
  const streams = (JSON.parse(p.stdout || '{}').streams || []);
  const v = streams.find((s) => s.codec_type === 'video');
  const fps = v ? (v.r_frame_rate || '30/1').split('/').reduce((a, b) => a / b) : 30;
  return { video: v, fps, codec: v ? v.codec_name : null, res: v ? `${v.width}x${v.height}` : null, rango: v ? (v.color_range || 'tv') : 'tv' };
}

// Luma y entropía de un fotograma de cada `paso`. YAVG viene en la escala del
// vídeo (16..235 en rango limitado) → se pasa a 0..255 como en el navegador.
function medir(file, paso, rango) {
  const p = run(FFPROBE, ['-v', 'error', '-f', 'lavfi', '-i', `movie=${file},select='not(mod(n\\,${paso}))',signalstats,entropy`,
    '-show_entries', 'frame=pts_time:frame_tags=lavfi.signalstats.YAVG,lavfi.entropy.entropy.normal.Y', '-of', 'csv=p=0']);
  const out = [];
  for (const line of String(p.stdout).split('\n')) {
    const [t, y, e] = line.split(',');
    if (t === undefined || y === undefined || t === '') continue;
    const yavg = +y;
    const luma = rango === 'pc' ? yavg : Math.max(0, Math.min(255, (yavg - 16) * 255 / 219));
    out.push({ t: +t, luma: +luma.toFixed(1), entropia: +(+e || 0).toFixed(3) });
  }
  return out;
}

const esNegra = (m) => m.luma < LUMA_NEGRO || (m.luma < LUMA_NEGRO + 8 && m.entropia < 1);

function evaluar(muestras, duracion, tienePista) {
  const total = muestras.length, negros = muestras.filter(esNegra).length;
  if (!tienePista || !total) return { ok: false, negros, muestras: total, duracion, motivo: 'sin pista de vídeo' };
  if (duracion != null && duracion < DURACION_MIN) return { ok: false, negros, muestras: total, duracion, motivo: `duración ${duracion.toFixed(1)} s < ${DURACION_MIN} s` };
  if (negros / total > NEGRO_MAX_RATIO) return { ok: false, negros, muestras: total, duracion, motivo: `Vídeo inválido: ${negros}/${total} fotogramas negros` };
  return { ok: true, negros, muestras: total, duracion, motivo: null };
}

function elegir(muestras, dur) {
  const dentro = (m) => dur == null || (m.t >= MARGEN && m.t <= dur - MARGEN);
  const tiers = [
    muestras.filter((m) => !esNegra(m) && dentro(m) && m.luma >= 40 && m.luma <= 220),
    muestras.filter((m) => !esNegra(m) && m.luma >= 40 && m.luma <= 220),
    muestras.filter((m) => !esNegra(m) && dentro(m)),
    muestras.filter((m) => !esNegra(m)),
  ];
  for (const tier of tiers) if (tier.length) return tier.sort((a, b) => b.entropia - a.entropia || a.t - b.t)[0];
  return null;
}

function extraerPoster(file, t) {
  const out = file.replace(/\.[a-z0-9]+$/i, '') + '.poster.jpg';
  run(FFMPEG, ['-v', 'error', '-y', '-ss', String(t), '-i', file, '-frames:v', '1',
    '-vf', 'scale=540:960:force_original_aspect_ratio=increase,crop=540:960', '-q:v', '3', out]);
  return out;
}

async function subirPoster(id, posterFile, t, validacion) {
  const b64 = readFileSync(posterFile).toString('base64');
  const r = await fetch(`${API}/stock/poster`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'X-Notify-Key': KEY },
    body: JSON.stringify({ id, poster: `data:image/jpeg;base64,${b64}`, at: t, validacion }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`poster HTTP ${r.status} ${d.error || ''}`);
  return d;
}

async function ocultar(id, validacion) {
  const r = await fetch(`${API}/stock/${id}/meta`, {
    method: 'PATCH', headers: { 'content-type': 'application/json', 'X-Notify-Key': KEY },
    body: JSON.stringify({ oculto: true, validacion }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`meta HTTP ${r.status} ${d.error || ''}`);
  return d;
}

const items = await listar();
if (!items.length) { console.log('Sin vídeos que validar.'); process.exit(0); }
console.log(`${items.length} vídeo(s) · ${CATALOGO ? 'catálogo ' + CATALOGO : 'ids ' + IDS.join(',')} · ffmpeg ${FFMPEG}`);
let fallos = 0;
const filas = [];
for (const item of items) {
  const fila = { id: item.id, titulo: (item.title || '').slice(0, 34) };
  try {
    const file = await descargar(item);
    const s = sondear(file);
    const paso = Math.max(1, Math.round(s.fps / 2)); // ~2 muestras por segundo
    const muestras = s.video ? medir(file, paso, s.rango) : [];
    const duracion = muestras.length ? +(muestras[muestras.length - 1].t + paso / s.fps).toFixed(2) : null;
    const validacion = { ...evaluar(muestras, duracion, !!s.video), por: 'ffmpeg valida-videos-catalogo', at: new Date().toISOString() };
    const mejor = validacion.ok ? elegir(muestras, duracion) : null;
    Object.assign(fila, { codec: `${s.codec} ${s.res}`, dur: duracion, negros: `${validacion.negros}/${validacion.muestras}`,
      luma0: muestras[0] ? muestras[0].luma : null, lumaMax: muestras.length ? Math.max(...muestras.map((m) => m.luma)) : null,
      ok: validacion.ok, motivo: validacion.motivo || '', posterT: mejor ? mejor.t : null, poster: item.poster || '' });
    if (validacion.ok && mejor) {
      const posterFile = extraerPoster(file, mejor.t);
      fila.posterLocal = posterFile;
      if (SUBIR) {
        const d = await subirPoster(item.id, posterFile, mejor.t, validacion);
        fila.poster = d.poster || d.thumbnail;
      }
    } else if (!validacion.ok && OCULTAR) {
      await ocultar(item.id, validacion);
      fila.oculto = true;
    }
    if (!validacion.ok) fallos++;
    else if (!fila.poster && !SUBIR) { fallos++; fila.motivo = 'sin póster en el Stock (meta.poster)'; }
  } catch (e) {
    fallos++; fila.ok = false; fila.motivo = String(e && e.message || e).slice(0, 120);
  }
  filas.push(fila);
}
console.table(filas.map(({ posterLocal, ...f }) => f));
for (const f of filas) if (f.posterLocal) console.log(`  póster local ${f.id}: ${f.posterLocal}`);
console.log(fallos ? `✗ ${fallos} vídeo(s) con problema` : '✓ todos válidos y con póster');
process.exit(fallos ? 1 : 0);
