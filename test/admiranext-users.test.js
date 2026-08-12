import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { cookieDeSesion, cookiesBorradas, sesionCompleta, csrfValido, asegurarDirectorio, respuestaLogin, loginCsrfValido, verificarGoogle } from '../functions/_webmaster-gate.js';
import { onRequestGet, onRequestPost, onRequestPatch } from '../functions/api/usuarios.js';

class Statement {
  constructor(stmt){ this.stmt=stmt; this.values=[]; }
  bind(...values){ this.values=values; return this; }
  first(){ return this.stmt.get(...this.values) || null; }
  all(){ return {results:this.stmt.all(...this.values)}; }
  run(){ const meta=this.stmt.run(...this.values); return {success:true,meta}; }
}
class D1 {
  constructor(){ this.db=new DatabaseSync(':memory:'); }
  exec(sql){ this.db.exec(sql); return {count:1}; }
  prepare(sql){ return new Statement(this.db.prepare(sql)); }
}
const KEY='users-test-signing-key';
async function setup(){ const env={AUTH_DB:new D1(),WEBMASTER_SIGNING_KEY:KEY}; await asegurarDirectorio(env); return env; }
async function auth(env,email='csilva@admira.com'){
  const user=await env.AUTH_DB.prepare('SELECT * FROM admiranext_users WHERE email=?').bind(email).first();
  const raw=await cookieDeSesion(env,user); return raw.split(';')[0];
}
async function current(env,cookie){ return sesionCompleta(new Request('https://www.admiranext.com/usuarios',{headers:{cookie}}),env); }
function request(method,cookie,csrf,body){ return new Request('https://www.admiranext.com/api/usuarios',{method,headers:{cookie,origin:'https://www.admiranext.com','X-Admira-CSRF':csrf,'content-type':'application/json'},body:body&&JSON.stringify(body)}); }

test('bootstrap crea exactamente los dos administradores de recuperación',async()=>{
  const env=await setup(); const rows=await env.AUTH_DB.prepare('SELECT email,role,status FROM admiranext_users ORDER BY email').all();
  assert.deepEqual(rows.results.map((row)=>({...row})),[
    {email:'csilva@admira.com',role:'admin',status:'active'},
    {email:'csilvasantin@gmail.com',role:'admin',status:'active'},
  ]);
});

test('cookie tiene audiencia propia, SameSite Strict y CSRF ligado a sesión',async()=>{
  const env=await setup(),cookie=await auth(env),me=await current(env,cookie);
  assert.equal(me.email,'csilva@admira.com'); assert.equal(me.role,'admin'); assert.ok(me.csrf.length>20);
  assert.match(await cookieDeSesion(env,await env.AUTH_DB.prepare('SELECT * FROM admiranext_users WHERE email=?').bind(me.email).first()),/__Host-an_session=.*SameSite=Strict/);
  assert.equal(csrfValido(request('PATCH',cookie,me.csrf,{}),me),true);
  assert.equal(csrfValido(new Request('https://www.admiranext.com/api/usuarios',{method:'PATCH',headers:{cookie,origin:'https://evil.example','X-Admira-CSRF':me.csrf}}),me),false);
  assert.equal(cookiesBorradas().length,3);
});

test('el POST de Google exige desafío de login same-origin ligado a cookie',async()=>{
  const response=respuestaLogin('', '/usuarios');
  const setCookie=response.headers.get('set-cookie');
  const token=setCookie.match(/__Host-an_login_csrf=([^;]+)/)[1];
  const ok=new Request('https://www.admiranext.com/webmaster',{method:'POST',headers:{origin:'https://www.admiranext.com',cookie:`__Host-an_login_csrf=${token}`}});
  assert.equal(loginCsrfValido(ok,token),true);
  const cross=new Request('https://www.admiranext.com/webmaster',{method:'POST',headers:{origin:'https://evil.example',cookie:`__Host-an_login_csrf=${token}`}});
  assert.equal(loginCsrfValido(cross,token),false);
  assert.match(await response.text(),new RegExp(`name="login_csrf" value="${token}"`));
});

async function googleToken(claims={}) {
  const pair=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
  const header=Buffer.from(JSON.stringify({alg:'RS256',kid:'test-key'})).toString('base64url');
  const now=Math.floor(Date.now()/1000), payload=Buffer.from(JSON.stringify({sub:'google-subject-1',email:'csilva@admira.com',email_verified:true,hd:'admira.com',aud:'861856772040-e1ri6kpu6maagtb6crdfbb923hsaalgb.apps.googleusercontent.com',iss:'https://accounts.google.com',iat:now-1,exp:now+300,...claims})).toString('base64url');
  const signature=Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',pair.privateKey,new TextEncoder().encode(header+'.'+payload))).toString('base64url');
  const jwk=await crypto.subtle.exportKey('jwk',pair.publicKey); return {token:header+'.'+payload+'.'+signature,jwk:{...jwk,kid:'test-key',alg:'RS256'}};
}

test('Google se verifica por firma local, issuer, audiencia y sub sin poner el token en una URL',async()=>{
  const signed=await googleToken(); let seen;
  const identity=await verificarGoogle(signed.token,async(url,options)=>{seen={url,options};return Response.json({keys:[signed.jwk]})});
  assert.deepEqual(identity,{email:'csilva@admira.com',sub:'google-subject-1'});
  assert.equal(seen.url,'https://www.googleapis.com/oauth2/v3/certs');
  assert.equal(seen.url.includes(signed.token),false);
  const wrong=await googleToken({aud:'otro-cliente'});
  assert.equal(await verificarGoogle(wrong.token,async()=>Response.json({keys:[wrong.jwk]})),null);
});

test('admin crea usuario, cambia rol y revoca inmediatamente la cookie anterior',async()=>{
  const env=await setup(),cookie=await auth(env),me=await current(env,cookie);
  let response=await onRequestPost({request:request('POST',cookie,me.csrf,{email:'editor@example.com',display_name:'Editor',role:'editor'}),env});
  assert.equal(response.status,201);
  const editorCookie=await auth(env,'editor@example.com'); assert.equal((await current(env,editorCookie)).role,'editor');
  response=await onRequestPatch({request:request('PATCH',cookie,me.csrf,{email:'editor@example.com',role:'viewer'}),env});
  assert.equal(response.status,200); assert.equal(await current(env,editorCookie),null);
  const audit=await env.AUTH_DB.prepare("SELECT action FROM admiranext_user_audit WHERE target_email='editor@example.com' ORDER BY created_at").all();
  assert.deepEqual(audit.results.map(x=>x.action),['user_created','user_updated']);
});

test('lector no administra y una mutación sin Origin+CSRF exactos falla cerrada',async()=>{
  const env=await setup(),adminCookie=await auth(env),admin=await current(env,adminCookie);
  await onRequestPost({request:request('POST',adminCookie,admin.csrf,{email:'reader@example.com',role:'viewer'}),env});
  const viewerCookie=await auth(env,'reader@example.com');
  const denied=await onRequestGet({request:new Request('https://www.admiranext.com/api/usuarios',{headers:{cookie:viewerCookie}}),env});
  assert.equal(denied.status,403);
  const noCsrf=await onRequestPatch({request:request('PATCH',adminCookie,'wrong',{email:'reader@example.com',status:'suspended'}),env});
  assert.equal(noCsrf.status,403);
});

test('nadie puede retirar su propia administración ni dejar cero administradores',async()=>{
  const env=await setup(),cookie=await auth(env),me=await current(env,cookie);
  let r=await onRequestPatch({request:request('PATCH',cookie,me.csrf,{email:me.email,status:'suspended'}),env});
  assert.equal(r.status,409);
  await env.AUTH_DB.prepare("UPDATE admiranext_users SET status='suspended' WHERE email=?").bind('csilvasantin@gmail.com').run();
  r=await onRequestPatch({request:request('PATCH',cookie,me.csrf,{email:me.email,role:'viewer'}),env});
  assert.equal(r.status,409); assert.match((await r.json()).error,/propia|último/);
});

test('revocar sesiones incrementa versión e invalida sólo al usuario objetivo',async()=>{
  const env=await setup(),cookie=await auth(env),me=await current(env,cookie),other=await auth(env,'csilvasantin@gmail.com');
  const r=await onRequestPatch({request:request('PATCH',cookie,me.csrf,{email:'csilvasantin@gmail.com',action:'revoke_sessions'}),env});
  assert.equal(r.status,200); assert.equal(await current(env,other),null); assert.ok(await current(env,cookie));
});
