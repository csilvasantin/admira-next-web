/*
 * Tokens MCP desde el gestor de usuarios (DCL-2bdf456846b38672473769a6, Neo·MBP14, 06-09-2026).
 * Hasta hoy los tokens anmcp_ solo se creaban por API o con wrangler; el gestor no los enseñaba.
 * Ahora la ficha de cada persona trae sus tokens vivos (huella, nunca el token) y los crea/revoca.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { cookieDeSesion, asegurarDirectorio } from '../functions/_webmaster-gate.js';
import { onRequestGet } from '../functions/api/usuarios.js';
import { createToken, revokeToken } from '../functions/mcp/_tokens.js';

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
async function setup(){ const env={AUTH_DB:new D1(),WEBMASTER_SIGNING_KEY:'mcp-tokens-test-key',YOKUP_FETCH:async()=>Response.json({ok:true,projects:[]})}; await asegurarDirectorio(env); return env; }
async function cookie(env,email='csilva@admira.com'){
  const user=await env.AUTH_DB.prepare('SELECT * FROM admiranext_users WHERE email=?').bind(email).first();
  return (await cookieDeSesion(env,user)).split(';')[0];
}
const source = fs.readFileSync(new URL('../usuarios.html', import.meta.url), 'utf8');

test('la ficha de cada persona trae sus tokens MCP vivos (sin el token) y cuenta los revocados', async () => {
  const env=await setup();
  const vivo=await createToken(env,{email:'csilva@admira.com',label:'Wozniak · GrokBot',createdBy:'csilva@admira.com'});
  const muerto=await createToken(env,{email:'csilva@admira.com',label:'viejo',createdBy:'csilva@admira.com'});
  await revokeToken(env,muerto.row.id,'csilva@admira.com');
  const res=await onRequestGet({request:new Request('https://www.admiranext.com/api/usuarios',{headers:{cookie:await cookie(env)}}),env});
  assert.equal(res.status,200);
  const data=await res.json();
  const carlos=data.users.find((u)=>u.email==='csilva@admira.com');
  assert.deepEqual(carlos.mcp_tokens.vivos.map((t)=>t.label),['Wozniak · GrokBot']);
  assert.equal(carlos.mcp_tokens.vivos[0].id,vivo.row.id);
  assert.equal(carlos.mcp_tokens.revocados,1);
  assert.ok(!('token_hash' in carlos.mcp_tokens.vivos[0]),'la huella no sale del servidor');
  assert.ok(!JSON.stringify(data).includes(vivo.token),'el token en claro no viaja nunca en el directorio');
  const otro=data.users.find((u)=>u.email==='csilvasantin@gmail.com');
  assert.deepEqual(otro.mcp_tokens,{vivos:[],revocados:0});
  assert.equal(data.mcp.endpoint,'https://www.admiranext.com/mcp');
});

test('el directorio sigue entero aunque la tabla de tokens falle', async () => {
  const env=await setup();
  const prepare=env.AUTH_DB.prepare.bind(env.AUTH_DB);
  env.AUTH_DB.prepare=(sql)=>{ if(/admiranext_mcp_tokens/.test(sql)) throw new Error('D1 caída'); return prepare(sql); };
  const res=await onRequestGet({request:new Request('https://www.admiranext.com/api/usuarios',{headers:{cookie:await cookie(env)}}),env});
  assert.equal(res.status,200);
  const data=await res.json();
  assert.deepEqual(data.users.find((u)=>u.email==='csilva@admira.com').mcp_tokens,{vivos:[],revocados:0});
});

test('el gestor enseña, crea, copia y revoca tokens MCP desde la fila de la persona', () => {
  assert.match(source, /data-act="tokens"/, 'botón Tokens MCP en las acciones de la fila');
  assert.match(source, /fetch\('\/api\/mcp-tokens'/, 'habla con la API de tokens con CSRF');
  assert.match(source, /X-Admira-CSRF/);
  assert.match(source, /data-act="create-token"/, 'formulario de alta con etiqueta');
  assert.match(source, /data-act="revoke-token"/, 'revocación por token');
  assert.match(source, /data-act="copy-token"/, 'copiar el token recién creado');
  assert.match(source, /no se vuelve a mostrar/, 'avisa de que el token se enseña una sola vez');
  assert.match(source, /Suspender o dar de baja a la persona corta también sus tokens/, 'explica que el token no lleva privilegios propios');
});

test('un clic en el formulario de token nunca cae en el toggle de estado de la persona', () => {
  assert.match(source, /if\(b\.closest\('form\.token-form'\)\)return;/, 'el submit de «Crear token» no lo atiende el onclick genérico, que acaba en PATCH de estado');
  assert.match(source, /if\(b\.dataset\.act==='tokens'\)/);
  assert.match(source, /if\(b\.dataset\.act==='revoke-token'\)/);
  assert.match(source, /confirm\('¿Revocar este token MCP de '/, 'revocar pide confirmación: corta el asistente al instante');
});

test('el panel de tokens no vive fuera del perímetro: solo admin, y el token nuevo desaparece al cerrar el panel', () => {
  assert.match(source, /tokenNuevo=null;paintUsers\(\)/, 'cerrar el panel borra el token de la pantalla');
  assert.match(source, /disabled title="Solo una persona activa puede tener tokens"/, 'no se crean tokens a personas suspendidas');
});
