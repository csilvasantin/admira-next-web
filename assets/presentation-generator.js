(function(){
  'use strict';
  window.__ADMIRA_GENERATOR_VERSION__='20260718-6';
  document.querySelector('.output-panel')?.remove();
  const form=document.getElementById('generator'),status=document.getElementById('status'),submit=document.getElementById('submit'),result=document.getElementById('result');
  const display=document.getElementById('displayName'),slug=document.getElementById('slug'); let slugTouched=true,inspirationAnalysis=null;
  const flowLabels=['Cliente','Tipo','Mood','Relato','Entregables']; document.querySelectorAll('.flow span').forEach((step,index)=>{if(flowLabels[index])step.innerHTML=`<b>${String(index+1).padStart(2,'0')}</b> ${flowLabels[index]}`});
  const thesisPanel=form.querySelectorAll('.panel')[1],thesisGrid=thesisPanel.querySelector('.grid'); thesisPanel.querySelector('h2').textContent='2. Tipo, Mood e identidad'; thesisPanel.querySelector('.sub').textContent='El tipo gobierna toda la producción. En Película, Mood añade una dirección cinematográfica concreta.';
  const movieMoods=[
    {key:'ghostbusters',film:'Cazafantasmas',year:1984,primary:'#281544',accent:'#73ff83',secondary:'#ff5f8f',description:'Paranormal urbano · ciencia de garaje · ectoplasma lúdico'},
    {key:'back-to-the-future',film:'Regreso al Futuro',year:1985,primary:'#062a4d',accent:'#ff6a1a',secondary:'#22d3ee',description:'Velocidad · optimismo tecnológico · estelas de neón'},
    {key:'alien',film:'Alien',year:1979,primary:'#071410',accent:'#b4ff35',secondary:'#6c8f7b',description:'Tensión espacial · precisión industrial · silencio'}
  ];
  const presentationTypes=[
    {key:'classic',tier:'Good',label:'Classic',description:'Profesional, luminosa y centrada en el cliente.',primary:'#172b55',accent:'#f5a623'},
    {key:'admira',tier:'Better',label:'Admira',description:'Tecnológica, oscura y cuadrática. ADN AdmiraNeXT.',primary:'#071a2f',accent:'#3df08a'},
    {key:'movie',tier:'Best',label:'Película',description:'Inmersiva y narrativa. El Mood dirige la atmósfera.'}
  ];
  const replacementDialog=document.createElement('dialog'); replacementDialog.className='replacement-dialog'; replacementDialog.setAttribute('aria-labelledby','replacementTitle');
  replacementDialog.innerHTML='<div class="replacement-modal"><span class="replacement-kicker">Control de versiones</span><h2 id="replacementTitle">Ya existe una presentación</h2><p id="replacementCopy"></p><div class="replacement-backup"><b>Backup automático</b><span>Guardaremos configuración, esqueleto y trabajos anteriores antes de crear la nueva versión.</span></div><div class="replacement-actions"><button class="btn" id="keepPresentation" type="button">No, conservar la actual</button><button class="btn primary" id="replacePresentation" type="button">Sí, crear otra</button></div></div>';
  document.body.appendChild(replacementDialog);
  const replacementStyle=document.createElement('style'); replacementStyle.textContent='.replacement-dialog{width:min(560px,calc(100% - 28px));padding:0;border:1px solid var(--line);border-radius:20px;background:var(--panel);color:var(--ink);box-shadow:0 32px 100px rgba(0,0,0,.55)}.replacement-dialog::backdrop{background:rgba(2,7,13,.76);backdrop-filter:blur(8px)}.replacement-modal{padding:clamp(24px,5vw,38px)}.replacement-kicker{display:block;color:var(--green);font:800 10px/1 var(--mono);letter-spacing:.15em;text-transform:uppercase}.replacement-modal h2{font-size:clamp(27px,5vw,39px);line-height:1.05;letter-spacing:-.035em;margin:14px 0 12px}.replacement-modal p{margin:0;color:var(--mut);font-size:15px}.replacement-backup{display:grid;gap:5px;margin:23px 0;padding:16px;border:1px solid rgba(61,240,138,.28);border-radius:13px;background:rgba(61,240,138,.07)}.replacement-backup b{color:var(--green);font-size:13px}.replacement-backup span{color:var(--mut);font-size:13px;line-height:1.45}.replacement-actions{display:flex;justify-content:flex-end;gap:9px}.replacement-actions .btn{margin:0}@media(max-width:560px){.replacement-actions{flex-direction:column-reverse}.replacement-actions .btn{width:100%}}'; document.head.appendChild(replacementStyle);
  let replacementResolver=null;
  function finishReplacement(value){if(!replacementResolver)return;const resolve=replacementResolver;replacementResolver=null;if(replacementDialog.open)replacementDialog.close();resolve(value)}
  function confirmReplacement(name){
    const prompt=`Ya existe una presentación para ${name||'este cliente'}. ¿Quieres crear una nueva versión? La actual se guardará primero como backup recuperable.`;
    if(typeof replacementDialog.showModal!=='function')return Promise.resolve(window.confirm(prompt));
    document.getElementById('replacementCopy').textContent=prompt;
    if(replacementDialog.open)replacementDialog.close();
    return new Promise(resolve=>{replacementResolver=resolve;replacementDialog.showModal();document.getElementById('keepPresentation').focus()});
  }
  document.getElementById('keepPresentation').addEventListener('click',()=>finishReplacement(false));
  document.getElementById('replacePresentation').addEventListener('click',()=>finishReplacement(true));
  replacementDialog.addEventListener('cancel',event=>{event.preventDefault();finishReplacement(false)});
  const typeField=document.createElement('fieldset'); typeField.className='field full presentation-type-field';
  typeField.innerHTML='<legend>Look & feel · Good / Better / Best</legend><div class="presentation-types">'+presentationTypes.map((type,index)=>`<label class="presentation-type"><input type="radio" name="presentationStyle" value="${type.key}" ${index===2?'checked':''}><span class="presentation-tier">${type.tier}</span><b>${type.label}</b><small>${type.description}</small></label>`).join('')+'</div><p class="field-help">Funciona como el idioma: el contenido se mantiene y cambia la dirección visual de todo el sistema —site, portal, PDF, PowerPoint, documentos, infografía, audio y vídeo.</p>';
  thesisGrid.prepend(typeField);
  const moodField=document.createElement('div'); moodField.className='field full mood-field';
  moodField.innerHTML='<label for="moodMovie">Mood · película de referencia</label><div class="mood-input"><input id="moodMovie" name="moodMovie" type="text" list="moodMovies" autocomplete="off" placeholder="Escribe cualquier película…"><button class="btn" id="randomMood" type="button" title="Elegir otro mood al azar">↻ Aleatoria 80/90</button></div><datalist id="moodMovies"><option value="Cazafantasmas"><option value="Regreso al Futuro"><option value="Alien"></datalist><div class="mood-presets" id="moodPresets"></div><p class="field-help">El contenido no cambia: Mood transforma paleta, tipografía, composición, ritmo y textura. Por ahora el azar elige entre estas tres referencias de cultura pop.</p><div class="mood-preview" id="moodPreview" role="status" aria-live="polite"></div>';
  thesisGrid.insertBefore(moodField,typeField.nextSibling);
  const inspirationField=document.createElement('div'); inspirationField.className='field full inspiration-field';
  inspirationField.innerHTML='<label for="inspirationUrl">Web inspiradora · opcional</label><div class="inspiration-input"><input id="inspirationUrl" name="inspirationUrl" type="url" placeholder="https://web-que-nos-inspira.com/"><button class="btn" id="analyzeInspiration" type="button">Analizar estilo</button></div><p class="field-help">Extraemos paleta, tipografía, geometría, densidad y composición. No copiamos código ni elementos de marca.</p><div class="inspiration-preview" id="inspirationPreview" hidden><div class="inspiration-palette" id="inspirationPalette"></div><div><b id="inspirationTitle">Dirección visual</b><span id="inspirationTraits"></span></div></div>';
  thesisGrid.insertBefore(inspirationField,moodField.nextSibling);
  const inspirationStyle=document.createElement('style'); inspirationStyle.textContent='.presentation-type-field{border:0;padding:0;margin:0}.presentation-type-field legend{font:750 10px/1 var(--mono);letter-spacing:.09em;text-transform:uppercase;color:var(--mut);margin-bottom:8px}.presentation-types{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.presentation-type{display:grid;grid-template-columns:auto 1fr;align-items:center;gap:7px 9px;border:1px solid var(--line);border-radius:13px;padding:15px;background:#08111e;cursor:pointer;margin:0;color:var(--ink);text-transform:none;letter-spacing:0}.presentation-type:has(input:checked){border-color:var(--green);background:rgba(61,240,138,.07);box-shadow:inset 0 0 0 1px rgba(61,240,138,.16)}.presentation-type input{grid-row:1/3;width:auto;margin:0;accent-color:var(--green)}.presentation-type b{font-size:15px}.presentation-type small{grid-column:2;color:var(--mut);font-size:11px;line-height:1.4}.presentation-tier{font:800 9px/1 var(--mono);letter-spacing:.11em;text-transform:uppercase;color:var(--green)}.mood-field[hidden]{display:none}.mood-input,.inspiration-input{display:grid;grid-template-columns:1fr auto;gap:9px}.mood-input .btn,.inspiration-input .btn{white-space:nowrap}.mood-presets{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.mood-chip{border:1px solid var(--line);border-radius:999px;padding:8px 11px;background:#08111e;color:var(--mut);font:800 10px/1 var(--mono);cursor:pointer}.mood-chip:hover,.mood-chip.active{border-color:var(--green);color:var(--green);background:rgba(61,240,138,.07)}.field-help{margin:9px 0 0;color:var(--mut);font-size:12px}.mood-preview,.inspiration-preview{margin-top:14px;display:flex;align-items:center;gap:14px;border:1px solid var(--line);border-radius:13px;padding:14px;background:#08111e}.mood-preview b,.mood-preview span,.inspiration-preview b,.inspiration-preview span{display:block}.mood-preview b,.inspiration-preview b{font-size:14px}.mood-preview span,.inspiration-preview span{margin-top:4px;color:var(--mut);font:700 10px/1.45 var(--mono);text-transform:uppercase;letter-spacing:.05em}.mood-palette,.inspiration-palette{display:flex;flex:none}.mood-palette i,.inspiration-palette i{width:25px;height:42px;border:2px solid #08111e;margin-left:-5px}.mood-palette i:first-child,.inspiration-palette i:first-child{margin-left:0;border-radius:9px 0 0 9px}.mood-palette i:last-child,.inspiration-palette i:last-child{border-radius:0 9px 9px 0}@media(max-width:680px){.presentation-types,.mood-input,.inspiration-input{grid-template-columns:1fr}.mood-input .btn,.inspiration-input .btn{width:100%}.mood-preview{align-items:flex-start}}'; document.head.appendChild(inspirationStyle);
  const typeInputs=[...typeField.querySelectorAll('input[name="presentationStyle"]')],moodMovie=document.getElementById('moodMovie'),moodPresets=document.getElementById('moodPresets'),moodPreview=document.getElementById('moodPreview'),randomMoodButton=document.getElementById('randomMood');
  moodPresets.innerHTML=movieMoods.map(mood=>`<button class="mood-chip" type="button" data-mood="${mood.key}">${mood.film}</button>`).join('');
  function normalizeMovie(value){return String(value||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim()}
  function moodPreset(value){const normalized=normalizeMovie(value);return movieMoods.find(mood=>normalizeMovie(mood.film)===normalized||mood.key.replace(/-/g,' ')===normalized)}
  function renderMood(applyColors=false){
    const preset=moodPreset(moodMovie.value); moodPresets.querySelectorAll('[data-mood]').forEach(button=>button.classList.toggle('active',button.dataset.mood===preset?.key));
    if(preset){
      if(applyColors){document.getElementById('primaryColor').value=preset.primary;document.getElementById('accentColor').value=preset.accent}
      moodPreview.innerHTML=`<div class="mood-palette"><i style="background:${preset.primary}"></i><i style="background:${preset.accent}"></i><i style="background:${preset.secondary}"></i></div><div><b>${preset.film} · ${preset.year}</b><span>${preset.description}</span></div>`;
    }else{
      const title=moodMovie.value.trim()||'Mood personalizado'; moodPreview.innerHTML=`<div><b>${title}</b><span>Dirección cinematográfica personalizada · sin copiar elementos protegidos</span></div>`;
    }
  }
  function chooseRandomMood(){
    const current=moodPreset(moodMovie.value); const choices=movieMoods.filter(mood=>movieMoods.length<2||mood.key!==current?.key); let index=Math.floor(Math.random()*choices.length);
    try{const values=new Uint32Array(1);crypto.getRandomValues(values);index=values[0]%choices.length}catch(_){}
    moodMovie.value=choices[index].film; renderMood(true);
  }
  function currentPresentationStyle(){return typeInputs.find(input=>input.checked)?.value||'movie'}
  function applyPresentationStyle(style=currentPresentationStyle(),applyColors=true){
    const type=presentationTypes.find(item=>item.key===style)||presentationTypes[2]; moodField.hidden=type.key!=='movie'; moodMovie.disabled=type.key!=='movie';
    if(!applyColors)return;
    if(type.key==='movie')renderMood(true); else{document.getElementById('primaryColor').value=type.primary;document.getElementById('accentColor').value=type.accent}
  }
  moodPresets.addEventListener('click',event=>{const button=event.target.closest('[data-mood]');if(!button)return;const preset=movieMoods.find(mood=>mood.key===button.dataset.mood);moodMovie.value=preset.film;renderMood(true)});
  randomMoodButton.addEventListener('click',chooseRandomMood); moodMovie.addEventListener('input',()=>renderMood(false)); typeInputs.forEach(input=>input.addEventListener('change',()=>applyPresentationStyle(input.value,true))); chooseRandomMood(); applyPresentationStyle('movie',true);
  const inspirationUrl=document.getElementById('inspirationUrl'),analyzeButton=document.getElementById('analyzeInspiration');
  const languagePanel=document.createElement('section'); languagePanel.className='panel language-panel';
  languagePanel.innerHTML='<h2>4. Idiomas</h2><p class="sub">Selecciona las versiones del site. Después podrás editar cada idioma por separado.</p><div class="language-grid"><label class="language"><input type="checkbox" name="language" value="es" checked><b>ES</b><span>Castellano</span></label><label class="language"><input type="checkbox" name="language" value="ca" checked><b>CA</b><span>Català</span></label><label class="language"><input type="checkbox" name="language" value="en" checked><b>EN</b><span>English</span></label></div>';
  const outputPanel=document.createElement('section'); outputPanel.className='panel output-panel';
  outputPanel.innerHTML='<h2>5. ¿Qué queremos obtener?</h2><p class="sub">Selecciona los entregables que AdmiraNeXT debe preparar para este cliente.</p><div class="output-grid"><label class="output"><input type="checkbox" name="output" value="website" checked><b>01</b><span>Website</span></label><label class="output"><input type="checkbox" name="output" value="audio" checked><b>02</b><span>Audio</span></label><label class="output"><input type="checkbox" name="output" value="video" checked><b>03</b><span>Vídeo</span></label><label class="output"><input type="checkbox" name="output" value="pdf" checked><b>04</b><span>PDF</span></label><label class="output"><input type="checkbox" name="output" value="powerpoint" checked><b>05</b><span>PowerPoint</span></label><label class="output"><input type="checkbox" name="output" value="documents" checked><b>06</b><span>Documento de trabajo</span></label><label class="output"><input type="checkbox" name="output" value="infographic" checked><b>07</b><span>Infografía</span></label><label class="output all"><input type="checkbox" id="allOutputs" checked><b>08</b><span>Todo</span></label></div>';
  form.insertBefore(languagePanel,status); form.insertBefore(outputPanel,status);
  const style=document.createElement('style');style.textContent='.language-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.language{display:flex;align-items:center;gap:11px;border:1px solid var(--line);border-radius:12px;padding:16px;background:#08111e;color:var(--ink);cursor:pointer;text-transform:none;letter-spacing:0;margin:0}.language:has(input:checked){border-color:var(--green);background:rgba(61,240,138,.07)}.language input{width:auto;margin:0;accent-color:var(--green)}.language b{font:800 11px/1 var(--mono);color:var(--green)}.language span{font:700 14px/1.25 var(--sans)}.output-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.output{display:flex;align-items:center;gap:11px;border:1px solid var(--line);border-radius:12px;padding:14px;background:#08111e;color:var(--ink);cursor:pointer;text-transform:none;letter-spacing:0;margin:0}.output:has(input:checked){border-color:var(--green);background:rgba(61,240,138,.07)}.output input{width:auto;margin:0;accent-color:var(--green)}.output b{font:800 10px/1 var(--mono);color:var(--green)}.output span{font:700 14px/1.25 var(--sans)}.output.all{border-style:dashed}.created-matrix{margin:22px 0 0;display:grid;gap:12px}.created-language{border-top:1px solid var(--line);padding-top:12px}.created-language h3{margin:0 0 8px;font:800 10px/1 var(--mono);letter-spacing:.1em;color:var(--mut);text-transform:uppercase}.created-tasks{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}.created-task{display:flex;justify-content:space-between;gap:7px;background:#08111e;border:1px solid var(--line);border-radius:9px;padding:9px 10px;font:700 10px/1.2 var(--mono)}.created-task small{color:var(--mut);text-transform:uppercase}.created-task.ready small{color:var(--green)}@media(max-width:680px){.language-grid,.output-grid,.created-tasks{grid-template-columns:1fr}}';document.head.appendChild(style);
  const createdMatrix=document.createElement('div');createdMatrix.className='created-matrix';createdMatrix.id='createdMatrix';document.querySelector('.result-links').before(createdMatrix);
  const outputBoxes=[...outputPanel.querySelectorAll('input[name="output"]')],allOutputs=document.getElementById('allOutputs');
  allOutputs.addEventListener('change',()=>outputBoxes.forEach(box=>{box.checked=allOutputs.checked}));
  outputBoxes.forEach(box=>box.addEventListener('change',()=>{allOutputs.checked=outputBoxes.every(item=>item.checked)}));
  function slugify(value){return String(value||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,63)}
  slug.addEventListener('input',()=>{slugTouched=Boolean(slug.value)}); display.addEventListener('input',()=>{if(!slugTouched)slug.value=slugify(display.value)});
  function message(value,error){status.textContent=value;status.className=`status${error?' error':''}`}
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
      inspirationAnalysis=body.inspiration; document.getElementById('primaryColor').value=inspirationAnalysis.primary; document.getElementById('accentColor').value=inspirationAnalysis.accent; renderInspiration(inspirationAnalysis); if(currentPresentationStyle()==='movie'&&moodPreset(moodMovie.value))renderMood(true); message('Inspiración analizada y combinada con el tipo elegido. Puedes ajustar los colores antes de generar.'); return inspirationAnalysis;
    }finally{analyzeButton.disabled=false}
  }
  analyzeButton.addEventListener('click',()=>analyzeInspiration().catch(error=>message(error.message,true)));
  inspirationUrl.addEventListener('input',()=>{if(inspirationAnalysis&&inspirationUrl.value.trim()!==inspirationAnalysis.url){inspirationAnalysis=null;renderInspiration(null)}});
  function renderGeneration(generation){
    const tasks=Object.values(generation?.tasks||{}); if(!tasks.length){createdMatrix.innerHTML='';return}
    const languageNames={es:'Castellano',ca:'Català',en:'English'},states={queued:'En cola',processing:'Produciendo',ready:'Listo',published:'Publicado',failed:'Error'};
    createdMatrix.innerHTML=(generation.languages||[]).map(language=>{const items=tasks.filter(task=>task.language===language).map(task=>`<div class="created-task ${task.status}"><span>${task.label}</span><small>${states[task.status]||task.status}</small></div>`).join('');return `<section class="created-language"><h3>${language.toUpperCase()} · ${languageNames[language]||language}</h3><div class="created-tasks">${items}</div></section>`}).join('');
  }
  async function requestGeneration(overwrite=false){
    const data=Object.fromEntries(new FormData(form).entries()); data.overwrite=overwrite; data.outputs=outputBoxes.filter(box=>box.checked).map(box=>box.value); data.languages=[...languagePanel.querySelectorAll('input[name="language"]:checked')].map(box=>box.value); data.inspiration=inspirationAnalysis; data.presentationStyle=currentPresentationStyle(); data.moodMovie=data.presentationStyle==='movie'?moodMovie.value.trim():'';
    const response=await fetch('/presentaciones/api/generate',{method:'PUT',headers:{'content-type':'application/json','accept':'application/json'},body:JSON.stringify(data)});
    const body=await response.json().catch(()=>({}));
    if(response.status===409&&body.exists&&!overwrite){
      const confirmed=await confirmReplacement(display.value.trim());
      if(!confirmed){message('Se conserva la presentación actual. No se ha realizado ningún cambio.');return null}
      message('Guardando la versión anterior como backup antes de crear la nueva…');
      return requestGeneration(true);
    }
    if(!response.ok)throw new Error(body.error||`HTTP ${response.status}`);
    return body;
  }
  form.addEventListener('submit',async event=>{
    event.preventDefault(); event.stopImmediatePropagation(); submit.disabled=true; result.classList.remove('show'); message('Analizando el problema y construyendo la presentación…');
    try{
      if(inspirationUrl.value.trim()&&!inspirationAnalysis)await analyzeInspiration();
      message('Construyendo el relato y aplicando la dirección visual…');
      const body=await requestGeneration(false); if(!body)return;
      const absolute=new URL(body.url,location.origin).href; document.getElementById('resultUrl').textContent=absolute; document.getElementById('resultPassword').textContent=body.password||'Contraseña actual conservada';
      result.querySelector('p').textContent=body.backup?`La versión anterior se ha guardado como backup recuperable · ${body.backup.id.slice(0,8)}.`:'Guarda la contraseña y abre el editor para revisar el relato antes de compartirlo.';
      document.getElementById('openIdeas').href=body.ideasUrl; const openDeck=document.getElementById('openDeck');openDeck.href=body.deckUrl;openDeck.hidden=!body.outputs.includes('website'); renderGeneration(body.generation); result.classList.add('show'); result.scrollIntoView({behavior:'smooth',block:'center'}); const type=presentationTypes.find(item=>item.key===body.presentationStyle)||presentationTypes[2]; message(`${body.backup?'Backup guardado · ':''}Orden creada: ${body.displayName} · ${type.tier} / ${type.label}${body.mood?.film?` · Mood ${body.mood.film}`:''}`);
    }catch(error){message(error.message,true)}finally{submit.disabled=false}
  },true);
  document.addEventListener('click',async event=>{const button=event.target.closest('[data-copy]');if(!button)return;const node=document.getElementById(button.dataset.copy);try{await navigator.clipboard.writeText(node.textContent);const before=button.textContent;button.textContent='Copiado';setTimeout(()=>button.textContent=before,1200)}catch(_){}});
})();
