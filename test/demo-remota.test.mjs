import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {normalizeNarrationText,clientSlug,visibleSlideText,extractPresentationSlides,buildRemotePlan,hashNarrationText} from '../demo/remote-plan.mjs';
import {createRemoteRunner} from '../demo/remote-runner.mjs';
import {normalizarDemoProject} from '../subdemos/presentacion.mjs';
import {videoPorDemo} from '../subdemos/retail-videos.mjs';

// Public saved catalogue, never a copy of a client's private presentation.
const studio=JSON.parse(readFileSync(new URL('../subdemos/studio.subdemos.json',import.meta.url),'utf8'));
const base=normalizarDemoProject(undefined,{slug:'alsea',displayName:'Alsea'});
const project=normalizarDemoProject({...base,catalogo:[studio]},{slug:'alsea',displayName:'Alsea'});
function fixture(){
 const slides=Array.from({length:19},(_,i)=>({text:'Generic story slide '+(i+1)}));
 slides.push(...project.documentacion.map(d=>({text:'Generic appendix '+d.clave,demoKey:d.clave})));
 slides.push({text:'Generic closing slide 38'});
 return slides;
}
function harness(){
 const shown=[],voices=[],changes=[];let offers=0;
 const runner=createRemoteRunner({show:(segment,index)=>shown.push({segment,index}),changed:s=>changes.push(s),completed:()=>offers++,
  narrate:(segment,ended,failed)=>{const voice={segment,ended,failed,cancels:0,pauses:0,resumes:0,cancel(){this.cancels++;},pause(){this.pauses++;},resume(){this.resumes++;}};voices.push(voice);return voice;}});
 return{runner,shown,voices,changes,get offers(){return offers;},finish:()=>voices.at(-1).ended()};
}
const smallPlan=[{id:'first',text:'First'},{id:'last',text:'Last'}];

test('38 slides plus 15 saved functions and 72 phases produce 110 segments, with closing last',()=>{
 const slides=fixture(),before=JSON.stringify(project),plan=buildRemotePlan(slides,project);
 assert.equal(slides.length,38);assert.equal(project.documentacion.length,18);
 assert.equal(plan.length,110);assert.equal(plan.filter(s=>s.type==='slide').length,38);
 const phases=plan.filter(s=>s.type==='demo-phase');assert.equal(phases.length,72);assert.equal(new Set(phases.map(s=>s.demoKey)).size,15);
 assert.equal(new Set(plan.map(s=>s.id)).size,110);
 assert.equal(plan.at(-1).type,'slide');assert.equal(plan.at(-1).slideIndex,37);assert.equal(plan.at(-1).text,'Generic closing slide 38');
 assert.equal(JSON.stringify(project),before,'planning preserves captured documentation');
 for(const d of project.documentacion){
  const slideIndex=slides.findIndex(s=>s.demoKey===d.clave),items=phases.filter(s=>s.demoKey===d.clave);
  if(!d.clave.includes('/')){assert.equal(items.length,0);continue;}
  assert.equal(items.length,d.guion.length);assert.deepEqual(items.map(s=>s.phaseIndex),d.guion.map((_,i)=>i));
  assert.ok(items.every(s=>s.slideIndex===slideIndex));
  const at=plan.findIndex(s=>s.type==='slide'&&s.slideIndex===slideIndex);assert.deepEqual(plan.slice(at+1,at+1+items.length),items);
 }
});
test('normalization and SHA256 use visible canonical text; slug validation rejects routes and query injection',async()=>{
 assert.equal(normalizeNarrationText(' Cafe\u0301\n  texto\t '),'Café texto');
 assert.equal(await hashNarrationText('Cafe\u0301 \n texto'),await hashNarrationText('Café texto'));
 assert.notEqual(await hashNarrationText('Texto distinto'),await hashNarrationText('Café texto'));
 assert.match(await hashNarrationText('Café texto'),/^[a-f0-9]{64}$/);
 assert.equal(clientSlug('alsea-starbucks'),'alsea-starbucks');
 for(const bad of ['../private','alsea?audience=0','Alsea','a/b','a#hash','a'.repeat(81),''])assert.equal(clientSlug(bad),'');
});
test('planning rejects inaccessible/empty decks and incomplete saved rehearsals instead of reporting ready',()=>{
 for(const slides of [[],null,Array(301).fill({text:'slide'}),[{text:' \n '}]] )assert.throws(()=>buildRemotePlan(slides,project));
 assert.throws(()=>buildRemotePlan(fixture(),null),/documentation/);
 assert.throws(()=>buildRemotePlan(fixture(),project,'fr'),/language/);
 assert.throws(()=>buildRemotePlan([{text:'Cover'}],project),/absent/);
 const local={documentacion:[{clave:'store/custom',titulo:'Custom',guion:[]}]};
 assert.throws(()=>buildRemotePlan([{text:'Demo',demoKey:'store/custom'}],local),/steps/);
 local.documentacion[0].guion=[{texto:' '}];assert.throws(()=>buildRemotePlan([{text:'Demo',demoKey:'store/custom'}],local),/phase/);
});

// A small tree implements DOM clone/remove/query, so pruning is exercised rather than prefiltered.
class Node {
 constructor(tag,text='',attrs={},children=[]){this.tagName=tag.toUpperCase();this.ownText=text;this.attrs=attrs;this.children=children;children.forEach(n=>n.parent=this);this.dataset={};if(attrs['data-demo-key'])this.dataset.demoKey=attrs['data-demo-key'];}
 get textContent(){return[this.ownText,...this.children.map(c=>c.textContent)].filter(Boolean).join(' ');}
 cloneNode(){return new Node(this.tagName,this.ownText,{...this.attrs},this.children.map(c=>c.cloneNode(true)));}
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(c=>c!==this);}
 querySelectorAll(selector){const rules=selector.split(',');const matches=(node,s)=>{s=s.trim();if(s.includes(' ')){const [parent,child]=s.split(' ');return matches(node,child)&&matches(node.parent||new Node('none'),parent);}if(s.startsWith('[')){const m=s.match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/);return m&&m[1] in node.attrs&&(m[2]===undefined||node.attrs[m[1]]===m[2]);}if(s.startsWith('#'))return node.attrs.id===s.slice(1);const [tag,klass]=s.split('.');return(!tag||node.tagName===tag.toUpperCase())&&(!klass||(node.attrs.class||'').split(' ').includes(klass));};const all=this.children.flatMap(c=>[c,...c.querySelectorAll('*')]);return selector==='*'?all:all.filter(n=>rules.some(s=>matches(n,s)));}
}
test('slide narration strips private notes, links, hidden DOM and navigation before hashing; source DOM is intact',()=>{
 const p=(text,attrs={},children=[])=>new Node('p',text,{class:'detail',...attrs},children);
 const slide=new Node('section','',{class:'slide','data-demo-key':'studio/voz'},[
  new Node('h2','Visible title'),p('Visible detail',{},[new Node('a','PRIVATE LINK',{href:'/private'})]),
  p('PRIVATE NOTE',{'data-speaker-notes':'secret'}),p('HIDDEN',{hidden:''}),p('ARIA HIDDEN',{'aria-hidden':'true'}),
  p('PRESENTER',{class:'presenter-notes'}),p('FOOTER',{class:'slide-footer'}),p('EYEBROW',{class:'eyebrow'}),
  new Node('script','SCRIPT'),new Node('style','STYLE'),new Node('nav','NAV'),new Node('button','BUTTON'),
  new Node('h3','Visible title')]);
 assert.equal(visibleSlideText(slide),'Visible title. Visible detail');assert.match(slide.textContent,/PRIVATE NOTE/);
 const result=extractPresentationSlides({querySelectorAll:s=>s==='.slide'?[slide]:[]});assert.deepEqual(result,[{slideIndex:0,demoKey:'studio/voz',text:'Visible title. Visible detail'}]);
});

test('every natural segment must finish before completion offer, including the final closing narration',()=>{
 const h=harness(),plan=buildRemotePlan(fixture(),project);h.runner.start(plan);
 for(let i=0;i<plan.length;i++){assert.equal(h.runner.snapshot().index,i);assert.equal(h.offers,0);h.finish();}
 assert.equal(h.offers,1);assert.equal(h.shown.length,110);assert.equal(h.shown.at(-1).segment.slideIndex,37);assert.equal(h.runner.snapshot().state,'complete');
 h.finish();assert.equal(h.offers,1,'duplicate ended event never repeats offer');
});
test('pause freezes progress and resumes the same voice; ended/error events while paused cannot advance',()=>{
 const h=harness();h.runner.start(smallPlan);const voice=h.voices[0];h.runner.pause();
 voice.ended();voice.failed('late error');assert.equal(h.runner.snapshot().state,'paused');assert.equal(h.runner.snapshot().index,0);assert.equal(h.offers,0);assert.equal(voice.pauses,1);
 h.runner.resume();assert.equal(voice.resumes,1);assert.equal(h.voices.length,1);voice.ended();assert.equal(h.runner.snapshot().index,1);assert.equal(h.offers,0);
});
test('stop and restart cancel old speech/audio contract and discard all stale callbacks',()=>{
 const h=harness();h.runner.start(smallPlan);const old=h.voices[0];h.runner.stop();assert.equal(old.cancels,1);
 old.ended();old.failed('late');assert.equal(h.runner.snapshot().state,'idle');assert.equal(h.offers,0);
 h.runner.start(smallPlan);old.ended();old.failed('late');assert.equal(h.runner.snapshot().index,0);assert.equal(h.runner.snapshot().state,'running');
 const current=h.voices.at(-1);h.runner.start(smallPlan);assert.equal(current.cancels,1);current.ended();assert.equal(h.runner.snapshot().index,0);
});
test('manual next does not offer completion even when every remaining segment finishes naturally',()=>{
 const h=harness();h.runner.start(smallPlan);const old=h.voices[0];h.runner.pause();h.runner.next();assert.equal(old.cancels,1);assert.equal(h.runner.snapshot().fullySeen,false);
 old.ended();assert.equal(h.runner.snapshot().index,1);h.finish();assert.equal(h.runner.snapshot().state,'complete');assert.equal(h.offers,0);
 const final=harness();final.runner.start([{id:'closing'}]);final.runner.next();assert.equal(final.runner.snapshot().state,'idle');assert.equal(final.offers,0);
});
test('narration error stops progression until explicit fallback; failed voice callbacks never advance fallback',()=>{
 const h=harness();h.runner.start(smallPlan);const old=h.voices[0];old.failed('voice blocked');
 assert.equal(old.cancels,1);assert.equal(h.runner.snapshot().state,'error');old.ended();assert.equal(h.runner.snapshot().index,0);assert.equal(h.offers,0);
 h.runner.fallback();old.ended();old.failed('late');assert.equal(h.runner.snapshot().state,'running');assert.equal(h.runner.snapshot().index,0);
 h.finish();h.finish();assert.equal(h.offers,1,'explicit full fallback may complete the full plan');
});

function controller({status=200,body={demoProject:project},deckReady=false,audioMap={segments:[]},slideInput=fixture(),clock=null,savedSound=null}={}){
 const nodes=new Map(),calls=[],audios=[],storage=new Map();let speeches=0;
 if(savedSound)storage.set('admira-demo-audio-v1',JSON.stringify(savedSound));
 const get=id=>{if(!nodes.has(id)){const classes=new Set();nodes.set(id,{value:'',hidden:true,disabled:false,textContent:'',checked:false,dataset:{},attributes:{},children:[],listeners:{},plays:0,pauses:0,ended:false,currentTime:0,classList:{add:k=>classes.add(k),remove:k=>classes.delete(k),contains:k=>classes.has(k)},addEventListener(n,fn){this.listeners[n]=fn;},replaceChildren(...items){this.children=items;},append(...items){this.children.push(...items);},setAttribute(k,v){this.attributes[k]=v;},getAttribute(k){return this[k]??this.attributes[k];},removeAttribute(k){delete this[k];delete this.attributes[k];},scrollIntoView(){},querySelectorAll(){return[];},play(){this.plays++;this.paused=false;return Promise.resolve();},pause(){this.pauses++;this.paused=true;},load(){}});}return nodes.get(id);};
 get('remote-client').value='alsea-starbucks';get('remote-start').disabled=true;
 const slides=slideInput.map(s=>{const node=new Node('section','',{'class':'slide',...(s.demoKey?{'data-demo-key':s.demoKey}:{})},[new Node('h2',s.text)]);node.scrollIntoView=()=>{};return node;});
 const frame=get('remote-deck');frame.contentDocument={querySelector:()=>deckReady?slides[0]:null,querySelectorAll:selector=>deckReady&&selector==='.slide'?slides:[]};
 Object.defineProperty(frame,'src',{set(){queueMicrotask(()=>frame.onload?.());}});
 class AudioSpy {constructor(){this.paused=true;this.plays=0;this.pauses=0;this.loads=0;audios.push(this);}pause(){this.paused=true;this.pauses++;}load(){this.loads++;}removeAttribute(name){delete this[name];}addEventListener(){}play(){this.paused=false;this.plays++;return Promise.resolve();}}
 const context={document:{getElementById:get,querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){}},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},location:{href:'https://www.admiranext.test/demo/#remota',origin:'https://www.admiranext.test',hash:'#remota'},clientSlug,extractPresentationSlides,buildRemotePlan,hashNarrationText,createRemoteRunner,videoPorDemo,URL,Audio:AudioSpy,Option:function(){},setTimeout:clock?.setTimeout||setTimeout,clearTimeout:clock?.clearTimeout||clearTimeout,...(clock?{Date:class extends Date {static now(){return clock.now();}}}:{}),
  fetch:async(url,options)=>{calls.push({url,options});return{ok:status>=200&&status<300,status,json:async()=>url.includes('/remote-audio')?audioMap:body};},addEventListener(){},speechSynthesis:{cancel(){},getVoices(){return[];},speak(){speeches++;}},SpeechSynthesisUtterance:function(){}};
 context.window=context;vm.createContext(context);const source=readFileSync(new URL('../demo/remota.js',import.meta.url),'utf8').replace(/^import[^\n]+\n/gm,'');vm.runInContext(source,context);
 return{get,calls,audios,storage,run:code=>vm.runInContext(code,context),get speeches(){return speeches;},click:id=>get(id).listeners.click?.(),change:id=>get(id).listeners.change?.()};
}

for(const status of [401,403,503])test('protected API '+status+' never makes an iframe load a successful ready state',async()=>{
 const c=controller({status});await c.click('remote-load');assert.equal(c.get('remote-start').disabled,true);assert.equal(c.get('remote-deck').hidden,true);assert.equal(c.get('remote-record').hidden,true);assert.equal(c.speeches,0);assert.equal(c.calls.length,1);assert.equal(c.calls[0].options.credentials,'same-origin');assert.equal(c.calls[0].options.method,undefined);
});
test('login/error iframe without .slide is rejected even after successful demo-project API',async()=>{
 const c=controller();await c.click('remote-load');assert.equal(c.get('remote-start').disabled,true);assert.equal(c.get('remote-deck').hidden,true);assert.match(c.get('remote-status').textContent,/acceso/);assert.equal(c.speeches,0);
});
test('invalid slug and missing captured documentation do not start narration or recording',async()=>{
 const invalid=controller();invalid.get('remote-client').value='../other';await invalid.click('remote-load');assert.equal(invalid.calls.length,0);assert.equal(invalid.get('remote-start').disabled,true);
 const missing=controller({body:{demoProject:null}});await missing.click('remote-load');assert.equal(missing.get('remote-start').disabled,true);assert.equal(missing.get('remote-record').hidden,true);assert.equal(missing.speeches,0);
});
test('verified prepared narration uses one persistent Audio, starts only on click and cancels on stop',async()=>{
 const plan=buildRemotePlan(fixture(),project);
 const entries=await Promise.all(plan.slice(0,2).map(async segment=>({id:segment.id,textHash:await hashNarrationText(segment.text),duration:5,url:'https://www.admiranext.test/presentaciones/alsea-starbucks/remote-audio?segment='+segment.id})));
 const c=controller({deckReady:true,audioMap:{segments:entries}});
 try{
  await c.click('remote-load');assert.equal(c.get('remote-start').disabled,false);assert.equal(c.audios.length,1);assert.equal(c.audios[0].plays,0);assert.equal(c.speeches,0);
  assert.match(c.get('remote-status').textContent,/38 diapositivas.*15 demos.*72 pasos/);
  c.click('remote-start');assert.equal(c.audios[0].plays,1);assert.equal(c.audios[0].src,entries[0].url);
  const firstEnded=c.audios[0].onended;c.click('remote-pause');assert.equal(c.audios[0].paused,true);firstEnded();assert.equal(c.audios[0].plays,1);
  c.click('remote-pause');assert.equal(c.audios[0].plays,2);firstEnded();assert.equal(c.audios.length,1);assert.equal(c.audios[0].plays,3);assert.equal(c.audios[0].src,entries[1].url);
  const secondEnded=c.audios[0].onended;c.click('remote-stop');assert.equal(c.audios[0].paused,true);assert.ok(c.audios[0].loads>0);secondEnded();assert.equal(c.audios[0].plays,3);assert.equal(c.get('remote-record').hidden,true);
  assert.ok(c.calls.every(call=>!call.options?.method||call.options.method==='GET'));
 }finally{c.click('remote-stop');}
});
function fakeClock(){
 let time=0,next=0;const timers=new Map();
 return{now:()=>time,setTimeout:(fn,ms)=>{timers.set(++next,{fn,due:time+ms});return next;},clearTimeout:id=>timers.delete(id),tick(ms){const target=time+ms;for(;;){const [id,timer]=[...timers].sort((a,b)=>a[1].due-b[1].due).find(([,v])=>v.due<=target)||[];if(!timer)break;timers.delete(id);time=timer.due;timer.fn();}time=target;}};
}
test('minimum slide and phase holds preserve paused remainder and postpone offer until closing hold ends',async()=>{
 const saved={documentacion:[{clave:'store/custom',titulo:'Generic demo',guion:[{texto:'Generic phase'}]}]};
 const slides=[{text:'Generic demo slide',demoKey:'store/custom'},{text:'Generic closing'}],plan=buildRemotePlan(slides,saved);
 const entries=await Promise.all(plan.map(async segment=>({id:segment.id,textHash:await hashNarrationText(segment.text),duration:1,url:'https://www.admiranext.test/presentaciones/alsea-starbucks/remote-audio?segment='+segment.id})));
 const clock=fakeClock(),c=controller({body:{demoProject:saved},deckReady:true,slideInput:slides,audioMap:{segments:entries},clock});
 try{
  await c.click('remote-load');assert.equal(c.get('remote-start').disabled,false);c.click('remote-start');
  const audio=c.audios[0];clock.tick(1000);audio.onended();assert.equal(audio.src,entries[0].url);clock.tick(999);assert.equal(audio.plays,1);
  c.click('remote-pause');clock.tick(10000);assert.equal(audio.plays,1);assert.equal(c.get('remote-record').hidden,true);
  c.click('remote-pause');clock.tick(2000);assert.equal(audio.plays,1);clock.tick(1);assert.equal(audio.src,entries[1].url);assert.equal(audio.plays,2);
  clock.tick(1000);audio.onended();clock.tick(1499);assert.equal(audio.src,entries[1].url);clock.tick(1);assert.equal(audio.src,entries[2].url);assert.equal(audio.plays,3);
  clock.tick(1000);audio.onended();clock.tick(2999);assert.equal(c.get('remote-record').hidden,true);clock.tick(1);assert.equal(c.get('remote-record').hidden,false);
 }finally{c.click('remote-stop');}
});
test('mismatched prepared text hash never plays the audio or falsely announces narration success',async()=>{
 const c=controller({deckReady:true,audioMap:{segments:[{id:'s001',textHash:'0'.repeat(64),duration:2,url:'https://www.admiranext.test/presentaciones/alsea-starbucks/remote-audio?segment=s001'}]}});
 try{
  await c.click('remote-load');assert.match(c.get('remote-warnings').textContent,/no coincide/);c.click('remote-start');assert.equal(c.audios[0].plays,0);assert.equal(c.get('remote-record').hidden,true);assert.equal(c.get('remote-fallback').hidden,false);
 }finally{c.click('remote-stop');}
});
const preparedVideo={version:1,tipo:'video',url:'https://www.admiranext.com/assets/demos/suite-v1/store-voz.mp4',poster:'https://www.admiranext.com/assets/demos/suite-v1/store-voz.jpg',audio:true,idioma:'es',descripcion:'Generic prepared function',fuente:'ensayo-local'};
async function retailController({demos=[{clave:'store/custom',titulo:'Generic function',guion:[{texto:'Generic first phase'},{texto:'Generic final phase'}],video:preparedVideo}],savedSound=null}={}){
 const saved={documentacion:demos},slides=[...demos.map(d=>({text:'Generic function slide '+d.clave,demoKey:d.clave})),{text:'Generic closing'}],segments=buildRemotePlan(slides,saved),clock=fakeClock();
 const entries=await Promise.all(segments.map(async segment=>({id:segment.id,textHash:await hashNarrationText(segment.text),duration:5,url:'https://www.admiranext.test/presentaciones/alsea-starbucks/remote-audio?segment='+segment.id})));
 const c=controller({body:{demoProject:saved},deckReady:true,slideInput:slides,audioMap:{segments:entries},clock,savedSound});await c.click('remote-load');return{...c,clock,segments,entries,state:()=>c.run('runner.snapshot().state'),index:()=>c.run('runner.snapshot().index'),start:async()=>{c.click('remote-start');await Promise.resolve();},voiceEnd:()=>c.audios[0].onended?.(),videoEnd:()=>{c.get('remote-video').ended=true;c.get('remote-video').onended?.();}};
}
test('remote final phase narrates first and waits for actual persistent clip ended before closing or completion',async()=>{
 const c=await retailController();try{
  const clip=c.get('remote-video');assert.equal(clip.plays,0);assert.equal(c.audios.length,1);await c.start();assert.equal(clip.plays,1,'Start primes the one persistent video');assert.equal(clip.paused,true);
  c.voiceEnd();assert.equal(c.index(),1);assert.equal(clip.plays,1);c.voiceEnd();assert.equal(c.index(),2);assert.equal(clip.plays,1,'earlier rehearsal phases never play the function reel');assert.equal(c.get('remote-demo').classList.contains('video-playing'),false);
  const finalVoiceEnd=c.audios[0].onended;c.voiceEnd();assert.equal(c.index(),2);assert.equal(clip.plays,2);assert.equal(clip.hidden,false);assert.equal(clip.muted,false);assert.equal(c.get('remote-record').hidden,true);assert.equal(c.get('remote-demo').classList.contains('video-playing'),true);
  finalVoiceEnd();assert.equal(clip.plays,2,'duplicate narration end does not restart the reel');c.clock.tick(60000);assert.equal(c.index(),2,'clock duration cannot complete a playing clip');
  const clipEnded=clip.onended;c.videoEnd();assert.equal(c.index(),3);assert.equal(c.audios[0].src,c.entries[3].url);clipEnded();finalVoiceEnd();assert.equal(c.index(),3,'duplicate old events cannot skip the closing');assert.equal(c.get('remote-demo').classList.contains('video-playing'),false);
  assert.equal(c.get('remote-record').hidden,true);c.voiceEnd();assert.equal(c.state(),'complete');assert.equal(c.get('remote-record').hidden,false);assert.equal(c.audios.length,1);
 }finally{c.click('remote-stop');}
});
test('clip pause preserves position, paused ended cannot advance, and stop/restart rejects stale video callbacks',async()=>{
 const c=await retailController();try{
  await c.start();c.voiceEnd();c.voiceEnd();c.voiceEnd();const clip=c.get('remote-video'),ended=clip.onended,error=clip.onerror;clip.currentTime=13;
  c.click('remote-pause');assert.equal(clip.paused,true);ended();assert.equal(c.state(),'paused');assert.equal(c.index(),2);c.clock.tick(10000);assert.equal(c.index(),2);
  c.click('remote-pause');assert.equal(clip.currentTime,13);assert.equal(clip.paused,false);assert.equal(clip.plays,3);
  c.click('remote-stop');ended();error();assert.equal(c.state(),'idle');assert.equal(c.get('remote-record').hidden,true);assert.equal(c.get('remote-demo').classList.contains('video-playing'),false);
  await c.start();ended();error();assert.equal(c.state(),'running');assert.equal(c.index(),0);assert.equal(c.get('remote-record').hidden,true);
 }finally{c.click('remote-stop');}
});
test('sound settings independently mute narration and clips, persist across players and enforce native mute',async()=>{
 const c=await retailController({savedSound:{narration:false,samples:true,muted:false}});try{
  await c.start();const voice=c.audios[0],clip=c.get('remote-video');assert.equal(voice.muted,true);assert.equal(clip.muted,false);assert.equal(c.get('remote-narration').checked,false);assert.equal(c.get('remote-sound').checked,true);
  c.click('remote-mute');assert.equal(voice.muted,true);assert.equal(clip.muted,true);assert.equal(c.get('remote-mute').attributes['aria-pressed'],'true');clip.muted=false;clip.listeners.volumechange();assert.equal(clip.muted,true);
  c.click('remote-mute');assert.equal(voice.muted,true);assert.equal(clip.muted,false);c.get('remote-sound').checked=false;c.change('remote-sound');assert.equal(clip.muted,true);
  const saved=JSON.parse(c.storage.get('admira-demo-audio-v1'));assert.deepEqual(saved,{narration:false,samples:false,muted:false});const reload=controller({savedSound:saved});assert.equal(reload.get('remote-sound').checked,false);assert.equal(reload.audios[0].muted,true);
  c.run("demoVideo.dataset.hasAudio='false'");c.get('remote-sound').checked=true;c.change('remote-sound');assert.equal(clip.muted,true,'video audio:false remains silent');
 }finally{c.click('remote-stop');}
});
test('invalid second video clears the primed source and fails locally rather than replaying or completing a previous function',async()=>{
 const demos=[{clave:'store/first',titulo:'Generic first',guion:[{texto:'Generic phase'}],video:preparedVideo},{clave:'store/second',titulo:'Generic second',guion:[{texto:'Generic phase'}],video:{...preparedVideo,url:'javascript:alert(1)'}}];
 const c=await retailController({demos});try{
  await c.start();c.voiceEnd();c.voiceEnd();c.videoEnd();assert.equal(c.index(),2);c.get('remote-video').ended=false;c.voiceEnd();assert.equal(c.get('remote-video').src,undefined);c.voiceEnd();assert.equal(c.state(),'error');assert.equal(c.index(),3);assert.match(c.get('remote-status').textContent,/ruta no válida/);assert.equal(c.get('remote-record').hidden,true);assert.equal(c.get('remote-fallback').textContent,'Reintentar fase y vídeo');
 }finally{c.click('remote-stop');}
});
test('duplicate narration end preserves clip watchdog; video failure never advances or offers recording',async()=>{
 const c=await retailController();try{
  await c.start();c.voiceEnd();c.voiceEnd();const ended=c.audios[0].onended;c.voiceEnd();ended();c.clock.tick(330000);assert.equal(c.state(),'error');assert.equal(c.index(),2);assert.match(c.get('remote-status').textContent,/Vídeo de .*no ha terminado/);assert.equal(c.get('remote-record').hidden,true);
 }finally{c.click('remote-stop');}
});
for(const reason of ['NotAllowedError','NotSupportedError'])test('prepared clip '+reason+' blocks the function and requires explicit retry without recording',async()=>{
 const c=await retailController();try{
  await c.start();c.voiceEnd();c.voiceEnd();const clip=c.get('remote-video');clip.play=()=>Promise.reject(Object.assign(new Error('test'),{name:reason}));c.voiceEnd();await Promise.resolve();await Promise.resolve();
  assert.equal(c.state(),'error');assert.equal(c.index(),2);assert.equal(c.get('remote-record').hidden,true);assert.equal(c.get('remote-fallback').textContent,'Reintentar fase y vídeo');
  assert.match(c.get('remote-status').textContent,reason==='NotAllowedError'?/autorizar el sonido/:/acceso o formato/);
  const index=c.index();c.clock.tick(600000);assert.equal(c.index(),index);assert.equal(c.state(),'error');
 }finally{c.click('remote-stop');}
});
test('a stale Start prime promise cannot pause, rewind or mute a clip from a restarted run',async()=>{
 const c=await retailController();try{
  const clip=c.get('remote-video'),play=clip.play.bind(clip);let resolveOld;
  clip.play=()=>{clip.plays++;clip.paused=false;clip.play=play;return new Promise(resolve=>{resolveOld=resolve;});};
  await c.start();c.click('remote-stop');await c.start();c.voiceEnd();c.voiceEnd();c.voiceEnd();clip.currentTime=17;const pauses=clip.pauses;
  resolveOld();await Promise.resolve();await Promise.resolve();assert.equal(clip.pauses,pauses);assert.equal(clip.currentTime,17);assert.equal(clip.paused,false);assert.equal(c.index(),2);
 }finally{c.click('remote-stop');}
});
test('recording intent is an explicit button, never a POST, provider generation or form submission',()=>{
 const html=readFileSync(new URL('../demo/index.html',import.meta.url),'utf8');assert.match(html,/<aside id="remote-record"[^>]*\bhidden/);assert.match(html,/<button type="button"[^>]*id="remote-record-intent"/);
 const c=controller();c.click('remote-record-intent');assert.equal(c.calls.length,0);assert.equal(c.speeches,0);assert.match(c.get('remote-record-status').textContent,/No se ha iniciado ninguna grabación/);
});

// Optional local evidence: paths supplied by QA, never copied to the repository or printed.
const privateFixture=process.env.REMOTE_QA_HTML&&process.env.REMOTE_QA_PROJECT&&process.env.REMOTE_QA_PLAYWRIGHT;
test('actual private audience DOM has all 38 slides, 72 phases and closing as last segment', {skip:!privateFixture},async()=>{
 const {chromium}=await import(process.env.REMOTE_QA_PLAYWRIGHT);
 const browser=await chromium.launch({headless:true,...(process.env.REMOTE_QA_BROWSER?{executablePath:process.env.REMOTE_QA_BROWSER}:{})});
 try{
  const page=await browser.newPage();await page.route('**/*',route=>route.abort());
  const html=readFileSync(process.env.REMOTE_QA_HTML,'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
  await page.setContent(html,{waitUntil:'domcontentloaded'});
  const source=readFileSync(new URL('../demo/remote-plan.mjs',import.meta.url),'utf8').replace(/^export /gm,'');
  const slides=await page.evaluate(code=>new Function('document',code+';return extractPresentationSlides(document);')(document),source);
  const stored=JSON.parse(readFileSync(process.env.REMOTE_QA_PROJECT,'utf8'));
  const real=stored.demoProject||stored.presentation?.demoProject||stored;
  const plan=buildRemotePlan(slides,real);assert.equal(slides.length,38);assert.equal(plan.length,110);assert.equal(plan.filter(p=>p.type==='demo-phase').length,72);assert.equal(new Set(plan.filter(p=>p.demoKey).map(p=>p.demoKey)).size,15);
  assert.equal(await page.locator('.slide').last().getAttribute('data-slide-key'),'closing');assert.equal(plan.at(-1).type,'slide');assert.equal(plan.at(-1).slideIndex,37);
 }finally{await browser.close();}
});
