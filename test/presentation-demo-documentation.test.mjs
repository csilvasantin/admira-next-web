import test, {beforeEach, afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {GLOBALES} from '../subdemos/catalogo.mjs';
import {proyectoParaPresentacion, normalizarDemoProject, documentacionDemos} from '../subdemos/presentacion.mjs';
import {demoDocumentationSlides} from '../functions/presentaciones/_demo-documentation.js';
import {onRequestPut as generate} from '../functions/presentaciones/api/generate.js';
import {onRequestGet as render} from '../functions/presentaciones/[client]/presentacion.js';
import {DEFAULT_BEFORE_DECK} from '../functions/presentaciones/_deck-library.js';
import {TOOLS, callTool} from '../functions/mcp/_server.js';

const origin = 'https://www.admiranext.test';
test('package links use the actual protected presentation slug without adding or changing slides', () => {
  const project=normalizarDemoProject({id:'client-demo',nombre:'Client',demos:['studio/voz'],contexto:{marca:'client'}},{slug:'client',displayName:'Client'});
  const standalone=demoDocumentationSlides(project);
  assert.doesNotMatch(standalone,/data-demo-package-links/);
  const linked=demoDocumentationSlides(project,'en','','client');
  assert.equal((linked.match(/<section /g)||[]).length,1);
  assert.match(linked,/href="\/presentaciones\/client\/demo"/);
  assert.match(linked,/href="\/presentaciones\/client\/offline\?format=zip"/);
  assert.match(linked,/href="\/presentaciones\/client\/offline\?format=pdf"/);
  assert.match(linked,/data-demo-text-es="Ver demo global"/);
  assert.match(linked,/>View the full demo<\/a>/);
  assert.doesNotMatch(demoDocumentationSlides(project,'es','','../other'),/data-demo-package-links/);
});
const root = new URL('../', import.meta.url);
let realFetch, networkCalls;
beforeEach(() => {
  realFetch = globalThis.fetch;
  networkCalls = [];
  globalThis.fetch = async url => { networkCalls.push(String(url)); throw new Error('Unexpected real network: ' + url); };
});
afterEach(() => { globalThis.fetch = realFetch; assert.deepEqual(networkCalls, [], 'documentation must not invoke paid providers or network'); });

class KV {
  constructor(values = {}) { this.values = new Map(Object.entries(values).map(([k,v]) => [k,JSON.stringify(v)])); }
  async get(key, options) { const value = this.values.get(key); return value == null ? null : options?.type === 'json' ? JSON.parse(value) : value; }
  async put(key, value) { this.values.set(key, String(value)); }
  async list({prefix = ''} = {}) { return {keys:[...this.values.keys()].filter(k=>k.startsWith(prefix)).map(name=>({name})),list_complete:true}; }
}
const inspiration = {
  schemaVersion:1,url:'https://client.test/',finalUrl:'https://client.test/',host:'client.test',title:'Client',
  primary:'#12233e',accent:'#ffb000',background:'#f5f6f8',surface:'#ffffff',text:'#142238',
  palette:['#12233e','#ffb000'],mode:'light',fontStyle:'grotesk',radius:10,radiusStyle:'soft',density:'balanced',layout:'editorial',profile:'structured',
  logo:{type:'svg',sourceUrl:'https://client.test/',svg:'<svg viewBox="0 0 10 10"><path d="M0 0h10v10H0z"/></svg>'}
};
function environment(values) {
  return {PRESENTATION_IDEAS:new KV(values),PRES_SIGNING_KEY:'documentation-test-key',
    PRESENTATION_MEDIA:{async put() {}},ASSETS:{async fetch(input) {
      const url=new URL(typeof input==='string'?input:input.url || input.href);
      try { return new Response(await readFile(new URL('.'+url.pathname,root)),{headers:{'Content-Type':url.pathname.endsWith('.json')?'application/json':'image/svg+xml'}}); }
      catch { return new Response('not found',{status:404}); }
    }}};
}
async function put(env, extra = {}) {
  return generate({env,request:new Request(origin+'/presentaciones/api/generate',{method:'PUT',headers:{Origin:origin,'Content-Type':'application/json'},
    body:JSON.stringify({displayName:'Client',slug:'client',website:'https://client.test/',inspiration,outputs:['website','documents'],languages:['es'],...extra})})});
}
async function deck(env, slug='client', query='') {
  return (await render({env,params:{client:slug},request:new Request(origin+'/presentaciones/'+slug+'/presentacion'+query),next(){throw new Error('Unexpected legacy fallback');}})).text();
}
const saved = (env, key='presentation:client') => env.PRESENTATION_IDEAS.get(key,{type:'json'});

test('project selection requires one unique id, name or presentation_id match', () => {
  const first={id:'campaign-one',nombre:'Café Norte',presentation_id:'client',demos:['studio/voz']};
  const second={id:'campaign-two',nombre:'Café Sur',demos:['studio/video']};
  assert.equal(proyectoParaPresentacion([first,second],{slug:'client'}),first);
  assert.equal(proyectoParaPresentacion([first,second],{displayName:'CAFÉ NORTE'}),first);
  assert.equal(proyectoParaPresentacion([first,second],{slug:'unrelated'}),null);
  assert.equal(proyectoParaPresentacion([first,{...second,presentation_id:'client'}],{slug:'client'}),null);
});

test('explicit presentation binding wins over incidental id, name and brand matches', () => {
  const linked={id:'campaign-one',nombre:'Pilot',presentation_id:'alsea',demos:['studio/voz']};
  const byId={id:'alsea',nombre:'Another pilot',demos:['studio/musica']};
  const byName={id:'campaign-two',nombre:'Alsea',demos:['studio/video']};
  const byBrand={id:'starbucks',nombre:'Brand campaign',presentation_id:'starbucks',demos:['store']};
  assert.equal(proyectoParaPresentacion([byId,byName,byBrand,linked],{slug:'alsea',displayName:'Alsea',marca:'starbucks'}),linked);
  assert.equal(proyectoParaPresentacion([linked,{...byName,presentation_id:'alsea'},byId],{slug:'alsea'}),null);
  assert.equal(proyectoParaPresentacion([linked,byId],{displayName:'ALSEA'}),linked);
  assert.equal(proyectoParaPresentacion([byName],{slug:'another',displayName:'Alsea'}),byName);
  assert.equal(proyectoParaPresentacion([byId,byName],{slug:'alsea'}),null);
});

test('free text context is discarded without inventing IDs and preserves valid fields', () => {
  const project=normalizarDemoProject({demos:['store/tpv','biz/itil'],contexto:{marca:'Alsea Starbucks',loc:'Local 021',project:'starbucks',circuito:'alsea_starbucks'}},{slug:'alsea',marca:'starbucks'});
  assert.deepEqual(project.contexto,{marca:'starbucks',project:'starbucks',circuito:'alsea_starbucks'});
  for(const item of documentacionDemos(project)) {
    const url=new URL(item.url);
    assert.equal(url.searchParams.get('marca'),'starbucks');
    assert.equal(url.searchParams.has('loc'),false);
    assert.equal(url.searchParams.get('project'),'starbucks');
  }
  for(const invalid of ['../private','Alsea Starbucks','café','x'.repeat(81)]) {
    const context=Object.fromEntries(['marca','loc','project','circuito'].map(k=>[k,invalid]));
    const result=normalizarDemoProject({demos:['studio'],contexto:context},{slug:'client',marca:'client-brand'});
    assert.deepEqual(result.contexto,{marca:'client-brand'});
  }
  assert.deepEqual(normalizarDemoProject({demos:['studio'],contexto:{marca:'  north-brand  ',loc:'location_21'}},{slug:'client'}).contexto,{marca:'north-brand',loc:'location_21'});
});

test('normalization snapshots selection, migrates old keys and rejects invalid input', () => {
  const raw={id:'campaign',nombre:'Café Norte',demos:['studio/locucion','studio/voz','studio/formatos'],contexto:{marca:'norte'},propuestas:{'studio/voz':'Aviso de tienda'}};
  const project=normalizarDemoProject(raw,{slug:'norte',displayName:'Café Norte'});
  assert.deepEqual(project.demos,['studio/voz','studio/adaptar']);
  raw.demos.length=0;raw.contexto.marca='other';raw.propuestas['studio/voz']='Changed';
  assert.equal(project.contexto.marca,'norte');assert.equal(project.propuestas['studio/voz'],'Aviso de tienda');
  assert.equal(project.demos.length,2);
  for(const value of [null,[],{demos:'studio'},{demos:['unknown']},{demos:[{}]},{demos:['studio'],contexto:[]},{demos:['studio'],propuestas:[]}]) {
    assert.throws(()=>normalizarDemoProject(value,{slug:'norte'}));
  }
});

test('Alsea documentation uses selected pilot while other clients remove Starbucks context', () => {
  const before=JSON.stringify(GLOBALES);
  const alsea=normalizarDemoProject(undefined,{slug:'alsea',displayName:'Alsea'});
  const alseaLinks=documentacionDemos(alsea);
  const store=new URL(alseaLinks.find(d=>d.clave==='store/tpv').url);
  assert.equal(store.searchParams.get('marca'),'starbucks');assert.equal(store.searchParams.get('loc'),'alsea-sbux-021');
  assert.equal(store.searchParams.get('circuit'),'alsea_starbucks');assert.equal(store.searchParams.get('project'),'starbucks');
  const other=normalizarDemoProject({id:'norte',nombre:'Café Norte',demos:['biz/itil','store/tpv','studio/voz']},{slug:'norte',displayName:'Café Norte',marca:'norte'});
  for(const item of documentacionDemos(other,'en')) {
    const url=new URL(item.url);assert.equal(url.searchParams.get('marca'),'norte');assert.equal(url.searchParams.get('lang'),'en');
    for(const key of ['loc','project','circuit','circuito'])assert.equal(url.searchParams.has(key),false);
    assert.doesNotMatch(item.url,/starbucks|alsea/i);
  }
  assert.equal(JSON.stringify(GLOBALES),before);
});

test('captured documentation keeps names and URLs when the shared catalog subsequently changes', () => {
  const project=normalizarDemoProject({id:'norte',nombre:'Café Norte',demos:['studio/voz'],contexto:{marca:'norte'}},{slug:'norte'});
  const expected=documentacionDemos(project);
  const entry=GLOBALES.find(g=>g.id==='studio').subdemos.find(s=>s.id==='voz');
  const original={nombre:entry.nombre,desc:entry.desc,url:entry.url};
  try {
    Object.assign(entry,{nombre:'Changed catalog title',desc:'Changed description',url:'https://other.test/different'});
    assert.deepEqual(documentacionDemos(project),expected);
    assert.equal(project.documentacion[0].url,original.url);
    assert.notEqual(project.documentacion[0],entry);
  } finally { Object.assign(entry,original); }
});

test('an explicit different brand within Alsea does not inherit the Starbucks pilot', () => {
  const project=normalizarDemoProject(undefined,{slug:'alsea-burger-king',displayName:'Alsea · Burger King',marca:'burger-king'});
  for(const item of documentacionDemos(project)) {
    const url=new URL(item.url);assert.equal(url.searchParams.get('marca'),'burger-king');
    assert.doesNotMatch(item.url,/starbucks|alsea-sbux|alsea_starbucks/i);
  }
});

test('HTML documentation escapes copy and belongs to proposal without dynamic block indexes', () => {
  const project=normalizarDemoProject({id:'norte',nombre:'Café <script>alert(1)</script>',nota:'A & B',demos:['studio/voz'],propuestas:{'studio/voz':'<img src=x onerror=alert(2)>'}},{slug:'norte'});
  const html=demoDocumentationSlides(project,'en');
  assert.match(html,/data-section="proposal"/);assert.match(html,/data-demo-key="studio\/voz"/);
  assert.match(html,/What we propose/);assert.match(html,/lang=en/);
  assert.match(html,/&lt;script&gt;/);assert.match(html,/&lt;img/);assert.doesNotMatch(html,/<script>|<img src=x|data-block=/);
});

test('new API presentation defaults to corporate opening and stores documentation for web and production', async () => {
  const env=environment();const response=await put(env);const body=await response.json();
  assert.equal(response.status,201,JSON.stringify(body));assert.equal(body.sequence.before,DEFAULT_BEFORE_DECK);
  const config=await saved(env);assert.equal(config.demoProject.contexto.marca,'client');
  assert.deepEqual(body.demoProject,config.demoProject);
  const production=await saved(env,'generation:client');
  assert.match(production.sourceText,/QUÉ PROPONEMOS · DEMOS PERSONALIZADAS/);
  assert.match(production.sourceText,/Crear locución/);assert.match(production.sourceText,/marca=client/);
  const html=await deck(env);
  assert.equal((html.match(/data-segment="before"/g)||[]).length,42);
  for(const section of ['who','what','proposal'])assert.match(html,new RegExp('data-section="'+section+'"'));
  assert.deepEqual([...html.matchAll(/data-section-target="([^"]+)"/g)].map(m=>m[1]),['who','what','proposal']);
  assert.equal((html.match(/data-section="who"/g)||[]).length,10);
  assert.equal((html.match(/data-section="what"/g)||[]).length,32);
  assert.doesNotMatch(html,/data-section="how"/);
  assert.equal((html.match(/class="slide demo-documentation"/g)||[]).length,config.demoProject.demos.length);
  assert.ok(html.lastIndexOf('data-demo-key=')<html.indexOf('data-slide-key="closing"'));
});

test('Alsea API includes the corporate story and its selected personalized pilot documentation', async () => {
  const env=environment();const response=await put(env,{displayName:'Alsea',slug:'alsea'});const body=await response.json();
  assert.equal(response.status,201,JSON.stringify(body));
  assert.equal(body.demoProject.id,'alsea-starbucks');assert.equal(body.demoProject.contexto.marca,'starbucks');
  const html=await deck(env,'alsea');
  assert.match(html,/Quiénes somos/);assert.match(html,/Qué hacemos/);assert.match(html,/Qué proponemos/);
  assert.match(html,/data-demo-key="store\/tpv"/);assert.match(html,/data-demo-key="studio\/adaptar"/);
  assert.match(html,/loc=alsea-sbux-021/);assert.match(html,/circuit=alsea_starbucks/);
  assert.match(html,/Locuciones para anunciar productos y promociones de Starbucks/);
  const source=(await saved(env,'generation:alsea')).sourceText;
  assert.match(source,/alsea-sbux-021/);assert.match(source,/Música para acompañar los momentos de consumo/);
});

test('explicit no-opening survives regeneration and existing selected project is preserved', async () => {
  for(const beforeDeck of ['',null]) {
    const env=environment();
    const project={id:'campaign',nombre:'Selected campaign',demos:['studio/video'],contexto:{marca:'client'}};
    const first=await put(env,{beforeDeck,demoProject:project});assert.equal(first.status,201);
    const original=await saved(env);assert.equal(original.sequence.before,null);
    assert.equal((await put(env,{overwrite:true})).status,201);
    const next=await saved(env);assert.equal(next.sequence.before,null);assert.deepEqual(next.demoProject,original.demoProject);
    assert.doesNotMatch(await deck(env),/data-segment="before"/);
  }
});

test('API tolerates editor free text context and falls back to resolved client brand', async () => {
  const env=environment();
  const response=await put(env,{displayName:'Lumbre Café',slug:'lumbre-cafe',prospect:{activo:true,marca:'lumbre'},demoProject:{id:'lumbre-campaign',demos:['store/tpv','studio/voz'],contexto:{marca:'Alsea Starbucks',loc:'Local 021',project:'../private',circuito:'circuit_demo'}}});
  assert.equal(response.status,201,await response.clone().text());
  const config=await saved(env,'presentation:lumbre-cafe');
  assert.deepEqual(config.demoProject.contexto,{marca:'lumbre',circuito:'circuit_demo'});
  for(const item of documentacionDemos(config.demoProject)) {
    const url=new URL(item.url);
    assert.equal(url.searchParams.get('marca'),'lumbre');
    assert.equal(url.searchParams.get('circuit'),'circuit_demo');
    assert.equal(url.searchParams.has('loc'),false);assert.equal(url.searchParams.has('project'),false);
    assert.doesNotMatch(item.url,/starbucks|private|Local/i);
  }
});

test('API rejects invalid projects before persistence and retains the closed input contract', async () => {
  for(const extra of [{demoProject:{demos:['studio/missing']}},{demoProject:[]},{demoProject:{demos:['studio'],contexto:[]}},{demoProjects:[]}]) {
    const env=environment();const response=await put(env,extra);assert.equal(response.status,400);
    assert.equal(env.PRESENTATION_IDEAS.values.size,0);
  }
});

test('prospect brand, rather than presentation slug, customizes demo links', async () => {
  const env=environment();const response=await put(env,{displayName:'Lumbre Café',slug:'lumbre-cafe',prospect:{activo:true,marca:'lumbre'}});
  assert.equal(response.status,201,await response.clone().text());
  const config=await saved(env,'presentation:lumbre-cafe');assert.equal(config.prospect.marca,'lumbre');
  assert.equal(config.demoProject.contexto.marca,'lumbre');
  for(const item of documentacionDemos(config.demoProject))assert.equal(new URL(item.url).searchParams.get('marca'),'lumbre');
});

test('legacy presentation without demo snapshot renders no client-specific appendix', async () => {
  const env=environment({'presentation:client':{displayName:'Legacy',outputs:['website'],languages:['es'],theme:{},sequence:{before:null}},
    'ideas:client':{hero:{title:'Legacy',summary:'Summary'},objective:'Objective',skeleton:[],closing:{title:'Close',action:'Act'},labels:{objective:'Objective',next:'Next'}}});
  const html=await deck(env);
  assert.doesNotMatch(html,/class="slide demo-documentation"|data-demo-key=/);
  assert.deepEqual([...html.matchAll(/data-section-target="([^"]+)"/g)].map(m=>m[1]),['who','what','how','proposal']);
});

test('language switch updates appendix controls and personalized URLs', async () => {
  const env=environment();assert.equal((await put(env)).status,201);
  const html=await deck(env);
  assert.match(html,/data-demo-text-en="Open demonstration"/);assert.match(html,/data-demo-href-en="[^\"]*lang=en/);
  const functionSource=html.match(/function applyLanguage\(language\)\{[^\n]+\}/)?.[0];
  assert.ok(functionSource,'exercise the actual language-switch function emitted by the renderer');
  const textNode={textContent:'Abrir demostración',getAttribute(key){return {'data-demo-text-en':'Open demonstration','data-demo-text-es':'Abrir demostración'}[key];}};
  const linkNode={href:'https://www.admira.studio/audio.html?marca=client&lang=es',getAttribute(key){return {'data-demo-href-en':'https://www.admira.studio/audio.html?marca=client&lang=en','data-demo-href-es':this.href}[key];}};
  const fields=new Map();const field=id=>{if(!fields.has(id))fields.set(id,{textContent:''});return fields.get(id);};
  const sandbox={presentationState:{locales:{en:{hero:{},closing:{},labels:{},skeleton:[]}},emptyLocale:{},uiLabels:{en:{presentation:'Presentation'},es:{}},displayName:'Client'},
    document:{documentElement:{lang:'es'},getElementById:field,
      querySelector:selector=>selector==='[data-edit-field="hero.eyebrow"]'?field('eyebrow'):null,
      querySelectorAll:selector=>selector==='[data-demo-text]'?[textNode]:selector==='[data-demo-link]'?[linkNode]:[],dispatchEvent(){}},
    applyDeckSource(){},syncNav(){},CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}}};
  vm.createContext(sandbox);vm.runInContext(functionSource,sandbox);sandbox.applyLanguage('en');
  assert.equal(textNode.textContent,'Open demonstration');assert.equal(new URL(linkNode.href).searchParams.get('lang'),'en');
  assert.equal(sandbox.document.documentElement.lang,'en');
});

test('MCP retains the selected project object in its asynchronous creation request', async () => {
  assert.equal(TOOLS.find(t=>t.name==='create_presentation').inputSchema.properties.demoProject.type,'object');
  const project={id:'norte',nombre:'Café Norte',demos:['studio/voz'],contexto:{marca:'norte'}};
  const calls=[];
  const ctx={env:{PRES_SIGNING_KEY:'test-key'},access:{email:'editor@admira.test',level:'editor',name:'Test'},fetchImpl:async(url,init)=>{
    calls.push({url,method:init.method,body:JSON.parse(init.body)});
    return Response.json({ok:true,slug:'norte',jobId:'simulated-job',status:'queued'});
  }};
  const result=await callTool(ctx,'create_presentation',{displayName:'Café Norte',slug:'norte',website:'https://client.test/',demoProject:project});
  assert.equal(result.status,'queued');assert.equal(calls.length,1);
  assert.equal(new URL(calls[0].url).pathname,'/presentaciones/api/jobs');assert.equal(calls[0].method,'POST');
  assert.deepEqual(calls[0].body.demoProject,project);
});

test('API stores a custom validated catalog and renders its captured documentation without global mutation', async () => {
  const before=JSON.stringify(GLOBALES),env=environment();
  const catalogo=[{version:1,plataforma:'store',subdemos:[{id:'promo-local',nombre:'Promoción local',desc:'Recorrido propio',url:'https://www.admira.store/promo',aliases:['promo'],caso:{local:'Ejemplo'}}]}];
  const response=await put(env,{demoProject:{id:'client',demos:['store/promo-local'],catalogo}});
  assert.equal(response.status,201,await response.clone().text());
  const config=await saved(env);assert.equal(config.demoProject.documentacion[0].clave,'store/promo-local');
  assert.equal(config.demoProject.documentacion[0].caso.local,'Ejemplo');assert.deepEqual(config.demoProject.catalogo,catalogo);
  const html=await deck(env);assert.match(html,/Promoción local/);assert.match(html,/data-demo-key="store\/promo-local"/);assert.match(html,/https:\/\/www.admira.store\/promo\?marca=client/);
  assert.equal(JSON.stringify(GLOBALES),before);
  const other=environment(),rejected=await put(other,{demoProject:{demos:['store/promo-local']}});
  assert.equal(rejected.status,400);assert.equal(other.PRESENTATION_IDEAS.values.size,0);
});

test('API rejects unsafe custom catalog URL before storing presentation', async () => {
  const env=environment(),response=await put(env,{demoProject:{demos:['store/promo-local'],catalogo:[{plataforma:'store',subdemos:[{id:'promo-local',nombre:'Bad',url:'javascript:alert(1)'}]}]}});
  assert.equal(response.status,400);assert.equal(env.PRESENTATION_IDEAS.values.size,0);
});
