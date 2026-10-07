(function () {
  'use strict';
  const data = JSON.parse(document.getElementById('demo-data').textContent);
  const $ = id => document.getElementById(id), demos = data.demos;
  let at = 0, step = 0;
  let state = 'idle', timer = null, deadline = 0, remaining = 0, elapsed = 0, duration = 0, route = [], cursor = 0, played = [];
  const now = () => Date.now();
  const pauseMedia = () => document.querySelectorAll('audio,video').forEach(el => el.pause());
  const labels = {biz:'admira.biz · Proyecto y negocio',studio:'admira.studio · Creación de contenidos',store:'admira.store · Gestión en tienda'};
  const text = value => typeof value === 'string' ? value : value?.texto || value?.text || 'Revisar el resultado preparado.';
  function safeURL(value, local) {
    if(local && /^media\/[a-z0-9]{16}\.[a-z0-9]{1,7}$/i.test(value || ''))return value;
    try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:'';}catch(_){return '';}
  }
  const fieldLabels = {proyecto:'Proyecto',circuito:'Circuito',gemelo:'Gemelo',inventario:'Inventario',dispositivos:'Dispositivos',puntos:'Puntos DooH',vuelo:'Vuelo',inicio:'Inicio',fin:'Fin',franjas:'Franjas',pieza_segundos:'Duración de pieza',frecuencia:'Frecuencia',id:'Identificador',nombre:'Nombre',tipo:'Tipo',marca:'Marca',loc:'Local',circuit:'Circuito',project:'Proyecto',ci:'Elemento ITIL',estado:'Estado',pantallas:'Pantallas',altavoces:'Altavoces',camaras:'Cámaras',totem:'Tótem'};
  function caseFields(value, root) {
    for (const [key, item] of Object.entries(value || {})) {
      if (item && typeof item === 'object') {
        const group = document.createElement('div');group.className='case-group';
        const h=document.createElement('h3');h.textContent=Array.isArray(value)?'Elemento '+(Number(key)+1):(fieldLabels[key]||key.replaceAll('_',' '));group.append(h);caseFields(item,group);root.append(group);
      } else { const p=document.createElement('p');p.textContent=(fieldLabels[key]||key.replaceAll('_',' '))+': '+String(item??'');root.append(p); }
    }
  }
  function media(root, sample) {
    root.replaceChildren();if(!safeURL(sample?.url,true))return;
    const tag = sample.tipo === 'audio' ? 'audio' : sample.tipo === 'video' ? 'video' : 'img';
    const el=document.createElement(tag);el.src=safeURL(sample.url,true);
    if(tag==='img')el.alt='Creatividad de demostración';else {el.controls=true;el.preload='metadata';if(tag==='video'){el.playsInline=true;if(safeURL(sample.poster,true))el.poster=safeURL(sample.poster,true);}}
    root.append(el);
    if(sample.variantes?.length){const list=document.createElement('div');list.className='variants';for(const v of sample.variantes){if(!safeURL(v.url,true))continue;const f=document.createElement('figure'),isVideo=sample.tipo==='video'||/\.(mp4|webm)(?:\?|$)/i.test(v.url),el=document.createElement(isVideo?'video':'img'),cap=document.createElement('figcaption');el.src=safeURL(v.url,true);if(isVideo){el.controls=true;el.preload='metadata';el.playsInline=true;if(safeURL(v.poster,true))el.poster=safeURL(v.poster,true);}else el.alt=v.nombre||v.formato||'Formato adaptado';cap.textContent=(v.nombre||'Formato adaptado')+(v.formato?' · '+v.formato:'');f.append(el,cap);list.append(f);}root.append(list);}
  }
  function renderStep() {
    const steps=demos[at].guion;
    if(state==='running')$('demo-count').textContent='Función '+new Set(route.slice(0,cursor+1).map(item=>item.at)).size+' de '+demos.length;
    $('step-count').textContent='Paso '+(step+1)+' de '+Math.max(1,steps.length);
    $('instruction').textContent=text(steps[step]);$('previous-step').disabled=step===0;$('next-step').disabled=step>=steps.length-1;
  }
  function render() {
    if(!demos.length){$('demo-title').textContent='Este proyecto no tiene subdemos seleccionadas.';for(const id of ['previous-step','next-step','previous-demo','next-demo'])$(id).disabled=true;return;}
    document.querySelectorAll('audio,video').forEach(el=>el.pause());const d=demos[at];
    $('demo-select').value=String(at);$('demo-count').textContent='Función '+(at+1)+' de '+demos.length;
    $('platform').textContent=labels[d.clave.split('/')[0]]||'';$('demo-title').textContent=d.titulo;$('demo-description').textContent=d.desc;
    const native=safeURL(d.url,false);$('native').hidden=!native;if(native)$('native').href=native;else $('native').removeAttribute('href');$('sample-caption').textContent=d.muestra?.descripcion||'';media($('sample'),d.muestra);
    $('case').hidden=!d.caso;$('case-fields').replaceChildren();caseFields(d.caso,$('case-fields'));$('case').open=state==='running';
    $('previous-demo').disabled=at===0;$('next-demo').disabled=at===demos.length-1;renderStep();
    try{history.replaceState(null,'','#'+encodeURIComponent(d.clave));}catch(_){}
  }
  demos.forEach((d,i)=>{const o=document.createElement('option');o.value=i;o.textContent=d.titulo;$('demo-select').append(o);});
  let initial='';try{initial=decodeURIComponent(location.hash.slice(1));}catch(_){}at=Math.max(0,demos.findIndex(d=>d.clave===initial));
  $('demo-select').addEventListener('change',()=>{takeControl();at=Number($('demo-select').value);step=0;render();});
  for(const [id,delta] of [['previous-demo',-1],['next-demo',1]])$(id).addEventListener('click',()=>{takeControl();at=Math.max(0,Math.min(demos.length-1,at+delta));step=0;render();$('demo-title').scrollIntoView({block:'start'});});
  for(const [id,delta] of [['previous-step',-1],['next-step',1]])$(id).addEventListener('click',()=>{takeControl();step=Math.max(0,Math.min(demos[at].guion.length-1,step+delta));renderStep();});
  function controls(message) {
    $('director').className='director'+(['running','paused'].includes(state)?' active':'');
    $('auto-start').disabled=!demos.length||state==='running'||state==='paused';
    $('auto-pause').disabled=!['running','paused'].includes(state);
    $('auto-pause').textContent=state==='paused'?'Reanudar':'Pausar';
    $('auto-stop').disabled=!['running','paused'].includes(state);
    $('auto-duration').disabled=['running','paused'].includes(state);
    if(message)$('auto-status').textContent=message;
  }
  function clearTimer(){if(timer!==null){clearTimeout(timer);timer=null;}}
  function takeControl(){if(['running','paused'].includes(state)){clearTimer();state='idle';pauseMedia();played=[];controls('Control manual · puedes iniciar de nuevo el recorrido completo.');}}
  function playSamples(){
    if(state!=='running'||step<(demos[at].clave.startsWith('studio/')?Math.max(0,demos[at].guion.length-1):Math.min(1,Math.max(0,demos[at].guion.length-1))))return;
    document.querySelectorAll('audio,video').forEach(el=>{
      el.muted=!$('auto-sound').checked||Boolean(el.closest?.('.variants'));
      if(played.includes(el))return;played.push(el);
      try{const pending=el.play();if(pending?.catch)pending.catch(()=>{
        if(state==='running')$('media-status').textContent='Esta muestra necesita un clic en su control de reproducción.';
      });}catch(_){};
    });
  }
  function showAutomatic(){
    const next=route[cursor],changed=at!==next.at;
    at=next.at;step=next.step;
    if(changed||cursor===0){played=[];$('media-status').textContent='';render();}else renderStep();
    $('case').open=!!demos[at].caso;
    playSamples();$('demo-title').scrollIntoView({block:'center',behavior:'smooth'});
  }
  function tick(){
    if(state!=='running')return;
    const left=Math.max(0,deadline-now());
    $('auto-progress').value=Math.min(100,(elapsed+remaining-left)/duration*100);
    controls('En marcha · '+labels[demos[at].clave.split('/')[0]]+' · paso '+(step+1)+' · siguiente en '+Math.ceil(left/1000)+' s');
    if(left>0){timer=setTimeout(tick,Math.min(250,left));return;}
    elapsed+=remaining;cursor++;
    if(cursor===route.length){state='complete';pauseMedia();$('auto-progress').value=100;controls('Recorrido completo · '+demos.length+' funciones presentadas.');return;}
    remaining=duration/route.length;deadline=now()+remaining;showAutomatic();tick();
  }
  function start(){
    if(!demos.length)return;clearTimer();pauseMedia();
    route=[];const order={biz:0,studio:1,store:2};
    demos.map((d,index)=>({d,index})).sort((a,b)=>(order[a.d.clave.split('/')[0]]??3)-(order[b.d.clave.split('/')[0]]??3)||a.index-b.index).forEach(({d,index})=>{
      for(let n=0;n<Math.max(1,d.guion.length);n++)route.push({at:index,step:n});
    });
    const minutes=Number($('auto-duration').value);duration=([5,8,12].includes(minutes)?minutes:8)*60000;
    state='running';cursor=0;elapsed=0;remaining=duration/route.length;deadline=now()+remaining;
    showAutomatic();tick();
  }
  function togglePause(){
    if(state==='running'){const left=Math.max(0,deadline-now());elapsed+=remaining-left;remaining=left;clearTimer();state='paused';pauseMedia();controls('En pausa · reanuda cuando quieras continuar.');}
    else if(state==='paused'){state='running';deadline=now()+remaining;played=[];playSamples();tick();}
  }
  function stop(){clearTimer();state='idle';pauseMedia();played=[];controls('Detenido · puedes reiniciar el recorrido o elegir una función.');}
  $('auto-start').addEventListener('click',start);
  $('auto-pause').addEventListener('click',togglePause);
  $('auto-stop').addEventListener('click',stop);
  $('auto-sound').addEventListener('change',()=>document.querySelectorAll('audio,video').forEach(el=>el.muted=!$('auto-sound').checked||Boolean(el.closest?.('.variants'))));
  document.addEventListener?.('keydown',e=>{
    if(e.key==='Escape'){stop();return;}
    if(/^(INPUT|SELECT|TEXTAREA)$/.test(e.target?.tagName)||e.target?.isContentEditable||e.ctrlKey||e.metaKey||e.altKey)return;
    if(e.target?.tagName==='BUTTON'&&!['auto-start','auto-pause'].includes(e.target.id))return;
    if(e.code==='Space'&&['running','paused'].includes(state)){e.preventDefault();togglePause();}
  });
  document.addEventListener?.('visibilitychange',()=>{if(document.hidden&&state==='running')togglePause();});
  window.addEventListener?.('pagehide',stop);
  render();controls();
})();
