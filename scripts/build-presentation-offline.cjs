#!/usr/bin/env node
// Paquete transportable. No añade cookies, notas privadas, telemetría ni claves a los archivos.
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
const args=Object.fromEntries(process.argv.slice(2).reduce((a,v,i,list)=>v.startsWith('--')?[...a,[v.slice(2),list[i+1]]]:a,[]));
const client=args.client||'alsea-starbucks';
if(!/^[a-z0-9][a-z0-9-]{1,62}$/.test(client))throw Error('Cliente no válido');
const repo=path.resolve(__dirname,'..'),out=path.resolve(args.output||path.join(repo,'output',client+'-offline'));
const base='https://www.admiranext.com/presentaciones/'+client+'/presentacion?audience=1&lang=es&quality=good';
const date=new Intl.DateTimeFormat('es-ES',{timeZone:'Europe/Madrid',day:'numeric',month:'long',year:'numeric'}).format(new Date());
let key='';const assets=new Map();let totalBytes=0;
async function bytes(url){
  const u=new URL(url);if(u.protocol!=='https:'||u.username||u.password)throw Error('Recurso no válido: '+u.pathname);
  const headers={'User-Agent':'Mozilla/5.0'};
  if(u.origin==='https://www.admiranext.com'&&u.pathname.startsWith('/presentaciones/')){if(!key)key=execFileSync('/Users/csilvasantin/Claude/admira-vault/vault-get.sh',['ADMIRANEXT_PRESENTACIONES_MACHINE_KEY'],{encoding:'utf8'}).trim();headers['X-Admira-Machine-Key']=key;}
  const r=await fetch(url,{headers,redirect:'error',signal:AbortSignal.timeout(45000)});
  if(!r.ok)throw Error('Recurso '+u.pathname+': HTTP '+r.status);
  const b=Buffer.from(await r.arrayBuffer());totalBytes+=b.length;if(totalBytes>180*1024*1024)throw Error('Paquete demasiado grande');return b;
}
async function local(url){
  if(!url||url.startsWith('data:')||url.startsWith('#'))return url;
  const absolute=new URL(url,base).href;if(assets.has(absolute))return assets.get(absolute);
  const u=new URL(absolute),ext=path.extname(u.pathname).slice(0,8)||'.bin';
  const relative='media/'+crypto.createHash('sha256').update(absolute).digest('hex').slice(0,16)+ext;
  const b=await bytes(absolute);await fs.writeFile(path.join(out,relative),b);assets.set(absolute,relative);return relative;
}
async function cssLocal(css, cssBase=base){
  css=css.replace(/@import\s+(?:url\([^)]*\)|['"][^'"]*['"])[^;]*;/gi,'');
  const matches=[...css.matchAll(/url\(\s*(['"]?)([^)'"\s]+)\1\s*\)/gi)];
  for(const match of matches){const value=match[2];if(value.startsWith('data:')||value.startsWith('#'))continue;const mapped=await local(new URL(value,cssBase).href);css=css.replaceAll(match[0],'url("'+mapped+'")');}return css;
}
(async()=>{
  await fs.mkdir(path.join(out,'media'),{recursive:true});
  const project=args.project?JSON.parse(await fs.readFile(args.project,'utf8')):JSON.parse((await bytes('https://www.admiranext.com/presentaciones/'+client+'/api/demo-project')).toString()).demoProject;
  if(!project?.documentacion?.length)throw Error('El proyecto no contiene documentación capturada');
  const source=args.source?await fs.readFile(args.source,'utf8'):(await bytes(base)).toString();
  const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  try{
    const page=await browser.newPage({viewport:{width:1280,height:720}});
    const extracted=await page.evaluate(html=>{
      const doc=new DOMParser().parseFromString(html,'text/html');
      const slides=[...doc.querySelectorAll('.slide')];if(!slides.length)throw Error('No hay diapositivas en el origen');
      for(const [i,s] of slides.entries()){
        s.id='slide-'+(i+1);s.setAttribute('data-offline-slide','');
        for(const el of s.querySelectorAll('script,iframe,form,.embed-activate,[data-slide-media-control]'))el.remove();
        for(const el of [s,...s.querySelectorAll('*')])for(const attr of [...el.attributes])if(attr.name.startsWith('on')||attr.name.startsWith('data-speaker')||attr.name.startsWith('data-edit'))el.removeAttribute(attr.name);
        for(const el of s.querySelectorAll('audio,video')){el.controls=true;el.removeAttribute('autoplay');el.preload='metadata';}
        for(const img of s.querySelectorAll('img'))img.loading='eager';
        const image=s.getAttribute('data-image-es');if(image)s.style.setProperty('--slide-image','url("'+image+'")');
        for(const a of s.querySelectorAll('[data-demo-link]')){const k=s.getAttribute('data-demo-key'),first={biz:'biz/proyecto',studio:'studio/voz',store:'store/voz'};if(k){a.href='index.html#'+encodeURIComponent(first[k]||k);a.textContent='Ver esta función sin conexión';a.removeAttribute('target');}}
        for(const a of s.querySelectorAll('[data-demo-package-links] a')){if(a.getAttribute('href').includes('format=zip'))a.remove();else{a.href=a.getAttribute('href').includes('format=pdf')?'presentacion.pdf':'index.html';a.removeAttribute('target');}}
      }
      const attributes=[...doc.documentElement.attributes].filter(a=>['lang','dir','class','style'].includes(a.name)||a.name.startsWith('data-')).map(a=>[a.name,a.value]);
      return {attributes,styles:[...doc.querySelectorAll('style')].map(s=>s.textContent),links:[...doc.querySelectorAll('link[rel="stylesheet"]')].map(s=>s.getAttribute('href')).filter(x=>x&&!x.includes('fonts.googleapis.com')),slides:slides.map(s=>s.outerHTML),title:doc.title,quality:doc.documentElement.dataset.quality||'good'};
    },source);
    let styles=extracted.styles.join('\n');
    for(const href of extracted.links){styles+='\n'+await cssLocal((await bytes(new URL(href,base).href)).toString(),new URL(href,base).href);}
    styles=await cssLocal(styles);
    let slides=extracted.slides.join('\n');
    const active=[...slides.matchAll(/\b(src|poster)="([^"]+)"/g)];
    for(const match of active){const value=match[2].replaceAll('&amp;','&');if(!value||value.startsWith('data:'))continue;slides=slides.replaceAll(match[0],match[1]+'="'+await local(value)+'"');}
    const imageURLs=[...slides.matchAll(/url\((?:&quot;|"|')?([^)'"&]+)(?:&quot;|"|')?\)/g)];
    for(const match of imageURLs){if(match[1].startsWith('data:'))continue;slides=slides.replaceAll(match[0],'url(&quot;'+await local(match[1])+'&quot;)');}
    // Las variantes de calidad son inertes aquí. Se retiran las URLs que solo usaban los scripts online.
    slides=slides.replace(/\sdata-(?:src-[^=\s]+|image-[^=\s]+|demo-href-[^=\s]+|embed-src|best-video)="[^"]*"/g,'');
    const nav='<nav class="offline-nav"><a href="index.html">Demo global</a><label>Diapositiva <select id="offline-select">'+extracted.slides.map((_,i)=>'<option value="'+i+'">'+(i+1)+' / '+extracted.slides.length+'</option>').join('')+'</select></label><button id="offline-pdf">Imprimir / PDF</button><span>Copia sin conexión · '+date+'</span></nav>';
    const override=`html{scroll-behavior:smooth}body{margin:0}.offline-nav{position:fixed;top:0;left:0;right:0;z-index:1000;display:flex;gap:20px;align-items:center;flex-wrap:wrap;padding:12px 20px;background:#081211;color:#edf7f1;font:13px system-ui}.offline-nav a{color:#70e2b4}.offline-nav select,.offline-nav button{font:inherit}.slide{scroll-margin-top:52px}.slide:first-of-type{padding-top:90px}.best-figure img:not([src]){display:none}.slide iframe{display:none}@page{size:13.333333in 7.5in;margin:0}@media print{html,body{width:1280px;margin:0!important;scroll-snap-type:none!important}.offline-nav{display:none!important}.slide,.slide:first-of-type{position:relative!important;height:720px!important;min-height:720px!important;width:1280px!important;break-after:page!important;page-break-after:always!important;padding:64px 84px!important;overflow:hidden!important;print-color-adjust:exact!important;-webkit-print-color-adjust:exact!important}.slide:last-of-type{break-after:auto!important;page-break-after:auto!important}.slide:after{display:none!important}.deck-slide{padding:0!important}.deck-slide>img{width:100%!important;height:100%!important;object-fit:cover!important}.deck-copy{bottom:12%!important}.inner{max-width:1080px!important}h1,h2,.close strong{font-size:64px!important;line-height:1.08!important}.message{font-size:27px!important}.detail{font-size:20px!important}.eyebrow,.num{font-size:15px!important}}@media(max-width:650px){.offline-nav span{display:none}.offline-nav{gap:10px}.slide:first-of-type{padding-top:120px}}`;
    const fit='@media print{html[data-prospect] .slide[data-mb-maqueta]{grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr)!important;gap:32px!important}html[data-prospect] .slide[data-mb-maqueta] h2{font-size:44px!important;line-height:1.08!important}html[data-prospect] .slide[data-mb-maqueta] .message{font-size:23px!important;line-height:1.25!important}html[data-prospect] .slide[data-mb-maqueta] .detail{font-size:18px!important;line-height:1.4!important}.slide[data-mb-maqueta] .eyebrow{white-space:normal!important;line-height:1.35!important;margin-bottom:16px!important;font-size:11px!important}.pm-figura .mk{zoom:.58!important}.prospect-galaxia h2{font-size:36px!important;line-height:1.1!important}.prospect-galaxia .detail{font-size:20px!important}.pg-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:16px!important}.pg-grid .mk{zoom:.32!important}a{color:inherit!important;text-decoration:underline!important;text-underline-offset:3px}}';
    const rootAttrs=extracted.attributes.map(([k,v])=>k+'="'+v.replaceAll('&','&amp;').replaceAll('"','&quot;')+'"').join(' ');
    const html='<!doctype html><html '+rootAttrs+'><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>'+client+' · Presentación sin conexión</title><style>'+styles+'\n'+override+'\n'+fit+'</style></head><body>'+nav+slides+'<script src="presentacion.js"></script></body></html>';
    await fs.writeFile(path.join(out,'presentacion.html'),html);
    await fs.writeFile(path.join(out,'presentacion.js'),`(function(){const slides=[...document.querySelectorAll('[data-offline-slide]')],select=document.getElementById('offline-select');let at=0;function go(i){at=Math.max(0,Math.min(slides.length-1,i));slides[at].scrollIntoView();select.value=at;}select.addEventListener('change',()=>go(Number(select.value)));document.getElementById('offline-pdf').addEventListener('click',()=>print());document.addEventListener('keydown',e=>{if(/input|select|textarea/i.test(e.target.tagName))return;if(['ArrowDown','PageDown','ArrowRight'].includes(e.key)){e.preventDefault();go(at+1);}if(['ArrowUp','PageUp','ArrowLeft'].includes(e.key)){e.preventDefault();go(at-1);}});const observer=new IntersectionObserver(es=>es.filter(e=>e.isIntersecting).forEach(e=>{at=slides.indexOf(e.target);select.value=at;}),{threshold:.5});slides.forEach(s=>observer.observe(s));})();`);
    const snapshot=structuredClone(project);
    for(const d of snapshot.documentacion){const m=d.muestra;if(m){m.url=await local(m.url);if(m.poster)m.poster=await local(m.poster);for(const v of m.variantes||[]){v.url=await local(v.url);if(v.poster)v.poster=await local(v.poster);}}}
    const {demoGlobalHTML}=await import(pathToFileURL(path.join(repo,'subdemos/demo-player.mjs')));
    await fs.writeFile(path.join(out,'index.html'),demoGlobalHTML(snapshot,{offline:true,presentation:'presentacion.html',css:'demo-player.css',js:'demo-player.js'}));
    await Promise.all(['demo-player.js','demo-player.css'].map(f=>fs.copyFile(path.join(repo,'subdemos',f),path.join(out,f))));
    await fs.writeFile(path.join(out,'LEEME.txt'),project.nombre+' — '+date+'\n\n1. Descomprime la carpeta completa.\n2. Abre index.html en el navegador del ordenador.\n3. Presentación abre el deck. Demo global contiene las '+snapshot.documentacion.filter(d=>d.clave.includes('/')).length+' funciones.\n4. Audio y vídeo se reproducen al pulsar sus controles.\n5. presentacion.pdf es la copia de lectura para móvil o correo.\n\nNo hace falta instalar nada, arrancar un servidor ni iniciar sesión para esta copia. Mantén media/ junto a los HTML.\nLos recorridos y resultados son muestras preparadas, no crean ni publican recursos reales. Abrir función online requiere conexión y acceso autorizado.\n');
    await page.goto(pathToFileURL(path.join(out,'presentacion.html')).href,{waitUntil:'load'});
    await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].filter(i=>i.src).map(i=>i.complete?Promise.resolve():new Promise((r,j)=>{i.onload=r;i.onerror=()=>j(Error('Imagen no disponible'));})));});
    await page.pdf({path:path.join(out,'presentacion.pdf'),printBackground:true,preferCSSPageSize:true,displayHeaderFooter:false});
    // Chromium resuelve los enlaces relativos como file://. El PDF enviado debe enlazar
    // a la presentación privada online y nunca contener rutas del ordenador que lo creó.
    const python=args.python||'/Users/csilvasantin/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3';
    execFileSync(python,['-c',`from pypdf import PdfReader,PdfWriter
from pypdf.generic import TextStringObject
from urllib.parse import urlparse
import sys,os
p,client=sys.argv[1:];r=PdfReader(p);w=PdfWriter();w.clone_document_from_reader(r)
for page in w.pages:
 for ref in page.get('/Annots',[]):
  a=ref.get_object().get('/A')
  if a and str(a.get('/URI','')).startswith('file:'):
   u=urlparse(str(a['/URI']));target='https://www.admiranext.com/presentaciones/'+client+'/demo'
   if u.path.endswith('presentacion.pdf'):target='https://www.admiranext.com/presentaciones/'+client+'/offline?format=pdf'
   if u.fragment:target+='#'+u.fragment
   a.update({'/URI':TextStringObject(target)})
with open(p+'.tmp','wb') as f:w.write(f)
os.replace(p+'.tmp',p)
`,path.join(out,'presentacion.pdf'),client]);
    const manifest={client,createdAt:new Date().toISOString(),slides:extracted.slides.length,subdemos:snapshot.documentacion.filter(d=>d.clave.includes('/')).length,media:[...assets].map(([url,file])=>({url,file})),format:'carpeta HTML autónoma y PDF'};
    await fs.writeFile(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2));
    execFileSync('python3',['-c',"import zipfile,pathlib,sys; p=pathlib.Path(sys.argv[1]); z=zipfile.ZipFile(sys.argv[2],'w',zipfile.ZIP_DEFLATED); [z.write(f,arcname=p.name+'/'+str(f.relative_to(p))) for f in sorted(p.rglob('*')) if f.is_file()]; z.close()",out,out+'.zip']);
    console.log(JSON.stringify({output:out,zip:out+'.zip',slides:manifest.slides,subdemos:manifest.subdemos,assets:assets.size,downloadedBytes:totalBytes}));
  }finally{await browser.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
