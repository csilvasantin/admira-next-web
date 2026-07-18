(function(){
  'use strict';
  window.__ADMIRA_GENERATOR_VERSION__='20260718-3';
  document.querySelector('.output-panel')?.remove();
  const form=document.getElementById('generator'),status=document.getElementById('status'),submit=document.getElementById('submit'),result=document.getElementById('result');
  const display=document.getElementById('displayName'),slug=document.getElementById('slug'); let slugTouched=true,inspirationAnalysis=null,currentGeneration=null,currentGenerationUrl='';
  const inspirationStep=document.querySelector('.flow span:nth-child(2)'); if(inspirationStep)inspirationStep.innerHTML='<b>02</b> Inspiración';
  const thesisPanel=form.querySelectorAll('.panel')[1],thesisGrid=thesisPanel.querySelector('.grid'); thesisPanel.querySelector('h2').textContent='2. Inspiración e identidad'; thesisPanel.querySelector('.sub').textContent='Usa una web como referencia de dirección de arte para toda la presentación, especialmente el site.';
  const inspirationField=document.createElement('div'); inspirationField.className='field full inspiration-field';
  inspirationField.innerHTML='<label for="inspirationUrl">Web inspiradora · opcional</label><div class="inspiration-input"><input id="inspirationUrl" name="inspirationUrl" type="url" placeholder="https://web-que-nos-inspira.com/"><button class="btn" id="analyzeInspiration" type="button">Analizar estilo</button></div><p class="field-help">Extraemos paleta, tipografía, geometría, densidad y composición. No copiamos código ni elementos de marca.</p><div class="inspiration-preview" id="inspirationPreview" hidden><div class="inspiration-palette" id="inspirationPalette"></div><div><b id="inspirationTitle">Dirección visual</b><span id="inspirationTraits"></span></div></div>';
  thesisGrid.prepend(inspirationField);
  const inspirationStyle=document.createElement('style'); inspirationStyle.textContent='.inspiration-input{display:grid;grid-template-columns:1fr auto;gap:9px}.inspiration-input .btn{white-space:nowrap}.field-help{margin:9px 0 0;color:var(--mut);font-size:12px}.inspiration-preview{margin-top:14px;display:flex;align-items:center;gap:14px;border:1px solid var(--line);border-radius:13px;padding:14px;background:#08111e}.inspiration-preview[hidden]{display:none}.inspiration-preview b,.inspiration-preview span{display:block}.inspiration-preview b{font-size:14px}.inspiration-preview span{margin-top:4px;color:var(--mut);font:700 10px/1.45 var(--mono);text-transform:uppercase;letter-spacing:.05em}.inspiration-palette{display:flex;flex:none}.inspiration-palette i{width:25px;height:42px;border:2px solid #08111e;margin-left:-5px}.inspiration-palette i:first-child{margin-left:0;border-radius:9px 0 0 9px}.inspiration-palette i:last-child{border-radius:0 9px 9px 0}@media(max-width:680px){.inspiration-input{grid-template-columns:1fr}.inspiration-input .btn{width:100%}}'; document.head.appendChild(inspirationStyle);
  const overwriteStyle=document.createElement('style'); overwriteStyle.textContent='.overwrite-dialog{width:min(540px,calc(100% - 28px));border:1px solid var(--line);border-radius:20px;padding:0;background:linear-gradient(145deg,var(--panel),var(--panel2));color:var(--ink);box-shadow:0 28px 90px rgba(0,0,0,.55)}.overwrite-dialog::backdrop{background:rgba(2,6,12,.78);backdrop-filter:blur(5px)}.overwrite-body{padding:28px}.overwrite-kicker{color:#f5a623;font:800 10px/1 var(--mono);letter-spacing:.12em;text-transform:uppercase}.overwrite-dialog h2{font-size:25px;line-height:1.15;margin:14px 0 10px}.overwrite-dialog p{color:var(--mut);font-size:14px;margin:0}.overwrite-target{display:block;margin-top:17px;border:1px solid var(--line);border-radius:10px;padding:11px 13px;color:var(--ink);background:#07101c;font:700 11px/1.4 var(--mono);overflow-wrap:anywhere}.overwrite-warning{margin-top:14px!important;color:#ffbf70!important}.overwrite-actions{display:flex;justify-content:flex-end;gap:9px;margin-top:24px}.overwrite-actions .danger{background:#ff6b6b;border-color:#ff6b6b;color:#240707}@media(max-width:560px){.overwrite-actions{flex-direction:column-reverse}.overwrite-actions .btn{width:100%}}'; document.head.appendChild(overwriteStyle);
  const overwriteDialog=document.createElement('dialog'); overwriteDialog.className='overwrite-dialog'; overwriteDialog.innerHTML='<div class="overwrite-body"><div class="overwrite-kicker">Presentación existente</div><h2>¿Crear otra presentación sobre la actual?</h2><p>Este identificador ya está en uso. Si continúas, reemplazaremos el esqueleto, el site y la nueva orden de producción.</p><code class="overwrite-target" id="overwriteTarget"></code><p class="overwrite-warning">La contraseña actual se conservará si has dejado el campo vacío.</p><div class="overwrite-actions"><button class="btn" type="button" id="overwriteCancel">No, volver</button><button class="btn danger" type="button" id="overwriteConfirm">Sí, crear sobre la existente</button></div></div>'; document.body.appendChild(overwriteDialog);
  const inspirationUrl=document.getElementById('inspirationUrl'),analyzeButton=document.getElementById('analyzeInspiration');
  const languagePanel=document.createElement('section'); languagePanel.className='panel language-panel';
  languagePanel.innerHTML='<h2>4. Idiomas</h2><p class="sub">Selecciona las versiones del site. Después podrás editar cada idioma por separado.</p><div class="language-grid"><label class="language"><input type="checkbox" name="language" value="es" checked><b>ES</b><span>Castellano</span></label><label class="language"><input type="checkbox" name="language" value="ca" checked><b>CA</b><span>Català</span></label><label class="language"><input type="checkbox" name="language" value="en" checked><b>EN</b><span>English</span></label></div>';
  const outputPanel=document.createElement('section'); outputPanel.className='panel output-panel';
  outputPanel.innerHTML='<h2>5. ¿Qué queremos obtener?</h2><p class="sub">Producción estándar: site, audio, vídeo e infografía. Si no se indica lo contrario, estos tres entregables se preparan para NotebookLM al finalizar el esqueleto y el site.</p><div class="output-grid"><label class="output"><input type="checkbox" name="output" value="website" checked><b>01</b><span>Website</span></label><label class="output"><input type="checkbox" name="output" value="audio" checked><b>02</b><span>Audio</span></label><label class="output"><input type="checkbox" name="output" value="video" checked><b>03</b><span>Vídeo</span></label><label class="output"><input type="checkbox" name="output" value="pdf"><b>04</b><span>PDF</span></label><label class="output"><input type="checkbox" name="output" value="powerpoint"><b>05</b><span>PowerPoint</span></label><label class="output"><input type="checkbox" name="output" value="documents"><b>06</b><span>Documento de trabajo</span></label><label class="output"><input type="checkbox" name="output" value="infographic" checked><b>07</b><span>Infografía</span></label><label class="output all"><input type="checkbox" id="allOutputs"><b>08</b><span>Todo</span></label></div>';
  form.insertBefore(languagePanel,status); form.insertBefore(outputPanel,status);
  const style=document.createElement('style');style.textContent='.language-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.language{display:flex;align-items:center;gap:11px;border:1px solid var(--line);border-radius:12px;padding:16px;background:#08111e;color:var(--ink);cursor:pointer;text-transform:none;letter-spacing:0;margin:0}.language:has(input:checked){border-color:var(--green);background:rgba(61,240,138,.07)}.language input{width:auto;margin:0;accent-color:var(--green)}.language b{font:800 11px/1 var(--mono);color:var(--green)}.language span{font:700 14px/1.25 var(--sans)}.output-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.output{display:flex;align-items:center;gap:11px;border:1px solid var(--line);border-radius:12px;padding:14px;background:#08111e;color:var(--ink);cursor:pointer;text-transform:none;letter-spacing:0;margin:0}.output:has(input:checked){border-color:var(--green);background:rgba(61,240,138,.07)}.output input{width:auto;margin:0;accent-color:var(--green)}.output b{font:800 10px/1 var(--mono);color:var(--green)}.output span{font:700 14px/1.25 var(--sans)}.output.all{border-style:dashed}.created-matrix{margin:22px 0 0;display:grid;gap:12px}.created-language{border-top:1px solid var(--line);padding-top:12px}.created-language h3{margin:0 0 8px;font:800 10px/1 var(--mono);letter-spacing:.1em;color:var(--mut);text-transform:uppercase}.created-tasks{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}.created-task{display:grid;gap:7px;background:#08111e;border:1px solid var(--line);border-radius:9px;padding:9px 10px;font:700 10px/1.25 var(--mono)}.created-task small{color:#72a7ff;line-height:1.35}.created-task.queued small{color:#f5a623}.created-task.ready small,.created-task.published small,.created-task.complete small{color:var(--green)}.created-task.failed small,.created-task.skipped small{color:var(--red)}@media(max-width:680px){.language-grid,.output-grid,.created-tasks{grid-template-columns:1fr}}';document.head.appendChild(style);
  const createdMatrix=document.createElement('div');createdMatrix.className='created-matrix';createdMatrix.id='createdMatrix';document.querySelector('.result-links').before(createdMatrix);
  const outputBoxes=[...outputPanel.querySelectorAll('input[name="output"]')],allOutputs=document.getElementById('allOutputs');
  allOutputs.addEventListener('change',()=>outputBoxes.forEach(box=>{box.checked=allOutputs.checked}));
  outputBoxes.forEach(box=>box.addEventListener('change',()=>{allOutputs.checked=outputBoxes.every(item=>item.checked)}));
  function slugify(value){return String(value||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,63)}
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
    document.getElementById('inspirationTraits').textContent=[inspiration.profile,inspiration.mode,inspiration.fontStyle,inspiration.radiusStyle,inspiration.density,inspiration.layout].filter(Boolean).join(' · ');
    preview.hidden=false;
  }
  async function analyzeInspiration(){
    const url=inspirationUrl.value.trim(); if(!url){inspirationAnalysis=null;renderInspiration(null);return null}
    analyzeButton.disabled=true; message('Analizando la dirección de arte de la web inspiradora…');
    try{
      const response=await fetch('/presentaciones/api/inspiration',{method:'POST',headers:{'content-type':'application/json','accept':'application/json'},body:JSON.stringify({url})});
      const body=await response.json().catch(()=>({})); if(!response.ok)throw new Error(body.error||`HTTP ${response.status}`);
      inspirationAnalysis=body.inspiration; document.getElementById('primaryColor').value=inspirationAnalysis.primary; document.getElementById('accentColor').value=inspirationAnalysis.accent; renderInspiration(inspirationAnalysis); message(`Estilo inspirado en ${inspirationAnalysis.host}. Puedes ajustar los colores antes de generar.`); return inspirationAnalysis;
    }finally{analyzeButton.disabled=false}
  }
  analyzeButton.addEventListener('click',()=>analyzeInspiration().catch(error=>message(error.message,true)));
  inspirationUrl.addEventListener('input',()=>{if(inspirationAnalysis&&inspirationUrl.value.trim()!==inspirationAnalysis.url){inspirationAnalysis=null;renderInspiration(null)}});
  function renderGeneration(generation){
    currentGeneration=generation;
    const tasks=Object.values(generation?.tasks||{}); if(!tasks.length){createdMatrix.innerHTML='';return}
    const html=value=>String(value==null?'':value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
    const languageNames={es:'Castellano',ca:'Català',en:'English'},date=value=>{const parsed=new Date(value||'');return Number.isFinite(parsed.getTime())?parsed.toLocaleString('es-ES',{dateStyle:'short',timeStyle:'short'}):''},state=task=>{if(['ready','published','complete'].includes(task.status))return `Finalizado${date(task.completedAt||task.updatedAt)?` · ${date(task.completedAt||task.updatedAt)}`:''}`;if(['failed','skipped'].includes(task.status))return `Error: ${task.error||(task.status==='skipped'?'entregable omitido':'el proveedor no devolvió el archivo')}`;if(task.status==='queued'){const requested=date(task.requestedAt||task.updatedAt||generation.createdAt);return requested?`Preparado para enviar desde ${requested}`:'Preparado para enviar a NotebookLM'}const since=date(task.startedAt||task.updatedAt||generation.createdAt);return since?`En proceso desde ${since}`:'En proceso'};
    createdMatrix.innerHTML=(generation.languages||[]).map(language=>{const items=tasks.filter(task=>task.language===language).map(task=>`<div class="created-task ${html(task.status)}"><span>${html(task.label)}</span><small>${html(state(task))}</small></div>`).join('');return `<section class="created-language"><h3>${html(language.toUpperCase())} · ${html(languageNames[language]||language)}</h3><div class="created-tasks">${items}</div></section>`}).join('');
  }
  form.addEventListener('submit',async event=>{
    event.preventDefault(); event.stopImmediatePropagation(); submit.disabled=true; result.classList.remove('show'); message('Analizando el problema y construyendo la presentación…');
    try{
      if(inspirationUrl.value.trim()&&!inspirationAnalysis)await analyzeInspiration();
      message('Construyendo el relato y aplicando la dirección visual…');
      const data=Object.fromEntries(new FormData(form).entries()); data.outputs=outputBoxes.filter(box=>box.checked).map(box=>box.value); data.languages=[...languagePanel.querySelectorAll('input[name="language"]:checked')].map(box=>box.value); data.inspiration=inspirationAnalysis;
      const body=await createPresentation(data); if(!body){message('No se ha modificado la presentación existente.');return}
      const absolute=new URL(body.url,location.origin).href; document.getElementById('resultUrl').textContent=absolute; document.getElementById('resultPassword').textContent=body.password||'Contraseña actual conservada';
      document.getElementById('openIdeas').href=body.ideasUrl; const openDeck=document.getElementById('openDeck');openDeck.href=body.deckUrl;openDeck.hidden=!body.outputs.includes('website'); currentGenerationUrl=`/presentaciones/${body.slug}/api/generation`; renderGeneration(body.generation); result.classList.add('show'); result.scrollIntoView({behavior:'smooth',block:'center'}); message(`Orden creada: ${body.displayName}`);
    }catch(error){message(error.message,true)}finally{submit.disabled=false}
  },true);
  setInterval(async()=>{
    if(!currentGenerationUrl||!Object.values(currentGeneration?.tasks||{}).some(task=>['queued','processing'].includes(task.status)))return;
    try{const response=await fetch(currentGenerationUrl,{headers:{accept:'application/json'},cache:'no-store'});if(!response.ok)return;renderGeneration((await response.json()).generation)}catch(_){}
  },15000);
  document.addEventListener('click',async event=>{const button=event.target.closest('[data-copy]');if(!button)return;const node=document.getElementById(button.dataset.copy);try{await navigator.clipboard.writeText(node.textContent);const before=button.textContent;button.textContent='Copiado';setTimeout(()=>button.textContent=before,1200)}catch(_){}});
})();
