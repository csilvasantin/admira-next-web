(function(){
  'use strict';
  window.__ADMIRA_GENERATOR_VERSION__='20260719-4';
  document.querySelector('.output-panel')?.remove();
  const form=document.getElementById('generator'),status=document.getElementById('status'),submit=document.getElementById('submit'),result=document.getElementById('result');
  const display=document.getElementById('displayName'),slug=document.getElementById('slug'),website=document.getElementById('website'),passwordInput=document.getElementById('password'); let slugTouched=true,inspirationAnalysis=null,currentGeneration=null,currentGenerationUrl='',currentClient='',currentImageSet=null;
  website.required=true;website.type='text';website.inputMode='url';website.closest('.field')?.querySelector('label')?.append(' · logo obligatorio');
  const DEFAULT_PRESENTATION_PASSWORD='AdmiraNeXT;)';
  const inspirationStep=document.querySelector('.flow span:nth-child(2)'); if(inspirationStep)inspirationStep.innerHTML='<b>02</b> Inspiración';
  const thesisPanel=form.querySelectorAll('.panel')[1],thesisGrid=thesisPanel.querySelector('.grid'); thesisPanel.querySelector('h2').textContent='2. Inspiración e identidad'; thesisPanel.querySelector('.sub').textContent='La web oficial aporta la identidad y el logo. Si indicas otra inspiración, solo sustituye la dirección de arte.';
  const inspirationField=document.createElement('div'); inspirationField.className='field full inspiration-field';
  inspirationField.innerHTML='<label for="inspirationUrl">Web inspiradora · opcional</label><div class="inspiration-input"><input id="inspirationUrl" name="inspirationUrl" type="text" inputmode="url" placeholder="Vacío = web oficial del cliente"><button class="btn" id="analyzeInspiration" type="button">Analizar identidad</button></div><p class="field-help">Puedes escribir solo el dominio: añadiremos https:// automáticamente. Si se deja vacío, usamos la web oficial como inspiración. El logo del cliente siempre se detecta allí, se guarda y aparece en toda la presentación.</p><div class="inspiration-preview" id="inspirationPreview" hidden><div class="inspiration-palette" id="inspirationPalette"></div><div><b id="inspirationTitle">Dirección visual</b><span id="inspirationTraits"></span></div></div>';
  thesisGrid.prepend(inspirationField);
  const inspirationStyle=document.createElement('style'); inspirationStyle.textContent='.inspiration-input{display:grid;grid-template-columns:1fr auto;gap:9px}.inspiration-input .btn{white-space:nowrap}.field-help{margin:9px 0 0;color:var(--mut);font-size:12px}.inspiration-preview{margin-top:14px;display:flex;align-items:center;gap:14px;border:1px solid var(--line);border-radius:13px;padding:14px;background:#08111e}.inspiration-preview[hidden]{display:none}.inspiration-preview b,.inspiration-preview span{display:block}.inspiration-preview b{font-size:14px}.inspiration-preview span{margin-top:4px;color:var(--mut);font:700 10px/1.45 var(--mono);text-transform:uppercase;letter-spacing:.05em}.inspiration-palette{display:flex;flex:none}.inspiration-palette i{width:25px;height:42px;border:2px solid #08111e;margin-left:-5px}.inspiration-palette i:first-child{margin-left:0;border-radius:9px 0 0 9px}.inspiration-palette i:last-child{border-radius:0 9px 9px 0}@media(max-width:680px){.inspiration-input{grid-template-columns:1fr}.inspiration-input .btn{width:100%}}'; document.head.appendChild(inspirationStyle);
  const overwriteStyle=document.createElement('style'); overwriteStyle.textContent='.overwrite-dialog{width:min(540px,calc(100% - 28px));border:1px solid var(--line);border-radius:20px;padding:0;background:linear-gradient(145deg,var(--panel),var(--panel2));color:var(--ink);box-shadow:0 28px 90px rgba(0,0,0,.55)}.overwrite-dialog::backdrop{background:rgba(2,6,12,.78);backdrop-filter:blur(5px)}.overwrite-body{padding:28px}.overwrite-kicker{color:#f5a623;font:800 10px/1 var(--mono);letter-spacing:.12em;text-transform:uppercase}.overwrite-dialog h2{font-size:25px;line-height:1.15;margin:14px 0 10px}.overwrite-dialog p{color:var(--mut);font-size:14px;margin:0}.overwrite-target{display:block;margin-top:17px;border:1px solid var(--line);border-radius:10px;padding:11px 13px;color:var(--ink);background:#07101c;font:700 11px/1.4 var(--mono);overflow-wrap:anywhere}.overwrite-warning{margin-top:14px!important;color:#ffbf70!important}.overwrite-actions{display:flex;justify-content:flex-end;gap:9px;margin-top:24px}.overwrite-actions .danger{background:#ff6b6b;border-color:#ff6b6b;color:#240707}@media(max-width:560px){.overwrite-actions{flex-direction:column-reverse}.overwrite-actions .btn{width:100%}}'; document.head.appendChild(overwriteStyle);
  const overwriteDialog=document.createElement('dialog'); overwriteDialog.className='overwrite-dialog'; overwriteDialog.innerHTML='<div class="overwrite-body"><div class="overwrite-kicker">Presentación existente</div><h2>¿Crear otra presentación sobre la actual?</h2><p>Este identificador ya está en uso. Si continúas, reemplazaremos el esqueleto, el site y la nueva orden de producción.</p><code class="overwrite-target" id="overwriteTarget"></code><p class="overwrite-warning">Se aplicará la contraseña indicada o, si está vacía, la resuelta desde el portapapeles (*).</p><div class="overwrite-actions"><button class="btn" type="button" id="overwriteCancel">No, volver</button><button class="btn danger" type="button" id="overwriteConfirm">Sí, crear sobre la existente</button></div></div>'; document.body.appendChild(overwriteDialog);
  const inspirationUrl=document.getElementById('inspirationUrl'),analyzeButton=document.getElementById('analyzeInspiration');
  const languagePanel=document.createElement('section'); languagePanel.className='panel language-panel';
  languagePanel.innerHTML='<h2>4. Idiomas</h2><p class="sub">Selecciona las versiones del site. Después podrás editar cada idioma por separado.</p><div class="language-grid"><label class="language"><input type="checkbox" name="language" value="es" checked><b>ES</b><span>Castellano</span></label><label class="language"><input type="checkbox" name="language" value="ca" checked><b>CA</b><span>Català</span></label><label class="language"><input type="checkbox" name="language" value="en" checked><b>EN</b><span>English</span></label></div>';
  const outputPanel=document.createElement('section'); outputPanel.className='panel output-panel';
  outputPanel.innerHTML='<h2>5. ¿Qué queremos obtener?</h2><p class="sub">Por defecto se crean la presentación/website y el documento de trabajo. Activa otros formatos solo cuando los necesites.</p><div class="output-grid"><label class="output"><input type="checkbox" name="output" value="website" checked><b>01</b><span>Website</span></label><label class="output"><input type="checkbox" name="output" value="audio"><b>02</b><span>Audio</span></label><label class="output"><input type="checkbox" name="output" value="video"><b>03</b><span>Vídeo</span></label><label class="output"><input type="checkbox" name="output" value="pdf"><b>04</b><span>PDF</span></label><label class="output"><input type="checkbox" name="output" value="powerpoint"><b>05</b><span>PowerPoint</span></label><label class="output"><input type="checkbox" name="output" value="documents" checked><b>06</b><span>Documento de trabajo</span></label><label class="output"><input type="checkbox" name="output" value="infographic"><b>07</b><span>Infografía</span></label><label class="output all"><input type="checkbox" id="allOutputs"><b>08</b><span>Todo</span></label></div>';
  form.insertBefore(languagePanel,status); form.insertBefore(outputPanel,status);
  const style=document.createElement('style');style.textContent='.language-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.language{display:flex;align-items:center;gap:11px;border:1px solid var(--line);border-radius:12px;padding:16px;background:#08111e;color:var(--ink);cursor:pointer;text-transform:none;letter-spacing:0;margin:0}.language:has(input:checked){border-color:var(--green);background:rgba(61,240,138,.07)}.language input{width:auto;margin:0;accent-color:var(--green)}.language b{font:800 11px/1 var(--mono);color:var(--green)}.language span{font:700 14px/1.25 var(--sans)}.output-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.output{display:flex;align-items:center;gap:11px;border:1px solid var(--line);border-radius:12px;padding:14px;background:#08111e;color:var(--ink);cursor:pointer;text-transform:none;letter-spacing:0;margin:0}.output:has(input:checked){border-color:var(--green);background:rgba(61,240,138,.07)}.output input{width:auto;margin:0;accent-color:var(--green)}.output b{font:800 10px/1 var(--mono);color:var(--green)}.output span{font:700 14px/1.25 var(--sans)}.output.all{border-style:dashed}.created-matrix{margin:22px 0 0;display:grid;gap:12px}.created-language{border-top:1px solid var(--line);padding-top:12px}.created-language h3{margin:0 0 8px;font:800 10px/1 var(--mono);letter-spacing:.1em;color:var(--mut);text-transform:uppercase}.created-tasks{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}.created-task{display:grid;gap:7px;background:#08111e;border:1px solid var(--line);border-radius:9px;padding:9px 10px;font:700 10px/1.25 var(--mono)}.created-task small{color:#72a7ff;line-height:1.35}.created-task.queued small{color:#f5a623}.created-task.ready small,.created-task.published small,.created-task.complete small{color:var(--green)}.created-task.failed small,.created-task.skipped small{color:var(--red)}@media(max-width:680px){.language-grid,.output-grid,.created-tasks{grid-template-columns:1fr}}';document.head.appendChild(style);
  const createdMatrix=document.createElement('div');createdMatrix.className='created-matrix';createdMatrix.id='createdMatrix';document.querySelector('.result-links').before(createdMatrix);
  const imageAction=document.createElement('button');imageAction.className='btn';imageAction.type='button';imageAction.id='createImages';imageAction.hidden=true;imageAction.textContent='Crear imágenes con Grok';document.querySelector('.result-links').appendChild(imageAction);
  const imageWorkspace=document.createElement('section');imageWorkspace.className='image-workspace';imageWorkspace.id='imageWorkspace';imageWorkspace.hidden=true;createdMatrix.after(imageWorkspace);
  const imageStyle=document.createElement('style');imageStyle.textContent='.image-workspace{margin:20px 0;border-top:1px solid var(--line);padding-top:18px}.image-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:13px}.image-head h3{margin:0;font-size:16px}.image-head p{margin:5px 0 0;color:var(--mut);font-size:12px}.image-progress{color:var(--green);font:800 10px/1.4 var(--mono);white-space:nowrap}.image-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.image-card{overflow:hidden;border:1px solid var(--line);border-radius:11px;background:#08111e}.image-card img{display:block;width:100%;aspect-ratio:16/9;object-fit:cover}.image-card .placeholder{display:grid;place-items:center;aspect-ratio:16/9;color:var(--mut);background:linear-gradient(135deg,#0b1726,#08111e);font:800 10px/1 var(--mono)}.image-card span{display:flex;gap:8px;padding:9px 10px;color:var(--mut);font:700 10px/1.35 var(--mono)}.image-card b{color:var(--green)}.image-card.failed{border-color:rgba(255,107,107,.55)}.image-note{margin:12px 0 0;color:var(--mut);font-size:11px}@media(max-width:680px){.image-grid{grid-template-columns:1fr}.image-head{display:block}.image-progress{display:block;margin-top:8px}}';document.head.appendChild(imageStyle);
  const monitorStyle=document.createElement('style');monitorStyle.textContent='.provider-monitor{margin:0 0 16px;border:1px solid var(--line);border-radius:13px;padding:14px;background:#08111e}.provider-monitor.stalled{border-color:#ffbf70}.monitor-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.monitor-head b{font-size:13px}.monitor-state{color:var(--green);font:800 10px/1.3 var(--mono);text-align:right}.provider-monitor.stalled .monitor-state{color:#ffbf70}.progress-track{height:10px;margin:11px 0 9px;overflow:hidden;border:1px solid var(--line);border-radius:999px;background:#050b13}.progress-fill{display:block;height:100%;min-width:0;background:linear-gradient(90deg,var(--blue),var(--green));transition:width .35s}.progress-meta{display:flex;flex-wrap:wrap;gap:6px 14px;color:var(--mut);font:700 9px/1.45 var(--mono)}.progress-meta strong{color:var(--ink)}.task-meter{grid-column:1/-1;height:4px;overflow:hidden;border-radius:99px;background:#050b13}.task-meter i{display:block;height:100%;background:var(--green)}.image-quick-action{margin-top:12px}.image-card .placeholder.processing{color:#72a7ff}.image-card .placeholder.stalled{color:#ffbf70}@media(max-width:680px){.monitor-head{align-items:flex-start}.progress-meta{display:grid;gap:4px}}';document.head.appendChild(monitorStyle);
  const outputBoxes=[...outputPanel.querySelectorAll('input[name="output"]')],allOutputs=document.getElementById('allOutputs');
  allOutputs.addEventListener('change',()=>outputBoxes.forEach(box=>{box.checked=allOutputs.checked}));
  outputBoxes.forEach(box=>box.addEventListener('change',()=>{allOutputs.checked=outputBoxes.every(item=>item.checked)}));
  const passwordPanel=passwordInput.closest('.panel');
  passwordPanel.querySelector('.sub').textContent='La clave queda aislada para este cliente. Si indicas una contraseña aquí, tendrá prioridad.';
  passwordInput.closest('.field').querySelector('label').textContent='Contraseña del cliente · opcional *';
  passwordInput.placeholder='Vacío = usar el portapapeles';
  passwordInput.closest('.field').insertAdjacentHTML('beforeend',`<p class="field-help">* Si lo dejas vacío, al generar intentaremos usar el texto actual del portapapeles. Si está vacío, es demasiado corto o el navegador no permite leerlo, usaremos <b>${DEFAULT_PRESENTATION_PASSWORD}</b>: débil, pero entrañable ;p</p>`);
  function slugify(value){return String(value||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,63)}
  function ensureHttps(value){const cleaned=String(value||'').trim();if(!cleaned)return '';if(/^https:\/\//i.test(cleaned))return cleaned;if(/^http:\/\//i.test(cleaned))return `https://${cleaned.slice(7)}`;if(/^[a-z][a-z0-9+.-]*:\/\//i.test(cleaned))return cleaned;return `https://${cleaned.replace(/^\/+/, '')}`}
  function normalizeUrlInput(input){const normalized=ensureHttps(input.value);if(normalized)input.value=normalized;return normalized}
  async function resolvePassword(){
    const explicit=passwordInput.value.trim();if(explicit)return explicit;
    try{const clipboard=String(await navigator.clipboard?.readText?.()||'').replace(/[\r\n]+/g,' ').trim().slice(0,100);if(clipboard.length>=10)return clipboard}catch(_){}
    return DEFAULT_PRESENTATION_PASSWORD;
  }
  [website,inspirationUrl].forEach(input=>input.addEventListener('blur',()=>normalizeUrlInput(input)));
  slug.addEventListener('input',()=>{slugTouched=Boolean(slug.value)}); display.addEventListener('input',()=>{if(!slugTouched)slug.value=slugify(display.value)});
  function message(value,error){status.textContent=value;status.className=`status${error?' error':''}`}
  function confirmOverwrite(targetSlug){
    const target=`${location.origin}/presentaciones/${targetSlug}/`;
    if(typeof overwriteDialog.showModal!=='function') return Promise.resolve(window.confirm(`Ya existe ${target}. ¿Quieres crear otra presentación sobre la existente?`));
    document.getElementById('overwriteTarget').textContent=target;
    return new Promise(resolve=>{
      let settled=false;
      const finish=value=>{if(settled)return;settled=true;overwriteDialog.close();resolve(value)};
      document.getElementById('overwriteCancel').onclick=()=>finish(false);
      document.getElementById('overwriteConfirm').onclick=()=>finish(true);
      overwriteDialog.oncancel=event=>{event.preventDefault();finish(false)};
      overwriteDialog.showModal();
    });
  }
  async function createPresentation(data,overwrite=false){
    const response=await fetch('/presentaciones/api/generate',{method:'PUT',headers:{'content-type':'application/json','accept':'application/json'},body:JSON.stringify({...data,overwrite})});
    const body=await response.json().catch(()=>({}));
    if(response.status===409&&body.exists&&!overwrite){
      const confirmed=await confirmOverwrite(body.slug||data.slug);
      if(!confirmed)return null;
      message('Creando una nueva presentación sobre la existente…');
      return createPresentation(data,true);
    }
    if(!response.ok)throw new Error(body.error||`HTTP ${response.status}`);
    return body;
  }
  function renderInspiration(inspiration){
    const preview=document.getElementById('inspirationPreview'); if(!inspiration){preview.hidden=true;return}
    document.getElementById('inspirationPalette').innerHTML=(inspiration.palette||[]).slice(0,5).map(color=>`<i style="background:${color}" title="${color}"></i>`).join('');
    document.getElementById('inspirationTitle').textContent=inspiration.title||inspiration.host||'Dirección visual';
    document.getElementById('inspirationTraits').textContent=[inspiration.profile,inspiration.mode,inspiration.fontStyle,inspiration.radiusStyle,inspiration.density,inspiration.layout,!inspirationUrl.value.trim()?(inspiration.logo?'logo oficial detectado':'logo por verificar'):'referencia estética externa'].filter(Boolean).join(' · ');
    preview.hidden=false;
  }
  async function analyzeInspiration(){
    const explicit=normalizeUrlInput(inspirationUrl),url=explicit||normalizeUrlInput(website); if(!url){inspirationAnalysis=null;renderInspiration(null);throw new Error('Indica la web oficial del cliente.')}
    analyzeButton.disabled=true; message('Analizando la dirección de arte de la web inspiradora…');
    try{
      const response=await fetch('/presentaciones/api/inspiration',{method:'POST',headers:{'content-type':'application/json','accept':'application/json'},body:JSON.stringify({url})});
      const body=await response.json().catch(()=>({})); if(!response.ok)throw new Error(body.error||`HTTP ${response.status}`);
      inspirationAnalysis=body.inspiration; document.getElementById('primaryColor').value=inspirationAnalysis.primary; document.getElementById('accentColor').value=inspirationAnalysis.accent; renderInspiration(inspirationAnalysis); message(`${explicit?'Inspiración':'Identidad oficial'} analizada en ${inspirationAnalysis.host}${!explicit&&inspirationAnalysis.logo?' · logo detectado':''}.`); return inspirationAnalysis;
    }finally{analyzeButton.disabled=false}
  }
  analyzeButton.addEventListener('click',()=>analyzeInspiration().catch(error=>message(error.message,true)));
  inspirationUrl.addEventListener('input',()=>{if(inspirationAnalysis&&inspirationUrl.value.trim()!==inspirationAnalysis.url){inspirationAnalysis=null;renderInspiration(null)}});
  website.addEventListener('input',()=>{if(!inspirationUrl.value.trim()&&inspirationAnalysis&&website.value.trim()!==inspirationAnalysis.url){inspirationAnalysis=null;renderInspiration(null)}});
  function renderGeneration(generation){
    currentGeneration=generation;
    const tasks=Object.values(generation?.tasks||{}); if(!tasks.length){createdMatrix.innerHTML='';return}
    const html=value=>String(value==null?'':value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
    const languageNames={es:'Castellano',ca:'Català',en:'English'},date=value=>{const parsed=new Date(value||'');return Number.isFinite(parsed.getTime())?parsed.toLocaleString('es-ES',{dateStyle:'short',timeStyle:'medium'}):''},state=task=>{const sent=date(task.submittedAt),last=date(task.updatedAt);if(['ready','published','complete'].includes(task.status))return `${sent?`Enviado ${sent} · `:''}Finalizado ${date(task.completedAt||task.updatedAt)||'—'}`;if(['failed','skipped'].includes(task.status))return `${sent?`Enviado ${sent} · `:''}Error ${date(task.failedAt||task.updatedAt)||'—'}: ${task.error||(task.status==='skipped'?'entregable omitido':'el proveedor no devolvió el archivo')}`;if(task.status==='queued'){const requested=date(task.requestedAt||task.updatedAt||generation.createdAt);return requested?`En cola desde ${requested} · todavía no enviado`:'Preparado para enviar a NotebookLM'}const stage=task.stage?`${task.stage} · `:'';return `${stage}${sent?`enviado ${sent}`:`preparando desde ${date(task.startedAt)||'—'}`} · última actividad ${last||'—'}`};
    const notebook=tasks.filter(task=>task.provider==='notebooklm');
    const monitor=notebook.length?renderProviderMonitor('NotebookLM',notebook):'';
    createdMatrix.innerHTML=monitor+(generation.languages||[]).map(language=>{const items=tasks.filter(task=>task.language===language).map(task=>{const progress=taskProgress(task);return `<div class="created-task ${html(task.status)}"><span>${html(task.label)} · ${progress}%</span><small>${html(state(task))}</small><div class="task-meter"><i style="width:${progress}%"></i></div></div>`}).join('');return `<section class="created-language"><h3>${html(language.toUpperCase())} · ${html(languageNames[language]||language)}</h3><div class="created-tasks">${items}</div></section>`}).join('');
  }
  function taskProgress(task){if(['ready','published','complete','failed','skipped'].includes(task?.status))return 100;return Math.max(0,Math.min(100,Math.round(Number(task?.progress||0))))}
  function timestamp(value){const parsed=new Date(value||'');return Number.isFinite(parsed.getTime())?parsed.toLocaleString('es-ES',{dateStyle:'short',timeStyle:'medium'}):'—'}
  function duration(start,end){const parse=value=>typeof value==='number'?value:Date.parse(value||''),from=parse(start),to=parse(end);if(!Number.isFinite(from)||!Number.isFinite(to)||to<from)return '—';const seconds=Math.floor((to-from)/1000),minutes=Math.floor(seconds/60),hours=Math.floor(minutes/60);return hours?`${hours} h ${minutes%60} min`:minutes?`${minutes} min ${seconds%60} s`:`${seconds} s`}
  function renderProviderMonitor(name,items){
    const progress=Math.round(items.reduce((sum,item)=>sum+taskProgress(item),0)/Math.max(1,items.length));
    const requested=items.map(item=>Date.parse(item.requestedAt||'')).filter(Number.isFinite),submitted=items.map(item=>Date.parse(item.submittedAt||'')).filter(Number.isFinite),activity=items.map(item=>Date.parse(item.updatedAt||'')).filter(Number.isFinite);
    const terminal=items.every(item=>['ready','published','complete','failed','skipped'].includes(item.status)),failed=items.some(item=>['failed','skipped'].includes(item.status));
    const start=submitted.length?Math.min(...submitted):null,last=activity.length?Math.max(...activity):null,end=terminal&&last?last:null,stalled=!terminal&&start&&last&&Date.now()-last>10*60*1000;
    const preparing=items.some(item=>item.startedAt),state=terminal?(failed?'Finalizado con incidencias':'Finalizado'):stalled?'Sin actividad durante más de 10 min':submitted.length?'En proceso · supervisión activa':preparing?'Preparando · todavía no enviado':'En cola · todavía no enviado';
    return `<div class="provider-monitor${stalled?' stalled':''}"><div class="monitor-head"><b>${name}</b><span class="monitor-state">${state} · ${progress}%</span></div><div class="progress-track"><i class="progress-fill" style="width:${progress}%"></i></div><div class="progress-meta"><span>Creado <strong>${timestamp(requested.length?Math.min(...requested):'')}</strong></span><span>Enviado <strong>${timestamp(start)}</strong></span><span>Última actividad <strong>${timestamp(last)}</strong></span><span>Duración <strong>${duration(start,end||Date.now())}</strong></span><span>Finalizado <strong>${timestamp(end)}</strong></span></div></div>`;
  }
  function renderImageSet(set,slideCount=0){
    currentImageSet=set||null;const html=value=>String(value==null?'':value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
    const total=set?.total||slideCount;if(!total){imageWorkspace.hidden=true;imageAction.hidden=true;return}
    imageAction.hidden=false;imageAction.textContent=set?.status==='complete'?'Regenerar imágenes con Grok':set?`Continuar imágenes con Grok · ${set.completed||0}/${total}`:`Crear ${total} imágenes con Grok`;
    const slides=set?.slides||[];imageWorkspace.hidden=false;
    const last=Date.parse(set?.lastActivityAt||set?.updatedAt||''),started=Date.parse(set?.startedAt||''),terminal=['complete','partial'].includes(set?.status),stalled=Boolean(started&&!terminal&&Number.isFinite(last)&&Date.now()-last>10*60*1000);
    const progress=set?Math.max(0,Math.min(100,Math.round(Number(set.progress||0)))):0;
    const state=set?.status==='complete'?'Completado':set?.status==='partial'?'Finalizado con incidencias':stalled?'Sin actividad · reanuda el encargo':set?.status==='processing'?'Grok está trabajando':set?.startedAt?(imageAction.disabled?'Generando':'Interrumpido · pulsa Continuar'):'Preparado';
    const cards=slides.length?slides.map(slide=>{const ready=slide.status==='ready'&&slide.url&&slide.textFreeVerified,failed=slide.status==='failed',slideStalled=slide.status==='processing'&&Date.now()-Date.parse(slide.updatedAt||'')>10*60*1000,slideProgress=taskProgress(slide);return `<article class="image-card${failed?' failed':''}">${ready?`<a href="${html(slide.url)}" target="_blank" rel="noopener"><img src="${html(slide.url)}" alt="Fondo visual de la diapositiva ${slide.index}"></a>`:`<div class="placeholder ${slide.status==='processing'?'processing':''}${slideStalled?' stalled':''}">${failed?(slide.retryable?'REINTENTAR':'REVISAR'):slideStalled?'SIN ACTIVIDAD':slide.status==='processing'?`${html(slide.stage||'GENERANDO')} · ${slideProgress}%`:'PENDIENTE'}</div>`}<span><b>${String(slide.index).padStart(2,'0')}</b>${html(slide.title)} · ${slideProgress}%${ready?' · SIN TEXTO VERIFICADO':''}${failed?` · ${html(slide.error||'Error')}`:''}</span></article>`}).join(''):`<div class="image-card"><div class="placeholder">${total} FONDOS</div><span>Un fondo visual sin texto por diapositiva</span></div>`;
    const start=set?.startedAt||'',end=set?.finishedAt||set?.completedAt||'';
    const monitor=`<div class="provider-monitor${stalled?' stalled':''}"><div class="monitor-head"><b>Grok · fondos visuales</b><span class="monitor-state">${state} · ${set?.completed||0}/${total} · ${progress}%</span></div><div class="progress-track"><i class="progress-fill" style="width:${progress}%"></i></div><div class="progress-meta"><span>Encargo creado <strong>${timestamp(set?.requestedAt||set?.createdAt)}</strong></span><span>Enviado <strong>${timestamp(start)}</strong></span><span>Última actividad <strong>${timestamp(set?.lastActivityAt||set?.updatedAt)}</strong></span><span>Duración <strong>${duration(start,end||Date.now())}</strong></span><span>Finalizado <strong>${timestamp(end)}</strong></span></div>${set&&set.status!=='complete'&&!imageAction.disabled?'<button class="btn image-quick-action" type="button" data-resume-images>Continuar generación</button>':''}</div>`;
    imageWorkspace.innerHTML=`<div class="image-head"><div><h3>Fondos de las diapositivas</h3><p>Grok genera escenas originales 16:9. Cada resultado se revisa automáticamente y sólo se incorpora si no contiene texto, números ni marcas tipográficas.</p></div></div>${monitor}<div class="image-grid">${cards}</div><p class="image-note">Los fondos se colocan por debajo del contenido y sirven para reforzar el mensaje en todos los idiomas.</p>`;
  }
  async function imageApi(payload){
    const response=await fetch('/presentaciones/api/images',{method:'POST',headers:{'content-type':'application/json','accept':'application/json'},body:JSON.stringify(payload)}),body=await response.json().catch(()=>({}));
    if(!response.ok){const error=new Error(body.error||`HTTP ${response.status}`);error.data=body;throw error}return body;
  }
  async function loadImages(client){
    const response=await fetch(`/presentaciones/api/images?client=${encodeURIComponent(client)}`,{headers:{accept:'application/json'},cache:'no-store'}),body=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(body.error||`HTTP ${response.status}`);renderImageSet(body.imageSet,body.slideCount);return body;
  }
  imageAction.addEventListener('click',async()=>{
    if(!currentClient)return;
    const force=currentImageSet?.status==='complete';
    if(force&&!window.confirm(`Ya existen ${currentImageSet.total} imágenes. ¿Quieres crear un paquete nuevo y conservar el anterior en el archivo?`))return;
    imageAction.disabled=true;
    try{
      message('Preparando una imagen temática por diapositiva…');
      const prepared=await imageApi({action:'prepare',client:currentClient,force}),set=prepared.imageSet;renderImageSet(set);
      const pending=(set.slides||[]).filter(slide=>slide.status!=='ready');
      for(let index=0;index<pending.length;index+=1){
        const slide=pending[index];let retry=true;
        while(retry){
          retry=false;message(`Grok está creando y verificando el fondo ${slide.index} de ${set.total}: ${slide.title}`);
          try{const generated=await imageApi({action:'generate',client:currentClient,setId:set.id,slideId:slide.id});renderImageSet(generated.imageSet)}
          catch(error){if(error.data?.imageSet)renderImageSet(error.data.imageSet);else throw error;retry=Boolean(error.data?.retryable);if(retry)message(`El fondo ${slide.index} contenía texto. Descartado; Grok lo intenta de nuevo…`)}
        }
      }
      const failed=currentImageSet?.failed||0;message(failed?`Paquete visual creado con ${failed} imagen${failed===1?'':'es'} pendiente${failed===1?'':'s'} de reintento.`:`Paquete visual completo: ${currentImageSet?.completed||0} imágenes listas.`,Boolean(failed));
    }catch(error){message(error.message,true)}finally{imageAction.disabled=false}
  });
  imageWorkspace.addEventListener('click',event=>{if(event.target.closest('[data-resume-images]'))imageAction.click()});
  form.addEventListener('submit',async event=>{
    event.preventDefault(); event.stopImmediatePropagation(); submit.disabled=true; result.classList.remove('show'); message('Analizando el problema y construyendo la presentación…');
    const passwordPromise=resolvePassword();normalizeUrlInput(website);normalizeUrlInput(inspirationUrl);
    try{
      if(!inspirationAnalysis)await analyzeInspiration();
      message('Construyendo el relato y aplicando la dirección visual…');
      const data=Object.fromEntries(new FormData(form).entries()); if(!data.password)data.password=await passwordPromise;data.outputs=outputBoxes.filter(box=>box.checked).map(box=>box.value); data.languages=[...languagePanel.querySelectorAll('input[name="language"]:checked')].map(box=>box.value); data.inspiration=inspirationAnalysis;
      const body=await createPresentation(data); if(!body){message('No se ha modificado la presentación existente.');return}
      const absolute=new URL(body.url,location.origin).href; document.getElementById('resultUrl').textContent=absolute; document.getElementById('resultPassword').textContent=body.password||'Contraseña actual conservada';
      document.getElementById('openIdeas').href=body.ideasUrl; const openDeck=document.getElementById('openDeck');openDeck.href=body.deckUrl;openDeck.hidden=!body.outputs.includes('website'); currentClient=body.slug;currentGenerationUrl=`/presentaciones/${body.slug}/api/generation`; renderGeneration(body.generation);renderImageSet(null,body.slideCount||0);result.classList.add('show'); result.scrollIntoView({behavior:'smooth',block:'center'}); message(`Orden creada: ${body.displayName}`);loadImages(body.slug).catch(error=>message(error.message,true));
    }catch(error){message(error.message,true)}finally{submit.disabled=false}
  },true);
  setInterval(async()=>{
    if(!currentGenerationUrl||!Object.values(currentGeneration?.tasks||{}).some(task=>['queued','processing'].includes(task.status)))return;
    try{const response=await fetch(currentGenerationUrl,{headers:{accept:'application/json'},cache:'no-store'});if(!response.ok)return;renderGeneration((await response.json()).generation)}catch(_){}
  },15000);
  setInterval(()=>{if(currentClient&&currentImageSet&&!['complete','partial'].includes(currentImageSet.status))loadImages(currentClient).catch(()=>{})},10000);
  document.addEventListener('click',async event=>{const button=event.target.closest('[data-copy]');if(!button)return;const node=document.getElementById(button.dataset.copy);try{await navigator.clipboard.writeText(node.textContent);const before=button.textContent;button.textContent='Copiado';setTimeout(()=>button.textContent=before,1200)}catch(_){}});
})();
