import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';import {randomUUID} from 'node:crypto';
const src=readFileSync(new URL('../suite/experto.js',import.meta.url),'utf8');
const avatar=readFileSync(new URL('../assets/avatar.js',import.meta.url),'utf8');
const ORDER='/bugito error starbucks gran de gracia 51 pantalla girada';
function engine(host){
 const forms=[];const store=new Map();const storage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)};
 const element=tag=>({tagName:tag.toUpperCase(),dataset:{},children:[],style:{},classList:{add(){},contains(){return false;}},setAttribute(){},getAttribute(){return null;},addEventListener(){},querySelector(){return null;},querySelectorAll(){return [];},appendChild(e){this.children.push(e);},submit(){forms.push(this);}});
 const doc={readyState:'loading',currentScript:{dataset:{commandsOnly:'1'}},documentElement:{lang:'es',dataset:{},classList:{contains(){return false;}},getAttribute(){return null;}},querySelector(){return null;},querySelectorAll(){return [];},createElement:element,addEventListener(){},head:{children:[],appendChild(){}},body:{children:[],appendChild(){}}};
 const s={document:doc,location:{hostname:host,host,origin:'https://'+host,href:'https://'+host+'/',pathname:'/',search:''},localStorage:storage,sessionStorage:storage,crypto:{randomUUID},URL,URLSearchParams,setTimeout,clearTimeout,fetch:async()=>({ok:false,json:async()=>({})}),addEventListener(){},dispatchEvent(){},CustomEvent:class{}};s.window=s;s.globalThis=s;vm.runInNewContext(src,s);return {s,forms,E:s.AdmiraExperto};
}
test('all five platform engines POST the complete command once, preserving its long destination',async()=>{
 for(const host of ['www.admira.studio','www.admira.store','www.admira.tv','www.admira.app','www.admira.biz']){
  const {E,forms}=engine(host);await E.exec(ORDER,{children:[],appendChild(){}});assert.equal(forms.length,1,host);assert.equal(forms[0].method,'POST');assert.equal(forms[0].action,'https://www.admira.biz/api/bugito/launch?lang=es');
  const fields=Object.fromEntries(forms[0].children.map(e=>[e.name,e.value]));assert.equal(fields.order,ORDER.replace('/bugito ',''));assert.match(fields.request_id,/^[a-f0-9-]{36}$/);
  assert.equal(E.has("bugito"),true);assert.equal(E.exec('/unknown_bugito_command',{children:[],appendChild(){}}).ok,false);assert.equal(forms.length,1);
 }
});
test('registered physical action executes once in Bugito without a second navigation',async()=>{
 const {s,E,forms}=engine('www.admira.biz');let count=0;s.BugitoPhysical={runOrder:async order=>{assert.equal(order,ORDER.replace('/bugito ',''));count++;return 'measured';}};
 assert.equal(await E.exec(ORDER,{children:[],appendChild(){}}),'measured');assert.equal(count,1);assert.equal(forms.length,0);
});
test('avatar preserves complete physical commands while old lab aliases remain unchanged',()=>{
 const module={exports:{}};vm.runInNewContext(avatar,{module,globalThis:{},window:undefined});const A=module.exports;
 assert.equal(A.personajeArg('bugito',ORDER),'error starbucks gran de gracia 51 pantalla girada');assert.equal(A.personajeArg('bugito','/bugito girar'),'girar');
 assert.equal(A.personajeArg('bugito','/bugito restore starbucks gran de gracia 51'),'restore starbucks gran de gracia 51');
});
