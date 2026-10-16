import assert from 'node:assert/strict';
import { onRequestPost } from '../functions/api/login-token.js';
import { sha256Hex } from '../functions/mcp/_tokens.js';
const TOKEN = 'anmcp_' + 'x'.repeat(43);
const hash = await sha256Hex(TOKEN);
const users = { 'neo@agentes.admiranext.com': { email: 'neo@agentes.admiranext.com', role: 'editor', status: 'active', session_version: 1 } };
const db = { prepare(sql) { const st = { args: [], bind(...a) { st.args = a; return st; },
  async run() { return {}; }, async all() { return { results: [] }; },
  async first() { if (/FROM admiranext_mcp_tokens/.test(sql)) return st.args[0] === hash ? { id: 't1', email: 'neo@agentes.admiranext.com', revoked_at: null } : null;
    if (/FROM admiranext_users/.test(sql)) return users[st.args[0]] || null; return null; } }; return st; } };
const env = { AUTH_DB: db, WEBMASTER_SIGNING_KEY: 'k'.repeat(32) };
const req = (body, origin) => new Request('https://www.admiranext.com/api/login-token', { method: 'POST', headers: { 'content-type': 'application/json', ...(origin ? { origin } : {}) }, body: JSON.stringify(body) });
let r = await onRequestPost({ request: req({ token: TOKEN }), env, waitUntil() {} });
assert.equal(r.status, 200); assert.match(r.headers.get('set-cookie'), /^__Host-an_session=/);
r = await onRequestPost({ request: req({ token: 'anmcp_' + 'y'.repeat(43) }), env, waitUntil() {} }); assert.equal(r.status, 401);
r = await onRequestPost({ request: req({ token: TOKEN }, 'https://evil.example'), env, waitUntil() {} }); assert.equal(r.status, 403);
users['neo@agentes.admiranext.com'].status = 'suspended';
r = await onRequestPost({ request: req({ token: TOKEN }), env, waitUntil() {} }); assert.equal(r.status, 401);
console.log('login-token: 4/4 ok');
