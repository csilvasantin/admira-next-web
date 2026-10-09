import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const leer = (rel) => readFile(path.join(ROOT, rel), 'utf8');

test('el censo de proyectos se desplaza y deja la columna Nº fija', async () => {
  const html = await leer('proyectos/index.html');
  assert.match(html, /\.hoja\{[^}]*overflow:auto[^}]*touch-action:pan-x pan-y/);
  assert.match(html, /\.hoja th:first-child,\.hoja td:first-child\{position:sticky;left:0/);
  assert.match(html, /@media\(max-width:760px\)\{\.hoja\{max-height:none\}\.hoja th,\.hoja td\{white-space:nowrap\}/);
});

test('arquitectura, el Gantt y normativa tienen un scrollport horizontal', async () => {
  const arq = await leer('assets/arquitectura.css');
  assert.match(arq, /\.arq-tabla-wrap\{[^}]*overflow-x:auto[^}]*touch-action:pan-x pan-y/);
  assert.match(arq, /\.arq-tabla th:first-child,\.arq-tabla td:first-child\{position:sticky;left:0/);
  const roadmap = await leer('roadmap.html');
  assert.match(roadmap, /\.rm-gantt-wrap\{[^}]*max-width:100%[^}]*touch-action:pan-x pan-y/);
  assert.match(roadmap, /#rm-gantt\{display:block;max-width:none\}/);
  const norma = await leer('normativa.html');
  assert.match(norma, /\.art>div:has\(table\),\.tbl\{overflow-x:auto[^}]*touch-action:pan-x pan-y/);
  assert.match(norma, /\.art>div\{min-width:0;max-width:100%\}/);
});

test('marca blanca, business plan y tiktok parten en varias líneas', async () => {
  const maquetas = await leer('marcablanca/maquetas.css');
  const demo = await leer('marcablanca/demo.css');
  assert.match(maquetas, /@media \(max-width:700px\)\{[\s\S]*?\.st-nav,\.so-nav,\.yk-nav,\.mb-nav\{[^}]*flex-wrap:wrap/);
  assert.match(demo, /@media \(max-width:700px\)\{[^}]*flex-wrap:wrap/);
  const plan = await leer('businessplan/index.html');
  assert.match(plan, /@media\(max-width:700px\)\{[\s\S]*\.pillars,\.kpis,\.row\{flex-wrap:wrap;\}/);
  assert.match(plan, /\.planwrap\{overflow-x:clip/);
  const tiktok = await leer('tiktok/styles.css');
  assert.match(tiktok, /@media\(max-width:480px\)\{[\s\S]*\.grok-board-strip\{grid-template-columns:1fr\}/);
  assert.match(tiktok, /\.reference-strip\{grid-auto-flow:row;grid-template-columns:1fr 1fr/);
  assert.match(tiktok, /\.package-timeline\{grid-template-columns:1fr\}/);
  const pagina = await leer('marcablanca/index.html');
  assert.match(pagina, /maquetas\.css\?v=20261009-movil-5435/);
  assert.match(pagina, /demo\.css\?v=20261009-movil-5435/);
});

test('la 404 lleva el marco, conserva los alias y no carga la portada', async () => {
  const html = await leer('404.html');
  assert.match(html, /<body data-yk-frame="cabecera" data-yk-auto="on" data-yk-ligera="404">/);
  assert.match(html, /admira-frame\.css\?v=20261009-movil-5435/);
  assert.match(html, /admira-frame\.js\?v=20261009-movil-5435/);
  assert.match(html, /if \(path === 'consumos'\)/);
  assert.match(html, /if \(map\[path\]\) \{\s*try \{ sessionStorage\.setItem\('autoCommand'/);
  assert.equal((html.match(/location\.replace\('\/'\)/g) || []).length, 1);
  assert.doesNotMatch(html, /portada\.mp4|bannerAdmiraNext|admira-version-watch/);
  const experto = await leer('assets/experto-admiranext.js');
  assert.match(experto, /data-yk-ligera'\) === '404'\) return/);
});

test('/clientes lee /api/clientes y tiene etiquetas en ESP y ENG', async () => {
  const html = await leer('clientes/index.html');
  assert.match(html, /<body data-yk-frame="cabecera" data-yk-auto="on">/);
  assert.match(html, /fetch\('\/api\/clientes'/);
  assert.match(html, /titulo: 'Clientes'/);
  assert.match(html, /titulo: 'Clients'/);
  assert.match(html, />ESP</);
  assert.match(html, />ENG</);
  assert.match(html, /admiranext_expert_lang/);
  assert.equal((html.replace(/<footer[\s\S]*?<\/footer>/g, '').match(/href="\/"/g) || []).length, 1);
});

test('/demo cierra movil, 404 y clientes sin robar el resto', async () => {
  const js = await leer('assets/experto-admiranext.js');
  assert.match(js, /login\|patas\|portada\|verja\|movil\|tablas\|404\|clientes/);
  assert.match(js, /if \(cual === 'movil'\)/);
  assert.match(js, /if \(cual === '404'\)/);
  assert.match(js, /if \(cual === 'clientes'\)/);
  assert.match(js, /Uso: \/demo login \| patas \| portada \| movil \| 404 \| clientes/);
  const frame = await leer('assets/admira-frame.js');
  assert.match(frame, /experto-admiranext\.js\?v=20261009-movil-5435/);
  assert.ok((frame.match(/20261009-movil-5435/g) || []).length >= 2);
});
