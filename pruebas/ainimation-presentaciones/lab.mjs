import {generatorProject,validChannel} from './refinement/generator.mjs';
import {saveRefinement} from './save.mjs';
const $=id=>document.getElementById(id);let channel=crypto.randomUUID(),targetWindow=null;
const local=['localhost','127.0.0.1'].includes(location.hostname);
const playerOrigin=local&&new URLSearchParams(location.search).get('localPlayer')==='1'?'http://127.0.0.1:9134':'https://www.ainimation.studio';
let ready=false,pending=null,timer,revision=0,saving=false;
const status=text=>{$('status').textContent=text;};
const send=(type,extra={})=>(targetWindow||$('player').contentWindow).postMessage({type,channel,...extra},playerOrigin);
const load=()=>{if(ready&&pending){$('connection').textContent='CARGANDO';send('admiranext:refinement:load',{project:pending});}};
function lock(value){saving=value;for(const id of ['catalog','client','language','connect','demo','download'])$(id).disabled=value;}
async function readJson(url,options={}){
  const response=await fetch(url,{credentials:'same-origin',headers:{Accept:'application/json',...(options.body?{'Content-Type':'application/json'}:{})},signal:AbortSignal.timeout(options.body?80000:15000),...options});
  if(!response.headers.get('content-type')?.includes('application/json'))throw Error('Inicia sesión en el generador y vuelve a cargar el catálogo.');
  const data=await response.json();if(!response.ok)throw Error(data.error||'El generador no ha confirmado la operación.');return data;
}
const read=slug=>readJson(`/presentaciones/${encodeURIComponent(slug)}/api/ideas`);
const write=(slug,payload)=>readJson(`/presentaciones/${encodeURIComponent(slug)}/api/inline-edit`,{method:'PUT',body:JSON.stringify(payload)});
window.addEventListener('message',async event=>{
  if(event.origin!==playerOrigin||event.source!==(targetWindow||$('player').contentWindow)||event.data?.channel!==channel)return;
  const data=event.data;
  if(data.type==='ainimation:refinement:ready'){ready=true;clearTimeout(timer);$('connection').textContent='ELIGE PRESENTACIÓN';load();}
  if(data.type==='ainimation:refinement:loaded'){$('connection').textContent='CONECTADO';status('Presentación real cargada. Guardar en el generador conservará una versión anterior y sincronizará los idiomas.');}
  if(data.type==='ainimation:refinement:load-error'){status(data.error||'Conserva los ajustes antes de abrir otra presentación.');}
  if(data.type!=='ainimation:refinement:save'||!pending||!validChannel(data.requestId)||saving)return;
  lock(true);status('Guardando en el generador y comprobando la nueva revisión…');
  try{
    const result=await saveRefinement({project:pending,changeset:data.changeset,read,write});pending=result.project;
    send('admiranext:refinement:saved',{requestId:data.requestId,...result});$('connection').textContent='GUARDADO CONFIRMADO';status('Ajustes guardados y releídos. La versión anterior está conservada en el generador.');
  }catch(error){send('admiranext:refinement:error',{requestId:data.requestId,error:error.message});status(error.message+' El borrador permanece en AINimation.');}
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
  }catch(error){status(error.message);}finally{$('catalog').disabled=false;}
};
$('connect').onclick=async()=>{
  const slug=$('client').value;if(!/^[a-z0-9][a-z0-9-]{1,62}$/.test(slug))return;
  const current=++revision,language=$('language').value;$('connect').disabled=true;status('Cargando la revisión guardada…');
  channel=crypto.randomUUID();ready=false;pending=null;
  const url=new URL('/presentaciones/',playerOrigin);url.searchParams.set('origin',location.origin);url.searchParams.set('channel',channel);
  const opened=window.open(url.href,'_blank');
  if(opened){targetWindow=opened;$('player').hidden=true;status('El inspector se ha abierto en otra pestaña. Cargando la presentación…');}
  else{targetWindow=$('player').contentWindow;$('player').hidden=false;$('player').src=url.href;}
  try{const ideas=await read(slug);if(current!==revision)return;if(ideas.client!==slug)throw Error('El guion pertenece a otra presentación.');pending=generatorProject(ideas,language);$('download').disabled=false;load();}
  catch(error){status(error.message);}finally{$('connect').disabled=!$('client').value;}
};
$('demo').onclick=()=>window.open(playerOrigin+'/presentaciones/','_blank','noopener');
$('download').onclick=()=>{if(!pending)return;const url=URL.createObjectURL(new Blob([JSON.stringify(pending,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=pending.source.id+'.proyecto.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
