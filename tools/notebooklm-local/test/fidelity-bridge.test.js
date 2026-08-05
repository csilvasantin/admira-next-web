import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import JSZip from 'jszip';
import {PDFDocument, rgb} from 'pdf-lib';
import sharp from 'sharp';
import {buildNotebookSourceBundle,sanitizeInfographicBranding,sanitizePdfBranding,sanitizePowerPointBranding,verifiedWatermark} from '../fidelity-bridge.js';
import {buildGeneration} from '../../../functions/presentaciones/_generation.js';

test('source bridge imports canonical sources and narrative with an exact fidelity contract',()=>{
  const result=buildNotebookSourceBundle({
    job:{client:'demo',languages:['es','en'],sourceText:'Tensión → visión → piloto.'},
    presentation:{
      displayName:'Demo',
      website:'https://demo.example/',
      inspirationUrl:'https://reference.example/',
      theme:{primary:'#010203',accent:'#aabbcc',fontStyle:'neo-grotesk',layout:'editorial'}
    },
    visualBrief:'Grid modular 12 columnas.'
  });
  assert.match(result.text,/Tensión → visión → piloto\./);
  assert.match(result.text,/https:\/\/demo\.example\//);
  assert.match(result.text,/slide masters, slide layouts, embedded fonts/);
  assert.equal(result.manifest.fidelity.theme.fontStyle,'neo-grotesk');
  assert.equal(result.manifest.fidelity.allowReflow,false);
  assert.equal(result.manifest.narrativeSha256.length,64);
  assert.equal(result.manifest.sources.length,2);
});

test('PowerPoint cleanup removes only identified provider shapes and preserves structural parts byte-for-byte',async(t)=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'admira-fidelity-'));
  t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  const input=path.join(dir,'source.pptx'),archive=new JSZip();
  const theme='<a:theme name="Client theme"><a:themeElements/></a:theme>';
  const master='<p:sldMaster><p:cSld name="Master"/></p:sldMaster>';
  const layout='<p:sldLayout><p:cSld name="Editorial"/></p:sldLayout>';
  const fonts='<p:fontTable><a:font typeface="Client Sans"/></p:fontTable>';
  const presentation='<p:presentation><p:sldSz cx="12192000" cy="6858000"/></p:presentation>';
  const contentShape='<p:sp><p:nvSpPr><p:cNvPr id="2" name="Narrative"/></p:nvSpPr><p:txBody><a:p><a:r><a:t>NotebookLM puede ser una fuente en el relato, no una marca.</a:t></a:r></a:p></p:txBody><p:spPr><a:xfrm><a:off x="10" y="20"/><a:ext cx="30" cy="40"/></a:xfrm></p:spPr></p:sp>';
  const watermarkShape='<p:sp><p:nvSpPr><p:cNvPr id="3" name="NotebookLM watermark"/></p:nvSpPr><p:txBody><a:p><a:r><a:t>Made with NotebookLM</a:t></a:r></a:p></p:txBody><p:spPr><a:xfrm><a:off x="50" y="60"/><a:ext cx="70" cy="80"/></a:xfrm></p:spPr></p:sp>';
  archive.file('ppt/theme/theme1.xml',theme);
  archive.file('ppt/slideMasters/slideMaster1.xml',master);
  archive.file('ppt/slideLayouts/slideLayout1.xml',layout);
  archive.file('ppt/fontTable.xml',fonts);
  archive.file('ppt/presentation.xml',presentation);
  archive.file('ppt/slides/slide1.xml',`<p:sld><p:cSld><p:spTree>${contentShape}${watermarkShape}</p:spTree></p:cSld></p:sld>`);
  await fs.writeFile(input,await archive.generateAsync({type:'nodebuffer'}));

  const cleaned=await sanitizePowerPointBranding(input);
  assert.equal(cleaned.report.changed,true);
  assert.equal(cleaned.report.removedShapes,1);
  const output=await JSZip.loadAsync(await fs.readFile(cleaned.file));
  const slide=await output.file('ppt/slides/slide1.xml').async('string');
  assert.match(slide,/NotebookLM puede ser una fuente/);
  assert.doesNotMatch(slide,/NotebookLM watermark|Made with NotebookLM/);
  assert.equal(await output.file('ppt/theme/theme1.xml').async('string'),theme);
  assert.equal(await output.file('ppt/slideMasters/slideMaster1.xml').async('string'),master);
  assert.equal(await output.file('ppt/slideLayouts/slideLayout1.xml').async('string'),layout);
  assert.equal(await output.file('ppt/fontTable.xml').async('string'),fonts);
  assert.equal(await output.file('ppt/presentation.xml').async('string'),presentation);
});

test('PowerPoint cleanup is a no-op when no verified provider mark exists',async(t)=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'admira-fidelity-noop-'));
  t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  const input=path.join(dir,'clean.pptx'),archive=new JSZip();
  archive.file('ppt/presentation.xml','<p:presentation/>');
  archive.file('ppt/slides/slide1.xml','<p:sld><p:cSld><p:spTree><p:sp><p:nvSpPr><p:cNvPr id="1" name="Client logo"/></p:nvSpPr></p:sp></p:spTree></p:cSld></p:sld>');
  await fs.writeFile(input,await archive.generateAsync({type:'nodebuffer'}));
  const result=await sanitizePowerPointBranding(input);
  assert.equal(result.file,input);
  assert.deepEqual(result.report.slides,[]);
  assert.equal(result.report.changed,false);
});

test('trusted NotebookLM raster decks repair only the signed corner of full-slide PNGs',async(t)=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'admira-raster-deck-'));
  t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  const input=path.join(dir,'raster.pptx'),archive=new JSZip(),width=1000,height=562;
  const watermark=Buffer.from('<svg width="90" height="26"><rect width="90" height="26" fill="#fff"/><text x="5" y="18" font-size="13" fill="#000">NotebookLM</text></svg>');
  const image=await sharp({create:{width,height,channels:4,background:'#dfeaf5'}})
    .composite([{input:watermark,left:width-90,top:height-26}]).png().toBuffer();
  const presentation='<p:presentation><p:sldSz cx="10000000" cy="5625000"/></p:presentation>';
  const slide='<p:sld><p:cSld><p:spTree><p:pic><p:nvPicPr><p:cNvPr id="2" name="Picture 2"/></p:nvPicPr><p:blipFill><a:blip r:embed="rId2"/></p:blipFill><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="10000000" cy="5625000"/></a:xfrm></p:spPr></p:pic></p:spTree></p:cSld></p:sld>';
  archive.file('ppt/presentation.xml',presentation);
  archive.file('ppt/theme/theme1.xml','<a:theme name="Client"/>');
  archive.file('ppt/slideMasters/slideMaster1.xml','<p:sldMaster/>');
  archive.file('ppt/slideLayouts/slideLayout1.xml','<p:sldLayout/>');
  archive.file('ppt/slides/slide1.xml',slide);
  archive.file('ppt/slides/_rels/slide1.xml.rels','<Relationships><Relationship Id="rId2" Target="../media/image1.png"/></Relationships>');
  archive.file('ppt/media/image1.png',image);
  await fs.writeFile(input,await archive.generateAsync({type:'nodebuffer'}));

  const untouched=await sanitizePowerPointBranding(input,{rasterizedProviderCorner:true});
  assert.equal(untouched.file,input);
  assert.equal(untouched.report.changed,false);

  const result=await sanitizePowerPointBranding(input,{trustedProvider:'notebooklm',rasterizedProviderCorner:true});
  assert.equal(result.report.changed,true);
  assert.equal(result.report.rasterizedSlides.length,1);
  assert.equal(result.report.removedShapes,0);
  const cleaned=await JSZip.loadAsync(await fs.readFile(result.file));
  const cleanedImage=await cleaned.file('ppt/media/image1.png').async('nodebuffer');
  const coverWidth=Math.ceil(width*.09),coverHeight=Math.ceil(height*.04),top=height-coverHeight;
  const direction=result.report.rasterizedSlides[0].sourceDirection;
  const source=direction==='left'?{left:width-coverWidth*2,top}:direction==='above'?{left:width-coverWidth,top:height-coverHeight*2}:{left:width-coverWidth*2,top:height-coverHeight*2};
  const expected=await sharp(image).extract({...source,width:coverWidth,height:coverHeight}).raw().toBuffer();
  const actual=await sharp(cleanedImage).extract({left:width-coverWidth,top,width:coverWidth,height:coverHeight}).raw().toBuffer();
  assert.deepEqual(actual,expected);
  assert.equal(await cleaned.file('ppt/slides/slide1.xml').async('string'),slide);
  assert.equal(await cleaned.file('ppt/theme/theme1.xml').async('string'),'<a:theme name="Client"/>');
});

test('trusted NotebookLM PDFs clone the adjacent footer strip without changing page geometry',async(t)=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'admira-raster-pdf-'));
  t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  const input=path.join(dir,'raster.pdf'),document=await PDFDocument.create(),page=document.addPage([1000,562]);
  page.drawRectangle({x:0,y:0,width:1000,height:562,color:rgb(.88,.92,.96)});
  page.drawText('NotebookLM',{x:910,y:8,size:13,color:rgb(0,0,0)});
  await fs.writeFile(input,await document.save());

  const untouched=await sanitizePdfBranding(input,{rasterizedProviderCorner:true});
  assert.equal(untouched.file,input);
  assert.equal(untouched.report.changed,false);

  const result=await sanitizePdfBranding(input,{trustedProvider:'notebooklm',rasterizedProviderCorner:true});
  assert.equal(result.report.changed,true);
  assert.equal(result.report.pageCount,1);
  const cleaned=await PDFDocument.load(await fs.readFile(result.file));
  assert.equal(cleaned.getPageCount(),1);
  assert.deepEqual(cleaned.getPage(0).getSize(),{width:1000,height:562});
});

test('infographic cleanup is byte-identical unless its exact corner fingerprint is allowlisted',async(t)=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'admira-infographic-'));
  t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  const input=path.join(dir,'infographic.png'),width=400,height=240;
  const corner=Buffer.from(`<svg width="36" height="9"><rect width="36" height="9" fill="#fff"/><text x="1" y="7" font-size="6">client fact</text></svg>`);
  await sharp({create:{width,height,channels:4,background:'#e8dfd0'}})
    .composite([{input:corner,left:width-36,top:height-9}]).png().toFile(input);
  const original=await fs.readFile(input);
  const untouched=await sanitizeInfographicBranding(input);
  assert.equal(untouched.file,input);
  assert.equal(untouched.report.changed,false);
  assert.deepEqual(await fs.readFile(input),original);

  const crop=await sharp(input).extract({left:width-Math.ceil(width*.09),top:height-Math.ceil(height*.035),width:Math.ceil(width*.09),height:Math.ceil(height*.035)}).png().toBuffer();
  const fingerprint=verifiedWatermark(crop).fingerprint;
  const cleaned=await sanitizeInfographicBranding(input,{watermarkHashes:[fingerprint]});
  assert.equal(cleaned.report.changed,true);
  assert.notEqual(cleaned.file,input);
  const metadata=await sharp(cleaned.file).metadata();
  assert.equal(metadata.width,width);
  assert.equal(metadata.height,height);
});

test('video ending cleanup is guarded by an exact fingerprint and is a no-op otherwise',async()=>{
  const worker=await fs.readFile(new URL('../worker.js',import.meta.url),'utf8');
  const cleanup=worker.slice(worker.indexOf('async function cleanVideoEnding'),worker.indexOf('async function cleanInfographicBranding'));
  assert.match(cleanup,/verifiedWatermark/);
  assert.match(cleanup,/NOTEBOOKLM_VIDEO_ENDING_HASHES/);
  assert.match(cleanup,/if\(!verification\.verified\)return\s*\{file,report:\{changed:false/);
  assert.ok(cleanup.indexOf('if(!verification.verified)')<cleanup.indexOf('stop_mode=clone'),'video must verify before changing frames');
  assert.doesNotMatch(cleanup,/overlay=|clientLogoBadge|badge/i);
});

test('new deck tasks declare the fidelity bridge instead of a visual overlay',()=>{
  const generation=buildGeneration({client:'demo',displayName:'Demo',outputs:['pdf','powerpoint'],languages:['es']});
  for(const task of Object.values(generation.tasks)){
    assert.equal(task.postProcess.providerCleanup,'fidelity-bridge');
    assert.equal(task.postProcess.identifiedElementsOnly,true);
    assert.equal(task.postProcess.preserveTheme,true);
    assert.equal(task.postProcess.preserveMasters,true);
    assert.equal(task.postProcess.preserveFonts,true);
    assert.equal(task.postProcess.preserveComposition,true);
    assert.equal('clientLogoEverySlide' in task.postProcess,false);
  }
});
