import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildGeneration, OUTPUTS} from '../functions/presentaciones/_generation.js';
import {onRequestGet as renderClientPortal} from '../functions/presentaciones/[client]/index.js';

test('credits and postcredits are native ready outputs with prefilled generator URLs',()=>{
  assert.ok(OUTPUTS.includes('credits'));
  assert.ok(OUTPUTS.includes('postcredits'));
  const job=buildGeneration({
    client:'cliente-demo',
    displayName:'Cliente Demo & Partners',
    outputs:['credits','postcredits'],
    languages:['es','ca']
  });
  assert.deepEqual(job.requested,['credits','postcredits']);
  assert.deepEqual(Object.keys(job.tasks).sort(),[
    'ca:credits','ca:postcredits','es:credits','es:postcredits'
  ]);
  for(const task of Object.values(job.tasks)){
    assert.equal(task.status,'ready');
    assert.equal(task.progress,100);
    assert.equal(task.provider,'admiranext');
    const url=new URL(task.url,'https://www.admiranext.com');
    assert.equal(url.pathname,'/creditos/');
    assert.equal(url.searchParams.get('mode'),task.output);
    assert.equal(url.searchParams.get('project'),'Cliente Demo & Partners');
    assert.equal(url.searchParams.get('client'),'cliente-demo');
    assert.equal(url.searchParams.get('lang'),task.language);
    assert.equal(url.searchParams.get('source'),'presentation-generator');
  }
});

test('generator, editor, portal and credits app expose both new deliverables',async()=>{
  const [generator,editor,portal,credits,index]=await Promise.all([
    readFile(new URL('../assets/presentation-generator-20260721-11.js',import.meta.url),'utf8'),
    readFile(new URL('../assets/presentation-ideas-editor.js',import.meta.url),'utf8'),
    readFile(new URL('../functions/presentaciones/[client]/index.js',import.meta.url),'utf8'),
    readFile(new URL('../creditos/app.js',import.meta.url),'utf8'),
    readFile(new URL('../creditos/index.html',import.meta.url),'utf8')
  ]);
  for(const source of [generator,editor]){
    assert.match(source,/value="credits"/);
    assert.match(source,/value="postcredits"/);
    assert.match(source,/>Créditos</);
    assert.match(source,/>Postcréditos</);
    assert.match(source,/<b>11<\/b><span>Todo/);
  }
  assert.match(portal,/selected\.has\('credits'\)/);
  assert.match(portal,/selected\.has\('postcredits'\)/);
  assert.match(portal,/Créditos finales animados/);
  assert.match(portal,/Pieza postcréditos/);
  assert.match(credits,/source.*presentation-generator/);
  assert.match(credits,/POSTCRÉDITOS/);
  assert.match(credits,/CONTINUARÁ…/);
  assert.match(credits,/postcreditos/);
  assert.match(index,/v\.26\.07\.24\.r2/);
  assert.match(index,/app\.js\?v=26\.07\.24\.r2/);
});

test('generated client portal publishes only the selected credits tools',async()=>{
  const generation=buildGeneration({
    client:'cliente-demo',
    displayName:'Cliente Demo',
    outputs:['website','credits','postcredits'],
    languages:['es']
  });
  const values={
    'presentation:cliente-demo':{displayName:'Cliente Demo',website:'https://example.com',outputs:['website','credits','postcredits'],theme:{}},
    'generation:cliente-demo':generation
  };
  const response=await renderClientPortal({
    params:{client:'cliente-demo'},
    env:{PRESENTATION_IDEAS:{async get(key){return values[key]||null}}}
  });
  const html=await response.text();
  assert.equal(response.status,200);
  assert.match(html,/<h2>Créditos<\/h2>/);
  assert.match(html,/<h2>Postcréditos<\/h2>/);
  assert.match(html,/mode=credits(?:&|&amp;)project=Cliente\+Demo/);
  assert.match(html,/mode=postcredits(?:&|&amp;)project=Cliente\+Demo/);
  assert.match(html,/\.sec:nth-of-type\(4\)\{display:none\}/);
});
