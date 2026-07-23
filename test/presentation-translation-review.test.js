import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {onRequestGet as renderPresentation} from '../functions/presentaciones/[client]/presentacion.js';

const source=await readFile(new URL('../assets/presentation-translation-review.js',import.meta.url),'utf8');
const sandbox={};vm.runInNewContext(source,sandbox);
const reviewer=sandbox.AdmiraPresentationTranslationReview;

const locale=(title,objective='Acordar el piloto de Pixeria',language='es')=>{
  const copy={
    es:{summary:'Resumen',pilot:'Piloto',message:'Mensaje',detail:'Detalle',close:'Cierre',action:'Acción',objective:'Objetivo',next:'Siguiente'},
    ca:{summary:'Resum',pilot:'Pilot',message:'Missatge',detail:'Detall',close:'Tancament',action:'Acció',objective:'Objectiu',next:'Següent'},
    en:{summary:'Summary',pilot:'Pilot',message:'Message',detail:'Detail',close:'Closing',action:'Action',objective:'Objective',next:'Next'}
  }[language];
  return{hero:{eyebrow:'Pixeria',title,summary:copy.summary},objective,skeleton:[{id:'pilot',title:copy.pilot,message:copy.message,detail:copy.detail}],closing:{title:copy.close,action:copy.action},labels:{objective:copy.objective,next:copy.next}};
};

test('local review checks only configured languages and accepts complete ES CA EN copy',()=>{
  const result=reviewer.review({
    languages:['es','ca','en'],
    locales:{
      es:locale('El objetivo de la presentación'),
      ca:locale('L’objectiu de la presentació','Acordar el pilot de Pixeria','ca'),
      en:locale('The presentation objective','Agree the Pixeria pilot','en')
    },
    terminology:[{es:'Pixeria',ca:'Pixeria',en:'Pixeria'}]
  });
  assert.equal(result.blocking,0);
  assert.equal(result.warnings,0);
  assert.deepEqual(Array.from(result.languages),['es','ca','en']);
});

test('residual copy, missing locales and invariant client terms are reported without duplicate noise',()=>{
  const residual=reviewer.review({
    languages:['es','ca','en'],
    locales:{es:locale('El objetivo de la presentación'),ca:locale('El objetivo de la presentación','Acordar el pilot de Pixeria','ca')},
    terminology:[{es:'Pixeria',ca:'Pixeria',en:'Pixeria'}]
  });
  assert.equal(residual.issues.filter(issue=>issue.type==='missing-locale').length,1);
  assert.equal(residual.issues.filter(issue=>issue.language==='en').length,1);
  assert.ok(residual.issues.some(issue=>issue.type==='residual'&&issue.language==='ca'));

  const missingBrand=reviewer.review({
    languages:['es','en'],
    locales:{es:locale('El objetivo'),en:locale('The objective','Agree the pilot','en')},
    terminology:[{es:'Pixeria',ca:'Pixeria',en:'Pixeria'}]
  });
  assert.ok(missingBrand.issues.some(issue=>issue.type==='terminology'&&issue.language==='en'&&issue.path==='objective'));
  assert.ok(missingBrand.issues.some(issue=>issue.language==='en'&&/^Missing “Pixeria”/.test(issue.detail)));
  const alteredBrand=reviewer.review({
    languages:['es','ca'],
    locales:{es:locale('Pixeria'),ca:locale('Pixèria','Acordar el pilot de Pixèria','ca')},
    terminology:[{es:'Pixeria',ca:'Pixeria',en:'Pixeria'}]
  });
  assert.ok(alteredBrand.issues.some(issue=>issue.type==='terminology'&&issue.language==='ca'));
});

test('valid Catalan prose with shared particles is not classified as Spanish residual text',()=>{
  const result=reviewer.review({languages:['es','ca'],locales:{es:locale('Presencia de marca'),ca:locale('Presència de marca','Acordar el pilot','ca')}});
  assert.equal(result.issues.filter(issue=>issue.type==='residual').length,0);
  const mixed=reviewer.review({languages:['es','ca'],locales:{es:locale('Propuesta'),ca:locale('Proposta para el cliente','Acordar el pilot','ca')}});
  assert.ok(mixed.issues.some(issue=>issue.type==='residual'&&issue.path==='hero.title'));
});

function kv(values){return{async get(key,options){const value=values.get(key);return options?.type==='json'&&value?JSON.parse(value):value||null}}}
test('presenter exposes terminology review privately and omits it entirely from audience output',async()=>{
  const presentation={displayName:'Demo',outputs:['website'],languages:['es','ca','en'],terminology:[{es:'punto de venta',ca:'punt de venda',en:'point of sale'}],theme:{}};
  const ideas={...locale('Título'),languages:['es','ca','en'],translations:{ca:locale('Títol','Acordar el pilot','ca'),en:locale('Title','Agree the pilot','en')}};
  const env={PRESENTATION_IDEAS:kv(new Map([['presentation:demo',JSON.stringify(presentation)],['ideas:demo',JSON.stringify(ideas)]]))};
  const context=url=>({params:{client:'demo'},env,request:new Request(url),next(){return new Response('missing',{status:404})}});
  const privateHtml=await (await renderPresentation(context('https://admiranext.test/presentaciones/demo/presentacion'))).text();
  assert.match(privateHtml,/presentation-translation-review\.css/);
  assert.match(privateHtml,/presentation-translation-review\.js/);
  assert.match(privateHtml,/terminology:\[\{"es":"punto de venta"/);
  const audienceHtml=await (await renderPresentation(context('https://admiranext.test/presentaciones/demo/presentacion?audience=1'))).text();
  assert.doesNotMatch(audienceHtml,/presentation-translation-review/);
  assert.doesNotMatch(audienceHtml,/terminology:|punto de venta/);
});

test('presenter keeps absent and partial locales incomplete instead of silently falling back to Spanish',async()=>{
  const presentation={displayName:'Demo',outputs:['website'],languages:['es','ca','en'],theme:{}};
  const ideas={...locale('Título'),languages:['es','ca','en'],translations:{en:{...locale('Title','Agree the pilot','en'),objective:''}}};
  const env={PRESENTATION_IDEAS:kv(new Map([['presentation:demo',JSON.stringify(presentation)],['ideas:demo',JSON.stringify(ideas)]]))};
  const response=await renderPresentation({params:{client:'demo'},env,request:new Request('https://admiranext.test/presentaciones/demo/presentacion'),next(){return new Response('missing',{status:404})}});
  const html=await response.text();
  assert.match(html,/locales:\{"es":[\s\S]*?"ca":null/);
  assert.match(html,/"en":\{"hero":[\s\S]*?"objective":""/);
  assert.match(html,/presentationState\.locales\[language\]\|\|presentationState\.emptyLocale/);
  assert.doesNotMatch(html,/presentationState\.locales\[language\]\|\|presentationState\.locales\.es/);
});

test('review blocks omitted, duplicated and reordered skeleton topology',()=>{
  const es=locale('Título'),second={id:'second',title:'Segundo',message:'Mensaje dos',detail:'Detalle dos'};
  es.skeleton.push(second);
  const ca=locale('Títol','Acordar el pilot','ca');
  const omitted=reviewer.review({languages:['es','ca'],locales:{es,ca}});
  assert.equal(omitted.issues.filter(issue=>issue.type==='missing-field'&&issue.path.startsWith('skeleton.second.')).length,3);
  assert.ok(omitted.blocking>=3);

  const duplicate={...ca,skeleton:[ca.skeleton[0],{...ca.skeleton[0]}]};
  const duplicated=reviewer.review({languages:['es','ca'],locales:{es,ca:duplicate}});
  assert.ok(duplicated.issues.some(issue=>issue.type==='structure'&&/duplicat/.test(issue.detail)));

  const complete={...ca,skeleton:[{id:'second',title:'Segon',message:'Missatge dos',detail:'Detall dos'},ca.skeleton[0]]};
  const reordered=reviewer.review({languages:['es','ca'],locales:{es,ca:complete}});
  assert.ok(reordered.issues.some(issue=>issue.type==='structure'&&/ordre/.test(issue.detail)));
});

test('review asset has no runtime network or persistent storage access',()=>{
  assert.doesNotMatch(source,/\bfetch\s*\(|XMLHttpRequest|WebSocket|localStorage|sessionStorage|indexedDB/);
  assert.match(source,/role','dialog/);
  assert.match(source,/aria-labelledby/);
  assert.match(source,/aria-expanded/);
  assert.match(source,/close\.focus\(\)/);
  assert.match(source,/trigger\.focus\(\)/);
  assert.match(source,/scrollIntoView/);
});
