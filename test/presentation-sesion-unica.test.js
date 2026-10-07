// UNA SOLA SESIÓN (Carlos, 07-10-2026): la sesión común de AdmiraNeXT (/webmaster)
// abre el generador sin volver a pedir nombre/correo/contraseña, y el login Google del
// generador abre también la sesión común. Los visitantes sin sesión siguen con la puerta.
import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequest} from '../functions/presentaciones/_middleware.js';
import {cookieDeSesion} from '../functions/_webmaster-gate.js';

function fakeDb(users, projects){
  const db = {
    prepare(sql){
      const st = { async run(){ return {}; }, async first(){ return null; }, async all(){ return {results:[]}; }, bind(...args){ return {
        async first(){
          if (/FROM admiranext_users WHERE google_sub=/.test(sql)) return users.find(u => u.google_sub === args[0]) || null;
          if (/FROM admiranext_users WHERE email=\? AND google_sub IS NULL/.test(sql)) return users.find(u => u.email === args[0] && !u.google_sub) || null;
          if (/FROM admiranext_users WHERE email=/.test(sql)) return users.find(u => u.email === args[0]) || null;
          return null;
        },
        async all(){
          if (/FROM admiranext_user_projects WHERE user_email=/.test(sql)) return {results:projects.filter(p => p.user_email === args[0]).map(p => ({project_key:p.project_key}))};
          return {results:[]};
        },
        async run(){ return {}; }
      }; } };
      return st;
    },
    async batch(){ return []; },
    async exec(){ return {}; }
  };
  return db;
}
const users = [
  {email:'csilva@admira.com', display_name:'Carlos Silva', role:'admin', status:'active', session_version:1, google_sub:'sub-carlos'},
  {email:'sinpres@admira.com', display_name:'Sin Pres', role:'viewer', status:'active', session_version:1, google_sub:null}
];
const projects = [{user_email:'csilva@admira.com', project_key:'generador-de-presentaciones'}];
const env = {PRES_SIGNING_KEY:'k-pres', PRES_GENERIC:'1234', PRES_ADMIN:'master', WEBMASTER_SIGNING_KEY:'k-wm', AUTH_DB:fakeDb(users, projects)};
const events = [];
const ctx = (url, options = {}) => ({request:new Request(url, options), env, next:async () => new Response('<html><body>generador</body></html>', {headers:{'content-type':'text/html'}}), waitUntil(p){ events.push(p); }, data:{}});
const jar = (r) => r.headers.getSetCookie().map(v => v.split(';', 1)[0]).join('; ');

test('con la sesión de /webmaster el generador entra directo y persiste la suya', async () => {
  const wm = (await cookieDeSesion(env, users[0])).split(';', 1)[0];
  const r = await onRequest(ctx('https://www.admiranext.com/presentaciones/', {headers:{Cookie:wm, Accept:'text/html'}}));
  assert.equal(r.status, 200);
  assert.match(await r.text(), /generador/);
  const cookies = r.headers.getSetCookie();
  assert.ok(cookies.some(c => c.startsWith('pres_owner=') && c.includes('Max-Age=2592000')));
  assert.ok(cookies.some(c => c.startsWith('pres_identity=')));
  // Visita siguiente sin la cookie común: la propia del generador basta.
  const again = await onRequest(ctx('https://www.admiranext.com/presentaciones/', {headers:{Cookie:jar(r), Accept:'text/html'}}));
  assert.equal(again.status, 200);
  assert.equal(again.headers.getSetCookie().length, 0);
});

test('sin sesión, o con sesión sin el proyecto, sigue la puerta con contraseña', async () => {
  const anon = await onRequest(ctx('https://www.admiranext.com/presentaciones/', {headers:{Accept:'text/html'}}));
  assert.equal(anon.status, 401);
  assert.match(await anon.text(), /type="password"/);
  const wm = (await cookieDeSesion(env, users[1])).split(';', 1)[0];
  const other = await onRequest(ctx('https://www.admiranext.com/presentaciones/', {headers:{Cookie:wm, Accept:'text/html'}}));
  assert.equal(other.status, 401);
  const forged = await onRequest(ctx('https://www.admiranext.com/presentaciones/', {headers:{Cookie:'__Host-an_session=abc.def', Accept:'text/html'}}));
  assert.equal(forged.status, 401);
});

test('el login Google del generador abre también la sesión común', async t => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({aud:'861856772040-e1ri6kpu6maagtb6crdfbb923hsaalgb.apps.googleusercontent.com', email:'csilva@admira.com', email_verified:'true', sub:'sub-carlos', exp:String(Math.floor(Date.now()/1000)+300), name:'Carlos Silva'}));
  const r = await onRequest(ctx('https://www.admiranext.com/presentaciones/', {method:'POST', headers:{'content-type':'application/x-www-form-urlencoded'}, body:new URLSearchParams({intent:'google', credential:'x'})}));
  assert.equal(r.status, 303);
  assert.ok(r.headers.getSetCookie().some(c => c.startsWith('__Host-an_session=')));
});
