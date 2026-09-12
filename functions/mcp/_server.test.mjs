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
    if (path === '/presentaciones/api/clients') return ok({ clients: [{ slug: 'portaventura', displayName: 'PortAventura World' }, { slug: 'valiant-alcampo', displayName: 'Valiant Alcampo', website: 'https://www.alcampo.es', updatedAt: '2026-09-01T10:00:00Z' }] });
    if (path === '/presentaciones/api/generate') {
      let slug = 'nuevo-cliente'; let password = 'abc';
      try { const b = JSON.parse(init.body || '{}'); if (b.slug) slug = b.slug; if (b.password) password = b.password; } catch {}
      return ok({ ok: true, slug, password });
    }
    if (path === '/presentaciones/portaventura/api/versions') return ok({ versions: [{ id: 'v1' }] });
    if (path === '/presentaciones/portaventura/content-data') return ok({ client: 'portaventura', slides: 12 });
    if (path === '/presentaciones/portaventura/api/inline-edit') {
      let body = {}; try { body = JSON.parse(init.body || '{}'); } catch {}
      return ok({ ok: true, deleted: body.blockId, locales: { es: { skeleton: [] } } });
    }
    return ok({ error: 'no existe' }, 404);
  };
  return { env: { PRES_SIGNING_KEY: 'clave' }, access: { level, email: 'x@admira.com', name: 'X', sessionVersion: 1, source: 'directory' }, fetchImpl };
}

test('todas las tools tienen esquema y help las documenta', () => {
  assert.ok(TOOLS.length >= 10);
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
  await callTool(ctx, 'create_presentation', { displayName: 'Con Media', slug: 'con-media-video', slideMedia: [{ slide: 'cover', type: 'video', src: 'https://www.admira.live/assets/mouth-v2/boca-v2-ciclo.mp4' }] });
  const mediaBody = JSON.parse(log.find(e => e.method === 'PUT' && e.body && e.body.includes('con-media-video')).body);
  assert.ok(Array.isArray(mediaBody.slideMedia));
  assert.equal(mediaBody.slideMedia[0].src, 'https://www.admira.live/assets/mouth-v2/boca-v2-ciclo.mp4');
  await callTool(ctx, 'create_presentation', { displayName: 'Video Output', slug: 'video-output-demo', outputs: ['website', 'video'] });
  const videoOutBody = JSON.parse(log.find(e => e.method === 'PUT' && e.body && e.body.includes('video-output-demo')).body);
  assert.ok(videoOutBody.slideMedia.some(item => item.type === 'video' && String(item.src).includes('boca-v2-ciclo.mp4')));
  const deleted = await callTool(ctx, 'delete_slide', { client: 'portaventura', blockId: 'problema' });
  assert.equal(deleted.deleted, 'problema');
  const improved = await callTool(ctx, 'create_yokup_report', {
    mision: 'FLT-100257', titulo: 'Reuse registro', resumen: 'Mejora in situ Valiant', verificado: 'list_presentations',
    cliente: 'valiant-alcampo'
  });
  assert.equal(improved.kind, 'yokup-report');
  assert.equal(improved.mode, 'improved');
  assert.equal(improved.mision, 'FLT-100257');
  assert.equal(improved.slug, 'valiant-alcampo');
  assert.ok(improved.yokupBlock.includes('FLT-100257'));
  assert.ok(improved.urls.salaQuality.includes('quality=best'));
  assert.ok(improved.urls.salaQuality.includes('valiant-alcampo'));
  assert.equal(improved.previous.slug, 'valiant-alcampo');
  const improvedBody = JSON.parse(log.find(e => e.method === 'PUT' && e.body && e.body.includes('"slug":"valiant-alcampo"')).body);
  assert.equal(improvedBody.slug, 'valiant-alcampo');
  assert.equal(improvedBody.overwrite, true);
  assert.equal(improvedBody.displayName, 'Valiant Alcampo');
  assert.ok(String(improvedBody.title).includes('Informe FLT-100257'));
  assert.deepEqual(improvedBody.outputs, ['website', 'documents', 'backgrounds']);
  assert.ok(improvedBody.audience.includes('Yokup'));
  assert.equal(improvedBody.slideMedia, undefined);
  assert.equal(improvedBody.password, undefined, 'al mejorar sin password se conserva la existente');

  const byName = await callTool(ctx, 'create_yokup_report', {
    mision: 'FLT-100257', titulo: 'Por nombre', resumen: 'Resuelve displayName', displayName: 'Valiant Alcampo'
  });
  assert.equal(byName.mode, 'improved');
  assert.equal(byName.slug, 'valiant-alcampo');
  const byNameBody = JSON.parse([...log].reverse().find(e => e.method === 'PUT' && e.body && e.body.includes('Por nombre')).body);
  assert.equal(byNameBody.overwrite, true);
  assert.equal(byNameBody.slug, 'valiant-alcampo');

  const brandNew = await callTool(ctx, 'create_yokup_report', {
    mision: 'FLT-100257', titulo: 'Cliente nuevo', resumen: 'Alta sin yokup-flt', displayName: 'Acme Retail Demo'
  });
  assert.equal(brandNew.mode, 'created');
  assert.equal(brandNew.slug, 'acme-retail-demo');
  assert.ok(!String(brandNew.slug).includes('yokup-flt'));
  const createdBody = JSON.parse(log.find(e => e.method === 'PUT' && e.body && e.body.includes('acme-retail-demo')).body);
  assert.equal(createdBody.slug, 'acme-retail-demo');
  assert.equal(createdBody.overwrite, false);
  assert.equal(createdBody.displayName, 'Acme Retail Demo');

  await assert.rejects(
    () => callTool(ctx, 'create_yokup_report', { mision: 'FLT-100257', titulo: 'Bloqueo', resumen: 'sin overwrite', cliente: 'valiant-alcampo', overwrite: false }),
    /overwrite:true|mejorar in situ/
  );
  await assert.rejects(
    () => callTool(ctx, 'create_yokup_report', { mision: 'FLT-100257', titulo: 'Sin cliente', resumen: 'falta seed' }),
    /displayName o cliente/
  );

  const withVideo = await callTool(ctx, 'create_yokup_report', {
    mision: 'FLT-100237', titulo: 'Best motion', resumen: 'BEST lleva MP4', verificado: 'safeExternalVideoUrl',
    cliente: 'valiant-alcampo',
    videoUrl: 'https://www.admira.live/assets/mouth-v2/boca-v2-ciclo.mp4'
  });
  assert.equal(withVideo.slug, 'valiant-alcampo');
  assert.equal(withVideo.mode, 'improved');
  assert.ok(withVideo.yokupBlock.includes('Vídeo BEST'));
  assert.ok(withVideo.yokupBlock.includes('boca-v2-ciclo.mp4'));
  const videoBody = JSON.parse([...log].reverse().find(e => e.method === 'PUT' && e.body && e.body.includes('boca-v2-ciclo.mp4')).body);
  assert.equal(videoBody.slug, 'valiant-alcampo');
  assert.equal(videoBody.overwrite, true);
  assert.equal(videoBody.slideMedia.length, 1);
  assert.equal(videoBody.slideMedia[0].type, 'video');
  assert.equal(videoBody.slideMedia[0].src, 'https://www.admira.live/assets/mouth-v2/boca-v2-ciclo.mp4');
  assert.equal(videoBody.slideMedia[0].slide, 'cover');
  assert.equal(videoBody.slideMedia[0].loop, true);
  assert.equal(videoBody.slideMedia[0].rights.permission, 'owned');
  const aliasVideo = await callTool(ctx, 'create_yokup_report', {
    mision: 'FLT-100315', titulo: 'Alias ejemplo', resumen: 'exampleVideoUrl',
    cliente: 'valiant-alcampo', includeExampleVideo: true
  });
  assert.ok(aliasVideo.yokupBlock.includes('Vídeo BEST'));
  assert.ok(aliasVideo.yokupBlock.includes('boca-v2-ciclo.mp4'));
  await assert.rejects(() => callTool(ctx, 'create_yokup_report', { mision: 'X', titulo: 't', resumen: 'r' }), /FLT/);
  await assert.rejects(() => callTool(ctxFor('viewer'), 'create_yokup_report', { mision: 'FLT-1', titulo: 't', resumen: 'r', cliente: 'valiant-alcampo' }), /solo lectura/);
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
  const helpInformes = await handleRpc(ctxFor('owner'), { jsonrpc: '2.0', id: 55, method: 'tools/call', params: { name: 'help', arguments: { tema: 'informes' } } });
  assert.match(helpInformes.result.content[0].text, /create_yokup_report/);
  assert.match(helpInformes.result.content[0].text, /list_presentations|censo|overwrite:true/);
  const helpCatalogo = await handleRpc(ctxFor('owner'), { jsonrpc: '2.0', id: 56, method: 'tools/call', params: { name: 'help', arguments: { tema: 'catalogo' } } });
  assert.match(helpCatalogo.result.content[0].text, /get_catalog|list_presentations/);
  assert.match(helpCatalogo.result.content[0].text, /Mejorar|overwrite:true/);
  assert.equal((await callTool(ctxFor('viewer'), 'get_catalog')).clients[0].slug, 'portaventura');
  assert.equal(init.result.serverInfo.version, '1.4.0');
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
