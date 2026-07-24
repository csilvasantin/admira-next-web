import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../creditos/kernel.js',import.meta.url),'utf8');
const context=vm.createContext({});
vm.runInContext(source,context);
const kernel=context.AdmiraCreditsKernel;

function fakeContext(){
  return {
    font:'',fillStyle:'',strokeStyle:'',globalAlpha:1,textAlign:'',textBaseline:'',lineWidth:1,
    measureText(text){return {width:String(text).length*20}},
    beginPath(){},moveTo(){},lineTo(){},arcTo(){},closePath(){},fillRect(){},stroke(){},
    fillText(){},save(){},restore(){},rect(){},clip(){},
    createRadialGradient(){return {addColorStop(){}}}
  };
}

test('kernel exposes the canonical formats, themes and bounded normalized data',()=>{
  assert.deepEqual(Object.keys(kernel.FORMATS),['wide','vertical','square']);
  assert.equal(Object.keys(kernel.THEMES).length,4);
  const data=kernel.normalizeData({format:'unknown',theme:'unknown',duration:999,credits:'x'.repeat(13000)});
  assert.equal(data.format,'wide');
  assert.equal(data.theme,'signal');
  assert.equal(data.duration,90);
  assert.equal(data.credits.length,12000);
});

test('parser reports malformed lines, useful-empty content and hard limits',()=>{
  const parsed=kernel.parseCredits('[TEAM]\n| Carlos\n[broken\n---');
  assert.equal(parsed.rows[0].type,'section');
  assert.ok(parsed.diagnostics.some(item=>item.code==='empty-pair-side'&&item.line===2));
  assert.ok(parsed.diagnostics.some(item=>item.code==='section-syntax'&&item.line===3));
  const limited=kernel.parseCredits(Array.from({length:121},()=> 'Name').join('\n'));
  assert.equal(limited.rows.length,120);
  assert.ok(limited.diagnostics.some(item=>item.code==='too-many-lines'));
});

test('analysis recommends a longer duration for dense credits',()=>{
  const credits=Array.from({length:40},(_,index)=>`Role ${index} | Person ${index}`).join('\n');
  const analysis=kernel.analyze({credits,format:'vertical',duration:8});
  assert.ok(analysis.recommendedDuration>8);
  assert.ok(analysis.diagnostics.some(item=>item.code==='duration-short'));
});

test('layout accounts for wrapped singles and stacked vertical pairs',()=>{
  const ctx=fakeContext();
  const short=kernel.getLayout(ctx,{credits:'Short',format:'vertical',duration:18});
  const wrapped=kernel.getLayout(ctx,{credits:'A very long single credit that must wrap across several visual lines\nRole | A long participant name that also wraps',format:'vertical',duration:18});
  assert.ok(wrapped.rows[0].lines.length>1);
  assert.ok(wrapped.rows[1].nameLines.length>1);
  assert.ok(wrapped.contentHeight>short.contentHeight);
});

test('renderer consumes the same normalized analysis contract',()=>{
  const ctx=fakeContext();
  const timeline=kernel.renderAt(ctx,{projectTitle:'Demo',credits:'Role | Name',format:'square',theme:'warm',duration:18},9);
  assert.equal(timeline.duration,18);
  assert.equal(timeline.data.format,'square');
  assert.equal(timeline.analysis.rows[0].type,'pair');
});

test('the serializable factory recreates the exact parser and analysis semantics',()=>{
  const recreated=vm.runInContext(`(${context.AdmiraCreditsKernelFactory.toString()})()`,context);
  const input={projectTitle:'Shared engine',credits:'[TEAM]\nRole | Name\nA wrapped final line',format:'vertical',theme:'mono',duration:8};
  assert.equal(JSON.stringify(recreated.parseCredits(input.credits)),JSON.stringify(kernel.parseCredits(input.credits)));
  assert.equal(JSON.stringify(recreated.analyze(input)),JSON.stringify(kernel.analyze(input)));
});
