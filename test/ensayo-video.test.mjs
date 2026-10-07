import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {GLOBALES} from '../subdemos/catalogo.mjs';
import {videoPorDemo} from '../subdemos/retail-videos.mjs';
import {validarVideo} from '../subdemos/editor-catalogo.mjs';
const manifests=['store','biz','studio'].map(id=>JSON.parse(readFileSync(new URL('../subdemos/'+id+'.subdemos.json',import.meta.url),'utf8')));
async function rehearsal({sound=null,invalid=false}={}){
 const nodes=new Map(),storage=new Map(),calls=[],events={};if(sound)storage.set('admira-demo-audio-v1',JSON.stringify(sound));
 class Element{
  constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.listeners={};this.dataset={};this.paused=true;this.plays=0;this.value='';}
  set id(id){this._id=id;nodes.set(id,this);}get id(){return this._id;}
  get options(){return this.children;}
  setAttribute(k,v){this[k]=v;}
  append(...items){for(const item of items){item.parentNode=this;this.children.push(item);}}
  insertBefore(item,before){item.parentNode=this;this.children.splice(this.children.indexOf(before),0,item);}
  replaceChildren(...items){this.children=[];this.append(...items);if(this.tagName==='SELECT')this.value=items[0]?.value||'';}
  addEventListener(k,fn){this.listeners[k]=fn;}
  querySelectorAll(selector){const tags=selector.split(',').map(t=>t.toUpperCase()),out=[];const walk=e=>{for(const child of e.children){if(tags.includes(child.tagName))out.push(child);walk(child);}};walk(this);return out;}
  play(){this.paused=false;this.plays++;this.listeners.play?.();return Promise.resolve();}pause(){this.paused=true;}
 }
 const get=id=>{if(!nodes.has(id)){const el=new Element(['plataforma','subdemo'].includes(id)?'select':'div');el.id=id;}return nodes.get(id);},main=new Element('main');main.append(get('muestra'));
 const globals=structuredClone(GLOBALES),published=structuredClone(manifests);if(invalid)published[0].subdemos[0].video.url='javascript:alert(1)';
 const context={GLOBALES:globals,videoPorDemo,validarVideo,aplicarManifiesto:m=>{globals.find(g=>g.id===m.plataforma).subdemos=structuredClone(m.subdemos);},document:{getElementById:get,createElement:tag=>new Element(tag)},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},location:{href:'https://www.admiranext.test/subdemos/ensayo.html?plataforma=store&demo=voz',search:'?plataforma=store&demo=voz'},history:{replaceState(){}},URL,URLSearchParams,structuredClone,Map,JSON,
  fetch:async(url,options)=>{calls.push({url,options});return{ok:true,json:async()=>published.find(m=>url.includes(m.plataforma+'.'))};},addEventListener:(name,fn)=>{events[name]=fn;}};
 context.window=context;vm.createContext(context);const source=readFileSync(new URL('../subdemos/ensayo.js',import.meta.url),'utf8').replace(/^import[^\n]+\n/gm,'');await vm.runInContext('(async()=>{'+source+'})()',context);
 return{get,globals,calls,events,storage,select:(platform,id)=>{get('plataforma').value=platform;get('plataforma').listeners.change();get('subdemo').value=id;get('subdemo').listeners.change();}};
}
test('all fifteen individual rehearsals show prepared video separately and never autoplay or mutate original samples',async()=>{
 const h=await rehearsal();for(const m of manifests)for(const d of m.subdemos){h.select(m.plataforma,d.id);const section=h.get('video-preparado'),clip=section.querySelectorAll('video')[0];assert.equal(section.hidden,false);assert.equal(clip.src,d.video.url);assert.equal(clip.poster,d.video.poster);assert.equal(clip.controls,true);assert.equal(clip.playsInline,true);assert.equal(clip.plays,0);assert.equal(clip.muted,false);assert.equal(h.get('muestra').hidden,!d.muestra?.url);if(d.muestra)assert.equal(h.get('muestra').children[0].src,d.muestra.url);assert.deepEqual(h.globals.find(g=>g.id===m.plataforma).subdemos.find(s=>s.id===d.id).muestra,d.muestra);}
 assert.equal(h.calls.length,3);assert.ok(h.calls.every(c=>!c.options.method));
});
test('live sound and mute controls restore audio, persist shared settings and manual players cannot overlap',async()=>{
 const h=await rehearsal({sound:{narration:false,samples:true,muted:true}}),clip=h.get('video-preparado').querySelectorAll('video')[0],original=h.get('muestra').children[0],listen=h.get('ensayo-video-sound'),mute=h.get('ensayo-video-mute');assert.equal(clip.muted,true);assert.equal(original.muted,true);mute.listeners.click();assert.equal(clip.muted,false);assert.equal(original.muted,false);assert.equal(mute['aria-pressed'],'false');
 listen.checked=false;listen.listeners.change();assert.equal(clip.muted,true);listen.checked=true;listen.listeners.change();assert.equal(clip.muted,false);assert.deepEqual(JSON.parse(h.storage.get('admira-demo-audio-v1')),{narration:false,samples:true,muted:false});
 await original.play();assert.equal(original.paused,false);await clip.play();assert.equal(original.paused,true);assert.equal(clip.paused,false);await original.play();assert.equal(clip.paused,true);assert.equal(original.paused,false);mute.listeners.click();original.muted=false;original.listeners.volumechange();assert.equal(original.muted,true);
});
test('selection and page exit pause manual clips; shared global mute and invalid definitions remain effective',async()=>{
 const h=await rehearsal({sound:{samples:true,muted:true}}),clip=h.get('video-preparado').querySelectorAll('video')[0];assert.equal(clip.muted,true);clip.muted=false;clip.listeners.volumechange();assert.equal(clip.muted,true);await clip.play();h.select('biz','iot');assert.equal(clip.paused,true);const next=h.get('video-preparado').querySelectorAll('video')[0];await next.play();h.events.pagehide();assert.equal(next.paused,true);
 const invalid=await rehearsal({invalid:true});assert.equal(invalid.get('video-preparado').hidden,true);assert.match(invalid.get('estado').textContent,/definición no válida/);assert.equal(invalid.get('muestra').hidden,false,'invalid video does not discard the original sample');
});
