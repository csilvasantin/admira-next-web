import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const code=fs.readFileSync(new URL('../suite/experto.js',import.meta.url),'utf8');
const bridge=code.slice(code.indexOf('  // Explicit avatar commands belong'),code.indexOf('  // End shared avatar command transport.'));
test('the common engine accepts Admirito commands once even with a cached avatar loader',async()=>{
 const listeners=[],responses=[];let calls=0;const frame={contentWindow:{postMessage:(d,target)=>responses.push({d,target})}};
 const document={getElementById:()=>frame,createElement:()=>({textContent:'',querySelector:()=>null})};
 const root={addEventListener:(name,fn)=>listeners.push(fn),AdmiraExperto:{exec:(text,log)=>{calls++;assert.equal(text,'/crear cartela tintaelectronica');log.textContent='Creador · 4 cartelas';return {ok:true,count:4};}}};
 vm.runInNewContext(bridge,{root,document,WeakMap,Map,Promise});
 const send=(data,origin='https://digitalavatar.ai',source=frame.contentWindow)=>listeners[0]({data,origin,source});
 const command={type:'da-command',texto:'/crear cartela tintaelectronica',requestId:'one'};
 send(command);send(command);await new Promise(r=>setImmediate(r));assert.equal(calls,1);assert.equal(responses.length,2);assert.equal(responses[0].d.type,'da-command-result');assert.equal(responses[0].d.ok,true);assert.equal(responses[0].d.result.count,4);
 send({...command,texto:'/logout'});send({...command,requestId:'bad'},'https://evil.example');await new Promise(r=>setImmediate(r));assert.equal(calls,1);assert.equal(responses.at(-1).d.ok,false);
});
