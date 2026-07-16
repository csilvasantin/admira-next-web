(function(){
  'use strict';
  const host = document.querySelector('[data-presentation-skeleton]');
  if (!host) return;
  const client = host.dataset.client;
  const base = host.dataset.base || location.pathname.replace(/[^/]*$/, '');
  const api = `/presentaciones/${client}/api/ideas`;
  const fallback = `${base.replace(/\/$/,'')}/ideas.json`;

  function style(){
    if (document.getElementById('presentation-skeleton-style')) return;
    const node = document.createElement('style'); node.id = 'presentation-skeleton-style';
    node.textContent = `.ps-objective{margin:0 0 18px;padding:16px 18px;border-left:3px solid var(--brand,var(--crear,#4ea8de));background:var(--panel,#fff);border-radius:0 12px 12px 0;color:var(--mut,#607694);font-size:14px;line-height:1.55}.ps-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px}.ps-card{position:relative;background:var(--panel,#fff);border:1px solid var(--line,#d9e5f0);border-radius:14px;padding:19px;overflow:hidden}.ps-num{display:block;font:700 10px/1 ui-monospace,"SF Mono",Menlo,monospace;letter-spacing:.13em;color:var(--brand,var(--crear,#4ea8de));margin-bottom:13px}.ps-card h3{font-size:17px;line-height:1.25;margin:0}.ps-message{font-weight:650;color:var(--ink,#102d55);font-size:14px;line-height:1.45;margin:8px 0 0}.ps-detail{color:var(--mut,#607694);font-size:13px;line-height:1.5;margin:7px 0 0}.ps-close{margin-top:14px;background:var(--navy,var(--panel,#12233e));color:#fff;border-radius:14px;padding:20px}.ps-close strong{display:block;font-size:18px}.ps-close span{display:block;color:rgba(255,255,255,.72);font-size:13px;line-height:1.5;margin-top:6px}@media(max-width:680px){.ps-grid{grid-template-columns:1fr}}`;
    document.head.appendChild(node);
  }
  async function json(url){
    const r = await fetch(url,{headers:{accept:'application/json'},cache:'no-store'});
    if (!r.ok) throw new Error(String(r.status)); return r.json();
  }
  function el(tag, cls, text){ const node=document.createElement(tag); if(cls)node.className=cls; if(text!=null)node.textContent=text; return node; }
  function render(data){
    style(); host.textContent='';
    const objective=el('p','ps-objective'); objective.append(el('strong','', 'Objetivo · '),document.createTextNode(data.objective||'')); host.append(objective);
    const grid=el('div','ps-grid');
    (data.skeleton||[]).filter(x=>x.enabled!==false).forEach((item,index)=>{
      const card=el('article','ps-card'); card.append(el('span','ps-num',String(index+1).padStart(2,'0')),el('h3','',item.title),el('p','ps-message',item.message),el('p','ps-detail',item.detail)); grid.append(card);
    });
    host.append(grid);
    const close=el('div','ps-close'); close.append(el('strong','',data.closing?.title||''),el('span','',data.closing?.action||'')); host.append(close);
    const eyebrow=document.querySelector('[data-ideas-eyebrow]'); if(eyebrow&&data.hero?.eyebrow)eyebrow.textContent=data.hero.eyebrow;
    const title=document.querySelector('[data-ideas-title]'); if(title&&data.hero?.title)title.textContent=data.hero.title;
    const summary=document.querySelector('[data-ideas-summary]'); if(summary&&data.hero?.summary)summary.textContent=data.hero.summary;
  }
  (async()=>{ try{render(await json(api));}catch(_){try{render(await json(fallback));}catch(__){host.textContent='Esqueleto no disponible.';}} })();
})();
