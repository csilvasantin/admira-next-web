import {clientSlug,extractPresentationSlides,buildRemotePlan,hashNarrationText} from './remote-plan.mjs?v=20261007-remote-1';
import {videoPorDemo} from '../subdemos/retail-videos.mjs?v=20261007-retail-video-1';
import {createRemoteRunner} from './remote-runner.mjs?v=20261007-remote-1';
const $=id=>document.getElementById(id),frame=$('remote-deck'),narrationAudio=new Audio(),demoVideo=$('remote-video');
narrationAudio.preload='auto';
const SOUND_KEY='admira-demo-audio-v1';
let sound={narration:true,samples:true,muted:false},soundChanged=null,clipActive=false,primeGeneration=0,videoReadyKey='';
try{const saved=JSON.parse(localStorage.getItem(SOUND_KEY)||'{}');for(const key of Object.keys(sound))if(typeof saved[key]==='boolean')sound[key]=saved[key];}catch{}
function updateSound(){
  narrationAudio.muted=sound.muted||!sound.narration;demoVideo.muted=sound.muted||!sound.samples||demoVideo.dataset?.hasAudio==='false';
  $('remote-narration').checked=sound.narration;$('remote-sound').checked=sound.samples;$('remote-mute').setAttribute?.('aria-pressed',String(sound.muted));$('remote-mute').textContent=sound.muted?'Activar audio':'Silenciar todo';
  if(sound.muted)document.querySelectorAll('#remote-original-sample audio,#remote-original-sample video').forEach(el=>el.muted=true);soundChanged?.();try{localStorage.setItem(SOUND_KEY,JSON.stringify(sound));}catch{}
}
function prepareVideo(demo){
  const video=videoPorDemo(demo),src=video&&safeURL(video.url);
  videoReadyKey='';demoVideo.pause?.();
  if(!src){demoVideo.removeAttribute?.('src');demoVideo.removeAttribute?.('poster');demoVideo.load?.();return false;}
  if(demoVideo.getAttribute?.('src')!==src){demoVideo.src=src;demoVideo.load?.();}
  demoVideo.currentTime=0;videoReadyKey=demo.clave;
  demoVideo.dataset.remoteLabel=demo.titulo+' ('+demo.clave+')';demoVideo.dataset.hasAudio=String(video.audio===true);
  const poster=video.poster&&safeURL(video.poster);if(poster)demoVideo.poster=poster;else demoVideo.removeAttribute?.('poster');
  demoVideo.controls=true;demoVideo.playsInline=true;demoVideo.preload='auto';demoVideo.hidden=true;updateSound();return true;
}
function primeVideo(){
  const demo=project?.documentacion.find(item=>item.clave.includes('/')&&videoPorDemo(item));
  if(!demo||!prepareVideo(demo)||!demoVideo.play)return;
  // Authorize this persistent element on Start without overlapping the narration.
  demoVideo.volume=0;demoVideo.muted=false;
  const token=++primeGeneration,pending=demoVideo.play();pending?.then(()=>{if(token!==primeGeneration)return;if(!clipActive){demoVideo.pause();demoVideo.currentTime=0;}demoVideo.volume=1;updateSound();}).catch(error=>{if(token!==primeGeneration)return;demoVideo.volume=1;updateSound();if(error.name!=='AbortError')warn('El vídeo '+demo.titulo+' necesita comprobar su reproducción al llegar a esa función.');});
}

let project=null,plan=[],manifest=new Map(),client='',lang='es',loadToken=0,timed=false,sampleKey='',warnings=new Set();
const warn=message=>{warnings.add(message);$('remote-warnings').textContent=[...warnings].join(' ');};
const cleanMedia=()=>document.querySelectorAll('#remote-sample audio,#remote-sample video,#remote-original-sample audio,#remote-original-sample video').forEach(el=>el.pause());
const safeURL=value=>{
  try{
    const u=new URL(value,location.href);if(u.username||u.password)return '';
    const canonical=['admiranext.com','www.admiranext.com'].includes(u.hostname)&&u.protocol==='https:'&&!u.port;
    const sameOrigin=u.origin===location.origin;
    if((canonical||sameOrigin)&&/^\/presentaciones\/[^/]+\/media\//.test(u.pathname)){
      const prefix='/presentaciones/'+client+'/media/';
      if(!clientSlug(client)||!u.pathname.startsWith(prefix)||!(/^[a-zA-Z0-9][a-zA-Z0-9._-]*\.(?:webm|mp4|mp3|m4a|ogg|wav|png|jpg|jpeg|webp|gif)$/i.test(u.pathname.slice(prefix.length))))return '';
      // Keep the existing presentation gate: the current origin/proxy owns authorization.
      return u.pathname;
    }
    return u.protocol==='https:'?u.href:'';
  }catch{return '';}
};
function mediaFailure(el,error){
  if(error?.name==='AbortError')return;
  const label=el.dataset.remoteLabel||'Muestra preparada';
  if(error?.name==='NotAllowedError')warn(label+': el navegador requiere pulsar el control de reproducción.');
  else warn(label+': no se ha podido cargar o reproducir la muestra; comprueba el acceso y el formato'+(el.error?.code?' (error multimedia '+el.error.code+')':'')+'.');
}
function playSample(el){if(!el.ended)el.play().catch(error=>mediaFailure(el,error));}

function addMedia(sample,demo,root=$('remote-sample')){
  root.replaceChildren();if(!sample)return;
  for(const item of [sample,...(sample.variantes||[])]){
    const src=safeURL(item.url);if(!src)continue;
    const video=sample.tipo==='video'||/\.(mp4|webm)(?:\?|$)/i.test(src),audio=sample.tipo==='audio';
    const el=document.createElement(audio?'audio':video?'video':'img');el.src=src;el.dataset.remoteLabel=demo.titulo+' ('+demo.clave+')'+(item.nombre?' · '+item.nombre:'');
    el.addEventListener('error',()=>mediaFailure(el));
    if(el.tagName==='IMG')el.alt=item.nombre||'Muestra preparada';else{el.muted=true;el.controls=true;el.preload='metadata';if(video){el.playsInline=true;const poster=safeURL(item.poster);if(poster)el.poster=poster;}}
    if(el.tagName!=='IMG')el.addEventListener('volumechange',()=>{if(sound.muted&&!el.muted)el.muted=true;});
    if(el.tagName!=='IMG')el.addEventListener('play',()=>{if(['running','paused'].includes(runner.snapshot().state))el.pause();});
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
  if(segment.type==='slide'||sampleKey!==segment.demoKey){cleanMedia();$('remote-sample').replaceChildren();$('remote-original-sample').replaceChildren();sampleKey='';demoVideo.hidden=true;$('remote-demo').classList.remove('video-playing');}$('remote-caption').textContent=segment.text;
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
    if(segment.phaseIndex>=samplePhase&&sampleKey!==demo.clave){addMedia(demo.muestra,demo,$('remote-original-sample'));sampleKey=demo.clave;}
    $('remote-original').hidden=!demo.muestra;
    if(segment.phaseIndex===demo.guion.length-1&&prepareVideo(demo))$('remote-sample').append(demoVideo);
  }
}
function narrate(segment,ended,failed){
  let cancelled=false,paused=false,media=null,utterance=null,timer=null,deadline=0,remaining=0,watchdog=null,finishing=false,pausedAt=0,pausedMS=0,waitingClip=false,speechAudible=false,delivered=false;
  const prepared=manifest.get(segment.id),startedAt=Date.now(),demo=project.documentacion.find(d=>d.clave===segment.demoKey);
  const clear=()=>{clearTimeout(timer);clearTimeout(watchdog);};
  const error=message=>{clear();if(!cancelled&&!delivered)failed(message);};
  const deliver=()=>{if(cancelled||delivered)return;delivered=true;clear();soundChanged=null;if(media){media.onended=null;media.onerror=null;}if(utterance){utterance.onend=null;utterance.onerror=null;}ended();};
  const clipDone=()=>{if(cancelled||paused||!demoVideo.ended)return;clear();waitingClip=false;clipActive=false;$('remote-demo').classList.remove('video-playing');demoVideo.onended=null;demoVideo.onerror=null;deliver();};
  const playClip=()=>{
    clear();waitingClip=true;clipActive=true;demoVideo.hidden=false;$('remote-demo').classList.add('video-playing');demoVideo.volume=1;updateSound();
    demoVideo.onended=clipDone;
    demoVideo.onerror=()=>error('Vídeo de '+demo.titulo+': no se ha podido reproducir. Comprueba el acceso o el formato; no se ha completado esta función.');
    watchdog=setTimeout(()=>error('Vídeo de '+demo.titulo+': no ha terminado. Reintenta esta fase; no se ha completado esta función.'),330000);
    if(demoVideo.ended){clipDone();return;}
    const pending=demoVideo.play();pending?.catch(reason=>{if(reason.name!=='AbortError'&&!cancelled)error('Vídeo de '+demo.titulo+': '+(reason.name==='NotAllowedError'?'pulsa Reintentar para autorizar el sonido.':'fallo de acceso o formato. Reintenta esta fase.'));});
  };
  const finish=()=>{
    if(cancelled||paused||delivered||waitingClip)return;clear();
    if(!finishing){
      finishing=true;const voicedMS=prepared&&!timed?prepared.duration*1000:Date.now()-startedAt-pausedMS;
      remaining=Math.max(0,(segment.type==='slide'?4000:2500)-voicedMS);if(remaining>100){schedule();return;}
    }
    if(demo&&segment.phaseIndex===demo.guion.length-1&&videoPorDemo(demo)){
      if(videoReadyKey!==demo.clave)return error('Vídeo de '+demo.titulo+': ruta no válida; no se ha completado esta función.');
      playClip();return;
    }
    deliver();
  };
  const schedule=()=>{deadline=Date.now()+remaining;timer=setTimeout(finish,remaining);};
  const useSpeech=()=>{
    if(!('speechSynthesis' in window)||!window.SpeechSynthesisUtterance)return error('El navegador no dispone de voz. Puedes elegir continuar sin voz.');
    const voices=speechSynthesis.getVoices(),voice=voices.find(v=>v.lang.toLowerCase().startsWith(segment.lang));
    if(!voice)return error('No hay una voz disponible en '+segment.lang+'. Puedes elegir continuar sin voz.');
    utterance=new SpeechSynthesisUtterance(segment.text);utterance.lang=voice.lang;utterance.voice=voice;utterance.rate=1;
    speechAudible=!sound.muted&&sound.narration;utterance.volume=speechAudible?1:0;
    utterance.onend=finish;utterance.onerror=()=>error('La narración del navegador ha fallado. Puedes continuar sin voz.');
    speechSynthesis.cancel();speechSynthesis.speak(utterance);watchdog=setTimeout(()=>error('La narración no ha terminado. Puedes continuar sin voz.'),Math.max(30000,segment.text.length*160));if(paused)speechSynthesis.pause();
  };
  soundChanged=()=>{
    if(utterance&&!finishing&&!waitingClip&&speechAudible!==(!sound.muted&&sound.narration)){
      utterance.onend=null;utterance.onerror=null;speechSynthesis.cancel();clearTimeout(watchdog);useSpeech();
    }
  };
  const begin=()=>{
    if(timed){remaining=Math.max(3500,segment.text.split(' ').length*350);if(!paused)schedule();return;}
    if(prepared){media=narrationAudio;media.src=prepared.url;media.onended=finish;media.onerror=()=>error('No se ha podido reproducir la voz preparada. Puedes continuar sin voz.');watchdog=setTimeout(()=>error('La voz preparada no ha terminado. Puedes continuar sin voz.'),(prepared.duration+30)*1000);updateSound();if(!paused)media.play().catch(()=>error('El navegador ha bloqueado el audio. Pulsa continuar sin voz o vuelve a iniciar.'));}
    else useSpeech();
  };
  begin();
  return {cancel(){cancelled=true;primeGeneration++;clear();soundChanged=null;waitingClip=false;clipActive=false;$('remote-demo').classList.remove('video-playing');demoVideo.onended=null;demoVideo.onerror=null;demoVideo.pause?.();if(media){media.onended=null;media.onerror=null;media.pause();media.removeAttribute('src');media.load();}if(utterance){utterance.onend=null;utterance.onerror=null;speechSynthesis.cancel();}cleanMedia();},
    pause(){paused=true;pausedAt=Date.now();if(timer){remaining=Math.max(0,deadline-Date.now());clearTimeout(timer);timer=null;}if(media)media.pause();if(utterance)speechSynthesis.pause();clearTimeout(watchdog);demoVideo.pause?.();cleanMedia();},
    resume(){paused=false;pausedMS+=Date.now()-pausedAt;if(waitingClip)playClip();else if(timed||finishing)schedule();else if(media){media.play().catch(()=>error('No se ha podido reanudar la voz.'));watchdog=setTimeout(()=>error('La voz no ha terminado.'),600000);}else if(utterance){speechSynthesis.resume();watchdog=setTimeout(()=>error('La voz no ha terminado.'),600000);}}};
}

const runner=createRemoteRunner({show,narrate,changed({state,index,total,message}){
  $('remote-pause').disabled=!['running','paused'].includes(state);$('remote-next').disabled=!['running','paused'].includes(state);$('remote-stop').disabled=!['running','paused','error'].includes(state);$('remote-start').disabled=!plan.length||['running','paused'].includes(state);$('remote-pause').textContent=state==='paused'?'Reanudar':'Pausar';
  $('remote-progress').value=total?index/total*100:0;$('remote-fallback').hidden=state!=='error';$('remote-fallback').textContent=message?.startsWith('Vídeo de ')?'Reintentar fase y vídeo':'Continuar sin voz con avance temporizado';
  for(const id of ['remote-client','remote-lang','remote-load'])$(id).disabled=['running','paused'].includes(state);
  $('remote-status').textContent=message==='playing'?'Presentando · '+(index+1)+' de '+total+' segmentos':message==='paused'?'Presentación en pausa':message==='stopped'?'Presentación detenida':message==='complete'?'Presentación completa terminada':message;
},completed(){cleanMedia();$('remote-record').hidden=false;$('remote-record').scrollIntoView({block:'nearest',behavior:'instant'});}});
function reset(){primeGeneration++;runner.stop();$('remote-record').hidden=true;$('remote-record-status').textContent='';$('remote-fallback').hidden=true;}
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
$('remote-start').addEventListener('click',()=>{reset();timed=false;primeVideo();runner.start(plan);$('remote-status').scrollIntoView({block:'start',behavior:'instant'});});
$('remote-pause').addEventListener('click',()=>runner.snapshot().state==='paused'?runner.resume():runner.pause());
$('remote-stop').addEventListener('click',reset);$('remote-next').addEventListener('click',()=>runner.next());
$('remote-fallback').addEventListener('click',()=>{timed=!$('remote-status').textContent.startsWith('Vídeo de ');if(!timed)primeVideo();runner.fallback();});
$('remote-fullscreen').addEventListener('click',()=>document.getElementById('remota').requestFullscreen?.().catch(()=>{$('remote-status').textContent='La pantalla completa necesita permiso del navegador.';}));
$('remote-record-intent').addEventListener('click',()=>{$('remote-record-status').textContent='Has indicado que quieres preparar el vídeo. No se ha iniciado ninguna grabación; confírmalo a Trinity para preparar el respaldo.';});
$('remote-client').addEventListener('change',()=>{loadToken++;reset();plan=[];$('remote-start').disabled=true;});
window.addEventListener('pagehide',()=>runner.stop());
window.addEventListener('hashchange',()=>{if(location.hash!=='#remota')reset();});
document.addEventListener('visibilitychange',()=>{if(document.hidden)runner.pause();});

$('remote-narration').addEventListener('change',()=>{sound.narration=$('remote-narration').checked;updateSound();});
$('remote-sound').addEventListener('change',()=>{sound.samples=$('remote-sound').checked;updateSound();});
$('remote-mute').addEventListener('click',()=>{sound.muted=!sound.muted;updateSound();});
updateSound();

// Native controls cannot bypass the persistent global mute choice.
for(const el of [narrationAudio,demoVideo])el.addEventListener?.('volumechange',()=>{const silent=sound.muted||(el===narrationAudio?!sound.narration:!sound.samples||el.dataset?.hasAudio==='false');if(silent&&!el.muted)el.muted=true;});
