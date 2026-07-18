import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const OLLAMA_URL=process.env.VISUAL_BRIEF_OLLAMA_URL||'http://127.0.0.1:11434/api/chat';
const MODEL=process.env.VISUAL_BRIEF_MODEL||'gemma4:31b';

function clean(value,max=700){return String(value==null?'':value).replace(/\s+/g,' ').trim().slice(0,max);}

export function fallbackVisualStyle(presentation={}){
  const logoRule=`The official ${presentation.displayName||'client'} logo is mandatory on every slide and visual asset. Preserve its proportions, colors and clear space; never redraw it.`;
  if(/zero\.university/i.test(String(presentation.inspirationUrl||'')))return `Visual thesis: premium technology editorial inspired by Zero University, translated into the AdmiraNeXT × ${presentation.displayName||'client'} identity. Use stark black and warm off-white fields, oversized condensed neo-grotesk typography, dramatic scale shifts, a tight modular grid, electric cobalt and acid-lime accents, simple geometric diagrams, crisp product-interface fragments and generous negative space. Alternate statement slides, structured evidence slides and restrained diagrams. Avoid stock-photo corporate aesthetics, generic gradients, decorative clutter and provider branding. ${logoRule}`;
  const theme=presentation.theme||{};
  return `Visual thesis: premium ${theme.profile||'structured'} ${theme.layout||'editorial'} brand system for AdmiraNeXT × ${presentation.displayName||'client'}. Use ${theme.mode||'light'} surfaces, primary ${theme.primary||'#12233e'}, accent ${theme.accent||'#ffb000'}, ${theme.fontStyle||'grotesk'} typography, a clear modular grid, simple geometric diagrams and generous whitespace. Alternate strong statement slides with evidence, process and metric slides. Avoid stock-photo corporate aesthetics, generic gradients, decorative clutter and provider branding. ${logoRule}`;
}

function compileBrief(data,presentation,sourceUrl){
  const fallback=fallbackVisualStyle(presentation);
  const fields=[
    ['Visual thesis',data.visualThesis],['Palette',data.palette],['Typography',data.typography],
    ['Grid and composition',data.grid],['Shapes and graphic language',data.shapes],
    ['Photography and imagery',data.imagery],['Data visualization',data.dataVisualization],
    ['Slide rhythm',data.rhythm],['Motion and video',data.motion],['Avoid',data.avoid]
  ].map(([label,value])=>`${label}: ${clean(Array.isArray(value)?value.join(', '):value,520)}`).filter(line=>!line.endsWith(': '));
  if(fields.length<6)return fallback;
  const logoRule=`Brand lockup: the official ${presentation.displayName||'client'} logo must remain visible on every slide, preserve its original proportions and colors, and sit inside a calm high-contrast clear-space area. Never use the inspiration source's logo or provider branding.`;
  return `${fields.join('\n')}\nReference interpretation: derive visual principles from ${sourceUrl}; do not copy its text, logo, code or proprietary artwork. Translate the system into AdmiraNeXT × ${presentation.displayName||'client'}.\n${logoRule}`.slice(0,5200);
}

async function screenshotReference(browser,presentation,runtime,job){
  const sourceUrl=String(presentation.inspirationUrl||presentation.website||'');
  if(!/^https:\/\//i.test(sourceUrl))throw new Error('La referencia visual no es una URL HTTPS válida.');
  const dir=path.join(runtime,'visual-briefs');await fs.mkdir(dir,{recursive:true});
  const file=path.join(dir,`${job.id}.jpg`),page=await browser.newPage();
  try{
    await page.setViewport({width:1440,height:1000,deviceScaleFactor:1});
    await page.goto(sourceUrl,{waitUntil:'domcontentloaded',timeout:60000});
    await new Promise(resolve=>setTimeout(resolve,4500));
    await page.evaluate(()=>{
      document.documentElement.style.scrollBehavior='auto';
      for(const node of document.querySelectorAll('[id*="cookie" i],[class*="cookie" i],[id*="consent" i],[class*="consent" i]')){
        const style=getComputedStyle(node);if(['fixed','sticky'].includes(style.position)&&node.getBoundingClientRect().height<innerHeight*.65)node.remove();
      }
      for(const node of document.querySelectorAll('*')){node.style.animationPlayState='paused';node.style.transition='none';}
      scrollTo(0,0);
    }).catch(()=>{});
    const top=await page.screenshot({type:'jpeg',quality:86,fullPage:false});
    const height=await page.evaluate(()=>Math.max(document.body.scrollHeight,document.documentElement.scrollHeight));
    await page.evaluate(y=>scrollTo(0,y),Math.min(900,Math.max(0,height-1000)));await new Promise(resolve=>setTimeout(resolve,900));
    const second=await page.screenshot({type:'jpeg',quality:86,fullPage:false});
    await sharp({create:{width:1440,height:2000,channels:3,background:'#ffffff'}}).composite([{input:top,left:0,top:0},{input:second,left:0,top:1000}]).jpeg({quality:86}).toFile(file);
    return {file,sourceUrl};
  }finally{await page.close().catch(()=>{});}
}

export async function generateVisualBrief({browser,presentation,job,runtime}){
  const dir=path.join(runtime,'visual-briefs'),cache=path.join(dir,`${job.id}.json`);
  try{const saved=JSON.parse(await fs.readFile(cache,'utf8'));if(saved?.brief)return saved;}catch(_){}
  const fallback={brief:fallbackVisualStyle(presentation),provider:'deterministic',sourceUrl:presentation.inspirationUrl||presentation.website||'',generatedAt:new Date().toISOString()};
  if(process.env.VISUAL_BRIEF_MODE==='off')return fallback;
  try{
    const capture=await screenshotReference(browser,presentation,runtime,job),image=(await sharp(capture.file).resize({width:900,height:1400,fit:'inside',withoutEnlargement:true}).jpeg({quality:78}).toBuffer()).toString('base64');
    const prompt=`You are a senior presentation design director. Analyse the supplied two-screen website capture as a visual reference, not as a content source. Trust what is visibly present in the capture; do not infer a conventional corporate palette from the client name. Return JSON only with these string fields: visualThesis, palette, typography, grid, shapes, imagery, dataVisualization, rhythm, motion, avoid. Each value must be one concrete sentence. Name the actual visible colors, headline scale, composition, spacing, texture, image treatment and recurring layout patterns. Describe a reusable executive presentation system. Do not copy the reference brand, words, logo or artwork. Client: ${clean(presentation.displayName,120)}.`;
    const response=await fetch(OLLAMA_URL,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({model:MODEL,stream:false,think:false,format:'json',messages:[{role:'user',content:prompt,images:[image]}],options:{temperature:.15,top_p:.75,num_ctx:4096,num_predict:650}})});
    if(!response.ok)throw new Error(`Ollama ${response.status}`);
    const payload=await response.json(),data=JSON.parse(payload?.message?.content||'{}'),brief=compileBrief(data,presentation,capture.sourceUrl);
    const result={brief,provider:MODEL,sourceUrl:capture.sourceUrl,screenshot:capture.file,generatedAt:new Date().toISOString()};
    await fs.mkdir(dir,{recursive:true});await fs.writeFile(cache,JSON.stringify(result,null,2));return result;
  }catch(error){
    return {...fallback,error:clean(error.message||error,300)};
  }
}
