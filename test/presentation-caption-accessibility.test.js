import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {onRequestGet as renderPresentation} from '../functions/presentaciones/[client]/presentacion.js';

const helperUrl=new URL('../assets/presentation-caption-accessibility.js',import.meta.url);
const cssUrl=new URL('../assets/presentation-caption-accessibility.css',import.meta.url);

async function loadContract(overrides={}){
  const source=await readFile(helperUrl,'utf8');
  const window={...overrides};
  vm.runInNewContext(source,{window,Map,Object,String,Array,RegExp,Promise,Intl});
  return window.AdmiraPresenterCaptions;
}

function fakeDocument(){
  function element(tag){return{
    tagName:tag.toUpperCase(),className:'',hidden:false,textContent:'',attributes:{},children:[],parentNode:null,
    setAttribute(name,value){this.attributes[name]=String(value)},
    appendChild(child){child.parentNode=this;this.children.push(child);return child},
    removeChild(child){this.children=this.children.filter(item=>item!==child);child.parentNode=null}
  }}
  const body=element('body');
  return{body,createElement:element};
}

function kv(values){return{async get(key,options){const value=values[key];return options?.type==='json'?value:JSON.stringify(value)}}}

const config={displayName:'Demo',outputs:['website'],languages:['es'],theme:{},sequence:{}};
const ideas={hero:{title:'Propuesta',summary:'Resumen'},objective:'Objetivo',skeleton:[],closing:{title:'Cierre',action:'Acción'},labels:{objective:'Objetivo',next:'Siguiente'}};

test('caption helper exposes a browser-only memory contract with honest original fallback',async()=>{
  const contract=await loadContract();
  assert.equal(contract.version,'1.0.0');
  assert.equal(contract.storage,'memory-only');
  assert.deepEqual({...contract.capabilities()},{browserTranslation:false,externalServices:false,persistentGlossary:false});
  const captions=contract.create({sourceLanguage:'es',targetLanguage:'en'});
  captions.updateGlossary('ADmira NeXT','ADmira NeXT');
  assert.deepEqual({...captions.getGlossary()},{'ADmira NeXT':'ADmira NeXT'});
  const result=await captions.translate('Texto original');
  assert.deepEqual({...result},{
    text:'Texto original',originalText:'Texto original',translated:false,status:'original',reason:'unsupported',sourceLanguage:'es',targetLanguage:'en'
  });
  assert.doesNotMatch(await readFile(helperUrl,'utf8'),/\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|localStorage|sessionStorage/);
});

test('caption helper applies its editable glossary after local browser translation',async()=>{
  const calls=[];
  const contract=await loadContract({Translator:{
    async availability(options){calls.push(['availability',options]);return 'available'},
    async create(options){calls.push(['create',options]);return{async translate(text){calls.push(['translate',text]);return 'Welcome to Smart Room'}}}
  }});
  const captions=contract.create({sourceLanguage:'es',targetLanguage:'en',glossary:{'Smart Room':'Sala Inteligente'}});
  captions.updateGlossary('Welcome','Bienvenidos');
  const result=await captions.translate('Bienvenidos a Sala Inteligente');
  assert.equal(result.text,'Bienvenidos to Sala Inteligente');
  assert.equal(result.translated,true);
  assert.equal(result.status,'translated');
  assert.deepEqual(calls.map(call=>call[0]),['availability','create','translate']);
  assert.equal(captions.removeGlossary('Welcome'),true);
  captions.setGlossary({'Smart Room':'Smart Stage'});
  assert.deepEqual({...captions.getGlossary()},{'Smart Room':'Smart Stage'});
});

test('show renders the original immediately and replaces it only after translation succeeds',async()=>{
  let finishTranslation;
  const document=fakeDocument();
  const rendered=[];
  const contract=await loadContract({document,Translator:{
    async create(){return{translate(){return new Promise(resolve=>{finishTranslation=resolve})}}}
  }});
  const captions=contract.create({document,sourceLanguage:'es',targetLanguage:'en',onCaption:result=>rendered.push({...result})});
  const pending=captions.show('Hola equipo');
  assert.equal(rendered.length,1);
  assert.equal(rendered[0].text,'Hola equipo');
  assert.equal(rendered[0].translated,false);
  assert.equal(document.body.children[0].attributes['data-caption-state'],'translating');
  for(let attempt=0;attempt<5&&!finishTranslation;attempt+=1) await Promise.resolve();
  assert.equal(typeof finishTranslation,'function');
  finishTranslation('Hello team');
  const result=await pending;
  assert.equal(result.text,'Hello team');
  assert.equal(result.translated,true);
  assert.equal(rendered.length,2);
  assert.equal(document.body.children[0].attributes.lang,'en');
});

test('caption assets are injected before the main presenter script for stage and audience output',async()=>{
  for(const suffix of ['', '?audience=1']){
    const response=await renderPresentation({
      params:{client:'demo'},request:new Request(`https://admiranext.test/presentaciones/demo/presentacion${suffix}`),
      env:{PRESENTATION_IDEAS:kv({'presentation:demo':config,'ideas:demo':ideas})},next(){throw new Error('unexpected next')}
    });
    const html=await response.text();
    assert.match(html,/presentation-caption-accessibility\.css\?v=20260723-1/);
    assert.match(html,/presentation-caption-accessibility\.js\?v=20260723-1/);
    assert.ok(html.indexOf('presentation-caption-accessibility.js')<html.indexOf('presentation-presenter-mode.js'));
  }
});

test('caption stylesheet supports responsive, high-contrast and reduced-motion presentation',async()=>{
  const styles=await readFile(cssUrl,'utf8');
  assert.match(styles,/\.presenter-caption-layer/);
  assert.match(styles,/@media \(max-width: 720px\)/);
  assert.match(styles,/@media \(prefers-contrast: more\)/);
  assert.match(styles,/@media \(forced-colors: active\)/);
  assert.match(styles,/data-caption-contrast="high"/);
  assert.match(styles,/@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles,/transition: none !important/);
});
