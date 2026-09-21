// FLT-100788 (Morfeo, 21-sep-2026) · el productor, adaptado a «Gemini Notebook».
//
// Google renovó NotebookLM como Gemini Notebook y el productor dejó de poder trabajar:
// las tarjetas de Studio ya no son <button> sino div role="button", el vídeo abre en un
// formato «Corto» vertical nuevo y sus estilos sólo aparecen con «Vídeo explicativo», las
// opciones son mat-radio-button y la fuente pegada lleva su título en aria-label. Todo se
// mapeó abriendo cada diálogo en un cuaderno de prueba sin pulsar «Generar». Aquí se fija
// que el worker use la interfaz nueva; la prueba de verdad es una generación real.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const worker = await readFile(new URL('../tools/notebooklm-local/worker.js', import.meta.url), 'utf8');
const trozo = (desde, hasta) => worker.slice(worker.indexOf(desde), worker.indexOf(hasta, worker.indexOf(desde)));

test('los botones incluyen las tarjetas de Studio (div role="button")', () => {
  const buscador = trozo('async function button(', 'async function clickButton(');
  assert.equal((buscador.match(/querySelectorAll\('button,\[role="button"\]'\)/g) || []).length, 2);
});

test('las opciones de los diálogos se eligen en mat-radio-button y [role="radio"], con espera', () => {
  const opcion = trozo('async function pickOption(', 'const LANGUAGE_OPTIONS');
  assert.match(opcion, /mat-radio-button,\[role="radio"\]/);
  assert.match(opcion, /waitForFunction/);
  assert.match(opcion, /no ofrece la opción/);
  assert.doesNotMatch(worker, /querySelectorAll\('\[role="radio"\]'\)\]\.find/, 'ya no quedan clics a radios de la interfaz vieja');
});

test('la fuente pegada se reconoce también por su aria-label', () => {
  assert.match(trozo('async function newNotebook(', 'async function generateAudio('), /getAttribute\('aria-label'\)\|\|''\)\+' '\+\(el\.innerText\|\|''\)\)\.includes\('ADMIRANEXT'\)/);
});

test('cada entregable abre su tarjeta nueva y rellena los campos de hoy', () => {
  const video = trozo('async function generateVideo(', 'async function generateInfographic(');
  assert.match(video, /openStudio\(page,'Resumen de vídeo'\)/);
  assert.ok(video.indexOf("pickOption(page,'Vídeo explicativo')") < video.indexOf("pickOption(page,'Personalizado')"), 'el estilo sólo existe en el explicativo');
  assert.match(video, /fillByLabel\(page,'¿En qué debe centrarse el vídeo\?'/);
  const infografia = trozo('async function generateInfographic(', 'async function generateSlideDeck(');
  assert.match(infografia, /openStudio\(page,'Infografía'\)/);
  assert.match(infografia, /fillByLabel\(page,'Describe la infografía que quieres crear'/);
  const deck = trozo('async function generateSlideDeck(', 'async function processNext(');
  assert.match(deck, /openStudio\(page,'Presentación'\)/);
  assert.match(deck, /pickOption\(page,'Diapositivas del presentador'\)/);
  assert.doesNotMatch(worker, /'Personalizar (presentación de diapositivas|infografía)'/);
  assert.match(trozo('async function generateAudio(', 'async function generateVideo('), /fillByLabel\(page,'¿En qué deben centrarse los presentadores de IA en este episodio\?'/);
});

test('las tarjetas se abren esperando a que el diálogo exista (la fuente recién pegada aún se procesa)', () => {
  const abrir = trozo('async function openStudio(', '// Elige una opción');
  assert.match(abrir, /Generar/);
  assert.match(abrir, /while\(Date\.now\(\)<limite\)/);
  assert.match(abrir, /no abrió su diálogo/);
  assert.match(trozo('async function generateAudio(', 'async function generateVideo('), /openStudio\(page,'Resumen de audio'\)/);
});

// La presentación en inglés de NVIDIA no llegó a pedirse: tras elegir «English» la lista de
// idiomas seguía superpuesta y el clic en «Generar» caía en el cdk-overlay-backdrop (medido
// con elementFromPoint: antes la capa, después el botón). Sin error, 90 min de espera en vano.
test('tras elegir idioma se cierra la lista, y «Generar» se confirma o falla ya', () => {
  const idioma = trozo('async function selectLanguage(', 'async function pulsaGenerar(');
  assert.match(idioma, /\[role="listbox"\]/);
  assert.match(idioma, /page\.keyboard\.press\('Escape'\)/);
  const generar = trozo('async function pulsaGenerar(', 'async function ensureNotebookAccount(');
  assert.match(generar, /for\(let intento=0;intento<3;intento\+=1\)/);
  assert.match(generar, /no aceptó «Generar»/);
  assert.equal((worker.match(/await pulsaGenerar\(page\);/g) || []).length, 4, 'audio, vídeo, infografía y presentación');
  assert.equal((worker.match(/clickButton\(page,'Generar'\)/g) || []).length, 1, 'sólo pulsaGenerar pulsa «Generar»');
});

// FLT-100798: la marca «Gemini Notebook» va pintada en la imagen de cada lámina/página; el
// worker la quita con watermark.js antes de publicar (tests del módulo: tools/notebooklm-local/test/).
test('el worker quita la marca de PDF y PowerPoint antes de publicar', () => {
  assert.match(worker, /import \{limpiarPdf,limpiarPptx\} from '\.\/watermark\.js';/);
  const publicar = trozo('async function waitAndPublish(', 'await upload(job,task,publishable)');
  assert.match(publicar, /const sinMarca=await limpiarPptx\(publishable\);/);
  assert.match(publicar, /\}else if\(output==='pdf'\)\{[\s\S]*?const sinMarca=await limpiarPdf\(downloaded\);/);
  assert.match(publicar, /geminiWatermark:resumenMarca\(sinMarca\.report\)/);
});

// FLT-100798 → FLT-100803: el primer vídeo real (pixeria-beat-emocional) falló porque la
// duración se leía de Spotlight (mdls), que no indexa .runtime. Ahora el vídeo lo limpia
// video-marca.js, que lee la duración de la cabecera con ffmpeg: sin mdls en ningún sitio.
test('la limpieza del vídeo no depende de Spotlight y va por video-marca.js', async () => {
  const modulo = await readFile(new URL('../tools/notebooklm-local/video-marca.js', import.meta.url), 'utf8');
  assert.doesNotMatch(worker, /mdls/);
  assert.doesNotMatch(modulo, /mdls/);
  assert.match(modulo, /Duration:\\s\*/);
  assert.match(trozo('async function waitAndPublish(', 'async function processNext('), /if\(output==='video'\)\{[\s\S]*?const sanitized=await limpiarVideo\(downloaded,\{ffmpeg:ffmpegPath\}\);/);
});

// FLT-100801: Gemini nombra el fichero por el título del cuaderno (PixerIA_Beat_Emocional.mp4
// en inglés y en castellano). Con uno igual ya en downloads, el worker sólo daba por nueva una
// descarga con NOMBRE nuevo: la volvía a pedir cada 80 s hasta agotar los 90 min. Se ejecutan
// las dos funciones reales del worker contra una carpeta temporal.
test('una descarga con el mismo nombre que otra anterior cuenta como nueva si es posterior', async () => {
  const fs = await import('node:fs/promises'), path = await import('node:path'), os = await import('node:os');
  const fuente = trozo('async function fotoDescargas(', 'async function waitAndPublish(');
  const DOWNLOADS = await fs.mkdtemp(path.join(os.tmpdir(), 'descargas-'));
  const {fotoDescargas, descargaNueva} = new Function('fs', 'path', 'DOWNLOADS', `${fuente}; return {fotoDescargas, descargaNueva};`)(fs, path, DOWNLOADS);
  const video = path.join(DOWNLOADS, 'PixerIA_Beat_Emocional.mp4'), pdf = path.join(DOWNLOADS, 'NVIDIA_Spatial_OS.pdf');
  await fs.writeFile(video, 'en'); await fs.writeFile(pdf, 'deck');
  const viejo = new Date(Date.now() - 60000); await fs.utimes(video, viejo, viejo); await fs.utimes(pdf, viejo, viejo);
  const antes = await fotoDescargas();
  assert.equal(await descargaNueva(antes, ''), '', 'sin descargar nada, no hay nada nuevo');
  await fs.writeFile(path.join(DOWNLOADS, 'PixerIA_Beat_Emocional.mp4.crdownload'), 'a medias');
  assert.equal(await descargaNueva(antes, ''), '', 'una descarga a medias no cuenta');
  await fs.rm(path.join(DOWNLOADS, 'PixerIA_Beat_Emocional.mp4.crdownload'));
  await fs.writeFile(video, 'es'); // Chrome sobrescribe el del mismo nombre
  assert.equal(await descargaNueva(antes, '.pdf'), '', 'si se espera un PDF, el vídeo no vale');
  assert.equal(await descargaNueva(antes, ''), 'PixerIA_Beat_Emocional.mp4');
  await fs.writeFile(path.join(DOWNLOADS, 'Otro.pdf'), 'nuevo');
  assert.equal(await descargaNueva(antes, '.pdf'), 'Otro.pdf', 'un nombre nuevo sigue valiendo');
  assert.match(trozo('async function waitAndPublish(', 'async function processNext('), /const before=await fotoDescargas\(\);[\s\S]*?file=await descargaNueva\(before,expected\);/);
});
