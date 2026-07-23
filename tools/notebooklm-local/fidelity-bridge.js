import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import JSZip from 'jszip';
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

export async function sanitizePowerPointBranding(file,{watermarkHashes=[]}={}){
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
  if(!changes.length){
    return {file,report:{changed:false,removedShapes:0,slides:[],protectedParts:protectedBefore,narrativeSafe:true}};
  }
  const protectedAfter=await contentHashes(archive,name=>PROTECTED_PART.test(name));
  const nonSlideAfter=await contentHashes(archive,name=>!SLIDE_XML.test(name));
  if(JSON.stringify(protectedBefore)!==JSON.stringify(protectedAfter))throw new Error('La limpieza intentó alterar tema, masters, layouts o tipografías.');
  if(JSON.stringify(nonSlideBefore)!==JSON.stringify(nonSlideAfter))throw new Error('La limpieza intentó alterar partes ajenas a las marcas identificadas.');
  const output=path.join(path.dirname(file),`${path.basename(file,'.pptx')}.fidelity.pptx`);
  await fs.writeFile(output,await archive.generateAsync({type:'nodebuffer',compression:'DEFLATE'}));
  return {
    file:output,
    report:{
      changed:true,
      removedShapes:changes.reduce((sum,item)=>sum+item.removedShapes,0),
      slides:changes,
      protectedParts:protectedAfter,
      narrativeSafe:true
    }
  };
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
