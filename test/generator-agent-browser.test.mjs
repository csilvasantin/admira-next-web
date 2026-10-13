import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {asegurarDirectorio} from '../functions/_webmaster-gate.js';
import {createToken} from '../functions/mcp/_tokens.js';
import {onRequest as login} from '../functions/presentaciones/auth/agent.js';
import {onRequest as gate} from '../functions/presentaciones/_middleware.js';
import {onRequest as staging} from '../functions/pruebas/_middleware.js';
import {agentBrowserSessionFromRequest} from '../functions/presentaciones/_agent-token.js';
class DB{
  constructor(){this.db=new DatabaseSync(':memory:');}
  prepare(sql){const statement=this.db.prepare(sql);let args=[];return {bind(...values){args=values;return this;},async first(){return statement.get(...args)||null;},async all(){return {results:statement.all(...args)};},async run(){return statement.run(...args);}};}
  async batch(statements){return Promise.all(statements.map(s=>s.run()));}
}
async function setup(){
  const env={AUTH_DB:new DB(),WEBMASTER_SIGNING_KEY:'test-web',PRES_SIGNING_KEY:'test-pres',PRES_GENERIC:'1234'};
  await asegurarDirectorio(env);
  const {token,row}=await createToken(env,{email:'csilva@admira.com',label:'Trinity test',createdBy:'test'});
  return {env,token,row};
}
const request=(path,init={})=>new Request('https://www.admiranext.com'+path,init);
async function session(env,token,form=false){
  const init=form?{method:'POST',headers:{Origin:'https://www.admiranext.com','Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({token}).toString()}:{method:'POST',headers:{Authorization:'Bearer '+token}};
  const response=await login({request:request('/presentaciones/auth/agent',init),env,waitUntil(){}});
  return {response,cookies:response.headers.getSetCookie().map(s=>s.split(';')[0]).join('; ')};
}
const protectedRequest=(handler,env,path,cookies)=>handler({request:request(path,{headers:{cookie:cookies,Accept:'text/html'}}),env,data:{},params:{},waitUntil(){},next:async()=>new Response('private content')});
test('browser sign-in reports the result through a nonce-protected same-origin client',async()=>{
  const response=await login({request:request('/presentaciones/auth/agent'),env:{}}),html=await response.text();
  const nonce=/script nonce="([a-f0-9]+)"/.exec(html)?.[1];assert.ok(nonce);
  assert.ok(response.headers.get('content-security-policy').includes("script-src 'nonce-"+nonce+"'"));
  assert.match(html,/role="status"/);assert.match(html,/location.assign\(d.next\)/);
});
test('existing MCP editor token opens a short browser session without exposing the credential',async()=>{
  const {env,token}=await setup();const {response,cookies}=await session(env,token);
  assert.equal(response.status,200);assert.equal((await response.json()).expiresIn,3600);
  assert.doesNotMatch(cookies,new RegExp(token));
  const headers=response.headers.getSetCookie();assert.equal(headers.length,2);
  for(const value of headers)assert.match(value,/HttpOnly; Secure; SameSite=Lax/);
  assert.match(headers[0],/Path=\/presentaciones;/);assert.match(headers[1],/Path=\/pruebas\/alsea;/);
  assert.equal((await protectedRequest(gate,env,'/presentaciones/galeria',cookies)).status,200);
  assert.equal((await protectedRequest(staging,env,'/pruebas/alsea/',cookies)).status,200);
  assert.equal((await protectedRequest(staging,env,'/pruebas/frontier/',cookies)).status,401);
  assert.equal((await protectedRequest(gate,env,'/presentaciones/control/',cookies)).status,401);
});
test('form sign-in redirects only to Alsea and rejects foreign origins or invalid credentials',async()=>{
  const {env,token}=await setup();const {response}=await session(env,token,true);
  assert.equal(response.status,303);assert.equal(response.headers.get('Location'),'/pruebas/alsea/');
  const bad=await session(env,'anmcp_invalid');assert.equal(bad.response.status,401);
  const foreign=await login({request:request('/presentaciones/auth/agent',{method:'POST',headers:{Origin:'https://evil.example',Authorization:'Bearer '+token}}),env});
  assert.equal(foreign.status,403);
  const noOrigin=await login({request:request('/presentaciones/auth/agent',{method:'POST',body:new URLSearchParams({token}).toString()}),env});
  assert.equal(noOrigin.status,403);
});
test('revocation, role downgrade and account deactivation terminate a browser session immediately',async()=>{
  for(const change of ['revoked','viewer','inactive']){
    const {env,token,row}=await setup();const {cookies}=await session(env,token);
    if(change==='revoked')await env.AUTH_DB.prepare('UPDATE admiranext_mcp_tokens SET revoked_at=1 WHERE id=?').bind(row.id).run();
    if(change==='viewer')await env.AUTH_DB.prepare("UPDATE admiranext_users SET role='viewer' WHERE email=?").bind(row.email).run();
    if(change==='inactive')await env.AUTH_DB.prepare("UPDATE admiranext_users SET status='suspended' WHERE email=?").bind(row.email).run();
    assert.equal(await agentBrowserSessionFromRequest(env,request('/presentaciones/galeria',{headers:{cookie:cookies}})),null,change);
    assert.equal((await protectedRequest(staging,env,'/pruebas/alsea/',cookies)).status,401,change);
  }
});
test('tampering or extending the signed expiry cannot create a session',async()=>{
  const {env,token}=await setup();const {cookies}=await session(env,token);
  for(const broken of [cookies.replace(/=\d+\./,'=1.'),cookies.replace(/=\d+\./,'=9999999999.'),cookies.replace(/pres_agent=/,'pres_agent=x')]){
    assert.equal(await agentBrowserSessionFromRequest(env,request('/presentaciones/galeria',{headers:{cookie:broken}})),null);
  }
});
