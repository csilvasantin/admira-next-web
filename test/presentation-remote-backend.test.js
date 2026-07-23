import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequestPost as createSession} from '../functions/presentaciones/[client]/api/remote/sessions/index.js';
import {onRequestPost as pairSession} from '../functions/presentaciones/[client]/api/remote/sessions/[session]/pair.js';
import {onRequestGet as getState, onRequestPut as putState} from '../functions/presentaciones/[client]/api/remote/sessions/[session]/state.js';
import {onRequestGet as getCommands, onRequestPost as postCommand} from '../functions/presentaciones/[client]/api/remote/sessions/[session]/commands.js';
import {onRequestDelete as revokeSession} from '../functions/presentaciones/[client]/api/remote/sessions/[session]/index.js';
import {onRequest as presentationMiddleware} from '../functions/presentaciones/_middleware.js';

class MemoryKv {
  values = new Map();
  puts = [];
  async get(key, options){
    const value = this.values.get(key);
    if (value === undefined) return null;
    return options?.type === 'json' ? JSON.parse(value) : value;
  }
  async put(key, value, options){
    this.values.set(key, value);
    this.puts.push({key,value,options});
  }
}

const origin = 'https://admiranext.test';
const client = 'demo';

function request(path, {method = 'GET', token = '', body, requestOrigin = origin} = {}){
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (requestOrigin !== null) headers.origin = requestOrigin;
  if (body !== undefined) headers['content-type'] = 'application/json';
  return new Request(`${origin}${path}`, {method,headers,body:body === undefined ? undefined : JSON.stringify(body)});
}

function context(handlerRequest, kv, session = ''){
  return {request:handlerRequest,env:{PRESENTATION_IDEAS:kv},params:{client,session}};
}

async function body(response){
  return response.status === 204 ? null : response.json();
}

async function paired(){
  const kv = new MemoryKv();
  const createdResponse = await createSession(context(request(`/presentaciones/${client}/api/remote/sessions`, {
    method:'POST',body:{ttlSeconds:900}
  }), kv));
  assert.equal(createdResponse.status, 201);
  const created = await body(createdResponse);
  const pairResponse = await pairSession(context(request(`/presentaciones/${client}/api/remote/sessions/${created.sessionId}/pair`, {
    method:'POST',body:{pairingSecret:created.pairingSecret}
  }), kv, created.sessionId));
  assert.equal(pairResponse.status, 200);
  return {kv,created,paired:await body(pairResponse)};
}

test('crea secretos efímeros de alta entropía y KV nunca conserva credenciales en claro',async()=>{
  const kv = new MemoryKv();
  const response = await createSession(context(request(`/presentaciones/${client}/api/remote/sessions`, {
    method:'POST',body:{ttlSeconds:900}
  }), kv));
  assert.equal(response.status,201);
  const value = await body(response);
  assert.match(value.sessionId,/^[A-Za-z0-9_-]{22}$/);
  assert.ok(value.pairingSecret.length >= 32);
  assert.ok(value.stageToken.length >= 43);
  assert.ok(value.expiresAt - Date.now() <= 900000);
  const stored = kv.puts.at(-1).value;
  assert.doesNotMatch(stored,new RegExp(value.pairingSecret));
  assert.doesNotMatch(stored,new RegExp(value.stageToken));
  assert.match(stored,/pairingSecretHash/);
  assert.equal(kv.puts.at(-1).options.expirationTtl <= 900,true);
});

test('rechaza TTL fuera de 15 minutos a 4 horas, origen ajeno y bodies grandes',async()=>{
  for (const ttlSeconds of [899,14401]) {
    const response = await createSession(context(request(`/presentaciones/${client}/api/remote/sessions`, {
      method:'POST',body:{ttlSeconds}
    }), new MemoryKv()));
    assert.equal(response.status,400);
  }
  const foreign = await createSession(context(request(`/presentaciones/${client}/api/remote/sessions`, {
    method:'POST',body:{},requestOrigin:'https://evil.test'
  }), new MemoryKv()));
  assert.equal(foreign.status,403);
  const huge = new Request(`${origin}/presentaciones/${client}/api/remote/sessions`, {
    method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({value:'x'.repeat(5000)})
  });
  assert.equal((await createSession(context(huge,new MemoryKv()))).status,413);
});

test('el secreto de emparejamiento es de un uso y emite un token remoto distinto',async()=>{
  const {kv,created,paired:remote} = await paired();
  assert.notEqual(remote.remoteToken,created.stageToken);
  assert.ok(remote.remoteToken.length >= 43);
  const again = await pairSession(context(request(`/presentaciones/${client}/api/remote/sessions/${created.sessionId}/pair`, {
    method:'POST',body:{pairingSecret:created.pairingSecret}
  }), kv, created.sessionId));
  assert.equal(again.status,409);
  assert.equal((await body(again)).error,'already_paired');
});

test('stage publica solo estado mínimo; remote lo consume y payload privado es rechazado',async()=>{
  const {kv,created,paired:remote} = await paired();
  const path = `/presentaciones/${client}/api/remote/sessions/${created.sessionId}/state`;
  const state = {seq:1,index:2,count:8,elapsed:43.27,running:true,paceLabel:'behind',ackCommandSeq:0};
  const published = await putState(context(request(path,{method:'PUT',token:created.stageToken,body:state}),kv,created.sessionId));
  assert.equal(published.status,200);
  const fetched = await getState(context(request(path,{token:remote.remoteToken}),kv,created.sessionId));
  assert.equal(fetched.status,200);
  assert.deepEqual((await body(fetched)).state,{...state,elapsed:43.3});
  const leaked = await putState(context(request(path,{
    method:'PUT',token:created.stageToken,body:{...state,seq:2,notes:'secreto'}
  }),kv,created.sessionId));
  assert.equal(leaked.status,400);
  const badPace = await putState(context(request(path,{
    method:'PUT',token:created.stageToken,body:{...state,seq:2,paceLabel:'Cliente ACME'}
  }),kv,created.sessionId));
  assert.equal(badPace.status,400);
});

test('comandos usan allowlist, secuencia idempotente y ack del stage',async()=>{
  const {kv,created,paired:remote} = await paired();
  const commandsPath = `/presentaciones/${client}/api/remote/sessions/${created.sessionId}/commands`;
  const statePath = `/presentaciones/${client}/api/remote/sessions/${created.sessionId}/state`;
  const sent = await postCommand(context(request(commandsPath,{
    method:'POST',token:remote.remoteToken,body:{seq:1,command:'next'}
  }),kv,created.sessionId));
  assert.equal(sent.status,202);
  const duplicate = await postCommand(context(request(commandsPath,{
    method:'POST',token:remote.remoteToken,body:{seq:1,command:'next'}
  }),kv,created.sessionId));
  assert.equal(duplicate.status,202);
  const listed = await getCommands(context(request(`${commandsPath}?after=0`,{token:created.stageToken}),kv,created.sessionId));
  assert.deepEqual((await body(listed)).commands,[{seq:1,command:'next'}]);
  const state = {seq:1,index:1,count:5,elapsed:8,running:true,paceLabel:'on-time',ackCommandSeq:1};
  assert.equal((await putState(context(request(statePath,{method:'PUT',token:created.stageToken,body:state}),kv,created.sessionId))).status,200);
  const afterAck = await getCommands(context(request(`${commandsPath}?after=0`,{token:created.stageToken}),kv,created.sessionId));
  assert.deepEqual((await body(afterAck)).commands,[]);
  const forbidden = await postCommand(context(request(commandsPath,{
    method:'POST',token:remote.remoteToken,body:{seq:2,command:'show-notes'}
  }),kv,created.sessionId));
  assert.equal(forbidden.status,400);
});

test('acota frecuencia de escrituras y tamaño de mensajes tras autenticar el rol',async()=>{
  const {kv,created,paired:remote} = await paired();
  const commandsPath = `/presentaciones/${client}/api/remote/sessions/${created.sessionId}/commands`;
  assert.equal((await postCommand(context(request(commandsPath,{
    method:'POST',token:remote.remoteToken,body:{seq:1,command:'next'}
  }),kv,created.sessionId))).status,202);
  const rushed = await postCommand(context(request(commandsPath,{
    method:'POST',token:remote.remoteToken,body:{seq:2,command:'prev'}
  }),kv,created.sessionId));
  assert.equal(rushed.status,429);
  assert.equal((await body(rushed)).retryAfterMs,100);

  const huge = new Request(`${origin}/presentaciones/${client}/api/remote/sessions/${created.sessionId}/state`, {
    method:'PUT',
    headers:{origin,authorization:`Bearer ${created.stageToken}`,'content-type':'application/json'},
    body:JSON.stringify({value:'x'.repeat(5000)})
  });
  assert.equal((await putState(context(huge,kv,created.sessionId))).status,413);
});

test('rechaza sesión caducada, replay y secuencias antiguas sin duplicar comandos',async()=>{
  const {kv,created,paired:remote} = await paired();
  const commandsPath = `/presentaciones/${client}/api/remote/sessions/${created.sessionId}/commands`;
  const statePath = `/presentaciones/${client}/api/remote/sessions/${created.sessionId}/state`;

  assert.equal((await postCommand(context(request(commandsPath,{
    method:'POST',token:remote.remoteToken,body:{seq:2,command:'next'}
  }),kv,created.sessionId))).status,202);
  const key = [...kv.values.keys()][0];
  const session = JSON.parse(kv.values.get(key));
  session.rate['remote-write'] = 0;
  kv.values.set(key,JSON.stringify(session));

  const stale = await postCommand(context(request(commandsPath,{
    method:'POST',token:remote.remoteToken,body:{seq:1,command:'prev'}
  }),kv,created.sessionId));
  assert.equal(stale.status,409);
  assert.deepEqual(await body(stale),{error:'stale_seq',acceptedSeq:2});
  const listed = await getCommands(context(request(`${commandsPath}?after=0`,{
    token:created.stageToken
  }),kv,created.sessionId));
  assert.deepEqual((await body(listed)).commands,[{seq:2,command:'next'}]);

  const expired = JSON.parse(kv.values.get(key));
  expired.expiresAt = Date.now() - 1;
  kv.values.set(key,JSON.stringify(expired));
  const gone = await getState(context(request(statePath,{token:remote.remoteToken}),kv,created.sessionId));
  assert.equal(gone.status,410);
  assert.equal((await body(gone)).error,'expired');
});

test('un cliente sin rol queda aislado y las respuestas nunca filtran secretos ni contenido privado',async()=>{
  const {kv,created,paired:remote} = await paired();
  const commandsPath = `/presentaciones/${client}/api/remote/sessions/${created.sessionId}/commands`;
  const statePath = `/presentaciones/${client}/api/remote/sessions/${created.sessionId}/state`;
  const state = {seq:1,index:0,count:3,elapsed:2,running:true,paceLabel:'on-time',ackCommandSeq:0};
  assert.equal((await putState(context(request(statePath,{
    method:'PUT',token:created.stageToken,body:state
  }),kv,created.sessionId))).status,200);

  assert.equal((await getState(context(request(statePath),kv,created.sessionId))).status,401);
  assert.equal((await getCommands(context(request(commandsPath),kv,created.sessionId))).status,401);
  assert.equal((await postCommand(context(request(commandsPath,{
    method:'POST',body:{seq:1,command:'next'}
  }),kv,created.sessionId))).status,401);

  const visible = await getState(context(request(statePath,{token:remote.remoteToken}),kv,created.sessionId));
  const serialized = JSON.stringify(await body(visible));
  for (const forbidden of [
    created.stageToken,created.pairingSecret,remote.remoteToken,
    'stageTokenHash','remoteTokenHash','pairingSecretHash','notes','teleprompter'
  ]) assert.equal(serialized.includes(forbidden),false);
});

test('roles no son intercambiables y revocar deja un tombstone 410',async()=>{
  const {kv,created,paired:remote} = await paired();
  const statePath = `/presentaciones/${client}/api/remote/sessions/${created.sessionId}/state`;
  const commandsPath = `/presentaciones/${client}/api/remote/sessions/${created.sessionId}/commands`;
  assert.equal((await getState(context(request(statePath,{token:created.stageToken}),kv,created.sessionId))).status,401);
  assert.equal((await getCommands(context(request(commandsPath,{token:remote.remoteToken}),kv,created.sessionId))).status,401);
  const revoked = await revokeSession(context(request(`/presentaciones/${client}/api/remote/sessions/${created.sessionId}`,{
    method:'DELETE',token:created.stageToken
  }),kv,created.sessionId));
  assert.equal(revoked.status,204);
  const gone = await getState(context(request(statePath,{token:remote.remoteToken}),kv,created.sessionId));
  assert.equal(gone.status,410);
  assert.equal((await body(gone)).error,'revoked');
  const stored = kv.puts.at(-1).value;
  assert.doesNotMatch(stored,new RegExp(created.stageToken));
  assert.doesNotMatch(stored,new RegExp(remote.remoteToken));
});

test('middleware exige login al crear y deja pasar solo endpoints protegidos por secreto efímero',async()=>{
  let reached = false;
  const creation = await presentationMiddleware({
    request:request(`/presentaciones/${client}/api/remote/sessions`,{method:'POST',body:{}}),
    env:{},
    next(){ reached = true; return new Response('next'); }
  });
  assert.equal(reached,false);
  assert.equal(creation.status,503);

  const pair = await presentationMiddleware({
    request:request(`/presentaciones/${client}/api/remote/sessions/abcdefghijklmnopqrstuv/pair`,{
      method:'POST',body:{pairingSecret:'x'.repeat(32)}
    }),
    env:{},
    next(){ reached = true; return new Response('next'); }
  });
  assert.equal(reached,true);
  assert.equal(await pair.text(),'next');
});
