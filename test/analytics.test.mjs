import test from 'node:test';
import assert from 'node:assert/strict';
import {period,buildQuery,catalogue,summarise,readAnalytics} from '../functions/_analytics.js';
import {returnToSeguro} from '../functions/_webmaster-gate.js';
const now=new Date('2026-10-02T12:00:00Z');
test('periodo incluye hoy UTC y no acepta consultas sin límite',()=>{assert.equal(period(7,now).start,'2026-09-26T00:00:00.000Z');assert.throws(()=>period(999,now));assert.equal(period(1,now).start,'2026-10-02T00:00:00.000Z')});
test('www y dominio raíz se agregan; previews no se suman',()=>{const map=summarise([{count:5,sum:{visits:2},dimensions:{requestHost:'www.admira.app'}},{count:2,sum:{visits:1},dimensions:{requestHost:'admira.app'}},{count:100,sum:{visits:99},dimensions:{requestHost:'abc.pages.dev'}}]);assert.deepEqual(map.get('admira.app'),{host:'admira.app',visits:3,pageviews:7});assert.equal(map.size,1)});
test('separar medición configurada, observada y pendiente',()=>{const c=catalogue([{domains:['digitalsignage.ai'],build_config:{}}],[{ruleset:{zone_name:'admira.studio',enabled:true}}],[{dimensions:{requestHost:'www.pixeria.com'}}]);assert.equal(c.find(x=>x.host==='digitalsignage.ai').configured,false);assert.equal(c.find(x=>x.host==='admira.studio').configured,true);assert.equal(c.find(x=>x.host==='pixeria.com').configured,true)});
test('consulta sin bots, filtro limitado y login vuelve al panel',()=>{const q=buildQuery('account',period(7,now),'admira.app');assert.match(q,/bot:0/);assert.match(q,/requestHost_in:\["admira.app","www.admira.app"\]/);assert.equal(returnToSeguro('/analitics'),'/analitics');assert.equal(returnToSeguro('https://malicious.test'),'/webmaster')});
test('falta de permisos produce error, nunca un total cero',async()=>{const fetchImpl=async()=>new Response(JSON.stringify({errors:[{message:'permission denied'}]}));await assert.rejects(readAnalytics({CF_ACCOUNT_ID:'a',CF_API_TOKEN:'secret'},7,'',fetchImpl,now));});
test('reporte conserva nulos en sites pendientes y rellena días vacíos',async()=>{const fetchImpl=async(url)=>new Response(JSON.stringify(url.endsWith('/graphql')?{data:{viewer:{accounts:[{hosts:[{count:3,sum:{visits:2},dimensions:{requestHost:'www.admira.app'}}],daily:[{count:3,sum:{visits:2},dimensions:{date:'2026-10-02',requestHost:'www.admira.app'}}]}]}}}:{success:true,result:[]}));const r=await readAnalytics({CF_ACCOUNT_ID:'a',CF_API_TOKEN:'secret'},7,'',fetchImpl,now);assert.equal(r.totals.visits,2);assert.equal(r.series.length,7);assert.equal(r.series[0].visits,0);assert.equal(r.sites.find(s=>s.host==='digitalsignage.ai').visits,null);assert.equal(JSON.stringify(r).includes('secret'),false)});
import {onRequestGet} from '../functions/api/analitics.js';
import {onRequest as pageRequest} from '../functions/analitics/_middleware.js';
import {cookieDeSesion,asegurarDirectorio} from '../functions/_webmaster-gate.js';
import {DatabaseSync} from 'node:sqlite';
class Statement {constructor(s){this.s=s;this.v=[]}bind(...v){this.v=v;return this}first(){return this.s.get(...this.v)||null}all(){return {results:this.s.all(...this.v)}}run(){return this.s.run(...this.v)}}
class D1 {constructor(){this.db=new DatabaseSync(':memory:')}exec(sql){this.db.exec(sql)}prepare(sql){return new Statement(this.db.prepare(sql))}}
test('ni API ni página entregan datos sin sesión; un editor no accede al grupo',async()=>{
  const env={AUTH_DB:new D1(),WEBMASTER_SIGNING_KEY:'test-only-key'};await asegurarDirectorio(env);
  const request=new Request('https://www.admiranext.com/api/analitics');assert.equal((await onRequestGet({request,env})).status,401);
  const page=await pageRequest({request:new Request('https://www.admiranext.com/analitics'),env,next:()=>{throw Error('no debe servir el panel')}});assert.equal(page.status,401);
  env.AUTH_DB.prepare("UPDATE admiranext_users SET role='editor' WHERE email=?").bind('csilva@admira.com').run();
  const user=env.AUTH_DB.prepare('SELECT * FROM admiranext_users WHERE email=?').bind('csilva@admira.com').first();const cookie=(await cookieDeSesion(env,user)).split(';')[0];
  assert.equal((await onRequestGet({request:new Request(request,{headers:{cookie}}),env})).status,403);
});
test('última hora utiliza buckets de minuto y no pierde cobertura histórica',async()=>{
 const fetchImpl=async(url)=>new Response(JSON.stringify(url.endsWith('/graphql')?{data:{viewer:{accounts:[{hosts:[],daily:[{count:2,sum:{visits:1},dimensions:{datetimeMinute:'2026-10-02T11:45:00Z',requestHost:'www.admira.app'}}],coverageWeek:[{dimensions:{requestHost:'www.admira.app'}}],coverageMonth:[]} ]}}}:{success:true,result:[]}));
 const r=await readAnalytics({CF_ACCOUNT_ID:'a',CF_API_TOKEN:'secret'},0,'',fetchImpl,now);
 assert.equal(r.range.resolution,'minute');assert.equal(r.series.length,60);assert.equal(r.series.find(x=>x.date==='2026-10-02T11:45:00.000Z').visits,1);assert.equal(r.sites.find(x=>x.host==='admira.app').configured,true);
 assert.match(buildQuery('a',period(0,now)),/datetimeMinute requestHost/);
});
test('Carbono y Silicio filtran todas las consultas y juntos incluyen ambos',()=>{
 const range=period(7,now);
 assert.match(buildQuery('a',range,'','carbono'),/bot:0/);
 assert.match(buildQuery('a',range,'','silicio'),/bot:1/);
 assert.doesNotMatch(buildQuery('a',range,'','ambos'),/bot:/);
});
