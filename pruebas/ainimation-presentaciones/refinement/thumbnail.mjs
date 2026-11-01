import {THUMBNAIL_ART} from './thumbnail-model.mjs';
const artwork=new URL('./assets/orbita-key-art.png',import.meta.url).href;
const cache=new Map();
const logoCache=new WeakMap();
let brandFont;
async function loadBrandFont(){
  if(!brandFont)brandFont=new FontFace('Fira Sans',`url(${new URL('./assets/fira-sans-black.woff2',import.meta.url).href})`,{weight:'900'}).load().then(font=>{document.fonts.add(font);return font;}).catch(()=>{brandFont=null;throw Error('No se pudo cargar la tipografía de la miniatura.');});
  return brandFont;
}
function loadImage(url) {
  if(!cache.has(url)&&cache.size>=16)cache.delete(cache.keys().next().value);
  if(!cache.has(url))cache.set(url,new Promise((resolve,reject)=>{const image=new Image(),fail=()=>{clearTimeout(timer);cache.delete(url);reject(Error('No se pudo cargar la imagen de la miniatura.'));},timer=setTimeout(fail,15000);image.onload=()=>{clearTimeout(timer);resolve(image);};image.onerror=fail;image.src=url;}));
  return cache.get(url);
}
export function wrapHeadline(ctx,text,width) {
  const lines=[];let line='';
  for(const word of String(text).split(/\s+/)) {
    if(ctx.measureText(word).width>width){if(line){lines.push(line);line='';}let part='';for(const char of word){if(ctx.measureText(part+char).width>width&&part){lines.push(part);part='';}part+=char;}line=part;continue;}
    if(line&&ctx.measureText(line+' '+word).width>width){lines.push(line);line='';}line+=(line?' ':'')+word;
  }
  if(line)lines.push(line);return lines;
}
function logoMark(image,doc,white){
  let pair=logoCache.get(image);if(!pair){pair={};logoCache.set(image,pair);}const key=white?'white':'original';if(pair[key])return pair[key];
  const raw=doc.createElement('canvas');raw.width=image.width;raw.height=image.height;const ctx=raw.getContext('2d');ctx.drawImage(image,0,0);const rgba=ctx.getImageData(0,0,raw.width,raw.height).data;
  let left=raw.width,top=raw.height,right=-1,bottom=-1,transparent=false;for(let y=0;y<raw.height;y++)for(let x=0;x<raw.width;x++){const alpha=rgba[(y*raw.width+x)*4+3];if(alpha<255)transparent=true;if(alpha>10){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}}
  if(right<left)throw Error('El archivo del logotipo está vacío.');
  if(white&&!transparent)throw Error('Usa un PNG transparente para aplicar la versión blanca del logotipo.');
  const mark=doc.createElement('canvas');mark.width=right-left+1;mark.height=bottom-top+1;const target=mark.getContext('2d');target.drawImage(raw,left,top,mark.width,mark.height,0,0,mark.width,mark.height);
  if(white){target.globalCompositeOperation='source-in';target.fillStyle='#ffffff';target.fillRect(0,0,mark.width,mark.height);target.globalCompositeOperation='source-over';}pair[key]=mark;return mark;
}
export async function drawThumbnail(canvas,project,{assets={},width=1280,strict=false}={}) {
  const value=project.document.components.thumbnail,stamp=(canvas._thumbnailStamp||0)+1;canvas._thumbnailStamp=stamp;
  if(!value)throw Error('Vuelve a abrir este proyecto desde su generador para incluir una miniatura.');
  const family=value.font==='fira-sans'?'"Fira Sans"':'Arial';if(value.font==='fira-sans')await loadBrandFont();
  let image,logo,fallback=false;
  try{const src=value.image===THUMBNAIL_ART?artwork:assets[value.image];if(!src)throw Error('Falta la imagen del origen. Vuelve a abrir la presentación.');image=await loadImage(src);}
  catch(error){if(strict)throw error;image=await loadImage(artwork);fallback=true;}
  if(value.logo){try{if(!assets[value.logo])throw Error('Falta el logotipo del origen. Vuelve a abrir la presentación.');logo=await loadImage(assets[value.logo]);}catch(error){if(strict)throw error;fallback=true;}}
  if(canvas._thumbnailStamp!==stamp)return {stale:true};
  canvas.width=width;canvas.height=width*9/16;
  const ctx=canvas.getContext('2d');ctx.scale(width/1280,width/1280);
  ctx.fillStyle='#090b12';ctx.fillRect(0,0,1280,720);
  const scale=Math.max(1280/image.width,720/image.height),iw=image.width*scale,ih=image.height*scale;
  ctx.drawImage(image,(1280-iw)/2,(720-ih)/2,iw,ih);
  const shade=ctx.createLinearGradient(0,0,1150,0);shade.addColorStop(0,'rgba(5,7,14,.96)');shade.addColorStop(.48,'rgba(5,7,14,.72)');shade.addColorStop(1,'rgba(5,7,14,0)');ctx.fillStyle=shade;ctx.fillRect(0,0,1280,720);
  if(value.layout==='editorial'){ctx.fillStyle='#090b12e8';ctx.fillRect(0,0,685,720);ctx.fillStyle=value.accent;ctx.fillRect(685,0,8,720);}
  ctx.fillStyle=value.accent;ctx.fillRect(64,62,40,6);ctx.font='700 24px Arial, sans-serif';ctx.textBaseline='top';ctx.fillText(value.kicker.toUpperCase(),64,92,700);
  const textWidth=value.layout==='editorial'?570:690;let font=100,lines=[];
  do{ctx.font=`900 ${font}px ${family}, sans-serif`;lines=wrapHeadline(ctx,value.title,textWidth);if(lines.length*font*1.01<=390)break;font-=2;}while(font>36);
  ctx.shadowColor='#0009';ctx.shadowBlur=18;ctx.fillStyle='#ffffff';const y=240-Math.max(0,lines.length-3)*10;
  lines.forEach((line,i)=>ctx.fillText(line,62,y+i*font*1.01));ctx.shadowBlur=0;
  ctx.fillStyle=value.accent;ctx.fillRect(64,625,56,5);ctx.fillStyle='#e8e8ee';ctx.font='700 18px Arial, sans-serif';ctx.fillText(project.kind==='site'?'UNA IDEA PARA EXPLORAR':'UNA PROPUESTA PARA CONVERSAR',64,658);
  ctx.strokeStyle=value.accent;ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(1170,638);ctx.lineTo(1210,598);ctx.lineTo(1177,598);ctx.moveTo(1210,598);ctx.lineTo(1210,631);ctx.stroke();
  if(logo){const mark=logoMark(logo,canvas.ownerDocument,value.logoStyle==='white'),scale=Math.min(220/mark.width,100/mark.height),w=mark.width*scale,h=mark.height*scale;ctx.drawImage(mark,1216-w,52,w,h);}
  canvas.setAttribute('role','img');canvas.setAttribute('aria-label','Miniatura: '+value.title);return {fallback};
}
export function renderThumbnailPreview(root,project,{assets={},onStatus=()=>{}}={}) {
  const doc=root.ownerDocument;root.replaceChildren();root.className='thumbnail-preview';
  const canvas=doc.createElement('canvas'),caption=doc.createElement('p'),small=doc.createElement('canvas'),smallLabel=doc.createElement('p');
  canvas.className='thumbnail-large';small.className='thumbnail-small';caption.className='thumbnail-caption';caption.textContent='MINIATURA / 16:9';smallLabel.className='thumbnail-caption';smallLabel.textContent='ASÍ SE LEE A TAMAÑO PEQUEÑO';
  root.append(caption,canvas,smallLabel,small);
  drawThumbnail(canvas,project,{assets}).then(result=>{if(result.stale||!root.contains(canvas))return;small.width=320;small.height=180;small.getContext('2d').drawImage(canvas,0,0,320,180);small.setAttribute('role','img');small.setAttribute('aria-label','Vista pequeña: '+project.document.components.thumbnail.title);if(result.fallback)onStatus('Faltan recursos del origen. La vista es provisional; vuelve a abrir la presentación.');}).catch(error=>onStatus(error.message));
}
export async function exportThumbnail(project,{assets={},doc=document}={}) {
  const canvas=doc.createElement('canvas');await drawThumbnail(canvas,project,{assets,width:3840,strict:true});
  let blob;for(const quality of [.92,.85,.75,.6,.45]){blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));if(blob&&blob.size<2000000)break;}
  if(!blob||blob.size>=2000000)throw Error('La imagen no pudo comprimirse a menos de 2 MB.');
  const url=URL.createObjectURL(blob),link=doc.createElement('a');link.href=url;link.download=project.source.id+'.miniatura.jpg';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return blob;
}
