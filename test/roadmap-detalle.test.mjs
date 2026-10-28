// #7087 (Carlos, 23-10-2026): versión corta + detalle opcional en cada idea y cada sub.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { handleRpc } from '../functions/mcp/_server.js';
import { callRoadmapTool } from '../functions/mcp/_roadmap.js';
import { leer, guardar, validar, DETALLE_MAX } from '../functions/_roadmap-combo.js';

function kv() {
  const m = new Map();
  return { get: async (k) => (m.has(k) ? JSON.parse(m.get(k)) : null), put: async (k, v) => { m.set(k, v); } };
}
const ctx = (env, level, tokenLabel) => ({ env, access: { level, tokenLabel, email: 'x@admiranext.com' } });

test('el esquema de roadmap_plan_diario admite detalle y sigue aceptando subs de texto', async () => {
  const env = { PRESENTATION_IDEAS: kv() };
  const r = await handleRpc({ env, access: null }, { jsonrpc: '2.0', id: 1, method: 'tools/list' });
  const plan = r.result.tools.find((t) => t.name === 'roadmap_plan_diario');
  const leerTool = r.result.tools.find((t) => t.name === 'roadmap_leer');
  assert.match(plan.description, /detalle/);
  assert.match(leerTool.description, /detalle/);
  const idea = plan.inputSchema.properties.ideas.items.properties;
  assert.equal(idea.detalle.type, 'string');
  assert.ok(idea.subs.items.anyOf.some((s) => s.type === 'string'));
  assert.ok(idea.subs.items.anyOf.some((s) => s.properties && s.properties.detalle));
  const ayuda = await handleRpc(ctx(env, 'viewer', ''), { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'help', arguments: { tema: 'roadmap' } } });
  assert.match(ayuda.result.structuredContent.help, /detalle/);
});

test('detalle se guarda, se recorta y roadmap_leer lo devuelve; sin él el plan no cambia', async () => {
  const env = { PRESENTATION_IDEAS: kv() };
  const c = ctx(env, 'editor', 'Wozniak');
  const largo = '  ' + 'á'.repeat(DETALLE_MAX + 25) + '  ';
  const ok = await callRoadmapTool(c, 'roadmap_plan_diario', {
    persona: 'wozniak', horizonte: 'hoy',
    ideas: [
      { titulo: 'Corto', detalle: '  Línea larga\n  con hueco  ', subs: ['solo a', { texto: 'corto b', detalle: 'detalle b' }, { texto: 'corto c', detalle: '   ' }] },
      { titulo: 'Sin detalle', subs: ['a2', 'b2', 'c2'] },
      { titulo: 'Idea larga', detalle: largo, subs: [{ texto: 's1', detalle: largo }, 's2', 's3'] },
    ],
  });
  const ideas = ok.plan.hoy.ideas;
  assert.equal(ideas[0].titulo, 'Corto');
  assert.equal(ideas[0].detalle, 'Línea larga\n  con hueco');
  assert.equal(ideas[0].subs[0].texto, 'solo a');
  assert.equal('detalle' in ideas[0].subs[0], false);
  assert.equal(ideas[0].subs[1].detalle, 'detalle b');
  assert.equal('detalle' in ideas[0].subs[2], false);
  assert.equal('detalle' in ideas[1], false);
  assert.equal(ideas[1].subs.every((s) => !('detalle' in s)), true);
  assert.equal(ideas[2].detalle.length, DETALLE_MAX);
  assert.equal(ideas[2].detalle, 'á'.repeat(DETALLE_MAX));
  assert.equal(ideas[2].subs[0].detalle.length, DETALLE_MAX);
  assert.equal('detalle' in ideas[2].subs[1], false);

  const doc = await leer(env);
  const fila = doc.proyectos.find((p) => p.id === 'wozniak');
  const guardada = fila.roadmap.hoy[0];
  assert.equal(guardada.detalle, 'Línea larga\n  con hueco');
  assert.deepEqual(guardada.s, ['solo a', 'corto b', 'corto c']);
  assert.deepEqual(guardada.sd, ['', 'detalle b', '']);
  assert.equal('detalle' in fila.roadmap.hoy[1], false);
  assert.equal('sd' in fila.roadmap.hoy[1], false);

  const otra = await callRoadmapTool(ctx(env, 'viewer', ''), 'roadmap_leer', { vista: 'consejero', id: 'wozniak', horizonte: 'hoy' });
  assert.equal(otra.plan.hoy.ideas[0].detalle, 'Línea larga\n  con hueco');
  assert.equal(otra.plan.hoy.ideas[0].subs[1].detalle, 'detalle b');

  const id = ideas[0].id_idea;
  const marca = await callRoadmapTool(c, 'roadmap_marcar', { persona: 'wozniak', id_idea: id, sub: 'a', hecho: true });
  assert.equal(marca.avance_idea, 33);
  const trasMarca = await callRoadmapTool(c, 'roadmap_leer', { vista: 'consejero', id: 'wozniak', horizonte: 'hoy' });
  assert.equal(trasMarca.plan.hoy.ideas[0].subs[0].hecho, true);
  assert.equal(trasMarca.plan.hoy.ideas[0].detalle, 'Línea larga\n  con hueco');
  assert.equal(trasMarca.plan.hoy.ideas[0].subs[1].detalle, 'detalle b');

  const web = await guardar(env, await leer(env), 'web');
  assert.equal(web.ok, true, web.error);
  const trasWeb = await callRoadmapTool(c, 'roadmap_leer', { vista: 'consejero', id: 'wozniak', horizonte: 'hoy' });
  assert.equal(trasWeb.plan.hoy.ideas[0].detalle, 'Línea larga\n  con hueco');
  assert.equal(trasWeb.plan.hoy.ideas[0].subs[1].detalle, 'detalle b');
  assert.equal('detalle' in trasWeb.plan.hoy.ideas[1], false);

  await assert.rejects(
    callRoadmapTool(c, 'roadmap_plan_diario', { persona: 'wozniak', horizonte: 'manana', ideas: [{ titulo: 'X', detalle: 12, subs: ['a', 'b', 'c'] }] }),
    /detalle de la idea 1 debe ser texto/,
  );
  const manana = await callRoadmapTool(c, 'roadmap_leer', { vista: 'consejero', id: 'wozniak', horizonte: 'manana' });
  assert.equal(manana.plan.manana.ideas.length, 0);
});

test('validar conserva el detalle de un plan ya guardado y no lo inventa', async () => {
  const env = { PRESENTATION_IDEAS: kv() };
  const base = await leer(env);
  const entrada = JSON.parse(JSON.stringify(base));
  const p = entrada.proyectos.find((x) => x.id === 'wozniak');
  p.roadmap.hoy = [{ id: 'wozniak-hoy-test1', t: 'Corto', detalle: '  ' + 'd'.repeat(DETALLE_MAX + 5), s: ['a', { texto: 'b', detalle: 'db' }, 'c'], sd: ['da', '', ''], hs: [false, true, false] }];
  const out = validar(entrada, base);
  const item = out.proyectos.find((x) => x.id === 'wozniak').roadmap.hoy[0];
  assert.equal(item.t, 'Corto');
  assert.equal(item.detalle.length, DETALLE_MAX);
  assert.deepEqual(item.s, ['a', 'b', 'c']);
  assert.deepEqual(item.sd, ['da', 'db', '']);
  assert.deepEqual(item.hs, [false, true, false]);
  const studio = out.proyectos.find((x) => x.id === 'studio').roadmap.hoy[0];
  assert.equal(studio.id, 'studio-hoy-1');
  assert.equal(studio.detalle, undefined);
  assert.equal(studio.sd, undefined);
  assert.equal(typeof studio.s[0], 'string');
});

test('la web muestra el corto y un botón de detalle solo si existe', async () => {
  const js = await readFile(new URL('../assets/roadmap-combo.js', import.meta.url), 'utf8');
  const html = await readFile(new URL('../roadmap.html', import.meta.url), 'utf8');
  assert.match(js, /function detBtn\(texto\)/);
  assert.match(js, /esc\(i\.t\)\+detBtn\(i\.detalle\)/);
  assert.match(js, /esc\(subTexto\(x\)\)\+detBtn\(d\)/);
  assert.match(js, /class="rmc-det-btn"/);
  assert.match(js, /rmc-det-txt" hidden/);
  assert.match(js, /addEventListener\('click',function\(ev\)\{[\s\S]*rmc-det-btn[\s\S]*preventDefault\(\)[\s\S]*stopPropagation\(\)/);
  assert.match(js, /if\(sd\.some\(Boolean\)\)i\.sd=sd;else delete i\.sd/);
  assert.match(html, /\.rmc-det-btn\{/);
  assert.match(html, /\.rmc-det-txt\[hidden\]\{display:none\}/);
  assert.match(html, /\.rmc-123 details:not\(\[open\]\) > :not\(summary\)\{display:none\}/);
  assert.match(html, /roadmap-combo\.js\?v=20261028-item-1/);
});
