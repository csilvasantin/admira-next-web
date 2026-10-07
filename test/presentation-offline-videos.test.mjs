import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {localizeDemoMedia,presentationResourceAuth} from '../scripts/build-presentation-offline.cjs';
import {normalizarDemoProject} from '../subdemos/presentacion.mjs';
import {videoPorDemo} from '../subdemos/retail-videos.mjs';
import {demoGlobalHTML} from '../subdemos/demo-player.mjs';
import {readFileSync} from 'node:fs';
const studio=JSON.parse(readFileSync(new URL('../subdemos/studio.subdemos.json',import.meta.url)));
const data=html=>JSON.parse(html.match(/id="demo-data">([\s\S]*?)<\/script>/)[1]);
test('offline localiza los quince vídeos y posters, conserva muestras/variantes y no muta el proyecto capturado',async()=>{
 const project=normalizarDemoProject({...normalizarDemoProject(undefined,{slug:'alsea',displayName:'Alsea'}),catalogo:[studio]},{slug:'alsea',displayName:'Alsea'}),before=JSON.stringify(project),snapshot=structuredClone(project),downloaded=new Map();
 const local=async url=>{assert.match(url,/^https:\/\//);const file='media/'+createHash('sha256').update(url).digest('hex').slice(0,16)+new URL(url).pathname.match(/\.[a-z0-9]+$/i)[0];downloaded.set(url,file);return file;};
 await localizeDemoMedia(snapshot.documentacion,local,videoPorDemo);
 const projected=data(demoGlobalHTML(snapshot,{offline:true}));assert.equal(projected.demos.length,15);assert.equal(new Set(projected.demos.map(d=>d.video.url)).size,15);
 for(const demo of projected.demos){assert.match(demo.video.url,/^media\/[a-f0-9]{16}\.mp4$/);assert.match(demo.video.poster,/^media\/[a-f0-9]{16}\.jpg$/);assert.equal(demo.video.audio,true);assert.equal(demo.video.idioma,'es');const original=project.documentacion.find(d=>d.clave===demo.clave);if(original.muestra){assert.equal(demo.muestra.url,downloaded.get(original.muestra.url));for(const [i,v] of (original.muestra.variantes||[]).entries()){assert.equal(demo.muestra.variantes[i].url,downloaded.get(v.url));assert.equal(demo.muestra.variantes[i].formato,v.formato);}}}
 assert.equal(JSON.stringify(project),before);assert.match(demoGlobalHTML(snapshot),/id="auto-sound"[^>]*checked/);assert.match(demoGlobalHTML(snapshot),/id="auto-mute" aria-pressed="false"/);
});
test('override capturado conserva video dedicado y localiza recursivamente su poster y los medios manuales',async()=>{
 const docs=[{clave:'store/tpv',video:{version:1,tipo:'video',url:'https://media.test/custom.mp4',poster:'https://media.test/custom.jpg',duracion:12,audio:true,idioma:'es',fuente:'ensayo-local'},muestra:{url:'https://media.test/manual.mp3',variantes:[{url:'https://media.test/variant.mp3',poster:'https://media.test/variant.jpg'}]}}],calls=[];
 await localizeDemoMedia(docs,async url=>{calls.push(url);return 'media/'+createHash('sha256').update(url).digest('hex').slice(0,16)+new URL(url).pathname.match(/\.[a-z0-9]+$/i)[0];},videoPorDemo);
 assert.equal(docs[0].video.duracion,12);assert.ok(!calls.some(u=>u.includes('suite-v1')),'override gana al catálogo común');assert.deepEqual(new Set(calls),new Set(['https://media.test/custom.mp4','https://media.test/custom.jpg','https://media.test/manual.mp3','https://media.test/variant.mp3','https://media.test/variant.jpg']));assert.match(videoPorDemo(docs[0]).url,/^media\//,'resolver no restaura URL pública sobre copia localizada');
});

test('builder limita credencial privilegiada al cliente solicitado y rechaza namespaces ajenos antes de fetch',()=>{
 for(const host of ['admiranext.com','www.admiranext.com']){assert.equal(presentationResourceAuth('https://'+host+'/presentaciones/alsea/media/video.mp4','alsea'),true);for(const path of ['/presentaciones/otro/media/video.mp4','/presentaciones/alsea-other/media/video.mp4','/presentaciones/alsea/../otro/media/video.mp4','/presentaciones/alsea/media/a%2fb.mp4'])assert.throws(()=>presentationResourceAuth('https://'+host+path,'alsea'),/Recurso privado/);}
 assert.equal(presentationResourceAuth('https://www.admiranext.com/assets/demos/suite-v1/biz-proyecto.mp4','alsea'),false);assert.equal(presentationResourceAuth('https://media.test/presentaciones/alsea/video.mp4','alsea'),false);
});
