import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {clientSlug,extractPresentationSlides,buildRemotePlan,hashNarrationText} from '../demo/remote-plan.mjs';
import {createRemoteRunner} from '../demo/remote-runner.mjs';
import {videoPorDemo} from '../subdemos/retail-videos.mjs';
const source=readFileSync(new URL('../demo/remota.js',import.meta.url),'utf8').replace(/^import[^\n]+\n/gm,'');
function harness(origin='http://localhost:8788'){
 const nodes=new Map(),requests=[];
 class Element {
  constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.dataset={};this.listeners={};this.textContent='';this.hidden=true;this.disabled=false;this.plays=0;this.classList={add(){},remove(){},contains(){return false;}};}
  addEventListener(type,fn){this.listeners[type]=fn;}
  append(...children){this.children.push(...children);}
  replaceChildren(...children){this.children=children;}
  querySelectorAll(selector){const tags=selector.split(',').map(s=>s.trim().toUpperCase());return this.children.flatMap(child=>[...(tags.includes(child.tagName)?[child]:[]),...child.querySelectorAll(selector)]);}
  scrollIntoView(){}
  pause(){}
  load(){}
  removeAttribute(){}
  setAttribute(name,value){this[name]=value;}
  getAttribute(name){return this[name];}
  play(){this.plays++;return Promise.resolve();}
 }
 const get=id=>{if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id);};
 const context={document:{getElementById:get,createElement:tag=>new Element(tag),querySelectorAll:selector=>[...new Set(['remote-sample','remote-original-sample'].filter(id=>selector.includes('#'+id)).flatMap(id=>get(id).querySelectorAll('audio,video')))],querySelector:()=>null,addEventListener(){}},localStorage:{getItem(){return null;},setItem(){}},location:{origin,href:origin+'/demo/#remota',hash:'#remota'},URL,Audio:Element,Option:Element,setTimeout,clearTimeout,clientSlug,extractPresentationSlides,buildRemotePlan,hashNarrationText,createRemoteRunner,videoPorDemo,
  fetch:(...args)=>{requests.push(args);throw Error('Tests must not access media or providers');},addEventListener(){}};
 context.window=context;vm.createContext(context);vm.runInContext(source,context);vm.runInContext("client='alsea-starbucks'",context);
 return{get,requests,context,run:code=>vm.runInContext(code,context),safe:value=>{context.value=value;return vm.runInContext('safeURL(value)',context);},warning:()=>get('remote-warnings').textContent,Element};
}

test('own canonical HTTPS private media use the current proxy path, retaining the existing gate',()=>{
 const h=harness();
 for(const host of ['admiranext.com','www.admiranext.com'])for(const extension of ['mp4','webm','m4a','mp3','ogg','wav','png','jpg','jpeg','webp','gif']){
  const path='/presentaciones/alsea-starbucks/media/voice_1.'+extension;
  assert.equal(h.safe('https://'+host+path+'?download=1#sample'),path);
 }
 assert.equal(h.requests.length,0);
});
test('relative own private media work on HTTP localhost and HTTPS production without crossing clients',()=>{
 const path='/presentaciones/alsea-starbucks/media/master-1.mp4';
 for(const origin of ['http://localhost:8788','https://www.admiranext.com']){
  const h=harness(origin);assert.equal(h.safe(path+'?format=preview#video'),path);assert.equal(h.safe(origin+path),path);
  assert.equal(h.safe('/presentaciones/other-client/media/master.mp4'),'');assert.equal(h.safe('https://www.admiranext.com/presentaciones/other-client/media/master.mp4'),'');
 }
});
test('private filename scope rejects subdirectories, encoded path separators, invalid extensions and unvalidated client',()=>{
 const h=harness(),prefix='https://www.admiranext.com/presentaciones/alsea-starbucks/media/';
 for(const name of ['nested/master.mp4','%2Fmaster.mp4','%2e%2e%2fmaster.mp4','master.svg','master.html','master.mp4.exe','-master.mp4',''])assert.equal(h.safe(prefix+name),'',name);
 h.run("client='../other'");assert.equal(h.safe(prefix+'master.mp4'),'');
});
test('credentials and executable or external HTTP URLs are rejected; public HTTPS samples stay unchanged',()=>{
 const h=harness();
 for(const url of ['https://user:pass@www.admiranext.com/presentaciones/alsea-starbucks/media/a.mp4','https://user:pass@media.pixeria.com/prepared.mp4','http://media.pixeria.com/prepared.mp4','http://www.admiranext.com/presentaciones/alsea-starbucks/media/a.mp4','data:video/mp4;base64,AAAA','javascript:alert(1)','file:///tmp/sample.mp4'])assert.equal(h.safe(url),'');
 const publicURL='https://www.pixeria.com/samples/master.mp4?variant=vertical#prepared';assert.equal(h.safe(publicURL),publicURL);assert.equal(h.requests.length,0);
});
test('sample and variants keep their demo label, route private sources through current origin and use native controls',()=>{
 const h=harness();h.run("addMedia({tipo:'video',url:'https://www.admiranext.com/presentaciones/alsea-starbucks/media/master.mp4',variantes:[{nombre:'Vertical',url:'/presentaciones/alsea-starbucks/media/vertical.webm'},{nombre:'Other client',url:'https://www.admiranext.com/presentaciones/other-client/media/master.mp4'}]}, {titulo:'Video preparado',clave:'studio/video'})");
 const media=h.get('remote-sample').children;assert.equal(media.length,2);assert.equal(media[0].src,'/presentaciones/alsea-starbucks/media/master.mp4');assert.equal(media[1].src,'/presentaciones/alsea-starbucks/media/vertical.webm');
 assert.equal(media[0].dataset.remoteLabel,'Video preparado (studio/video)');assert.match(media[1].dataset.remoteLabel,/Vertical/);assert.ok(media.every(el=>el.controls&&el.muted));assert.equal(h.requests.length,0);
});
test('persistent function video and poster retain own-client gate and reject a later invalid source',()=>{
 const h=harness();assert.equal(h.run("prepareVideo({titulo:'Prepared function',clave:'store/custom',video:{url:'https://www.admiranext.com/presentaciones/alsea-starbucks/media/reel.mp4?download=1',poster:'https://www.admiranext.com/presentaciones/alsea-starbucks/media/reel.jpg',audio:true}})"),true);
 const clip=h.get('remote-video');assert.equal(clip.src,'/presentaciones/alsea-starbucks/media/reel.mp4');assert.equal(clip.poster,'/presentaciones/alsea-starbucks/media/reel.jpg');assert.equal(clip.dataset.remoteLabel,'Prepared function (store/custom)');assert.equal(clip.dataset.hasAudio,'true');assert.equal(clip.muted,false);assert.equal(h.requests.length,0);
 assert.equal(h.run("prepareVideo({titulo:'Other function',clave:'store/custom2',video:{url:'https://www.admiranext.com/presentaciones/other/media/reel.mp4',audio:true}})"),false);
 assert.equal(h.run('videoReadyKey'),'');
});
test('remote global mute covers original manual media and native controls cannot bypass it',()=>{
 const h=harness();h.run("addMedia({tipo:'audio',url:'https://www.pixeria.com/prepared.mp3'}, {titulo:'Original prepared audio',clave:'store/custom'}, $('remote-original-sample'))");const original=h.get('remote-original-sample').children[0];original.muted=false;
 h.get('remote-mute').listeners.click();assert.equal(original.muted,true);original.muted=false;original.listeners.volumechange();assert.equal(original.muted,true);h.get('remote-mute').listeners.click();original.muted=false;original.listeners.volumechange();assert.equal(original.muted,false,'manual original sound can be enabled after global mute is disabled');assert.equal(h.requests.length,0);
});
async function rejectedPlay(name,mediaCode){
 const h=harness(),el=new h.Element('video');el.dataset.remoteLabel='Video preparado (studio/video) · Vertical';el.ended=false;if(mediaCode)el.error={code:mediaCode};el.play=()=>{el.plays++;return Promise.reject(Object.assign(new Error('test'),{name}));};h.context.el=el;h.run('playSample(el)');await Promise.resolve();await Promise.resolve();return{h,el};
}
test('NotAllowedError identifies the actual sample and requires a native playback click',async()=>{
 const {h,el}=await rejectedPlay('NotAllowedError');assert.equal(el.plays,1);assert.match(h.warning(),/Video preparado \(studio\/video\).*Vertical/);assert.match(h.warning(),/pulsar el control/);assert.doesNotMatch(h.warning(),/acceso y el formato/);
});
for(const [name,code] of [['NotSupportedError',4],['NetworkError',2]])test(name+' explains access/format and MediaError code without promising that a click fixes it',async()=>{
 const {h}=await rejectedPlay(name,code);assert.match(h.warning(),/Video preparado \(studio\/video\).*Vertical/);assert.match(h.warning(),/acceso y el formato/);assert.match(h.warning(),new RegExp('error multimedia '+code));assert.doesNotMatch(h.warning(),/pulsar|clic|click/);
});
test('native media error event keeps label and code and uses plain text for potentially hostile titles',()=>{
 const h=harness();h.run("addMedia({tipo:'video',url:'https://www.pixeria.com/prepared.mp4'}, {titulo:'<img src=x onerror=bad()>',clave:'studio/video'})");
 const el=h.get('remote-sample').children[0];el.error={code:3};el.listeners.error();assert.match(h.warning(),/error multimedia 3/);assert.match(h.warning(),/acceso y el formato/);assert.ok(h.warning().includes('<img src=x onerror=bad()>'));assert.equal(h.get('remote-warnings').innerHTML,undefined,'message remains text, never rendered markup');assert.doesNotMatch(h.warning(),/pulsar/);
});
test('AbortError from normal cancellation is silent; ended samples do not attempt playback',async()=>{
 const {h,el}=await rejectedPlay('AbortError');assert.equal(el.plays,1);assert.equal(h.warning(),'');el.ended=true;h.run('playSample(el)');await Promise.resolve();assert.equal(el.plays,1);assert.equal(h.requests.length,0);
});
