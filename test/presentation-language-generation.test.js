import test from 'node:test';
import assert from 'node:assert/strict';
import {generateTranslations,normalizeTerminology} from '../functions/presentaciones/api/generate.js';

const ideas={
  hero:{eyebrow:'Privada',title:'Título',summary:'Resumen'},objective:'Objetivo',
  skeleton:[{id:'uno',title:'Idea',message:'Mensaje',detail:'Detalle',enabled:true}],
  closing:{title:'Cierre',action:'Acción'},labels:{objective:'El objetivo',next:'Siguiente paso'}
};

test('new presentations generate complete and distinct Catalan and English versions',async()=>{
  const originalFetch=globalThis.fetch;
  globalThis.fetch=async(_url,options)=>{
    const request=JSON.parse(options.body),input=JSON.parse(request.input[1].content[0].text),count=input.texts.length;
    return new Response(JSON.stringify({output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({translations:{
      es:Array.from({length:count},(_,index)=>`ES ${index+1}`),
      ca:Array.from({length:count},(_,index)=>`CA ${index+1}`),
      en:Array.from({length:count},(_,index)=>`EN ${index+1}`)
    }})}]}]}),{headers:{'content-type':'application/json'}});
  };
  try{
    const translated=await generateTranslations({XAI_API_KEY:'test-key'},ideas,['es','ca','en']);
    assert.equal(translated.es.hero.title,'ES 2');
    assert.equal(translated.ca.hero.title,'CA 2');
    assert.equal(translated.en.hero.title,'EN 2');
    assert.equal(translated.ca.skeleton[0].message,'CA 6');
    assert.equal(translated.en.closing.action,'EN 9');
    assert.equal(translated.ca.labels.next,'CA 11');
    assert.notEqual(translated.ca.hero.title,translated.en.hero.title);
  }finally{globalThis.fetch=originalFetch}
});

test('Spanish-only presentations do not call the translation provider',async()=>{
  const originalFetch=globalThis.fetch;let called=false;globalThis.fetch=async()=>{called=true;throw new Error('unexpected')};
  try{assert.deepEqual(await generateTranslations({},ideas,['es']),{});assert.equal(called,false)}
  finally{globalThis.fetch=originalFetch}
});

test('client terminology accepts text, triples and objects while rejecting incomplete or excessive lists',()=>{
  assert.deepEqual(normalizeTerminology('punto de venta | punt de venda | point of sale'),[{es:'punto de venta',ca:'punt de venda',en:'point of sale'}]);
  assert.deepEqual(normalizeTerminology([['cliente','client','customer'],{es:'Pixeria',ca:'Pixeria',en:'Pixeria'},['cliente','client','customer']]),[
    {es:'cliente',ca:'client',en:'customer'},{es:'Pixeria',ca:'Pixeria',en:'Pixeria'}
  ]);
  assert.throws(()=>normalizeTerminology('incompleto | incomplete'),/ES \| CA \| EN/);
  assert.throws(()=>normalizeTerminology(Array.from({length:31},(_,index)=>[`es-${index}`,`ca-${index}`,`en-${index}`])),/hasta 30/);
});

test('translation generation sends and enforces approved client terminology',async()=>{
  const originalFetch=globalThis.fetch;
  const terminology=[{es:'punto de venta',ca:'punt de venda',en:'point of sale'}];
  const count=11;
  globalThis.fetch=async(_url,options)=>{
    const input=JSON.parse(JSON.parse(options.body).input[1].content[0].text);
    assert.deepEqual(input.terminology,terminology);
    const translations={
      ca:Array.from({length:count},(_,index)=>index===3?'Acordar el punt de venda':`CA ${index+1}`),
      en:Array.from({length:count},(_,index)=>index===3?'Agree the point of sale':`EN ${index+1}`)
    };
    return new Response(JSON.stringify({output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({translations})}]}]}));
  };
  try{
    const sourceIdeas={...ideas,objective:'Acordar el punto de venta'};
    const translated=await generateTranslations({XAI_API_KEY:'test-key'},sourceIdeas,['ca','en'],terminology);
    assert.equal(translated.ca.objective,'Acordar el punt de venda');
    assert.equal(translated.en.objective,'Agree the point of sale');
  }finally{globalThis.fetch=originalFetch}
});
