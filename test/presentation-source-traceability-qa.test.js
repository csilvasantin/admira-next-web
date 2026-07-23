import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {
  normalizeSourceTraceability,
  traceabilitySummary
} from '../functions/presentaciones/_source-traceability.js';
import {onRequestGet as renderPresentation} from '../functions/presentaciones/[client]/presentacion.js';

const slideKeys=['cover','objective','market','closing'];

function completeInput(){
  return {
    sources:[
      {id:'web-1',type:'web',label:'Informe web',url:'https://example.com/report?q=1#section-2',locator:'Sección 2'},
      {id:'nb-1',type:'notebooklm',label:'NotebookLM',fingerprint:'notebooklm_0123456789abcdef',locator:'Fuente 3 · página 8'},
      {id:'doc-1',type:'document',label:'Documento',fingerprint:'document_0123456789abcdef',locator:'Página 4'}
    ],
    claims:[
      {id:'claim-cover',slideKey:'cover',contentPath:'hero.summary',label:'Resumen',sourceIds:['web-1','web-1']},
      {id:'claim-objective',slideKey:'objective',contentPath:'objective',sourceIds:['nb-1']},
      {id:'claim-market',slideKey:'market',contentPath:'skeleton.market.detail',sourceIds:['doc-1','web-1']}
    ],
    reviewedSlides:['cover','objective','market','closing','cover']
  };
}

function kv(values){
  return {async get(key,options){const value=values[key];return options?.type==='json'?value:JSON.stringify(value)}};
}

const ideas={
  hero:{title:'Propuesta',summary:'Resumen'},objective:'Objetivo',
  skeleton:[{id:'market',title:'Mercado',message:'Mensaje',detail:'Detalle',enabled:true}],
  closing:{title:'Cierre',action:'Acción'},labels:{objective:'Objetivo',next:'Siguiente'},notes:'Privado'
};

test('QA trazabilidad: conserva el mapping exacto fuente → claim → slide y deduplica referencias',()=>{
  const normalized=normalizeSourceTraceability(completeInput(),slideKeys);
  assert.equal(normalized.schemaVersion,1);
  assert.deepEqual(normalized.slideKeys,slideKeys);
  assert.deepEqual(normalized.claims.map(({id,slideKey,contentPath,sourceIds})=>({id,slideKey,contentPath,sourceIds})),[
    {id:'claim-cover',slideKey:'cover',contentPath:'hero.summary',sourceIds:['web-1']},
    {id:'claim-objective',slideKey:'objective',contentPath:'objective',sourceIds:['nb-1']},
    {id:'claim-market',slideKey:'market',contentPath:'skeleton.market.detail',sourceIds:['doc-1','web-1']}
  ]);
  assert.deepEqual(normalized.reviewedSlides,slideKeys);
  assert.deepEqual(normalized.audit,{
    ready:true,totalClaims:3,verifiableClaims:3,
    unsupportedClaimIds:[],unreviewedSlideKeys:[],orphanSourceIds:[]
  });
  assert.deepEqual(normalizeSourceTraceability(completeInput(),slideKeys),normalized,'la misma entrada produce citas estables');
});

test('QA trazabilidad: distingue web, NotebookLM y documento sin persistir contenido fuente',()=>{
  const input=completeInput();
  for(const source of input.sources) Object.assign(source,{
    body:'contenido privado',quote:'cita extensa privada',content:'documento íntegro',token:'secret-token'
  });
  for(const claim of input.claims) Object.assign(claim,{body:'texto interno',quote:'no persistir'});
  const normalized=normalizeSourceTraceability(input,slideKeys);
  assert.deepEqual(normalized.sources.map(source=>source.type),['web','notebooklm','document']);
  assert.equal(normalized.sources[0].url,'https://example.com/report?q=1#section-2');
  assert.equal(normalized.sources[1].fingerprint,'notebooklm_0123456789abcdef');
  assert.equal(normalized.sources[2].fingerprint,'document_0123456789abcdef');
  assert.doesNotMatch(JSON.stringify(normalized),/contenido privado|cita extensa|documento íntegro|secret-token|texto interno|no persistir/);
});

test('QA trazabilidad: avisa de claims huérfanas, slides sin revisar y fuentes sin uso',()=>{
  const input=completeInput();
  input.claims[1].sourceIds=[];
  input.claims.splice(2,1);
  input.reviewedSlides=['cover'];
  const normalized=normalizeSourceTraceability(input,slideKeys);
  assert.equal(normalized.audit.ready,false);
  assert.deepEqual(normalized.audit.unsupportedClaimIds,['claim-objective']);
  assert.deepEqual(normalized.audit.unreviewedSlideKeys,['objective','market','closing']);
  assert.deepEqual(normalized.audit.orphanSourceIds,['nb-1','doc-1']);
  assert.equal(normalized.audit.verifiableClaims,1);
  assert.deepEqual(traceabilitySummary(normalized),normalized.audit);
});

test('QA trazabilidad: falla cerrado ante referencias ambiguas, orígenes inseguros y límites abusivos',()=>{
  const duplicateSources=completeInput();
  duplicateSources.sources.push({...duplicateSources.sources[0]});
  assert.throws(()=>normalizeSourceTraceability(duplicateSources,slideKeys),/Fuentes.*duplicados/);

  const duplicateClaims=completeInput();
  duplicateClaims.claims.push({...duplicateClaims.claims[0]});
  assert.throws(()=>normalizeSourceTraceability(duplicateClaims,slideKeys),/Afirmaciones.*duplicados/);

  const unknownSource=completeInput();
  unknownSource.claims[0].sourceIds=['missing'];
  assert.throws(()=>normalizeSourceTraceability(unknownSource,slideKeys),/fuentes desconocidas missing/);

  const insecureWeb=completeInput();
  insecureWeb.sources[0].url='http://example.com/report';
  assert.throws(()=>normalizeSourceTraceability(insecureWeb,slideKeys),/URL HTTPS/);

  const privateNetwork=completeInput();
  privateNetwork.sources[0].url='file:///Users/carlos/private.txt';
  assert.throws(()=>normalizeSourceTraceability(privateNetwork,slideKeys),/URL HTTPS/);

  const weakFingerprint=completeInput();
  weakFingerprint.sources[1].fingerprint='guessable';
  assert.throws(()=>normalizeSourceTraceability(weakFingerprint,slideKeys),/fingerprint opaco/);

  const missingLocator=completeInput();
  missingLocator.sources[2].locator='';
  assert.throws(()=>normalizeSourceTraceability(missingLocator,slideKeys),/locator verificable/);

  const wrongSlide=completeInput();
  wrongSlide.claims[0].slideKey='missing-slide';
  assert.throws(()=>normalizeSourceTraceability(wrongSlide,slideKeys),/slideKey/);

  const unknownReview=completeInput();
  unknownReview.reviewedSlides.push('missing-slide');
  assert.throws(()=>normalizeSourceTraceability(unknownReview,slideKeys),/diapositivas.*desconocidas/i);

  const wrongPath=completeInput();
  wrongPath.claims[0].contentPath='__proto__.polluted';
  assert.throws(()=>normalizeSourceTraceability(wrongPath,slideKeys),/contentPath/);

  assert.throws(
    ()=>normalizeSourceTraceability({sources:Array.from({length:101},(_,index)=>({
      id:`s-${index}`,type:'web',url:`https://example.com/${index}`,locator:`p${index}`
    })),claims:[]},slideKeys),
    /hasta 100 fuentes/
  );
});

test('QA trazabilidad: la inyección es privada, escapa cierre de script y no llega a audience',async()=>{
  const input=completeInput();
  input.sources[0].label='</script><script>window.pwned=1</script>';
  const sourceTraceability=normalizeSourceTraceability(input,slideKeys);
  const config={displayName:'Demo',outputs:['website'],languages:['es'],theme:{},sequence:{},sourceTraceability};
  const env={PRESENTATION_IDEAS:kv({'presentation:demo':config,'ideas:demo':ideas})};

  const stage=await renderPresentation({
    params:{client:'demo'},request:new Request('https://admiranext.test/presentaciones/demo/presentacion'),
    env,next(){throw new Error('unexpected next')}
  });
  const stageHtml=await stage.text();
  assert.match(stageHtml,/__ADMIRA_SOURCE_TRACEABILITY__/);
  assert.match(stageHtml,/presentation-source-traceability\.js/);
  assert.match(stageHtml,/\\u003c\/script>\\u003cscript>window\.pwned=1/);
  assert.doesNotMatch(stageHtml,/<\/script><script>window\.pwned=1/);

  const audience=await renderPresentation({
    params:{client:'demo'},request:new Request('https://admiranext.test/presentaciones/demo/presentacion?audience=1'),
    env,next(){throw new Error('unexpected next')}
  });
  const audienceHtml=await audience.text();
  assert.doesNotMatch(audienceHtml,/__ADMIRA_SOURCE_TRACEABILITY__|presentation-source-traceability|claim-cover|window\.pwned/);
});

test('QA trazabilidad: el resumen del navegador coincide y no usa red ni almacenamiento',async()=>{
  const source=await readFile(new URL('../assets/presentation-source-traceability.js',import.meta.url),'utf8');
  const sandbox={};
  vm.runInNewContext(source,sandbox);
  const normalized=normalizeSourceTraceability(completeInput(),slideKeys);
  const browserSummary=sandbox.AdmiraSourceTraceability.summarize(normalized);
  assert.deepEqual(JSON.parse(JSON.stringify(browserSummary)),{
    ready:true,totalClaims:3,verifiableClaims:3,unsupportedClaimIds:[],unreviewedSlideKeys:[]
  });
  assert.match(sandbox.AdmiraSourceTraceability.checklistStatus(normalized),/3 afirmaciones con fuente/);
  assert.doesNotMatch(source,/\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|localStorage|sessionStorage|indexedDB/i);
});
