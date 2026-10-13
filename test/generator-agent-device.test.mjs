import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {asegurarDirectorio} from '../functions/_webmaster-gate.js';
import {createToken} from '../functions/mcp/_tokens.js';
import {onRequest as deviceLogin} from '../functions/presentaciones/auth/device.js';
import {onRequest as gate} from '../functions/presentaciones/_middleware.js';
import {onRequest as staging} from '../functions/pruebas/_middleware.js';
import {DEVICE_PATH,DEVICE_COOKIE,DEVICE_INIT_COOKIE,DEVICE_TTL} from '../functions/presentaciones/_agent-device.js';

class DB{
  constructor(){this.db=new DatabaseSync(':memory:');}
  prepare(sql){const statement=this.db.prepare(sql);let args=[];return {bind(...values){args=values;return this;},async first(){return statement.get(...args)||null;},async all(){return {results:statement.all(...args)};},async run(){return statement.run(...args);}};}
  async batch(statements){return Promise.all(statements.map(s=>s.run()));}
}
const origin='https://www.admiranext.com';
const request=(path,init={})=>new Request(origin+path,init);
const pairs=response=>response.headers.getSetCookie().map(s=>s.split(';')[0]).filter(s=>!s.endsWith('=')).join('; ');
async function setup(){
  const env={AUTH_DB:new DB(),WEBMASTER_SIGNING_KEY:'test-web',PRES_SIGNING_KEY:'test-pres',PRES_GENERIC:'1234'};
  await asegurarDirectorio(env);
  const {token,row}=await createToken(env,{email:'csilva@admira.com',label:'Trinity test',createdBy:'test'});
  return {env,token,row};
}
const invoke=(env,req)=>deviceLogin({env,request:req,waitUntil:p=>p.catch(()=>{})});
async function begin(env){
  const page=await invoke(env,request(DEVICE_PATH)),html=await page.text(),boot=pairs(page);
  assert.equal(page.status,200);
  const csrf=/const csrf="([A-Za-z0-9_-]{43})"/.exec(html)?.[1];assert.ok(csrf);
  const started=await post(env,'start',{cookie:boot,'X-Admira-Device-CSRF':csrf});
  assert.equal(started.status,200);
  const value=await started.json();
  return {code:value.code,csrf,cookie:pairs(started),page,html};
}
function post(env,action,headers={},body={}){
  return invoke(env,request(DEVICE_PATH+'?action='+action,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...headers},body:JSON.stringify(body)}));
}
const approve=(env,token,code)=>post(env,'approve',{Authorization:'Bearer '+token},{code});
const browser=(env,action,d,extra={})=>post(env,action,{cookie:d.cookie,'X-Admira-Device-CSRF':d.csrf,...extra});
const protectedRequest=(handler,env,path,cookies)=>handler({request:request(path,{headers:{cookie:cookies,Accept:'text/html'}}),env,data:{},params:{},waitUntil:p=>p.catch(()=>{}),next:async()=>new Response('private content')});

test('device page has no credentials in its URL, uses CSP nonces, and opens only its own auth route',async()=>{
  const {env}=await setup();const d=await begin(env);
  assert.match(d.code,/^[A-HJ-NP-Z2-9]{5}-[A-HJ-NP-Z2-9]{5}$/);
  assert.match(d.page.headers.get('set-cookie'),new RegExp(DEVICE_INIT_COOKIE+'='));
  assert.match(d.page.headers.get('set-cookie'),/Path=\/presentaciones\/auth\/device; Max-Age=300; HttpOnly; Secure; SameSite=Strict/);
  assert.equal(d.page.headers.get('referrer-policy'),'no-referrer');
  const nonce=/script nonce="([A-Za-z0-9_-]+)"/.exec(d.html)?.[1];assert.ok(nonce);
  assert.ok(d.page.headers.get('content-security-policy').includes("script-src 'nonce-"+nonce+"'"));
  assert.doesNotMatch(d.html,/anmcp_|Bearer|localStorage|sessionStorage/);
  assert.match(d.html,/credentials:'same-origin'/);
  assert.equal((await protectedRequest(gate,env,DEVICE_PATH,'')).status,200);
  assert.equal((await protectedRequest(gate,env,DEVICE_PATH+'/unexpected','')).status,401);
  assert.equal((await protectedRequest(staging,env,'/pruebas/alsea/','')).status,401);
});

test('approved browser gets the existing one-hour cookies with current ACL and no other staging access',async()=>{
  const {env,token}=await setup(),d=await begin(env);
  assert.deepEqual(await (await browser(env,'poll',d)).json(),{state:'pending'});
  assert.equal((await browser(env,'consume',d)).status,409);
  assert.equal((await approve(env,token,d.code)).status,200);
  assert.deepEqual(await (await browser(env,'poll',d)).json(),{state:'approved'});
  const done=await browser(env,'consume',d),value=await done.json(),cookies=pairs(done);
  assert.equal(done.status,200);assert.equal(value.expiresIn,3600);assert.equal(value.next,'/pruebas/alsea/?lang=es');
  const headers=done.headers.getSetCookie();assert.equal(headers.length,3);
  assert.match(headers[0],/^pres_agent=.*Path=\/presentaciones; Max-Age=3600; HttpOnly; Secure; SameSite=Lax$/);
  assert.match(headers[1],/^alsea_agent=.*Path=\/pruebas\/alsea; Max-Age=3600; HttpOnly; Secure; SameSite=Lax$/);
  assert.match(headers[2],new RegExp('^'+DEVICE_COOKIE+'=;.*Max-Age=0;'));
  assert.doesNotMatch(cookies,new RegExp(token));
  assert.equal((await protectedRequest(gate,env,'/presentaciones/galeria',cookies)).status,200);
  assert.equal((await protectedRequest(staging,env,'/pruebas/alsea/',cookies)).status,200);
  assert.equal((await protectedRequest(staging,env,'/pruebas/frontier/',cookies)).status,401);
  assert.equal((await protectedRequest(gate,env,'/presentaciones/control/',cookies)).status,401);
  const stored=await env.AUTH_DB.prepare('SELECT * FROM admiranext_agent_devices').first();
  assert.equal(stored.expires_at-stored.created_at,DEVICE_TTL*1000);
  assert.doesNotMatch(JSON.stringify(stored),new RegExp(token));
  assert.doesNotMatch(JSON.stringify(stored),new RegExp(d.code.replace('-','')));
});

test('start requires same-origin POST, the initial HttpOnly cookie and a matching CSRF nonce',async()=>{
  const {env}=await setup(),page=await invoke(env,request(DEVICE_PATH)),html=await page.text(),cookie=pairs(page),csrf=/const csrf="([A-Za-z0-9_-]{43})"/.exec(html)[1];
  for(const headers of [
    {cookie,'X-Admira-Device-CSRF':csrf,Origin:'https://foreign.example'},
    {cookie,'X-Admira-Device-CSRF':csrf,Origin:''},
    {'X-Admira-Device-CSRF':csrf},
    {cookie,'X-Admira-Device-CSRF':'x'.repeat(43)},
    {cookie:cookie+'; '+cookie,'X-Admira-Device-CSRF':csrf}
  ])assert.equal((await post(env,'start',headers)).status,403);
  assert.equal((await invoke(env,request(DEVICE_PATH+'?action=start'))).status,405);
});

test('a different browser, missing private nonce, or missing CSRF cannot poll or consume an approved code',async()=>{
  const {env,token}=await setup(),d=await begin(env),other=await begin(env);await approve(env,token,d.code);
  for(const action of ['poll','consume']){
    for(const headers of [
      {cookie:'','X-Admira-Device-CSRF':d.csrf},
      {cookie:d.cookie,'X-Admira-Device-CSRF':''},
      {cookie:d.cookie,'X-Admira-Device-CSRF':other.csrf},
      {cookie:d.cookie.replace(/\.[A-Za-z0-9_-]{43}$/,'.'+'a'.repeat(43)),'X-Admira-Device-CSRF':d.csrf},
      {cookie:d.cookie+'; '+d.cookie,'X-Admira-Device-CSRF':d.csrf},
      {cookie:d.cookie,'X-Admira-Device-CSRF':d.csrf,Origin:'https://foreign.example'},
      {cookie:d.cookie,'X-Admira-Device-CSRF':d.csrf,Origin:''}
    ])assert.equal((await post(env,action,headers)).status,403,action);
  }
  assert.deepEqual(await (await browser(env,'poll',other)).json(),{state:'pending'});
  assert.equal((await browser(env,'consume',other)).status,409);
  assert.equal((await browser(env,'consume',d)).status,200);
});

test('the visible code alone cannot approve, and a valid Bearer requires no human cookie',async()=>{
  const {env,token}=await setup(),d=await begin(env);
  for(const headers of [{},{Authorization:'Bearer anmcp_invalid'},{cookie:d.cookie}])assert.equal((await post(env,'approve',headers,{code:d.code})).status,401);
  assert.equal((await post(env,'approve',{Authorization:'Bearer '+token,Origin:'https://foreign.example'},{code:d.code})).status,403);
  const response=await invoke(env,request(DEVICE_PATH+'?action=approve',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({code:d.code})}));
  assert.equal(response.status,200);assert.equal(response.headers.getSetCookie().length,0);
});

test('revocation and ACL changes before approval or completion never issue a session',async()=>{
  const changes=[
    async(env,row)=>env.AUTH_DB.prepare('UPDATE admiranext_mcp_tokens SET revoked_at=1 WHERE id=?').bind(row.id).run(),
    async(env,row)=>env.AUTH_DB.prepare("UPDATE admiranext_users SET role='viewer' WHERE email=?").bind(row.email).run(),
    async(env,row)=>env.AUTH_DB.prepare("UPDATE admiranext_users SET status='suspended' WHERE email=?").bind(row.email).run(),
    async(env,row)=>env.AUTH_DB.prepare('DELETE FROM admiranext_user_projects WHERE user_email=?').bind(row.email).run()
  ];
  for(const change of changes){
    for(const afterApproval of [false,true]){
      const {env,token,row}=await setup(),d=await begin(env);
      if(afterApproval)assert.equal((await approve(env,token,d.code)).status,200);
      await change(env,row);
      const denied=afterApproval?await browser(env,'consume',d):await approve(env,token,d.code);
      assert.equal(denied.status,401);assert.equal(denied.headers.getSetCookie().length,0);
      if(afterApproval)assert.equal((await browser(env,'consume',d)).status,409);
    }
  }
});

test('expiry, approval replay and consumption replay fail closed',async()=>{
  const {env,token}=await setup(),d=await begin(env);
  assert.equal((await approve(env,token,d.code)).status,200);
  assert.equal((await approve(env,token,d.code)).status,409);
  assert.equal((await browser(env,'consume',d)).status,200);
  assert.equal((await browser(env,'consume',d)).status,409);
  const expired=await begin(env);
  await env.AUTH_DB.prepare('UPDATE admiranext_agent_devices SET expires_at=?').bind(Date.now()-1).run();
  assert.equal((await approve(env,token,expired.code)).status,409);
  assert.equal((await browser(env,'poll',expired)).status,410);
  assert.equal((await browser(env,'consume',expired)).status,410);
});

test('concurrent approvals and completions admit exactly one winner each',async()=>{
  const {env,token}=await setup(),d=await begin(env);
  const approvals=await Promise.all([approve(env,token,d.code),approve(env,token,d.code)]);
  assert.deepEqual(approvals.map(r=>r.status).sort(),[200,409]);
  const completions=await Promise.all([browser(env,'consume',d),browser(env,'consume',d)]);
  assert.deepEqual(completions.map(r=>r.status).sort(),[200,409]);
  assert.equal(completions.filter(r=>r.headers.getSetCookie().some(c=>c.startsWith('pres_agent='))).length,1);
});

test('tokens revoked after device completion also invalidate the resulting Alsea session',async()=>{
  const {env,token,row}=await setup(),d=await begin(env);await approve(env,token,d.code);
  const done=await browser(env,'consume',d),cookies=pairs(done);assert.equal(done.status,200);
  await env.AUTH_DB.prepare('UPDATE admiranext_mcp_tokens SET revoked_at=1 WHERE id=?').bind(row.id).run();
  assert.equal((await protectedRequest(gate,env,'/presentaciones/galeria',cookies)).status,401);
  assert.equal((await protectedRequest(staging,env,'/pruebas/alsea/',cookies)).status,401);
});

test('challenge creation uses the existing rate brake without treating IP as authorization',async()=>{
  const {env}=await setup(),store=new Map();env.PRESENTATION_IDEAS={get:async key=>store.get(key)||null,put:async(key,value)=>store.set(key,value)};
  const page=await invoke(env,request(DEVICE_PATH)),html=await page.text(),csrf=/const csrf="([A-Za-z0-9_-]{43})"/.exec(html)[1],cookie=pairs(page);
  const headers={cookie,'X-Admira-Device-CSRF':csrf,'CF-Connecting-IP':'192.0.2.10'};
  for(let n=0;n<12;n++)assert.equal((await post(env,'start',headers)).status,200);
  const limited=await post(env,'start',headers);assert.equal(limited.status,429);assert.ok(Number(limited.headers.get('retry-after'))>0);
  assert.equal((await protectedRequest(staging,env,'/pruebas/alsea/','')).status,401);
});

test('unsupported methods, oversized or non-JSON bodies and unavailable bindings do not grant access',async()=>{
  const {env}=await setup();
  assert.equal((await invoke({},request(DEVICE_PATH))).status,503);
  assert.equal((await post(env,'unexpected')).status,400);
  assert.equal((await post(env,'approve',{}, {code:'x'.repeat(600)})).status,413);
  assert.equal((await invoke(env,request(DEVICE_PATH+'?action=approve',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'code=ABCDE-FGHJK'}))).status,400);
  assert.equal((await invoke(env,request(DEVICE_PATH,{method:'DELETE'}))).status,405);
});
