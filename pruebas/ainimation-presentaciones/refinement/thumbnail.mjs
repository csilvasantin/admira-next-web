import {THUMBNAIL_ART} from './thumbnail-model.mjs';
const artwork=new URL('./assets/orbita-key-art.png',import.meta.url).href;
const cache=new Map();
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
export async function drawThumbnail(canvas,project,{assets={},width=1280,strict=false}={}) {
  const value=project.document.components.thumbnail,stamp=(canvas._thumbnailStamp||0)+1;canvas._thumbnailStamp=stamp;
  if(!value)throw Error('Vuelve a abrir este proyecto desde su generador para incluir una miniatura.');
  let image,fallback=false;
  try{const src=value.image===THUMBNAIL_ART?artwork:assets[value.image];if(!src)throw Error('Falta la imagen del origen. Vuelve a abrir la presentación.');image=await loadImage(src);}
  catch(error){if(strict)throw error;image=await loadImage(artwork);fallback=true;}
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
  do{ctx.font=`900 ${font}px Arial, sans-serif`;lines=wrapHeadline(ctx,value.title,textWidth);if(lines.length*font*1.01<=390)break;font-=2;}while(font>36);
  ctx.shadowColor='#0009';ctx.shadowBlur=18;ctx.fillStyle='#ffffff';const y=240-Math.max(0,lines.length-3)*10;
  lines.forEach((line,i)=>ctx.fillText(line,62,y+i*font*1.01));ctx.shadowBlur=0;
  ctx.fillStyle=value.accent;ctx.fillRect(64,625,56,5);ctx.fillStyle='#e8e8ee';ctx.font='700 18px Arial, sans-serif';ctx.fillText(project.kind==='site'?'UNA IDEA PARA EXPLORAR':'UNA PROPUESTA PARA CONVERSAR',64,658);
  ctx.strokeStyle=value.accent;ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(1170,638);ctx.lineTo(1210,598);ctx.lineTo(1177,598);ctx.moveTo(1210,598);ctx.lineTo(1210,631);ctx.stroke();
  canvas.setAttribute('role','img');canvas.setAttribute('aria-label','Miniatura: '+value.title);return {fallback};
}
export function renderThumbnailPreview(root,project,{assets={},onStatus=()=>{}}={}) {
  const doc=root.ownerDocument;root.replaceChildren();root.className='thumbnail-preview';
  const canvas=doc.createElement('canvas'),caption=doc.createElement('p'),small=doc.createElement('canvas'),smallLabel=doc.createElement('p');
  canvas.className='thumbnail-large';small.className='thumbnail-small';caption.className='thumbnail-caption';caption.textContent='MINIATURA / 16:9';smallLabel.className='thumbnail-caption';smallLabel.textContent='ASÍ SE LEE A TAMAÑO PEQUEÑO';
  root.append(caption,canvas,smallLabel,small);
  drawThumbnail(canvas,project,{assets}).then(result=>{if(result.stale||!root.contains(canvas))return;small.width=320;small.height=180;small.getContext('2d').drawImage(canvas,0,0,320,180);small.setAttribute('role','img');small.setAttribute('aria-label','Vista pequeña: '+project.document.components.thumbnail.title);if(result.fallback)onStatus('La imagen del origen no está disponible. La vista usa la ilustración de muestra.');}).catch(error=>onStatus(error.message));
}
export async function exportThumbnail(project,{assets={},doc=document}={}) {
  const canvas=doc.createElement('canvas');await drawThumbnail(canvas,project,{assets,width:3840,strict:true});
  let blob;for(const quality of [.92,.85,.75,.6,.45]){blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));if(blob&&blob.size<2000000)break;}
  if(!blob||blob.size>=2000000)throw Error('La imagen no pudo comprimirse a menos de 2 MB.');
  const url=URL.createObjectURL(blob),link=doc.createElement('a');link.href=url;link.download=project.source.id+'.miniatura.jpg';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return blob;
}
