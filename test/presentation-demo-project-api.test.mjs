import test, {beforeEach, afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {onRequest} from '../functions/presentaciones/[client]/api/demo-project.js';
import {GLOBALES} from '../subdemos/catalogo.mjs';
import {onRequest as gate} from '../functions/presentaciones/_middleware.js';
import {makeIdentityToken} from '../functions/presentaciones/_access.js';

const origin = 'https://www.admiranext.test';
const client = 'norte-pilot';
const updatedAt = '2026-10-07T08:30:00.000Z';
let realFetch, networkCalls;
beforeEach(() => {
  realFetch = globalThis.fetch;
  networkCalls = [];
  globalThis.fetch = async input => {networkCalls.push(String(input)); throw Error('Unexpected network');};
});
afterEach(() => {globalThis.fetch = realFetch; assert.deepEqual(networkCalls, [], 'no generación, proveedores ni red');});

class KV {
  constructor(values = {}) {
    this.values = new Map(Object.entries(values).map(([key, value]) => [key, JSON.stringify(value)]));
    this.writes = [];
  }
  async get(key, options) {
    const value = this.values.get(key);
    return value == null ? null : options?.type === 'json' ? JSON.parse(value) : value;
  }
  async put(key, value) {this.writes.push({key, value: JSON.parse(value)}); this.values.set(key, String(value));}
}

function environment(overrides = {}) {
  const presentation = {
    schemaVersion: 13, slug: client, displayName: 'Café Norte', updatedAt,
    prospect: {marca: 'norte-brand', web: 'https://norte.test/', summary: 'Ficha existente'},
    passwordVerifier: 'PRIVATE-TEST-VERIFIER', ownerEmail: 'owner@norte.test',
    outputs: ['website', 'documents'], languages: ['es', 'en'],
    theme: {primary: '#112233', accent: '#e0a500'}, sequence: {before: 'admira-2026', inserts: [{after: 1, deck: 'custom'}]},
    imageSet: {revision: 7}, captions: ['Mantener texto'], customField: {unchanged: true},
    demoProject: {version: 1, id: 'old', nombre: 'Proyecto anterior', demos: ['studio/voz'], contexto: {marca: 'norte-brand'}, propuestas: {},
      documentacion: [{clave: 'studio/voz', titulo: 'Snapshot anterior', url: 'https://www.admira.studio/audio.html', desc: 'Texto capturado'}]},
  };
  const values = {
    ['presentation:' + client]: presentation,
    ['ideas:' + client]: {hero: {title: 'Propuesta intacta'}, skeleton: [{title: 'Oferta', description: 'No regenerar'}], updatedAt, languages: ['es']},
    ['generation:' + client]: {sourceText: 'FUENTE ORIGINAL SIN REGENERAR', status: 'ready', generatedAt: updatedAt},
    ['image-set:' + client]: {revision: 7, images: [{url: 'https://assets.test/saved.jpg', caption: 'Imagen original'}]},
    ...overrides,
  };
  return {PRESENTATION_IDEAS: new KV(values)};
}
function request(env, method = 'GET', body, options = {}) {
  const headers = {'Content-Type': 'application/json'};
  if (method !== 'GET') headers.Origin = options.origin === undefined ? origin : options.origin;
  if (headers.Origin === null) delete headers.Origin;
  Object.assign(headers, options.headers);
  const init = {method, headers};
  if (body !== undefined) init.body = options.raw ? body : JSON.stringify(body);
  const data = options.access === null ? {} : {presentationAccess: options.access || {canGenerate: true, level: 'editor'}};
  return onRequest({env, params: {client: options.client || client}, data,
    request: new Request(origin + '/presentaciones/' + client + '/api/demo-project', init)});
}
const read = (env, key = 'presentation:' + client) => env.PRESENTATION_IDEAS.get(key, {type: 'json'});
const project = () => ({id: 'norte-campaign', nombre: 'Campaña Norte', demos: ['store/tpv', 'studio/voz'], propuestas: {'store/tpv': 'Oferta de caja personalizada'}});
const allValues = env => [...env.PRESENTATION_IDEAS.values.entries()];

test('GET devuelve solo el snapshot guardado, sin verifier ni datos de presentación y sin escribir', async () => {
  const env = environment(), existing = await read(env);
  const response = await request(env, 'GET', undefined, {access: {canGenerate: false, level: 'viewer'}});
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body, {ok: true, demoProject: existing.demoProject, updatedAt});
  assert.doesNotMatch(JSON.stringify(body), /PRIVATE-TEST-VERIFIER|passwordVerifier|ownerEmail|sourceText/);
  assert.match(response.headers.get('cache-control'), /no-store/);
  assert.deepEqual(env.PRESENTATION_IDEAS.writes, []);
});

test('PUT modifica únicamente demoProject y fecha; versiona antes y después sin regenerar contenido', async () => {
  const env = environment(), before = await read(env);
  const kept = Object.fromEntries(await Promise.all(['ideas', 'generation', 'image-set'].map(async name => [name, await read(env, name + ':' + client)])));
  const response = await request(env, 'PUT', {demoProject: project(), expectedUpdatedAt: updatedAt});
  assert.equal(response.status, 200, await response.clone().text());
  const body = await response.json(), after = await read(env);
  assert.equal(body.ok, true);
  assert.deepEqual(body.demoProject, after.demoProject);
  assert.equal(body.updatedAt, after.updatedAt);
  assert.ok(Number.isFinite(Date.parse(after.updatedAt)));
  assert.notEqual(after.updatedAt, before.updatedAt);
  assert.deepEqual({...after, demoProject: before.demoProject, updatedAt: before.updatedAt}, before);
  assert.equal(after.demoProject.contexto.marca, 'norte-brand', 'marca de prospect, no slug');
  assert.equal(after.demoProject.propuestas['store/tpv'], 'Oferta de caja personalizada');
  for (const name of Object.keys(kept)) assert.deepEqual(await read(env, name + ':' + client), kept[name]);
  assert.equal(env.PRESENTATION_IDEAS.writes.filter(w => w.key === 'presentation:' + client).length, 1);
  assert.ok(!env.PRESENTATION_IDEAS.writes.some(w => ['ideas', 'generation', 'image-set'].some(name => w.key === name + ':' + client)));
  const snapshots = env.PRESENTATION_IDEAS.writes.filter(w => w.key.startsWith('version:' + client + ':'));
  assert.equal(snapshots.length, 2, 'historial antes y después');
  assert.deepEqual(snapshots[0].value.values.presentation, before);
  assert.deepEqual(snapshots[1].value.values.presentation, after);
  for (const snapshot of snapshots) for (const name of Object.keys(kept)) assert.deepEqual(snapshot.value.values[name], kept[name]);
  const writeAt = env.PRESENTATION_IDEAS.writes.findIndex(w => w.key === 'presentation:' + client);
  assert.ok(env.PRESENTATION_IDEAS.writes.indexOf(snapshots[0]) < writeAt);
  assert.ok(env.PRESENTATION_IDEAS.writes.indexOf(snapshots[1]) > writeAt);
  assert.equal((await read(env, 'versions:' + client)).versions.length, 2);
  assert.doesNotMatch(JSON.stringify(body), /PRIVATE-TEST-VERIFIER|passwordVerifier/);
});

test('PUT captura catálogo propio y GET mantiene el snapshot aunque cambie el catálogo común', async () => {
  const beforeCatalog = JSON.stringify(GLOBALES), env = environment();
  const catalogo = [{version: 1, plataforma: 'store', subdemos: [{id: 'promo-local', nombre: 'Promoción Norte', desc: 'Caso preparado', url: 'https://www.admira.store/promo', cmd: '/demo 1', caso: {producto: 'Café'}, guion: [{accion: 'di', texto: 'Oferta propia'}]}]}];
  const custom = {id: 'campaign', demos: ['store/promo-local', 'studio/voz'], catalogo, documentacion: [{clave: 'store/promo-local', titulo: 'Inventada', url: 'javascript:alert(1)'}]};
  const response = await request(env, 'PUT', {demoProject: custom, expectedUpdatedAt:updatedAt});
  assert.equal(response.status, 200, await response.clone().text());
  const captured = (await response.json()).demoProject;
  const promotion = captured.documentacion.find(d => d.clave === 'store/promo-local');
  assert.equal(promotion.titulo, 'admira.store · Promoción Norte');
  assert.equal(promotion.url, catalogo[0].subdemos[0].url);
  assert.deepEqual(promotion.caso, {producto: 'Café'});
  assert.equal(JSON.stringify(GLOBALES), beforeCatalog);
  const voice = GLOBALES.find(g => g.id === 'studio').subdemos.find(s => s.id === 'voz');
  const original = {...voice};
  try {
    voice.nombre = 'Catálogo nuevo'; voice.url = 'https://other.test/replacement';
    catalogo[0].subdemos[0].nombre = 'Mutación del objeto enviado';
    assert.deepEqual((await (await request(env)).json()).demoProject, captured);
  } finally {Object.assign(voice, original);}
});

test('PUT requiere permiso booleano canGenerate y mismo origen, incluso para token de agente', async () => {
  for (const options of [{access: null}, {access: {canGenerate: false}}, {access: {canGenerate: 'true'}}, {origin: null}, {origin: 'https://other.test'}, {origin: null, access: {canGenerate: true, via: 'agent-token'}}]) {
    const env = environment(), before = allValues(env);
    const response = await request(env, 'PUT', {demoProject: project()}, options);
    assert.equal(response.status, 403, JSON.stringify(options));
    assert.deepEqual(env.PRESENTATION_IDEAS.writes, []);
    assert.deepEqual(allValues(env), before);
  }
});

test('revisión esperada obsoleta devuelve 409 sin modificar KV ni crear historial', async () => {
  const env = environment(), before = allValues(env);
  const response = await request(env, 'PUT', {demoProject: project(), expectedUpdatedAt: '2026-10-01T00:00:00.000Z'});
  assert.equal(response.status, 409);
  assert.deepEqual(env.PRESENTATION_IDEAS.writes, []);
  assert.deepEqual(allValues(env), before);
});

test('PUT exige revisión explícita y detecta una edición intercalada durante el backup', async () => {
  const missing=environment();
  assert.equal((await request(missing,'PUT',{demoProject:project()})).status,400);
  assert.deepEqual(missing.PRESENTATION_IDEAS.writes,[]);
  const env=environment(),kv=env.PRESENTATION_IDEAS,before=await read(env);
  const edited={...before,updatedAt:'2026-10-07T08:31:00.000Z',theme:{primary:'#445566'},customField:{humanEdit:true}};
  const put=kv.put.bind(kv);let inserted=false;
  kv.put=async(key,value)=>{
    await put(key,value);
    if(!inserted && key.startsWith('version:'+client+':')) {inserted=true;kv.values.set('presentation:'+client,JSON.stringify(edited));}
  };
  const response=await request(env,'PUT',{demoProject:project(),expectedUpdatedAt:updatedAt});
  assert.equal(response.status,409);
  assert.deepEqual(await read(env),edited,'la edición intercalada permanece intacta');
  assert.equal(kv.writes.filter(w=>w.key==='presentation:'+client).length,0);
  assert.equal(kv.writes.filter(w=>w.key.startsWith('version:'+client+':')).length,1,'solo el backup previo');
});

test('selección, catálogo, JSON y contrato de entrada inválidos fallan antes de cualquier escritura', async () => {
  const invalid = [null, [], {}, {demoProject: []}, {demoProject: {demos: ['store/not-found']}}, {demoProject: project(), overwrite: true},
    {demoProject: project(), expectedUpdatedAt: 123}, {demoProject: project(), expectedUpdatedAt: 'x'.repeat(81)},
    {demoProject: {demos: ['studio/voz'], contexto: []}},
    ...['http://unsafe.test/demo', 'javascript:alert(1)', 'https://user:password@unsafe.test/demo'].map(url => ({demoProject: {demos: ['store/promo-local'], catalogo: [{plataforma: 'store', subdemos: [{id: 'promo-local', nombre: 'Unsafe', url}]}]}})),
    {demoProject: {demos: ['studio/voz'], catalogo: [{plataforma: 'unknown', subdemos: []}]}}];
  for (const input of invalid) {
    const payload=input && typeof input==='object' && !Array.isArray(input) ? {expectedUpdatedAt:updatedAt,...input}:input;
    const env = environment(), before = allValues(env);
    const response = await request(env, 'PUT', payload);
    assert.equal(response.status, 400, JSON.stringify(payload));
    assert.deepEqual(env.PRESENTATION_IDEAS.writes, []);
    assert.deepEqual(allValues(env), before);
  }
  const env = environment();
  assert.equal((await request(env, 'PUT', '{bad-json', {raw: true})).status, 400);
  assert.deepEqual(env.PRESENTATION_IDEAS.writes, []);
});

test('límite 256 KiB mide bytes UTF-8 reales y el Content-Length anunciado', async () => {
  const raw = JSON.stringify({demoProject: project(), padding: '🧪'.repeat(70000)});
  assert.ok(raw.length < 256 * 1024);
  assert.ok(new TextEncoder().encode(raw).byteLength > 256 * 1024);
  for (const [body, options] of [[raw, {raw: true}], [{demoProject: project()}, {headers: {'Content-Length': String(256 * 1024 + 1)}}]]) {
    const env = environment(), before = allValues(env);
    assert.equal((await request(env, 'PUT', body, options)).status, 413);
    assert.deepEqual(env.PRESENTATION_IDEAS.writes, []);
    assert.deepEqual(allValues(env), before);
  }
});

test('presentación ausente devuelve 404 para lectura y escritura sin crearla', async () => {
  for (const method of ['GET', 'PUT']) {
    const env = {PRESENTATION_IDEAS: new KV()};
    assert.equal((await request(env, method, method === 'PUT' ? {demoProject: project()} : undefined)).status, 404);
    assert.deepEqual(env.PRESENTATION_IDEAS.writes, []);
    assert.equal(env.PRESENTATION_IDEAS.values.size, 0);
  }
});

test('middleware permits machine editors on demo/offline without telemetry, inline editing or quality controls', async () => {
  const machine='amk_'+ 'K'.repeat(43);
  for(const path of ['demo','offline?format=zip']) {
    const env={...environment(),PRES_MACHINE_KEY:machine,PRES_SIGNING_KEY:'gate-test-key'};
    const pending=[],data={};
    const response=await gate({env,data,request:new Request(origin+'/presentaciones/'+client+'/'+path,{headers:{Accept:'text/html','X-Admira-Machine-Key':machine}}),waitUntil:p=>pending.push(p),next:async()=>new Response('<html><body>PRIVATE DEMO</body></html>',{headers:{'content-type':'text/html'}})});
    await Promise.all(pending);
    assert.equal(response.status,200);
    assert.equal(data.presentationAccess.level,'editor');
    assert.equal(data.presentationAccess.canGenerate,true);
    const html=await response.text();
    assert.match(html,/PRIVATE DEMO/);
    assert.doesNotMatch(html,/presentation-telemetry|presentation-inline-editor|presentation-quality-levels|__ADMIRA_CAN_EDIT__/);
  }
});

test('middleware allows a signed client to read its demo snapshot and blocks changing it', async () => {
  const signing='gate-client-test-key',exp=Math.floor(Date.now()/1000)+120;
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(signing),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const signature=Buffer.from(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(client+':'+exp))).toString('base64url');
  const identity=await makeIdentityToken(signing,{name:'Viewer',email:'viewer@test.invalid'});
  const cookie='pres_'+client+'='+exp+'.'+signature+'; pres_identity='+identity;
  for(const method of ['GET','PUT']) {
    const env={...environment(),PRES_SIGNING_KEY:signing},pending=[],data={};let reached=false;
    const req=new Request(origin+'/presentaciones/'+client+'/api/demo-project',{method,headers:{Cookie:cookie,Accept:'application/json',Origin:origin},...(method==='PUT'?{body:JSON.stringify({demoProject:project()})}:{})});
    const response=await gate({env,data,request:req,waitUntil:p=>pending.push(p),next:async()=>{reached=true;return onRequest({env,data,request:req,params:{client}});}});
    await Promise.all(pending);
    assert.equal(response.status,method==='GET'?200:401);
    assert.equal(reached,method==='GET');
    if(method==='GET') assert.equal((await response.json()).demoProject.id,'old');
    assert.deepEqual(env.PRESENTATION_IDEAS.writes,[]);
  }
});

test('offline downloads record identity and format only after an authorized successful ZIP/PDF response', async () => {
  const machine='amk_'+'D'.repeat(43);
  for(const [format,status,authorized] of [['zip',200,true],['pdf',200,true],['zip',404,true],['pdf',200,false]]) {
    const env={...environment(),PRES_MACHINE_KEY:machine,PRES_SIGNING_KEY:'download-gate-test-key'},pending=[];
    const response=await gate({env,data:{},request:new Request(origin+'/presentaciones/'+client+'/offline?format='+format,{headers:{Accept:'application/'+format,...(authorized?{'X-Admira-Machine-Key':machine}:{})}}),waitUntil:p=>pending.push(p),next:async()=>new Response('FILE',{status,headers:{'content-type':'application/'+format}})});
    await Promise.all(pending);
    assert.equal(response.status,authorized?status:401);
    const events=env.PRESENTATION_IDEAS.writes.filter(w=>w.key.startsWith('access:event:')&&w.value.type==='offline_download');
    assert.equal(events.length,authorized&&status===200?1:0);
    if(events.length) {
      assert.equal(events[0].value.client,client);
      assert.equal(events[0].value.target,format);
      assert.equal(events[0].value.email,'machine@admiranext.com');
      assert.equal(events[0].value.path,'/presentaciones/'+client+'/offline');
    }
  }
});
