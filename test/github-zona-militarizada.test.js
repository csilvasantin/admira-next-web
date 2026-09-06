/*
 * /github zona militarizada (encargo #2494 · Wozniak/Carlos · Neo·MBP14 · 06-09-2026).
 * Sin sesión no sale ni una línea; con sesión solo @admira.com y la propiedad; el resto 403.
 * El inventario vive en D1 y se renderiza desde markdown escapado.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { cookieDeSesion, asegurarDirectorio, sesionCompleta, returnToSeguro } from '../functions/_webmaster-gate.js';
import { onRequestPost as altaUsuario } from '../functions/api/usuarios.js';
import { onRequest as github, accesoGithub } from '../functions/github.js';
import { guardarDoc, leerDoc } from '../functions/_docs.js';
import { markdownAHtml } from '../functions/_markdown.js';

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
const MD = `# Inventario GitHub · prueba

> **Acceso:** zona militarizada.

## Tabla

| Repo | Vis. | URL |
|---|---|---|
| \`xpaceos-mcp\` | 🔒 priv | [link](https://github.com/csilvasantin/xpaceos-mcp) |
| \`xpaceos\` | 🌐 pub | [link](https://github.com/csilvasantin/xpaceos) |

- **Prohibido** imprimir tokens <script>alert(1)</script>
- Enlace raro [x](javascript:alert(1))

1. Primero
2. Segundo

_2 repos · 1 privado_`;

async function setup(){
  const env={AUTH_DB:new D1(),WEBMASTER_SIGNING_KEY:'github-test-key',YOKUP_FETCH:async()=>Response.json({ok:true,projects:[]}),VERSION_FETCH:async()=>Response.json({version:'v.06.09.2026.r4.18:30'})};
  await asegurarDirectorio(env); await guardarDoc(env,'github-inventario',MD,'Wozniak'); return env;
}
async function cookie(env,email){
  const user=await env.AUTH_DB.prepare('SELECT * FROM admiranext_users WHERE email=?').bind(email).first();
  return (await cookieDeSesion(env,user)).split(';')[0];
}
async function alta(env,email,role='viewer'){
  const adminCookie=await cookie(env,'csilva@admira.com');
  const admin=await sesionCompleta(new Request('https://www.admiranext.com/usuarios',{headers:{cookie:adminCookie}}),env);
  const res=await altaUsuario({request:new Request('https://www.admiranext.com/api/usuarios',{method:'POST',headers:{cookie:adminCookie,origin:'https://www.admiranext.com','X-Admira-CSRF':admin.csrf,'content-type':'application/json'},body:JSON.stringify({email,role,project_keys:['*']})}),env});
  assert.equal(res.status,201);
}
const pide=(env,cookieValue)=>github({request:new Request('https://www.admiranext.com/github',{headers:cookieValue?{cookie:cookieValue}:{}}),env});

test('sin sesión: 401 con el login de Google y ni un nombre de repo en el cuerpo', async () => {
  const env=await setup();
  const res=await pide(env,null);
  assert.equal(res.status,401);
  const body=await res.text();
  assert.match(body,/AdmiraNeXT · Acceso/);
  assert.doesNotMatch(body,/xpaceos-mcp/);
  assert.equal(res.headers.get('cache-control'),'no-store');
  assert.match(res.headers.get('x-robots-tag')||'',/noindex/);
});

test('la propiedad (gmail) y cualquier @admira.com entran; el inventario sale renderizado y escapado', async () => {
  const env=await setup();
  for (const email of ['csilvasantin@gmail.com','csilva@admira.com']) {
    const res=await pide(env,await cookie(env,email));
    assert.equal(res.status,200,email);
    const body=await res.text();
    assert.match(body,/xpaceos-mcp/);
    assert.match(body,/<table>/);
    assert.match(body,/&lt;script&gt;alert\(1\)&lt;\/script&gt;/,'el script del markdown sale como texto');
    assert.doesNotMatch(body,/<script>alert/);
    assert.doesNotMatch(body,/href="javascript:/,'solo enlaces http(s)');
    assert.match(body,/rel="noopener noreferrer"/);
    assert.match(body,/AdmiraNeXT v\.06\.09\.2026\.r4\.18:30/,'lleva el sello vivo de version.json');
    assert.match(body,/Zona militarizada/);
  }
  await alta(env,'editor@admira.com','editor');
  assert.equal((await pide(env,await cookie(env,'editor@admira.com'))).status,200);
});

test('una cuenta del directorio fuera de @admira.com recibe 403 sin una línea del inventario, y queda en la auditoría', async () => {
  const env=await setup();
  await alta(env,'reader@example.com','viewer');
  const res=await pide(env,await cookie(env,'reader@example.com'));
  assert.equal(res.status,403);
  const body=await res.text();
  assert.doesNotMatch(body,/xpaceos/);
  assert.match(body,/Sin acceso a esta zona/);
  const audit=await env.AUTH_DB.prepare("SELECT action,actor_email FROM admiranext_user_audit WHERE action LIKE 'github_%' ORDER BY created_at").all();
  assert.deepEqual(audit.results.map((r)=>[r.action,r.actor_email]),[['github_denied','reader@example.com']]);
});

test('cada lectura queda anotada como github_view', async () => {
  const env=await setup();
  await pide(env,await cookie(env,'csilva@admira.com'));
  const audit=await env.AUTH_DB.prepare("SELECT action,actor_email,detail FROM admiranext_user_audit WHERE action='github_view'").all();
  assert.equal(audit.results.length,1);
  assert.equal(audit.results[0].actor_email,'csilva@admira.com');
  assert.match(audit.results[0].detail,/inventario/);
});

test('sin inventario cargado la página lo dice en vez de romperse', async () => {
  const env=await setup();
  await env.AUTH_DB.prepare('DELETE FROM admiranext_docs').run();
  const res=await pide(env,await cookie(env,'csilva@admira.com'));
  assert.equal(res.status,200);
  assert.match(await res.text(),/Todavía no hay inventario cargado/);
});

test('reglas de acceso y de retorno tras el login', () => {
  assert.equal(accesoGithub('Alguien@Admira.com'),true);
  assert.equal(accesoGithub('csilvasantin@gmail.com'),true);
  assert.equal(accesoGithub('otro@gmail.com'),false);
  assert.equal(accesoGithub('x@admira.com.evil.io'),false);
  assert.equal(accesoGithub(''),false);
  assert.equal(returnToSeguro('/github'),'/github');
  assert.equal(returnToSeguro('/github/../x'),'/webmaster');
});

test('el renderizador cubre lo que usa el inventario: encabezados, cita, tabla alineada, listas, código, negrita, énfasis y enlaces', () => {
  const html=markdownAHtml('# T\n\n> nota **fuerte**\n\n| A | B |\n|---|---:|\n| `x` | 1 |\n\n- uno\n- dos\n\n1. a\n2. b\n\n---\n\n_3 repos_\n\nTexto con [enlace](https://example.com/p?q=1) y `c`.');
  assert.match(html,/<h1>T<\/h1>/);
  assert.match(html,/<blockquote>nota <strong>fuerte<\/strong><\/blockquote>/);
  assert.match(html,/<th>A<\/th><th style="text-align:right">B<\/th>/);
  assert.match(html,/<td><code>x<\/code><\/td><td style="text-align:right">1<\/td>/);
  assert.match(html,/<ul><li>uno<\/li><li>dos<\/li><\/ul>/);
  assert.match(html,/<ol><li>a<\/li><li>b<\/li><\/ol>/);
  assert.match(html,/<hr>/);
  assert.match(html,/<p><em>3 repos<\/em><\/p>/);
  assert.match(html,/<a href="https:\/\/example.com\/p\?q=1" target="_blank" rel="noopener noreferrer">enlace<\/a>/);
});

test('el documento se guarda y se relee de D1 con autor y fecha', async () => {
  const env=await setup();
  const doc=await leerDoc(env,'github-inventario');
  assert.equal(doc.updated_by,'Wozniak');
  assert.ok(doc.updated_at>0);
  assert.match(doc.markdown,/xpaceos-mcp/);
});
