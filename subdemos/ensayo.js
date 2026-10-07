import {GLOBALES, aplicarManifiesto} from './catalogo.mjs?v=20261007-store-biz-1';
const $=id=>document.getElementById(id);
const labels={id:'Identificador',nombre:'Nombre',responsable:'Responsable',circuito:'Circuito',local:'Local',contenido:'Contenido',destinos:'Destinos',volumen:'Volumen',horario:'Horario',estado:'Estado',playlist:'Playlist',prioridad:'Prioridad',orden:'Orden',reproduccion:'Reproducción',producto:'Producto',evento:'Evento',regla:'Regla',proyecto:'Proyecto',puntos:'Puntos DooH',tipo:'Tipo',vuelo:'Vuelo de campaña',inicio:'Inicio',fin:'Fin',franjas:'Franjas',pieza_segundos:'Duración de la pieza (segundos)',frecuencia:'Frecuencia',gemelo:'Gemelo digital',zonas:'Zonas',retail_media:'Soportes Retail Media',zona:'Zona',soporte:'Soporte',dispositivos:'Dispositivos IoT',control:'Control previsto',servicio:'Servicio',ubicacion:'Ubicación',elementos:'Elementos de configuración ITIL',ci:'Referencia CI',dispositivo:'Dispositivo',relacion:'Relación'};
let demo,caso,paso=0;
const drafts=new Map();
const params=new URLSearchParams(location.search);
async function catalogos(){
 await Promise.all(['store','biz'].map(async id=>{try{const r=await fetch('/subdemos/'+id+'.subdemos.json',{cache:'no-store'});if(r.ok)aplicarManifiesto(await r.json());}catch{}}));
 try{for(const m of Object.values(JSON.parse(localStorage.getItem('ax-subdemos-manifiestos')||'{}')))aplicarManifiesto(m);}catch{}
}
function grupo(parent,key){const el=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent=labels[key]||key;el.append(legend);parent.append(el);return el;}
function campos(value,parent,path=[]){
 for(const [key,v] of Object.entries(value)){
  const next=[...path,key];
  if(v&&typeof v==='object'){campos(v,grupo(parent,Array.isArray(value)?String(Number(key)+1):key),next);continue;}
  const label=document.createElement('label');label.textContent=Array.isArray(value)?'Elemento '+(Number(key)+1):(labels[key]||key);
  const input=document.createElement('input');input.dataset.path=JSON.stringify(next);input.dataset.originalType=typeof v;input.value=String(v??'');
  input.type=typeof v==='number'?'number':/^\d{4}-\d{2}-\d{2}$/.test(String(v))?'date':'text';
  if(key==='volumen'){input.min='0';input.max='100';}if(key==='pieza_segundos'){input.min='1';}
  input.required=true;label.append(input);parent.append(label);
 }
}
function renderCaso(){const el=$('campos');el.replaceChildren();campos(caso,el);}
function renderPaso(){const pasos=demo.guion||[];$('progreso').textContent='PASO '+(paso+1)+' DE '+Math.max(pasos.length,1);const instruction=pasos[paso];$('instruccion').textContent=typeof instruction==='string'?instruction:instruction?.texto||'Revisar el caso preparado.';$('anterior').disabled=paso===0;$('siguiente').disabled=paso>=pasos.length-1;}
function seleccionar(){
 const g=GLOBALES.find(g=>g.id===$('plataforma').value);demo=g.subdemos.find(d=>d.id===$('subdemo').value);if(!demo){$('titulo').textContent='No hay subdemos en esta plataforma.';$('campos').replaceChildren();$('caso').hidden=true;$('muestra').hidden=true;$('anterior').disabled=true;$('siguiente').disabled=true;$('reiniciar').disabled=true;return;}
 $('caso').hidden=false;$('reiniciar').disabled=false;
 const saved=drafts.get(g.id+'/'+demo.id);caso=structuredClone(saved||demo.caso||{contenido:demo.nombre,estado:'Ejemplo preparado'});paso=0;
 $('titulo').textContent=g.nombre+' · '+(demo.letra?demo.letra+'. ':'')+demo.nombre;$('descripcion').textContent=demo.desc;
 $('funcion').href=demo.url;
 const sample=demo.muestra,root=$('muestra');root.replaceChildren();root.hidden=!sample?.url;
 if(sample?.url){const el=document.createElement(sample.tipo==='image'?'img':sample.tipo==='audio'?'audio':'video');el.src=sample.url;if(sample.tipo==='image')el.alt=demo.nombre;else{el.controls=true;el.preload='metadata';if(sample.poster)el.poster=sample.poster;}root.append(el);}
 $('estado').textContent='';renderCaso();renderPaso();
 const url=new URL(location.href);url.searchParams.set('plataforma',g.id);url.searchParams.set('demo',demo.id);history.replaceState(null,'',url);
}
function plataforma(id){$('plataforma').value=['store','biz'].includes(id)?id:'store';const g=GLOBALES.find(g=>g.id===$('plataforma').value);$('subdemo').replaceChildren(...g.subdemos.map(d=>{const o=document.createElement('option');o.value=d.id;o.textContent=(d.letra?d.letra+'. ':'')+d.nombre;return o;}));}
$('plataforma').addEventListener('change',()=>{plataforma($('plataforma').value);seleccionar();});$('subdemo').addEventListener('change',seleccionar);
$('anterior').addEventListener('click',()=>{paso=Math.max(0,paso-1);renderPaso();});$('siguiente').addEventListener('click',()=>{paso=Math.min((demo.guion||[]).length-1,paso+1);renderPaso();});
$('reiniciar').addEventListener('click',()=>{drafts.delete($('plataforma').value+'/'+demo.id);seleccionar();});
$('caso').addEventListener('submit',e=>{e.preventDefault();const next=structuredClone(caso);for(const input of $('campos').querySelectorAll('input')){const path=JSON.parse(input.dataset.path);let obj=next;for(const key of path.slice(0,-1))obj=obj[key];obj[path.at(-1)]=input.dataset.originalType==='number'?Number(input.value):input.value;}if(next.vuelo?.inicio>next.vuelo?.fin){$('estado').textContent='El fin del vuelo debe ser igual o posterior al inicio.';return;}caso=next;drafts.set($('plataforma').value+'/'+demo.id,structuredClone(caso));$('estado').textContent='Datos aplicados en el ensayo. Revisa el siguiente paso.';});
await catalogos();plataforma(params.get('plataforma'));if([...$('subdemo').options].some(o=>o.value===params.get('demo')))$('subdemo').value=params.get('demo');seleccionar();
