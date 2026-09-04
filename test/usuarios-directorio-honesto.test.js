import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import { cookieDeSesion, sesionCompleta, asegurarDirectorio } from '../functions/_webmaster-gate.js';
import { onRequestGet, onRequestPost } from '../functions/api/usuarios.js';
import { estadoUsuario, cruzarListaBlanca, textoInvitacion, leerListaBlanca } from '../functions/_usuarios-estado.js';

// Directorio honesto y accionable (FLT-1577 · HandON admiranext.com, 4-sep-2026).
// Lo que se comprueba aquí es lo que Carlos ve en /usuarios: que el estado diga la
// verdad, que el cruce con admira.live señale las divergencias y que la invitación
// salga lista para pegar.

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
const LISTA={emails:['csilva@admira.com','csilvasantin@gmail.com','fuera@admira.com'],superusers:['csilva@admira.com']};
async function setup(lista=LISTA){
  const env={AUTH_DB:new D1(),WEBMASTER_SIGNING_KEY:'directorio-test-key',
    YOKUP_FETCH:async()=>Response.json({ok:true,projects:[]}),
    WHITELIST_FETCH:async()=>lista instanceof Error?Promise.reject(lista):Response.json(lista)};
  await asegurarDirectorio(env); return env;
}
async function auth(env,email='csilva@admira.com'){
  const user=await env.AUTH_DB.prepare('SELECT * FROM admiranext_users WHERE email=?').bind(email).first();
  return (await cookieDeSesion(env,user)).split(';')[0];
}
async function current(env,cookie){ return sesionCompleta(new Request('https://www.admiranext.com/usuarios',{headers:{cookie}}),env); }
function request(method,cookie,csrf,body){ return new Request('https://www.admiranext.com/api/usuarios',{method,headers:{cookie,origin:'https://www.admiranext.com','X-Admira-CSRF':csrf,'content-type':'application/json'},body:body&&JSON.stringify(body)}); }

test('el estado distingue a quien nunca ha entrado de quien está activo o suspendido',()=>{
  assert.equal(estadoUsuario({status:'active',last_login_at:null}),'pendiente');
  assert.equal(estadoUsuario({status:'active',last_login_at:1}),'activo');
  assert.equal(estadoUsuario({status:'suspended',last_login_at:1}),'suspendido');
  assert.equal(estadoUsuario({status:'suspended',last_login_at:null}),'suspendido');
});

test('el cruce con la lista blanca señala quién sobra y quién falta en cada lado',()=>{
  const cruce=cruzarListaBlanca([{email:'csilva@admira.com'},{email:'SoloAqui@admira.com'}],{...LISTA,complete:true});
  assert.deepEqual(cruce.por_email['csilva@admira.com'],{en_lista_blanca:true,superusuario:true});
  assert.deepEqual(cruce.por_email['soloaqui@admira.com'],{en_lista_blanca:false,superusuario:false});
  assert.deepEqual(cruce.solo_en_lista_blanca,['csilvasantin@gmail.com','fuera@admira.com']);
  assert.deepEqual(cruce.solo_en_directorio,['soloaqui@admira.com']);
  const sinDatos=cruzarListaBlanca([{email:'a@b.c'}],{emails:[],superusers:[],complete:false});
  assert.deepEqual(sinDatos.solo_en_lista_blanca,[]); assert.deepEqual(sinDatos.solo_en_directorio,[]);
});

test('si admira-whitelist no responde, el directorio sigue y lo dice',async()=>{
  const lista=await leerListaBlanca({WHITELIST_FETCH:async()=>{throw new Error('caído')}});
  assert.equal(lista.complete,false); assert.match(lista.warning,/caído/); assert.deepEqual(lista.emails,[]);
  const rota=await leerListaBlanca({WHITELIST_FETCH:async()=>Response.json({nada:true})});
  assert.equal(rota.complete,false);
});

test('la invitación lleva nombre, rol, enlace de entrada y proyectos legibles',()=>{
  const catalog=[{key:'pixeria',name:'Pixeria'},{key:'yokup',name:'Yokup'}];
  const texto=textoInvitacion({email:'agus@admira.com',display_name:'Agus',role:'editor'},['pixeria'],catalog);
  assert.match(texto,/^Hola Agus, ya tienes acceso a AdmiraNeXT como editor\./m);
  assert.match(texto,/agus@admira\.com en https:\/\/www\.admiranext\.com\/webmaster/);
  assert.match(texto,/Proyectos: Pixeria\./);
  assert.match(textoInvitacion({email:'x@y.z',role:'admin'},['*'],catalog),/Hola x, .*administrador/);
  assert.match(textoInvitacion({email:'x@y.z',role:'viewer'},[],catalog),/sin proyectos asignados todavía/);
  assert.doesNotMatch(texto,/[<>]/,'el texto se pega en un chat: nada de HTML');
});

test('GET /api/usuarios entrega estado real, cruce con admira.live e invitación por persona',async()=>{
  const env=await setup(),cookie=await auth(env),me=await current(env,cookie);
  await onRequestPost({request:request('POST',cookie,me.csrf,{email:'nuevo@admira.com',display_name:'Nuevo',role:'editor',project_keys:['pixeria']}),env});
  const body=await (await onRequestGet({request:request('GET',cookie,me.csrf),env})).json();
  assert.equal(body.ok,true);
  const nuevo=body.users.find((u)=>u.email==='nuevo@admira.com');
  assert.equal(nuevo.estado,'pendiente','recién dado de alta y sin login: pendiente, no activo');
  assert.equal(nuevo.en_lista_blanca,false); assert.equal(nuevo.superusuario,false);
  assert.match(nuevo.invitacion,/Hola Nuevo, ya tienes acceso a AdmiraNeXT como editor\./);
  assert.match(nuevo.invitacion,/https:\/\/www\.admiranext\.com\/webmaster/);
  assert.match(nuevo.invitacion,/Proyectos: pixeria\.com\./);
  const carlos=body.users.find((u)=>u.email==='csilva@admira.com');
  assert.equal(carlos.en_lista_blanca,true); assert.equal(carlos.superusuario,true);
  assert.deepEqual(body.lista_blanca,{complete:true,warning:'',total:3,solo_en_lista_blanca:['fuera@admira.com'],solo_en_directorio:['nuevo@admira.com']});
});

test('sin lista blanca el GET no inventa divergencias y avisa',async()=>{
  const env=await setup(new Error('sin red')),cookie=await auth(env),me=await current(env,cookie);
  const body=await (await onRequestGet({request:request('GET',cookie,me.csrf),env})).json();
  assert.equal(body.lista_blanca.complete,false); assert.match(body.lista_blanca.warning,/sin red/);
  assert.deepEqual(body.lista_blanca.solo_en_lista_blanca,[]); assert.deepEqual(body.lista_blanca.solo_en_directorio,[]);
  assert.equal(body.users[0].en_lista_blanca,false);
});

test('la página muestra estado, buscador, filtros, cruce con admira.live e invitación',()=>{
  const source=fs.readFileSync(new URL('../usuarios.html',import.meta.url),'utf8');
  for (const marca of ['id="q"','id="fRole"','id="fEstado"','id="fProject"','data-act="invite"','id="diverge"','pendiente de primer acceso','<th>admira.live</th>','data-prefill=']) {
    assert.ok(source.includes(marca),`falta ${marca}`);
  }
  assert.match(source,/admiranext-version" content="AdmiraNeXT v\.\d{2}\.\d{2}\.\d{4}\.r\d+\.\d{2}:\d{2}"/);
});
