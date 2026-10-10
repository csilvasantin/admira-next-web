import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { IDEAS, cortar, hitos, htmlCorte } from '../functions/_roadmap.js';
import { onRequestGet, onRequestOptions, onRequestPost } from '../functions/api/roadmap.js';
import { onRequestGet as pagina } from '../functions/roadmap.js';

const html = await readFile(new URL('../roadmap.html', import.meta.url), 'utf8');
const proyectos = await readFile(new URL('../proyectos/index.html', import.meta.url), 'utf8');
const lista = hitos();

import { cookieDeSesion, asegurarDirectorio } from '../functions/_webmaster-gate.js';
import { DatabaseSync } from 'node:sqlite';

class Statement {
  constructor(stmt){ this.stmt=stmt; this.values=[]; }
  bind(...values){ this.values=values; return this; }
  first(){ return this.stmt.get(...this.values) || null; }
  all(){ return {results:this.stmt.all(...this.values)}; }
  run(){ const meta=this.stmt.run(...this.values); return {success:true,meta}; }
}
class D1 {
  constructor(){ this.db=new DatabaseSync(':memory:'); }
  prepare(sql){ return new Statement(this.db.prepare(sql)); }
}
async function setupAuth(){
  const env={AUTH_DB:new D1(),WEBMASTER_SIGNING_KEY:'roadmap-test-key'};
  await asegurarDirectorio(env);
  const user=await env.AUTH_DB.prepare('SELECT * FROM admiranext_users WHERE email=?').bind('csilva@admira.com').first();
  const cookie=(await cookieDeSesion(env,user)).split(';')[0];
  return {env, cookie};
}

test('RoadMap es entrada interna y la página arranca con el reparto y la visualización', () => {
  const nav = proyectos.match(/<nav aria-label="Navegación del grupo">[\s\S]*?<\/nav>/)[0];
  // RoadMap pasa a data-yk-interno (10-10-2026, #5498), como Organigrama y Presentaciones.
  assert.match(nav, /<a href="\/roadmap"[^>]*data-yk-interno[^>]*>RoadMap<\/a>/);
  assert.match(html, /id="reparto-finde"/);
  assert.match(html, /<h1>RoadMap<\/h1>\s*<section class="rm-show"/);
  assert.doesNotMatch(html, /<p class="(?:aviso|lede)"/);
  assert.match(html, /<!--CORTE-->/);
  assert.match(html, /data-yk-access="privado"/);
});

test('el fichero junta a Woz, Walt y Jobs, sin ejemplos', () => {
  assert.equal(lista.some((h) => h.fuente === 'ejemplo'), false);
  const por = (id) => lista.filter((h) => h.solucion === id);
  assert.equal(por('app').length, 8);
  assert.equal(por('biz').length, 8);
  assert.equal(por('admiranext').length, 6);
  assert.equal(por('studio').length, 8);
  // e6727cc (5-oct) sumó los hitos Q4 de store: 4 de Jobs + 7 de Jensen/Walt.
  assert.equal(por('store').length, 11);
  assert.equal(por('tv').length, 4);
  const deJobs = por('store').filter((h) => h.responsable === 'Jensen Huang (propuesta de Jobs)');
  assert.equal(deJobs.length, 4);
  assert.ok(deJobs.every((h) => h.estado === 'hecho' && h.fuente.startsWith('xpaceos ')));
  assert.ok(por('tv').every((h) => h.responsable === 'Elon Musk (propuesta de Jobs)' && h.estado === 'hecho'));
  assert.ok(por('studio').every((h) => h.responsable === 'George Lucas'));
  assert.equal(por('studio').find((h) => h.id === 'studio-mcp-cliente-activo-xpaceos').cliente, undefined);
  assert.ok(por('app').every((h) => h.responsable === 'Steve Wozniak'));
  assert.ok(por('biz').every((h) => h.responsable === 'Walt Disney'));
  assert.equal(por('admiranext').filter((h) => h.estado === 'hecho').length, 4);
  const superusuario = lista.find((h) => h.id === 'admiranext-superusuario-api-clientes');
  assert.equal(superusuario.estado, 'confirmado');
  assert.equal(superusuario.inicio, '2026-10-05');
  assert.equal(superusuario.fin, '2026-10-09');
  assert.equal(lista.filter((h) => h.estado === 'propuesta').length, 7);
  const ideas = new Set(lista.map((h) => h.idea));
  assert.equal(ideas.size, IDEAS.length);
  assert.ok(lista.every((h) => IDEAS.some((i) => i.nombre === h.idea)));
  assert.ok(ideas.size <= 8);
});

test('las cinco vistas agrupan por solución y el vacío queda por definir', () => {
  const dia = cortar(lista, 'dia', '2026-10-05');
  assert.equal(dia.vista, 'dia');
  assert.equal(dia.desde, '2026-10-05');
  assert.equal(dia.soluciones.find((s) => s.id === 'studio').hitos.length, 4);
  assert.equal(dia.soluciones.find((s) => s.id === 'admiranext').hitos.length, 1);

  const semana = cortar(lista, 'semana', '2026-10-05');
  assert.equal(semana.desde, '2026-10-05');
  assert.equal(semana.hasta, '2026-10-11');
  assert.equal(semana.soluciones.find((s) => s.id === 'studio').hitos.length, 5);
  assert.ok(semana.soluciones.find((s) => s.id === 'admiranext').hitos.some((h) => h.id === 'admiranext-superusuario-api-clientes'));

  const mes = cortar(lista, 'mes', '2026-10-04');
  assert.equal(mes.desde, '2026-10-01');
  assert.ok(mes.soluciones.reduce((n, s) => n + s.hitos.length, 0) > 2);

  const tri = cortar(lista, 'trimestre', '2026-11-02');
  assert.equal(tri.desde, '2026-10-01');
  assert.equal(tri.hasta, '2026-12-31');
  assert.equal(tri.soluciones.find((s) => s.id === 'studio').hitos.length, 8);
  assert.equal(tri.soluciones.find((s) => s.id === 'app').hitos.length, 8);
  assert.equal(tri.soluciones.find((s) => s.id === 'biz').hitos.length, 8);
  assert.equal(tri.soluciones.find((s) => s.id === 'admiranext').hitos.length, 6);
  assert.equal(tri.soluciones.find((s) => s.id === 'store').hitos.length, 11);
  assert.equal(tri.soluciones.find((s) => s.id === 'tv').hitos.length, 0);

  const ano = cortar(lista, 'ano', '2026-10-05');
  assert.equal(ano.desde, '2026-01-01');
  assert.equal(ano.hasta, '2026-12-31');
  assert.equal(ano.soluciones.reduce((n, s) => n + s.hitos.length, 0), lista.length);

  const vacio = htmlCorte(cortar(lista, 'dia', '2026-12-20'));
  assert.equal((vacio.match(/Por definir con Carlos/g) || []).length, 6);
  assert.match(vacio, /vista=dia/);
  assert.match(vacio, /vista=semana/);
  assert.match(vacio, /vista=mes/);
  assert.match(vacio, /vista=trimestre/);
  assert.match(vacio, /vista=ano/);
});

test('GET /api/roadmap sirve el JSON y el corte, con CORS', async () => {
  const plano = await onRequestGet({ request: new Request('https://www.admiranext.com/api/roadmap') });
  assert.equal(plano.headers.get('access-control-allow-origin'), '*');
  assert.equal((await plano.json()).length, lista.length);
  const corte = await onRequestGet({ request: new Request('https://www.admiranext.com/api/roadmap?vista=semana&desde=2026-10-05') });
  const body = await corte.json();
  assert.equal(body.vista, 'semana');
  assert.equal(body.desde, '2026-10-05');
  const store = await onRequestGet({ request: new Request('https://www.admiranext.com/api/roadmap?proyecto=store&vista=mes&desde=2026-10-01') });
  const cuerpoStore = await store.json();
  assert.equal(cuerpoStore.agrupar, 'solucion');
  assert.equal(cuerpoStore.soluciones.find((s) => s.id === 'store').hitos.length, 11);
  assert.equal(cuerpoStore.soluciones.find((s) => s.id === 'studio').hitos.length, 0);
  const altadis = await onRequestGet({ request: new Request('https://www.admiranext.com/api/roadmap?cliente=altadis&vista=trimestre&desde=2026-10-01') });
  const cuerpoAltadis = await altadis.json();
  assert.equal(cuerpoAltadis.agrupar, 'cliente');
  assert.equal(cuerpoAltadis.columnas.length, 1);
  assert.equal(cuerpoAltadis.columnas[0].id, 'altadis');
  assert.ok(cuerpoAltadis.columnas[0].hitos.every((h) => h.cliente === 'altadis'));
  assert.equal(cuerpoAltadis.columnas[0].hitos.some((h) => h.cliente === 'jti'), false);
  const idea = await onRequestGet({ request: new Request('https://www.admiranext.com/api/roadmap?idea=reproduccion-pop&vista=ano&desde=2026-01-01') });
  const cuerpoIdea = await idea.json();
  assert.equal(cuerpoIdea.agrupar, 'idea');
  assert.equal(cuerpoIdea.columnas[0].hitos.length, 4);
  const combo = await onRequestGet({ request: new Request('https://www.admiranext.com/api/roadmap?proyecto=studio&cliente=altadis&idea=contenidos-pixeria&vista=trimestre&desde=2026-10-01') });
  const cuerpoCombo = await combo.json();
  assert.equal(cuerpoCombo.agrupar, 'idea');
  assert.equal(cuerpoCombo.columnas[0].hitos.length, 2);
  assert.equal(onRequestOptions().status, 204);
  assert.equal(onRequestPost().status, 405);
});

test('la página pinta el corte de la URL (solo con sesión)', async () => {
  const { env, cookie } = await setupAuth();
  env.ASSETS = { fetch: async () => new Response(html) };
  const r = await pagina({ request: new Request('https://www.admiranext.com/roadmap?vista=mes&desde=2026-10-01', { headers: { cookie } }), env });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('cache-control'), 'private, no-store');
  assert.equal(r.headers.get('x-robots-tag'), 'noindex, nofollow');
  const texto = await r.text();
  assert.match(texto, /Reparto finde largo/);
  assert.match(texto, /<h1>RoadMap<\/h1>\s*<section class="rm-show"/);
  assert.doesNotMatch(texto, /<p class="(?:aviso|lede)"/);
  assert.match(texto, /octubre de 2026/);
  assert.match(texto, /Steve Wozniak/);
  assert.match(texto, /Walt Disney/);
  assert.equal((texto.match(/fuente: ejemplo/g) || []).length, 0);
  assert.match(texto, /Por definir con Carlos/);
  assert.match(texto, /aria-label="Proyecto"/);
  assert.match(texto, /aria-label="Cliente"/);
  assert.match(texto, /aria-label="Idea"/);
  assert.equal((texto.match(/<h1>RoadMap<\/h1>/g) || []).length, 1);
  for (const f of ['Proyecto', 'Cliente', 'Idea']) {
    assert.match(texto, new RegExp(`<div class="rm-filtro" data-yk-slot="left" data-yk-label="${f}"><nav aria-label="${f}">`));
  }
  assert.equal((texto.match(/<nav class="vistas" aria-label="(Proyecto|Cliente|Idea)"/g) || []).length, 0);
  assert.match(texto, /<nav class="vistas" aria-label="Escala del RoadMap">/);
  const filtrada = await pagina({ request: new Request('https://www.admiranext.com/roadmap?proyecto=studio&cliente=altadis&idea=contenidos-pixeria&vista=trimestre&desde=2026-10-01', { headers: { cookie } }), env });
  const corteHtml = await filtrada.text();
  assert.match(corteHtml, /proyecto=studio&amp;cliente=altadis&amp;idea=contenidos-pixeria/);
  assert.match(corteHtml, /Gemelos 9 estancos BCN/);
  assert.equal((corteHtml.match(/JTI global/g) || []).length, 0);
});

test('sin sesión la página RoadMap no pinta HTML ni pilares', async () => {
  const { env } = await setupAuth();
  let fetched = false;
  env.ASSETS = { fetch: async () => { fetched = true; return new Response(html); } };
  const r = await pagina({ request: new Request('https://www.admiranext.com/roadmap'), env });
  assert.equal(r.status, 401);
  const body = await r.text();
  assert.match(body, /AdmiraNeXT · Acceso/);
  assert.doesNotMatch(body, /Reparto finde largo/);
  assert.equal(fetched, false);
});

test('RoadMap espectacular: escena, meta del corte y estados', async () => {
  assert.match(html, /id="rm-show"/);
  assert.match(html, /id="rm-matrix"/);
  assert.match(html, /id="rm-gantt-wrap"/);
  assert.match(html, /id="rm-rail"/);
  assert.match(html, /id="rm-presenter"/);
  assert.match(html, /\/assets\/roadmap-show\.js\?v=/);
  assert.match(html, /#78f3ff/);
  assert.match(html, /#4ae3d1/);
  const js = await readFile(new URL('../assets/roadmap-show.js', import.meta.url), 'utf8');
  assert.match(js, /fetch\('\/api\/roadmap'/);
  assert.match(js, /e\.key === 'p' \|\| e\.key === 'P'/);
  const corte = htmlCorte(cortar(lista, 'trimestre', '2026-10-01', new Date(), { idea: 'contenidos-pixeria' }));
  const meta = corte.match(/<span class="rm-meta" hidden ([^>]*)><\/span>/);
  assert.ok(meta, 'el corte publica sus datos para la escena');
  assert.match(meta[1], /data-vista="trimestre"/);
  assert.match(meta[1], /data-desde="2026-10-01"/);
  assert.match(meta[1], /data-hasta="2026-12-31"/);
  assert.match(meta[1], /data-idea="contenidos-pixeria"/);
  assert.match(meta[1], /data-idea-nombre="Contenidos y Pixeria"/);
  assert.match(meta[1], /data-patas="\[\{&quot;id&quot;:&quot;studio&quot;/);
  assert.match(corte, /<li class="hito is-(hecho|en_curso|confirmado|propuesta)" data-estado="/);
});
