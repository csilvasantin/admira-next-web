// Libro de estilo (Style Book) de cada presentación — entregable fijo (16-oct-2026).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
  SECTIONS,SERIES_ID,STYLEBOOK_KEY,applyStylebookEdit,contrastRatio,ensureStylebook,newStylebookDoc,parseStylebookMarkdown,
  renderStylebookMarkdown,renderTemplateMarkdown,resolveSection,stylebookUrls,stylebookView
} from '../functions/presentaciones/_stylebook.js';
import {buildGeneration,OUTPUTS,recomputeGeneration} from '../functions/presentaciones/_generation.js';
import {captureVersion,restoreVersion} from '../functions/presentaciones/_versions.js';
import {onRequest as stylebookApi} from '../functions/presentaciones/[client]/api/stylebook.js';
import {onRequestGet as stylebookPage} from '../functions/presentaciones/[client]/estilo.js';
import {onRequest as middleware} from '../functions/presentaciones/_middleware.js';
import {TOOLS,HELP,callTool,urlsFor,handleRpc} from '../functions/mcp/_server.js';

const fixture=JSON.parse(await readFile(new URL('./fixtures/stylebook-admiranext-3-actos.json',import.meta.url),'utf8'));
const SLUG='admiranext-3-actos';
const kv=(initial={})=>{const values=new Map(Object.entries(initial).map(([k,v])=>[k,JSON.stringify(v)]));return{values,async get(k,o){const v=values.get(k);return o?.type==='json'&&v?JSON.parse(v):v||null},async put(k,v){values.set(k,v)},async list(){return{keys:[],list_complete:true}}}};
const seeded=(extra={})=>kv({[`presentation:${SLUG}`]:fixture.presentation,[`ideas:${SLUG}`]:fixture.ideas,[`media-library:${SLUG}`]:fixture.library,[`versions:${SLUG}`]:{versions:fixture.versions},...extra});
const ctx=()=>({slug:SLUG,presentation:fixture.presentation,ideas:fixture.ideas,library:fixture.library,versions:fixture.versions,site:'https://www.admiranext.com'});
const editor={email:'lucas@admira.com',via:'agent-token',tokenLabel:'Lucas'};
const call=(env,{method='GET',query='',body,origin='https://www.admiranext.com',data={presentationAccess:editor},client=SLUG}={})=>stylebookApi({
  request:new Request(`https://www.admiranext.com/presentaciones/${client}/api/stylebook${query}`,{method,headers:{...(origin?{origin}:{}),'content-type':'application/json'},body:body?JSON.stringify(body):undefined}),
  env:{PRESENTATION_IDEAS:env},params:{client},data,next:async()=>new Response('next')
});

test('el libro tiene las 14 secciones fijas en orden y cada una sale rellenada con datos reales',()=>{
  assert.equal(SECTIONS.length,14);
  assert.deepEqual(SECTIONS.map(s=>s.n),[...Array(14).keys()].map(i=>i+1));
  const md=renderStylebookMarkdown(SLUG,null,ctx());
  let last=-1;for(const s of SECTIONS){const at=md.indexOf(`## ${s.n}. ${s.title}`);assert.ok(at>last,`falta o desordenada: ${s.title}`);last=at}
  assert.match(md,/^# Libro de estilo · AdmiraNeXT · Studio, Store y App \(3 actos\)/);
  assert.match(md,/#E7EDF6/);assert.match(md,/#FFB454/);                      // colores del theme en hex
  assert.match(md,/Acto 1 · admira\.studio/);assert.match(md,/studio-c/);       // láminas del esqueleto
  assert.match(md,/studio-a\.mp4/);assert.match(md,/6,5 MB/);                   // medios con tamaño
  assert.match(md,/JTI y Altadis no aparecen nunca juntos/);assert.match(md,/Datos de ejemplo/);
  assert.match(md,/#689840/);assert.match(md,/DejaVu Sans Bold/);                // valores por defecto de la serie
  assert.match(md,/\[DAT\]/);assert.match(md,/\[SER\]/);assert.match(md,/\[CAL\]/);assert.match(md,/\[INF\]/);
  assert.match(md,/get_stylebook \{client:"admiranext-3-actos"\}/);
  assert.match(md,/⚠ Traducción pendiente de revisar en: EN/);
});

test('el contraste se calcula (WCAG) y avisa cuando el texto no llega a AA',()=>{
  assert.equal(contrastRatio('#000000','#ffffff'),21);
  assert.equal(contrastRatio('#fff','#000'),null);
  const pobre={...ctx(),presentation:{...fixture.presentation,theme:{...fixture.presentation.theme,text:'#cccccc',background:'#ffffff'}}};
  assert.match(renderStylebookMarkdown(SLUG,null,pobre),/El texto no llega a AA/);
  assert.match(renderStylebookMarkdown(SLUG,null,ctx()),/\[ \] Contraste texto\/fondo|\[x\] Contraste texto\/fondo/);
});

test('una presentación mínima (sin láminas, medios ni tema) no rompe el render',()=>{
  const md=renderStylebookMarkdown('vacia',null,{slug:'vacia',presentation:{displayName:'Vacía'},ideas:{},library:null});
  for(const s of SECTIONS)assert.ok(md.includes(`## ${s.n}. ${s.title}`));
  assert.match(md,/Aún no hay medios asignados/);
});

test('la plantilla base lleva los valores de la serie de 9 vídeos y no contiene datos de ningún cliente',()=>{
  const md=renderTemplateMarkdown();
  assert.ok(md.includes(SERIES_ID));assert.match(md,/#0D1321/);assert.match(md,/1920×1080/);assert.match(md,/76 px/);
  assert.doesNotMatch(md,/admiranext-3-actos|Alsea|Starbucks/);
});

test('edición: sección a mano [MAN], baseRevision, reset, markdown completo y secciones no editables',()=>{
  let r=applyStylebookEdit(SLUG,null,{section:'paleta',body:'Solo verde y blanco.',reason:'Carlos pide paleta mínima'},ctx(),editor,'2026-10-16T12:00:00Z');
  assert.deepEqual(r.changed,['paleta']);assert.equal(r.doc.revision,2);
  let md=renderStylebookMarkdown(SLUG,r.doc,ctx());
  assert.match(md,/## 4\. Paleta \[MAN\]/);assert.match(md,/Solo verde y blanco\./);assert.match(md,/Edición manual de Lucas/);
  assert.match(md,/r2 · editado \(paleta\): Carlos pide paleta mínima/);
  assert.throws(()=>applyStylebookEdit(SLUG,r.doc,{section:'4',body:'x',reason:'y',baseRevision:1},ctx(),editor),e=>e.status===409);
  assert.throws(()=>applyStylebookEdit(SLUG,r.doc,{section:'paleta',body:'x'},ctx(),editor),/reason/);
  assert.throws(()=>applyStylebookEdit(SLUG,r.doc,{section:'historial',body:'x',reason:'y'},ctx(),editor),/no se edita/);
  assert.throws(()=>applyStylebookEdit(SLUG,r.doc,{section:'inventada',body:'x',reason:'y'},ctx(),editor),/Sección no válida/);
  // sin cambios reales → no sube revisión
  assert.equal(applyStylebookEdit(SLUG,r.doc,{section:'paleta',body:'Solo verde y blanco.',reason:'igual'},ctx(),editor).unchanged,true);
  // markdown completo: solo cambia lo que difiere
  const parts=parseStylebookMarkdown(md);assert.equal(Object.keys(parts).length,14);
  const edited=md.replace('Solo verde y blanco.','Verde, blanco y gris.');
  const full=applyStylebookEdit(SLUG,r.doc,{markdown:edited,reason:'ajuste por markdown'},ctx(),editor);
  assert.deepEqual(full.changed,['paleta']);assert.equal(full.doc.overrides.paleta.body,'Verde, blanco y gris.');
  // volver a la automática
  const back=applyStylebookEdit(SLUG,full.doc,{section:'paleta',reset:true,reason:'volvemos'},ctx(),editor);
  assert.equal(back.doc.overrides.paleta,undefined);assert.equal(back.kind,'reset');
  assert.doesNotMatch(renderStylebookMarkdown(SLUG,back.doc,ctx()),/Verde, blanco y gris/);
  // el markdown de un doc sin tocar no genera overrides (ida y vuelta estable)
  const same=applyStylebookEdit(SLUG,null,{markdown:renderStylebookMarkdown(SLUG,null,ctx()),reason:'roundtrip'},ctx(),editor);
  assert.equal(same.unchanged,true);
});

test('resolveSection acepta id, número y prefijo del título',()=>{
  assert.equal(resolveSection('paleta').id,'paleta');assert.equal(resolveSection('04').id,'paleta');assert.equal(resolveSection('Voz y').id,'voz');assert.equal(resolveSection('uso de medios').id,'medios');
  assert.equal(resolveSection('99'),null);
});

test('buildGeneration añade SIEMPRE el libro de estilo (una vez, en castellano) sin que sea un output elegible',()=>{
  assert.ok(!OUTPUTS.includes('stylebook'));
  const g=buildGeneration({client:SLUG,displayName:'X',outputs:['website','documents'],languages:['es','en']});
  const tasks=Object.values(g.tasks).filter(t=>t.output==='stylebook');
  assert.equal(tasks.length,1);assert.equal(tasks[0].language,'es');assert.equal(tasks[0].status,'ready');assert.equal(tasks[0].url,`/presentaciones/${SLUG}/estilo`);assert.equal(tasks[0].provider,'admiranext');
  assert.equal(g.artifacts.stylebook.status,'ready');assert.equal(g.artifacts.stylebook.url,`/presentaciones/${SLUG}/estilo`);assert.equal(g.artifacts.stylebook.label,'Libro de estilo');
  assert.equal(g.status,'complete');
  // aunque nadie lo pida ni lo guarde, una regeneración desde el editor de Ideas lo conserva
  const g2=buildGeneration({client:SLUG,displayName:'X',outputs:['website'],languages:['en','ca']});
  assert.equal(Object.values(g2.tasks).filter(t=>t.output==='stylebook').length,1);assert.equal(Object.values(g2.tasks).find(t=>t.output==='stylebook').language,'en');
  assert.ok(recomputeGeneration(g).requested.includes('stylebook'));
});

test('ensureStylebook crea el registro, conserva las ediciones al regenerar y nunca lanza',async()=>{
  const store=seeded(),env={PRESENTATION_IDEAS:store};
  const first=await ensureStylebook(env,SLUG,{actor:editor});
  assert.equal(first.revision,1);assert.equal(first.history[0].kind,'create');assert.ok(store.values.has(STYLEBOOK_KEY(SLUG)));
  const edit=applyStylebookEdit(SLUG,first,{section:'voz',body:'Voz propia',reason:'prueba'},ctx(),editor);
  await store.put(STYLEBOOK_KEY(SLUG),JSON.stringify(edit.doc));
  const again=await ensureStylebook(env,SLUG,{actor:editor,existed:true});
  assert.equal(again.revision,3);assert.equal(again.overrides.voz.body,'Voz propia');assert.equal(again.history.at(-1).kind,'regenerate');
  assert.equal(await ensureStylebook({PRESENTATION_IDEAS:{get(){throw new Error('KV caído')},put(){}}},SLUG),null);
  assert.equal(await ensureStylebook({},SLUG),null);
});

test('el libro viaja dentro de las versiones de la presentación y se restaura con ellas',async()=>{
  const store=seeded(),env={PRESENTATION_IDEAS:store};
  const doc=newStylebookDoc(SLUG,{actor:editor});await store.put(STYLEBOOK_KEY(SLUG),JSON.stringify(doc));
  const v1=await captureVersion(env,SLUG,'antes');
  const edit=applyStylebookEdit(SLUG,doc,{section:'voz',body:'Cambiada',reason:'x'},ctx(),editor);
  await store.put(STYLEBOOK_KEY(SLUG),JSON.stringify(edit.doc));
  await restoreVersion(env,SLUG,v1.id);
  assert.equal((await store.get(STYLEBOOK_KEY(SLUG),{type:'json'})).revision,1);
});

test('API GET: json, markdown y una sección; 404 si no existe; 400 si el slug o la sección no valen',async()=>{
  const env=seeded();
  const j=await (await call(env)).json();
  assert.equal(j.ok,true);assert.equal(j.stored,false);assert.equal(j.sections.length,14);assert.match(j.markdown,/## 4\. Paleta/);assert.equal(j.urls.page,`https://www.admiranext.com/presentaciones/${SLUG}/estilo`);
  const md=await call(env,{query:'?format=md'});assert.match(md.headers.get('content-type'),/text\/markdown/);assert.match(await md.text(),/^# Libro de estilo/);
  const sec=await (await call(env,{query:'?section=paleta'})).json();assert.equal(sec.section.id,'paleta');assert.ok(sec.autoBody.includes('#E7EDF6'));
  assert.equal((await call(env,{query:'?section=zzz'})).status,400);
  assert.equal((await call(env,{client:'no-existe'})).status,404);
  assert.equal((await call(env,{client:'../x'})).status,400);
  assert.equal((await call(env,{method:'DELETE'})).status,405);
});

test('API PUT: edita, versiona, rechaza origen ajeno, campos desconocidos y 409',async()=>{
  const env=seeded();
  const ok=await call(env,{method:'PUT',body:{section:'voz',body:'Tuteo siempre',reason:'norma de Carlos'}});
  assert.equal(ok.status,200);const out=await ok.json();assert.deepEqual(out.changed,['voz']);assert.equal(out.revision,2);
  assert.equal(JSON.parse(env.values.get(STYLEBOOK_KEY(SLUG))).overrides.voz.by,'Lucas');
  const versions=JSON.parse(env.values.get(`versions:${SLUG}`)).versions;assert.match(versions[0].reason,/libro de estilo r2: norma de Carlos/);
  assert.equal((await call(env,{method:'PUT',origin:null,data:{presentationAccess:{level:'owner'}},body:{section:'voz',body:'x',reason:'y'}})).status,403);
  assert.equal((await call(env,{method:'PUT',body:{section:'voz',body:'x',reason:'y',extra:1}})).status,400);
  assert.equal((await call(env,{method:'PUT',body:{section:'voz',body:'otra',reason:'y',baseRevision:1}})).status,409);
  assert.equal((await call(env,{method:'PUT',body:{section:'voz',reset:true,reason:'vuelve'}})).status,200);
  assert.equal((await call(env,{method:'PUT',body:{section:'voz',reset:true,reason:'otra vez'}})).status,200);
});

test('la página /estilo es HTML escapado, con enlaces al markdown y a la sala',async()=>{
  const env=seeded();
  const hostile={...fixture.presentation,displayName:'<script>alert(1)</script>'};
  await env.put(`presentation:${SLUG}`,JSON.stringify(hostile));
  const res=await stylebookPage({params:{client:SLUG},env:{PRESENTATION_IDEAS:env},next:async()=>new Response('next')});
  const html=await res.text();
  assert.equal(res.status,200);assert.match(res.headers.get('content-type'),/text\/html/);assert.match(res.headers.get('x-robots-tag'),/noindex/);
  assert.ok(!html.includes('<script>alert(1)</script>'));assert.match(html,/&lt;script&gt;/);
  assert.match(html,/href="api\/stylebook\?format=md"/);assert.match(html,/<h2>4\. Paleta<\/h2>/);
  assert.equal(await (await stylebookPage({params:{client:'nada'},env:{PRESENTATION_IDEAS:env},next:async()=>new Response('next')})).text(),'next');
});

test('MCP: get_stylebook y update_stylebook existen, están documentadas y llaman a la API correcta',async()=>{
  for(const name of ['get_stylebook','update_stylebook']){assert.ok(TOOLS.some(t=>t.name===name),name);assert.ok(HELP.includes(name),`help no menciona ${name}`)}
  const html=await readFile(new URL('../mcp/generador.html',import.meta.url),'utf8');
  assert.ok(html.includes('get_stylebook')&&html.includes('update_stylebook'));
  const log=[];
  const mk=level=>({env:{PRES_SIGNING_KEY:'k'},access:{level,email:'x@admira.com',name:'X',sessionVersion:1,source:'directory'},fetchImpl:async(url,init)=>{log.push({url,method:init.method,body:init.body});const path=new URL(url).pathname+new URL(url).search;
    const text=path.includes('format=md')?'# Libro de estilo · X\n'+'x'.repeat(9000):JSON.stringify({ok:true,revision:2,path});return{status:200,ok:true,text:async()=>text}}});
  const md=await callTool(mk('editor'),'get_stylebook',{client:SLUG,format:'markdown'});
  assert.ok(typeof md==='string'&&md.length>9000,'el markdown sale entero (sin el recorte de 4000)');
  const json=await callTool(mk('editor'),'get_stylebook',{client:SLUG,section:'paleta'});assert.match(log.at(-1).url,/api\/stylebook\?section=paleta$/);assert.equal(json.ok,true);
  const full=await callTool(mk('editor'),'get_stylebook',{client:SLUG});assert.equal(full.styleBookUrl,`https://www.admiranext.com/presentaciones/${SLUG}/estilo`);
  const tpl=await callTool(mk('editor'),'get_stylebook',{template:true});assert.match(tpl.markdown,/Libro de estilo · <Nombre del cliente>/);
  await callTool(mk('editor'),'update_stylebook',{client:SLUG,section:'voz',body:'x',reason:'y',baseRevision:3});
  assert.equal(log.at(-1).method,'PUT');assert.deepEqual(JSON.parse(log.at(-1).body),{section:'voz',body:'x',reason:'y',baseRevision:3});
  await assert.rejects(()=>callTool(mk('editor'),'update_stylebook',{client:SLUG,section:'voz',body:'x'}),/reason es obligatorio/);
  await assert.rejects(()=>callTool(mk('editor'),'update_stylebook',{client:SLUG,reason:'y'}),/section/);
  await assert.rejects(()=>callTool(mk('editor'),'update_stylebook',{client:SLUG,section:'voz',reason:'y',x:1}),/Campos desconocidos/);
  await assert.rejects(()=>callTool(mk('viewer'),'get_stylebook',{client:SLUG}),/viewer/);
  await assert.rejects(()=>callTool(mk('viewer'),'update_stylebook',{client:SLUG,section:'voz',body:'x',reason:'y'}),/viewer/);
  const urls=await callTool(mk('viewer'),'presentation_urls',{client:SLUG});
  assert.equal(urls.styleBookUrl,`https://www.admiranext.com/presentaciones/${SLUG}/estilo`);assert.match(urls.estiloMd,/api\/stylebook\?format=md$/);assert.equal(urlsFor(SLUG).estilo,urls.styleBookUrl);
  const help=await callTool(mk('viewer'),'help',{tema:'estilo'});assert.match(help.help,/Libro de estilo/);assert.ok(help.temas.includes('estilo'));
  const rpc=await handleRpc({access:null},{jsonrpc:'2.0',id:1,method:'tools/list'});assert.ok(rpc.result.tools.some(t=>t.name==='update_stylebook'));
});

test('create_presentation devuelve styleBookUrl junto a las URLs',async()=>{
  const ctx={env:{PRES_SIGNING_KEY:'k'},access:{level:'editor',email:'x@admira.com',name:'X',sessionVersion:1,source:'directory'},fetchImpl:async()=>({status:202,ok:true,text:async()=>JSON.stringify({ok:true,jobId:'j',slug:'nuevo',status:'queued'})})};
  const out=await callTool(ctx,'create_presentation',{displayName:'Nuevo',website:'https://nuevo.example'});
  assert.equal(out.styleBookUrl,'https://www.admiranext.com/presentaciones/nuevo/estilo');assert.equal(out.urls.estilo,out.styleBookUrl);
});

test('middleware: el libro es interno — la contraseña del cliente lo deja fuera; la maestra entra',async()=>{
  const env={PRES_SIGNING_KEY:'sb-test-key',PRES_GENERIC:'1234',PRES_ADMIN:'maestra',PRESENTATION_IDEAS:kv()};
  const run=async(url,init={})=>{const data={};let reached=false;const response=await middleware({request:new Request(url,init),env,data,waitUntil(){},next:async()=>{reached=true;return new Response('ok')}});return{response,reached}};
  const login=async password=>{const form=new URLSearchParams({name:'Ana Prueba',email:'ana@example.com',password});const {response}=await run(`https://www.admiranext.com/presentaciones/${SLUG}/presentacion`,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:form});assert.equal(response.status,303);return response.headers.getSetCookie().map(c=>c.split(';',1)[0]).join('; ')};
  const client=await login('1234'),master=await login('maestra');
  const sala=await run(`https://www.admiranext.com/presentaciones/${SLUG}/presentacion`,{headers:{cookie:client,accept:'text/html'}});assert.equal(sala.reached,true,'el cliente sigue viendo la sala');
  const page=await run(`https://www.admiranext.com/presentaciones/${SLUG}/estilo`,{headers:{cookie:client,accept:'text/html'}});assert.equal(page.reached,false);assert.equal(page.response.status,401);
  const api=await run(`https://www.admiranext.com/presentaciones/${SLUG}/api/stylebook`,{headers:{cookie:client,accept:'application/json'}});assert.equal(api.reached,false);assert.equal(api.response.status,401);
  const write=await run(`https://www.admiranext.com/presentaciones/${SLUG}/api/stylebook`,{method:'PUT',headers:{cookie:client,origin:'https://www.admiranext.com','content-type':'application/json'},body:'{}'});assert.equal(write.reached,false);
  const ok=await run(`https://www.admiranext.com/presentaciones/${SLUG}/estilo`,{headers:{cookie:master,accept:'text/html'}});assert.equal(ok.reached,true);
  const okApi=await run(`https://www.admiranext.com/presentaciones/${SLUG}/api/stylebook?format=md`,{headers:{cookie:master,accept:'application/json'}});assert.equal(okApi.reached,true);
});

test('stylebookUrls y stylebookView son estables',()=>{
  assert.deepEqual(stylebookUrls('a-b'),{page:'/presentaciones/a-b/estilo',markdown:'/presentaciones/a-b/api/stylebook?format=md',api:'/presentaciones/a-b/api/stylebook'});
  const v=stylebookView(SLUG,null,ctx());assert.equal(v.series,SERIES_ID);assert.equal(v.revision,1);assert.equal(v.sections.filter(s=>!s.editable).length,2);
});

test('mediciones: se registran, sustituyen por item y aparecen en «lo medido»; también con una sección a la vez',()=>{
  const r=applyStylebookEdit(SLUG,null,{measured:[{item:'studio-a.mp4 · formato',value:'1920×1080 · 30 fps · 20,000 s',method:'ffprobe'}],reason:'medido en la box'},ctx(),editor,'2026-10-16T12:00:00Z');
  assert.deepEqual(r.changed,['medido-inferido']);assert.equal(r.doc.revision,2);
  let md=renderStylebookMarkdown(SLUG,r.doc,ctx());
  assert.match(md,/Mediciones registradas/);assert.match(md,/studio-a\.mp4 · formato \| 1920×1080 · 30 fps · 20,000 s \| ffprobe \| Lucas/);
  assert.doesNotMatch(md,/no\*\* re-medidos/);
  const again=applyStylebookEdit(SLUG,r.doc,{measured:[{item:'STUDIO-A.mp4 · formato',value:'otra',method:'ffprobe'}],section:'voz',body:'Voz nueva',reason:'dos cosas'},ctx(),editor);
  assert.equal(again.doc.measurements.length,1);assert.equal(again.doc.measurements[0].value,'otra');assert.deepEqual(again.changed.sort(),['medido-inferido','voz']);
  assert.throws(()=>applyStylebookEdit(SLUG,null,{measured:[],reason:'x'},ctx(),editor),/1 a 30/);
  assert.throws(()=>applyStylebookEdit(SLUG,null,{measured:[{item:'a'}],reason:'x'},ctx(),editor),/item y value/);
  assert.throws(()=>applyStylebookEdit(SLUG,null,{reason:'x'},ctx(),editor),/measured/);
});
