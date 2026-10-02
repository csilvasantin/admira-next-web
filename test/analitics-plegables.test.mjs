import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {DatabaseSync} from 'node:sqlite';
import {buildQuery,period} from '../functions/_analytics.js';
import {onRequestGet} from '../functions/api/analitics.js';
import {cookieDeSesion,asegurarDirectorio} from '../functions/_webmaster-gate.js';
import {globeLocations,countryBars} from '../analitics/globe-model.mjs';

// GUARDIÁN DE LOS PLEGABLES Y LA CARGA DIFERIDA DE /analitics (FLT-101380, 2-oct-2026).
// Encargo de Carlos: países en barras de mayor a menor; «Cómo llegan y con qué se
// conectan» (y sus cuatro cuadrantes), «Silicio más allá del navegador» y «Rendimiento
// por site» plegables y plegados por defecto, sin scroll vertical al desplegar, y sus
// datos sin pedir hasta que se despliegan.

const leer = rel => readFile(new URL('../' + rel, import.meta.url), 'utf8');
const now = new Date('2026-10-02T12:00:00Z');

// --- API por partes ----------------------------------------------------------------
class Statement {constructor(s){this.s=s;this.v=[]}bind(...v){this.v=v;return this}first(){return this.s.get(...this.v)||null}all(){return {results:this.s.all(...this.v)}}run(){return this.s.run(...this.v)}}
class D1 {constructor(){this.db=new DatabaseSync(':memory:')}exec(sql){this.db.exec(sql)}prepare(sql){return new Statement(this.db.prepare(sql))}}
async function directorio(account) {
  const env={AUTH_DB:new D1(),WEBMASTER_SIGNING_KEY:'test-only-key',CF_ACCOUNT_ID:account,CF_API_TOKEN:'test-only-token'};
  await asegurarDirectorio(env);
  const user=env.AUTH_DB.prepare('SELECT * FROM admiranext_users WHERE email=?').bind('csilva@admira.com').first();
  return {env,cookie:(await cookieDeSesion(env,user)).split(';')[0]};
}
const pedir = (env,cookie,query) => onRequestGet({request:new Request('https://www.admiranext.com/api/analitics'+query,{headers:cookie?{cookie}:{}}),env});

// Cloudflare simulado: cuenta llamadas GraphQL (RUM y HTTP) y REST.
function cloudflareFalso({zones=3,fail=false}={}) {
  const calls=[];
  const fetchImpl=async(url,init={})=>{
    const body=init.body?JSON.parse(init.body):null, query=body?.query || '';
    const kind=url.endsWith('/graphql')?(query.includes('httpRequestsAdaptiveGroups')?'graphql-http':'graphql-rum'):'rest';
    calls.push({kind,url,query});
    if (fail) return new Response(JSON.stringify({errors:[{message:'denied'}]}));
    if (kind==='rest') return new Response(JSON.stringify({success:true,result:url.includes('/zones?')?Array.from({length:zones},(_,i)=>({id:'z'+i,name:'zona'+i+'.test'})):[]}));
    if (kind==='graphql-http') return new Response(JSON.stringify({data:{viewer:{zones:[{httpRequestsAdaptiveGroups:[{count:7,dimensions:{clientRequestHTTPHost:'admira.app',userAgent:'GPTBot'}}]}]}}}));
    const rows=d=>[{count:3,sum:{visits:2},dimensions:{requestHost:'www.admira.app',...d}}];
    return new Response(JSON.stringify({data:{viewer:{accounts:[{hosts:rows({}),coverageWeek:[],coverageMonth:[],geography:rows({countryName:'ES'}),daily:rows({date:'2026-10-02'}),referrers:rows({refererHost:'google.com',refererPath:'/',refererScheme:'https'}),devices:rows({deviceType:'desktop'}),browsers:rows({userAgentBrowser:'Chrome'}),systems:rows({userAgentOS:'MacOSX'})}]}}}));
  };
  return {calls,fetchImpl,count:kind=>calls.filter(c=>c.kind===kind).length,reset:()=>calls.splice(0)};
}
async function conFetch(fake,fn){const original=globalThis.fetch;globalThis.fetch=fake.fetchImpl;try{return await fn()}finally{globalThis.fetch=original}}

test('la consulta del resumen no lleva detalle; la del detalle sólo lleva detalle', () => {
  const range=period(7,now), resumen=buildQuery('a',range,'','ambos','resumen'), detalle=buildQuery('a',range,'','ambos','detalle');
  for (const alias of ['hosts','coverageWeek','coverageMonth','geography','daily']) { assert.match(resumen,new RegExp(alias+':')); assert.doesNotMatch(detalle,new RegExp(alias+':')); }
  for (const alias of ['referrers','devices','browsers','systems']) { assert.doesNotMatch(resumen,new RegExp(alias+':')); assert.match(detalle,new RegExp(alias+':')); }
  assert.match(buildQuery('a',range,'admira.app','carbono','detalle'),/bot:0[^}]*requestHost_in/,'el detalle respeta site y Carbono/Silicio');
  assert.throws(()=>buildQuery('a',range,'','ambos','todo'));
});

test('la API por partes mantiene la puerta: sin sesión 401, editor 403, parte desconocida 400', async () => {
  const {env,cookie}=await directorio('cuenta-puerta');
  const fake=cloudflareFalso();
  await conFetch(fake,async()=>{
    for (const parte of ['resumen','detalle','http','sites']) assert.equal((await pedir(env,null,'?parte='+parte)).status,401,parte+' sin sesión');
    env.AUTH_DB.prepare("UPDATE admiranext_users SET role='editor' WHERE email=?").bind('csilva@admira.com').run();
    const user=env.AUTH_DB.prepare('SELECT * FROM admiranext_users WHERE email=?').bind('csilva@admira.com').first();
    const editor=(await cookieDeSesion(env,user)).split(';')[0];
    for (const parte of ['resumen','detalle','http','sites']) assert.equal((await pedir(env,editor,'?parte='+parte)).status,403,parte+' con editor');
  });
  assert.equal(fake.calls.length,0,'sin admin no se consulta Cloudflare');
  const admin=await directorio('cuenta-puerta-2');
  assert.equal((await pedir(admin.env,admin.cookie,'?parte=todo')).status,400);
  const response=await conFetch(fake,()=>pedir(admin.env,admin.cookie,'?parte=resumen'));
  assert.equal(response.headers.get('cache-control'),'private, no-store');
});

test('la carga inicial (resumen) hace UNA consulta GraphQL y ninguna de registros HTTP', async () => {
  const {env,cookie}=await directorio('cuenta-resumen');
  const fake=cloudflareFalso({zones:4});
  const body=await conFetch(fake,async()=>(await pedir(env,cookie,'?parte=resumen&days=7&site=&audience=ambos')).json());
  assert.equal(body.ok,true);
  assert.equal(fake.count('graphql-rum'),1);
  assert.equal(fake.count('graphql-http'),0,'nada de «Silicio más allá del navegador»');
  assert.equal(fake.calls.some(c=>c.url.includes('/zones?')),false);
  assert.doesNotMatch(fake.calls[0].query,/referrers:|devices:|browsers:|systems:/,'nada de «Cómo llegan»');
  assert.equal(body.traffic,undefined);assert.equal(body.http,undefined);assert.equal(body.sites,undefined,'la tabla de sites no viaja en el resumen');
  assert.deepEqual(body.siteHosts.includes('admira.app'),true,'el selector sí tiene sus sites');
  assert.equal(body.totals.visits,2);assert.ok(body.geography.length);
  // Sin `parte` se entiende el resumen: una llamada sin parámetros nunca dispara lo caro.
  fake.reset();const legacy=await conFetch(fake,async()=>(await pedir(env,cookie,'?days=7')).json());
  assert.equal(legacy.parte,'resumen');assert.equal(legacy.cached,true);assert.equal(fake.calls.length,0);
});

test('cada parte se pide aparte, con su caché, y nunca devuelve cero ante un error', async () => {
  const {env,cookie}=await directorio('cuenta-partes');
  const fake=cloudflareFalso({zones:4});
  await conFetch(fake,async()=>{
    const detalle=await (await pedir(env,cookie,'?parte=detalle&days=7')).json();
    assert.equal(fake.count('graphql-rum'),1);assert.equal(fake.calls.length,1,'el detalle no consulta el inventario');
    assert.equal(detalle.traffic.devices[0].label,'desktop');
    const http=await (await pedir(env,cookie,'?parte=http&days=7')).json();
    assert.equal(fake.count('graphql-http'),4,'una consulta por zona');assert.equal(http.http.total,28);
    fake.reset();
    const sites=await (await pedir(env,cookie,'?parte=sites&days=7')).json();
    assert.ok(sites.sites.find(s=>s.host==='admira.app'));
    const otra=await (await pedir(env,cookie,'?parte=resumen&days=7')).json();
    assert.equal(otra.cached,true,'resumen y sites comparten la misma consulta');
    assert.equal(fake.count('graphql-rum'),1,'sites + resumen = una sola consulta RUM');
    fake.reset();
    for (const parte of ['detalle','http','sites']) assert.equal((await (await pedir(env,cookie,'?parte='+parte+'&days=7')).json()).cached,true,parte+' en caché');
    assert.equal(fake.calls.length,0);
  });
  const roto=await directorio('cuenta-rota'), falla=cloudflareFalso({fail:true});
  await conFetch(falla,async()=>{
    for (const parte of ['resumen','detalle','sites']) {
      const r=await pedir(roto.env,roto.cookie,'?parte='+parte);
      assert.equal(r.status,424,parte);const body=await r.json();assert.equal(body.ok,false);assert.equal(JSON.stringify(body).includes('test-only-token'),false);
    }
    const http=await (await pedir(roto.env,roto.cookie,'?parte=http')).json();
    assert.equal(http.http.ok,false,'registros HTTP no disponibles, no un total cero');assert.equal(http.http.total,undefined);
  });
  const sinConfig=await directorio('');delete sinConfig.env.CF_API_TOKEN;
  for (const parte of ['resumen','detalle','http','sites']) assert.equal((await pedir(sinConfig.env,sinConfig.cookie,'?parte='+parte)).status,424,parte+' sin configurar');
});

// --- Controlador de los plegables ----------------------------------------------------
async function controlador() {
  const contexto=vm.createContext({});
  vm.runInContext(await leer('analitics/plegables.js'),contexto);
  const pedidos=[];let clave='7||ambos|0';const visibles=new Set(['detalle','http','sites']);
  const folds=contexto.AnaliticsPlegables.crear({clave:()=>clave,visible:n=>visibles.has(n),pedir:async n=>{pedidos.push(n+'@'+clave);return {parte:n}}});
  return {folds,pedidos,setClave:k=>{clave=k},visibles};
}
const tic=()=>new Promise(r=>setTimeout(r,0));

test('al desplegar, cada parte se pide una sola vez por combinación de filtros', async () => {
  const {folds,pedidos,setClave}=await controlador();
  for (const n of ['detalle','http','sites']) folds.parte(n);
  folds.filtrosCambiados();await tic();
  assert.deepEqual(pedidos,[],'plegados: nada que pedir');
  folds.abrir('detalle');folds.abrir('detalle');await tic();
  assert.deepEqual(pedidos,['detalle@7||ambos|0'],'dos clics seguidos, una petición');
  folds.plegar('detalle');folds.abrir('detalle');await tic();
  assert.equal(pedidos.length,1,'plegar y volver a abrir con los mismos filtros no vuelve a pedir');
  // Cambian los filtros: el abierto se recarga, los plegados no se piden.
  setClave('30||carbono|0');folds.filtrosCambiados();folds.filtrosCambiados();await tic();
  assert.deepEqual(pedidos,['detalle@7||ambos|0','detalle@30||carbono|0']);
  // Se pliega, cambian otra vez: queda desactualizado y se recarga sólo al abrirlo.
  folds.plegar('detalle');setClave('1||carbono|0');folds.filtrosCambiados();await tic();
  assert.equal(pedidos.length,2);assert.equal(folds.parte('detalle').estado,'desactualizada');
  folds.abrir('detalle');await tic();
  assert.deepEqual(pedidos.slice(2),['detalle@1||carbono|0']);
  assert.equal(folds.parte('http').estado,'sin-cargar');assert.equal(folds.parte('sites').estado,'sin-cargar');
});

test('una respuesta que llega tarde no pisa los filtros nuevos y un error se puede reintentar', async () => {
  const contexto=vm.createContext({});vm.runInContext(await leer('analitics/plegables.js'),contexto);
  let clave='a',falla=true;const resolvers=[];
  const folds=contexto.AnaliticsPlegables.crear({clave:()=>clave,pedir:n=>new Promise((ok,ko)=>resolvers.push({ok,ko,clave}))});
  folds.abrir('http');clave='b';folds.filtrosCambiados();await tic();
  assert.equal(resolvers.length,2);
  resolvers[1].ok({de:'b'});await tic();resolvers[0].ok({de:'a'});await tic();
  assert.equal(folds.vigentes().http.de,'b');
  clave='c';folds.filtrosCambiados();await tic();resolvers[2].ko(new Error('Cloudflare respondió 500'));await tic();
  assert.equal(folds.parte('http').estado,'error');assert.equal(folds.vigentes().http,null,'con error no hay datos, nunca un cero');
  folds.cargar('http',true).catch(()=>{});await tic();assert.equal(resolvers.length,4);
});

// --- La página: carga inicial real de panel.js -----------------------------------------
// DOM mínimo: cualquier elemento acepta lo que panel.js le pida y recuerda lo que se le asigna.
function falso(){const guardado={};return new Proxy(function(){},{
  get(t,k){if(k in guardado)return guardado[k];if(k===Symbol.toPrimitive)return()=>'';if(k===Symbol.iterator)return function*(){};if(k==='then')return undefined;if(k==='children'||k==='options')return [];if(k==='checked')return true;if(k==='value')return '';if(k==='hidden')return false;return guardado[k]=falso()},
  set(t,k,v){guardado[k]=v;return true},apply(){return falso()}})}
async function pagina() {
  const ids={},pedidos=[];
  const document={getElementById:id=>ids[id] ||= falso(),querySelector:()=>falso(),querySelectorAll:()=>[],createElement:()=>falso(),createElementNS:()=>falso(),addEventListener(){},hidden:false};
  const respuesta=parte=>({ok:true,parte,updatedAt:now.toISOString(),range:period(7,now),totals:{visits:1,pageviews:2,configured:1,sites:1},series:[],geography:[],siteHosts:['admira.app'],note:'',coverageComplete:true,traffic:{referrers:[],devices:[],browsers:[],systems:[]},http:{ok:false,note:'x'},sites:[]});
  const contexto=vm.createContext({document,Option:class{},CustomEvent:class{},Intl,Date,Number,Math,Promise,URL,
    setInterval(){},setTimeout,dispatchEvent(){},addEventListener(){},
    fetch:async url=>{pedidos.push(url);const parte=new URL(url,'https://x').searchParams.get('parte');return new Response(JSON.stringify(respuesta(parte)),{headers:{'content-type':'application/json'}})}});
  contexto.window=contexto;
  for (const f of ['analitics/plegables.js','analitics/panel.js','analitics/live.js']) vm.runInContext(await leer(f),contexto,{filename:f});
  await tic();await tic();
  return {contexto,ids,pedidos,partes:()=>pedidos.map(u=>new URL(u,'https://x').searchParams.get('parte'))};
}

test('la carga inicial de /analitics no pide detalle, http ni sites', async () => {
  const {partes,pedidos}=await pagina();
  assert.deepEqual(partes(),['resumen'],'al abrir sólo se pide el resumen');
  assert.match(pedidos[0],/^\/api\/analitics\?parte=resumen&days=7&site=&audience=ambos$/);
});

test('desplegar pide su parte una vez; cambiar filtros recarga sólo los desplegados', async () => {
  const {contexto,ids,partes}=await pagina();
  ids.trafficDetailsToggle.onclick();await tic();await tic();
  assert.deepEqual(partes(),['resumen','detalle']);
  contexto.analiticsPartes.abrir('detalle');await tic();
  assert.deepEqual(partes(),['resumen','detalle'],'el mismo filtro no repite la petición');
  ids.silicio.checked=false;ids.carbono.onchange();await tic();await tic();
  assert.deepEqual(partes().slice(2).sort(),['detalle','resumen'],'cambia Carbono/Silicio: resumen y el bloque desplegado; http y sites siguen plegados');
  assert.equal(contexto.analiticsPartes.parte('http').estado,'sin-cargar');
  ids.httpTrafficToggle.onclick();ids.comparisonToggle.onclick();await tic();await tic();
  assert.deepEqual(partes().slice(4).sort(),['http','sites']);
});

// --- Marcado, estilos y países ---------------------------------------------------------
test('los bloques y los cuatro cuadrantes nacen plegados y no tienen scroll interno', async () => {
  const html=await leer('analitics/index.html'), css=await leer('analitics/style.css');
  for (const id of ['trafficDetails','httpTraffic','comparison']) {
    assert.match(html,new RegExp(`id="${id}Toggle" aria-expanded="false" aria-controls="${id}Body"`),id+' plegado');
    assert.match(html,new RegExp(`id="${id}Body" class="fold-body" hidden`),id+' sin contenido visible');
  }
  for (const q of ['referrers','devices','browsers','systems']) {
    assert.match(html,new RegExp(`id="q-${q}Toggle" aria-expanded="false" aria-controls="q-${q}"`));
    assert.match(html,new RegExp(`id="q-${q}" class="quadrant-body" hidden`));
  }
  // Ninguna regla de las listas plegables ni de la procedencia limita la altura ni hace scroll vertical.
  const reglas=[...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([,sel,decl])=>({sel:sel.trim(),decl}));
  const listas=/traffic-details|quadrant|fold|tablewrap|httpGroups|globe-bar|see-all|comparison/;
  const conScroll=reglas.filter(r=>listas.test(r.sel) && (/max-height/.test(r.decl) || /overflow(-y)?:\s*(auto|scroll)/.test(r.decl)));
  assert.deepEqual(conScroll.map(r=>r.sel),[]);
  assert.doesNotMatch(css,/globe-countries/,'los chips de países ya no existen');
});

test('los países salen en barras de mayor a menor, a escala del máximo (la de los rayos)', async () => {
  const centres=JSON.parse(await leer('analitics/country-centres.json'));
  const {locations}=globeLocations({mode:'history',geography:[{country:'MX',visits:6},{country:'US',visits:507},{country:'CA',visits:3},{country:'ES',visits:65},{country:'CN',visits:30}]},centres);
  const bars=countryBars(locations);
  assert.deepEqual(bars.map(b=>b.key),['US','ES','CN','MX','CA']);
  assert.deepEqual(bars.map(b=>b.rank),[0,1,2,3,4]);
  assert.equal(bars[0].width,1);assert.equal(bars[1].width,65/507);
  assert.ok(Math.abs(bars.reduce((n,b)=>n+b.share,0)-1)<1e-9);
  // El recorrido del globo sigue el orden de `locations`: el mismo de las barras.
  assert.deepEqual(locations.map(p=>p.key),bars.map(b=>b.key));
  assert.deepEqual(countryBars([{key:'B',code:'B',visits:1},{key:'A',code:'A',visits:9}]).map(b=>b.key),['A','B'],'ordena aunque le lleguen desordenados');
  const globe=await leer('analitics/globe.js');
  assert.match(globe,/aria-current/,'el país actual se marca con aria-current');
  assert.match(globe,/countryBars\(locations\)/);
  assert.match(globe,/aria-expanded/,'«Ver todos» es un botón que despliega en la página');
});
