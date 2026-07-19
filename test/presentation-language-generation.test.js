import test from 'node:test';
import assert from 'node:assert/strict';
import {generateTranslations} from '../functions/presentaciones/api/generate.js';

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
      ca:Array.from({length:count},(_,index)=>`CA ${index+1}`),
      en:Array.from({length:count},(_,index)=>`EN ${index+1}`)
    }})}]}]}),{headers:{'content-type':'application/json'}});
  };
  try{
    const translated=await generateTranslations({XAI_API_KEY:'test-key'},ideas,['es','ca','en']);
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
