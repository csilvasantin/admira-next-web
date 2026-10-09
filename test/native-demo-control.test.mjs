import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const engine=readFileSync(new URL('../suite/demo-control.js',import.meta.url),'utf8');
const suite=readFileSync(new URL('../suite/experto.js',import.meta.url),'utf8');
function fixture({platform='store',host='www.admira.store',path='/',run='new-run',saved=null,source=engine,selectors=true,embedded=false,lang='es'}={}){
  let now=0,nextId=0;const jobs=new Map(),nodes=[],fields=new Map(),writes=[],storage=new Map(),assigned=[],frameRequests=[];
  const flush=async()=>{for(let i=0;i<14;i++)await Promise.resolve();};
  function element(tag='input'){
    const attrs={},classes=new Set(),listeners=new Map();
    const e={tagName:tag.toUpperCase(),attrs,children:[],style:{},dataset:{},isConnected:true,value:'original',textContent:'',disabled:false,hidden:false,open:false,currentTime:0,paused:true,options:[{value:'browser',textContent:'browser'}],
      classList:{contains:x=>classes.has(x),add:x=>classes.add(x),remove:x=>classes.delete(x),toggle(x,on){if(on===undefined)on=!classes.has(x);on?classes.add(x):classes.delete(x);}},
      setAttribute(k,v){attrs[k]=String(v);},getAttribute(k){return attrs[k]??null;},removeAttribute(k){delete attrs[k];},
      appendChild(child){this.children.push(child);child.parentNode=this;},remove(){this.isConnected=false;this.parentNode?.children.splice(this.parentNode.children.indexOf(this),1);},
      addEventListener(t,f){if(!listeners.has(t))listeners.set(t,new Set());listeners.get(t).add(f);},removeEventListener(t,f){listeners.get(t)?.delete(f);},dispatchEvent(event){for(const fn of [...listeners.get(event.type)||[]])fn(event);},eventListeners(t){return [...listeners.get(t)||[]];},
      getBoundingClientRect(){return{width:120,height:36,left:20,top:50};},scrollIntoView(){},focus(){},closest(){return null;},
      click(){this.clicks=(this.clicks||0)+1;this.setAttribute('aria-expanded','true');this.onclick?.();},
      play(){this.plays=(this.plays||0)+1;this.paused=false;return Promise.resolve();},pause(){this.paused=true;},load(){},querySelector(){return null;},querySelectorAll(){return[];}};
    if(tag==='iframe'){e.contentWindow={location:new URL('about:blank')};e.contentDocument=null;}
    Object.defineProperty(e,'src',{get(){return attrs.src||'';},set(v){attrs.src=String(v);if(tag==='iframe')frameRequests.push(String(v));}});nodes.push(e);return e;
  }
  const body=element('body'),head=element('head'),documentElement=element('html');documentElement.lang=lang;
  const document={body,head,documentElement,readyState:'loading',currentScript:{dataset:{},src:'https://www.admiranext.com/suite/experto.js'},
    createElement:element,addEventListener(){},removeEventListener(){},dispatchEvent(){},getElementById(id){return nodes.find(n=>n.id===id&&n.isConnected)||null;},
    querySelectorAll(selector){if(!selectors)return[];if(!fields.has(selector))fields.set(selector,element());return[fields.get(selector)];},querySelector(){return null;}};
  const location=new URL(`https://${host}${path}?ax_demo=${platform}&ax_run=${run}`);location.assign=u=>assigned.push(String(u));
  const sessionStorage={getItem:k=>storage.get(k)??null,setItem(k,v){storage.set(k,String(v));writes.push([k,String(v)]);},removeItem:k=>storage.delete(k)};
  if(saved)storage.set('admira-native-demo-v1:'+platform,JSON.stringify(saved));
  const G={document,location,sessionStorage,localStorage:sessionStorage,URL,URLSearchParams,innerWidth:1280,innerHeight:850,
    history:{replaceState(a,b,url){G.replaced=String(url);}},getComputedStyle:()=>({display:'block',visibility:'visible'}),
    Event:class{constructor(type){this.type=type;}},CustomEvent:class{constructor(type,options){this.type=type;this.detail=options?.detail;}},
    addEventListener(){},dispatchEvent(){},MutationObserver:class{observe(){}disconnect(){}},fetch:async()=>({ok:false,json:async()=>({})}),
    setTimeout(fn,ms){const id=++nextId;jobs.set(id,{fn,time:now+ms});return id;},clearTimeout:id=>jobs.delete(id),performance:{now:()=>now}};
  G.self=G;G.top=embedded?{}:G;G.window=G;G.globalThis=G;
  vm.runInNewContext(source,G,{filename:source===engine?'demo-control.js':'experto.js'});
  function loadFrame(url,controls=true){
    const frame=nodes.find(n=>n.tagName==='IFRAME');assert.ok(frame);
    const destination=new URL(url||frame.src);frame.contentWindow.location=destination;
    const frameFields=new Map();
    const doc=destination.origin===location.origin?{head:element('head'),body:element('body'),readyState:'complete',createElement:element,
      querySelectorAll(selector){if(!controls)return[];if(!frameFields.has(selector))frameFields.set(selector,element());return[frameFields.get(selector)];},querySelector(selector){return this.querySelectorAll(selector)[0]||null;}}:null;
    frame.contentDocument=doc;frame.dispatchEvent({type:'load'});return{frame,doc,fields:frameFields};
  }
  return{G,api:G.AdmiraDemoControl,document,fields,nodes,writes,storage,assigned,frameRequests,loadFrame,flush,
    async tick(ms){const end=now+ms;await flush();for(let n=0;n<20000;n++){const task=[...jobs.entries()].filter(([,j])=>j.time<=end).sort((a,b)=>a[1].time-b[1].time)[0];if(!task){now=end;await flush();return;}jobs.delete(task[0]);now=task[1].time;task[1].fn();await flush();}throw Error('fixture timer runaway');}};
}
function paused(platform='store',options={}){return fixture({platform,saved:{run:'new-run',index:0,active:true,paused:true},...options});}
function at(index,options={}){return paused('store',{saved:{run:'new-run',index,active:true,paused:true},...options});}

test('hoy walks five checked steps and does not copy a secret into the verdict',()=>{
  assert.equal(fixture({platform:'hoy',host:'evil.example',path:'/arquitectura'}).api,undefined);
  assert.equal(fixture({platform:'store',host:'www.admira.biz'}).api,undefined);
  const home=fixture({platform:'hoy',host:'www.admiranext.com',path:'/'});
  assert.equal(home.api,undefined);
  assert.match(home.assigned[0], /\/arquitectura\?/);
  assert.equal(new URL(home.assigned[0]).searchParams.get('ax_demo'),'hoy');
  const f=fixture({platform:'hoy',host:'www.admiranext.com',path:'/arquitectura',run:'hoy-1'});
  assert.equal(f.api.state().demo,'hoy');
  assert.equal([...f.api.steps()].map(s=>s.id).join(','),'caja,idioma,idioma-pata,architecture,agentes');
  assert.equal(f.api.valorarIdioma([
    {titulo:'Organigrama tecnológico',tituloDoc:'Organigrama tecnológico · ADmiraNeXT',cuerpo:'Cómo se hablan las webs'},
    {titulo:'Technology org chart',tituloDoc:'Technology org chart · ADmiraNeXT',cuerpo:'How the Admira websites talk'},
    {titulo:'Organigrama tecnológico',tituloDoc:'Organigrama tecnológico · ADmiraNeXT',cuerpo:'Cómo se hablan las webs'}
  ],true).estado,'bien');
  assert.equal(f.api.valorarIdioma([
    {titulo:'Organigrama tecnológico',tituloDoc:'Organigrama tecnológico',cuerpo:'igual'},
    {titulo:'Organigrama tecnológico',tituloDoc:'Organigrama tecnológico',cuerpo:'igual'}
  ],true).estado,'mal');
  const pata=f.api.valorarIdioma([
    {titulo:'Retail Media en el mundo real',tituloDoc:'Mapa de espacios comerciales | admira.biz',cuerpo:'Login · Modo avanzado'},
    {titulo:'Retail Media in the real world',tituloDoc:'Mapa de espacios comerciales | admira.biz',cuerpo:'Login · Advanced mode'}
  ],false);
  assert.equal(pata.estado,'bien');
  assert.match(pata.detalle,/pestaña se queda/);
  const pendiente=f.api.valorarAgente(200,{ok:true,desplegado:true,sesion:false,nombre:null,token:'no-se-copia'});
  assert.equal(pendiente.estado,'pendiente');
  assert.doesNotMatch(pendiente.detalle,/no-se-copia/);
  assert.equal(f.api.valorarAgente(404,{desplegado:false}).estado,'pendiente');
  assert.match(f.api.valorarAgente(200,{sesion:true,nombre:'SmithMacMini',desplegado:true}).detalle,/200 · SmithMacMini/);
  f.api.control('stop');
  assert.equal(f.api.state().activo,false);
  assert.equal(f.document.getElementById('admira-native-demo'),null);
});
test('page demos stay on admiranext, open their page and list real checks',()=>{
  assert.equal(fixture({platform:'proyectos',host:'evil.example',path:'/proyectos/'}).api,undefined);
  const home=fixture({platform:'proyectos',host:'www.admiranext.com',path:'/'});
  assert.equal(home.api,undefined);
  assert.match(home.assigned[0],/\/proyectos\/\?/);
  assert.equal(new URL(home.assigned[0]).searchParams.get('ax_demo'),'proyectos');
  const ids={
    proyectos:['/proyectos/','columna,censo,orden,numero'],
    idioma:['/','texto,espanol,ingles,vuelta'],
    marcas:['/marcablanca/','portada,catalogo,piel84,apagada'],
    roadmap:['/roadmap','titulo,gantt,hitos,idioma'],
  };
  for (const [id,[path,want]] of Object.entries(ids)) {
    const f=fixture({platform:id,host:'www.admiranext.com',path,lang:'es'});
    assert.equal(f.api.state().demo,id);
    assert.equal([...f.api.steps()].map(s=>s.id).join(','),want);
    f.api.control('stop');
    assert.equal(f.document.getElementById('admira-native-demo'),null);
  }
  const en=fixture({platform:'marcas',host:'www.admiranext.com',path:'/marcablanca/',lang:'en'});
  assert.match(en.api.steps()[2].text,/\/brand 84/);
  const html=fixture({platform:'roadmap',host:'127.0.0.1',path:'/roadmap.html'});
  assert.equal(html.api.state().demo,'roadmap');
});
test('native engine rejects a foreign host, wrong platform and embedded frame',()=>{
  for(const host of ['evil.example','admira.store.evil.example','www.admira.biz'])assert.equal(fixture({host}).api,undefined);
  assert.equal(fixture({platform:'unknown'}).api,undefined);
  assert.equal(fixture({embedded:true}).api,undefined);
});

test('all five native plans contain real controls and TV does not dispatch physical tour or store navigation',()=>{
  const plans=[['studio','www.admira.studio','#a-guion'],['store','www.admira.store','#announcementText'],['tv','admira.tv','#human-inspect'],['biz','www.admira.biz','#circuit-select'],['app','www.admira.app','#site-search']];
  for(const [platform,host,selector] of plans){const f=paused(platform,{host});assert.ok(f.api,platform+' plan exists');const steps=f.api.steps();assert.ok(steps.length>=5,platform);if(selector)assert.ok(steps.some(s=>s.selector===selector),platform);assert.ok(steps.every(s=>s.text&&s.action));if(platform==='tv')assert.ok(steps.every(s=>!['#human-tour-start','#universe-tour-start','#human-store-twin'].includes(s.selector)));}
});

test('pause freezes subsequent actions and resume does not repeat the pending click',async()=>{
  const f=paused();f.api.control('resume');await f.tick(1300);const first=f.fields.get('#pfOptions');assert.equal(first.clicks,1);
  f.api.control('pause');const phase=f.api.state().fase;await f.tick(30000);assert.equal(f.api.state().fase,phase);assert.equal(first.clicks,1);
  f.api.control('resume');await f.tick(2400);assert.equal(first.clicks,1);assert.equal(f.api.state().fase,phase+1);f.api.control('stop');
});

test('stop restores modified fields but preserves a later human edit',async()=>{
  const index=paused().api.steps().findIndex(s=>s.action==='fill');assert.ok(index>=0);
  for(const humanEdit of [false,true]){const f=at(index);f.api.control('resume');await f.tick(1300+24*200);const field=[...f.fields.values()][0];assert.notEqual(field.value,'original');if(humanEdit)field.value='human edit';f.api.control('stop');assert.equal(field.value,humanEdit?'human edit':'original');assert.equal(f.api.state().activo,false);assert.ok(!f.storage.has('admira-native-demo-v1:store'));assert.doesNotMatch(f.G.replaced,/ax_demo|ax_run/);}
});

test('video advancement requires ended; pause/resume keeps playback position and stop cancels stale events',async()=>{
  const index=paused().api.steps().findIndex(s=>s.action==='video');const f=at(index);f.api.control('resume');await f.flush();const video=f.nodes.find(n=>n.tagName==='VIDEO');assert.ok(video);assert.equal(video.paused,false);
  assert.equal(video.muted,false);f.api.control('mute');assert.equal(video.muted,true);f.api.control('mute');assert.equal(video.muted,false);
  await f.tick(600000);assert.equal(f.api.state().fase,index+1,'time alone cannot finish media');video.currentTime=7.25;f.api.control('pause');assert.equal(video.paused,true);await f.tick(30000);assert.equal(video.currentTime,7.25);
  f.api.control('resume');await f.flush();assert.equal(video.currentTime,7.25);video.dispatchEvent({type:'ended'});await f.flush();assert.equal(f.api.state().fase,index+2);
  f.api.control('stop');const phase=f.api.state().fase;video.dispatchEvent({type:'ended'});await f.tick(30000);assert.equal(f.api.state().fase,phase);assert.equal(video.paused,true);
});

test('video failure is an honest paused error and does not report completion',async()=>{
  const index=paused().api.steps().findIndex(s=>s.action==='video');const f=at(index);f.api.control('resume');await f.flush();f.nodes.find(n=>n.tagName==='VIDEO').dispatchEvent({type:'error'});await f.flush();assert.equal(f.api.state().pausado,true);assert.equal(f.api.state().activo,true);assert.equal(f.api.state().fase,index+1);assert.match(f.api.state().error,/vídeo|video/i);f.api.control('stop');
});

test('next skips a playing clip, hides cinema and ignores its stale ended callback',async()=>{
  const index=paused().api.steps().findIndex(s=>s.action==='video');
  const f=at(index);f.api.control('resume');await f.flush();
  const video=f.nodes.find(n=>n.tagName==='VIDEO'),cinema=f.document.getElementById('admira-native-cinema');
  assert.equal(video.paused,false);assert.equal(cinema.hidden,false);
  const [staleEnded]=video.eventListeners('ended');assert.equal(typeof staleEnded,'function');
  f.api.control('next');await f.flush();
  assert.equal(cinema.hidden,true);assert.equal(video.paused,true);
  assert.equal(video.eventListeners('ended').length,0,'retired media listeners are removed');
  assert.equal(f.api.state().fase,index+2);assert.equal(f.api.state().activo,true);
  staleEnded();video.dispatchEvent({type:'ended'});await f.tick(650);
  assert.equal(f.api.state().fase,index+2,'the old clip cannot complete the new step');
  assert.equal(cinema.hidden,true);assert.equal(video.paused,true);assert.equal(f.api.state().error,'');
  f.api.control('stop');
});

test('the final Store clip completes at phase N of N without navigating or replaying',async()=>{
  const steps=paused().api.steps(),index=steps.length-1;assert.equal(steps[index].action,'video');
  const f=at(index);f.api.control('resume');await f.flush();
  const video=f.nodes.find(n=>n.tagName==='VIDEO'),cinema=f.document.getElementById('admira-native-cinema');
  assert.equal(video.paused,false);assert.equal(f.api.state().activo,true);
  assert.equal(f.api.state().fase,steps.length);assert.equal(cinema.hidden,false);
  // The browser finishes playback before delivering the real ended event.
  video.paused=true;video.ended=true;video.dispatchEvent({type:'ended'});await f.flush();
  const state=f.api.state();assert.equal(state.activo,false);assert.equal(state.pausado,false);
  assert.equal(state.fase,steps.length);assert.equal(state.fases,steps.length);assert.ok(state.fase<=state.fases);
  assert.equal(video.paused,true);assert.equal(video.ended,true);assert.equal(video.plays,1);
  assert.equal(cinema.hidden,true);assert.equal(f.assigned.length,0);assert.equal(state.error,'');
  video.dispatchEvent({type:'ended'});await f.tick(10000);
  assert.equal(f.api.state().fase,steps.length);assert.equal(video.plays,1);f.api.control('stop');
});

test('same-run handoff retains the cursor and fresh run ignores a completed old session',async()=>{
  const old={run:'old-run',index:4,active:false,paused:true};const fresh=fixture({run:'fresh-run',saved:old});assert.equal(fresh.api.state().fase,1);assert.equal(fresh.api.state().activo,true);fresh.api.control('stop');
  const retained=fixture({run:'old-run',saved:{...old,active:true}});assert.equal(retained.api.state().fase,5);assert.equal(retained.api.state().pausado,true);retained.api.control('stop');
  const app=paused('app',{host:'www.admira.app',path:'/'});app.api.control('resume');await app.flush();const next=new URL(app.assigned[0]);assert.equal(next.pathname,'/retailer');assert.equal(next.searchParams.get('ax_demo'),'app');assert.equal(next.searchParams.get('ax_run'),'new-run');app.api.control('stop');
});

test('Studio reuses one same-origin native frame while switching actual tools, without navigating the narrated parent',async()=>{
  const f=paused('studio',{host:'www.admira.studio'}),frame=f.nodes.find(n=>n.tagName==='IFRAME'),panel=f.document.getElementById('admira-native-demo');
  f.api.control('resume');await f.flush();assert.equal(f.assigned.length,0);assert.equal(new URL(frame.src).pathname,'/audio');
  const audio=f.loadFrame();await f.tick(1300+24*100);const original=audio.fields.get('#proj-cliente');assert.notEqual(original.value,'original');
  const music=f.api.steps().findIndex(s=>s.path==='/musica');while(f.api.state().fase<music+1){f.api.control('next');await f.flush();}
  assert.equal(f.nodes.filter(n=>n.tagName==='IFRAME').length,1);assert.equal(f.document.getElementById('admira-native-demo'),panel);assert.equal(frame,f.nodes.find(n=>n.tagName==='IFRAME'));assert.equal(new URL(frame.src).pathname,'/musica');assert.equal(original.value,'original');
  for(const request of f.frameRequests){const u=new URL(request);assert.equal(u.origin,'https://www.admira.studio');assert.ok(['/audio','/musica','/imagenes','/video','/adaptaciones/'].includes(u.pathname));assert.equal(u.searchParams.has('ax_demo'),false,'frame must not start a second engine');}
  f.loadFrame();await f.flush();assert.equal(f.assigned.length,0);f.api.control('stop');assert.equal(frame.isConnected,false);
});

test('Studio in English stays on the same step and loads /en/ of that tool',async()=>{
  const f=paused('studio',{host:'www.admira.studio',lang:'en'});
  const frame=f.nodes.find(n=>n.tagName==='IFRAME');
  f.api.control('resume');await f.flush();
  assert.equal(f.assigned.length,0);
  assert.equal(new URL(frame.src).pathname,'/en/audio');
  f.loadFrame();
  const fase=f.api.state().fase;
  const caption=f.document.getElementById('admira-native-demo').children.find(n=>n.getAttribute&&n.getAttribute('data-demo-phase')==='');
  assert.match(String(caption.textContent),/coffee shop|voice|welcome/i);
  f.api.idioma('es');
  assert.equal(f.api.state().fase,fase);
  assert.equal(f.api.state().activo,true);
  assert.equal(new URL(frame.src).pathname,'/audio');
  assert.doesNotMatch(String(caption.textContent),/coffee shop welcome|We will prepare/i);
  f.loadFrame();
  f.api.idioma('en');
  assert.equal(f.api.state().fase,fase);
  assert.equal(new URL(frame.src).pathname,'/en/audio');
  f.api.control('stop');
});

test('Studio pause cancels pending load; late readiness cannot advance until resume',async()=>{
  const f=paused('studio',{host:'www.admira.studio'});f.api.control('resume');await f.flush();f.api.control('pause');const loaded=f.loadFrame();await f.tick(60000);assert.equal(f.api.state().fase,1);assert.equal(loaded.fields.size,0);assert.equal(f.api.state().pausado,true);
  f.api.control('resume');await f.tick(1300+24*100);assert.notEqual(loaded.fields.get('#proj-cliente').value,'original');assert.equal(f.frameRequests.length,1);f.api.control('stop');
});

test('Studio stock rebuilt during cursor aim clicks only the connected replacement once',async()=>{
  const plan=paused('studio',{host:'www.admira.studio'}).api.steps();
  const index=plan.findIndex(s=>s.action==='stock');assert.ok(index>=0);
  const step=plan[index],f=paused('studio',{host:'www.admira.studio',saved:{run:'new-run',index,active:true,paused:true}});
  f.api.control('resume');await f.flush();
  const loaded=f.loadFrame();
  const old=loaded.doc.querySelectorAll(step.selector)[0];old.textContent=step.value;loaded.doc.body.appendChild(old);
  await f.tick(650);
  assert.equal(old.classList.contains('admira-demo-target'),true,'the original catalog node was found and aimed at');
  assert.equal(old.clicks||0,0);assert.equal(f.api.state().fase,index+1);
  old.remove();
  const replacement=loaded.doc.createElement('li');replacement.textContent=step.value;
  loaded.doc.body.appendChild(replacement);loaded.fields.set(step.selector,replacement);
  await f.tick(650);
  assert.equal(old.isConnected,false);assert.equal(old.clicks||0,0);
  assert.equal(replacement.isConnected,true);assert.equal(replacement.clicks||0,0);
  assert.equal(f.api.state().fase,index+1,'a detached node does not falsely complete the phase');
  await f.tick(1300);
  assert.equal(old.clicks||0,0);assert.equal(replacement.clicks,1);
  assert.equal(f.api.state().fase,index+1,'the replacement click still waits for narration');
  await f.tick(2400);
  assert.equal(f.api.state().fase,index+2);assert.equal(replacement.clicks,1);
  assert.equal(f.api.state().pausado,false);assert.equal(f.api.state().error,'');
  f.api.control('stop');
});

test('Studio frame timeout, auth redirect and missing controls pause honestly without completed steps',async()=>{
  for(const failure of ['timeout','auth','missing','foreign']){
    const f=paused('studio',{host:'www.admira.studio'});f.api.control('resume');await f.flush();
    if(failure==='auth')f.loadFrame('https://www.admira.studio/auth/login');
    if(failure==='foreign')f.loadFrame('https://evil.example/login');
    if(failure==='missing')f.loadFrame(undefined,false);
    await f.tick(31000);assert.equal(f.api.state().fase,1,failure);assert.equal(f.api.state().activo,true);assert.equal(f.api.state().pausado,true);assert.ok(f.api.state().error,failure);
    f.api.control('resume');await f.flush();f.loadFrame('https://www.admira.studio/audio',true);await f.tick(1300+24*100);assert.equal(f.api.state().error,'');assert.equal(f.api.state().pausado,false);f.api.control('stop');
  }
});

test('Biz reveals the circuit panel only when hidden and does not toggle it again after pause',async()=>{
  const plan=paused('biz',{host:'www.admira.biz'}).api.steps();
  const index=plan.findLastIndex(s=>s.action==='reveal');assert.ok(index>=0);
  const step=plan[index];assert.equal(step.selector,'#header-circuit-btn');assert.equal(step.value,'#circuit-panel');
  for(const initiallyVisible of [true,false]){
    const f=paused('biz',{host:'www.admira.biz',saved:{run:'new-run',index,active:true,paused:true}});
    const panel=f.document.createElement('section');panel.hidden=!initiallyVisible;f.document.body.appendChild(panel);
    f.document.querySelector=selector=>selector===step.value?panel:null;
    f.G.getComputedStyle=el=>({display:el.hidden?'none':'block',visibility:'visible'});
    const header=f.document.querySelectorAll(step.selector)[0];header.onclick=()=>{panel.hidden=!panel.hidden;};
    f.api.control('resume');await f.tick(1300);
    const expectedClicks=initiallyVisible?0:1;
    assert.equal(header.clicks||0,expectedClicks);assert.equal(panel.hidden,false);
    assert.equal(f.api.state().fase,index+1,'the reveal still waits for narration');
    f.api.control('pause');await f.tick(20000);
    assert.equal(f.api.state().fase,index+1);assert.equal(header.clicks||0,expectedClicks);assert.equal(panel.hidden,false);
    f.api.control('resume');await f.tick(2400);
    assert.equal(f.api.state().fase,index+2);assert.equal(header.clicks||0,expectedClicks,'resume never replays the panel toggle');
    assert.equal(panel.hidden,false);assert.equal(f.api.state().error,'');f.api.control('stop');
  }
});

test('solution launcher uses correct native destinations and an independent run each launch',()=>{
  const f=fixture({host:'www.admiranext.com',platform:'none',source:suite,selectors:false});
  for(const platform of ['studio','store','tv','biz','app']){const first=new URL(f.G.AdmiraExperto.demoLaunchUrl(platform)),second=new URL(f.G.AdmiraExperto.demoLaunchUrl(platform));assert.equal(first.searchParams.get('ax_demo'),platform);assert.ok(first.searchParams.get('ax_run'));assert.notEqual(first.searchParams.get('ax_run'),second.searchParams.get('ax_run'));if(platform==='store')assert.equal(first.searchParams.has('demo'),false);if(platform==='app')assert.equal(first.hostname,'www.admira.app');}
});
