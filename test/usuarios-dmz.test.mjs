/*
 * Zona DMZ de /usuarios (Woz · CTO, 19-10-2026). Carlos: «protegidísima, militarizada,
 * porque desde allí se puede hacer de todo». Estas pruebas fijan la puerta en servidor.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { cookieDeSesion, asegurarDirectorio } from '../functions/_webmaster-gate.js';
import { adminsDmz, ventanasDmz, cspPagina, ADMINS_DMZ_POR_DEFECTO } from '../functions/_usuarios-dmz.js';
import { onRequestGet, onRequestPost, onRequestPatch, onRequestDelete as usuariosDelete } from '../functions/api/usuarios.js';
import { onRequestGet as tokensGet, onRequestPost as tokensPost } from '../functions/api/mcp-tokens.js';
import { onRequest as pagina } from '../functions/usuarios.js';
import { onRequestPost as loginToken } from '../functions/api/login-token.js';
import { createToken } from '../functions/mcp/_tokens.js';

class Statement {
  constructor(stmt){ this.stmt=stmt; this.values=[]; }
  bind(...values){ this.values=values; return this; }
  // Como D1 de verdad: todo devuelve promesa (así .catch() funciona igual que en producción).
  async first(){ return this.stmt.get(...this.values) || null; }
  async all(){ return {results:this.stmt.all(...this.values)}; }
  async run(){ const meta=this.stmt.run(...this.values); return {success:true,meta}; }
}
class D1 {
  constructor(){ this.db=new DatabaseSync(':memory:'); }
  prepare(sql){ return new Statement(this.db.prepare(sql)); }
  async batch(statements){ return Promise.all(statements.map((s)=>s.run())); }
}
class KV { constructor(){ this.m=new Map(); } async get(k){ return this.m.has(k)?this.m.get(k):null; } async put(k,v){ this.m.set(k,String(v)); } }

const ORIGIN='https://www.admiranext.com';
const HTML=fs.readFileSync(new URL('../usuarios.html', import.meta.url),'utf8');

async function setup(extra={}){
  const env={AUTH_DB:new D1(),WEBMASTER_SIGNING_KEY:'dmz-test-key',YOKUP_FETCH:async()=>Response.json({ok:true,projects:[]}),...extra};
  await asegurarDirectorio(env);
  // Un tercer admin real en D1 (como en producción) que NO está en la lista DMZ.
  const now=Date.now();
  await env.AUTH_DB.prepare("INSERT INTO admiranext_users(email,display_name,role,status,session_version,created_at,updated_at) VALUES('otroadmin@admira.com','Otro','admin','active',1,?,?)").bind(now,now).run();
  await env.AUTH_DB.prepare("INSERT INTO admiranext_users(email,display_name,role,status,session_version,created_at,updated_at) VALUES('editor@admira.com','Ed','editor','active',1,?,?)").bind(now,now).run();
  return env;
}
async function sesion(env,email='csilva@admira.com',{amr='google',haceMin=0}={}){
  const user=await env.AUTH_DB.prepare('SELECT * FROM admiranext_users WHERE email=?').bind(email).first();
  const real=Date.now; if(haceMin) Date.now=()=>real()-haceMin*60000;
  try{
    const raw=await cookieDeSesion(env,user,amr?{amr}:{});
    const cookie=raw.split(';')[0];
    const body=JSON.parse(Buffer.from(cookie.split('=')[1].split('.')[0],'base64url').toString());
    return {cookie,csrf:body.csrf};
  } finally { Date.now=real; }
}
const get=(path,cookie,headers={})=>new Request(ORIGIN+path,{headers:{cookie,...headers}});
function mut(method,path,{cookie,csrf},body,headers={}){
  return new Request(ORIGIN+path,{method,headers:{cookie,origin:ORIGIN,'X-Admira-CSRF':csrf,'content-type':'application/json','sec-fetch-site':'same-origin','CF-Connecting-IP':'203.0.113.7','user-agent':'dmz-test',...headers},body:JSON.stringify(body)});
}
const alta={email:'nueva@admira.com',role:'viewer',project_keys:['*']};
const auditoria=async(env,action)=>(await env.AUTH_DB.prepare('SELECT * FROM admiranext_user_audit WHERE action=? ORDER BY created_at').bind(action).all()).results;

test('la lista blanca DMZ es por defecto solo los dos correos de Carlos y se cambia por variable de entorno', ()=>{
  assert.deepEqual([...adminsDmz({})].sort(),['csilva@admira.com','csilvasantin@gmail.com']);
  assert.deepEqual([...ADMINS_DMZ_POR_DEFECTO].sort(),['csilva@admira.com','csilvasantin@gmail.com']);
  assert.deepEqual([...adminsDmz({USUARIOS_ADMIN_EMAILS:' CSilva@Admira.com , otro@admira.com;basura '})].sort(),['csilva@admira.com','otro@admira.com']);
  assert.deepEqual([...adminsDmz({USUARIOS_ADMIN_EMAILS:'  , no-es-email'})].sort(),['csilva@admira.com','csilvasantin@gmail.com'],'mal configurada → la de por defecto, nunca abierta');
  assert.deepEqual(ventanasDmz({}),{escrituraMin:15,lecturaMin:480});
  assert.deepEqual(ventanasDmz({USUARIOS_REAUTH_MIN:'999',USUARIOS_LECTURA_MAX_MIN:'1'}),{escrituraMin:30,lecturaMin:15},'la reauth nunca pasa de 30 min');
});

test('sin sesión: API y página cerradas en GET y en cada mutación', async()=>{
  const env=await setup();
  assert.equal((await onRequestGet({request:get('/api/usuarios',''),env})).status,403);
  assert.equal((await onRequestPost({request:mut('POST','/api/usuarios',{cookie:'',csrf:''},alta),env})).status,403);
  assert.equal((await onRequestPatch({request:mut('PATCH','/api/usuarios',{cookie:'',csrf:''},{email:'x@admira.com'}),env})).status,403);
  assert.equal((await tokensGet({request:get('/api/mcp-tokens',''),env})).status,403);
  assert.equal((await usuariosDelete({request:get('/api/usuarios',''),env})).status,405);
  let served=false;
  const r=await pagina({request:get('/usuarios',''),env,next:async()=>{served=true;return new Response(HTML)}});
  assert.equal(r.status,401); assert.equal(served,false,'el HTML del gestor no sale del edge');
});

test('un admin de D1 fuera de la lista DMZ y un editor reciben 403 y queda auditado', async()=>{
  const env=await setup();
  for(const email of ['otroadmin@admira.com','editor@admira.com']){
    const s=await sesion(env,email);
    assert.equal((await onRequestGet({request:get('/api/usuarios',s.cookie),env})).status,403);
    assert.equal((await onRequestPost({request:mut('POST','/api/usuarios',s,alta),env})).status,403);
    let served=false;
    const p=await pagina({request:get('/usuarios',s.cookie),env,next:async()=>{served=true;return new Response(HTML)}});
    assert.equal(p.status,403); assert.equal(served,false);
  }
  const denied=await auditoria(env,'dmz_denied');
  assert.ok(denied.length>=4);
  assert.ok(denied.some((r)=>r.actor_email==='otroadmin@admira.com'&&/fuera_de_lista_dmz/.test(r.detail)));
  assert.ok(denied.some((r)=>r.ip==='203.0.113.7'));
  assert.equal((await env.AUTH_DB.prepare("SELECT COUNT(*) n FROM admiranext_users WHERE email='nueva@admira.com'").first()).n,0);
});

test('USUARIOS_ADMIN_EMAILS manda: quien no está, no entra aunque sea Carlos', async()=>{
  const env=await setup({USUARIOS_ADMIN_EMAILS:'otroadmin@admira.com'});
  assert.equal((await onRequestGet({request:get('/api/usuarios',(await sesion(env,'otroadmin@admira.com')).cookie),env})).status,200);
  assert.equal((await onRequestGet({request:get('/api/usuarios',(await sesion(env)).cookie),env})).status,403);
});

test('una sesión abierta con token anmcp_, heredada de /presentaciones o sin amr no entra en la DMZ', async()=>{
  const env=await setup();
  for(const amr of ['token','google_pres','']){
    const s=await sesion(env,'csilva@admira.com',{amr});
    const r=await onRequestGet({request:get('/api/usuarios',s.cookie),env});
    assert.equal(r.status,401,`amr=${amr||'(ninguno)'}`);
    const d=await r.json(); assert.equal(d.reauth,true); assert.equal(d.reauth_url,'/usuarios?reauth=1');
    assert.equal((await tokensPost({request:mut('POST','/api/mcp-tokens',s,{email:'csilva@admira.com',label:'x'}),env})).status,401,'no se emiten tokens desde una sesión de token');
  }
});

test('login por token MCP emite cookie amr=token y tiene freno por IP', async()=>{
  const env=await setup({PRESENTATION_IDEAS:new KV()});
  const {token}=await createToken(env,{email:'csilva@admira.com',label:'agente',createdBy:'test'});
  const req=(t)=>new Request(ORIGIN+'/api/login-token',{method:'POST',headers:{'content-type':'application/json','CF-Connecting-IP':'198.51.100.9'},body:JSON.stringify({token:t})});
  const r=await loginToken({request:req(token),env,waitUntil(){}});
  assert.equal(r.status,200);
  const cookie=r.headers.get('set-cookie').split(';')[0];
  const body=JSON.parse(Buffer.from(cookie.split('=')[1].split('.')[0],'base64url').toString());
  assert.equal(body.amr,'token');
  assert.equal((await onRequestGet({request:get('/api/usuarios',cookie),env})).status,401,'el token de un agente no abre /usuarios');
  let last;
  for(let i=0;i<25;i++) last=await loginToken({request:req('anmcp_'+'z'.repeat(43)),env,waitUntil(){}});
  assert.equal(last.status,429);
});

test('admin DMZ con Google reciente: GET 200 con cabeceras duras y auditoría con IP', async()=>{
  const env=await setup();
  const s=await sesion(env);
  const r=await onRequestGet({request:get('/api/usuarios',s.cookie),env});
  assert.equal(r.status,200);
  assert.match(r.headers.get('cache-control'),/no-store/);
  assert.match(r.headers.get('x-robots-tag'),/noindex/);
  assert.equal(r.headers.get('x-frame-options'),'DENY');
  assert.match(r.headers.get('content-security-policy'),/frame-ancestors 'none'/);
  assert.equal(r.headers.get('x-content-type-options'),'nosniff');
  const c=await onRequestPost({request:mut('POST','/api/usuarios',s,alta),env});
  assert.equal(c.status,201);
  const fila=(await auditoria(env,'user_created'))[0];
  assert.equal(fila.actor_email,'csilva@admira.com'); assert.equal(fila.target_email,'nueva@admira.com');
  assert.equal(fila.ip,'203.0.113.7'); assert.equal(fila.user_agent,'dmz-test'); assert.ok(fila.created_at>0);
  const d=await (await onRequestGet({request:get('/api/usuarios',s.cookie),env})).json();
  assert.ok(d.audit.some((a)=>a.action==='user_created'&&a.ip==='203.0.113.7'),'el gestor enseña la IP');
});

test('las mutaciones exigen login con Google de menos de 15 min; leer aguanta hasta 8 h', async()=>{
  const env=await setup();
  const viejo=await sesion(env,'csilva@admira.com',{haceMin:20});
  assert.equal((await onRequestGet({request:get('/api/usuarios',viejo.cookie),env})).status,200);
  const r=await onRequestPost({request:mut('POST','/api/usuarios',viejo,alta),env});
  assert.equal(r.status,401); assert.equal((await r.json()).reauth,true);
  assert.equal((await onRequestPatch({request:mut('PATCH','/api/usuarios',viejo,{email:'editor@admira.com',action:'revoke_sessions'}),env})).status,401);
  assert.equal((await tokensPost({request:mut('POST','/api/mcp-tokens',viejo,{email:'csilva@admira.com',label:'x'}),env})).status,401);
  const muyViejo=await sesion(env,'csilva@admira.com',{haceMin:9*60});
  assert.equal((await onRequestGet({request:get('/api/usuarios',muyViejo.cookie),env})).status,401);
  assert.equal((await env.AUTH_DB.prepare("SELECT COUNT(*) n FROM admiranext_users WHERE email='nueva@admira.com'").first()).n,0);
});

test('CSRF: Origin ajeno, Sec-Fetch-Site cross-site, sin cabecera CSRF o sin JSON → rechazado', async()=>{
  const env=await setup();
  const s=await sesion(env);
  assert.equal((await onRequestPost({request:mut('POST','/api/usuarios',s,alta,{origin:'https://evil.example'}),env})).status,403);
  assert.equal((await onRequestPost({request:mut('POST','/api/usuarios',s,alta,{'sec-fetch-site':'cross-site'}),env})).status,403);
  assert.equal((await onRequestPost({request:mut('POST','/api/usuarios',s,alta,{'X-Admira-CSRF':'otro'}),env})).status,403);
  assert.equal((await onRequestPost({request:mut('POST','/api/usuarios',s,alta,{'content-type':'text/plain'}),env})).status,415);
  assert.equal((await env.AUTH_DB.prepare("SELECT COUNT(*) n FROM admiranext_users WHERE email='nueva@admira.com'").first()).n,0);
  assert.match(await cookieDeSesion(env,{email:'a@b.co',role:'admin',session_version:1},{amr:'google'}),/HttpOnly; Secure; SameSite=Strict/);
});

test('freno por IP en escrituras de la DMZ', async()=>{
  const env=await setup({PRESENTATION_IDEAS:new KV()});
  const s=await sesion(env);
  let last;
  for(let i=0;i<31;i++) last=await onRequestPatch({request:mut('PATCH','/api/usuarios',s,{email:'editor@admira.com',action:'revoke_sessions'}),env});
  assert.equal(last.status,429); assert.ok(Number(last.headers.get('retry-after'))>0);
});

test('la página: CSP estricta con hash de cada script inline, ?reauth=1 fuerza Google y solo GET', async()=>{
  const env=await setup();
  const s=await sesion(env);
  const r=await pagina({request:get('/usuarios',s.cookie),env,next:async()=>new Response(HTML,{headers:{'content-type':'text/html','access-control-allow-origin':'*'}})});
  assert.equal(r.status,200);
  const csp=r.headers.get('content-security-policy');
  assert.match(csp,/default-src 'none'/); assert.match(csp,/frame-ancestors 'none'/); assert.match(csp,/object-src 'none'/);
  assert.doesNotMatch(csp.split(';').find((d)=>d.trim().startsWith('script-src')),/unsafe-inline|unsafe-eval|\*/);
  assert.equal((csp.match(/'sha256-/g)||[]).length,(await cspPagina(HTML)).match(/'sha256-/g).length);
  assert.ok((csp.match(/'sha256-/g)||[]).length>=2,'los dos scripts inline del gestor quedan permitidos por hash');
  assert.equal(r.headers.get('access-control-allow-origin'),null);
  assert.match(r.headers.get('cache-control'),/no-store/); assert.match(r.headers.get('x-robots-tag'),/noindex/);
  const re=await pagina({request:get('/usuarios?reauth=1',s.cookie),env,next:async()=>new Response(HTML)});
  assert.equal(re.status,401); assert.match(await re.text(),/accounts\.google\.com\/gsi\/client/);
  const token=await sesion(env,'csilva@admira.com',{amr:'token'});
  const t=await pagina({request:get('/usuarios',token.cookie),env,next:async()=>new Response(HTML)});
  assert.equal(t.status,401); assert.match(await t.text(),/Zona DMZ/);
  assert.equal((await pagina({request:new Request(ORIGIN+'/usuarios',{method:'POST'}),env,next:async()=>new Response(HTML)})).status,405);
});

test('el cliente sabe reverificar: si el servidor pide reauth, avisa de que el cambio no se aplicó', ()=>{
  assert.match(HTML,/function dmzReauth\(d\)/);
  assert.match(HTML,/El cambio NO se ha aplicado/);
  assert.match(HTML,/\/usuarios\?reauth=1/);
});
