import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {GLOBALES,ANTERIORES,PROYECTOS_INICIALES,MANIFIESTOS,aplicarManifiesto,guionTexto,pasoTexto,proyectoLimpio,CONTEXTO} from '../subdemos/catalogo.mjs';
import {validarVideo,validarSubdemo,normalizarCatalogo,catalogoActual,guardarSubdemo,borrarSubdemo,guionDeCatalogo} from '../subdemos/editor-catalogo.mjs';
import {normalizarDemoProject} from '../subdemos/presentacion.mjs';
import {VIDEOS_RETAIL} from '../subdemos/retail-videos.mjs';
import {buildRemotePlan,hashNarrationText} from '../demo/remote-plan.mjs';
const video={version:1,tipo:'video',url:'https://www.pixeria.com/prepared/custom.mp4',poster:'https://www.pixeria.com/prepared/custom.jpg',duracion:80,audio:true,idioma:'ca',descripcion:'Descripción preparada original',fuente:'ensayo-local'};
const custom={id:'promocion',nombre:'Promoción',desc:'Campaña local',url:'https://www.admira.store/promocion',aliases:['promo'],guion:[{texto:'Revisar el caso preparado'}],steps:[{action:'show'}],caso:{id:'pilot'},muestra:{url:'https://www.pixeria.com/sample.mp3',variantes:[{url:'https://www.pixeria.com/alternate.mp3'}]},video};

test('optional video validates bounded metadata and preserves source definitions, including explicit null',()=>{
 const before=JSON.stringify(custom),checked=validarSubdemo(custom);assert.deepEqual(checked.video,video);assert.deepEqual(checked.muestra,custom.muestra);assert.equal(JSON.stringify(custom),before);
 checked.video.descripcion='Edited copy';assert.equal(custom.video.descripcion,video.descripcion);
 assert.equal(validarVideo(null),null);assert.equal(validarSubdemo({...custom,video:null}).video,null);
 const minimal={...video};delete minimal.poster;delete minimal.duracion;assert.deepEqual(validarVideo(minimal),minimal);
 for(const duracion of [0.001,300])assert.equal(validarVideo({...video,duracion}).duracion,duracion);
});
test('video rejects unsupported contracts, unsafe URL metadata and nonfinite or overlong values',()=>{
 for(const bad of [[],false,'video',{...video,version:2},{...video,tipo:'audio'},{...video,url:'http://example.test/a.mp4'},{...video,url:'javascript:alert(1)'},{...video,url:'data:video/mp4;base64,AAAA'},{...video,url:'https://u:p@example.test/a.mp4'},{...video,poster:'https://u:p@example.test/a.jpg'},{...video,poster:'http://example.test/a.jpg'},{...video,url:'https://example.test/'+ 'x'.repeat(2050)},{...video,duracion:0},{...video,duracion:-1},{...video,duracion:301},{...video,duracion:Infinity},{...video,duracion:NaN},{...video,duracion:'80'},{...video,audio:'true'},{...video,idioma:'fr'},{...video,descripcion:null},{...video,descripcion:'x'.repeat(1001)},{...video,fuente:'generated-paid'},{...video,unknown:true}])assert.throws(()=>validarVideo(bad));
 for(const field of ['version','tipo','url','audio','idioma','descripcion','fuente']){const incomplete={...video};delete incomplete[field];assert.throws(()=>validarVideo(incomplete),field);}
 assert.throws(()=>normalizarCatalogo([{plataforma:'store',subdemos:[{...custom,video:{...video,duracion:Infinity}}]}]));
});
test('CRUD and JSON import/export retain independent video, original sample and rehearsal fields',()=>{
 const input=catalogoActual(GLOBALES),before=JSON.stringify(input);const added=guardarSubdemo(input,'store',custom),imported=normalizarCatalogo(JSON.parse(JSON.stringify(added)));
 const edited=guardarSubdemo(imported,'store',{...custom,nombre:'Edited promotion'},'promocion'),entry=edited.find(m=>m.plataforma==='store').subdemos.find(s=>s.id==='promocion');
 for(const key of ['video','muestra','guion','steps','aliases','caso'])assert.deepEqual(entry[key],custom[key]);assert.equal(JSON.stringify(input),before);
 assert.equal(borrarSubdemo(edited,'store','promocion').find(m=>m.plataforma==='store').subdemos.some(s=>s.id==='promocion'),false);
});
test('only a valid custom catalog authorizes an unknown selected video; snapshots never mutate the global catalog',()=>{
 const before=JSON.stringify(GLOBALES),catalogo=[{version:1,plataforma:'store',subdemos:[structuredClone(custom)]}];
 const saved=normalizarDemoProject({id:'client',demos:['store/promocion'],catalogo},{slug:'client'});assert.deepEqual(saved.documentacion[0].video,video);assert.deepEqual(saved.documentacion[0].muestra,custom.muestra);
 catalogo[0].subdemos[0].video.url='https://example.test/changed.mp4';assert.equal(saved.documentacion[0].video.url,video.url);assert.equal(JSON.stringify(GLOBALES),before);
 assert.throws(()=>normalizarDemoProject({demos:['store/promocion']},{slug:'client'}),/desconocida/);
 assert.throws(()=>normalizarDemoProject({demos:['store/promocion'],catalogo:[{plataforma:'store',subdemos:[{...custom,video:{...video,url:'http://bad.test/a.mp4'}}]}]},{slug:'client'}));
});
test('all fifteen core functions have fallback reels, null keeps fallback, explicit overrides preserve narration hashes',async()=>{
 const keys=Object.keys(VIDEOS_RETAIL);assert.equal(keys.length,15);
 const baseline=catalogoActual(GLOBALES),studio=JSON.parse(await readFile(new URL('../subdemos/studio.subdemos.json',import.meta.url),'utf8'));baseline.find(m=>m.plataforma==='studio').subdemos=normalizarCatalogo([studio])[0].subdemos;
 const base=guionDeCatalogo(keys,GLOBALES,baseline,ANTERIORES);assert.equal(base.length,15);assert.ok(base.every(item=>item.video?.url&&item.video.audio===true));base.forEach(item=>validarVideo(item.video));
 const before=JSON.stringify(GLOBALES),catalogo=structuredClone(baseline),store=catalogo.find(m=>m.plataforma==='store');store.subdemos=store.subdemos.map(s=>({...s,video:s.id==='voz'?video:null}));
 const updated=guionDeCatalogo(keys,GLOBALES,catalogo,ANTERIORES);assert.deepEqual(updated.find(d=>d.clave==='store/voz').video,video);assert.deepEqual(updated.find(d=>d.clave==='store/musica').video,VIDEOS_RETAIL['store/musica']);
 const slides=keys.map(demoKey=>({text:'Generic appendix '+demoKey,demoKey}));slides.push({text:'Generic closing'});
 const originalPlan=buildRemotePlan(slides,{documentacion:base}),newPlan=buildRemotePlan(slides,{documentacion:updated});assert.deepEqual(newPlan,originalPlan);
 assert.deepEqual(await Promise.all(newPlan.map(s=>hashNarrationText(s.text))),await Promise.all(originalPlan.map(s=>hashNarrationText(s.text))));assert.equal(JSON.stringify(GLOBALES),before);
});

async function browser(){
 const nodes=new Map(),storage=new Map();let blob;
 const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',checked:false,hidden:false,dataset:{},handlers:{},files:[],innerHTML:'',textContent:'',addEventListener(type,fn){this.handlers[type]=fn;},focus(){},click(){}});return nodes.get(id);};
 const globals=structuredClone(GLOBALES),sandbox={GLOBALES:globals,ANTERIORES:structuredClone(ANTERIORES),PROYECTOS_INICIALES:structuredClone(PROYECTOS_INICIALES),MANIFIESTOS,aplicarManifiesto,guion:demos=>guionDeCatalogo(demos,globals,[],ANTERIORES),guionTexto,pasoTexto,proyectoLimpio,CONTEXTO,
 normalizarCatalogo,catalogoActual,guardarSubdemo,borrarSubdemo,structuredClone,JSON,Set,Blob,URL:{createObjectURL(b){blob=b;return 'blob:simulated';},revokeObjectURL(){}},localStorage:{getItem(k){return storage.get(k)||null;},setItem(k,v){storage.set(k,v);}},document:{querySelector:s=>node(s.slice(1)),createElement:()=>node('download')},fetch:async()=>({ok:false}),setTimeout(){},confirm:()=>true,navigator:{clipboard:{writeText:async()=>{}}},location:{assign(){}}};
 const source=(await readFile(new URL('../subdemos/subdemos.js',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'');vm.createContext(sandbox);vm.runInContext(source,sandbox);await new Promise(resolve=>setImmediate(resolve));
 return{node,storage,globals,click:dataset=>node('catalogo').handlers.click({target:{closest:s=>s==='[data-add-sub]'&&dataset.addSub||s==='[data-edit-sub]'&&dataset.editSub||s==='[data-delete-sub]'&&dataset.deleteSub?{dataset}:null}}),submit:()=>node('editor-subdemo').handlers.submit({preventDefault(){}}),import:async data=>{node('importar').files=[{text:async()=>JSON.stringify(data)}];await node('importar').handlers.change({target:node('importar')});},export:async()=>{node('exportar').handlers.click();return JSON.parse(await blob.text());}};
}
test('actual editor imports, edits and exports video without dropping rich metadata or the original sample',async()=>{
 const b=await browser();await b.import({proyectos:[{id:'client',nombre:'Client',demos:['store/promocion']}],manifiestos:[{version:1,plataforma:'store',subdemos:[custom]}]});
 b.click({editSub:'store/promocion'});assert.equal(b.node('sub-video-url').value,video.url);assert.equal(b.node('sub-video-poster').value,video.poster);assert.equal(b.node('sub-video-audio').checked,true);
 b.node('sub-video-url').value='https://www.pixeria.com/prepared/edited.mp4';b.node('sub-video-poster').value='';b.node('sub-nombre').value='Edited';b.submit();
 const exported=await b.export(),entry=exported.manifiestos.find(m=>m.plataforma==='store').subdemos[0];assert.equal(entry.video.url,'https://www.pixeria.com/prepared/edited.mp4');assert.equal(entry.video.poster,undefined);assert.equal(entry.video.duracion,80);assert.equal(entry.video.idioma,'ca');assert.equal(entry.video.descripcion,video.descripcion);assert.deepEqual(entry.muestra,custom.muestra);assert.deepEqual(entry.guion,custom.guion);
 const other=await browser();await other.import(exported);other.click({editSub:'store/promocion'});assert.equal(other.node('sub-video-url').value,entry.video.url);other.node('sub-video-url').value='';other.submit();assert.equal((await other.export()).manifiestos.find(m=>m.plataforma==='store').subdemos[0].video,undefined);assert.deepEqual((await other.export()).manifiestos.find(m=>m.plataforma==='store').subdemos[0].muestra,custom.muestra);
});
test('editor adds a prepared custom video with honest defaults, rejects orphan poster and invalid import',async()=>{
 const b=await browser();b.click({addSub:'store'});for(const [key,value] of Object.entries({id:'promocion',nombre:'Promoción',desc:'Prepared case',url:custom.url}))b.node('sub-'+key).value=value;
 b.node('sub-video-poster').value=video.poster;b.submit();assert.match(b.node('sub-error').textContent,/URL del vídeo/);
 b.node('sub-video-url').value=video.url;b.node('sub-video-audio').checked=true;b.submit();const entry=(await b.export()).manifiestos.find(m=>m.plataforma==='store').subdemos.find(s=>s.id==='promocion');assert.deepEqual(entry.video,{version:1,tipo:'video',idioma:'es',descripcion:'Prepared case',fuente:'ensayo-local',url:video.url,audio:true,poster:video.poster});
 const other=await browser();await other.import({proyectos:[{id:'client',nombre:'Client',demos:['store/promocion']}],manifiestos:[{plataforma:'store',subdemos:[{...custom,video:{...video,tipo:'audio'}}]}]});assert.match(other.node('estado').textContent,/vídeo/);assert.equal(other.globals.find(g=>g.id==='store').subdemos.some(s=>s.id==='promocion'),false);
});
