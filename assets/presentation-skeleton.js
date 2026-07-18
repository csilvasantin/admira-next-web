(function(){
  'use strict';
  const host = document.querySelector('[data-presentation-skeleton]');
  if (!host) return;
  const client = host.dataset.client;
  const base = host.dataset.base || location.pathname.replace(/[^/]*$/, '');
  const api = `/presentaciones/${client}/api/ideas`;
  const fallback = `${base.replace(/\/$/,'')}/ideas.json`;
  let model = null;
  let currentLanguage = document.documentElement.lang || 'es';

  function style(){
    if (document.getElementById('presentation-skeleton-style')) return;
    const node = document.createElement('style'); node.id = 'presentation-skeleton-style';
    node.textContent = `.ps-objective{margin:0 0 18px;padding:16px 18px;border-left:3px solid var(--brand,var(--crear,#4ea8de));background:var(--panel,#fff);border-radius:0 var(--radius,12px) var(--radius,12px) 0;color:var(--mut,#607694);font-size:14px;line-height:1.55}.ps-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px}.ps-card{position:relative;background:var(--panel,#fff);border:1px solid var(--line,#d9e5f0);border-radius:var(--radius,14px);padding:19px;overflow:hidden}.ps-num{display:block;font:700 10px/1 ui-monospace,"SF Mono",Menlo,monospace;letter-spacing:.13em;color:var(--brand,var(--crear,#4ea8de));margin-bottom:13px}.ps-card h3{font-size:17px;line-height:1.25;margin:0}.ps-message{font-weight:650;color:var(--ink,#102d55);font-size:14px;line-height:1.45;margin:8px 0 0}.ps-detail{color:var(--mut,#607694);font-size:13px;line-height:1.5;margin:7px 0 0}.ps-close{margin-top:14px;background:var(--navy,var(--panel,#12233e));color:#fff;border-radius:var(--radius,14px);padding:20px}.ps-close strong{display:block;font-size:18px}.ps-close span{display:block;color:rgba(255,255,255,.72);font-size:13px;line-height:1.5;margin-top:6px}@media(max-width:680px){.ps-grid{grid-template-columns:1fr}}`;
    document.head.appendChild(node);
  }
  async function json(url){
    const r = await fetch(url,{headers:{accept:'application/json'},cache:'no-store'});
    if (!r.ok) throw new Error(String(r.status)); return r.json();
  }
  function el(tag, cls, text){ const node=document.createElement(tag); if(cls)node.className=cls; if(text!=null)node.textContent=text; return node; }
  function applyOutputs(data){
    const all=['website','audio','video','pdf','powerpoint','documents','infographic'];
    const selected=new Set(Array.isArray(data.outputs)&&data.outputs.length?data.outputs:all);
    const map={site:'website',audio:'audio','vídeo':'video',video:'video',pdf:'pdf',powerpoint:'powerpoint','documentos de trabajo':'documents',infografía:'infographic',infografia:'infographic'};
    document.querySelectorAll('section.sec').forEach(section=>{
      const output=section.dataset.output;
      const title=section.querySelector('.sec-h h2')?.textContent.trim().toLowerCase();
      const key=output||map[title];
      const multilingualCards=[...section.querySelectorAll('.card[data-lang-only]')];
      multilingualCards.forEach(card=>{card.style.display=card.dataset.langOnly.split(',').includes(currentLanguage)?'':'none'});
      const cardLanguageAllowed=!section.hasAttribute('data-multilingual-cards')||multilingualCards.some(card=>card.dataset.langOnly.split(',').includes(currentLanguage));
      const languageAllowed=(!section.dataset.langOnly||section.dataset.langOnly.split(',').includes(currentLanguage))&&cardLanguageAllowed;
      if(key) section.style.display=selected.has(key)&&languageAllowed?'':'none';
    });
  }
  function localized(data, language){
    if(language==='es'||!data.translations?.[language]) return data;
    return {...data,...data.translations[language],outputs:data.outputs,translations:data.translations};
  }
  function render(data, language=currentLanguage){
    const content=localized(data,language);
    style(); host.textContent='';
    const objectiveLabels={es:'Objetivo · ',ca:'Objectiu · ',en:'Objective · '};
    const objective=el('p','ps-objective'); objective.append(el('strong','',objectiveLabels[language]||objectiveLabels.es),document.createTextNode(content.objective||'')); host.append(objective);
    const grid=el('div','ps-grid');
    (content.skeleton||[]).filter(x=>x.enabled!==false).forEach((item,index)=>{
      const card=el('article','ps-card'); card.append(el('span','ps-num',String(index+1).padStart(2,'0')),el('h3','',item.title),el('p','ps-message',item.message),el('p','ps-detail',item.detail)); grid.append(card);
    });
    host.append(grid);
    const close=el('div','ps-close'); close.append(el('strong','',content.closing?.title||''),el('span','',content.closing?.action||'')); host.append(close);
    const eyebrow=document.querySelector('[data-ideas-eyebrow]'); if(eyebrow&&content.hero?.eyebrow)eyebrow.textContent=content.hero.eyebrow;
    const title=document.querySelector('[data-ideas-title]'); if(title&&content.hero?.title)title.textContent=content.hero.title;
    const summary=document.querySelector('[data-ideas-summary]'); if(summary&&content.hero?.summary)summary.textContent=content.hero.summary;
    applyOutputs(data);
  }
  window.addEventListener('admira-language-change',event=>{
    const language=event.detail?.language;
    if(!['es','ca','en'].includes(language)) return;
    currentLanguage=language;
    if(model) render(model,currentLanguage);
  });
  (async()=>{
    let local=null, saved=null;
    try{local=await json(fallback);}catch(_){}
    try{saved=await json(api);}catch(_){}
    if(!local&&!saved){host.textContent='Esqueleto no disponible.';return;}
    model={...(local||{}),...(saved||{}),translations:{...(local?.translations||{}),...(saved?.translations||{})}};
    render(model,currentLanguage);
  })();
})();
