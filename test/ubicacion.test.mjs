import test from 'node:test';
import assert from 'node:assert/strict';
import {timingSafeEqual} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {onRequest, onRequestPost, onRequestGet} from '../functions/api/ubicacion.js';
import {onRequest as gate} from '../functions/pruebas/_middleware.js';
import {asegurarDirectorio, cookieDeSesion, returnToSeguro} from '../functions/_webmaster-gate.js';
import {guardarAviso, listarEquipos, validarAviso, RETENCION_MS} from '../functions/_ubicacion.js';

// Node Web Crypto no incluye la extensión de Workers; se usa su equivalente nativo.
if (!crypto.subtle.timingSafeEqual) Object.defineProperty(crypto.subtle, 'timingSafeEqual', {value:timingSafeEqual});
const DEVICE_KEY = 'ubicacion-fixture-key-with-at-least-32-characters';
const URL_API = 'https://www.admiranext.com/api/ubicacion';

class KV {
  entries = new Map();
  listCalls = [];
  async put(key, value, options) { this.entries.set(key, {name:key,value,...options}); }
  async list(options) {
    this.listCalls.push(options);
    const entries = [...this.entries.values()].filter((entry) => entry.name.startsWith(options.prefix) && entry.expiration > Date.now()/1000)
      .sort((a,b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
    const offset = Number(options.cursor || 0), limit = options.limit || 1000;
    return {keys:entries.slice(offset,offset+limit),list_complete:offset+limit >= entries.length,cursor:String(offset+limit)};
  }
}
class Statement {
  constructor(stmt){this.stmt=stmt;this.values=[];}
  bind(...values){this.values=values;return this;}
  first(){return this.stmt.get(...this.values)||null;}
  all(){return {results:this.stmt.all(...this.values)};}
  run(){return {success:true,meta:this.stmt.run(...this.values)};}
}
class D1 {
  constructor(){this.db=new DatabaseSync(':memory:');}
  prepare(sql){return new Statement(this.db.prepare(sql));}
}
function aviso(overrides={}) {
  return {equipo:'iphone-carlos',lat:41.395,lon:2.16,precision_m:8,bateria:72,fuente:'atajos-ios',ts:new Date().toISOString(),...overrides};
}
function post(data=aviso(), options={}) {
  const {key=DEVICE_KEY,headers={},body=JSON.stringify(data)}=options;
  return new Request(URL_API,{method:'POST',headers:{'content-type':'application/json',...(key ? {authorization:`Bearer ${key}`} : {}),...headers},body});
}
async function setup() {
  const env={AUTH_DB:new D1(),WEBMASTER_SIGNING_KEY:'ubicacion-signing-fixture',UBICACION_KEY_IPHONE:DEVICE_KEY,UBICACIONES:new KV()};
  await asegurarDirectorio(env);
  const user=env.AUTH_DB.prepare('SELECT * FROM admiranext_users WHERE email=?').bind('csilva@admira.com').first();
  const cookie=(await cookieDeSesion(env,user)).split(';')[0];
  return {env,cookie};
}
function noStore(response) {
  assert.match(response.headers.get('cache-control'), /no-store/);
  assert.equal(response.headers.get('x-robots-tag'),'noindex, nofollow');
  assert.equal(response.headers.has('access-control-allow-origin'),false);
}

test('POST sin clave, clave falsa, cookie Google o secreto ausente devuelve401 sin leer/escribir posiciones', async()=>{
  let writes=0;
  const env={UBICACION_KEY_IPHONE:DEVICE_KEY,UBICACIONES:{put(){writes++;throw new Error('no debe escribir');}}};
  for (const request of [post({}, {key:null,body:'malformed'}),post({}, {key:'wrong'}),post({}, {key:null,headers:{cookie:'__Host-an_session=google-cookie'}})]) {
    const response=await onRequestPost({request,env});
    assert.equal(response.status,401); noStore(response);
    assert.deepEqual(await response.json(),{ok:false,error:'no_autorizado'});
  }
  assert.equal((await onRequestPost({request:post(),env:{}})).status,401);
  assert.equal(writes,0);
});

test('POST clave válida funciona sin Google/AUTH_DB y persiste histórico inmutable con caducidad <=7d', async()=>{
  const kv=new KV(), data=aviso(), before=Date.now();
  const response=await onRequestPost({request:post(data),env:{UBICACION_KEY_IPHONE:DEVICE_KEY,UBICACIONES:kv}});
  assert.equal(response.status,201); noStore(response);
  assert.equal(kv.entries.size,1);
  const entry=[...kv.entries.values()][0];
  assert.equal(JSON.parse(entry.value).lat,data.lat);
  assert.equal(entry.metadata.equipo,'iphone-carlos');
  assert.ok(entry.expiration <= Math.floor((Date.parse(data.ts)+RETENCION_MS)/1000));
  assert.ok(entry.expiration <= Math.floor((Date.now()+RETENCION_MS)/1000));
  assert.ok(entry.expiration > Math.floor((before+RETENCION_MS-1000)/1000));
  assert.ok(!entry.value.includes(DEVICE_KEY));
  assert.ok(!entry.name.includes(DEVICE_KEY));
});

test('una clave por equipo no permite avisar por el Mini ni por otro móvil', async()=>{
  for (const equipo of ['mac-mini','otro-iphone','../iphone-carlos']) {
    const response=await onRequestPost({request:post(aviso({equipo})),env:{UBICACION_KEY_IPHONE:DEVICE_KEY,UBICACIONES:new KV()}});
    assert.equal(response.status,401); noStore(response);
    assert.equal((await response.json()).error,'equipo_no_autorizado');
  }
});

test('validación rechaza coordenadas, precisión, batería, fuente, campos y fechas inválidas', async()=>{
  const invalid=[{lat:91},{lat:'41'},{lon:-181},{precision_m:-1},{precision_m:100001},{bateria:101},{bateria:null},{fuente:''},{fuente:'GPS\nsecret'},{fuente:'x'.repeat(65)},{extra:'secreto'},{ts:'ayer'},{ts:'2026-02-30T10:00:00Z'},
    {ts:new Date(Date.now()-25*3600000).toISOString()},{ts:new Date(Date.now()+6*60000).toISOString()}];
  const kv=new KV();
  for (const override of invalid) {
    const response=await onRequestPost({request:post(aviso(override)),env:{UBICACION_KEY_IPHONE:DEVICE_KEY,UBICACIONES:kv}});
    assert.equal(response.status,400,JSON.stringify(override)); noStore(response);
  }
  assert.equal(kv.entries.size,0);
});

test('JSON, content-type y límite de stream producen400/415/413 incluso sin Content-Length', async()=>{
  const env={UBICACION_KEY_IPHONE:DEVICE_KEY,UBICACIONES:new KV()};
  for (const [request,status] of [[post({}, {body:'{broken'}),400],[post({}, {headers:{'content-type':'text/plain'}}),415],[post({}, {body:' '.repeat(2049)}),413],
    [post({}, {headers:{'content-length':'9999'}}),413],[post([],{}),400]]) {
    const response=await onRequestPost({request,env});assert.equal(response.status,status);noStore(response);
  }
  assert.equal(env.UBICACIONES.entries.size,0);
});

test('ts Unix segundos/milisegundos e ISO con offset se normalizan y batería ausente es opcional', ()=>{
  const now=Date.now(), seconds=Math.floor(now/1000);
  assert.equal(validarAviso(aviso({ts:seconds}),now).ts,new Date(seconds*1000).toISOString());
  assert.equal(validarAviso(aviso({ts:now}),now).ts,new Date(now).toISOString());
  const {bateria,...withoutBattery}=aviso();
  assert.equal(validarAviso(withoutBattery).bateria,null);
  assert.ok(Number.isFinite(Date.parse(validarAviso(aviso({ts:new Date(now).toISOString().replace('Z','+00:00')}),now).ts)));
});

test('avisos atrasados/concurrentes no sobrescriben el más nuevo y todos caducan según la medición', async()=>{
  const kv=new KV(), now=Date.now();
  const newest=validarAviso(aviso({ts:now,lat:42}),now);
  const older=validarAviso(aviso({ts:now-3*3600000,lat:40}),now);
  await Promise.all([guardarAviso(kv,newest,now),guardarAviso(kv,older,now)]);
  assert.equal(kv.entries.size,2);
  const equipos=await listarEquipos(kv,now);
  assert.equal(equipos[0].lat,42);
  assert.equal(equipos[0].estado,'actualizado');
  assert.equal(kv.listCalls[0].limit,1,'el timestamp invertido evita escanear toda la semana');
  const savedOlder=[...kv.entries.values()].find((entry)=>entry.metadata.lat===40);
  assert.equal(savedOlder.expiration,Math.floor((now-3*3600000+RETENCION_MS)/1000));
});

test('el desfase futuro permitido no prolonga la retención más de7d desde recepción', async()=>{
  const kv=new KV(), now=Date.now(), future=validarAviso(aviso({ts:now+60000}),now);
  await guardarAviso(kv,future,now);
  assert.equal([...kv.entries.values()][0].expiration,Math.floor((now+RETENCION_MS)/1000));
});

test('móvil marca desactualizado sólo cuando pasan más de2h; Mini mantiene posición manual verificada sin fingir telemetría', async()=>{
  const kv=new KV(), now=Date.now();
  await guardarAviso(kv,validarAviso(aviso({ts:now-2*3600000}),now),now);
  const just=await listarEquipos(kv,now);
  assert.equal(just[0].desactualizado,false);
  const later=await listarEquipos(kv,now+1);
  assert.equal(later[0].desactualizado,true);assert.equal(later[0].estado,'desactualizado');
  assert.equal(later[1].tipo,'fijo');assert.equal(later[1].direccion,'Gran de Gràcia 51, Barcelona');
  assert.equal(later[1].lat,41.3993419);assert.equal(later[1].lon,2.1559172);assert.equal(later[1].fuente,'manual');
  assert.equal(later[1].precision_m,null);assert.equal(later[1].ultimo_aviso,null);assert.equal(later[1].ts,null);
});

test('sin avisos o tras7d no queda una posición histórica presentada como actual', async()=>{
  const now=Date.now(), kv=new KV();
  await guardarAviso(kv,validarAviso(aviso({ts:now}),now),now);
  const expired=await listarEquipos(kv,now+RETENCION_MS+1);
  assert.equal(expired[0].estado,'sin_datos');assert.equal(expired[0].lat,null);assert.equal(expired[0].desactualizado,true);
  assert.equal((await listarEquipos(new KV(),now))[0].ultimo_aviso,null);
});

test('paginación KV continúa tras página vacía con cursor y conserva el prefijo', async()=>{
  const now=Date.now(), value=validarAviso(aviso(),now), calls=[];
  const kv={async list(options){calls.push(options);return calls.length===1 ? {keys:[],list_complete:false,cursor:'next'} : {keys:[{metadata:value}],list_complete:true};}};
  const equipos=await listarEquipos(kv,now);
  assert.equal(equipos[0].lat,value.lat);assert.equal(calls[1].cursor,'next');assert.equal(calls[1].prefix,calls[0].prefix);
});

test('GET no acepta la clave del iPhone ni cookie falsa: exige la sesión vigente del directorio', async()=>{
  const {env}=await setup();
  for (const headers of [{},{authorization:`Bearer ${DEVICE_KEY}`},{cookie:'__Host-an_session=falsa.firma'}]) {
    const response=await onRequestGet({request:new Request(URL_API,{headers}),env});
    assert.equal(response.status,401);noStore(response);
    assert.deepEqual(await response.json(),{ok:false,error:'sesion_requerida',login:'/pruebas/mapa/'});
  }
  assert.equal(env.UBICACIONES.listCalls.length,0);
});

test('GET con sesión sirve datos y la suspensión revoca inmediatamente GET y todo /pruebas', async()=>{
  const {env,cookie}=await setup();
  await onRequestPost({request:post(),env});
  const request=new Request(URL_API,{headers:{cookie}});
  const response=await onRequestGet({request,env});assert.equal(response.status,200);noStore(response);
  const data=await response.json();assert.equal(data.equipos[0].equipo,'iphone-carlos');assert.equal(data.retencion_dias,7);
  env.AUTH_DB.prepare("UPDATE admiranext_users SET status='suspended' WHERE email=?").bind('csilva@admira.com').run();
  assert.equal((await onRequestGet({request,env})).status,401);
  let served=false;
  const gated=await gate({request:new Request('https://www.admiranext.com/pruebas/mapa/',{headers:{cookie}}),env,next:async()=>{served=true;return new Response('private');}});
  assert.equal(gated.status,401);assert.equal(served,false);noStore(gated);
});

test('/pruebas HTML, variantes, JS y demo se cierran sin sesión y tras Google vuelven al mapa', async()=>{
  const {env,cookie}=await setup();
  for (const path of ['/pruebas/mapa','/pruebas/mapa/','/pruebas/mapa/index.html','/pruebas/mapa/mapa.js','/pruebas/mapa/?demo=1','/pruebas/otra']) {
    let served=false;
    const context={request:new Request(`https://www.admiranext.com${path}`),env,data:{},next:async()=>{served=true;return new Response('private map content');}};
    const response=await gate(context);assert.equal(response.status,401,path);assert.equal(served,false);noStore(response);
    assert.doesNotMatch(await response.text(),/private map content/);
  }
  const challenge=env.AUTH_DB.prepare('SELECT return_to FROM admiranext_login_challenges ORDER BY rowid DESC LIMIT 1').first();
  assert.equal(challenge.return_to,'/pruebas/mapa/');
  const context={request:new Request('https://www.admiranext.com/pruebas/mapa/',{headers:{cookie}}),env,data:{},next:async()=>new Response('private',{headers:{'cache-control':'public,max-age=3600'}})};
  const allowed=await gate(context);assert.equal(allowed.status,200);assert.equal(await allowed.text(),'private');noStore(allowed);
});

test('sin directorio una página de /pruebas no da 503; si el directorio falla, el login sigue cerrado', async()=>{
  for (const env of [{},{WEBMASTER_SIGNING_KEY:'key'},{WEBMASTER_SIGNING_KEY:'key',AUTH_DB:{prepare(){throw new Error('db unavailable');}}}]) {
    for (const path of ['/pruebas/mapa','/pruebas/mapa/','/pruebas/mapa/index.html','/pruebas/mapa/mapa.js']) {
      let served=false;
      const response=await gate({request:new Request('https://www.admiranext.com'+path),env,next:async()=>{served=true;return new Response('private');}});
      const pagina = path.endsWith('/') || path.endsWith('/index.html');
      const expected = !env.AUTH_DB && pagina ? 401 : env.WEBMASTER_SIGNING_KEY && !pagina ? 401 : 503;
      assert.equal(response.status,expected,path);assert.equal(served,false);noStore(response);
    }
  }
});

test('returnTo exacto admite mapa y rechaza redirecciones externas, traversal y query arbitraria', ()=>{
  for (const path of ['/pruebas/mapa','/pruebas/mapa/','/pruebas/mapa/index.html']) assert.equal(returnToSeguro(path),'/pruebas/mapa/');
  for (const path of ['https://evil.test/pruebas/mapa/','//evil.test','/pruebas/mapa/../../usuarios','/pruebas/mapa/?next=//evil.test','/pruebas/mapa/%2e%2e/']) assert.equal(returnToSeguro(path),'/webmaster');
});

test('fallo KV devuelve503 genérico y los métodos no admitidos405; siempre no-store', async()=>{
  const {env,cookie}=await setup();env.UBICACIONES={async put(){throw new Error('private infrastructure detail');},async list(){throw new Error('private infrastructure detail');}};
  for (const response of [await onRequestPost({request:post(),env}),await onRequestGet({request:new Request(URL_API,{headers:{cookie}}),env})]) {
    assert.equal(response.status,503);noStore(response);assert.deepEqual(await response.json(),{ok:false,error:'almacenamiento_no_disponible'});
  }
  const response=await onRequest({request:new Request(URL_API,{method:'DELETE'}),env});
  assert.equal(response.status,405);noStore(response);assert.equal(response.headers.get('allow'),'GET, POST');
});

test('binding KV ausente nunca anuncia guardado ni divulga posiciones', async()=>{
  const {env,cookie}=await setup();delete env.UBICACIONES;
  for (const response of [await onRequestPost({request:post(),env}),await onRequestGet({request:new Request(URL_API,{headers:{cookie}}),env})]) {
    assert.equal(response.status,503);noStore(response);assert.deepEqual(await response.json(),{ok:false,error:'almacenamiento_no_disponible'});
  }
});
