import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const data=JSON.parse(readFileSync(new URL('../demo/pixeria-novedades/data.json',import.meta.url),'utf8'));
const source=readFileSync(new URL('../demo/pixeria-novedades/tour.mjs',import.meta.url),'utf8');
async function setup(search='') {
  const elements=new Map(), timers=new Map(), events={}, requests=[];let timerId=0;
  function element(){return {textContent:'',attrs:{},checked:false,hidden:false,children:[],paused:true,
    setAttribute(k,v){this.attrs[k]=v;},getAttribute(k){return this.attrs[k]||null;},replaceChildren(...children){this.children=children;},pause(){this.paused=true;},play(){this.paused=false;return Promise.resolve();}};}
  const document={documentElement:{lang:'es'},hidden:false,getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);},createElement:element,addEventListener(name,fn){events[name]=fn;}};
  const sandbox={document,window:{},location:{search,href:'https://www.admiranext.com/demo/pixeria-novedades/'+search},history:{replaceState(){}},URL,URLSearchParams,
    setTimeout(fn,delay){timers.set(++timerId,{fn,delay});return timerId;},clearTimeout(id){timers.delete(id);},addEventListener(name,fn){events[name]=fn;},
    fetch:async(url,options)=>{requests.push({url,options});return {ok:true,json:async()=>data};}};
  await vm.runInNewContext('(async()=>{'+source+'})()',sandbox);
  return {api:sandbox.window.PixeriaUpdatesDemo,elements,timers,events,document,requests};
}
test('tour uses existing samples; pause and stop clear progression and audio',async()=>{
  const {api,elements,timers,requests}=await setup('?run=1');
  assert.equal(requests.length,1);assert.equal(requests[0].url,'./data.json');
  assert.equal(api.state().chapter,1);assert.equal(timers.size,1);
  elements.get('sound').checked=true;await elements.get('sound').onchange();assert.equal(elements.get('narration').paused,false);
  api.control('pause');assert.equal(timers.size,0);assert.equal(elements.get('narration').paused,true);
  api.control('resume');assert.equal(timers.size,1);api.control('stop');assert.equal(timers.size,0);
});
test('all chapters finish without an automatic repeat or a generation request',async()=>{
  const {api,timers,requests}=await setup('?run=1');
  for(let i=0;i<data.chapters.length;i++){assert.equal(timers.size,1);[...timers.values()][0].fn();}
  assert.equal(api.state().finished,true);assert.equal(timers.size,0);assert.equal(api.state().chapter,8);assert.equal(requests.length,1);
});
test('language change preserves the chapter and selects matching narration and video',async()=>{
  const {api,elements}=await setup();api.control('next');api.control('next');elements.get('language').onclick();
  assert.equal(api.state().chapter,3);assert.equal(api.state().language,'en');
  assert.match(elements.get('narration').src,/clasico-en.mp3$/);assert.match(elements.get('full-video').src,/novedades-en.mp4$/);
});
test('leaving the tab stops timed progression and media',async()=>{
  const {api,document,events,timers,elements}=await setup('?run=1');document.hidden=true;events.visibilitychange();
  assert.equal(api.state().activo,false);assert.equal(timers.size,0);assert.equal(elements.get('narration').paused,true);assert.equal(elements.get('full-video').paused,true);
});
