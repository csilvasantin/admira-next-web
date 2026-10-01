// Clave de máquina del generador (Carlos, 01-10-2026: «Monta una clave de máquina para que la
// flota entre sin Google»). Con clave → 200; sin clave o mala → 401; nada fuera de
// /presentaciones; la cookie de canje va limitada a /presentaciones y caduca pronto.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {onRequest} from '../functions/presentaciones/_middleware.js';
import {onRequest as exchange} from '../functions/presentaciones/auth/machine.js';
import {onRequestGet as sessionGet} from '../functions/api/session.js';
import {onRequestGet as proyectosGet} from '../functions/api/proyectos.js';
import {authorFields} from '../functions/presentaciones/api/generate.js';
import {MACHINE_COOKIE, MACHINE_SESSION_MAXAGE, safeNext, machineKeyMatches} from '../functions/presentaciones/_machine-key.js';

// Valores de PRUEBA, no la clave real (esa vive solo en el secreto de Cloudflare).
const KEY = 'amk_' + 'P'.repeat(43);
const OTHER = 'amk_' + 'Q'.repeat(43);
const BASE = 'https://www.admiranext.com';

function env(extra = {}){ return {PRES_SIGNING_KEY:'machine-test-signing', PRES_GENERIC:'1234', PRES_MACHINE_KEY:KEY, ...extra}; }
function ctx(url, options = {}, bindings = env()){
  const data = {};
  return {data, request:new Request(url, options), env:bindings, next:async () => new Response(JSON.stringify(data.presentationAccess || {ok:true}), {headers:{'content-type':'application/json'}}), waitUntil(){}};
}
const html = {Accept:'text/html'};
const jsonAccept = {Accept:'application/json'};

test('con la clave en X-Admira-Machine-Key: UI y API del generador → 200, como editor machine@admiranext.com', async () => {
  const page = await onRequest(ctx(`${BASE}/presentaciones/`, {headers:{...html, 'X-Admira-Machine-Key':KEY}}));
  assert.equal(page.status, 200);
  const api = await onRequest(ctx(`${BASE}/presentaciones/api/generate`, {method:'PUT', headers:{...jsonAccept, 'X-Admira-Machine-Key':KEY}}));
  assert.equal(api.status, 200);
  const access = await api.json();
  assert.equal(access.level, 'editor');
  assert.equal(access.email, 'machine@admiranext.com');
  assert.equal(access.via, 'machine-key');
  assert.equal(access.canGenerate, true);
  const clients = await onRequest(ctx(`${BASE}/presentaciones/api/clients`, {headers:{...jsonAccept, Authorization:`Bearer ${KEY}`}}));
  assert.equal(clients.status, 200, 'Bearer amk_ también vale');
});

test('sin clave, con clave mala, sin prefijo o sin secreto configurado → 401', async () => {
  const cases = [
    [{}, env()],
    [{'X-Admira-Machine-Key':OTHER}, env()],
    [{'X-Admira-Machine-Key':KEY.slice(0, -1)}, env()],
    [{'X-Admira-Machine-Key':KEY + 'x'}, env()],
    [{Authorization:`Bearer ${OTHER}`}, env()],
    [{Authorization:`Bearer ${KEY.slice(4)}`}, env()],
    [{'X-Admira-Machine-Key':KEY}, env({PRES_MACHINE_KEY:''})],
    [{'X-Admira-Machine-Key':'amk_corta'}, env({PRES_MACHINE_KEY:'amk_corta'})]
  ];
  for (const [headers, bindings] of cases) {
    const api = await onRequest(ctx(`${BASE}/presentaciones/api/generate`, {method:'PUT', headers:{...jsonAccept, ...headers}}, bindings));
    assert.equal(api.status, 401, JSON.stringify(headers));
    const page = await onRequest(ctx(`${BASE}/presentaciones/`, {headers:{...html, ...headers}}, bindings));
    assert.equal(page.status, 401, JSON.stringify(headers));
  }
});

test('la clave no abre /presentaciones/control/ (solo owner)', async () => {
  const control = await onRequest(ctx(`${BASE}/presentaciones/control/api/estado`, {headers:{...jsonAccept, 'X-Admira-Machine-Key':KEY}}));
  assert.equal(control.status, 401);
});

test('la clave no da acceso fuera de /presentaciones', async () => {
  const headers = {...jsonAccept, 'X-Admira-Machine-Key':KEY, Authorization:`Bearer ${KEY}`};
  const db = {prepare(){ return {bind(){ return this; }, async first(){ return null; }, async all(){ return {results:[]}; }, async run(){ return {}; }}; }};
  const bindings = env({AUTH_DB:db});
  assert.equal((await sessionGet({request:new Request(`${BASE}/api/session`, {headers}), env:bindings})).status, 401);
  const proyectos = await proyectosGet({request:new Request(`${BASE}/api/proyectos`, {headers}), env:bindings});
  assert.ok([401, 403].includes(proyectos.status), `api/proyectos → ${proyectos.status}`);
  // Y por construcción: el secreto y el módulo solo se usan dentro de functions/presentaciones/.
  const root = new URL('../functions/', import.meta.url).pathname;
  const offenders = [];
  (function walk(dir){
    for (const entry of fs.readdirSync(dir, {withFileTypes:true})) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (!/\.m?js$/.test(entry.name)) continue;
      const text = fs.readFileSync(full, 'utf8');
      if (/env\.PRES_MACHINE_KEY|env\[['"]PRES_MACHINE_KEY|from ['"][^'"]*_machine-key\.js|headers\.get\(['"]X-Admira-Machine-Key/i.test(text) && !full.startsWith(path.join(root, 'presentaciones') + path.sep)) offenders.push(full);
    }
  })(root);
  assert.deepEqual(offenders, []);
});

test('canje clave → cookie corta limitada a /presentaciones; rotar la clave la invalida', async () => {
  const bad = await exchange(ctx(`${BASE}/presentaciones/auth/machine`, {method:'POST', headers:{...jsonAccept, 'X-Admira-Machine-Key':OTHER}}));
  assert.equal(bad.status, 401);
  assert.equal(bad.headers.get('set-cookie'), null);
  assert.equal((await exchange(ctx(`${BASE}/presentaciones/auth/machine`, {method:'POST', headers:jsonAccept}))).status, 401);
  assert.equal((await exchange(ctx(`${BASE}/presentaciones/auth/machine`, {headers:{'X-Admira-Machine-Key':KEY}}))).status, 405);

  const ok = await exchange(ctx(`${BASE}/presentaciones/auth/machine`, {method:'POST', headers:{...jsonAccept, 'X-Admira-Machine-Key':KEY}}));
  assert.equal(ok.status, 200);
  const body = await ok.text();
  assert.ok(!body.includes(KEY), 'la respuesta no repite la clave');
  const cookie = ok.headers.get('set-cookie');
  assert.match(cookie, new RegExp(`^${MACHINE_COOKIE}=`));
  assert.match(cookie, /Path=\/presentaciones;/);
  assert.match(cookie, new RegExp(`Max-Age=${MACHINE_SESSION_MAXAGE};`));
  assert.match(cookie, /HttpOnly; Secure; SameSite=Strict/);
  assert.ok(!cookie.includes(KEY));
  const pair = cookie.split(';')[0];

  const page = await onRequest(ctx(`${BASE}/presentaciones/`, {headers:{...html, Cookie:pair}}));
  assert.equal(page.status, 200, 'la cookie abre la UI sin pedir identificación');
  const api = await onRequest(ctx(`${BASE}/presentaciones/api/generate`, {method:'PUT', headers:{...jsonAccept, Cookie:pair}}));
  assert.equal((await api.json()).via, 'machine-session');

  const rotated = await onRequest(ctx(`${BASE}/presentaciones/`, {headers:{...html, Cookie:pair}}, env({PRES_MACHINE_KEY:OTHER})));
  assert.equal(rotated.status, 401, 'rotar el secreto corta las sesiones emitidas');
  const deleted = await onRequest(ctx(`${BASE}/presentaciones/`, {headers:{...html, Cookie:pair}}, env({PRES_MACHINE_KEY:undefined})));
  assert.equal(deleted.status, 401, 'borrar el secreto también');
  const forged = await onRequest(ctx(`${BASE}/presentaciones/`, {headers:{...html, Cookie:`${MACHINE_COOKIE}=9999999999.firma`}}));
  assert.equal(forged.status, 401);

  const nav = await exchange(ctx(`${BASE}/presentaciones/auth/machine?next=${encodeURIComponent('https://evil.example/')}`, {method:'POST', headers:{...html, 'X-Admira-Machine-Key':KEY}}));
  assert.equal(nav.status, 303);
  assert.equal(nav.headers.get('location'), '/presentaciones/');
  assert.equal(safeNext('/presentaciones/demo/presentacion?marca=brumelle'), '/presentaciones/demo/presentacion?marca=brumelle');
  assert.equal(safeNext('//evil.example'), '/presentaciones/');
  assert.equal(safeNext('/webmaster'), '/presentaciones/');
});

test('el middleware deja pasar el canje sin login', async () => {
  const response = await onRequest(ctx(`${BASE}/presentaciones/auth/machine`, {method:'POST', headers:jsonAccept}));
  assert.equal(response.status, 200);
});

test('la clave nunca va a los logs', async () => {
  const seen = [];
  const original = {log:console.log, error:console.error, warn:console.warn};
  for (const k of Object.keys(original)) console[k] = (...args) => seen.push(args.map(String).join(' '));
  try {
    await onRequest(ctx(`${BASE}/presentaciones/api/generate`, {method:'PUT', headers:{...jsonAccept, 'X-Admira-Machine-Key':KEY}}));
    await onRequest(ctx(`${BASE}/presentaciones/api/generate`, {method:'PUT', headers:{...jsonAccept, 'X-Admira-Machine-Key':OTHER}}));
    await exchange(ctx(`${BASE}/presentaciones/auth/machine`, {method:'POST', headers:{...jsonAccept, 'X-Admira-Machine-Key':KEY}}));
  } finally { Object.assign(console, original); }
  assert.ok(seen.every(line => !line.includes(KEY) && !line.includes(OTHER)));
});

test('comparación por SHA-256 y autoría machine@admiranext.com en lo generado', async () => {
  assert.equal(await machineKeyMatches(env(), KEY), true);
  assert.equal(await machineKeyMatches(env(), OTHER), false);
  assert.equal(await machineKeyMatches(env(), ''), false);
  const fields = authorFields({email:'machine@admiranext.com', via:'machine-key'}, null);
  assert.equal(fields.createdBy.email, 'machine@admiranext.com');
  assert.equal(fields.createdBy.via, 'machine-key');
  assert.deepEqual(authorFields({}, null), {});
  const kept = authorFields({email:'machine@admiranext.com', via:'machine-session'}, {createdBy:{email:'csilva@admira.com'}});
  assert.equal(kept.createdBy.email, 'csilva@admira.com');
  assert.equal(kept.updatedBy.email, 'machine@admiranext.com');
});
