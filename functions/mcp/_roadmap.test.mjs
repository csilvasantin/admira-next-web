// Tools roadmap_* del MCP contra un KV simulado (16-10-2026).
import test from 'node:test';
import assert from 'node:assert/strict';
import { handleRpc } from './_server.js';

function kv(){ const m = new Map(); return { get: async (k, o) => (m.has(k) ? (o && o.type === 'json' ? JSON.parse(m.get(k)) : m.get(k)) : null), put: async (k, v) => { m.set(k, v); } }; }
const env = { PRESENTATION_IDEAS: kv() };
const ctx = (level, tokenLabel, email = 'x@admiranext.com') => ({ env, access: { level, tokenLabel, email } });
const call = async (c, name, args) => { const r = await handleRpc(c, { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }); return { err: r.result.isError, out: r.result.structuredContent, text: r.result.content[0].text }; };

test('tools/list incluye las tools roadmap_*', async () => {
  const r = await handleRpc({ env, access: null }, { jsonrpc: '2.0', id: 1, method: 'tools/list' });
  const names = r.result.tools.map((t) => t.name);
  for (const n of ['roadmap_reglas', 'roadmap_leer', 'roadmap_plan_diario', 'roadmap_marcar', 'roadmap_ayer', 'roadmap_aprobar']) assert.ok(names.includes(n), n);
});

test('leer, plan diario propio, marcar, ayer y aprobar', async () => {
  const reglas = await call(ctx('viewer', ''), 'roadmap_reglas', {});
  assert.match(reglas.out.reglas, /7:30/);
  const live = await call(ctx('viewer', ''), 'roadmap_leer', { vista: 'proyecto', id: 'live', horizonte: 'manana' });
  assert.equal(live.out.plan.manana.ideas.length, 3);
  // viewer no escribe
  assert.ok((await call(ctx('viewer', 'Smith'), 'roadmap_plan_diario', { persona: 'smith', horizonte: 'hoy', ideas: [] })).err);
  // otro agente no escribe el plan de Smith
  assert.ok((await call(ctx('editor', 'Niobe'), 'roadmap_plan_diario', { persona: 'smith', horizonte: 'hoy', ideas: [] })).err);
  // abc obligatorio
  assert.ok((await call(ctx('editor', 'Smith'), 'roadmap_plan_diario', { persona: 'smith', horizonte: 'hoy', ideas: [{ titulo: 'X', subs: ['a', 'b'] }] })).err);
  const ok = await call(ctx('editor', 'Smith'), 'roadmap_plan_diario', { persona: 'smith', horizonte: 'hoy', ideas: [{ titulo: 'Idea 1', subs: ['s1', 's2', 's3'] }] });
  assert.equal(ok.err, false, ok.text);
  const id = ok.out.plan.hoy.ideas[0].id_idea;
  const m = await call(ctx('editor', 'Smith'), 'roadmap_marcar', { persona: 'smith', id_idea: id, sub: 'a', hecho: true });
  assert.equal(m.out.avance_idea, 33, m.text);
  // ayer solo lectura
  assert.ok((await call(ctx('admin', 'Carlos'), 'roadmap_marcar', { id_idea: 'live-ayer-1', sub: 'a', hecho: true })).err);
  // Oráculo marca una idea enlazada de admira.app y el proyecto se reajusta
  const o = await call(ctx('editor', 'Oráculo'), 'roadmap_marcar', { persona: 'oraculo', id_idea: 'app-hoy-1', sub: 'b', hecho: true });
  assert.equal(o.err, false, o.text); assert.ok(o.out.avance_proyecto > 0);
  const ay = await call(ctx('viewer', ''), 'roadmap_ayer', { persona: 'elon' });
  assert.ok(ay.out.lineas.length >= 1);
  assert.ok((await call(ctx('editor', 'Elon'), 'roadmap_aprobar', { persona: 'elon' })).err);
  const ap = await call(ctx('admin', 'Carlos'), 'roadmap_aprobar', { persona: 'elon' });
  assert.equal(ap.out.aprobacion, 'ok');
});
