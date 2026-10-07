import {clientSlug,extractPresentationSlides,buildRemotePlan,hashNarrationText} from './remote-plan.mjs?v=20261007-remote-1';
import {createRemoteRunner} from './remote-runner.mjs?v=20261007-remote-1';
const $=id=>document.getElementById(id),frame=$('remote-deck'),narrationAudio=new Audio();
narrationAudio.preload='auto';
let project=null,plan=[],manifest=new Map(),client='',lang='es',loadToken=0,timed=false,sampleKey='',warnings=new Set();
const warn=message=>{warnings.add(message);$('remote-warnings').textContent=[...warnings].join(' ');};
const cleanMedia=()=>document.querySelectorAll('#remote-sample audio,#remote-sample video').forEach(el=>el.pause());
const safeURL=value=>{try{const u=new URL(value,location.href);return u.protocol==='https:'&&!u.username&&!u.password?u.href:'';}catch{return '';}};
function addMedia(sample){
  const root=$('remote-sample');root.replaceChildren();if(!sample)return;
  for(const item of [sample,...(sample.variantes||[])]){
    const src=safeURL(item.url);if(!src)continue;
    const video=sample.tipo==='video'||/\.(mp4|webm)(?:\?|$)/i.test(src),audio=sample.tipo==='audio';
    const el=document.createElement(audio?'audio':video?'video':'img');el.src=src;
    if(el.tagName==='IMG')el.alt=item.nombre||'Muestra preparada';else{el.muted=true;el.controls=true;el.preload='metadata';if(video){el.playsInline=true;const poster=safeURL(item.poster);if(poster)el.poster=poster;}el.addEventListener('error',()=>{warn('Una muestra no se ha podido cargar. El recorrido conserva la narración y debe revisarse esa muestra.');});}
    root.append(el);
  }
}
const fieldLabels={local:'Local',contenido:'Contenido',destinos:'Zonas',volumen:'Volumen',horario:'Horario',estado:'Estado',proyecto:'Proyecto',circuito:'Circuito',gemelo:'Gemelo',inventario:'Inventario',dispositivos:'Dispositivos',puntos:'Puntos DooH',vuelo:'Vuelo',inicio:'Inicio',fin:'Fin',franjas:'Franjas',pieza_segundos:'Duración de pieza',frecuencia:'Frecuencia',id:'Identificador',nombre:'Nombre',tipo:'Tipo',marca:'Marca',loc:'Local',project:'Proyecto',ci:'Elemento ITIL',pantallas:'Pantallas',altavoces:'Altavoces',camaras:'Cámaras',totem:'Tótem'};
function caseFields(value,root){
  for(const [key,item] of Object.entries(value||{})){
    const label=Array.isArray(value)?'Elemento '+(Number(key)+1):fieldLabels[key]||key.replaceAll('_',' ');
    if(item&&typeof item==='object'){const group=document.createElement('section'),heading=document.createElement('h4');heading.textContent=label;group.append(heading);caseFields(item,group);root.append(group);}
    else{const row=document.createElement('p'),name=document.createElement('strong');name.textContent=label+': ';row.append(name,document.createTextNode(String(item??'')));root.append(row);}
  }
}
function applyClientTheme(){
  const theme=frame.contentWindow?.getComputedStyle?.(frame.contentDocument.documentElement);if(!theme)return;
  const stage=document.querySelector('.remote-stage');if(!stage)return;
  for(const [source,target,property] of [['--bg','--remote-bg','color'],['--ink','--remote-ink','color'],['--primary','--remote-primary','color'],['--accent','--remote-accent','color'],['--sans','--remote-font','font-family']]){
    const value=theme.getPropertyValue(source).trim();if(value&&CSS.supports(property,value))stage.style.setProperty(target,value);
  }
}
function show(segment){
  if(segment.type==='slide'||sampleKey!==segment.demoKey){cleanMedia();$('remote-sample').replaceChildren();sampleKey='';}$('remote-caption').textContent=segment.text;
  const demo=project.documentacion.find(d=>d.clave===segment.demoKey);
  frame.hidden=segment.type!=='slide';$('remote-demo').hidden=segment.type==='slide';
  if(segment.type==='slide'){
    const slide=frame.contentDocument.querySelectorAll('.slide')[segment.slideIndex];
    slide.scrollIntoView({block:'start',behavior:'instant'});
  }else{
    $('remote-demo-title').textContent=demo.titulo;$('remote-phase').textContent=typeof demo.guion[segment.phaseIndex]==='string'?demo.guion[segment.phaseIndex]:demo.guion[segment.phaseIndex].texto||demo.guion[segment.phaseIndex].text;
    $('remote-phase-count').textContent='Ensayo · paso '+(segment.phaseIndex+1)+' de '+demo.guion.length;
    $('remote-case').hidden=!demo.caso;$('remote-case').replaceChildren();if(demo.caso)caseFields(demo.caso,$('remote-case'));
    const samplePhase=demo.clave.startsWith('studio/')?demo.guion.length-1:Math.min(1,demo.guion.length-1);
    if(segment.phaseIndex>=samplePhase&&sampleKey!==demo.clave){addMedia(demo.muestra);sampleKey=demo.clave;}
    document.querySelectorAll('#remote-sample video').forEach(el=>{if(!el.ended)el.play().catch(()=>warn('Una muestra necesita pulsar su control para reproducirse.'));});
  }
}
function narrate(segment,ended,failed){
  let cancelled=false,paused=false,media=null,utterance=null,timer=null,deadline=0,remaining=0,watchdog=null,finishing=false,pausedAt=0,pausedMS=0;
  const prepared=manifest.get(segment.id),startedAt=Date.now();
  const clear=()=>{clearTimeout(timer);clearTimeout(watchdog);};
  const finish=()=>{
    clear();if(cancelled||paused)return;
    const demo=project.documentacion.find(d=>d.clave===segment.demoKey);
    if(!finishing){
      finishing=true;
      const voicedMS=prepared&&!timed?prepared.duration*1000:Date.now()-startedAt-pausedMS;
      remaining=Math.max(0,(segment.type==='slide'?4000:2500)-voicedMS);
      if(demo&&segment.phaseIndex===demo.guion.length-1){
        const videos=[...document.querySelectorAll('#remote-sample video')];
        remaining=Math.max(remaining,...videos.filter(v=>!v.ended&&!v.error).map(v=>Number.isFinite(v.duration)?Math.min(30000,Math.max(0,v.duration-v.currentTime)*1000):12000));
      }
      if(remaining>100){schedule();return;}
    }
    ended();
  };
  const error=message=>{clear();if(!cancelled)failed(message);};
  const schedule=()=>{deadline=Date.now()+remaining;timer=setTimeout(finish,remaining);};
  const useSpeech=()=>{
    if(!('speechSynthesis' in window)||!window.SpeechSynthesisUtterance)return error('El navegador no dispone de voz. Puedes elegir continuar sin voz.');
    const voices=speechSynthesis.getVoices(),voice=voices.find(v=>v.lang.toLowerCase().startsWith(segment.lang));
    if(!voice)return error('No hay una voz disponible en '+segment.lang+'. Puedes elegir continuar sin voz.');
    utterance=new SpeechSynthesisUtterance(segment.text);utterance.lang=voice.lang;utterance.voice=voice;utterance.rate=1;
    utterance.onend=finish;utterance.onerror=()=>error('La narración del navegador ha fallado. Puedes continuar sin voz.');
    speechSynthesis.cancel();speechSynthesis.speak(utterance);
    watchdog=setTimeout(()=>error('La narración no ha terminado. Puedes continuar sin voz.'),Math.max(30000,segment.text.length*160));
    if(paused)speechSynthesis.pause();
  };
  const begin=async()=>{
    if(timed){remaining=Math.max(3500,segment.text.split(' ').length*350);if(!paused)schedule();return;}
    if(prepared){
      media=narrationAudio;media.src=prepared.url;media.onended=finish;media.onerror=()=>error('No se ha podido reproducir la voz preparada. Puedes continuar sin voz.');
      watchdog=setTimeout(()=>error('La voz preparada no ha terminado. Puedes continuar sin voz.'),(prepared.duration+30)*1000);
      if(!paused)media.play().catch(()=>error('El navegador ha bloqueado el audio. Pulsa continuar sin voz o vuelve a iniciar.'));
    }else useSpeech();
  };
  begin().catch(()=>error('No se ha podido verificar la narración preparada. Puedes continuar sin voz.'));
  return {cancel(){cancelled=true;clear();if(media){media.onended=null;media.onerror=null;media.pause();media.removeAttribute('src');media.load();}if(utterance)speechSynthesis.cancel();cleanMedia();},
    pause(){paused=true;pausedAt=Date.now();if(timer){remaining=Math.max(0,deadline-Date.now());clearTimeout(timer);timer=null;}if(media)media.pause();if(utterance)speechSynthesis.pause();clearTimeout(watchdog);cleanMedia();},
    resume(){paused=false;pausedMS+=Date.now()-pausedAt;if(timed||finishing)schedule();else if(media){media.play().catch(()=>error('No se ha podido reanudar la voz.'));watchdog=setTimeout(()=>error('La voz no ha terminado.'),600000);}else if(utterance){speechSynthesis.resume();watchdog=setTimeout(()=>error('La voz no ha terminado.'),600000);}document.querySelectorAll('#remote-sample video').forEach(el=>{if(!el.ended)el.play().catch(()=>warn('Una muestra necesita pulsar su control para reproducirse.'));});}};
}
const runner=createRemoteRunner({show,narrate,changed({state,index,total,message}){
  $('remote-pause').disabled=!['running','paused'].includes(state);$('remote-next').disabled=!['running','paused'].includes(state);$('remote-stop').disabled=!['running','paused','error'].includes(state);$('remote-start').disabled=!plan.length||['running','paused'].includes(state);$('remote-pause').textContent=state==='paused'?'Reanudar':'Pausar';
  $('remote-progress').value=total?index/total*100:0;$('remote-fallback').hidden=state!=='error';
  for(const id of ['remote-client','remote-lang','remote-load'])$(id).disabled=['running','paused'].includes(state);
  $('remote-status').textContent=message==='playing'?'Presentando · '+(index+1)+' de '+total+' segmentos':message==='paused'?'Presentación en pausa':message==='stopped'?'Presentación detenida':message==='complete'?'Presentación completa terminada':message;
},completed(){cleanMedia();$('remote-record').hidden=false;$('remote-record').scrollIntoView({block:'nearest',behavior:'instant'});}});
function reset(){runner.stop();$('remote-record').hidden=true;$('remote-record-status').textContent='';$('remote-fallback').hidden=true;}
async function load(){
  reset();warnings.clear();$('remote-warnings').textContent='';sampleKey='';const token=++loadToken;project=null;plan=[];manifest=new Map();$('remote-start').disabled=true;frame.hidden=true;
  client=clientSlug($('remote-client').value.trim());if(!client){$('remote-status').textContent='Introduce un identificador de presentación válido.';return;}
  $('remote-status').textContent='Cargando presentación y documentación protegidas…';
  try{
    const response=await fetch('/presentaciones/'+client+'/api/demo-project',{headers:{Accept:'application/json'},credentials:'same-origin'});
    if(!response.ok)throw new Error(response.status===401||response.status===403?'Inicia sesión o abre primero la presentación con tu acceso autorizado.':'No se ha podido cargar la presentación ('+response.status+').');
    const data=await response.json();if(!data.demoProject?.documentacion?.length)throw new Error('Esta presentación no tiene documentación de demos guardada.');
    if(token!==loadToken)return;project=data.demoProject;
    await new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>reject(new Error('La presentación no ha respondido.')),25000);
      frame.onload=()=>{clearTimeout(timeout);try{if(!frame.contentDocument?.querySelector('.slide'))throw new Error('La presentación requiere acceso o no contiene diapositivas.');resolve();}catch{reject(new Error('No se puede leer la presentación. Comprueba el acceso autorizado.'));}};
      frame.onerror=()=>{clearTimeout(timeout);reject(new Error('No se ha podido abrir la presentación.'));};
      frame.src='/presentaciones/'+client+'/presentacion?audience=1';
    });
    if(token!==loadToken)return;applyClientTheme();
    // Saved rehearsal wording is currently Spanish; never advertise an English voice over Spanish slides.
    lang='es';$('remote-lang').replaceChildren(new Option('Español','es'));
    plan=buildRemotePlan(extractPresentationSlides(frame.contentDocument),project,lang);
    const checkedAudio=new Map();
    try{
      const res=await fetch('/presentaciones/'+client+'/remote-audio?lang='+lang,{headers:{Accept:'application/json'},credentials:'same-origin'});
      if(res.ok){const map=await res.json();const texts=new Map(plan.map(segment=>[segment.id,segment.text]));
        await Promise.all((map.segments||[]).map(async entry=>{
          const u=new URL(entry.url,location.origin),text=texts.get(entry.id);
          if(text&&u.origin===location.origin&&u.pathname==='/presentaciones/'+client+'/remote-audio'&&/^[a-f0-9]{64}$/.test(entry.textHash)&&Number.isFinite(entry.duration)&&entry.duration>0&&entry.duration<600){
            if(await hashNarrationText(text)===entry.textHash)checkedAudio.set(entry.id,{...entry,url:u.href});
            else warn('Una narración preparada no coincide con el texto actual; ese segmento usará la voz del navegador.');
          }
        }));
      }
    }catch{}
    if(token!==loadToken)return;manifest=checkedAudio;frame.hidden=false;$('remote-start').disabled=false;
    $('remote-status').textContent='Preparada · '+plan.filter(p=>p.type==='slide').length+' diapositivas · '+new Set(plan.filter(p=>p.demoKey).map(p=>p.demoKey)).size+' demos · '+plan.filter(p=>p.type==='demo-phase').length+' pasos · '+(manifest.size?'voz preparada verificada al reproducir':'voz del navegador');
  }catch(error){if(token!==loadToken)return;project=null;plan=[];frame.hidden=true;$('remote-status').textContent=error.message;}
}
$('remote-load').addEventListener('click',load);
$('remote-start').addEventListener('click',()=>{reset();timed=false;runner.start(plan);$('remote-status').scrollIntoView({block:'start',behavior:'instant'});});
$('remote-pause').addEventListener('click',()=>runner.snapshot().state==='paused'?runner.resume():runner.pause());
$('remote-stop').addEventListener('click',reset);$('remote-next').addEventListener('click',()=>runner.next());
$('remote-fallback').addEventListener('click',()=>{timed=true;runner.fallback();});
$('remote-fullscreen').addEventListener('click',()=>document.getElementById('remota').requestFullscreen?.().catch(()=>{$('remote-status').textContent='La pantalla completa necesita permiso del navegador.';}));
$('remote-record-intent').addEventListener('click',()=>{$('remote-record-status').textContent='Has indicado que quieres preparar el vídeo. No se ha iniciado ninguna grabación; confírmalo a Trinity para preparar el respaldo.';});
$('remote-client').addEventListener('change',()=>{loadToken++;reset();plan=[];$('remote-start').disabled=true;});
window.addEventListener('pagehide',()=>runner.stop());
window.addEventListener('hashchange',()=>{if(location.hash!=='#remota')reset();});
document.addEventListener('visibilitychange',()=>{if(document.hidden)runner.pause();});
