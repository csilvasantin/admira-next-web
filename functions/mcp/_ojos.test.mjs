// Ojos remotos · tools ojos_* del MCP: validación y seguridad sin tocar ninguna cámara (fetch simulado).
import test from 'node:test';
import assert from 'node:assert/strict';
import { TOOLS, handleRpc } from './_server.js';
import { callOjosTool, OJOS_TOOLS } from './_ojos.js';

const ENV = { OJOS_NODO_MS_URL: 'https://nodo.example', OJOS_NODO_MS_TOKEN: 'x', OJOS_NODO_MM_URL: 'https://mm.example', OJOS_NODO_MM_TOKEN: 'y' };
function ctx(level = 'admin', env = {}, log = []){
  return { env, access: { email: 't@admiranext.com', level }, log, fetchImpl: async (url, init) => {
    log.push({ url, method: init.method, body: init.body });
    if (url.includes('/foto/')) return { ok: true, status: 200, headers: new Map([['content-type', 'image/jpeg']]), arrayBuffer: async () => new Uint8Array([0xff, 0xd8, 0xff]).buffer };
    return { ok: true, status: 200, json: async () => ({ ok: true }) };
  } };
}

test('las tools ojos_* están registradas', () => {
  for (const t of OJOS_TOOLS) assert.ok(TOOLS.some(x => x.name === t.name), t.name);
});
test('list_cameras sin relevo no hace peticiones', async () => {
  const c = ctx('viewer'); const r = await callOjosTool(c, 'ojos_list_cameras');
  assert.equal(r.camaras.length, 3); assert.equal(r.mover_por_mcp, false); assert.equal(c.log.length, 0);
});
test('snapshot sin nodo configurado falla sin fetch', async () => {
  const c = ctx(); await assert.rejects(callOjosTool(c, 'ojos_get_snapshot', { cam: 'luna' }), /no configurado/); assert.equal(c.log.length, 0);
});
test('snapshot con relevo devuelve imagen', async () => {
  const r = await callOjosTool(ctx('viewer', ENV), 'ojos_get_snapshot', { cam: 'link' });
  assert.equal(r.__image.mimeType, 'image/jpeg'); assert.equal(r.bytes, 3);
});
test('mover: apagado por defecto, solo admin, exige he_mirado y límites', async () => {
  const c = ctx('admin', ENV);
  await assert.rejects(callOjosTool(c, 'ojos_move_gimbal', { cam: 'luna', h: 10, v: 0, he_mirado: true }), /OJOS_MOVER/);
  const on = { ...ENV, OJOS_MOVER: 'on' };
  await assert.rejects(callOjosTool(ctx('editor', on), 'ojos_move_gimbal', { cam: 'luna', h: 10, v: 0, he_mirado: true }), /admin/);
  await assert.rejects(callOjosTool(ctx('admin', on), 'ojos_move_gimbal', { cam: 'luna', h: 10, v: 0 }), /Mira antes/);
  await assert.rejects(callOjosTool(ctx('admin', on), 'ojos_move_gimbal', { cam: 'luna', h: 101, v: 0, he_mirado: true }), /-100 y 100/);
  await assert.rejects(callOjosTool(ctx('admin', on), 'ojos_move_gimbal', { cam: 'luna', h: 1, v: 0, seg: 9, he_mirado: true }), /seg/);
  await assert.rejects(callOjosTool(ctx('admin', on), 'ojos_move_gimbal', { cam: 'studio', h: 1, v: 0, he_mirado: true }), /fija/);
  assert.equal(c.log.length, 0);
  const l = []; const r = await callOjosTool(ctx('admin', on, l), 'ojos_move_gimbal', { cam: 'luna', h: -20, v: 5, seg: 1, he_mirado: true });
  assert.deepEqual(r.enviado, { h: -20, v: 5, seg: 1 }); assert.equal(l[0].url, 'https://nodo.example/ptz/luna');
});
test('stop y center', async () => {
  const l = []; await callOjosTool(ctx('editor', ENV, l), 'ojos_stop_gimbal', { cam: 'luna' });
  assert.deepEqual(JSON.parse(l[0].body), { h: 0, v: 0, seg: 0.1 });
  await assert.rejects(callOjosTool(ctx('admin', ENV), 'ojos_center_gimbal', { cam: 'link', he_mirado: true }), /OJOS_MOVER/);
});
test('help ojos sin token y viewer no puede parar', async () => {
  const r = await handleRpc({ env: {}, access: null }, { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'help', arguments: { tema: 'ojos' } } });
  assert.match(r.result.content[0].text, /Ojos remotos/);
  const v = await handleRpc(ctx('viewer', ENV), { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'ojos_stop_gimbal', arguments: { cam: 'luna' } } });
  assert.equal(v.result.isError, true);
});
test('snapshot por RPC sale como contenido image', async () => {
  const r = await handleRpc(ctx('viewer', ENV), { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'ojos_get_snapshot', arguments: { cam: 'luna' } } });
  assert.equal(r.result.content[0].type, 'image');
});
