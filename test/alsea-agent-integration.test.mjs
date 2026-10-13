import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {callTool} from '../functions/mcp/_server.js';

const loader=readFileSync(new URL('../suite/loader.js',import.meta.url),'utf8');
function mountTV(present=true){
  const added=[];
  const nodes={};
  for(const selector of ['#admExpForm','#admExpIn','#admExpLog'])nodes[selector]={};
  const panel={querySelector:selector=>nodes[selector]||null};
  const document={querySelector:selector=>present&&selector==='#admExp'?panel:null,
    createElement:tag=>({tag,dataset:{}}),head:{appendChild:node=>added.push(node)},documentElement:{}};
  vm.runInNewContext(loader,{window:{setTimeout(){}},document,MutationObserver:class{observe(){}disconnect(){}}});
  return added;
}
test('TV legacy Expert mounts exactly one shared command engine on its existing form',()=>{
  const added=mountTV();
  const scripts=added.filter(n=>n.tag==='script');
  assert.equal(scripts.length,1);
  assert.match(scripts[0].src,/www\.admiranext\.com\/suite\/experto\.js/);
  assert.equal(scripts[0].dataset.form,'#admExpForm');
  assert.equal(scripts[0].dataset.input,'#admExpIn');
  assert.equal(scripts[0].dataset.dock,'off');
});
test('the loader does not create Expert on a page without a console',()=>{
  assert.deepEqual(mountTV(false),[]);
});
test('MCP returns the complete structured presentation beyond 4000 characters',async()=>{
  const content={client:'example',skeleton:Array.from({length:22},(_,i)=>({id:'slide-'+i,message:'x'.repeat(250)}))};
  let path;
  const result=await callTool({env:{PRES_SIGNING_KEY:'test'},access:{level:'editor',email:'agent@example.com',sessionVersion:1},fetchImpl:async(url,init)=>{
    path=url;assert.equal(init.method,'GET');
    return {ok:true,status:200,text:async()=>JSON.stringify(content)};
  }},'get_presentation',{client:'example'});
  assert.equal(path,'https://www.admiranext.com/presentaciones/example/api/ideas');
  assert.deepEqual(result,content);
  assert.equal(result.skeleton.length,22);
});
