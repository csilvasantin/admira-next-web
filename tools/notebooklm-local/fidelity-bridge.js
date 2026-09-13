import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import JSZip from 'jszip';
import {PDFDocument} from 'pdf-lib';
import sharp from 'sharp';

const PROVIDER_MARK = /\b(?:notebook\s*lm|notebooklm|gemini\s+notebook|google\s+notebook)\b/i;
const PROVIDER_LABEL = /^(?:(?:made|created|powered)\s+(?:with|by)\s+)?(?:google\s+)?(?:notebook\s*lm|notebooklm|gemini\s+notebook)$/i;
const SLIDE_XML = /^ppt\/slides\/slide\d+\.xml$/;
const PROTECTED_PART = /^(?:ppt\/theme\/|ppt\/slideMasters\/|ppt\/slideLayouts\/|ppt\/fontTable\.xml$|ppt\/presentation\.xml$)/;

function clean(value,max=12000){
  return String(value==null?'':value).replace(/\r\n?/g,'\n').trim().slice(0,max);
}

function sha256(value){
  return createHash('sha256').update(value).digest('hex');
}

export function normalizeWatermarkHashes(values=[]){
  const list=Array.isArray(values)?values:String(values||'').split(',');
  return [...new Set(list.map(value=>clean(value,128).toLowerCase()).filter(value=>/^[a-f0-9]{64}$/.test(value)))];
}

export function verifiedWatermark(bytes,hashes=[]){
  const fingerprint=sha256(bytes);
  return {fingerprint,verified:normalizeWatermarkHashes(hashes).includes(fingerprint)};
}

function safeUrl(value){
  const url=clean(value,1000);
  return /^https:\/\//i.test(url)?url:'';
}

function themeContract(presentation={}){
  const theme=presentation.theme||{};
  return {
    mode:clean(theme.mode,30)||'light',
    profile:clean(theme.profile,50)||'structured',
    layout:clean(theme.layout,50)||'editorial',
    fontStyle:clean(theme.fontStyle,80)||'grotesk',
    primary:clean(theme.primary,20)||'#12233e',
    accent:clean(theme.accent,20)||'#ffb000',
    background:clean(theme.background,20)||'#ffffff',
    surface:clean(theme.surface,20)||'#ffffff',
    text:clean(theme.text,20)||'#142238',
    density:clean(theme.density,30)||'balanced',
    radiusStyle:clean(theme.radiusStyle,30)||'soft'
  };
}

export function buildNotebookSourceBundle({job={},presentation={},visualBrief=''}={}){
  const narrative=clean(job.sourceText,180000);
  if(!narrative)throw new Error('La narrativa canónica está vacía.');
  const sources=[
    {role:'official-client-source',url:safeUrl(presentation.website)},
    {role:'visual-reference',url:safeUrl(presentation.inspirationUrl)}
  ].filter((item,index,all)=>item.url&&all.findIndex(candidate=>candidate.url===item.url&&candidate.role===item.role)===index);
  const theme=themeContract(presentation);
  const manifest={
    schemaVersion:1,
    client:clean(job.client||presentation.slug,80),
    displayName:clean(presentation.displayName||job.displayName,120),
    languageScope:Array.isArray(job.languages)?job.languages.filter(value=>['es','ca','en'].includes(value)):[],
    narrativeSha256:sha256(narrative),
    narrativeCharacters:narrative.length,
    sources,
    fidelity:{
      theme,
      preserve:['theme','slide-masters','slide-layouts','embedded-fonts','slide-size','object-transforms','reading-order'],
      providerCleanup:'identified-elements-only',
      allowReflow:false,
      allowThemeSubstitution:false,
      allowFontSubstitution:false
    }
  };
  const sourceLines=sources.length?sources.map(item=>`- ${item.role}: ${item.url}`).join('\n'):'- No external URL supplied; use only the canonical narrative below.';
  const visual=clean(visualBrief,5200);
  const text=`ADMIRANEXT NOTEBOOKLM SOURCE BRIDGE · v1

SOURCE MANIFEST
${sourceLines}
Narrative SHA-256: ${manifest.narrativeSha256}

VISUAL FIDELITY CONTRACT
- Preserve the generated deck theme, slide masters, slide layouts, embedded fonts, slide size, object transforms, composition and reading order.
- Do not flatten, restyle, redraw or substitute typography during export.
- Remove provider branding only when it is explicitly identified as NotebookLM or Gemini; never cover content with a new logo or resize the canvas.
- Theme: ${JSON.stringify(theme)}
${visual?`- Visual direction: ${visual}`:''}

CANONICAL NARRATIVE
${narrative}`;
  return {text,manifest};
}

async function contentHashes(archive,matcher){
  const result={};
  for(const name of Object.keys(archive.files).filter(matcher).sort()){
    const bytes=await archive.file(name)?.async('nodebuffer');
    if(bytes)result[name]=sha256(bytes);
  }
  return result;
}

function relationshipTargets(xml){
  const result=new Map();
  for(const match of String(xml).matchAll(/<Relationship\b[^>]*\bId="([^"]+)"[^>]*\bTarget="([^"]+)"[^>]*\/?>/g)){
    result.set(match[1],match[2]);
  }
  return result;
}

function trustedNotebookProvider(value){
  return clean(value,40).toLowerCase()==='notebooklm';
}

function slideSize(xml){
  const match=String(xml).match(/<p:sldSz\b[^>]*\bcx="(\d+)"[^>]*\bcy="(\d+)"/);
  return {width:Number(match?.[1])||0,height:Number(match?.[2])||0};
}

function fullSlidePictures(slideXml,rels,size){
  if(!size.width||!size.height)return [];
  const result=[];
  for(const match of String(slideXml).matchAll(/<p:pic\b[\s\S]*?<\/p:pic>/g)){
    const block=match[0],rid=block.match(/\br:embed="([^"]+)"/)?.[1];
    const transform=block.match(/<a:xfrm\b[^>]*>[\s\S]*?<a:off\b[^>]*\bx="(-?\d+)"[^>]*\by="(-?\d+)"[^>]*\/>[\s\S]*?<a:ext\b[^>]*\bcx="(\d+)"[^>]*\bcy="(\d+)"[^>]*\/>/);
    if(!rid||!transform)continue;
    const left=Number(transform[1]),top=Number(transform[2]),width=Number(transform[3]),height=Number(transform[4]);
    const marginX=size.width*.015,marginY=size.height*.015;
    if(Math.abs(left)>marginX||Math.abs(top)>marginY||Math.abs(width-size.width)>marginX||Math.abs(height-size.height)>marginY)continue;
    const target=rels.get(rid);if(!target)continue;
    result.push(path.posix.normalize(path.posix.join('ppt/slides',target)));
  }
  return result;
}

async function visualComplexity(bytes){
  const {data,info}=await sharp(bytes).greyscale().raw().toBuffer({resolveWithObject:true});
  let edges=0,dark=0;
  for(let y=0;y<info.height;y+=1)for(let x=0;x<info.width;x+=1){
    const index=y*info.width+x,value=data[index];
    if(value<105)dark+=1;
    if(x)edges+=Math.abs(value-data[index-1]);
    if(y)edges+=Math.abs(value-data[index-info.width]);
  }
  return (edges/data.length)+(dark/data.length)*90;
}

async function cleanRasterCorner(bytes,width,height){
  const coverWidth=Math.ceil(width*.09),coverHeight=Math.ceil(height*.04),top=height-coverHeight;
  if(width<coverWidth*2||height<coverHeight*2)return null;
  const candidates=[
    {sourceDirection:'left',left:width-coverWidth*2,top},
    {sourceDirection:'above',left:width-coverWidth,top:height-coverHeight*2},
    {sourceDirection:'diagonal',left:width-coverWidth*2,top:height-coverHeight*2}
  ];
  for(const candidate of candidates){
    candidate.bytes=await sharp(bytes).extract({left:candidate.left,top:candidate.top,width:coverWidth,height:coverHeight}).png().toBuffer();
    candidate.score=await visualComplexity(candidate.bytes);
  }
  candidates.sort((a,b)=>a.score-b.score);
  const selected=candidates[0],cleaned=await sharp(bytes).composite([{input:selected.bytes,left:width-coverWidth,top}]).png().toBuffer();
  return {cleaned,coverWidth,coverHeight,sourceDirection:selected.sourceDirection,sourceScore:selected.score};
}

async function sanitizeRasterizedSlides(archive,slides,{trustedProvider,rasterizedProviderCorner}={}){
  if(!rasterizedProviderCorner||!trustedNotebookProvider(trustedProvider))return [];
  const presentation=await archive.file('ppt/presentation.xml')?.async('string')||'',size=slideSize(presentation),seen=new Set(),changes=[];
  for(const slideName of slides){
    const xml=await archive.file(slideName)?.async('string')||'';
    const relName=slideName.replace('ppt/slides/','ppt/slides/_rels/')+'.rels';
    const rels=relationshipTargets(await archive.file(relName)?.async('string')||'');
    const pictures=fullSlidePictures(xml,rels,size);
    // El contrato de NotebookLM observado es exactamente una imagen raster a
    // página completa. Cualquier otra composición falla cerrado.
    if(pictures.length!==1)continue;
    for(const assetName of pictures){
      if(seen.has(assetName))continue;seen.add(assetName);
      const bytes=await archive.file(assetName)?.async('nodebuffer');if(!bytes)continue;
      const metadata=await sharp(bytes).metadata(),width=Number(metadata.width),height=Number(metadata.height);
      // NotebookLM exports these decks as one lossless full-slide PNG per page.
      // Limiting the repair to that exact structure avoids recompressing photos or
      // touching a normal editable deck that happens to contain a corner image.
      if(metadata.format!=='png'||width<640||height<360)continue;
      const repair=await cleanRasterCorner(bytes,width,height);if(!repair)continue;
      archive.file(assetName,repair.cleaned);
      changes.push({slide:slideName,asset:assetName,mode:'trusted-provider-corner-clone',beforeSha256:sha256(bytes),afterSha256:sha256(repair.cleaned),width,height,coverWidth:repair.coverWidth,coverHeight:repair.coverHeight,sourceDirection:repair.sourceDirection,sourceScore:repair.sourceScore});
    }
  }
  return changes;
}

async function pictureHashes(archive,slideName,slideXml){
  const relName=slideName.replace('ppt/slides/','ppt/slides/_rels/')+'.rels';
  const relXml=await archive.file(relName)?.async('string')||'';
  const targets=relationshipTargets(relXml),result=new Map();
  for(const rid of new Set([...String(slideXml).matchAll(/\br:embed="([^"]+)"/g)].map(match=>match[1]))){
    const target=targets.get(rid);
    if(!target)continue;
    const assetName=path.posix.normalize(path.posix.join(path.posix.dirname(slideName),target));
    const bytes=await archive.file(assetName)?.async('nodebuffer');
    if(bytes)result.set(rid,sha256(bytes));
  }
  return result;
}

function sanitizeShapeBlocks(xml,pictureHashByRid,watermarkHashes){
  let removed=0;
  const cleaned=String(xml).replace(/<p:(sp|pic|graphicFrame)\b[\s\S]*?<\/p:\1>/g,(block)=>{
    const metadata=block.match(/<p:cNvPr\b[^>]*>/)?.[0]||'';
    const visibleText=[...block.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map(match=>match[1].replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim()).filter(Boolean).join(' ');
    const explicit=PROVIDER_MARK.test(metadata)||PROVIDER_LABEL.test(visibleText);
    const rid=block.match(/\br:embed="([^"]+)"/)?.[1];
    const matchedImage=rid&&watermarkHashes.has(pictureHashByRid.get(rid));
    if(!explicit&&!matchedImage)return block;
    removed+=1;
    return '';
  });
  return {xml:cleaned,removed};
}

export async function sanitizePowerPointBranding(file,{watermarkHashes=[],trustedProvider='',rasterizedProviderCorner=false}={}){
  const archive=await JSZip.loadAsync(await fs.readFile(file));
  const protectedBefore=await contentHashes(archive,name=>PROTECTED_PART.test(name));
  const nonSlideBefore=await contentHashes(archive,name=>!SLIDE_XML.test(name));
  const allowedHashes=new Set(normalizeWatermarkHashes(watermarkHashes));
  const slides=Object.keys(archive.files).filter(name=>SLIDE_XML.test(name)).sort();
  const changes=[];
  for(const slideName of slides){
    const before=await archive.file(slideName)?.async('string')||'';
    const pictureHashByRid=await pictureHashes(archive,slideName,before);
    const sanitized=sanitizeShapeBlocks(before,pictureHashByRid,allowedHashes);
    if(!sanitized.removed)continue;
    archive.file(slideName,sanitized.xml);
    changes.push({slide:slideName,removedShapes:sanitized.removed,beforeSha256:sha256(before),afterSha256:sha256(sanitized.xml)});
  }
  const rasterChanges=await sanitizeRasterizedSlides(archive,slides,{trustedProvider,rasterizedProviderCorner});
  if(!changes.length&&!rasterChanges.length){
    return {file,report:{changed:false,removedShapes:0,slides:[],protectedParts:protectedBefore,narrativeSafe:true}};
  }
  const protectedAfter=await contentHashes(archive,name=>PROTECTED_PART.test(name));
  const nonSlideAfter=await contentHashes(archive,name=>!SLIDE_XML.test(name));
  if(JSON.stringify(protectedBefore)!==JSON.stringify(protectedAfter))throw new Error('La limpieza intentó alterar tema, masters, layouts o tipografías.');
  const allowedMedia=new Set(rasterChanges.map(item=>item.asset));
  const stableBefore=Object.fromEntries(Object.entries(nonSlideBefore).filter(([name])=>!allowedMedia.has(name)));
  const stableAfter=Object.fromEntries(Object.entries(nonSlideAfter).filter(([name])=>!allowedMedia.has(name)));
  if(JSON.stringify(stableBefore)!==JSON.stringify(stableAfter))throw new Error('La limpieza intentó alterar partes ajenas a las marcas identificadas.');
  const output=path.join(path.dirname(file),`${path.basename(file,'.pptx')}.fidelity.pptx`);
  await fs.writeFile(output,await archive.generateAsync({type:'nodebuffer',compression:'DEFLATE'}));
  return {
    file:output,
    report:{
      changed:true,
      removedShapes:changes.reduce((sum,item)=>sum+item.removedShapes,0),
      slides:changes,
      rasterizedSlides:rasterChanges,
      protectedParts:protectedAfter,
      narrativeSafe:true
    }
  };
}

async function rasterDeckPages(file){
  if(!file)return [];
  const archive=await JSZip.loadAsync(await fs.readFile(file)),presentation=await archive.file('ppt/presentation.xml')?.async('string')||'',size=slideSize(presentation);
  const slides=Object.keys(archive.files).filter(name=>SLIDE_XML.test(name)).sort((a,b)=>Number(a.match(/\d+/)?.[0])-Number(b.match(/\d+/)?.[0])),pages=[];
  for(const slideName of slides){
    const xml=await archive.file(slideName)?.async('string')||'',relName=slideName.replace('ppt/slides/','ppt/slides/_rels/')+'.rels';
    const rels=relationshipTargets(await archive.file(relName)?.async('string')||''),assetName=fullSlidePictures(xml,rels,size)[0];
    const bytes=assetName?await archive.file(assetName)?.async('nodebuffer'):null;
    if(!bytes||(await sharp(bytes).metadata()).format!=='png')return [];
    pages.push(bytes);
  }
  return pages;
}

export async function sanitizePdfBranding(file,{trustedProvider='',rasterizedProviderCorner=false,rasterDeckFile=''}={}){
  if(!rasterizedProviderCorner||!trustedNotebookProvider(trustedProvider)){
    return {file,report:{changed:false,pages:[],mode:'original',narrativeSafe:true}};
  }
  const source=await PDFDocument.load(await fs.readFile(file)),output=await PDFDocument.create(),changes=[],deckPages=await rasterDeckPages(rasterDeckFile).catch(()=>[]);
  for(const [index,sourcePage] of source.getPages().entries()){
    const {width,height}=sourcePage.getSize(),page=output.addPage([width,height]);
    if(deckPages.length===source.getPageCount()){
      const image=await output.embedPng(deckPages[index]);page.drawImage(image,{x:0,y:0,width,height});
      changes.push({page:index+1,mode:'trusted-provider-clean-pptx-source'});
    }else{
      const full=await output.embedPage(sourcePage);page.drawPage(full,{x:0,y:0,width,height});
      const coverWidth=width*.09,coverHeight=height*.04;
      const sample=await output.embedPage(sourcePage,{left:width-coverWidth*2,bottom:0,right:width-coverWidth,top:coverHeight});
      page.drawPage(sample,{x:width-coverWidth,y:0,width:coverWidth,height:coverHeight});
      changes.push({page:index+1,mode:'trusted-provider-corner-clone',coverWidth,coverHeight});
    }
  }
  const target=path.join(path.dirname(file),`${path.basename(file,'.pdf')}.fidelity.pdf`);
  await fs.writeFile(target,await output.save({useObjectStreams:false}));
  const mode=deckPages.length===source.getPageCount()?'trusted-provider-clean-pptx-source':'trusted-provider-corner-clone';
  return {file:target,report:{changed:true,pages:changes,mode,pageCount:changes.length,narrativeSafe:true}};
}

export async function sanitizeInfographicBranding(file,{watermarkHashes=[]}={}){
  const metadata=await sharp(file).metadata(),width=Number(metadata.width),height=Number(metadata.height);
  if(!width||!height)throw new Error('No se pudo leer la infografía descargada.');
  const coverWidth=Math.ceil(width*.09),coverHeight=Math.ceil(height*.035),top=height-coverHeight;
  const corner=await sharp(file).extract({left:width-coverWidth,top,width:coverWidth,height:coverHeight}).png().toBuffer();
  const verification=verifiedWatermark(corner,watermarkHashes);
  if(!verification.verified){
    return {file,report:{changed:false,mode:'verified-corner-clone',fingerprint:verification.fingerprint,reason:'watermark-not-allowlisted',canvasPreserved:true,overlaysAdded:false}};
  }
  const sampleLeft=Math.max(0,width-(coverWidth*2)-24);
  const background=await sharp(file).extract({left:sampleLeft,top,width:coverWidth,height:coverHeight}).png().toBuffer();
  const output=path.join(path.dirname(file),`${path.basename(file,path.extname(file))}.fidelity.png`);
  await sharp(file).composite([{input:background,left:width-coverWidth,top}]).png().toFile(output);
  return {file:output,report:{changed:true,mode:'verified-corner-clone',fingerprint:verification.fingerprint,canvasPreserved:true,overlaysAdded:false}};
}
