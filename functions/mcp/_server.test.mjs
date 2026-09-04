// 0558 · MCP del Generador de Presentaciones: tools, permisos y protocolo.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { HELP, TOOLS, callTool, handleRpc, urlsFor, encodeResponse } from './_server.js';
import { bearerOf, newToken, sha256Hex } from './_tokens.js';

const help = await readFile(new URL('../../mcp/generador.html', import.meta.url), 'utf8');

function ctxFor(level, log = []){
  const fetchImpl = async (url, init) => {
    log.push({ url, method: init.method, cookie: init.headers.cookie, origin: init.headers.origin, body: init.body });
    const path = new URL(url).pathname;
    const ok = (data, status = 200) => ({ status, ok: status < 400, text: async () => JSON.stringify(data) });
    if (path === '/presentaciones/api/clients') return ok({ clients: [{ slug: 'portaventura', displayName: 'PortAventura World' }] });
    if (path === '/presentaciones/api/generate') return ok({ ok: true, slug: 'nuevo-cliente', password: 'abc' });
    if (path === '/presentaciones/portaventura/api/versions') return ok({ versions: [{ id: 'v1' }] });
    if (path === '/presentaciones/portaventura/content-data') return ok({ client: 'portaventura', slides: 12 });
    return ok({ error: 'no existe' }, 404);
  };
  return { env: { PRES_SIGNING_KEY: 'clave' }, access: { level, email: 'x@admira.com', name: 'X', sessionVersion: 1, source: 'directory' }, fetchImpl };
}

test('todas las tools tienen esquema y help las documenta', () => {
  assert.ok(TOOLS.length >= 9);
  for (const t of TOOLS) { assert.ok(t.name && t.description && t.inputSchema && t.inputSchema.type === 'object', t.name); assert.ok(HELP.includes(t.name), `help no menciona ${t.name}`); assert.ok(help.includes(t.name), `la página /mcp/generador no menciona ${t.name}`); }
  assert.match(help, /Authorization: Bearer anmcp_/);
  assert.match(help, /https:\/\/www\.admiranext\.com\/mcp/);
});

test('cada tool envuelve la API del generador con sesión de directorio, mismo origen y sin reinventar nada', async () => {
  const log = []; const ctx = ctxFor('owner', log);
  const clients = await callTool(ctx, 'list_presentations');
  assert.equal(clients.clients[0].slug, 'portaventura');
  assert.match(log[0].cookie, /^pres_owner=\d+\.owner\./); assert.equal(log[0].origin, 'https://www.admiranext.com');
  const created = await callTool(ctx, 'create_presentation', { displayName: 'Nuevo Cliente', website: 'https://nuevo.com', problem: 'p', extra: 'ignorado' });
  assert.equal(created.slug, 'nuevo-cliente'); assert.equal(created.urls.presentacion, 'https://www.admiranext.com/presentaciones/nuevo-cliente/');
  assert.equal(log[1].method, 'PUT'); assert.ok(!JSON.parse(log[1].body).extra, 'solo pasan los campos del contrato');
  assert.equal((await callTool(ctx, 'list_versions', { client: 'PortAventura' })).versions[0].id, 'v1');
  assert.equal((await callTool(ctx, 'get_presentation', { client: 'portaventura' })).slides, 12);
  await assert.rejects(() => callTool(ctx, 'get_presentation', { client: '../x' }), /client no válido/);
  await assert.rejects(() => callTool(ctx, 'get_presentation', { client: 'nadie' }), /no existe/);
  await assert.rejects(() => callTool(ctx, 'inventada'), /Tool desconocida/);
});

test('viewer solo lee; editor y admin crean', async () => {
  await assert.rejects(() => callTool(ctxFor('viewer'), 'create_presentation', { displayName: 'X' }), /solo lectura/);
  assert.ok((await callTool(ctxFor('viewer'), 'list_presentations')).clients);
  assert.equal((await callTool(ctxFor('editor'), 'create_presentation', { displayName: 'X' })).slug, 'nuevo-cliente');
  assert.deepEqual(Object.keys(urlsFor('portaventura')), ['presentacion', 'sala', 'versiones', 'ideas', 'galeria']);
});

test('protocolo: initialize, tools/list y help funcionan sin token; el resto pide token', async () => {
  const anon = { env: {}, access: null, fetchImpl: async () => { throw new Error('no debe llamar'); } };
  const init = await handleRpc(anon, { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } });
  assert.equal(init.result.serverInfo.name, 'admiranext-generador-presentaciones');
  assert.equal(await handleRpc(anon, { jsonrpc: '2.0', method: 'notifications/initialized' }), null);
  assert.equal((await handleRpc(anon, { jsonrpc: '2.0', id: 2, method: 'tools/list' })).result.tools.length, TOOLS.length);
  const helpAnon = await handleRpc(anon, { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'help' } });
  assert.equal(helpAnon.result.isError, false); assert.match(helpAnon.result.content[0].text, /Falta un token/);
  const denied = await handleRpc(anon, { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'list_presentations' } });
  assert.equal(denied.result.isError, true);
  const withToken = await handleRpc(ctxFor('owner'), { jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'help', arguments: { tema: 'crear' } } });
  assert.match(withToken.result.content[0].text, /displayName/);
  assert.equal((await handleRpc(anon, { jsonrpc: '2.0', id: 6, method: 'otra' })).error.code, -32601);
  const sse = encodeResponse({ jsonrpc: '2.0', id: 1, result: {} }, true);
  assert.equal(sse.headers.get('content-type'), 'text/event-stream');
});

test('tokens: formato anmcp_, hash estable y cabecera Bearer', async () => {
  const t = newToken(); assert.match(t, /^anmcp_[A-Za-z0-9_-]{40,}$/);
  assert.equal(await sha256Hex('a'), 'ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb');
  assert.equal(bearerOf({ headers: { get: () => 'Bearer ' + t } }), t);
  assert.equal(bearerOf({ headers: { get: () => '' } }), '');
});
