import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import JSZip from 'jszip';
import {buildNotebookSourceBundle,sanitizePowerPointBranding} from '../fidelity-bridge.js';

const sha256=value=>createHash('sha256').update(value).digest('hex');

function shape({id,name,text}){
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>${text}</a:t></a:r></a:p></p:txBody></p:sp>`;
}

function picture({id,name,rid}){
  return `<p:pic><p:nvPicPr><p:cNvPr id="${id}" name="${name}"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="${rid}"/></p:blipFill><p:spPr/></p:pic>`;
}

function slideXml(blocks){
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree>${blocks.join('')}</p:spTree></p:cSld></p:sld>`;
}

async function syntheticDeck(){
  const archive=new JSZip();
  const protectedParts={
    'ppt/theme/theme1.xml':'<a:theme name="Client theme"><a:extraClrSchemeLst/></a:theme>',
    'ppt/slideMasters/slideMaster1.xml':'<p:sldMaster data-client-master="untouched"/>',
    'ppt/slideLayouts/slideLayout1.xml':'<p:sldLayout data-composition="as-generated"/>',
    'ppt/fontTable.xml':'<a:fontCollection><a:latin typeface="Client Sans"/></a:fontCollection>',
    'ppt/presentation.xml':'<p:presentation cx="12192000" cy="6858000"/>'
  };
  for(const [name,content] of Object.entries(protectedParts))archive.file(name,content);
  archive.file('[Content_Types].xml','<Types/>');
  const watermark=Buffer.from('known provider watermark pixels');
  archive.file('ppt/media/image1.png',watermark);
  archive.file('ppt/media/content-photo.png',Buffer.from('irreplaceable client content'));
  archive.file(
    'ppt/slides/slide1.xml',
    slideXml([
      shape({id:1,name:'NotebookLM watermark',text:'NotebookLM'}),
      shape({id:2,name:'Body copy',text:'NotebookLM is cited here as a research source; this complete narrative sentence must remain.'}),
      shape({id:3,name:'Decision',text:'Approve the four-week pilot without changing this content.'})
    ])
  );
  archive.file(
    'ppt/slides/slide2.xml',
    slideXml([
      picture({id:4,name:'Decorative footer',rid:'rIdWatermark'}),
      picture({id:5,name:'Client evidence',rid:'rIdContent'}),
      shape({id:6,name:'Body copy',text:'Evidence and customer narrative stay intact.'})
    ])
  );
  archive.file(
    'ppt/slides/_rels/slide2.xml.rels',
    '<?xml version="1.0"?><Relationships><Relationship Id="rIdWatermark" Target="../media/image1.png"/><Relationship Id="rIdContent" Target="../media/content-photo.png"/></Relationships>'
  );
  archive.file(
    'ppt/slides/slide3.xml',
    slideXml([
      shape({id:7,name:'Body copy',text:'A long comparison of Gemini Notebook and other research tools is legitimate editorial content and must survive unchanged.'}),
      shape({id:8,name:'Call to action',text:'Choose the next step.'})
    ])
  );
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'admira-fidelity-qa-'));
  const file=path.join(dir,'deck.pptx');
  await fs.writeFile(file,await archive.generateAsync({type:'nodebuffer'}));
  return {file,protectedParts,watermarkHash:sha256(watermark)};
}

async function zipParts(file){
  const archive=await JSZip.loadAsync(await fs.readFile(file));
  const parts={};
  for(const name of Object.keys(archive.files).sort()){
    if(archive.files[name].dir)continue;
    parts[name]=await archive.file(name).async('nodebuffer');
  }
  return parts;
}

test('source bundle imports canonical narrative and records an immutable visual-fidelity contract',()=>{
  const job={
    client:'demo',
    displayName:'Demo',
    languages:['es','ca','en','xx'],
    sourceText:'FUENTE CANÓNICA\n01. Problema real\n02. Evidencia\n03. Propuesta\n04. Decisión'
  };
  const presentation={
    slug:'demo',
    displayName:'Demo Retail',
    website:'https://demo.example/',
    inspirationUrl:'https://reference.example/system',
    theme:{
      mode:'dark',profile:'immersive',layout:'editorial',fontStyle:'Client Sans',
      primary:'#102030',accent:'#f0a000',background:'#050607',surface:'#111827',
      text:'#f8fbff',density:'airy',radiusStyle:'sharp'
    }
  };
  const visualBrief='Master direction: asymmetric 12-column grid, 64 px margins, 96 pt display type and restrained evidence panels.';
  const first=buildNotebookSourceBundle({job,presentation,visualBrief});
  const second=buildNotebookSourceBundle({job,presentation,visualBrief});

  assert.deepEqual(second,first);
  assert.equal(first.manifest.schemaVersion,1);
  assert.equal(first.manifest.client,'demo');
  assert.equal(first.manifest.displayName,'Demo Retail');
  assert.deepEqual(first.manifest.languageScope,['es','ca','en']);
  assert.equal(first.manifest.narrativeSha256,sha256(job.sourceText));
  assert.equal(first.manifest.narrativeCharacters,job.sourceText.length);
  assert.deepEqual(first.manifest.sources,[
    {role:'official-client-source',url:'https://demo.example/'},
    {role:'visual-reference',url:'https://reference.example/system'}
  ]);
  assert.deepEqual(first.manifest.fidelity.theme,presentation.theme);
  for(const part of ['theme','slide-masters','slide-layouts','embedded-fonts','slide-size','object-transforms','reading-order']){
    assert.ok(first.manifest.fidelity.preserve.includes(part),`missing preservation contract for ${part}`);
  }
  assert.equal(first.manifest.fidelity.providerCleanup,'identified-elements-only');
  assert.equal(first.manifest.fidelity.allowReflow,false);
  assert.equal(first.manifest.fidelity.allowThemeSubstitution,false);
  assert.equal(first.manifest.fidelity.allowFontSubstitution,false);
  assert.match(first.text,/asymmetric 12-column grid/);
  assert.match(first.text,/Client Sans/);
  assert.match(first.text,/composition and reading order/i);
  assert.equal(first.text.split(job.sourceText).length-1,1,'canonical narrative must be imported exactly once');

  const changed=buildNotebookSourceBundle({job:{...job,sourceText:`${job.sourceText}\n05. Cierre`},presentation,visualBrief});
  assert.notEqual(changed.manifest.narrativeSha256,first.manifest.narrativeSha256);
});

test('PowerPoint sanitizer removes only explicit branding and allowlisted image hashes',async()=>{
  const fixture=await syntheticDeck();
  const before=await zipParts(fixture.file);
  const result=await sanitizePowerPointBranding(fixture.file,{watermarkHashes:[fixture.watermarkHash]});
  const after=await zipParts(result.file);

  assert.equal(result.report.changed,true);
  assert.equal(result.report.removedShapes,2);
  assert.equal(result.report.narrativeSafe,true);
  assert.equal(result.report.slides.length,2);
  assert.ok(result.report.slides.every(item=>item.beforeSha256!==item.afterSha256));

  for(const name of [
    'ppt/theme/theme1.xml',
    'ppt/slideMasters/slideMaster1.xml',
    'ppt/slideLayouts/slideLayout1.xml',
    'ppt/fontTable.xml',
    'ppt/presentation.xml'
  ]){
    assert.deepEqual(after[name],before[name],`${name} changed`);
    assert.equal(result.report.protectedParts[name],sha256(before[name]));
  }
  assert.deepEqual(after['ppt/media/content-photo.png'],before['ppt/media/content-photo.png']);
  assert.deepEqual(after['ppt/slides/_rels/slide2.xml.rels'],before['ppt/slides/_rels/slide2.xml.rels']);
  assert.deepEqual(after['ppt/slides/slide3.xml'],before['ppt/slides/slide3.xml']);

  const slide1=after['ppt/slides/slide1.xml'].toString();
  const slide2=after['ppt/slides/slide2.xml'].toString();
  const slide3=after['ppt/slides/slide3.xml'].toString();
  assert.doesNotMatch(slide1,/name="NotebookLM watermark"/);
  assert.match(slide1,/NotebookLM is cited here as a research source/);
  assert.match(slide1,/Approve the four-week pilot/);
  assert.doesNotMatch(slide2,/rIdWatermark/);
  assert.match(slide2,/rIdContent/);
  assert.match(slide2,/Evidence and customer narrative stay intact/);
  assert.match(slide3,/Gemini Notebook and other research tools is legitimate editorial content/);

  const beforeSize=(await fs.stat(fixture.file)).size;
  const afterSize=(await fs.stat(result.file)).size;
  assert.ok(afterSize>=beforeSize*.45&&afterSize<=beforeSize*1.55,`unexpected size drift: ${beforeSize} -> ${afterSize}`);
});

test('a deck without identified branding is returned byte-for-byte and without invented cleanup',async()=>{
  const fixture=await syntheticDeck();
  const parts=await zipParts(fixture.file);
  const archive=await JSZip.loadAsync(await fs.readFile(fixture.file));
  const safeSlide=slideXml([
    shape({id:10,name:'Body copy',text:'Provider-neutral customer evidence.'}),
    picture({id:11,name:'Client evidence',rid:'rIdContent'})
  ]);
  archive.file('ppt/slides/slide1.xml',safeSlide);
  archive.file('ppt/slides/slide2.xml',safeSlide);
  archive.file('ppt/slides/slide3.xml',safeSlide);
  const safeFile=path.join(path.dirname(fixture.file),'safe.pptx');
  await fs.writeFile(safeFile,await archive.generateAsync({type:'nodebuffer'}));

  const result=await sanitizePowerPointBranding(safeFile);
  assert.equal(result.file,safeFile);
  assert.deepEqual(result.report,{changed:false,removedShapes:0,slides:[],protectedParts:result.report.protectedParts,narrativeSafe:true});
  assert.deepEqual(await fs.readFile(result.file),await fs.readFile(safeFile));
  assert.ok(parts['ppt/media/content-photo.png']);
});

test('worker uses the fidelity bundle and conservative cleanup as the default path',async()=>{
  const worker=await fs.readFile(new URL('../worker.js',import.meta.url),'utf8');
  const videoCleanup=worker.slice(worker.indexOf('async function cleanVideoEnding'),worker.indexOf('async function cleanInfographicBranding'));
  const infographicCleanup=worker.slice(worker.indexOf('async function cleanInfographicBranding'),worker.indexOf('const sleep='));
  const publishing=worker.slice(worker.indexOf("const forceDeckLogo="),worker.indexOf('artifactFidelityReports[task.id]'));
  assert.match(worker,/buildNotebookSourceBundle/);
  assert.match(worker,/sourceBundle\.text|bundle\.text/);
  assert.match(worker,/(?:sourceManifest|fidelityManifest|manifest):\s*(?:sourceBundle|bundle)\.manifest/);
  assert.match(worker,/sanitizePowerPointBranding/);
  assert.match(publishing,/NOTEBOOKLM_DECK_LOGO_MODE===['"]overlay['"]/);
  assert.match(publishing,/if\(forceDeckLogo\)\s*\{[\s\S]*brandPowerPoint\(/);
  assert.match(videoCleanup,/verifiedWatermark/);
  assert.match(videoCleanup,/if\(!verification\.verified\)return\s*\{file,report:\{changed:false/);
  assert.match(videoCleanup,/NOTEBOOKLM_VIDEO_ENDING_HASHES/);
  assert.match(videoCleanup,/stop_mode=clone|freeze-last-clean-frame/);
  assert.doesNotMatch(videoCleanup,/overlay=|clientLogoBadge|badge/i);
  assert.match(infographicCleanup,/sanitizeInfographicBranding/);
  assert.match(infographicCleanup,/NOTEBOOKLM_INFOGRAPHIC_WATERMARK_HASHES/);
  assert.doesNotMatch(infographicCleanup,/\.extend\(\{bottom:|clientLogoBadge|logo/i);
});
