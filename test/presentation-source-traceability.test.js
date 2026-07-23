import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {normalizeSourceTraceability,traceabilitySummary} from '../functions/presentaciones/_source-traceability.js';

const slides=['cover','objective','vision','closing'];
const uiSource=await readFile(new URL('../assets/presentation-source-traceability.js',import.meta.url),'utf8');
const uiContext=vm.createContext({});
vm.runInContext(uiSource,uiContext);
const traceabilityUi=uiContext.AdmiraSourceTraceability;

test('links web, NotebookLM and document sources to claims and slides with stable ids',()=>{
  const input={
    sources:[
      {id:'web-annual',type:'web',label:'Annual report',url:'https://example.com/report',locator:'Section 4'},
      {id:'nlm-brief',type:'notebooklm',label:'Notebook',fingerprint:'notebooklm_0123456789abcdef',locator:'Answer 7 · source chip 2'},
      {id:'doc-pilot',type:'document',label:'Pilot PDF',fingerprint:'sha256_0123456789abcdef',locator:'p. 12'}
    ],
    claims:[
      {id:'claim-growth',slideKey:'vision',contentPath:'skeleton.vision.message',sourceIds:['web-annual']},
      {id:'claim-context',slideKey:'vision',contentPath:'skeleton.vision.detail',sourceIds:['nlm-brief','doc-pilot']}
    ],
    reviewedSlides:slides
  };
  const contract=normalizeSourceTraceability(input,slides);
  assert.equal(contract.schemaVersion,1);
  assert.deepEqual(contract.claims[1].sourceIds,['nlm-brief','doc-pilot']);
  assert.equal(contract.audit.ready,true);
  assert.equal(contract.audit.verifiableClaims,2);
  assert.deepEqual(contract.audit.orphanSourceIds,[]);
});

test('reports unsupported claims, unreviewed slides and orphan sources without inventing support',()=>{
  const contract=normalizeSourceTraceability({
    sources:[{id:'web-only',type:'web',url:'https://example.com',locator:'Home'}],
    claims:[{id:'claim-orphan',slideKey:'objective',contentPath:'objective',sourceIds:[]}],
    reviewedSlides:['cover']
  },slides);
  assert.equal(contract.audit.ready,false);
  assert.deepEqual(contract.audit.unsupportedClaimIds,['claim-orphan']);
  assert.deepEqual(contract.audit.unreviewedSlideKeys,['objective','vision','closing']);
  assert.deepEqual(contract.audit.orphanSourceIds,['web-only']);
  assert.match(traceabilityUi.checklistStatus(contract),/1 afirmaciones sin respaldo verificable/);
  assert.match(traceabilityUi.checklistStatus(contract),/3 diapositivas sin revisar/);
});

test('fails closed on duplicate ids, unknown sources and unverifiable origin contracts',()=>{
  assert.throws(()=>normalizeSourceTraceability({sources:[
    {id:'same',type:'web',url:'https://example.com/a',locator:'A'},
    {id:'same',type:'web',url:'https://example.com/b',locator:'B'}
  ]},slides),/duplicados/);
  assert.throws(()=>normalizeSourceTraceability({sources:[
    {id:'web',type:'web',url:'http://example.com',locator:'A'}
  ]},slides),/URL HTTPS/);
  assert.throws(()=>normalizeSourceTraceability({sources:[
    {id:'web',type:'web',url:'https://example.com'}
  ]},slides),/locator verificable/);
  assert.throws(()=>normalizeSourceTraceability({sources:[
    {id:'doc',type:'document',fingerprint:'short',locator:'p. 1'}
  ]},slides),/fingerprint opaco/);
  assert.throws(()=>normalizeSourceTraceability({
    sources:[{id:'web',type:'web',url:'https://example.com',locator:'A'}],
    claims:[{id:'claim',slideKey:'vision',contentPath:'skeleton.vision.message',sourceIds:['missing']}]
  },slides),/fuentes desconocidas/);
  assert.throws(()=>normalizeSourceTraceability({
    sources:[{id:'web',type:'web',url:'https://example.com',locator:'A'}],
    reviewedSlides:['not-a-slide']
  },slides),/diapositivas revisadas desconocidas/);
});

test('stores only metadata needed for verification and drops source bodies, quotes and tokens',()=>{
  const contract=normalizeSourceTraceability({
    sources:[{id:'doc',type:'document',label:'Private deck',fingerprint:'sha256_0123456789abcdef',locator:'slide 9',body:'secret',token:'secret'}],
    claims:[{id:'claim',slideKey:'vision',contentPath:'skeleton.vision.message',sourceIds:['doc'],quote:'secret',content:'secret'}],
    reviewedSlides:slides
  },slides);
  const serialized=JSON.stringify(contract);
  assert.doesNotMatch(serialized,/secret/);
  assert.deepEqual(Object.keys(contract.sources[0]).sort(),['fingerprint','id','label','locator','type','verifiable']);
  assert.deepEqual(Object.keys(contract.claims[0]).sort(),['contentPath','id','label','slideKey','sourceIds']);
});

test('default website is registered but does not silently cite or review generated slides',()=>{
  const contract=normalizeSourceTraceability(null,slides,{website:'https://client.example/',websiteLabel:'Client official site'});
  assert.equal(contract.sources[0].id,'client-website');
  assert.equal(contract.sources[0].verifiable,true);
  assert.equal(contract.claims.length,0);
  assert.equal(contract.audit.ready,false);
  assert.deepEqual(contract.audit.unreviewedSlideKeys,slides);
  assert.deepEqual(traceabilitySummary(contract),contract.audit);
});

test('presenter integration keeps traceability private and adds the preflight warning',async()=>{
  const presenter=await readFile(new URL('../functions/presentaciones/[client]/presentacion.js',import.meta.url),'utf8');
  const mode=await readFile(new URL('../assets/presentation-presenter-mode.js',import.meta.url),'utf8');
  assert.match(presenter,/audienceMode\?'':`<script>window\.__ADMIRA_PRESENTER_NOTES__/);
  assert.match(presenter,/window\.__ADMIRA_SOURCE_TRACEABILITY__/);
  assert.match(presenter,/sourceTraceabilityScript=audienceMode\?'':/);
  assert.match(mode,/traceabilityChecklistStatus\(\)/);
  assert.match(mode,/Trazabilidad pendiente: esta presentación no tiene un registro/);
});
