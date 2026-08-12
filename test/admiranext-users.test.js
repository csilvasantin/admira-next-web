import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { cookieDeSesion, cookiesBorradas, sesionCompleta, csrfValido, asegurarDirectorio, buscarUsuarioIdentidad, crearDesafioLogin, consumirDesafioLogin, respuestaLogin, respuestaContinuacion, loginCsrfValido, verificarGoogle } from '../functions/_webmaster-gate.js';
import { onRequest as webmasterRequest } from '../functions/webmaster.js';
import { onRequest as usuariosPageRequest } from '../functions/usuarios.js';
import { onRequestGet, onRequestPost, onRequestPatch } from '../functions/api/usuarios.js';
import { onRequestGet as getProjects, onRequestPatch as patchProject } from '../functions/api/proyectos.js';
import { onRequestGet as getHistory } from '../functions/api/historial.js';
import { catalogoProyectos, proyectoPermitido } from '../functions/_project-access.js';
import { PROYECTOS } from '../functions/_proyectos.js';
import fs from 'node:fs';

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
  async batch(statements){ return Promise.all(statements.map((statement)=>statement.run())); }
}
const KEY='users-test-signing-key';

test('el binding AUTH_DB forma parte del despliegue canónico, incluido GitHub Actions',()=>{
  const config=JSON.parse(fs.readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8'));
  assert.deepEqual(config.d1_databases,[{binding:'AUTH_DB',database_name:'admiranext-auth',database_id:'1568f825-4dfb-40a9-ac40-c6776ee62b3e'}]);
});
async function setup(){ const env={AUTH_DB:new D1(),WEBMASTER_SIGNING_KEY:KEY,YOKUP_FETCH:async()=>Response.json({ok:true,projects:[]})}; await asegurarDirectorio(env); return env; }
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
  const access=await env.AUTH_DB.prepare('SELECT user_email,project_key FROM admiranext_user_projects ORDER BY user_email').all();
  assert.deepEqual(access.results.map((row)=>({...row})),[
    {user_email:'csilva@admira.com',project_key:'*'},
    {user_email:'csilvasantin@gmail.com',project_key:'*'},
  ]);
});

test('el catálogo une todos los proyectos de Webmaster y Yokup sin duplicados',async()=>{
  const catalog=await catalogoProyectos({YOKUP_FETCH:async()=>Response.json({ok:true,projects:[
    {id:'admiranext',name:'AdmiraNeXT',web:'https://www.admiranext.com'},
    {id:'nuevo-yokup',name:'Nuevo Yokup',web:'https://nuevo.example'},
  ]})});
  assert.equal(catalog.complete,true);
  assert.equal(catalog.projects.length,PROYECTOS.length+1);
  assert.equal(catalog.projects.filter((p)=>p.key==='admiranext').length,1);
  assert.equal(catalog.projects.find((p)=>p.key==='admiranext-webmaster').depth,1);
  assert.equal(catalog.projects.find((p)=>p.key==='nuevo-yokup').source,'yokup');
  assert.equal(proyectoPermitido(['admiranext'],'admiranext-webmaster'),true);
  assert.equal(proyectoPermitido(['admiranext'],'yokup'),false);
  assert.equal(proyectoPermitido(['*'],'yokup'),true);
});

test('cookie tiene audiencia propia, SameSite Strict y CSRF ligado a sesión',async()=>{
  const env=await setup(),cookie=await auth(env),me=await current(env,cookie);
  assert.equal(me.email,'csilva@admira.com'); assert.equal(me.role,'admin'); assert.ok(me.csrf.length>20);
  assert.match(await cookieDeSesion(env,await env.AUTH_DB.prepare('SELECT * FROM admiranext_users WHERE email=?').bind(me.email).first()),/__Host-an_session=.*SameSite=Strict/);
  assert.equal(csrfValido(request('PATCH',cookie,me.csrf,{}),me),true);
  assert.equal(csrfValido(new Request('https://www.admiranext.com/api/usuarios',{method:'PATCH',headers:{cookie,origin:'https://evil.example','X-Admira-CSRF':me.csrf}}),me),false);
  assert.equal(cookiesBorradas().length,4);
});

test('el POST de Google exige desafío de login same-origin ligado a cookie',async()=>{
  const env=await setup();
  const token=crypto.randomUUID();
  const nonce=crypto.randomUUID();
  const own=`__Host-an_login_nonce=${nonce}`;
  const ok=new Request('https://www.admiranext.com/webmaster',{method:'POST',headers:{origin:'https://www.admiranext.com',cookie:`g_csrf_token=${token}; ${own}`}});
  assert.equal(loginCsrfValido(ok,token,nonce),true);
  const google=new Request('https://www.admiranext.com/webmaster',{method:'POST',headers:{origin:'https://accounts.google.com',cookie:`g_csrf_token=${token}; ${own}`}});
  assert.equal(loginCsrfValido(google,token,nonce),true);
  const omitted=new Request('https://www.admiranext.com/webmaster',{method:'POST',headers:{cookie:`g_csrf_token=${token}; ${own}`}});
  assert.equal(loginCsrfValido(omitted,token,nonce),true);
  const opaque=new Request('https://www.admiranext.com/webmaster',{method:'POST',headers:{origin:'null',cookie:`g_csrf_token=${token}; ${own}`}});
  assert.equal(loginCsrfValido(opaque,token,nonce),true);
  const cross=new Request('https://www.admiranext.com/webmaster',{method:'POST',headers:{origin:'https://evil.example',cookie:`g_csrf_token=${token}; ${own}`}});
  assert.equal(loginCsrfValido(cross,token,nonce),false);
  assert.equal(loginCsrfValido(opaque,token,'otro-nonce-de-longitud-suficiente-123456'),false,'el par oficial nunca sustituye la cookie nonce ligada al JWT');
  assert.equal(loginCsrfValido(new Request('https://www.admiranext.com/webmaster',{method:'POST',headers:{origin:'null',cookie:own}}),'',nonce),true,'cookie HttpOnly + nonce JWT sostienen el redirect cuando GIS omite g_csrf');
  const badOfficial=new Request('https://www.admiranext.com/webmaster',{method:'POST',headers:{origin:'null',cookie:`g_csrf_token=${token}; ${own}`}});
  assert.equal(loginCsrfValido(badOfficial,'otro-token-oficial-de-longitud-suficiente-123',nonce),false,'si Google entrega el par oficial también debe coincidir');
  const duplicated=new Request('https://www.admiranext.com/webmaster',{method:'POST',headers:{origin:'null',cookie:`g_csrf_token=otro-token-oficial-de-longitud-suficiente-123; g_csrf_token=${token}; ${own}`}});
  assert.equal(loginCsrfValido(duplicated,token,nonce),true,'una cookie vieja de otra ruta no pisa el par oficial válido');
  const html=await (await respuestaLogin(env, '', '/usuarios')).text();
  assert.match(html,/data-ux_mode="redirect"/);
  assert.match(html,/data-login_uri="https:\/\/www\.admiranext\.com\/webmaster"/);
  assert.doesNotMatch(html,/data-login_uri="[^"]*[?&]|return_to/);
  assert.doesNotMatch(html,/data-callback|credential.*hidden/);
  const response=await respuestaLogin(env, '', '/usuarios'),setCookie=response.headers.get('set-cookie');
  const issuedNonce=setCookie.match(/__Host-an_login_nonce=([^;]+)/)[1];
  assert.match(setCookie,/HttpOnly; Secure; SameSite=None/);
  assert.match(await response.text(),new RegExp(`data-nonce="${issuedNonce}"`));
  assert.doesNotMatch(setCookie,/usuarios|webmaster/, 'el destino queda en D1, no en la cookie');
});

test('el retorno de login vive en D1, expira y se consume una sola vez',async()=>{
  const env=await setup(),now=Date.now();
  const ok=await crearDesafioLogin(env,'/usuarios',now);
  assert.equal(ok.return_to,'/usuarios');
  assert.equal(await consumirDesafioLogin(env,ok.nonce,now+1),'/usuarios');
  assert.equal(await consumirDesafioLogin(env,ok.nonce,now+2),null,'replay fail-closed');
  const expired=await crearDesafioLogin(env,'/webmaster',now);
  assert.equal(await consumirDesafioLogin(env,expired.nonce,now+10*60*1000+1),null);
  const unsafe=await crearDesafioLogin(env,'https://evil.example',now);
  assert.equal(await consumirDesafioLogin(env,unsafe.nonce,now+1),'/webmaster');
  for (const value of ['//evil.example','/%2F%2Fevil.example','/usuarios?next=https://evil.example','',null]) {
    const challenge=await crearDesafioLogin(env,value,now);
    assert.equal(await consumirDesafioLogin(env,challenge.nonce,now+1),'/webmaster');
  }
  const concurrent=await crearDesafioLogin(env,'/usuarios',now);
  const results=await Promise.all([
    consumirDesafioLogin(env,concurrent.nonce,now+1),
    consumirDesafioLogin(env,concurrent.nonce,now+1)
  ]);
  assert.equal(results.filter((value)=>value==='/usuarios').length,1);
  assert.equal(results.filter((value)=>value===null).length,1);
});

test('/webmaster y /usuarios publican exactamente el mismo callback bare',async()=>{
  const env=await setup();
  const webmaster=await webmasterRequest({
    request:new Request('https://www.admiranext.com/webmaster?return_to=%2Fusuarios'),env,
    next:async()=>new Response('no debe servirse')
  });
  const usuarios=await usuariosPageRequest({
    request:new Request('https://www.admiranext.com/usuarios'),env,
    next:async()=>new Response('no debe servirse')
  });
  assert.equal(webmaster.status,401);
  assert.equal(usuarios.status,401);
  for (const response of [webmaster,usuarios]) {
    const html=await response.text();
    assert.match(html,/data-login_uri="https:\/\/www\.admiranext\.com\/webmaster"/);
    assert.doesNotMatch(html,/data-login_uri="[^"]*[?&]/);
  }
});

test('la continuación activa la cookie Strict antes de abrir el destino seguro',async()=>{
  const response=respuestaContinuacion('/usuarios');
  assert.equal(response.status,200);
  assert.equal(response.headers.get('refresh'),'0;url=/usuarios');
  assert.match(await response.text(),/http-equiv="refresh" content="0;url=\/usuarios"/);
  assert.equal(respuestaContinuacion('https://evil.example').headers.get('refresh'),'0;url=/webmaster');
});

async function googleToken(claims={}) {
  const pair=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
  const header=Buffer.from(JSON.stringify({alg:'RS256',kid:'test-key'})).toString('base64url');
  const now=Math.floor(Date.now()/1000), payload=Buffer.from(JSON.stringify({sub:'google-subject-1',email:'csilva@admira.com',email_verified:true,hd:'admira.com',aud:'861856772040-e1ri6kpu6maagtb6crdfbb923hsaalgb.apps.googleusercontent.com',iss:'https://accounts.google.com',iat:now-1,exp:now+300,nonce:'login-nonce',...claims})).toString('base64url');
  const signature=Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',pair.privateKey,new TextEncoder().encode(header+'.'+payload))).toString('base64url');
  const jwk=await crypto.subtle.exportKey('jwk',pair.publicKey); return {token:header+'.'+payload+'.'+signature,jwk:{...jwk,kid:'test-key',alg:'RS256'}};
}

test('Google se verifica por firma local, issuer, audiencia y sub sin poner el token en una URL',async()=>{
  const signed=await googleToken(); let seen;
  const identity=await verificarGoogle(signed.token,async(url,options)=>{seen={url,options};return Response.json({keys:[signed.jwk]})});
  assert.deepEqual(identity,{email:'csilva@admira.com',sub:'google-subject-1',nonce:'login-nonce'});
  assert.equal(seen.url,'https://www.googleapis.com/oauth2/v3/certs');
  assert.equal(seen.url.includes(signed.token),false);
  const wrong=await googleToken({aud:'otro-cliente'});
  assert.equal(await verificarGoogle(wrong.token,async()=>Response.json({keys:[wrong.jwk]})),null);
  for (const claims of [{iss:'https://evil.example'},{exp:1},{iat:Math.floor(Date.now()/1000)+120},{email_verified:false},{sub:''}]) {
    const bad=await googleToken(claims);
    assert.equal(await verificarGoogle(bad.token,async()=>Response.json({keys:[bad.jwk]})),null);
  }
});

async function callbackRequest(env,email,returnTo,sub) {
  const login=await respuestaLogin(env,'',returnTo),nonce=login.headers.get('set-cookie').match(/__Host-an_login_nonce=([^;]+)/)[1];
  const csrf=crypto.randomUUID(),signed=await googleToken({email,sub,nonce,hd:email.endsWith('@admira.com')?'admira.com':undefined});
  const form=new URLSearchParams({credential:signed.token,return_to:'https://evil.example'});
  const request=()=>new Request('https://www.admiranext.com/webmaster?return_to=%2Fevil',{method:'POST',headers:{origin:'null','content-type':'application/x-www-form-urlencoded',cookie:`__Host-an_login_nonce=${nonce}`},body:form});
  const previous=globalThis.fetch;globalThis.fetch=async()=>Response.json({keys:[signed.jwk]});
  try{return {response:await webmasterRequest({request:request(),env,next:async()=>new Response('no')}),request,jwk:signed.jwk};}
  finally{globalThis.fetch=previous;}
}

test('Webmaster y Usuarios comparten callback bare y autentican ambas cuentas permitidas',async()=>{
  const env=await setup();
  for (const [email,destination,sub] of [['csilva@admira.com','/webmaster','sub-admira'],['csilvasantin@gmail.com','/usuarios','sub-gmail']]) {
    const {response}=await callbackRequest(env,email,destination,sub);
    assert.equal(response.status,200);
    assert.equal(response.headers.get('refresh'),`0;url=${destination}`);
    assert.match(response.headers.get('set-cookie'),/__Host-an_session=.*HttpOnly; Secure; SameSite=Strict/);
    const body=await response.text();
    assert.doesNotMatch(body,/credential|google-subject|csilva@|return_to/i);
  }
});

test('el callback ignora return_to de query/form y rechaza replay',async()=>{
  const env=await setup();
  const {response,request,jwk}=await callbackRequest(env,'csilva@admira.com','/usuarios','sub-replay');
  assert.equal(response.headers.get('refresh'),'0;url=/usuarios');
  const previous=globalThis.fetch;
  try {
    // El token ya fue validado una vez; el desafío durable consumido impide reutilizarlo.
    const original=await request();
    globalThis.fetch=async()=>Response.json({keys:[jwk]});
    const replay=await webmasterRequest({request:original,env,next:async()=>new Response('no')});
    assert.notEqual(replay.status,200);
  } finally { globalThis.fetch=previous; }
});

test('la credencial sólo se lee del POST y nunca entra en URL, respuesta o logs',async()=>{
  const source=fs.readFileSync(new URL('../functions/webmaster.js',import.meta.url),'utf8');
  assert.match(source,/request\.formData\(\)/);
  assert.match(source,/form\.get\('credential'\)/);
  assert.doesNotMatch(source,/searchParams\.get\(['"]credential|console\.[^(]+\([^\n]*credential/);
  assert.doesNotMatch(source,/form\.get\(['"]return_to|searchParams\.get\(['"]return_to[^\n]*POST/);
});

test('una cuenta suspendida no recibe sesión aunque Google la verifique',async()=>{
  const env=await setup();
  await env.AUTH_DB.prepare("UPDATE admiranext_users SET status='suspended' WHERE email=?").bind('csilvasantin@gmail.com').run();
  const {response}=await callbackRequest(env,'csilvasantin@gmail.com','/usuarios','sub-suspended');
  assert.equal(response.status,401);
  assert.doesNotMatch(response.headers.get('set-cookie') || '',/__Host-an_session=/);
  assert.match(await response.text(),/no está activo/);
  const audit=await env.AUTH_DB.prepare("SELECT action,detail FROM admiranext_user_audit WHERE target_email=?").bind('csilvasantin@gmail.com').all();
  assert.deepEqual(audit.results.map((row)=>({...row})),[{action:'login_denied',detail:'suspended'}]);
});

test('tras el primer enlace Google reconoce el sub inmutable aunque cambie el correo',async()=>{
  const env=await setup();
  await env.AUTH_DB.prepare('UPDATE admiranext_users SET google_sub=? WHERE email=?').bind('google-subject-1','csilva@admira.com').run();
  const user=await buscarUsuarioIdentidad(env,{sub:'google-subject-1',email:'nuevo-correo@admira.com'});
  assert.equal(user.email,'csilva@admira.com');
  assert.equal(await buscarUsuarioIdentidad(env,{sub:'otro-sub',email:'csilva@admira.com'}),null);
});

test('admin crea usuario, cambia rol y revoca inmediatamente la cookie anterior',async()=>{
  const env=await setup(),cookie=await auth(env),me=await current(env,cookie);
  let response=await onRequestPost({request:request('POST',cookie,me.csrf,{email:'editor@example.com',display_name:'Editor',role:'editor',project_keys:['admiranext']}),env});
  assert.equal(response.status,201);
  const editorCookie=await auth(env,'editor@example.com'); const editor=await current(env,editorCookie);assert.equal(editor.role,'editor');assert.deepEqual(editor.project_keys,['admiranext']);
  response=await onRequestPatch({request:request('PATCH',cookie,me.csrf,{email:'editor@example.com',role:'viewer',project_keys:['yokup']}),env});
  assert.equal(response.status,200); assert.equal(await current(env,editorCookie),null);
  const audit=await env.AUTH_DB.prepare("SELECT action FROM admiranext_user_audit WHERE target_email='editor@example.com'").all();
  assert.deepEqual(audit.results.map(x=>x.action).sort(),['user_created','user_updated']);
});

test('lector no administra y una mutación sin Origin+CSRF exactos falla cerrada',async()=>{
  const env=await setup(),adminCookie=await auth(env),admin=await current(env,adminCookie);
  await onRequestPost({request:request('POST',adminCookie,admin.csrf,{email:'reader@example.com',role:'viewer',project_keys:['yokup']}),env});
  const viewerCookie=await auth(env,'reader@example.com');
  const denied=await onRequestGet({request:new Request('https://www.admiranext.com/api/usuarios',{headers:{cookie:viewerCookie}}),env});
  assert.equal(denied.status,403);
  const noCsrf=await onRequestPatch({request:request('PATCH',adminCookie,'wrong',{email:'reader@example.com',status:'suspended'}),env});
  assert.equal(noCsrf.status,403);
});

test('un alta exige proyectos censados y GET devuelve el censo y los permisos',async()=>{
  const env=await setup(),cookie=await auth(env),me=await current(env,cookie);
  let response=await onRequestPost({request:request('POST',cookie,me.csrf,{email:'none@example.com',role:'viewer',project_keys:[]}),env});
  assert.equal(response.status,422);
  response=await onRequestPost({request:request('POST',cookie,me.csrf,{email:'bad@example.com',role:'viewer',project_keys:['inventado']}),env});
  assert.equal(response.status,422);
  response=await onRequestGet({request:request('GET',cookie,me.csrf),env});
  const body=await response.json();
  assert.equal(body.ok,true);assert.ok(body.projects.length>=PROYECTOS.length);assert.equal(body.catalog_complete,true);
  assert.deepEqual(body.users.find((user)=>user.email===me.email).project_keys,['*']);
});

test('Webmaster sólo entrega y permite modificar los proyectos autorizados',async()=>{
  const env=await setup(),adminCookie=await auth(env),admin=await current(env,adminCookie);
  await onRequestPost({request:request('POST',adminCookie,admin.csrf,{email:'scoped@example.com',role:'editor',project_keys:['admiranext']}),env});
  const cookie=await auth(env,'scoped@example.com'),me=await current(env,cookie),original=globalThis.fetch;
  globalThis.fetch=async()=>Response.json([]);
  try{
    const response=await getProjects({request:new Request('https://www.admiranext.com/api/proyectos?parte=retornos',{headers:{cookie}}),env});
    const body=await response.json();
    assert.equal(body.accessRestricted,undefined);
    assert.deepEqual(body.proyectos.map((p)=>p.clave),['admiranext','admiranext-webmaster','generador-presupuestos']);
    const denied=await patchProject({request:new Request('https://www.admiranext.com/api/proyectos',{method:'PATCH',headers:{cookie,origin:'https://www.admiranext.com','X-Admira-CSRF':me.csrf,'content-type':'application/json'},body:JSON.stringify({clave:'yokup',responsable:'NeoMacMini'})}),env:{...env,PRESENTATION_IDEAS:{put:async()=>{throw Error('no debe escribir')}}}});
    assert.equal(denied.status,403);assert.equal((await denied.json()).error,'proyecto no autorizado');
    const history=await getHistory({request:new Request('https://www.admiranext.com/api/historial?p=yokup',{headers:{cookie}}),env});
    assert.equal(history.status,403);assert.equal((await history.json()).error,'proyecto no autorizado');
  }finally{globalThis.fetch=original}
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
