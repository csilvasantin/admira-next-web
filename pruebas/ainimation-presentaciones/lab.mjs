import {exportPresentation} from './export.mjs';
import {demo} from './contract.mjs';
const $=id=>document.getElementById(id),channel=crypto.randomUUID();
// The override is available only for loopback development; production always targets AINimation.
const local=['localhost','127.0.0.1'].includes(location.hostname);
const playerOrigin=local&&new URLSearchParams(location.search).get('localPlayer')==='1'?'http://127.0.0.1:9134':'https://www.ainimation.studio';
let ready=false,pending=demo,timer,revision=0;
const status=text=>{$('status').textContent=text;};
const send=()=>{if(ready&&pending){$('connection').textContent='ENVIANDO';$('player').contentWindow.postMessage({type:'admiranext:presentation:load',channel,presentation:pending},playerOrigin);}};
const watch=()=>{clearTimeout(timer);timer=setTimeout(()=>{if(!ready){$('connection').textContent='SIN CONEXIÓN';status('El reproductor no ha confirmado la conexión. Puedes descargar el paquete y abrirlo en AINimation cuando esté disponible.');}},15000);};
window.addEventListener('message',event=>{
  if(event.origin!==playerOrigin||event.source!==$('player').contentWindow||event.data?.channel!==channel)return;
  if(event.data.type==='ainimation:presentation:ready'){ready=true;clearTimeout(timer);send();}
  if(event.data.type==='ainimation:presentation:loaded'){$('connection').textContent='CONECTADO';status(`${event.data.slides} escenas listas. Abre el mapa para elegir tu recorrido.`);}
  if(event.data.type==='ainimation:presentation:error'){$('connection').textContent='REVISAR PAQUETE';status('AINimation ha rechazado el paquete. El original sigue intacto.');}
});
const playerUrl=new URL('/presentaciones/',playerOrigin);playerUrl.searchParams.set('origin',location.origin);playerUrl.searchParams.set('channel',channel);$('player').src=playerUrl.href;watch();$('download').disabled=false;
async function readJson(url){
  const response=await fetch(url,{credentials:'same-origin',headers:{Accept:'application/json'},signal:AbortSignal.timeout(12000)});
  if(!response.ok||!response.headers.get('content-type')?.includes('application/json'))throw Error('Inicia sesión en el generador y vuelve a cargar el catálogo.');
  return response.json();
}
$('catalog').onclick=async()=>{
  $('catalog').disabled=true;status('Leyendo el catálogo del generador…');
  try{const data=await readJson('/presentaciones/api/clients');if(!Array.isArray(data.clients))throw Error('No se ha recibido un catálogo válido.');
    const entries=data.clients.filter(c=>/^[a-z0-9][a-z0-9-]{1,62}$/.test(c.slug));
    $('client').replaceChildren(...entries.map(c=>{const o=document.createElement('option');o.value=c.slug;o.textContent=c.displayName||c.slug;return o;}));
    $('connect').disabled=!entries.length;status(entries.length?'Elige una presentación y pulsa Ver en AINimation.':'No hay presentaciones guardadas.');
  }catch(error){status(error.message);}finally{$('catalog').disabled=false;}
};
function activate(presentation){pending=presentation;$('download').disabled=false;send();if(!ready)status('Paquete preparado. Esperando al reproductor; también puedes descargarlo.');}
$('connect').onclick=async()=>{
  const slug=$('client').value;if(!/^[a-z0-9][a-z0-9-]{1,62}$/.test(slug))return;
  const current=++revision,language=$('language').value;$('connect').disabled=true;status('Cargando una copia del guion guardado…');
  try{const ideas=await readJson(`/presentaciones/${encodeURIComponent(slug)}/api/ideas`);if(current!==revision)return;if(ideas.client!==slug)throw Error('El guion recibido pertenece a otra presentación.');const presentation=exportPresentation(ideas,language);activate(presentation);}
  catch(error){status(error.message);}finally{$('connect').disabled=!$('client').value;}
};
$('demo').onclick=()=>{revision++;activate(demo);};
$('download').onclick=()=>{if(!pending)return;const url=URL.createObjectURL(new Blob([JSON.stringify(pending,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=pending.source.id+'.ainimation.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
