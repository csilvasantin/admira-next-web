(function () {
  'use strict';
  const data=JSON.parse(document.getElementById('demo-data').textContent),$=id=>document.getElementById(id),demos=data.demos;
  let at=0,step=0,state='idle',timer=null,deadline=0,remaining=0,duration=0,route=[],cursor=0,waitingVideo=false,generation=0,globalMuted=false,phaseSpent=0;
  const audioPrefs={narration:true,samples:true,muted:false};try{const saved=JSON.parse(localStorage.getItem('admira-demo-audio-v1')||'null');for(const k of Object.keys(audioPrefs))if(typeof saved?.[k]==='boolean')audioPrefs[k]=saved[k];}catch(_){}
  $('auto-sound').checked=audioPrefs.samples;globalMuted=audioPrefs.muted;
  const saveSound=()=>{audioPrefs.samples=$('auto-sound').checked;audioPrefs.muted=globalMuted;try{localStorage.setItem('admira-demo-audio-v1',JSON.stringify(audioPrefs));}catch(_){}};
  const now=()=>Date.now(),video=document.createElement('video');
  video.controls=true;video.preload='metadata';video.playsInline=true;video.setAttribute('aria-label','Vídeo de la función seleccionada');$('function-video').append(video);
  const pauseMedia=()=>document.querySelectorAll('audio,video').forEach(el=>el.pause());
  const labels={biz:'admira.biz · Proyecto y negocio',studio:'admira.studio · Creación de contenidos',store:'admira.store · Gestión en tienda'};
  const text=value=>typeof value==='string'?value:value?.texto||value?.text||'Revisar el resultado preparado.';
  function safeURL(value,local){
    if(typeof value!=='string'||!value)return '';
    if(local&&/^media\/[a-z0-9]{16}\.[a-z0-9]{1,7}$/i.test(value||''))return value;
    try{const u=new URL(value,location.href);if(u.username||u.password)return '';const canonical=u.protocol==='https:'&&!u.port&&['admiranext.com','www.admiranext.com'].includes(u.hostname),ownClient=(location.pathname||'').match(/^\/presentaciones\/([a-z0-9][a-z0-9-]{0,79})\//)?.[1];if(local&&(canonical||u.origin===location.origin)&&/^\/presentaciones\/[^/]+\/media\//.test(u.pathname)){const prefix='/presentaciones/'+ownClient+'/media/';return ownClient&&u.pathname.startsWith(prefix)&&/^[a-zA-Z0-9][a-zA-Z0-9._-]*\.(?:mp4|webm|mp3|m4a|ogg|wav|png|jpg|jpeg|webp|gif)$/i.test(u.pathname.slice(prefix.length))?u.pathname:'';}return u.protocol==='https:'&&/^https:\/\//i.test(value)?u.href:'';}catch(_){return '';}
  }
  const fieldLabels={proyecto:'Proyecto',circuito:'Circuito',gemelo:'Gemelo',inventario:'Inventario',dispositivos:'Dispositivos',puntos:'Puntos DooH',vuelo:'Vuelo',inicio:'Inicio',fin:'Fin',franjas:'Franjas',pieza_segundos:'Duración de pieza',frecuencia:'Frecuencia',id:'Identificador',nombre:'Nombre',tipo:'Tipo',marca:'Marca',loc:'Local',circuit:'Circuito',project:'Proyecto',ci:'Elemento ITIL',estado:'Estado',pantallas:'Pantallas',altavoces:'Altavoces',camaras:'Cámaras',totem:'Tótem'};
  function caseFields(value,root){for(const [key,item] of Object.entries(value||{})){if(item&&typeof item==='object'){const group=document.createElement('div');group.className='case-group';const h=document.createElement('h3');h.textContent=Array.isArray(value)?'Elemento '+(Number(key)+1):(fieldLabels[key]||key.replaceAll('_',' '));group.append(h);caseFields(item,group);root.append(group);}else{const p=document.createElement('p');p.textContent=(fieldLabels[key]||key.replaceAll('_',' '))+': '+String(item??'');root.append(p);}}}
  function media(root,sample){
    root.replaceChildren();if(!safeURL(sample?.url,true))return;
    const tag=sample.tipo==='audio'?'audio':sample.tipo==='video'?'video':'img',el=document.createElement(tag);el.src=safeURL(sample.url,true);
    if(tag==='img')el.alt='Creatividad de demostración';else{el.muted=true;el.controls=true;el.preload='metadata';if(tag==='video'){el.playsInline=true;if(safeURL(sample.poster,true))el.poster=safeURL(sample.poster,true);}}
    root.append(el);
    if(sample.variantes?.length){const list=document.createElement('div');list.className='variants';for(const v of sample.variantes){if(!safeURL(v.url,true))continue;const f=document.createElement('figure'),isVideo=sample.tipo==='video'||/\.(mp4|webm)(?:\?|$)/i.test(v.url),el=document.createElement(isVideo?'video':'img'),cap=document.createElement('figcaption');el.src=safeURL(v.url,true);if(isVideo){el.muted=true;el.controls=true;el.preload='metadata';el.playsInline=true;if(safeURL(v.poster,true))el.poster=safeURL(v.poster,true);}else el.alt=v.nombre||v.formato||'Formato adaptado';cap.textContent=(v.nombre||'Formato adaptado')+(v.formato?' · '+v.formato:'');f.append(el,cap);list.append(f);}root.append(list);}
  }
  function applySound(){
    video.muted=globalMuted||!$('auto-sound').checked||demos[at]?.video?.audio===false;
    if(globalMuted)document.querySelectorAll('audio,video').forEach(el=>el.muted=true);
    $('auto-mute').setAttribute('aria-pressed',String(globalMuted));$('auto-mute').textContent=globalMuted?'Activar sonido global':'Silenciar todo';
  }
  function renderStep(){const steps=demos[at].guion;$('step-count').textContent='Paso '+(step+1)+' de '+Math.max(1,steps.length);$('instruction').textContent=text(steps[step]);$('previous-step').disabled=step===0;$('next-step').disabled=step>=steps.length-1;}
  function setVideo(d){
    video.pause();video.onended=null;video.onerror=null;video.ontimeupdate=null;const src=safeURL(d.video?.url,true);
    if(src){if(video.getAttribute?.('src')!==src){video.src=src;video.load?.();}const poster=safeURL(d.video?.poster,true);if(poster)video.poster=poster;else video.removeAttribute('poster');}
    else{video.removeAttribute('src');video.removeAttribute('poster');video.load?.();}
    $('video-description').textContent=d.video?.descripcion||'';$('function-video').hidden=!src;applySound();
  }
  function render(){
    if(!demos.length){$('demo-title').textContent='Este proyecto no tiene subdemos seleccionadas.';$('function-video').hidden=true;for(const id of ['previous-step','next-step','previous-demo','next-demo'])$(id).disabled=true;return;}
    pauseMedia();const d=demos[at];$('demo-select').value=String(at);$('demo-count').textContent='Función '+(at+1)+' de '+demos.length;
    $('platform').textContent=labels[d.clave.split('/')[0]]||'';$('demo-title').textContent=d.titulo;$('demo-description').textContent=d.desc;
    const native=safeURL(d.url,false);$('native').hidden=!native;if(native)$('native').href=native;else $('native').removeAttribute('href');$('sample-caption').textContent=d.muestra?.descripcion||'';media($('sample'),d.muestra);setVideo(d);
    $('sample').hidden=state==='running'||state==='paused';$('sample-caption').hidden=$('sample').hidden;
    $('case').hidden=!d.caso;$('case-fields').replaceChildren();caseFields(d.caso,$('case-fields'));$('case').open=state==='running';$('previous-demo').disabled=at===0;$('next-demo').disabled=at===demos.length-1;renderStep();
    try{history.replaceState(null,'','#'+encodeURIComponent(d.clave));}catch(_){}
  }
  demos.forEach((d,i)=>{const o=document.createElement('option');o.value=i;o.textContent=d.titulo;$('demo-select').append(o);});let initial='';try{initial=decodeURIComponent(location.hash.slice(1));}catch(_){}at=Math.max(0,demos.findIndex(d=>d.clave===initial));
  function cinema(on){const view=$('demo-view');view.className=on?'cinema':'';if(!on)return;const bar=$('director'),height=bar.getBoundingClientRect?.().height||180;view.style?.setProperty('--cinema-bar',height+'px');window.requestAnimationFrame?.(()=>{if(!waitingVideo||!['running','paused'].includes(state))return;const rect=view.getBoundingClientRect();window.scrollTo({top:window.scrollY+rect.top-bar.getBoundingClientRect().height-12,behavior:'smooth'});});}
  function controls(message){const active=['running','paused','error'].includes(state);$('director').className='director'+(active?' active':'');$('auto-start').disabled=!demos.length||['running','paused'].includes(state);$('auto-pause').disabled=!['running','paused'].includes(state);$('auto-pause').textContent=state==='paused'?'Reanudar':'Pausar';$('auto-stop').disabled=!active;$('auto-duration').disabled=active;if(message)$('auto-status').textContent=message;}
  function clearTimer(){if(timer!==null){clearTimeout(timer);timer=null;}}
  function cancel(){cinema(false);clearTimer();generation++;waitingVideo=false;video.onended=null;video.onerror=null;video.ontimeupdate=null;pauseMedia();}
  function takeControl(){if(['running','paused','error'].includes(state)){cancel();state='idle';controls('Control manual · puedes iniciar de nuevo el recorrido completo.');$('sample').hidden=false;$('sample-caption').hidden=false;$('function-video').hidden=!safeURL(demos[at]?.video?.url,true);}}
  $('demo-select').addEventListener('change',()=>{takeControl();at=Number($('demo-select').value);step=0;render();});
  for(const [id,delta] of [['previous-demo',-1],['next-demo',1]])$(id).addEventListener('click',()=>{takeControl();at=Math.max(0,Math.min(demos.length-1,at+delta));step=0;render();$('demo-title').scrollIntoView({block:'start'});});
  for(const [id,delta] of [['previous-step',-1],['next-step',1]])$(id).addEventListener('click',()=>{takeControl();step=Math.max(0,Math.min(demos[at].guion.length-1,step+delta));renderStep();});
  function failVideo(error){if(!['running','paused'].includes(state))return;cancel();state='error';const needsClick=error?.name==='NotAllowedError';$('media-status').textContent=demos[at].titulo+': '+(needsClick?'el navegador ha bloqueado el sonido. Pulsa Iniciar para intentarlo de nuevo.':'no se ha podido reproducir el vídeo. Comprueba el acceso y el formato.');controls('Recorrido detenido por un problema con el vídeo · no se ha avanzado a la siguiente función.');}
  function playVideo(){applySound();controls('En marcha · '+labels[demos[at].clave.split('/')[0]]+' · reproduciendo el vídeo completo de '+demos[at].titulo);cinema(true);try{const token=generation,p=video.play();p?.catch?.(error=>{if(token===generation&&waitingVideo&&error?.name!=='AbortError')failVideo(error);});}catch(error){failVideo(error);}}
  function nextAutomatic(){if(state!=='running')return;cinema(false);clearTimer();generation++;waitingVideo=false;video.onended=null;video.onerror=null;video.ontimeupdate=null;cursor++;$('auto-progress').value=cursor/route.length*100;if(cursor===route.length){state='complete';pauseMedia();controls('Recorrido completo · '+demos.length+' funciones presentadas.');return;}remaining=duration/route.length;phaseSpent=0;showAutomatic();}
  function startVideo(){
    clearTimer();waitingVideo=true;const token=++generation,src=safeURL(demos[at].video?.url,true);if(!src){failVideo();return;}
    video.currentTime=0;video.ontimeupdate=()=>{if(token===generation&&waitingVideo&&state==='running'&&Number.isFinite(video.duration)&&video.duration>0)$('auto-progress').value=(cursor+Math.min(.99,video.currentTime/video.duration))/route.length*100;};video.onended=()=>{if(token===generation&&waitingVideo&&state==='running'&&video.ended)nextAutomatic();};video.onerror=()=>{if(token===generation&&waitingVideo&&video.error)failVideo();};controls('En marcha · '+labels[demos[at].clave.split('/')[0]]+' · reproduciendo el vídeo completo de '+demos[at].titulo);playVideo();
  }
  function showAutomatic(){const next=route[cursor],changed=at!==next.at;at=next.at;step=next.step;if(changed||cursor===0){$('media-status').textContent='';render();}else renderStep();$('case').open=!!demos[at].caso;$('sample').hidden=true;$('sample-caption').hidden=true;const final=step===Math.max(0,demos[at].guion.length-1);$('function-video').hidden=!final;if(final)startVideo();else{deadline=now()+remaining;tick();}if(!final)$('demo-title').scrollIntoView({block:'center',behavior:'smooth'});}
  function tick(){if(state!=='running'||waitingVideo)return;const left=Math.max(0,deadline-now());$('auto-progress').value=(cursor+(phaseSpent+remaining-left)/(duration/route.length))/route.length*100;controls('En marcha · '+labels[demos[at].clave.split('/')[0]]+' · paso '+(step+1)+' · vídeo en '+Math.ceil(left/1000)+' s');if(left>0){timer=setTimeout(tick,Math.min(250,left));return;}nextAutomatic();}
  function start(){
    if(!demos.length)return;cancel();route=[];const order={biz:0,studio:1,store:2};demos.map((d,index)=>({d,index})).sort((a,b)=>(order[a.d.clave.split('/')[0]]??3)-(order[b.d.clave.split('/')[0]]??3)||a.index-b.index).forEach(({d,index})=>{for(let n=0;n<Math.max(1,d.guion.length);n++)route.push({at:index,step:n});});const minutes=Number($('auto-duration').value);duration=([5,8,12].includes(minutes)?minutes:8)*60000;state='running';cursor=0;remaining=duration/route.length;phaseSpent=0;$('auto-progress').value=0;showAutomatic();
    // The explicit start gesture primes the same native element for later audible clips.
    if(!waitingVideo&&safeURL(demos[at].video?.url,true)){const token=generation;video.volume=0;try{const p=video.play();p?.then?.(()=>{if(token===generation&&!waitingVideo){video.pause();video.currentTime=0;}video.volume=1;},()=>{video.volume=1;});}catch(_){video.volume=1;}}
  }
  function togglePause(){if(state==='running'){if(!waitingVideo){const left=Math.max(0,deadline-now());phaseSpent+=remaining-left;remaining=left;}clearTimer();state='paused';pauseMedia();controls('En pausa · reanuda cuando quieras continuar.');}else if(state==='paused'){state='running';if(waitingVideo){if(video.ended)nextAutomatic();else playVideo();}else{deadline=now()+remaining;tick();}}}
  function stop(){cancel();state='idle';controls('Detenido · puedes reiniciar el recorrido o elegir una función.');$('sample').hidden=false;$('sample-caption').hidden=false;$('function-video').hidden=!safeURL(demos[at]?.video?.url,true);}
  $('auto-start').addEventListener('click',start);$('auto-pause').addEventListener('click',togglePause);$('auto-stop').addEventListener('click',stop);
  $('auto-sound').addEventListener('change',()=>{applySound();saveSound();});$('auto-mute').addEventListener('click',()=>{globalMuted=!globalMuted;applySound();saveSound();});
  document.addEventListener?.('volumechange',()=>{if(globalMuted)document.querySelectorAll('audio,video').forEach(el=>{if(!el.muted)el.muted=true;});},true);
  document.addEventListener?.('keydown',e=>{if(e.key==='Escape'){stop();return;}if(/^(INPUT|SELECT|TEXTAREA)$/.test(e.target?.tagName)||e.target?.isContentEditable||e.ctrlKey||e.metaKey||e.altKey)return;if(e.target?.tagName==='BUTTON'&&!['auto-start','auto-pause'].includes(e.target.id))return;if(e.code==='Space'&&['running','paused'].includes(state)){e.preventDefault();togglePause();}});
  document.addEventListener?.('visibilitychange',()=>{if(document.hidden&&state==='running')togglePause();});window.addEventListener?.('pagehide',stop);
  render();controls();applySound();
})();
