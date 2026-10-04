import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { cortar, hitos, htmlCorte } from '../functions/_roadmap.js';
import { onRequestGet, onRequestOptions, onRequestPost } from '../functions/api/roadmap.js';
import { onRequestGet as pagina } from '../functions/roadmap.js';

const html = await readFile(new URL('../roadmap.html', import.meta.url), 'utf8');
const proyectos = await readFile(new URL('../proyectos/index.html', import.meta.url), 'utf8');
const lista = hitos();

test('RoadMap sigue en el menú y el aviso de borrador', () => {
  const nav = proyectos.match(/<nav aria-label="Navegación del grupo">[\s\S]*?<\/nav>/)[0];
  assert.match(nav, /<a href="\/organigrama">Organigrama<\/a><a href="\/roadmap">RoadMap<\/a><a href="\/presentaciones\/">Presentaciones<\/a>/);
  assert.match(html, /Borrador para validar por Carlos/);
  assert.match(html, /<!--CORTE-->/);
});

test('el fichero junta a Woz, Walt y Jobs, sin ejemplos', () => {
  assert.equal(lista.some((h) => h.fuente === 'ejemplo'), false);
  const por = (id) => lista.filter((h) => h.solucion === id);
  assert.equal(por('app').length, 8);
  assert.equal(por('biz').length, 7);
  assert.equal(por('admiranext').length, 5);
  assert.equal(por('studio').length, 7);
  assert.equal(por('store').length, 4);
  assert.equal(por('tv').length, 4);
  assert.ok(por('store').every((h) => h.responsable === 'Jensen Huang (propuesta de Jobs)' && h.estado === 'hecho' && h.fuente.startsWith('xpaceos ')));
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
  assert.equal(lista.filter((h) => h.estado === 'propuesta').length, 5);
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
  assert.equal(semana.soluciones.find((s) => s.id === 'studio').hitos.length, 4);
  assert.ok(semana.soluciones.find((s) => s.id === 'admiranext').hitos.some((h) => h.id === 'admiranext-superusuario-api-clientes'));

  const mes = cortar(lista, 'mes', '2026-10-04');
  assert.equal(mes.desde, '2026-10-01');
  assert.ok(mes.soluciones.reduce((n, s) => n + s.hitos.length, 0) > 2);

  const tri = cortar(lista, 'trimestre', '2026-11-02');
  assert.equal(tri.desde, '2026-10-01');
  assert.equal(tri.hasta, '2026-12-31');
  assert.equal(tri.soluciones.find((s) => s.id === 'studio').hitos.length, 7);
  assert.equal(tri.soluciones.find((s) => s.id === 'app').hitos.length, 8);
  assert.equal(tri.soluciones.find((s) => s.id === 'biz').hitos.length, 7);
  assert.equal(tri.soluciones.find((s) => s.id === 'admiranext').hitos.length, 5);
  assert.equal(tri.soluciones.find((s) => s.id === 'store').hitos.length, 4);
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
  assert.equal((await plano.json()).length, 35);
  const corte = await onRequestGet({ request: new Request('https://www.admiranext.com/api/roadmap?vista=semana&desde=2026-10-05') });
  const body = await corte.json();
  assert.equal(body.vista, 'semana');
  assert.equal(body.desde, '2026-10-05');
  assert.equal(onRequestOptions().status, 204);
  assert.equal(onRequestPost().status, 405);
});

test('la página pinta el corte de la URL', async () => {
  const env = { ASSETS: { fetch: async () => new Response(html) } };
  const r = await pagina({ request: new Request('https://www.admiranext.com/roadmap?vista=mes&desde=2026-10-01'), env });
  const texto = await r.text();
  assert.match(texto, /Borrador para validar por Carlos/);
  assert.match(texto, /octubre de 2026/);
  assert.match(texto, /Steve Wozniak/);
  assert.match(texto, /Walt Disney/);
  assert.equal((texto.match(/fuente: ejemplo/g) || []).length, 0);
  assert.match(texto, /Por definir con Carlos/);
});
