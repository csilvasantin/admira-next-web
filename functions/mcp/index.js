/*
 * /mcp — POST: servidor MCP del Generador de Presentaciones (JSON-RPC 2.0, Streamable HTTP).
 *        GET con Accept: application/json → ficha del servidor.
 *        GET normal → la página estática /mcp/ (hub) sigue como siempre (next()).
 */
import { accessFromRequest, encodeResponse, handleRpc, rpcError, SERVER_INFO, TOOLS, wantsSse, SITE } from './_server.js';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'Content-Type, Accept, Authorization, Mcp-Session-Id, Mcp-Protocol-Version',
  'access-control-expose-headers': 'Mcp-Session-Id'
};

function withCors(response){
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(CORS)) headers.set(k, v);
  return new Response(response.body, { status: response.status, headers });
}

export async function onRequest(context){
  const { request, env, next } = context;
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (request.method === 'GET') {
    if (/application\/json/i.test(request.headers.get('Accept') || '') && !/text\/html/i.test(request.headers.get('Accept') || '')) {
      return withCors(Response.json({ ok: true, server: SERVER_INFO, endpoint: `${SITE}/mcp`, help: `${SITE}/mcp/generador`, tools: TOOLS.map(t => t.name), auth: 'Authorization: Bearer anmcp_… (token de /usuarios → Tokens MCP)' }, { headers: { 'cache-control': 'no-store' } }));
    }
    return next();
  }
  if (request.method !== 'POST') return withCors(Response.json(rpcError(null, -32600, 'Método HTTP no soportado'), { status: 405 }));
  let body;
  try { body = await request.json(); } catch (_) { return withCors(Response.json(rpcError(null, -32700, 'JSON no válido'), { status: 400 })); }
  const waitUntil = (p) => { try { context.waitUntil(p); } catch (_) {} };
  const { access } = await accessFromRequest(env, request, waitUntil);
  const ctx = { env, access, fetchImpl: (url, init) => fetch(url, init) };
  const sse = wantsSse(request);
  const messages = Array.isArray(body) ? body : [body];
  const answers = [];
  for (const msg of messages) { const r = await handleRpc(ctx, msg); if (r) answers.push(r); }
  if (!answers.length) return withCors(new Response(null, { status: 202, headers: { 'mcp-session-id': 'stateless' } }));
  const response = encodeResponse(Array.isArray(body) ? answers : answers[0], sse);
  response.headers.set('mcp-session-id', 'stateless');
  return withCors(response);
}
