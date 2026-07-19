(function(){
  'use strict';
  const body = document.body;
  const client = body.dataset.client || location.pathname.split('/').filter(Boolean)[1].toLowerCase();
  const displayName = body.dataset.name || client;
  const apiUrl = new URL(`./api/ideas`, location.href).pathname;
  const generationUrl = new URL(`./api/generation`, location.href).pathname;
  const defaultUrl = `${apiUrl}?base=1`;
  const $ = (id) => document.getElementById(id);
  const ALL_OUTPUTS = ['website','audio','video','pdf','powerpoint','documents','infographic','backgrounds'];
  const DEFAULT_OUTPUTS = ['website','documents'];
  const ALL_LANGUAGES = ['es','ca','en'];
  const LANGUAGE_NAMES = {es:'Castellano',ca:'Català',en:'English'};
  let model = null;
  let generation = null;
  let activeLanguage = 'es';

  const languagePanel = document.createElement('section');
  languagePanel.className = 'panel editor-language-panel';
  languagePanel.innerHTML = '<div class="panel-h"><div><h2>Idioma que estás editando</h2><p class="sub">Cada idioma conserva sus propios titulares, argumentos y cierre.</p></div></div><div class="editor-language-tabs" id="languageTabs"></div>';
  document.querySelector('main .panel').before(languagePanel);

  const outputPanel = document.createElement('section');
  outputPanel.className = 'panel output-panel';
  outputPanel.innerHTML = '<div class="panel-h"><div><h2>¿Qué queremos obtener?</h2><p class="sub">Por defecto se crean la presentación/website y el documento de trabajo. Las imágenes de fondo forman un único paquete Grok sin texto, compartido por todos los idiomas.</p></div></div><div class="output-grid"><label class="output"><input type="checkbox" name="output" value="website"><b>01</b><span>Website</span></label><label class="output"><input type="checkbox" name="output" value="audio"><b>02</b><span>Audio</span></label><label class="output"><input type="checkbox" name="output" value="video"><b>03</b><span>Vídeo</span></label><label class="output"><input type="checkbox" name="output" value="pdf"><b>04</b><span>PDF</span></label><label class="output"><input type="checkbox" name="output" value="powerpoint"><b>05</b><span>PowerPoint</span></label><label class="output"><input type="checkbox" name="output" value="documents"><b>06</b><span>Documento de trabajo</span></label><label class="output"><input type="checkbox" name="output" value="infographic"><b>07</b><span>Infografía</span></label><label class="output"><input type="checkbox" name="output" value="backgrounds"><b>08</b><span>Imágenes de fondo</span></label><label class="output all"><input type="checkbox" id="allOutputs"><b>09</b><span>Todo</span></label></div>';
  const outputStyle = document.createElement('style');
  outputStyle.textContent = '.output-panel{margin-top:28px}.output-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px}.output{display:flex;align-items:center;gap:11px;border:1px solid var(--line);border-radius:13px;padding:16px;background:#091427;color:var(--ink);cursor:pointer;text-transform:none;letter-spacing:0;margin:0;transition:.15s}.output:has(input:checked){border-color:var(--ok);background:rgba(82,229,154,.08)}.output input{width:auto;margin:0;accent-color:var(--ok)}.output b{font:800 10px/1 var(--mono);color:var(--ok)}.output span{font:750 14px/1.25 var(--sans)}.output.all{border-style:dashed}.generation-panel{margin-top:18px}.generation-panel[hidden]{display:none}.generation-badge{border:1px solid var(--ok);border-radius:999px;padding:8px 11px;color:var(--ok);font:800 10px/1 var(--mono);letter-spacing:.09em}.provider-monitor{margin:4px 0 18px;border:1px solid var(--line);border-radius:13px;padding:14px;background:#091427}.provider-monitor.stalled{border-color:#ffbf70}.monitor-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.monitor-state{color:var(--ok);font:800 10px/1.35 var(--mono);text-align:right}.provider-monitor.stalled .monitor-state{color:#ffbf70}.progress-track{height:10px;margin:11px 0 9px;overflow:hidden;border:1px solid var(--line);border-radius:999px;background:#050b13}.progress-fill{display:block;height:100%;background:linear-gradient(90deg,#4a86ff,var(--ok));transition:width .35s}.progress-meta{display:flex;flex-wrap:wrap;gap:6px 14px;color:var(--muted);font:700 9px/1.45 var(--mono)}.progress-meta strong{color:var(--ink)}.generation-languages{display:grid;gap:14px}.generation-language{border-top:1px solid var(--line);padding-top:13px}.generation-language:first-child{border-top:0;padding-top:0}.generation-language h3{margin:0 0 9px;font:800 11px/1 var(--mono);letter-spacing:.09em;color:var(--muted);text-transform:uppercase}.generation-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.generation-item{display:grid;grid-template-columns:1fr minmax(110px,auto);align-items:center;gap:8px;border:1px solid var(--line);border-radius:11px;padding:12px 14px;background:#091427;font:700 12px/1.3 var(--sans)}.generation-item small{color:var(--muted);font:800 9px/1.35 var(--mono);letter-spacing:.04em;text-align:right;max-width:230px}.generation-item.ready small,.generation-item.published small,.generation-item.complete small{color:var(--ok)}.generation-item.processing small{color:#72a7ff}.generation-item.queued small{color:#f5a623}.generation-item.failed small,.generation-item.skipped small{color:#ff7b8a}.task-meter{grid-column:1/-1;height:4px;overflow:hidden;border-radius:99px;background:#050b13}.task-meter i{display:block;height:100%;background:var(--ok)}.task-actions{grid-column:1/-1;display:flex;gap:7px}.task-action{border:1px solid var(--line);background:transparent;color:var(--muted);border-radius:8px;padding:7px 9px;font:800 9px/1 var(--mono);cursor:pointer}.task-action:hover{border-color:var(--ok);color:var(--ok)}@media(max-width:720px){.output-grid,.generation-grid{grid-template-columns:1fr}.generation-item{grid-template-columns:1fr}.generation-item small{text-align:left;max-width:none}.monitor-head{align-items:flex-start}.progress-meta{display:grid;gap:4px}}';
  document.head.appendChild(outputStyle);
  const languageStyle = document.createElement('style');
  languageStyle.textContent = '.editor-language-panel{margin-bottom:18px}.editor-language-tabs{display:flex;gap:9px;flex-wrap:wrap}.language-tab{border:1px solid var(--line);background:#091427;color:var(--muted);border-radius:999px;padding:11px 15px;font:800 11px/1 var(--mono);cursor:pointer}.language-tab.active{border-color:var(--ok);background:rgba(82,229,154,.1);color:var(--ok)}';
  document.head.appendChild(languageStyle);
  document.querySelector('.savebar').before(outputPanel);
  const generationPanel = document.createElement('section');
  generationPanel.className = 'panel generation-panel';
  generationPanel.hidden = true;
  generationPanel.innerHTML = '<div class="panel-h"><div><h2>Estado de producción</h2><p class="sub" id="generationSummary">Consultando el estado…</p></div><span class="generation-badge" id="generationBadge">CARGANDO</span></div><div id="generationProgress"></div><div class="generation-grid" id="generationArtifacts"></div>';
  outputPanel.after(generationPanel);
  document.querySelector('.savebar .btn.primary').textContent = 'Generar presentación';
  const outputBoxes = [...outputPanel.querySelectorAll('input[name="output"]')];
  const allOutputs = $('allOutputs');

  function esc(value){
    return String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function idFor(value, index){
    const clean = String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
    return clean || `idea-${index + 1}`;
  }
  function setStatus(message, type){
    const el = $('status'); el.textContent = message; el.className = `status${type ? ' '+type : ''}`;
  }
  async function getJson(url){
    const response = await fetch(url, { headers:{'accept':'application/json'}, cache:'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }
  async function load(){
    body.classList.add('loading');
    try {
      try { model = await getJson(apiUrl); setStatus('Versión guardada en producción cargada.', 'ok'); }
      catch (_) { model = await getJson(defaultUrl); setStatus('Copia base cargada. Guarda para publicarla.', ''); }
      render();
      try { generation = (await getJson(generationUrl)).generation; renderGeneration(); }
      catch (_) { generation = null; }
    } catch (error){ setStatus(`No se pudo cargar: ${error.message}`, 'error'); }
    finally { body.classList.remove('loading'); }
  }
  function field(id, value){ $(id).value = value || ''; }
  function enabledLanguages(){
    const selected=Array.isArray(model.languages)?model.languages.filter(lang=>ALL_LANGUAGES.includes(lang)):[];
    return selected.length?selected:ALL_LANGUAGES;
  }
  function baseContent(){
    return {hero:model.hero||{},objective:model.objective||'',skeleton:model.skeleton||[],closing:model.closing||{},labels:model.labels||{objective:'El objetivo',next:'Siguiente paso'},notes:model.notes||''};
  }
  function contentFor(language){
    if(language==='es') return baseContent();
    model.translations=model.translations&&typeof model.translations==='object'?model.translations:{};
    if(!model.translations[language]) model.translations[language]=JSON.parse(JSON.stringify(baseContent()));
    return model.translations[language];
  }
  function visibleContent(){
    const ideas = [...document.querySelectorAll('.idea')].map((node, index) => {
      const value = (key) => node.querySelector(`[data-key="${key}"]`);
      return {id:value('id')?.value||idFor(value('title').value,index),title:value('title').value,message:value('message').value,detail:value('detail').value,enabled:value('enabled').checked};
    });
    return {hero:{eyebrow:$('eyebrow').value,title:$('title').value,summary:$('summary').value},objective:$('objective').value,skeleton:ideas,closing:{title:$('closingTitle').value,action:$('closingAction').value},labels:contentFor(activeLanguage).labels||{objective:'El objetivo',next:'Siguiente paso'},notes:$('notes').value};
  }
  function commitLanguage(){
    if(!model||!document.querySelector('.idea')) return;
    const content=visibleContent();
    if(activeLanguage==='es') Object.assign(model,content);
    else { model.translations=model.translations||{}; model.translations[activeLanguage]=content; }
  }
  function renderLanguageTabs(){
    const host=$('languageTabs'); host.innerHTML='';
    const languages=enabledLanguages();
    if(!languages.includes(activeLanguage)) activeLanguage=languages[0];
    languages.forEach(language=>{
      const button=document.createElement('button'); button.type='button'; button.className=`language-tab${language===activeLanguage?' active':''}`;
      button.dataset.language=language; button.textContent=`${language.toUpperCase()} · ${LANGUAGE_NAMES[language]}`; host.appendChild(button);
    });
  }
  function renderLanguage(){
    const content=contentFor(activeLanguage);
    field('eyebrow',content.hero?.eyebrow); field('title',content.hero?.title); field('summary',content.hero?.summary);
    field('objective',content.objective); field('closingTitle',content.closing?.title); field('closingAction',content.closing?.action); field('notes',content.notes);
    renderIdeas(content.skeleton||[]); renderLanguageTabs();
  }
  function render(){
    document.querySelectorAll('[data-client-name]').forEach(node => { node.textContent = model.displayName || displayName; });
    field('displayName', model.displayName || displayName);
    model.languages=enabledLanguages(); model.translations=model.translations||{};
    renderLanguage();
    renderOutputs();
    syncRaw();
  }
  function renderOutputs(){
    const selected = new Set(Array.isArray(model.outputs) && model.outputs.length ? model.outputs : DEFAULT_OUTPUTS);
    outputBoxes.forEach(box => { box.checked = selected.has(box.value); });
    allOutputs.checked = outputBoxes.every(box => box.checked);
  }
  function lifecycleDate(value){
    const date=new Date(value||'');
    return Number.isFinite(date.getTime())?date.toLocaleString('es-ES',{dateStyle:'short',timeStyle:'medium'}):'';
  }
  function taskProgress(task){if(['ready','published','complete','failed','skipped'].includes(task?.status))return 100;return Math.max(0,Math.min(100,Math.round(Number(task?.progress||0))))}
  function elapsed(start,end){const parse=value=>typeof value==='number'?value:Date.parse(value||''),from=parse(start),to=parse(end);if(!Number.isFinite(from)||!Number.isFinite(to)||to<from)return '—';const seconds=Math.floor((to-from)/1000),minutes=Math.floor(seconds/60),hours=Math.floor(minutes/60);return hours?`${hours} h ${minutes%60} min`:minutes?`${minutes} min ${seconds%60} s`:`${seconds} s`}
  function renderProgress(tasks){
    const notebook=tasks.filter(task=>task.provider==='notebooklm');if(!notebook.length){$('generationProgress').innerHTML='';return}
    const progress=Math.round(notebook.reduce((sum,task)=>sum+taskProgress(task),0)/notebook.length),requested=notebook.map(task=>Date.parse(task.requestedAt||'')).filter(Number.isFinite),submitted=notebook.map(task=>Date.parse(task.submittedAt||'')).filter(Number.isFinite),activity=notebook.map(task=>Date.parse(task.updatedAt||'')).filter(Number.isFinite);
    const terminal=notebook.every(task=>['ready','published','complete','failed','skipped'].includes(task.status)),failed=notebook.some(task=>['failed','skipped'].includes(task.status)),start=submitted.length?Math.min(...submitted):null,last=activity.length?Math.max(...activity):null,end=terminal&&last?last:null,stalled=!terminal&&start&&last&&Date.now()-last>10*60*1000;
    const preparing=notebook.some(task=>task.startedAt),state=terminal?(failed?'Finalizado con incidencias':'Finalizado'):stalled?'Sin actividad durante más de 10 min':submitted.length?'En proceso · supervisión activa':preparing?'Preparando · todavía no enviado':'En cola · todavía no enviado';
    $('generationProgress').innerHTML=`<div class="provider-monitor${stalled?' stalled':''}"><div class="monitor-head"><b>NotebookLM</b><span class="monitor-state">${state} · ${progress}%</span></div><div class="progress-track"><i class="progress-fill" style="width:${progress}%"></i></div><div class="progress-meta"><span>Creado <strong>${lifecycleDate(requested.length?Math.min(...requested):'')||'—'}</strong></span><span>Enviado <strong>${lifecycleDate(start)||'—'}</strong></span><span>Última actividad <strong>${lifecycleDate(last)||'—'}</strong></span><span>Duración <strong>${elapsed(start,end||Date.now())}</strong></span><span>Finalizado <strong>${lifecycleDate(end)||'—'}</strong></span></div></div>`;
  }
  function lifecycleState(item){
    const status=item?.status||'queued';
    const sent=lifecycleDate(item.submittedAt),last=lifecycleDate(item.updatedAt);
    if(['ready','published','complete'].includes(status)) return `${sent?`Enviado ${sent} · `:''}Finalizado ${lifecycleDate(item.completedAt||item.updatedAt)||'—'}`;
    if(['failed','skipped'].includes(status)) return `${sent?`Enviado ${sent} · `:''}Error ${lifecycleDate(item.failedAt||item.updatedAt)||'—'}: ${item.error||(status==='skipped'?'entregable omitido':'el proveedor no devolvió el archivo')}`;
    if(status==='queued'){
      const since=lifecycleDate(item.requestedAt||item.updatedAt||generation?.createdAt);
      return since?`En cola desde ${since} · todavía no enviado`:'Preparado para enviar a NotebookLM';
    }
    const stage=item.stage?`${item.stage} · `:'';
    return `${stage}${sent?`enviado ${sent}`:`preparando desde ${lifecycleDate(item.startedAt)||'—'}`} · última actividad ${last||'—'}`;
  }
  function renderGeneration(){
    if (!generation) { generationPanel.hidden = true; return; }
    generationPanel.hidden = false;
    const badgeStates = {queued:'PREPARADO',processing:'EN PROCESO',ready:'FINALIZADO',published:'FINALIZADO',complete:'FINALIZADO',failed:'ERROR',skipped:'ERROR'};
    const tasks = Object.values(generation.tasks || {}),notebookTasks=tasks.filter(task=>task.provider==='notebooklm');
    const monitoredStatus=notebookTasks.length?(notebookTasks.some(task=>task.status==='processing')?'processing':notebookTasks.every(task=>['ready','published','complete'].includes(task.status))?'complete':notebookTasks.every(task=>['ready','published','complete','failed','skipped'].includes(task.status))?'failed':'queued'):generation.status;
    $('generationBadge').textContent = badgeStates[monitoredStatus] || 'PREPARADO';
    const date = generation.createdAt ? new Date(generation.createdAt).toLocaleString('es-ES') : '';
    $('generationSummary').textContent = `Solicitud ${date} · el website se publica al instante y los archivos se incorporan cuando termina la producción.`;
    renderProgress(tasks);
    if (!tasks.length) {
      $('generationArtifacts').innerHTML = Object.values(generation.artifacts || {}).map(item => {
        const status=item.status||'queued'; const name=esc(item.label||'Entregable');
        const content=item.url?`<a href="${esc(item.url)}" target="_blank" rel="noopener">${name}</a>`:`<span>${name}</span>`;
        const progress=taskProgress(item);return `<div class="generation-item ${esc(status)}">${content}<small>${progress}% · ${esc(lifecycleState(item))}</small><div class="task-meter"><i style="width:${progress}%"></i></div></div>`;
      }).join('');
      return;
    }
    $('generationArtifacts').className='generation-languages';
    $('generationArtifacts').innerHTML=(generation.languages||ALL_LANGUAGES).map(language=>{
      const localized=tasks.filter(task=>task.language===language); if(!localized.length)return '';
      const items=localized.map(task=>{
        const status=task.status||'queued'; const name=esc(task.label||task.output); const state=esc(lifecycleState(task));
        const content=task.url?`<a href="${esc(task.url)}" target="_blank" rel="noopener">${name}</a>`:`<span>${name}</span>`;
        const retry=['failed','skipped'].includes(status)?`<button class="task-action" data-task-action="retry" data-task="${esc(task.id)}">Reintentar</button>`:'';
        const publish=['ready','complete'].includes(status)&&task.url?`<button class="task-action" data-task-action="publish" data-task="${esc(task.id)}">Publicar</button>`:'';
        const progress=taskProgress(task);return `<div class="generation-item ${esc(status)}">${content}<small>${progress}% · ${state}</small><div class="task-meter"><i style="width:${progress}%"></i></div>${retry||publish?`<div class="task-actions">${retry}${publish}</div>`:''}</div>`;
      }).join('');
      return `<section class="generation-language"><h3>${esc(language.toUpperCase())} · ${esc(LANGUAGE_NAMES[language]||language)}</h3><div class="generation-grid">${items}</div></section>`;
    }).join('');
  }

  async function updateGeneration(action, task){
    setStatus(action==='retry'?'Reintentando entregable…':'Publicando entregable…','');
    try{
      const response=await fetch(generationUrl,{method:'PUT',headers:{'content-type':'application/json','accept':'application/json'},body:JSON.stringify({id:generation.id,action,task})});
      const result=await response.json().catch(()=>({})); if(!response.ok)throw new Error(result.error||`HTTP ${response.status}`);
      generation=result.generation; renderGeneration(); setStatus(action==='retry'?'Entregable procesándose de nuevo.':'Entregable publicado.','ok');
    }catch(error){setStatus(`No se pudo actualizar: ${error.message}`,'error')}
  }
  function renderIdeas(ideas){
    const host = $('ideas'); host.innerHTML = '';
    (ideas || []).forEach((idea, index) => {
      const node = document.createElement('article'); node.className = 'idea'; node.dataset.index = index;
      node.innerHTML = `<input type="hidden" data-key="id" value="${esc(idea.id)}"><div class="idea-top"><span class="handle">${String(index+1).padStart(2,'0')} · BLOQUE</span><label class="check"><input type="checkbox" data-key="enabled" ${idea.enabled !== false ? 'checked' : ''}>Visible</label><div class="idea-actions"><button class="btn icon" type="button" data-action="up" title="Subir">↑</button><button class="btn icon" type="button" data-action="down" title="Bajar">↓</button><button class="btn icon danger" type="button" data-action="remove" title="Eliminar">×</button></div></div><div class="grid"><div class="field"><label>Título del bloque</label><input data-key="title" value="${esc(idea.title)}"></div><div class="field"><label>Idea principal</label><input data-key="message" value="${esc(idea.message)}"></div><div class="field full"><label>Detalle / argumentos</label><textarea data-key="detail">${esc(idea.detail)}</textarea></div></div>`;
      host.appendChild(node);
    });
  }
  function readForm(){
    commitLanguage();
    return {...model,schemaVersion:2,client,displayName:$('displayName').value,languages:enabledLanguages(),outputs:outputBoxes.filter(box=>box.checked).map(box=>box.value)};
  }
  function syncRaw(){ $('raw').value = JSON.stringify(readForm(), null, 2); }
  function addIdea(){
    model = readForm();
    const content=contentFor(activeLanguage); content.skeleton.push({id:`idea-${content.skeleton.length+1}`,title:'Nueva idea',message:'Mensaje principal',detail:'Argumentos y detalles que deben aparecer en la presentación.',enabled:true});
    renderIdeas(content.skeleton); syncRaw();
    document.querySelector('.idea:last-child input[data-key="title"]').focus();
  }
  function move(index, delta){
    model = readForm(); const content=contentFor(activeLanguage); const target=index+delta;
    if (target < 0 || target >= content.skeleton.length) return;
    [content.skeleton[index],content.skeleton[target]]=[content.skeleton[target],content.skeleton[index]];
    renderIdeas(content.skeleton); syncRaw();
  }
  async function save(){
    model = readForm();
    if (!model.hero.title.trim() || !model.skeleton.length){ setStatus('Falta el título o al menos una idea.', 'error'); return; }
    body.classList.add('loading'); setStatus('Creando la orden de producción…', '');
    try {
      const response = await fetch(apiUrl, {method:'PUT',headers:{'content-type':'application/json','accept':'application/json'},body:JSON.stringify(model)});
      const result = await response.json().catch(()=>({}));
      if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
      model = result.data; generation = result.generation; render(); renderGeneration();
      generationPanel.scrollIntoView({behavior:'smooth',block:'center'});
      setStatus(`Orden creada · ${new Date(model.updatedAt).toLocaleString('es-ES')}`, 'ok');
    } catch (error){ setStatus(`No se pudo guardar: ${error.message}`, 'error'); }
    finally { body.classList.remove('loading'); }
  }
  async function restore(){
    if (!confirm('¿Volver a la copia base? Podrás revisarla antes de guardar.')) return;
    try { model = await getJson(defaultUrl); render(); setStatus('Copia base restaurada. Pulsa Guardar para publicarla.', ''); }
    catch (error){ setStatus(`No se pudo restaurar: ${error.message}`, 'error'); }
  }
  function applyRaw(){
    try { model = JSON.parse($('raw').value); render(); setStatus('JSON aplicado al formulario. Falta guardar.', ''); }
    catch (error){ setStatus(`JSON no válido: ${error.message}`, 'error'); }
  }
  $('ideas').addEventListener('click', (event) => {
    const button = event.target.closest('[data-action]'); if (!button) return;
    const node = button.closest('.idea'); const index = Number(node.dataset.index); const action = button.dataset.action;
    if (action === 'up') move(index,-1); else if (action === 'down') move(index,1); else if (action === 'remove') { model=readForm(); const content=contentFor(activeLanguage); content.skeleton.splice(index,1); renderIdeas(content.skeleton); syncRaw(); }
  });
  $('languageTabs').addEventListener('click',event=>{
    const button=event.target.closest('[data-language]'); if(!button||button.dataset.language===activeLanguage) return;
    commitLanguage(); activeLanguage=button.dataset.language; renderLanguage(); syncRaw();
  });
  allOutputs.addEventListener('change', () => {
    outputBoxes.forEach(box => { box.checked = allOutputs.checked; });
    syncRaw();
  });
  outputBoxes.forEach(box => box.addEventListener('change', () => {
    allOutputs.checked = outputBoxes.every(item => item.checked);
    syncRaw();
  }));
  generationPanel.addEventListener('click',event=>{const button=event.target.closest('[data-task-action]');if(button)updateGeneration(button.dataset.taskAction,button.dataset.task)});
  document.addEventListener('input', (event) => { if (event.target.id !== 'raw') syncRaw(); });
  $('addIdea').addEventListener('click', addIdea);
  $('save').addEventListener('click', save);
  $('restore').addEventListener('click', restore);
  $('applyRaw').addEventListener('click', applyRaw);
  setInterval(async()=>{
    if(!generation||!Object.values(generation.tasks||{}).some(task=>['queued','processing'].includes(task.status))) return;
    try{generation=(await getJson(generationUrl)).generation;renderGeneration()}catch(_){}
  },15000);
  load();
})();
