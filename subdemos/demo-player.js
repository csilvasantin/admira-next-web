(function () {
  'use strict';
  const data = JSON.parse(document.getElementById('demo-data').textContent);
  const $ = id => document.getElementById(id), demos = data.demos;
  let at = 0, step = 0;
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
    const steps=demos[at].guion;$('step-count').textContent='Paso '+(step+1)+' de '+Math.max(1,steps.length);
    $('instruction').textContent=text(steps[step]);$('previous-step').disabled=step===0;$('next-step').disabled=step>=steps.length-1;
  }
  function render() {
    if(!demos.length){$('demo-title').textContent='Este proyecto no tiene subdemos seleccionadas.';for(const id of ['previous-step','next-step','previous-demo','next-demo'])$(id).disabled=true;return;}
    document.querySelectorAll('audio,video').forEach(el=>el.pause());const d=demos[at];
    $('demo-select').value=String(at);$('demo-count').textContent='Función '+(at+1)+' de '+demos.length;
    $('platform').textContent=labels[d.clave.split('/')[0]]||'';$('demo-title').textContent=d.titulo;$('demo-description').textContent=d.desc;
    const native=safeURL(d.url,false);$('native').hidden=!native;if(native)$('native').href=native;else $('native').removeAttribute('href');$('sample-caption').textContent=d.muestra?.descripcion||'';media($('sample'),d.muestra);
    $('case').hidden=!d.caso;$('case-fields').replaceChildren();caseFields(d.caso,$('case-fields'));$('case').open=false;
    $('previous-demo').disabled=at===0;$('next-demo').disabled=at===demos.length-1;renderStep();
    try{history.replaceState(null,'','#'+encodeURIComponent(d.clave));}catch(_){}
  }
  demos.forEach((d,i)=>{const o=document.createElement('option');o.value=i;o.textContent=(i+1)+'. '+d.titulo;$('demo-select').append(o);});
  let initial='';try{initial=decodeURIComponent(location.hash.slice(1));}catch(_){}at=Math.max(0,demos.findIndex(d=>d.clave===initial));
  $('demo-select').addEventListener('change',()=>{at=Number($('demo-select').value);step=0;render();});
  for(const [id,delta] of [['previous-demo',-1],['next-demo',1]])$(id).addEventListener('click',()=>{at=Math.max(0,Math.min(demos.length-1,at+delta));step=0;render();$('demo-title').scrollIntoView({block:'start'});});
  for(const [id,delta] of [['previous-step',-1],['next-step',1]])$(id).addEventListener('click',()=>{step=Math.max(0,Math.min(demos[at].guion.length-1,step+delta));renderStep();});
  render();
})();
