import fs from 'node:fs/promises';
import path from 'node:path';
import JSZip from 'jszip';
import {PDFDocument} from 'pdf-lib';
import sharp from 'sharp';

async function badge(logo,maxWidth=520,maxHeight=150){
  const resized=await sharp(logo).resize({width:maxWidth,height:maxHeight,fit:'inside',withoutEnlargement:true}).png().toBuffer();
  const meta=await sharp(resized).metadata(),pad=Math.max(14,Math.round(Math.min(maxWidth,maxHeight)*.12));
  return sharp({create:{width:Number(meta.width)+pad*2,height:Number(meta.height)+pad*2,channels:4,background:{r:255,g:255,b:255,alpha:.94}}}).composite([{input:resized,left:pad,top:pad}]).png().toBuffer();
}

export async function brandPdf(file,clientLogo){
  const document=await PDFDocument.load(await fs.readFile(file)),logo=await badge(clientLogo),image=await document.embedPng(logo);
  for(const page of document.getPages()){
    const {width,height}=page.getSize(),targetWidth=Math.min(142,width*.16),targetHeight=targetWidth*(image.height/image.width),margin=Math.max(16,width*.018);
    page.drawImage(image,{x:width-targetWidth-margin,y:height-targetHeight-margin,width:targetWidth,height:targetHeight});
  }
  const output=path.join(path.dirname(file),`${path.basename(file,'.pdf')}.admiranext.pdf`);await fs.writeFile(output,await document.save());return output;
}

function relationshipId(xml){
  const ids=[...String(xml).matchAll(/Id="rId(\d+)"/g)].map(match=>Number(match[1])).filter(Number.isFinite);
  return `rId${(ids.length?Math.max(...ids):0)+1}`;
}

export async function brandPowerPoint(file,clientLogo){
  const archive=await JSZip.loadAsync(await fs.readFile(file)),logo=await badge(clientLogo),meta=await sharp(logo).metadata();
  const media='ppt/media/admiranext-client-logo.png';archive.file(media,logo);
  const presentation=await archive.file('ppt/presentation.xml')?.async('string')||'';
  const size=presentation.match(/<p:sldSz\b[^>]*\bcx="(\d+)"[^>]*\bcy="(\d+)"/),slideWidth=Number(size?.[1])||12192000,slideHeight=Number(size?.[2])||6858000;
  const width=Math.round(slideWidth*.145),height=Math.round(width*(Number(meta.height)/Number(meta.width))),left=slideWidth-width-Math.round(slideWidth*.018),top=Math.round(slideHeight*.025);
  const slides=Object.keys(archive.files).filter(name=>/^ppt\/slides\/slide\d+\.xml$/.test(name)).sort((a,b)=>Number(a.match(/\d+/)?.[0])-Number(b.match(/\d+/)?.[0]));
  for(const [index,slideName] of slides.entries()){
    const relName=slideName.replace('ppt/slides/','ppt/slides/_rels/')+'.rels';
    let rels=await archive.file(relName)?.async('string')||'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';
    const rid=relationshipId(rels),relationship=`<Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/admiranext-client-logo.png"/>`;
    rels=rels.replace('</Relationships>',`${relationship}</Relationships>`);archive.file(relName,rels);
    let slide=await archive.file(slideName).async('string');
    const picture=`<p:pic><p:nvPicPr><p:cNvPr id="${9000+index}" name="Official client logo"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="${left}" y="${top}"/><a:ext cx="${width}" cy="${height}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`;
    slide=slide.replace('</p:spTree>',`${picture}</p:spTree>`);archive.file(slideName,slide);
  }
  const output=path.join(path.dirname(file),`${path.basename(file,'.pptx')}.admiranext.pptx`);await fs.writeFile(output,await archive.generateAsync({type:'nodebuffer',compression:'DEFLATE'}));return output;
}
