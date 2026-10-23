import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { asegurarDirectorio, cookieDeSesion, sesionCompleta } from '../functions/_webmaster-gate.js';
import { onRequestGet, onRequestPost } from '../functions/api/censo-papelera.js';
import { RETENCION_MS } from '../functions/_papelera-proyectos.js';

class Statement {
  constructor(stmt){ this.stmt = stmt; this.values = []; }
  bind(...values){ this.values = values; return this; }
  first(){ return this.stmt.get(...this.values) || null; }
  all(){ return { results: this.stmt.all(...this.values) }; }
  run(){ const meta = this.stmt.run(...this.values); return { success: true, meta }; }
}
class D1 {
  constructor(){ this.db = new DatabaseSync(':memory:'); }
  prepare(sql){ return new Statement(this.db.prepare(sql)); }
}

const KEY = 'papelera-test-key';
const PROYECTO = {
  id: 'demo-papelera', name: 'Demo papelera', web: 'https://www.admiranext.com',
  primary_responsible: 'NeoMacMini', agents: ['Neo'], missions: 2, number: 4,
};

function yokup(calls) {
  return async (url) => {
    calls.push(String(url));
    if (String(url).endsWith('/projects')) return Response.json({ ok: true, projects: [PROYECTO] });
    if (String(url).endsWith('/projects/demo-papelera')) {
      return Response.json({ ok: true, project: { ...PROYECTO, blurb: 'ficha completa' } });
    }
    return new Response('no', { status: 404 });
  };
}

async function setup() {
  const calls = [];
  const env = { AUTH_DB: new D1(), WEBMASTER_SIGNING_KEY: KEY, YOKUP_FETCH: yokup(calls) };
  await asegurarDirectorio(env);
  const now = Date.now();
  await env.AUTH_DB.prepare(
    `INSERT INTO admiranext_users(email,display_name,role,status,session_version,created_at,updated_at)
     VALUES('editor@example.com','Editor','editor','active',1,?,?)`
  ).bind(now, now).run();
  await env.AUTH_DB.prepare(
    'INSERT INTO admiranext_user_projects(user_email,project_key,created_at,created_by) VALUES(?,?,?,?)'
  ).bind('csilva@admira.com', 'demo-papelera', now, 'test').run();
  return { env, calls };
}

async function cookie(env, email) {
  const user = await env.AUTH_DB.prepare('SELECT * FROM admiranext_users WHERE email=?').bind(email).first();
  return (await cookieDeSesion(env, user, { amr: 'google' })).split(';')[0];
}

function req(method, cookieValue, csrf, body) {
  return new Request('https://www.admiranext.com/api/censo-papelera', {
    method,
    headers: {
      cookie: cookieValue || '',
      origin: 'https://www.admiranext.com',
      'content-type': 'application/json',
      'X-Admira-CSRF': csrf || '',
      'CF-Connecting-IP': '203.0.113.8',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

test('sin sesión solo se ven los id ocultos, y un editor no borra', async () => {
  const { env } = await setup();
  const anon = await onRequestGet({ request: req('GET'), env });
  assert.equal(anon.status, 200);
  assert.deepEqual(await anon.json(), { ok: true, admin: false, hidden: [] });
  const editorCookie = await cookie(env, 'editor@example.com');
  const editor = await sesionCompleta(req('GET', editorCookie), env);
  const denied = await onRequestPost({
    request: req('POST', editorCookie, editor.csrf, { action: 'delete', id: 'demo-papelera', confirm: 'demo-papelera' }),
    env,
  });
  assert.equal(denied.status, 403);
});

test('hace falta el slug exacto, guarda la copia y el contador la oculta', async () => {
  const { env, calls } = await setup();
  const adminCookie = await cookie(env, 'csilva@admira.com');
  const me = await sesionCompleta(req('GET', adminCookie), env);
  const mal = await onRequestPost({
    request: req('POST', adminCookie, me.csrf, { action: 'delete', id: 'demo-papelera', confirm: 'otro' }),
    env,
  });
  assert.equal(mal.status, 409);
  assert.equal(calls.length, 0);

  const ok = await onRequestPost({
    request: req('POST', adminCookie, me.csrf, { action: 'delete', id: 'demo-papelera', confirm: 'demo-papelera' }),
    env,
  });
  assert.equal(ok.status, 200);
  const body = await ok.json();
  assert.deepEqual(body.hidden, ['demo-papelera']);
  assert.equal(body.papelera.length, 1);
  assert.equal(body.papelera[0].name, 'Demo papelera');
  assert.ok(body.papelera[0].remaining_ms > RETENCION_MS - 5000);
  assert.ok(calls.every((url) => !url.includes('DELETE')));
  const row = await env.AUTH_DB.prepare('SELECT backup_json,status FROM admiranext_project_trash WHERE id=?').bind('demo-papelera').first();
  const copia = JSON.parse(row.backup_json);
  assert.equal(copia.entry.missions, 2);
  assert.equal(copia.ficha.blurb, 'ficha completa');
  assert.equal(copia.grants[0].user_email, 'csilva@admira.com');
  assert.equal(row.status, 'trashed');
  const audit = await env.AUTH_DB.prepare(
    "SELECT action,detail FROM admiranext_user_audit WHERE action='project_deleted'"
  ).all();
  assert.equal(audit.results.length, 1);
  assert.equal(audit.results[0].detail, 'demo-papelera');

  const otra = await onRequestPost({
    request: req('POST', adminCookie, me.csrf, { action: 'delete', id: 'demo-papelera', confirm: 'demo-papelera' }),
    env,
  });
  assert.equal(otra.status, 409);
});

test('restaurar devuelve el proyecto al censo', async () => {
  const { env } = await setup();
  const adminCookie = await cookie(env, 'csilva@admira.com');
  const me = await sesionCompleta(req('GET', adminCookie), env);
  await onRequestPost({
    request: req('POST', adminCookie, me.csrf, { action: 'delete', id: 'demo-papelera', confirm: 'demo-papelera' }),
    env,
  });
  const back = await onRequestPost({
    request: req('POST', adminCookie, me.csrf, { action: 'restore', id: 'demo-papelera' }),
    env,
  });
  assert.equal(back.status, 200);
  assert.deepEqual((await back.json()).hidden, []);
  const row = await env.AUTH_DB.prepare('SELECT id FROM admiranext_project_trash WHERE id=?').bind('demo-papelera').first();
  assert.equal(row, null);
  const audit = await env.AUTH_DB.prepare(
    "SELECT action FROM admiranext_user_audit WHERE action='project_restored'"
  ).all();
  assert.equal(audit.results.length, 1);
});

test('a los 7 días una lectura purga la copia y el id sigue oculto', async () => {
  const { env } = await setup();
  const adminCookie = await cookie(env, 'csilva@admira.com');
  const me = await sesionCompleta(req('GET', adminCookie), env);
  await onRequestPost({
    request: req('POST', adminCookie, me.csrf, { action: 'delete', id: 'demo-papelera', confirm: 'demo-papelera' }),
    env,
  });
  await env.AUTH_DB.prepare('UPDATE admiranext_project_trash SET purge_at=? WHERE id=?').bind(Date.now() - 1000, 'demo-papelera').run();
  const res = await onRequestGet({ request: req('GET', adminCookie), env });
  const body = await res.json();
  assert.deepEqual(body.hidden, ['demo-papelera']);
  assert.deepEqual(body.papelera, []);
  const row = await env.AUTH_DB.prepare('SELECT status, backup_json FROM admiranext_project_trash WHERE id=?').bind('demo-papelera').first();
  assert.equal(row.status, 'purged');
  assert.equal(row.backup_json, '');
  const audit = await env.AUTH_DB.prepare(
    "SELECT action,detail FROM admiranext_user_audit WHERE action='project_purged'"
  ).all();
  assert.equal(audit.results.length, 1);
  assert.equal(audit.results[0].detail, 'demo-papelera');
  await onRequestGet({ request: req('GET'), env });
  const otra = await env.AUTH_DB.prepare(
    "SELECT COUNT(*) n FROM admiranext_user_audit WHERE action='project_purged'"
  ).first();
  assert.equal(otra.n, 1);
  const restore = await onRequestPost({
    request: req('POST', adminCookie, me.csrf, { action: 'restore', id: 'demo-papelera' }),
    env,
  });
  assert.equal(restore.status, 409);
});
