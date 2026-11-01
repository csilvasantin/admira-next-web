import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet, onRequest } from '../functions/ojosremotos/config.js';
const env = { WEBMASTER_SIGNING_KEY: 'k', OJOS_TOKEN_MACMINI: 'SECRETO-MM', OJOS_TOKEN_MACSTUDIO: 'SECRETO-MS' };
test('sin sesión: 401 y sin tokens', async () => {
  const r = await onRequestGet({ request: new Request('https://www.admiranext.com/ojosremotos/config'), env });
  assert.equal(r.status, 401); const t = await r.text(); assert.ok(!t.includes('SECRETO'));
});
test('cookie falsa: 401', async () => {
  const r = await onRequestGet({ request: new Request('https://www.admiranext.com/ojosremotos/config', { headers: { cookie: 'admiranext_session=falsa' } }), env });
  assert.equal(r.status, 401); assert.ok(!(await r.text()).includes('SECRETO'));
});
test('sin clave de firma: 503', async () => {
  const r = await onRequestGet({ request: new Request('https://www.admiranext.com/ojosremotos/config'), env: { OJOS_TOKEN_MACMINI: 'SECRETO-MM' } });
  assert.equal(r.status, 503); assert.ok(!(await r.text()).includes('SECRETO'));
});
test('otros métodos: 405', async () => { assert.equal(onRequest().status, 405); });
