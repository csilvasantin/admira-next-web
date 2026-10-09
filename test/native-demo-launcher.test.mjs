import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const avatar=readFileSync(new URL('../assets/avatar.js',import.meta.url),'utf8');
function fixture(href, existing=false, engine=null, marked=true){
 const callbacks={}, scripts=[], timers=new Map(), warnings=[];
 const script={dataset:{},events:{},addEventListener(n,fn){this.events[n]=fn;}};
 const document={readyState:'loading',documentElement:{lang:'es'},currentScript:null,
  getElementById(){return null;},querySelector(sel){return existing&&((marked&&sel==='script[data-admira-demo-engine]')||sel==='script[src^="https://www.admiranext.com/suite/experto.js"]')?script:null;},
  addEventListener(n,fn){callbacks[n]=fn;},createElement(){return script;},head:{appendChild(s){scripts.push(s);}}};
 const u=new URL(href),window={document,location:{href,host:u.host,origin:u.origin},AdmiraExperto:engine,
  localStorage:{getItem(k){return k==='admira-avatar:override'?'off':null;}},addEventListener(){},
  setTimeout(fn){const id=timers.size+1;timers.set(id,fn);return id;},clearTimeout(id){timers.delete(id);},console:{warn:t=>warnings.push(t)},crypto:{randomUUID(){return 'fresh-'+Math.random();}}};
 vm.runInNewContext(avatar,{window,document,URL,Promise,WeakMap,Map,Date,Math});
 return {window,script,scripts,timers,warnings,boot:()=>callbacks.DOMContentLoaded()};
}
test('all five native launch links have a fresh run and no TPV auto start',()=>{
 const q=fixture('https://www.admiranext.com/demo');
 for(const id of ['studio','store','tv','biz','app']){
  const a=new URL(q.window.AdmiraAvatar.demoUrl(id)),b=new URL(q.window.AdmiraAvatar.demoUrl(id));
  assert.equal(a.searchParams.get('ax_demo'),id);assert.equal(a.searchParams.get('lang'),'es');assert.notEqual(a.searchParams.get('ax_run'),b.searchParams.get('ax_run'));assert.equal(a.protocol,'https:');assert.equal(a.username,'');
  if(id==='store'){assert.equal(a.searchParams.has('demo'),false);assert.equal(a.hash,'');assert.equal(a.searchParams.get('circuit'),'alsea_starbucks');}
  if(id==='app'){assert.equal(a.hostname,'www.admira.app');assert.equal(a.pathname,'/retailer');}
 }
 q.window.document.documentElement.lang='en';assert.equal(new URL(q.window.AdmiraAvatar.demoUrl('biz')).searchParams.get('lang'),'en');q.window.document.documentElement.lang='es';
 const englishQuery=fixture('https://www.admiranext.com/demo?lang=en');assert.equal(new URL(englishQuery.window.AdmiraAvatar.demoUrl('tv')).searchParams.get('lang'),'en');
 assert.equal(q.window.AdmiraAvatar.demoUrl('auto'),'');
 q.window.AdmiraExperto={parseDemo:()=>({url:'https://www.admira.store/admira-xp/?demo=otro#ayuda'})};
 const preserved=new URL(q.window.AdmiraAvatar.demoUrl('store'));assert.equal(preserved.searchParams.get('demo'),'otro');assert.equal(preserved.hash,'#ayuda');
 q.window.AdmiraExperto={parseDemo:()=>({url:'https://evil.example/'})};assert.equal(q.window.AdmiraAvatar.demoUrl('studio'),'');
});
test('native boot runs without avatar, from only the matching vertical hosts',async()=>{
 for(const [id,host] of [['studio','www.admira.studio'],['store','www.admira.store'],['tv','admira.tv'],['biz','www.admira.biz'],['app','www.admira.app'],['app','www.yokup.com']]){
  const q=fixture(`https://${host}/?ax_demo=${id}`);q.boot();
  assert.equal(q.scripts.length,1);assert.equal(q.script.dataset.pata,id);assert.equal(q.script.dataset.admiraDemoEngine,'1');assert.equal(q.script.src,'https://www.admiranext.com/suite/experto.js?v=20261009-demo-hoy-1');
  q.window.AdmiraExperto={demo(){}};q.script.events.load();assert.equal(await q.window.__admiraNativeDemoLoading,q.window.AdmiraExperto);assert.equal(q.timers.size,0);
 }
});
test('hoy boots on admiranext and the suite legs',()=>{
 for(const href of ['https://www.admiranext.com/arquitectura?ax_demo=hoy','https://www.admira.biz/?ax_demo=hoy','https://www.xpaceos.com/?ax_demo=hoy']){
  const q=fixture(href);q.boot();
  assert.equal(q.scripts.length,1,href);assert.equal(q.script.dataset.pata,'hoy');
  assert.equal(q.script.src,'https://www.admiranext.com/suite/experto.js?v=20261009-demo-hoy-1');
 }
});
test('foreign hosts, unrelated verticals and localhost cannot bootstrap',()=>{
 for(const href of ['https://www.clearchannel.tv/?ax_demo=app','https://evil.example/?ax_demo=store','https://evil.example/?ax_demo=hoy','http://localhost:8770/?ax_demo=studio','https://www.admiranext.com/demo?ax_demo=studio','https://www.admira.biz/?ax_demo=store','https://www.admira.studio/?ax_demo=auto','https://www.admira.store/']){
  const q=fixture(href);q.boot();assert.equal(q.scripts.length,0);assert.equal(q.window.__admiraNativeDemoLoading,undefined);
 }
});
test('in-flight bootstrap is deduplicated and the existing owned script awaited',async()=>{
 const q=fixture('https://www.admira.store/?ax_demo=store',true);q.boot();const p=q.window.__admiraNativeDemoLoading;q.boot();assert.equal(q.window.__admiraNativeDemoLoading,p);assert.equal(q.scripts.length,0);
 q.window.AdmiraExperto={demo(){}};q.script.events.load();assert.equal(await p,q.window.AdmiraExperto);
 const unmarked=fixture('https://www.admira.store/?ax_demo=store',true,null,false);unmarked.boot();assert.equal(unmarked.scripts.length,0);unmarked.window.AdmiraExperto={demo(){}};unmarked.script.events.load();assert.equal(await unmarked.window.__admiraNativeDemoLoading,unmarked.window.AdmiraExperto);
 const ready=fixture('https://www.admira.store/?ax_demo=store',false,{demo(){}});ready.boot();assert.equal(ready.scripts.length,0);
});
test('load errors are bounded and visible, never reported as executed',async()=>{
 const q=fixture('https://www.admira.store/?ax_demo=store');q.boot();q.script.events.error();await assert.rejects(q.window.__admiraNativeDemoLoading,/failed to load/);assert.equal(q.timers.size,0);assert.equal(q.warnings.length,1);
});
test('live UI uses five same-tab native links and retains provisioning and remote sections',()=>{
 const html=readFileSync(new URL('../demo/index.html',import.meta.url),'utf8');
 const links=[...html.matchAll(/<a class="native-platform"[^>]*data-native-demo="([^"]+)"[^>]*href="([^"]+)"[^>]*>/g)];assert.equal(links.length,5);assert.deepEqual(links.map(m=>m[1]),['studio','store','tv','biz','app']);
 for(const [tag,id,href] of links){assert.doesNotMatch(tag,/target=|noreferrer/);const url=new URL(href.replaceAll('&amp;','&'));assert.equal(url.searchParams.get('ax_demo'),id);assert.equal(url.searchParams.has('demo'),false);}
 assert.match(html,/id="en-vivo"/);assert.match(html,/id="completaForm"/);assert.match(html,/id="remota"/);assert.match(html,/ax_run/);assert.match(readFileSync(new URL('../demo/completa.js',import.meta.url),'utf8'),/PANELES = \[[^\]]*'en-vivo'/);
});
test('the actual launcher click handler renews each run without changing its destination',()=>{
 const html=readFileSync(new URL('../demo/index.html',import.meta.url),'utf8');
 const script=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('data-native-demo'));
 const link={href:'https://www.admira.app/retailer?marca=starbucks&ax_demo=app',addEventListener(name,fn){assert.equal(name,'click');this.click=fn;}};
 let nonce=0;const crypto={randomUUID(){return 'run-'+ ++nonce;}};
 vm.runInNewContext(script,{document:{querySelectorAll(){return[link];}},window:{crypto},crypto,URL,Date,Math});
 link.click();const one=new URL(link.href);link.click();const two=new URL(link.href);
 assert.equal(one.origin,two.origin);assert.equal(two.pathname,'/retailer');assert.equal(two.searchParams.get('marca'),'starbucks');assert.equal(two.searchParams.get('ax_demo'),'app');assert.notEqual(one.searchParams.get('ax_run'),two.searchParams.get('ax_run'));
});
