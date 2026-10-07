import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {GLOBALES,ANTERIORES,PROYECTOS_INICIALES,MANIFIESTOS,aplicarManifiesto,guion,guionTexto,pasoTexto,proyectoLimpio,CONTEXTO} from '../subdemos/catalogo.mjs';
import {normalizarCatalogo,catalogoActual,guardarSubdemo,borrarSubdemo,guionDeCatalogo} from '../subdemos/editor-catalogo.mjs';
import {normalizarDemoProject} from '../subdemos/presentacion.mjs';
const custom={id:'promocion',nombre:'Promoción',desc:'Campaña local',url:'https://www.admira.store/promocion',aliases:['promo'],pasos:[{texto:'Revisar'}],caso:{id:'pilot'},ensayo_url:'/subdemos/ensayo.html?plataforma=store&demo=promocion',muestra:{url:'https://www.pixeria.com/sample.mp3',variantes:[{url:'https://www.pixeria.com/sample-alt.mp3'}]}};

test('catalog CRUD preserves rich definitions, original input and stable IDs',()=>{
 const original=catalogoActual(GLOBALES), before=JSON.stringify(original);
 const added=guardarSubdemo(original,'store',custom);
 const edited=guardarSubdemo(added,'store',{...custom,nombre:'Nueva promoción'},'promocion');
 const entry=edited.find(m=>m.plataforma==='store').subdemos.find(s=>s.id==='promocion');
 assert.deepEqual(entry.aliases,custom.aliases);assert.deepEqual(entry.pasos,custom.pasos);assert.deepEqual(entry.caso,custom.caso);assert.deepEqual(entry.muestra,custom.muestra);
 assert.equal(entry.ensayo_url,'https://www.admiranext.com'+custom.ensayo_url);
 assert.equal(JSON.stringify(original),before);assert.throws(()=>guardarSubdemo(added,'store',custom),/existe/);
 assert.throws(()=>guardarSubdemo(added,'store',{...custom,id:'other'},'promocion'),/estable/);
 const removed=borrarSubdemo(edited,'store','promocion');assert.equal(removed.find(m=>m.plataforma==='store').subdemos.some(s=>s.id==='promocion'),false);
});

test('catalog validation bounds data and requires safe HTTPS definitions',()=>{
 for(const extra of [{url:'javascript:alert(1)'},{url:'http://host.test/'},{url:'https://user:password@host.test/'},{muestra:{url:'http://host.test/a'}},{nombre:'x'.repeat(161)},{steps:Array(61).fill('x')},{aliases:[{}]},{caso:{text:'x'.repeat(30001)}}])assert.throws(()=>normalizarCatalogo([{plataforma:'store',subdemos:[{...custom,...extra}]}]));
 assert.throws(()=>normalizarCatalogo([{plataforma:'unknown',subdemos:[]}]));
 assert.throws(()=>normalizarCatalogo([{plataforma:'store',subdemos:[custom,custom]}]));
 assert.throws(()=>normalizarCatalogo([{plataforma:'store',subdemos:Array(41).fill(custom)}]));
 assert.throws(()=>normalizarCatalogo([{plataforma:'store',subdemos:[]},{plataforma:'store',subdemos:[]}]));
 assert.deepEqual(normalizarCatalogo([{version:1,plataforma:'store',subdemos:[]}])[0].subdemos,[]);
});

test('custom selection captures validated catalog without mutating global server catalog',()=>{
 const before=JSON.stringify(GLOBALES),catalogo=[{version:1,plataforma:'store',subdemos:[structuredClone(custom)]}];
 const project=normalizarDemoProject({id:'client',demos:['store/promocion'],catalogo},{slug:'client'});
 assert.equal(project.documentacion[0].clave,'store/promocion');assert.match(project.documentacion[0].titulo,/Promoción/);
 catalogo[0].subdemos[0].nombre='Changed';assert.match(project.documentacion[0].titulo,/Promoción/);
 assert.equal(JSON.stringify(GLOBALES),before);
 assert.throws(()=>normalizarDemoProject({demos:['store/promocion']},{slug:'client'}),/desconocida/);
 assert.throws(()=>normalizarDemoProject({demos:['store/missing'],catalogo:project.catalogo},{slug:'client'}),/desconocida/);
 assert.throws(()=>normalizarDemoProject({demos:['store/promocion'],catalogo:[{plataforma:'store',subdemos:[{...custom,url:'http://bad.test'}]}]},{slug:'client'}));
});

test('legacy selected Store definitions remain resolvable alongside new five',()=>{
 const legacy=ANTERIORES.store.find(s=>s.id==='signage');assert.ok(legacy);
 const project=normalizarDemoProject({demos:['store/signage']},{slug:'client'});
 assert.equal(project.documentacion[0].clave,'store/signage');assert.equal(project.documentacion[0].url,legacy.url);
 assert.equal(guionDeCatalogo(['store/signage'],GLOBALES,[],ANTERIORES).length,1);
});

async function browser(){
 const nodes=new Map(),storage=new Map();let blob;
 const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',hidden:false,dataset:{},handlers:{},files:[],innerHTML:'',textContent:'',addEventListener(type,fn){this.handlers[type]=fn;},focus(){},click(){}});return nodes.get(id);};
 const globals=structuredClone(GLOBALES), sandbox={GLOBALES:globals,ANTERIORES:structuredClone(ANTERIORES),PROYECTOS_INICIALES:structuredClone(PROYECTOS_INICIALES),MANIFIESTOS,aplicarManifiesto,
 guion:demos=>guionDeCatalogo(demos,globals,[],ANTERIORES),guionTexto,pasoTexto,proyectoLimpio,CONTEXTO,
 normalizarCatalogo,catalogoActual,guardarSubdemo,borrarSubdemo,structuredClone,JSON,Set,Blob,
 URL:{createObjectURL(b){blob=b;return 'blob:simulated';},revokeObjectURL(){}},localStorage:{getItem(k){return storage.get(k)||null;},setItem(k,v){storage.set(k,v);}},
 document:{querySelector(s){return node(s.slice(1));},createElement(){return node('download');}},fetch:async()=>({ok:false}),setTimeout(){},confirm:()=>true,navigator:{clipboard:{writeText:async()=>{}}},location:{assign(){}}};
 let source=await readFile(new URL('../subdemos/subdemos.js',import.meta.url),'utf8');source=source.replace(/^import .*;\n/gm,'');vm.createContext(sandbox);vm.runInContext(source,sandbox);await new Promise(resolve=>setImmediate(resolve));
 const click=async(dataset)=>node('catalogo').handlers.click({target:{closest(selector){return selector==='[data-add-sub]'&&dataset.addSub||selector==='[data-edit-sub]'&&dataset.editSub||selector==='[data-delete-sub]'&&dataset.deleteSub?{dataset}:null;}}});
 const submit=()=>node('editor-subdemo').handlers.submit({preventDefault(){}});
 return {node,storage,globals,click,submit,exported:async()=>{node('exportar').handlers.click();return JSON.parse(await blob.text());}};
}

test('actual editor handlers add/edit/delete definitions and export project plus catalog for another browser',async()=>{
 const b=await browser();await b.click({addSub:'store'});
 for(const [key,value] of Object.entries({id:'promocion',nombre:'Promoción',desc:'Campaign',url:custom.url,letra:'f',cmd:'/demo store promocion'}))b.node('sub-'+key).value=value;
 b.submit();assert.equal(b.node('editor-subdemo').hidden,true);assert.match(b.node('catalogo').innerHTML,/Promoción/);
 b.node('catalogo').handlers.change({target:{dataset:{clave:'store/promocion'},checked:true}});
 await b.click({editSub:'store/promocion'});assert.equal(b.node('sub-id').readOnly,true);b.node('sub-nombre').value='Edited promotion';b.submit();
 const exported=await b.exported();assert.equal(exported.manifiestos.length,3);assert.ok(exported.proyectos[0].demos.includes('store/promocion'));
 assert.equal(exported.manifiestos.find(m=>m.plataforma==='store').subdemos.find(s=>s.id==='promocion').nombre,'Edited promotion');
 const other=await browser();other.node('importar').files=[{text:async()=>JSON.stringify(exported)}];await other.node('importar').handlers.change({target:other.node('importar')});
 assert.match(other.node('catalogo').innerHTML,/Edited promotion/);assert.ok(JSON.parse(other.storage.get('ax-subdemos')).proyectos[0].demos.includes('store/promocion'));
 await other.click({deleteSub:'store/promocion'});
 assert.equal(JSON.parse(other.storage.get('ax-subdemos')).proyectos[0].demos.includes('store/promocion'),false);
 assert.equal((await other.exported()).manifiestos.find(m=>m.plataforma==='store').subdemos.some(s=>s.id==='promocion'),false);
});

test('editor can remove all platform subdemos and transport an empty override without losing projects',async()=>{
 const b=await browser();for(const s of [...b.globals.find(g=>g.id==='store').subdemos])await b.click({deleteSub:'store/'+s.id});
 const exported=await b.exported();assert.equal(exported.manifiestos.find(m=>m.plataforma==='store').subdemos.length,0);assert.ok(exported.proyectos.length);
 const other=await browser();other.node('importar').files=[{text:async()=>JSON.stringify(exported)}];await other.node('importar').handlers.change({target:other.node('importar')});
 assert.equal(other.globals.find(g=>g.id==='store').subdemos.length,0);assert.equal(JSON.parse(other.storage.get('ax-subdemos')).proyectos.length,exported.proyectos.length);
});


test('an explicit platform catalog is authoritative for deleted builtin definitions',()=>{
 const catalogo=[{version:1,plataforma:'store',subdemos:[]}];
 assert.throws(()=>normalizarDemoProject({demos:['store/voz'],catalogo},{slug:'client'}),/eliminada/);
 assert.deepEqual(guionDeCatalogo(['store/voz'],GLOBALES,catalogo,ANTERIORES),[]);
 const legacy=normalizarDemoProject({demos:['store/signage'],catalogo},{slug:'client'});
 assert.equal(legacy.documentacion[0].clave,'store/signage');
 assert.equal(normalizarDemoProject({demos:['studio/voz'],catalogo},{slug:'client'}).documentacion[0].clave,'studio/voz');
});

test('editor enforces the forty-selected-demos API bound',async()=>{
 const b=await browser(),subdemos=Array.from({length:38},(_,i)=>({id:'test-'+i,nombre:'Test '+i,url:custom.url}));
 const data={proyectos:[{id:'test',nombre:'Test',demos:[]}],manifiestos:[{version:1,plataforma:'store',subdemos}]};
 b.node('importar').files=[{text:async()=>JSON.stringify(data)}];await b.node('importar').handlers.change({target:b.node('importar')});
 for(const clave of [...subdemos.map(s=>'store/'+s.id),'biz/proyecto','biz/circuito'])b.node('catalogo').handlers.change({target:{dataset:{clave},checked:true}});
 const target={dataset:{clave:'studio/voz'},checked:true};b.node('catalogo').handlers.change({target});
 assert.equal(target.checked,false);assert.match(b.node('estado').textContent,/Máximo 40/);
 assert.equal(JSON.parse(b.storage.get('ax-subdemos')).proyectos[0].demos.length,40);
});
