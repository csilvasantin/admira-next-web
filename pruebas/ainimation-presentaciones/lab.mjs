import {generatorProject,validChannel} from './refinement/generator.mjs';
import {saveRefinement} from './save.mjs';
import {withThumbnailMedia,loadThumbnailAssets} from './assets.mjs';
import {drawThumbnail} from './refinement/thumbnail.mjs';
const $=id=>document.getElementById(id);let channel=crypto.randomUUID(),targetWindow=null;
const local=['localhost','127.0.0.1'].includes(location.hostname);
const playerOrigin=local&&new URLSearchParams(location.search).get('localPlayer')==='1'?'http://127.0.0.1:9134':'https://www.ainimation.studio';
let ready=false,pending=null,timer,revision=0,saving=false,pendingAssets={},catalog=[];
const status=text=>{$('status').textContent=text;};
const send=(type,extra={})=>(targetWindow||$('player').contentWindow).postMessage({type,channel,...extra},playerOrigin);
const load=()=>{if(ready&&pending){$('connection').textContent='CARGANDO';send('admiranext:refinement:load',{project:pending,assets:pendingAssets});}};
function lock(value){saving=value;for(const id of ['catalog','client','language','connect','demo','download'])$(id).disabled=value;}
async function readJson(url,options={}){
  const response=await fetch(url,{credentials:'same-origin',headers:{Accept:'application/json',...(options.body?{'Content-Type':'application/json'}:{})},signal:AbortSignal.timeout(options.body?80000:15000),...options});
  if(!response.headers.get('content-type')?.includes('application/json'))throw Error('Inicia sesión en el generador y vuelve a cargar el catálogo.');
  const data=await response.json();if(!response.ok)throw Object.assign(Error(data.error||'El generador no ha confirmado la operación.'),{status:response.status,conflict:data.conflict===true});return data;
}
const read=async slug=>{const [ideas,images,media]=await Promise.all([readJson(`/presentaciones/${encodeURIComponent(slug)}/api/ideas`),readJson(`/presentaciones/${encodeURIComponent(slug)}/api/images`).catch(()=>null),readJson(`/presentaciones/api/media-library?client=${encodeURIComponent(slug)}`).catch(()=>null)]);return withThumbnailMedia(ideas,images?.imageSet,media?.assets||[]);};
const write=(slug,payload)=>readJson(`/presentaciones/${encodeURIComponent(slug)}/api/inline-edit`,{method:'PUT',body:JSON.stringify(payload)});
async function card(project,assets={}){
  const existing=[...$('proposals').querySelectorAll('button')].find(button=>button.dataset.client===project.source.id);
  if(!existing)return;
  const canvas=existing.querySelector('canvas');
  // Catalog images stay on the source origin; only the selected project crosses to AINimation.
  const localAssets=Object.fromEntries((project.document.thumbnailMedia||[]).map(item=>[item.url,item.url]));
  await drawThumbnail(canvas,project,{assets:{...localAssets,...assets}});
  existing.querySelector('strong').textContent=project.title;
}
async function paintCatalog(entries){
  $('gallery').hidden=false;$('proposal-count').textContent=entries.length+(entries.length===1?' propuesta · con su miniatura':' propuestas · cada una con su miniatura');
  $('proposals').replaceChildren(...entries.map(item=>{
    const button=document.createElement('button'),canvas=document.createElement('canvas'),title=document.createElement('strong'),label=document.createElement('span');
    button.type='button';button.dataset.client=item.slug;button.setAttribute('aria-pressed',String(item.slug===$('client').value));title.textContent=item.displayName||item.slug;label.textContent='Seleccionar propuesta ↗';
    button.append(canvas,title,label);button.onclick=()=>{if(saving)return;$('client').value=item.slug;for(const el of $('proposals').querySelectorAll('button'))el.setAttribute('aria-pressed',String(el===button));status('Propuesta seleccionada. Elige su idioma y abre el editor.');};return button;
  }));
  for(let start=0;start<entries.length;start+=4)await Promise.all(entries.slice(start,start+4).map(async item=>{
    const fallback={client:item.slug,updatedAt:item.updatedAt||'catalog',displayName:item.displayName,hero:{title:item.displayName||item.slug},skeleton:[]};
    let project;try{project=generatorProject(await read(item.slug));}catch{project=generatorProject(fallback);}
    await card(project);
  }));
}
window.addEventListener('message',async event=>{
  if(event.origin!==playerOrigin||event.source!==(targetWindow||$('player').contentWindow)||event.data?.channel!==channel)return;
  const data=event.data;
  if(data.type==='ainimation:refinement:ready'){ready=true;clearTimeout(timer);$('connection').textContent='ELIGE PRESENTACIÓN';load();}
  if(data.type==='ainimation:refinement:loaded'){$('connection').textContent='CONECTADO';status('Presentación cargada. La miniatura se guarda por idioma; los textos de las escenas sincronizan sus idiomas.');}
  if(data.type==='ainimation:refinement:load-error'){status(data.error||'Conserva los ajustes antes de abrir otra presentación.');}
  if(data.type!=='ainimation:refinement:save'||!pending||!validChannel(data.requestId)||saving)return;
  const recipient=targetWindow||$('player').contentWindow,requestChannel=channel;
  const reply=(type,extra={})=>recipient.postMessage({type,channel:requestChannel,...extra},playerOrigin);
  lock(true);status('Guardando en el generador y comprobando la nueva revisión…');
  try{
    const result=await saveRefinement({project:pending,changeset:data.changeset,read,write});pending=result.project;
    card(result.project,pendingAssets).catch(()=>{});
    reply('admiranext:refinement:saved',{requestId:data.requestId,...result});$('connection').textContent='GUARDADO CONFIRMADO';status('Ajustes guardados y releídos. La versión anterior está conservada en el generador.');
  }catch(error){
    if(error.code==='source_conflict'&&error.current){
      // The editor can explicitly resolve onto this canonical revision. A later
      // save still rereads the source and checks its revision and field values.
      pending=error.current;pendingAssets={};
      reply('admiranext:refinement:conflict',{requestId:data.requestId,project:error.current,phase:error.phase});
      // Older inspectors still receive their normal error; current ones already own the richer conflict.
      reply('admiranext:refinement:error',{requestId:data.requestId,error:error.message});
      $('connection').textContent='REVISIÓN DIFERENTE';status('El origen cambió. AINimation conserva el borrador y muestra la comparación.');
      // Send comparison immediately; image reads must not hold up the save response.
      loadThumbnailAssets(error.current).then(assets=>{if(channel===requestChannel&&['id','adapter','revision'].every(key=>pending?.source[key]===error.current.source[key]))pendingAssets=assets;reply('admiranext:refinement:conflict-assets',{requestId:data.requestId,source:error.current.source,assets});}).catch(()=>{});
    }else{reply('admiranext:refinement:error',{requestId:data.requestId,error:error.message});status(error.message+' El borrador permanece en AINimation.');}
  }
  finally{lock(false);$('connect').disabled=!$('client').value;$('download').disabled=!pending;}
});
const playerUrl=new URL('/presentaciones/',playerOrigin);playerUrl.searchParams.set('origin',location.origin);playerUrl.searchParams.set('channel',channel);$('player').src=playerUrl.href;
timer=setTimeout(()=>{if(!ready){$('connection').textContent='SIN CONEXIÓN';status('AINimation no ha confirmado la conexión. Conserva esta pestaña y vuelve a cargar el editor cuando esté disponible.');}},15000);
$('catalog').onclick=async()=>{
  $('catalog').disabled=true;status('Leyendo el catálogo del generador…');
  try{const data=await readJson('/presentaciones/api/clients');if(!Array.isArray(data.clients))throw Error('No se ha recibido un catálogo válido.');
    const entries=data.clients.filter(c=>/^[a-z0-9][a-z0-9-]{1,62}$/.test(c.slug));
    $('client').replaceChildren(...entries.map(c=>{const option=document.createElement('option');option.value=c.slug;option.textContent=c.displayName||c.slug;return option;}));
    const requested=new URLSearchParams(location.search).get('client');if(entries.some(c=>c.slug===requested))$('client').value=requested;
    $('connect').disabled=!entries.length;status(entries.length?'Elige una presentación e idioma y pulsa Abrir para afinar.':'No hay presentaciones guardadas.');
    catalog=entries;await paintCatalog(entries);
  }catch(error){status(error.message);}finally{$('catalog').disabled=false;}
};
$('connect').onclick=async()=>{
  const slug=$('client').value;if(!/^[a-z0-9][a-z0-9-]{1,62}$/.test(slug))return;
  const current=++revision,language=$('language').value;$('connect').disabled=true;status('Cargando la revisión guardada…');
  channel=crypto.randomUUID();ready=false;pending=null;pendingAssets={};
  const url=new URL('/presentaciones/',playerOrigin);url.searchParams.set('origin',location.origin);url.searchParams.set('channel',channel);
  const opened=window.open(url.href,'_blank');
  if(opened){targetWindow=opened;$('player').hidden=true;status('El inspector se ha abierto en otra pestaña. Cargando la presentación…');}
  else{targetWindow=$('player').contentWindow;$('player').hidden=false;$('player').src=url.href;}
  try{const ideas=await read(slug);if(current!==revision)return;if(ideas.client!==slug)throw Error('El guion pertenece a otra presentación.');const project=generatorProject(ideas,language),assets=await loadThumbnailAssets(project);if(current!==revision)return;pending=project;pendingAssets=assets;$('download').disabled=false;load();}
  catch(error){status(error.message);}finally{$('connect').disabled=!$('client').value;}
};
$('demo').onclick=()=>window.open(playerOrigin+'/presentaciones/','_blank','noopener');
$('download').onclick=()=>{if(!pending)return;const url=URL.createObjectURL(new Blob([JSON.stringify(pending,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=pending.source.id+'.proyecto.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
$('language').onchange=()=>{if(catalog.length)status('Idioma elegido. La miniatura se guarda por idioma al abrir la propuesta.');};
