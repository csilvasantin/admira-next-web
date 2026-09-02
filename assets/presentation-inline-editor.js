(function(){
  'use strict';
  if(window.__ADMIRA_CAN_EDIT__!==true||!window.__ADMIRA_PRESENTATION_STATE__)return;
  const state=window.__ADMIRA_PRESENTATION_STATE__,editable=[...document.querySelectorAll('[data-edit-field]')];
  const match=location.pathname.match(/^\/presentaciones\/([a-z0-9-]+)\/presentacion\/?$/i);if(!match||!editable.length)return;
  const client=match[1].toLowerCase();let originals=new Map(),editing=false,busy=false,history=[],historyIndex=-1,restoring=false;
  const style=document.createElement('style');
  style.textContent='.inline-editor{position:fixed;z-index:30;left:18px;top:18px;display:flex;align-items:center;flex-wrap:wrap;gap:7px;padding:6px;background:color-mix(in srgb,var(--surface) 88%,transparent);border:1px solid color-mix(in srgb,var(--ink) 18%,transparent);border-radius:calc(var(--radius) + 16px);backdrop-filter:blur(14px);box-shadow:0 12px 36px rgba(0,0,0,.24)}.inline-editor[hidden]{display:none}.inline-editor button{border:0;border-radius:calc(var(--radius) + 10px);padding:10px 12px;background:transparent;color:var(--ink);font:800 10px/1 var(--mono);letter-spacing:.04em;cursor:pointer}.inline-editor button.primary{background:var(--accent);color:var(--bg)}.inline-editor button:disabled{opacity:.45;cursor:not-allowed}.inline-editor .state{max-width:220px;color:color-mix(in srgb,var(--ink) 68%,transparent);font:700 9px/1.35 var(--mono)}.inline-editor .state.error{color:#ff7b8a}html[data-inline-editing="true"] [data-edit-field]{outline:1px dashed color-mix(in srgb,var(--accent) 72%,transparent);outline-offset:7px;border-radius:4px;cursor:text;transition:outline-color .15s,background .15s}html[data-inline-editing="true"] [data-edit-field]:focus{outline:2px solid var(--accent);background:color-mix(in srgb,var(--surface) 30%,transparent)}@media(max-width:700px){.inline-editor{top:auto;bottom:16px;left:12px;right:12px;justify-content:center}.inline-editor .state{flex-basis:100%;max-width:none;text-align:center}.languages{top:12px;right:12px}}';
  style.textContent+='.inline-editor{top:68px}.quality-levels{position:fixed;z-index:31;left:18px;top:18px;display:flex;align-items:center;gap:5px;padding:4px;background:color-mix(in srgb,var(--surface) 84%,transparent);border:1px solid color-mix(in srgb,var(--ink) 18%,transparent);border-radius:calc(var(--radius) + 16px);backdrop-filter:blur(12px);box-shadow:0 8px 24px rgba(0,0,0,.14);font:800 9px/1 var(--mono);letter-spacing:.05em;text-transform:uppercase}.quality-levels button{border:0;padding:8px 10px;border-radius:calc(var(--radius) + 10px);background:transparent;color:color-mix(in srgb,var(--ink) 60%,transparent);font:inherit;letter-spacing:inherit;text-transform:inherit;cursor:pointer}.quality-levels button[aria-pressed="true"]{background:var(--accent);color:var(--bg)}.quality-levels button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}@media(max-width:700px){.quality-levels{left:12px;top:12px}.inline-editor{top:auto}}';
  document.head.appendChild(style);
  const quality=document.createElement('div'),activeQuality=state.quality||document.querySelector('.deck-slide')?.dataset.deckQuality||'good',qualityHelp={es:{good:'Look & feel de la presentación Admira',better:'Dirección editorial definida por Codex',best:'Adaptación a la web o película elegida'},ca:{good:'Look & feel de la presentació d\'Admira',better:'Direcció editorial definida per Codex',best:'Adaptació al web o la pel·lícula escollida'},en:{good:'Admira presentation look and feel',better:'Editorial direction defined by Codex',best:'Adaptation to the selected website or film'}};quality.className='quality-levels';quality.setAttribute('aria-label','Good, Better and Best');quality.innerHTML=['good','better','best'].map(level=>`<button type="button" data-quality="${level}" aria-pressed="${level===activeQuality?'true':'false'}">${level[0].toUpperCase()+level.slice(1)}</button>`).join('');const localizeQuality=language=>{const labels=qualityHelp[language]||qualityHelp.es;quality.querySelectorAll('[data-quality]').forEach(button=>button.title=labels[button.dataset.quality])};localizeQuality(state.language);document.addEventListener('admira:language',event=>localizeQuality(event.detail?.language));quality.addEventListener('click',event=>{const button=event.target.closest('[data-quality]');if(!button||typeof window.__ADMIRA_APPLY_QUALITY__!=='function')return;window.__ADMIRA_APPLY_QUALITY__(button.dataset.quality);const url=new URL(location.href);url.searchParams.set('quality',button.dataset.quality);history.replaceState(null,'',url)});document.body.prepend(quality);
  const toolbar=document.createElement('div');toolbar.className='inline-editor';toolbar.hidden=true;toolbar.setAttribute('role','toolbar');toolbar.setAttribute('aria-label','Edición de la presentación');
  toolbar.innerHTML='<button type="button" class="save primary">Guardar y traducir</button><button type="button" class="undo" aria-label="Deshacer" title="Deshacer (Ctrl/⌘+Z)">↶ Deshacer</button><button type="button" class="redo" aria-label="Rehacer" title="Rehacer (Ctrl+Y / ⌘+Mayús+Z)">↷ Rehacer</button><button type="button" class="cancel">Cancelar</button><span class="state" aria-live="polite">Editando el idioma visible</span>';
  document.body.appendChild(toolbar);
  const save=toolbar.querySelector('.save'),undo=toolbar.querySelector('.undo'),redo=toolbar.querySelector('.redo'),cancel=toolbar.querySelector('.cancel'),status=toolbar.querySelector('.state');
  const nav=document.querySelector('.nav'),editHints={es:' · Ctrl+E editar textos',ca:' · Ctrl+E editar textos',en:' · Ctrl+E edit text'};
  const localizeEditorHint=language=>{if(!nav)return;nav.dataset.editorHint=editHints[language]||editHints.es;if(typeof window.__ADMIRA_SYNC_NAV__==='function')window.__ADMIRA_SYNC_NAV__()};
  localizeEditorHint(state.language);document.addEventListener('admira:language',event=>localizeEditorHint(event.detail?.language));
  const setStatus=(value,error=false)=>{status.textContent=value;status.classList.toggle('error',error)};
  const changed=()=>editable.filter(node=>originals.has(node)&&node.textContent.trim()!==originals.get(node));
  const snapshot=()=>editable.map(node=>node.textContent);
  const sameSnapshot=(left,right)=>left?.length===right?.length&&left.every((value,index)=>value===right[index]);
  function updateHistoryButtons(){undo.disabled=busy||historyIndex<=0;redo.disabled=busy||historyIndex<0||historyIndex>=history.length-1}
  function resetHistory(){history=[snapshot()];historyIndex=0;updateHistoryButtons()}
  function remember(){if(restoring||!editing)return;const next=snapshot();if(sameSnapshot(next,history[historyIndex]))return;history=history.slice(0,historyIndex+1);history.push(next);if(history.length>100)history.shift();historyIndex=history.length-1;updateHistoryButtons()}
  function restore(index){if(!editing||busy||index<0||index>=history.length)return;restoring=true;editable.forEach((node,nodeIndex)=>{node.textContent=history[index][nodeIndex]??''});restoring=false;historyIndex=index;updateHistoryButtons();setStatus(index===0?'Edición inicial restaurada':'Editando el idioma visible')}
  function setEditing(value){
    editing=value;toolbar.hidden=!value;document.documentElement.dataset.inlineEditing=value?'true':'false';
    editable.forEach(node=>{if(value){node.setAttribute('contenteditable','true');node.setAttribute('spellcheck','true')}else{node.removeAttribute('contenteditable');node.removeAttribute('spellcheck')}});
    if(!value){originals.clear();history=[];historyIndex=-1;setStatus('Editando el idioma visible');updateHistoryButtons()}
  }
  function begin(){
    if(editing){editable.find(node=>node.matches(':focus'))?.focus({preventScroll:true});return}
    originals=new Map(editable.map(node=>[node,node.textContent.trim()]));setEditing(true);resetHistory();
    const activeSlide=[...document.querySelectorAll('.slide')].sort((left,right)=>Math.abs(left.getBoundingClientRect().top)-Math.abs(right.getBoundingClientRect().top))[0];
    activeSlide?.querySelector('[data-edit-field]')?.focus({preventScroll:true});
  }
  function discard(){for(const [node,value] of originals)node.textContent=value;setEditing(false)}
  async function persist(){
    const dirty=changed();if(!dirty.length){setEditing(false);return}
    const edits=dirty.map(node=>({field:node.dataset.editField,blockId:node.closest('[data-block]')?.dataset.blockId||'',value:node.textContent.trim()}));
    busy=true;save.disabled=true;cancel.disabled=true;updateHistoryButtons();setStatus('Guardando y sincronizando idiomas…');
    try{
      const response=await fetch(`/presentaciones/${client}/api/inline-edit`,{method:'PUT',headers:{'content-type':'application/json','accept':'application/json'},body:JSON.stringify({language:state.language,revision:state.revision,edits})});
      const result=await response.json().catch(()=>({}));if(!response.ok)throw new Error(result.error||`HTTP ${response.status}`);
      state.locales=result.locales;state.revision=result.revision;window.__ADMIRA_APPLY_LANGUAGE__(state.language);setEditing(false);
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
    if(!editing||busy||(!event.ctrlKey&&!event.metaKey)||event.altKey)return;
    const key=event.key.toLowerCase(),isUndo=key==='z'&&!event.shiftKey,isRedo=(key==='z'&&event.shiftKey)||(key==='y'&&event.ctrlKey);
    if(isUndo||isRedo){event.preventDefault();restore(historyIndex+(isUndo?-1:1))}
  },true);
  undo.addEventListener('click',()=>restore(historyIndex-1));redo.addEventListener('click',()=>restore(historyIndex+1));save.addEventListener('click',persist);cancel.addEventListener('click',()=>{if(!busy)discard()});updateHistoryButtons();
})();
