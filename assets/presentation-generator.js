(function(){
  'use strict';
  const form=document.getElementById('generator'),status=document.getElementById('status'),submit=document.getElementById('submit'),result=document.getElementById('result');
  const display=document.getElementById('displayName'),slug=document.getElementById('slug'); let slugTouched=true;
  const outputPanel=document.createElement('section'); outputPanel.className='panel output-panel';
  outputPanel.innerHTML='<h2>4. ¿Qué queremos obtener?</h2><p class="sub">Selecciona los entregables que AdmiraNeXT debe preparar para este cliente.</p><div class="output-grid"><label class="output"><input type="checkbox" name="output" value="website" checked><b>01</b><span>Website</span></label><label class="output"><input type="checkbox" name="output" value="audio" checked><b>02</b><span>Audio</span></label><label class="output"><input type="checkbox" name="output" value="video" checked><b>03</b><span>Vídeo</span></label><label class="output"><input type="checkbox" name="output" value="pdf" checked><b>04</b><span>PDF</span></label><label class="output"><input type="checkbox" name="output" value="powerpoint" checked><b>05</b><span>PowerPoint</span></label><label class="output"><input type="checkbox" name="output" value="documents" checked><b>06</b><span>Documento de trabajo</span></label><label class="output"><input type="checkbox" name="output" value="infographic" checked><b>07</b><span>Infografía</span></label><label class="output all"><input type="checkbox" id="allOutputs" checked><b>08</b><span>Todo</span></label></div>';
  form.insertBefore(outputPanel,status);
  const style=document.createElement('style');style.textContent='.output-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.output{display:flex;align-items:center;gap:11px;border:1px solid var(--line);border-radius:12px;padding:14px;background:#08111e;color:var(--ink);cursor:pointer;text-transform:none;letter-spacing:0;margin:0}.output:has(input:checked){border-color:var(--green);background:rgba(61,240,138,.07)}.output input{width:auto;margin:0;accent-color:var(--green)}.output b{font:800 10px/1 var(--mono);color:var(--green)}.output span{font:700 14px/1.25 var(--sans)}.output.all{border-style:dashed}@media(max-width:680px){.output-grid{grid-template-columns:1fr}}';document.head.appendChild(style);
  const outputBoxes=[...outputPanel.querySelectorAll('input[name="output"]')],allOutputs=document.getElementById('allOutputs');
  allOutputs.addEventListener('change',()=>outputBoxes.forEach(box=>{box.checked=allOutputs.checked}));
  outputBoxes.forEach(box=>box.addEventListener('change',()=>{allOutputs.checked=outputBoxes.every(item=>item.checked)}));
  function slugify(value){return String(value||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,63)}
  slug.addEventListener('input',()=>{slugTouched=Boolean(slug.value)}); display.addEventListener('input',()=>{if(!slugTouched)slug.value=slugify(display.value)});
  function message(value,error){status.textContent=value;status.className=`status${error?' error':''}`}
  form.addEventListener('submit',async event=>{
    event.preventDefault(); submit.disabled=true; result.classList.remove('show'); message('Analizando el problema y construyendo la presentación…');
    const data=Object.fromEntries(new FormData(form).entries()); data.overwrite=document.getElementById('overwrite').checked; data.outputs=outputBoxes.filter(box=>box.checked).map(box=>box.value);
    try{
      const response=await fetch('/presentaciones/api/generate',{method:'PUT',headers:{'content-type':'application/json','accept':'application/json'},body:JSON.stringify(data)});
      const body=await response.json().catch(()=>({})); if(!response.ok)throw new Error(body.error||`HTTP ${response.status}`);
      const absolute=new URL(body.url,location.origin).href; document.getElementById('resultUrl').textContent=absolute; document.getElementById('resultPassword').textContent=body.password||'Contraseña actual conservada';
      document.getElementById('openIdeas').href=body.ideasUrl; const openDeck=document.getElementById('openDeck');openDeck.href=body.deckUrl;openDeck.hidden=!body.outputs.includes('website'); result.classList.add('show'); result.scrollIntoView({behavior:'smooth',block:'center'}); message(`Creada: ${body.displayName}`);
    }catch(error){message(error.message,true)}finally{submit.disabled=false}
  });
  document.addEventListener('click',async event=>{const button=event.target.closest('[data-copy]');if(!button)return;const node=document.getElementById(button.dataset.copy);try{await navigator.clipboard.writeText(node.textContent);const before=button.textContent;button.textContent='Copiado';setTimeout(()=>button.textContent=before,1200)}catch(_){}});
})();
