(function(){
  'use strict';
  if(window.__ADMIRA_CAN_EDIT__!==true||!window.__ADMIRA_PRESENTATION_STATE__)return;
  const state=window.__ADMIRA_PRESENTATION_STATE__;let editable=[...document.querySelectorAll('[data-edit-field]')];
  const match=location.pathname.match(/^\/presentaciones\/([a-z0-9-]+)\/presentacion\/?$/i);if(!match||!editable.length)return;
  const client=match[1].toLowerCase();let originals=new Map(),editing=false,busy=false,history=[],historyIndex=-1,restoring=false;
  const style=document.createElement('style');
  style.textContent='.inline-editor{position:fixed;z-index:30;left:18px;top:18px;display:flex;align-items:center;flex-wrap:wrap;gap:7px;padding:6px;background:color-mix(in srgb,var(--surface) 88%,transparent);border:1px solid color-mix(in srgb,var(--ink) 18%,transparent);border-radius:calc(var(--radius) + 16px);backdrop-filter:blur(14px);box-shadow:0 12px 36px rgba(0,0,0,.24)}.inline-editor[hidden]{display:none}.inline-editor button{border:0;border-radius:calc(var(--radius) + 10px);padding:10px 12px;background:transparent;color:var(--ink);font:800 10px/1 var(--mono);letter-spacing:.04em;cursor:pointer}.inline-editor button.primary{background:var(--accent);color:var(--bg)}.inline-editor button:disabled{opacity:.45;cursor:not-allowed}.inline-editor .state{max-width:220px;color:color-mix(in srgb,var(--ink) 68%,transparent);font:700 9px/1.35 var(--mono)}.inline-editor .state.error{color:#ff7b8a}html[data-inline-editing="true"] [data-edit-field]{outline:1px dashed color-mix(in srgb,var(--accent) 72%,transparent);outline-offset:7px;border-radius:4px;cursor:text;transition:outline-color .15s,background .15s}html[data-inline-editing="true"] [data-edit-field]:focus{outline:2px solid var(--accent);background:color-mix(in srgb,var(--surface) 30%,transparent)}@media(max-width:700px){.inline-editor{top:auto;bottom:16px;left:12px;right:12px;justify-content:center}.inline-editor .state{flex-basis:100%;max-width:none;text-align:center}.languages{top:12px;right:12px}}';
  style.textContent+='.inline-editor{top:68px}.quality-levels{position:fixed;z-index:31;left:18px;top:18px;display:flex;align-items:center;gap:5px;padding:4px;background:color-mix(in srgb,var(--surface) 84%,transparent);border:1px solid color-mix(in srgb,var(--ink) 18%,transparent);border-radius:calc(var(--radius) + 16px);backdrop-filter:blur(12px);box-shadow:0 8px 24px rgba(0,0,0,.14);font:800 9px/1 var(--mono);letter-spacing:.05em;text-transform:uppercase}.quality-levels button{border:0;padding:8px 10px;border-radius:calc(var(--radius) + 10px);background:transparent;color:color-mix(in srgb,var(--ink) 60%,transparent);font:inherit;letter-spacing:inherit;text-transform:inherit;cursor:pointer}.quality-levels button[aria-pressed="true"]{background:var(--accent);color:var(--bg)}.quality-levels button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}@media(max-width:700px){.quality-levels{left:12px;top:12px}.inline-editor{top:auto}}.slide-delete{display:none;position:absolute;z-index:5;top:18px;right:18px;border:1px solid color-mix(in srgb,var(--ink) 18%,transparent);border-radius:calc(var(--radius) + 10px);padding:8px 11px;background:color-mix(in srgb,var(--surface) 88%,transparent);color:var(--ink);font:800 9px/1 var(--mono);letter-spacing:.04em;cursor:pointer}html[data-inline-editing="true"] .slide-delete{display:inline-flex}.slide-delete:hover,.slide-delete:focus-visible{background:#ff6b6b;color:#240707;border-color:#ff6b6b}.inline-editor button.delete-slide{color:#ff7b8a}.budget-edit-tools{display:none;margin-top:14px}html[data-inline-editing="true"] .budget-edit-tools{display:flex;gap:8px;flex-wrap:wrap}';
  document.head.appendChild(style);
  const quality=document.createElement('div'),activeQuality=state.quality||document.querySelector('.deck-slide')?.dataset.deckQuality||'good',qualityHelp={es:{good:'Look & feel de la presentación Admira',better:'Cada lámina con imagen temática del tema (Grok)',best:'Imagen descriptiva encima del fondo + tipografía editorial'},ca:{good:'Look & feel de la presentació d\'Admira',better:'Cada làmina amb imatge temàtica del tema (Grok)',best:'Imatge descriptiva sobre el fons + tipografia editorial'},en:{good:'Admira presentation look and feel',better:'Each slide gets a thematic image for its topic (Grok)',best:'Descriptive figure over the background + editorial type'}};quality.className='quality-levels';quality.setAttribute('aria-label','Good, Better and Best');quality.innerHTML=['good','better','best'].map(level=>`<button type="button" data-quality="${level}" aria-pressed="${level===activeQuality?'true':'false'}">${level[0].toUpperCase()+level.slice(1)}</button>`).join('');const localizeQuality=language=>{const labels=qualityHelp[language]||qualityHelp.es;quality.querySelectorAll('[data-quality]').forEach(button=>button.title=labels[button.dataset.quality])};localizeQuality(state.language);document.addEventListener('admira:language',event=>localizeQuality(event.detail?.language));quality.addEventListener('click',event=>{const button=event.target.closest('[data-quality]');if(!button||typeof window.__ADMIRA_APPLY_QUALITY__!=='function')return;window.__ADMIRA_APPLY_QUALITY__(button.dataset.quality);const url=new URL(location.href);url.searchParams.set('quality',button.dataset.quality);history.replaceState(null,'',url)});document.body.prepend(quality);
  const toolbar=document.createElement('div');toolbar.className='inline-editor';toolbar.hidden=true;toolbar.setAttribute('role','toolbar');toolbar.setAttribute('aria-label','Edición de la presentación');
  toolbar.innerHTML='<button type="button" class="save primary">Guardar y traducir</button><button type="button" class="undo" aria-label="Deshacer" title="Deshacer (Ctrl/⌘+Z)">↶ Deshacer</button><button type="button" class="redo" aria-label="Rehacer" title="Rehacer (Ctrl+Y / ⌘+Mayús+Z)">↷ Rehacer</button><button type="button" class="delete-slide" title="Eliminar lámina actual (Ctrl+Backspace)">Eliminar lámina</button><button type="button" class="cancel">Cancelar</button><span class="state" aria-live="polite">Editando el idioma visible</span>';
  document.body.appendChild(toolbar);
  const save=toolbar.querySelector('.save'),undo=toolbar.querySelector('.undo'),redo=toolbar.querySelector('.redo'),removeBtn=toolbar.querySelector('.delete-slide'),cancel=toolbar.querySelector('.cancel'),status=toolbar.querySelector('.state');
  const nav=document.querySelector('.nav'),editHints={es:' · Ctrl+E editar textos · Ctrl+⌫ quitar lámina',ca:' · Ctrl+E editar textos · Ctrl+⌫ treure làmina',en:' · Ctrl+E edit text · Ctrl+⌫ delete slide'};
  const localizeEditorHint=language=>{if(!nav)return;nav.dataset.editorHint=editHints[language]||editHints.es;if(typeof window.__ADMIRA_SYNC_NAV__==='function')window.__ADMIRA_SYNC_NAV__()};
  localizeEditorHint(state.language);document.addEventListener('admira:language',event=>localizeEditorHint(event.detail?.language));
  const setStatus=(value,error=false)=>{status.textContent=value;status.classList.toggle('error',error)};
  const budgetRound2=n=>Math.round((Number(n)||0)*100)/100;
  const budgetLineAmount=(price,discount,iva)=>{const net=budgetRound2(Math.max(0,price)*(1-Math.min(100,Math.max(0,discount))/100));const tax=budgetRound2(net*(Math.min(100,Math.max(0,iva))/100));return budgetRound2(net+tax)};
  const budgetMoney=n=>{try{return budgetRound2(n).toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})+' €'}catch(_){return budgetRound2(n).toFixed(2)+' €'}};
  let originalBudgetSnapshot='[]';
  function budgetSlide(){return document.querySelector('[data-slide-key="budget"]')}
  function parseBudgetNumber(value){const n=Number(String(value||'').replace(/\s/g,'').replace('€','').replace(/\./g,'').replace(',','.'));return Number.isFinite(n)?n:0}
  function collectBudgetLines(){
    const rows=[...document.querySelectorAll('[data-budget-body] tr[data-budget-line]')];
    const lines=[];
    rows.forEach((row,index)=>{
      const read=(key)=>{const input=row.querySelector('[data-budget-'+key+'] input');const node=row.querySelector('[data-budget-'+key+']');return input?input.value:node?node.textContent:''};
      const concept=String(read('concept')||'').replace(/\s+/g,' ').trim().slice(0,180);
      const price=Math.max(0,budgetRound2(parseBudgetNumber(read('price'))));
      const discount=Math.min(100,Math.max(0,budgetRound2(parseBudgetNumber(read('discount')))));
      const ivaRaw=read('iva');
      const iva=String(ivaRaw).trim()===''?21:Math.min(100,Math.max(0,budgetRound2(parseBudgetNumber(ivaRaw))));
      if(!concept&&price<=0)return;
      lines.push({id:row.getAttribute('data-budget-line')||('line-'+(index+1)),concept,price,discount,iva});
    });
    return lines.slice(0,40);
  }
  function recalcBudgetRow(row){
    if(!row)return;
    const num=(key)=>{const input=row.querySelector('[data-budget-'+key+'] input');return parseBudgetNumber(input?input.value:'')};
    const price=Math.max(0,num('price'));
    const discount=Math.min(100,Math.max(0,num('discount')));
    const ivaInput=row.querySelector('[data-budget-iva] input');
    const iva=ivaInput&&String(ivaInput.value).trim()===''?21:Math.min(100,Math.max(0,num('iva')));
    const amountNode=row.querySelector('[data-budget-amount]');
    if(amountNode)amountNode.textContent=budgetMoney(budgetLineAmount(price,discount,iva));
    recalcBudgetTotals();
  }
  function recalcBudgetTotals(){
    const lines=collectBudgetLines();
    let base=0,discountTotal=0,ivaTotal=0,total=0;
    lines.forEach(line=>{
      const net=budgetRound2(line.price*(1-line.discount/100));
      const tax=budgetRound2(net*(line.iva/100));
      const amount=budgetRound2(net+tax);
      base=budgetRound2(base+line.price);
      discountTotal=budgetRound2(discountTotal+budgetRound2(line.price-net));
      ivaTotal=budgetRound2(ivaTotal+tax);
      total=budgetRound2(total+amount);
    });
    const slide=budgetSlide();
    if(!slide)return;
    const set=(key,value)=>{const node=slide.querySelector('[data-budget-total="'+key+'"]');if(node)node.textContent=budgetMoney(value)};
    set('base',base);set('discountTotal',discountTotal);set('ivaTotal',ivaTotal);set('total',total);
  }
  function budgetInput(value,kind){
    const input=document.createElement('input');
    input.type=kind==='concept'?'text':'number';
    input.value=value;
    if(kind==='concept'){input.maxLength=180;input.placeholder='Concepto'}
    else{input.min='0';input.max=kind==='price'?'999999999':'100';input.step=kind==='price'?'0.01':'1';if(kind==='iva'&&value==='')input.placeholder='21'}
    input.setAttribute('aria-label',kind);
    return input;
  }
  function addBudgetRow(line){
    const body=document.querySelector('[data-budget-body]');
    if(!body)return;
    body.querySelector('.budget-empty-row')?.remove();
    if(body.querySelectorAll('tr[data-budget-line]').length>=40)return;
    const row=document.createElement('tr');
    const id=line?.id||('line-'+Date.now());
    row.setAttribute('data-budget-line',id);
    const cells=[['concept',line?.concept||''],['price',line?.price??''],['discount',line?.discount??'0'],['iva',line?.iva??'21'],['amount','']];
    cells.forEach(([key,value])=>{
      const td=document.createElement('td');
      td.setAttribute('data-budget-'+key,'');
      if(key==='amount'){td.textContent=budgetMoney(0)}
      else td.appendChild(budgetInput(value===0||value?String(value):'',key));
      row.appendChild(td);
    });
    const removeTd=document.createElement('td');
    const remove=document.createElement('button');
    remove.type='button';remove.className='budget-row-remove';remove.textContent='Quitar';
    remove.addEventListener('click',()=>{row.remove();if(!body.querySelector('tr[data-budget-line]')){const empty=document.createElement('tr');empty.className='budget-empty-row';empty.innerHTML='<td colspan="6" data-budget-empty>Sin partidas</td>';body.appendChild(empty)}recalcBudgetTotals()});
    removeTd.appendChild(remove);row.appendChild(removeTd);
    body.appendChild(row);
    row.querySelectorAll('input').forEach(input=>input.addEventListener('input',()=>recalcBudgetRow(row)));
    recalcBudgetRow(row);
  }
  function mountBudgetEditor(){
    const slide=budgetSlide();const body=slide?.querySelector('[data-budget-body]');
    if(!slide||!body||slide.hasAttribute('data-budget-editing'))return;
    originalBudgetSnapshot=JSON.stringify(collectBudgetLines());
    slide.setAttribute('data-budget-editing','true');
    const existing=[...body.querySelectorAll('tr[data-budget-line]')].map(row=>{
      const text=(key)=>row.querySelector('[data-budget-'+key+']')?.textContent||'';
      return {id:row.getAttribute('data-budget-line'),concept:text('concept').trim(),price:parseBudgetNumber(text('price')),discount:parseBudgetNumber(text('discount')),iva:parseBudgetNumber(text('iva'))||21};
    });
    body.innerHTML='';
    if(existing.length) existing.forEach(addBudgetRow); else addBudgetRow({concept:'',price:'',discount:'0',iva:'21'});
    if(!slide.querySelector('.budget-edit-tools')){
      const tools=document.createElement('div');
      tools.className='budget-edit-tools';
      const add=document.createElement('button');
      add.type='button';add.className='budget-add-row';add.textContent='Añadir partida';
      add.addEventListener('click',()=>addBudgetRow({concept:'',price:'',discount:'0',iva:'21'}));
      tools.appendChild(add);
      slide.querySelector('.inner')?.appendChild(tools);
    }
  }
  function unmountBudgetEditor(){
    const slide=budgetSlide();
    if(slide)slide.removeAttribute('data-budget-editing');
    slide?.querySelector('.budget-edit-tools')?.remove();
  }
  function budgetDirty(){return JSON.stringify(collectBudgetLines())!==originalBudgetSnapshot}
  const changed=()=>editable.filter(node=>originals.has(node)&&node.textContent.trim()!==originals.get(node));
  const snapshot=()=>editable.map(node=>node.textContent);
  const sameSnapshot=(left,right)=>left?.length===right?.length&&left.every((value,index)=>value===right[index]);
  function updateHistoryButtons(){undo.disabled=busy||historyIndex<=0;redo.disabled=busy||historyIndex<0||historyIndex>=history.length-1;if(removeBtn)removeBtn.disabled=busy}
  function resetHistory(){history=[snapshot()];historyIndex=0;updateHistoryButtons()}
  function remember(){if(restoring||!editing)return;const next=snapshot();if(sameSnapshot(next,history[historyIndex]))return;history=history.slice(0,historyIndex+1);history.push(next);if(history.length>100)history.shift();historyIndex=history.length-1;updateHistoryButtons()}
  function restore(index){if(!editing||busy||index<0||index>=history.length)return;restoring=true;editable.forEach((node,nodeIndex)=>{node.textContent=history[index][nodeIndex]??''});restoring=false;historyIndex=index;updateHistoryButtons();setStatus(index===0?'Edición inicial restaurada':'Editando el idioma visible')}
  function setEditing(value){
    editing=value;toolbar.hidden=!value;document.documentElement.dataset.inlineEditing=value?'true':'false';
    editable.forEach(node=>{if(value){node.setAttribute('contenteditable','true');node.setAttribute('spellcheck','true')}else{node.removeAttribute('contenteditable');node.removeAttribute('spellcheck')}});
    if(value) mountBudgetEditor(); else unmountBudgetEditor();
    if(!value){originals.clear();history=[];historyIndex=-1;setStatus('Editando el idioma visible');updateHistoryButtons()}
  }
  const currentProposalSlide=()=>[...document.querySelectorAll('.slide[data-block]')].sort((left,right)=>Math.abs(left.getBoundingClientRect().top)-Math.abs(right.getBoundingClientRect().top))[0];
  function mountDeleteButtons(){
    document.querySelectorAll('.slide[data-block]').forEach(slide=>{
      if(slide.querySelector('.slide-delete'))return;
      const button=document.createElement('button');
      button.type='button';button.className='slide-delete';button.textContent='Eliminar';
      button.title='Eliminar esta lámina (Ctrl+Backspace)';button.setAttribute('aria-label','Eliminar lámina');
      button.addEventListener('click',()=>deleteSlide(slide.dataset.blockId));
      slide.appendChild(button);
    });
  }
  async function deleteSlide(blockId){
    if(!editing||busy)return;
    const safeId=String(blockId||'').replace(/["\\]/g,'');
    const slide=safeId?document.querySelector('.slide[data-block-id="'+safeId+'"]'):currentProposalSlide();
    const id=String(blockId||slide?.dataset.blockId||'').trim();
    if(!id){setStatus('Sitúate en una lámina de la propuesta para eliminarla.',true);return;}
    const title=slide?.querySelector('h2')?.textContent.trim()||id;
    if(!confirm('¿Eliminar la lámina «'+title+'»? No se regenera el deck.'))return;
    if(changed().length&&!confirm('Hay cambios de texto sin guardar. Se descartarán. ¿Seguir?'))return;
    busy=true;save.disabled=true;cancel.disabled=true;updateHistoryButtons();setStatus('Eliminando lámina…');
    try{
      const response=await fetch('/presentaciones/'+client+'/api/inline-edit',{method:'PUT',headers:{'content-type':'application/json','accept':'application/json'},body:JSON.stringify({action:'deleteSlide',language:state.language,revision:state.revision,blockId:id})});
      const result=await response.json().catch(()=>({}));if(!response.ok)throw new Error(result.error||('HTTP '+response.status));
      state.locales=result.locales;state.revision=result.revision;
      slide?.remove();
      if(typeof window.__ADMIRA_REFRESH_SLIDES__==='function')window.__ADMIRA_REFRESH_SLIDES__();
      if(typeof window.__ADMIRA_APPLY_LANGUAGE__==='function')window.__ADMIRA_APPLY_LANGUAGE__(state.language);
      editable=[...document.querySelectorAll('[data-edit-field]')];
      originals=new Map(editable.map(node=>[node,node.textContent.trim()]));
      resetHistory();setStatus('Lámina «'+title+'» eliminada');
    }catch(error){setStatus(error.message,true);}
    finally{busy=false;save.disabled=false;cancel.disabled=false;updateHistoryButtons();}
  }
  function begin(){
    if(editing){editable.find(node=>node.matches(':focus'))?.focus({preventScroll:true});return}
    originals=new Map(editable.map(node=>[node,node.textContent.trim()]));setEditing(true);mountDeleteButtons();resetHistory();
    const activeSlide=[...document.querySelectorAll('.slide')].sort((left,right)=>Math.abs(left.getBoundingClientRect().top)-Math.abs(right.getBoundingClientRect().top))[0];
    if(activeSlide?.dataset.slideKey==='budget') activeSlide.querySelector('input')?.focus({preventScroll:true});
    else activeSlide?.querySelector('[data-edit-field]')?.focus({preventScroll:true});
  }
  function discard(){for(const [node,value] of originals)if(node.isConnected)node.textContent=value;unmountBudgetEditor();if(typeof window.__ADMIRA_APPLY_LANGUAGE__==='function')window.__ADMIRA_APPLY_LANGUAGE__(state.language);setEditing(false)}
  async function persist(){
    const dirty=changed().filter(node=>node.isConnected);
    const budgetLines=collectBudgetLines();
    const budgetChanged=budgetDirty();
    if(!dirty.length&&!budgetChanged){setEditing(false);return}
    const edits=dirty.map(node=>({field:node.dataset.editField,blockId:node.closest('[data-block]')?.dataset.blockId||'',value:node.textContent.trim()}));
    busy=true;save.disabled=true;cancel.disabled=true;updateHistoryButtons();setStatus(budgetChanged&&!dirty.length?'Guardando presupuesto…':'Guardando y sincronizando idiomas…');
    try{
      if(budgetChanged){
        const budgetResponse=await fetch(`/presentaciones/${client}/api/inline-edit`,{method:'PUT',headers:{'content-type':'application/json','accept':'application/json'},body:JSON.stringify({action:'setBudget',language:state.language,revision:state.revision,lines:budgetLines})});
        const budgetResult=await budgetResponse.json().catch(()=>({}));if(!budgetResponse.ok)throw new Error(budgetResult.error||`HTTP ${budgetResponse.status}`);
        state.locales=budgetResult.locales;state.revision=budgetResult.revision;
      }
      if(dirty.length){
        const response=await fetch(`/presentaciones/${client}/api/inline-edit`,{method:'PUT',headers:{'content-type':'application/json','accept':'application/json'},body:JSON.stringify({language:state.language,revision:state.revision,edits})});
        const result=await response.json().catch(()=>({}));if(!response.ok)throw new Error(result.error||`HTTP ${response.status}`);
        state.locales=result.locales;state.revision=result.revision;
      }
      unmountBudgetEditor();
      if(typeof window.__ADMIRA_APPLY_LANGUAGE__==='function')window.__ADMIRA_APPLY_LANGUAGE__(state.language);
      setEditing(false);
    }catch(error){setStatus(error.message,true)}finally{busy=false;save.disabled=false;cancel.disabled=false;updateHistoryButtons()}
  }
  editable.forEach(node=>{
    node.addEventListener('paste',event=>{if(!editing)return;event.preventDefault();document.execCommand('insertText',false,event.clipboardData?.getData('text/plain')||'')});
    node.addEventListener('input',remember);
    node.addEventListener('keydown',event=>{const field=node.dataset.editField;if(event.key==='Enter'&&!['hero.summary','objective','skeleton.message','skeleton.detail','closing.action'].includes(field))event.preventDefault()});
  });
  document.querySelector('.languages')?.addEventListener('click',event=>{
    if(!editing||!event.target.closest('[data-language]'))return;
    if(changed().length){
      if(!confirm('Hay cambios sin guardar. ¿Quieres descartarlos y cambiar de idioma?')){event.preventDefault();event.stopImmediatePropagation()}else discard();
    }else setTimeout(()=>{originals=new Map(editable.map(node=>[node,node.textContent.trim()]));resetHistory()},0);
  },true);
  addEventListener('keydown',event=>{
    if(event.ctrlKey&&!event.metaKey&&!event.altKey&&!event.shiftKey&&event.key.toLowerCase()==='e'){event.preventDefault();begin();return}
    if(editing&&!busy&&event.ctrlKey&&!event.metaKey&&!event.altKey&&event.key==='Backspace'){event.preventDefault();deleteSlide();return}
    if(!editing||busy||(!event.ctrlKey&&!event.metaKey)||event.altKey)return;
    const key=event.key.toLowerCase(),isUndo=key==='z'&&!event.shiftKey,isRedo=(key==='z'&&event.shiftKey)||(key==='y'&&event.ctrlKey);
    if(isUndo||isRedo){event.preventDefault();restore(historyIndex+(isUndo?-1:1))}
  },true);
  undo.addEventListener('click',()=>restore(historyIndex-1));redo.addEventListener('click',()=>restore(historyIndex+1));save.addEventListener('click',persist);removeBtn.addEventListener('click',()=>{if(!busy)deleteSlide()});cancel.addEventListener('click',()=>{if(!busy)discard()});mountDeleteButtons();updateHistoryButtons();
})();
