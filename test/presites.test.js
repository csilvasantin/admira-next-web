import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {normalizePresite,renderPresite,validatePresite} from '../functions/presites/_presite.js';
import {onRequest as sitesApi} from '../functions/presites/api/sites.js';
import {onRequest as siteApi} from '../functions/presites/[site]/api/site.js';
import {onRequest as versionsApi} from '../functions/presites/[site]/api/versions.js';
import {onRequestGet as preview} from '../functions/presites/[site]/preview.js';
import {onRequestGet as exportPresite} from '../functions/presites/[site]/export.js';
import {onRequestGet as generatorRoute} from '../functions/presites/generador.js';

class KV {
  constructor(){this.values=new Map()}
  async get(key,options){const value=this.values.get(key);return value==null?null:options?.type==='json'?JSON.parse(value):value}
  async put(key,value){this.values.set(key,value)}
}
const payload={
  displayName:'PUMA Connected Retail',slug:'puma-connected-retail',
  brief:'Convertir la visita digital en una experiencia física conectada.',
  objective:'Conseguir una reunión para diseñar un piloto.',
  audience:'Dirección de retail, marca e innovación',language:'es',quality:'best',
  cta:'Diseñar juntos el piloto.',theme:{primary:'#09141d',accent:'#ff0033',glow:'#3df08a'}
};

test('el modelo Presite normaliza brief, idioma, calidad y seis bloques editables',()=>{
  const site=normalizePresite(payload);
  assert.equal(validatePresite(site),'');
  assert.equal(site.slug,'puma-connected-retail');
  assert.equal(site.quality,'best');
  assert.equal(site.blocks.length,6);
  assert.deepEqual(site.blocks.map(block=>block.id),['hero','challenge','promise','capabilities','proof','cta']);
  assert.match(site.blocks[0].title,/PUMA/);
});

test('Good, Better y Best comparten narrativa pero exponen direcciones visuales distintas',()=>{
  for(const quality of ['good','better','best']){
    const html=renderPresite(normalizePresite({...payload,quality}));
    assert.match(html,new RegExp(`data-quality="${quality}"`));
    assert.match(html,/ps-grid/);
    assert.match(html,/@media\(max-width:720px\)/);
  }
  assert.match(renderPresite(normalizePresite({...payload,quality:'better'})),/data-quality="better"/);
  assert.match(renderPresite(normalizePresite({...payload,quality:'best'})),/data-quality="best"/);
});

test('API crea, lista, edita y conserva versiones sin publicar externamente',async()=>{
  const kv=new KV(),env={PRESENTATION_IDEAS:kv};
  const create=await sitesApi({request:new Request('https://admiranext.test/presites/api/sites',{method:'PUT',headers:{origin:'https://admiranext.test','content-type':'application/json'},body:JSON.stringify(payload)}),env});
  assert.equal(create.status,201);
  const created=await create.json();
  assert.equal(created.site.status,'draft');
  assert.equal(created.previewUrl,'/presites/puma-connected-retail/preview');
  const list=await sitesApi({request:new Request('https://admiranext.test/presites/api/sites'),env});
  assert.equal((await list.json()).sites.length,1);

  const read=await siteApi({request:new Request('https://admiranext.test/presites/puma-connected-retail/api/site'),params:{site:'puma-connected-retail'},env});
  const site=(await read.json()).site;
  site.blocks[0].title='Move every visit.';
  const update=await siteApi({request:new Request('https://admiranext.test/presites/puma-connected-retail/api/site',{method:'PUT',headers:{origin:'https://admiranext.test','content-type':'application/json'},body:JSON.stringify({blocks:site.blocks})}),params:{site:'puma-connected-retail'},env});
  assert.equal((await update.json()).site.blocks[0].title,'Move every visit.');

  const simulation=await siteApi({request:new Request('https://admiranext.test/presites/puma-connected-retail/api/site',{method:'PUT',headers:{origin:'https://admiranext.test','content-type':'application/json'},body:JSON.stringify({action:'simulate-publish'})}),params:{site:'puma-connected-retail'},env});
  const simulated=(await simulation.json()).site;
  assert.equal(simulated.status,'review-ready');
  assert.deepEqual(simulated.publication.published,false);
  assert.equal(simulated.publication.mode,'simulation');

  const history=await versionsApi({request:new Request('https://admiranext.test/presites/puma-connected-retail/api/versions'),params:{site:'puma-connected-retail'},env});
  assert.equal((await history.json()).versions.length,3);
});

test('preview usa CSP restrictiva y export entrega un HTML autónomo descargable',async()=>{
  const kv=new KV(),site=normalizePresite(payload);await kv.put('presite:site:puma-connected-retail',JSON.stringify(site));
  const rendered=await preview({params:{site:'puma-connected-retail'},env:{PRESENTATION_IDEAS:kv}});
  assert.match(rendered.headers.get('content-security-policy'),/default-src 'none'/);
  assert.match(await rendered.text(),/PUMA Connected Retail/);
  const exported=await exportPresite({params:{site:'puma-connected-retail'},env:{PRESENTATION_IDEAS:kv}});
  assert.match(exported.headers.get('content-disposition'),/attachment/);
  assert.match(await exported.text(),/<!doctype html>/);
});

test('workspace integra preview responsive, edición, versiones, export y navegación hermana',async()=>{
  const [hub,generator,studio,styles,client,app,readme]=await Promise.all([
    readFile(new URL('../presites/index.html',import.meta.url),'utf8'),
    readFile(new URL('../presites/generador/index.html',import.meta.url),'utf8'),
    readFile(new URL('../functions/presites/[site]/index.js',import.meta.url),'utf8'),
    readFile(new URL('../assets/presites-workspace.css',import.meta.url),'utf8'),
    readFile(new URL('../assets/presites-studio.js',import.meta.url),'utf8'),
    readFile(new URL('../assets/app.js',import.meta.url),'utf8'),
    readFile(new URL('../README.md',import.meta.url),'utf8')
  ]);
  assert.match(hub,/Generador de Presentaciones/);
  for(const label of ['Good','Better','Best'])assert.match(generator,new RegExp(label));
  for(const device of ['desktop','tablet','mobile'])assert.match(generator,new RegExp(`data-device="${device}"`));
  assert.match(studio,/Bloques de la home/);
  assert.match(client,/simulate-publish/);
  assert.match(client,/api\/versions/);
  assert.match(client,/querySelectorAll\('\.ps-block-fields input,\.ps-block-fields textarea'\)/);
  assert.doesNotMatch(client,/new FormData\(node\.querySelector\('\.ps-block-fields'\)\)/);
  assert.match(studio,/export/);
  assert.match(styles,/@media\(max-width:600px\)/);
  assert.ok(app.includes("cmd: '/presites'"));
  assert.match(readme,/simulación segura de publicación/i);
});

test('la ruta /presites/generador/ sirve el asset exacto sin caer en [site]',async()=>{
  const source='<!doctype html><html><body><form id="presiteGenerator"></form></body></html>';
  const response=await generatorRoute({request:new Request('https://admiranext.test/presites/generador/'),env:{ASSETS:{fetch:async request=>{
    assert.equal(new URL(String(request)).pathname,'/presites/generador/index.html');
    return new Response(source);
  }}}});
  assert.equal(response.status,200);
  assert.match(await response.text(),/presiteGenerator/);
});
