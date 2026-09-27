// DeepAgents editores (Carlos, 27-09-2026: «Todos los deepagents tienen que poder ser
// editores, arréglalo»). El token anmcp_ de un agente vale como sesión de editor en las
// APIs del generador —en especial la biblioteca multimedia— sin la cookie de Google de
// una persona, y sin abrir nada al público ni tocar /control/.
import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequest} from '../functions/presentaciones/_middleware.js';
import {onRequestPost, onRequestDelete} from '../functions/presentaciones/api/media-library.js';
import {sha256Hex} from '../functions/mcp/_tokens.js';
import {callTool} from '../functions/mcp/_server.js';

const OWNER_TOKEN = 'anmcp_morfeo_token_de_prueba_0000000000000000';
const VIEWER_TOKEN = 'anmcp_viewer_token_de_prueba_000000000000000';
const REVOKED_TOKEN = 'anmcp_revocado_token_de_prueba_0000000000000';

async function fakeDb(){
  const users = [
    {email:'csilvasantin@gmail.com', status:'active', role:'admin', display_name:'Carlos', session_version:1},
    {email:'mirona@admira.com', status:'active', role:'viewer', display_name:'Mirona', session_version:1}
  ];
  const projects = [
    {user_email:'csilvasantin@gmail.com', project_key:'*'},
    {user_email:'mirona@admira.com', project_key:'generador-de-presentaciones'}
  ];
  const tokens = [
    {id:'t1', token_hash:await sha256Hex(OWNER_TOKEN), email:'csilvasantin@gmail.com', label:'Morfeo', revoked_at:null},
    {id:'t2', token_hash:await sha256Hex(VIEWER_TOKEN), email:'mirona@admira.com', label:'Mirona', revoked_at:null},
    {id:'t3', token_hash:await sha256Hex(REVOKED_TOKEN), email:'csilvasantin@gmail.com', label:'Viejo', revoked_at:1}
  ];
  return {
    prepare(sql){
      return {async run(){ return {}; }, bind(...args){ return {
        async first(){
          if (/FROM admiranext_mcp_tokens WHERE token_hash=/.test(sql)) return tokens.find(t => t.token_hash === args[0]) || null;
          if (/FROM admiranext_users WHERE email=/.test(sql)) return users.find(u => u.email === args[0]) || null;
          return null;
        },
        async all(){
          if (/FROM admiranext_user_projects WHERE user_email=/.test(sql)) return {results:projects.filter(p => p.user_email === args[0]).map(p => ({project_key:p.project_key}))};
          return {results:[]};
        },
        async run(){ return {}; }
      }; }};
    }
  };
}

async function env(){
  return {PRES_SIGNING_KEY:'deepagents-test-key', PRES_GENERIC:'1234', AUTH_DB:await fakeDb()};
}

function ctx(url, options, bindings){
  const data = {};
  return {data, request:new Request(url, options), env:bindings, next:async () => new Response(JSON.stringify(data.presentationAccess || null)), waitUntil(){}};
}

test('el token anmcp_ de un agente owner/editor abre la biblioteca multimedia sin cookie', async () => {
  const bindings = await env();
  const response = await onRequest(ctx('https://www.admiranext.com/presentaciones/api/media-library', {method:'POST', headers:{Authorization:`Bearer ${OWNER_TOKEN}`, Accept:'application/json'}}, bindings));
  assert.equal(response.status, 200);
  const access = await response.json();
  assert.equal(access.via, 'agent-token');
  assert.equal(access.level, 'owner');
  assert.equal(access.email, 'csilvasantin@gmail.com');
  assert.equal(access.tokenLabel, 'Morfeo');
  assert.equal(access.canGenerate, true);
});

test('sin token, con token viewer, revocado o inventado: 401 como siempre', async () => {
  const bindings = await env();
  for (const auth of [null, `Bearer ${VIEWER_TOKEN}`, `Bearer ${REVOKED_TOKEN}`, 'Bearer anmcp_inventado', 'Bearer otro_token']) {
    const headers = {Accept:'application/json'}; if (auth) headers.Authorization = auth;
    const response = await onRequest(ctx('https://www.admiranext.com/presentaciones/api/media-library', {method:'POST', headers}, bindings));
    assert.equal(response.status, 401, String(auth));
  }
});

test('el token de agente no abre páginas ni el área de control', async () => {
  const bindings = await env();
  const control = await onRequest(ctx('https://www.admiranext.com/presentaciones/control/api/estado', {headers:{Authorization:`Bearer ${OWNER_TOKEN}`, Accept:'application/json'}}, bindings));
  assert.equal(control.status, 401);
  const page = await onRequest(ctx('https://www.admiranext.com/presentaciones/', {headers:{Authorization:`Bearer ${OWNER_TOKEN}`, Accept:'text/html'}}, bindings));
  assert.equal(page.status, 401);
});

function mediaEnv(){
  const values = new Map([
    ['presentation:demo', JSON.stringify({slug:'demo', slideMedia:[]})],
    ['ideas:demo', JSON.stringify({hero:{title:'Demo'}, skeleton:[], closing:{title:'Cierre'}})]
  ]);
  const objects = new Map();
  return {
    objects, values,
    PRESENTATION_IDEAS:{async get(k, o){ const v = values.get(k); return v == null ? null : (o?.type === 'json' ? JSON.parse(v) : v); }, async put(k, v){ values.set(k, String(v)); }},
    PRESENTATION_MEDIA:{async put(k, v, o){ objects.set(k, {v, o}); }, async delete(k){ objects.delete(k); }}
  };
}

test('la biblioteca acepta al agente sin Origin, exige el OK de Carlos y anota quién sube', async () => {
  const bindings = mediaEnv();
  const agent = {presentationAccess:{via:'agent-token', email:'csilvasantin@gmail.com', tokenLabel:'Morfeo', level:'owner'}};
  const png = new File([new Uint8Array([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])], 'prueba.png');
  const noOk = new FormData(); noOk.set('client', 'demo'); noOk.set('file', png);
  assert.equal((await onRequestPost({request:new Request('https://www.admiranext.com/presentaciones/api/media-library', {method:'POST', body:noOk}), env:bindings, data:agent})).status, 422);
  const noAgent = new FormData(); noAgent.set('client', 'demo'); noAgent.set('acceptedByCarlos', 'true'); noAgent.set('file', png);
  assert.equal((await onRequestPost({request:new Request('https://www.admiranext.com/presentaciones/api/media-library', {method:'POST', body:noAgent}), env:bindings, data:{}})).status, 403);
  const form = new FormData(); form.set('client', 'demo'); form.set('acceptedByCarlos', 'true'); form.set('file', png);
  const response = await onRequestPost({request:new Request('https://www.admiranext.com/presentaciones/api/media-library', {method:'POST', body:form}), env:bindings, data:agent});
  assert.equal(response.status, 201);
  const asset = (await response.json()).assets[0];
  assert.equal(asset.acceptedByCarlos, true);
  assert.equal(asset.uploadedBy, 'Morfeo <csilvasantin@gmail.com>');
  assert.equal(asset.uploadedVia, 'agent-token');
  assert.match(asset.approvalNote, /Aceptado por Carlos/);
  assert.equal(bindings.objects.size, 1);
  const removed = await onRequestDelete({request:new Request('https://www.admiranext.com/presentaciones/api/media-library', {method:'DELETE', headers:{'content-type':'application/json'}, body:JSON.stringify({client:'demo', assetId:asset.id})}), env:bindings, data:agent});
  assert.equal(removed.status, 200);
  assert.equal((await removed.json()).assets.length, 0);
  assert.equal(bindings.objects.size, 0);
});

test('MCP upload_media sube multipart con la sesión del dueño del token y exige acceptedByCarlos', async () => {
  const log = [];
  const fetchImpl = async (url, init) => {
    log.push({url, method:init.method, body:init.body, headers:init.headers});
    const body = init.method === 'POST' ? {ok:true, assets:[{id:'aabbccddeeff0011', url:'/presentaciones/demo/media/x.png'}]} : {ok:true};
    return {status:init.method === 'POST' ? 201 : 200, ok:true, text:async () => JSON.stringify(body)};
  };
  const context = {env:{PRES_SIGNING_KEY:'k'}, access:{level:'owner', email:'csilvasantin@gmail.com', name:'Carlos', sessionVersion:1, source:'directory'}, fetchImpl};
  const dataBase64 = Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]).toString('base64');
  await assert.rejects(() => callTool(context, 'upload_media', {client:'demo', filename:'x.png', dataBase64}), /acceptedByCarlos/);
  const out = await callTool(context, 'upload_media', {client:'demo', filename:'x.png', dataBase64, acceptedByCarlos:true, slide:'cover'});
  assert.equal(out.uploaded.id, 'aabbccddeeff0011');
  assert.equal(log[0].method, 'POST');
  assert.ok(log[0].body instanceof FormData);
  assert.equal(log[0].body.get('acceptedByCarlos'), 'true');
  assert.equal(log[0].headers['content-type'], undefined);
  assert.equal(log[1].method, 'PUT');
  assert.equal(JSON.parse(log[1].body).slide, 'cover');
  const viewer = {...context, access:{...context.access, level:'viewer'}};
  await assert.rejects(() => callTool(viewer, 'upload_media', {client:'demo', filename:'x.png', dataBase64, acceptedByCarlos:true}), /solo lectura/);
});
