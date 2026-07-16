function esc(value){ return String(value==null?'':value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function color(value,fallback){ return /^#[0-9a-f]{6}$/i.test(String(value||''))?value:fallback; }
function safeJson(value){ return JSON.stringify(value).replace(/</g,'\\u003c'); }

export async function onRequestGet(context){
  const client=String(context.params.client||'').toLowerCase();
  const [config,ideas]=await Promise.all([
    context.env.PRESENTATION_IDEAS?.get(`presentation:${client}`,{type:'json'}),
    context.env.PRESENTATION_IDEAS?.get(`ideas:${client}`,{type:'json'})
  ]);
  if(client==='lacaixa'&&ideas&&context.env.ASSETS){
    const source=new URL('/presentaciones/LaCaixa/presentacion.html',context.request.url);
    const asset=await context.env.ASSETS.fetch(source);
    if(asset.ok){
      const marker='<script src="/presentaciones/LaCaixa/content-data?v=20260716-1"></script>';
      const html=(await asset.text())
        .replace(marker,'')
        .replace('ideas=window.__ADMIRA_PRESENTATION_CONTENT__||null;',`ideas=${safeJson(ideas)};`);
      return new Response(html,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store, must-revalidate','x-robots-tag':'noindex, nofollow'}});
    }
  }
  if(!config||!ideas) return context.next();
  if(Array.isArray(config.outputs)&&config.outputs.length&&!config.outputs.includes('website')) return new Response('Website no solicitado',{status:404});

  const primary=color(config.theme?.primary,'#12233e'),accent=color(config.theme?.accent,'#ffb000');
  const name=esc(config.displayName); const baseBlocks=(ideas.skeleton||[]).filter(item=>item.enabled!==false);
  const languages=(Array.isArray(config.languages)&&config.languages.length?config.languages:ideas.languages)||['es'];
  const locales={es:{hero:ideas.hero||{},objective:ideas.objective||'',skeleton:baseBlocks,closing:ideas.closing||{}}};
  for(const language of languages){
    if(language==='es') continue;
    const translated=ideas.translations?.[language]||locales.es;
    locales[language]={...translated,skeleton:(translated.skeleton||baseBlocks).filter(item=>item.enabled!==false)};
  }
  const labels={es:{objective:'El objetivo',next:'Siguiente paso'},ca:{objective:"L'objectiu",next:'Següent pas'},en:{objective:'The objective',next:'Next step'}};
  const slides=baseBlocks.map((item,index)=>`<section class="slide" data-block="${index}"><div class="inner"><span class="num">${String(index+1).padStart(2,'0')}</span><h2>${esc(item.title)}</h2><p class="message">${esc(item.message)}</p><p class="detail">${esc(item.detail)}</p></div></section>`).join('');
  const buttons=languages.map((language,index)=>`<button type="button" data-language="${esc(language)}" aria-pressed="${index===0?'true':'false'}">${esc(language.toUpperCase())}</button>`).join('');

  const html=`<!doctype html><html lang="${esc(languages[0]||'es')}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${name} · Presentación</title><style>
  :root{--primary:${primary};--accent:${accent};--ink:#f8fbff;--mono:ui-monospace,"SF Mono",Menlo,monospace;--sans:-apple-system,"Segoe UI",Roboto,Arial,sans-serif}*{box-sizing:border-box}html{scroll-snap-type:y mandatory;scroll-behavior:smooth}body{margin:0;background:#07101b;color:var(--ink);font-family:var(--sans)}.slide{min-height:100vh;scroll-snap-align:start;display:grid;place-items:center;padding:9vh 7vw;position:relative;overflow:hidden;background:radial-gradient(80% 75% at 100% 0%,color-mix(in srgb,var(--accent) 20%,transparent),transparent 65%),linear-gradient(135deg,var(--primary),#07101b)}.slide:nth-child(even){background:radial-gradient(80% 75% at 0% 100%,color-mix(in srgb,var(--accent) 17%,transparent),transparent 65%),linear-gradient(225deg,var(--primary),#07101b)}.slide:after{content:"";position:absolute;width:36vw;height:36vw;border:6vw solid color-mix(in srgb,var(--accent) 12%,transparent);border-radius:50%;right:-18vw;bottom:-22vw}.inner{position:relative;z-index:1;width:min(1050px,100%)}.num,.eyebrow{display:block;font:800 12px/1 var(--mono);letter-spacing:.18em;text-transform:uppercase;color:var(--accent);margin-bottom:28px}h1,h2{font-size:clamp(44px,8vw,100px);line-height:.98;letter-spacing:-.05em;margin:0;max-width:1000px}.cover h1{font-size:clamp(50px,9vw,118px)}.message{font-size:clamp(21px,3vw,38px);line-height:1.2;font-weight:700;max-width:920px;margin:34px 0 0}.detail{font-size:clamp(15px,1.6vw,20px);line-height:1.55;color:rgba(255,255,255,.66);max-width:760px;margin:24px 0 0}.close strong{display:block;font-size:clamp(42px,7vw,90px);line-height:1;letter-spacing:-.045em}.close span{display:block;font-size:clamp(18px,2.5vw,30px);color:rgba(255,255,255,.68);margin-top:28px;max-width:850px}.nav{position:fixed;z-index:9;right:18px;bottom:18px;background:rgba(0,0,0,.35);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.15);border-radius:999px;padding:10px 14px;font:700 10px/1 var(--mono);letter-spacing:.08em;color:rgba(255,255,255,.7)}.languages{position:fixed;z-index:10;right:18px;top:18px;display:flex;background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.15);border-radius:999px;padding:4px;backdrop-filter:blur(10px)}.languages button{border:0;border-radius:999px;padding:9px 11px;background:transparent;color:rgba(255,255,255,.65);font:800 10px/1 var(--mono);cursor:pointer}.languages button[aria-pressed="true"]{background:var(--accent);color:#07101b}@media(max-width:650px){.slide{padding:10vh 8vw}.nav{display:none}}
  </style></head><body><div class="languages" aria-label="Idiomas">${buttons}</div><section class="slide cover"><div class="inner"><span class="eyebrow">ADmiraNeXT × ${name}</span><h1 id="coverTitle">${esc(ideas.hero?.title)}</h1><p class="detail" id="coverSummary">${esc(ideas.hero?.summary)}</p></div></section><section class="slide"><div class="inner"><span class="eyebrow" id="objectiveLabel">El objetivo</span><h2 id="objectiveText">${esc(ideas.objective)}</h2></div></section>${slides}<section class="slide"><div class="inner close"><span class="eyebrow" id="nextLabel">Siguiente paso</span><strong id="closingTitle">${esc(ideas.closing?.title)}</strong><span id="closingAction">${esc(ideas.closing?.action)}</span></div></section><div class="nav">↑ ↓ · F pantalla completa</div><script>
  const locales=${safeJson(locales)},labels=${safeJson(labels)};const slides=[...document.querySelectorAll('.slide')];let at=0;
  function go(n){at=Math.max(0,Math.min(slides.length-1,n));slides[at].scrollIntoView()}
  function applyLanguage(language){const content=locales[language]||locales.es;document.documentElement.lang=language;document.getElementById('coverTitle').textContent=content.hero?.title||'';document.getElementById('coverSummary').textContent=content.hero?.summary||'';document.getElementById('objectiveText').textContent=content.objective||'';document.getElementById('objectiveLabel').textContent=(labels[language]||labels.es).objective;document.getElementById('nextLabel').textContent=(labels[language]||labels.es).next;document.getElementById('closingTitle').textContent=content.closing?.title||'';document.getElementById('closingAction').textContent=content.closing?.action||'';document.querySelectorAll('[data-block]').forEach((slide,index)=>{const block=(content.skeleton||[])[index]||{};slide.querySelector('h2').textContent=block.title||'';slide.querySelector('.message').textContent=block.message||'';slide.querySelector('.detail').textContent=block.detail||''});document.querySelectorAll('[data-language]').forEach(button=>button.setAttribute('aria-pressed',button.dataset.language===language?'true':'false'))}
  document.querySelectorAll('[data-language]').forEach(button=>button.addEventListener('click',()=>applyLanguage(button.dataset.language)));
  addEventListener('keydown',event=>{if(['ArrowDown','ArrowRight',' '].includes(event.key)){event.preventDefault();go(at+1)}if(['ArrowUp','ArrowLeft'].includes(event.key)){event.preventDefault();go(at-1)}if(event.key.toLowerCase()==='f'){const target=document.documentElement;if(target.requestFullscreen)target.requestFullscreen();else if(target.webkitRequestFullscreen)target.webkitRequestFullscreen()}});addEventListener('scroll',()=>{let best=0,dist=Infinity;slides.forEach((slide,index)=>{const delta=Math.abs(slide.getBoundingClientRect().top);if(delta<dist){dist=delta;best=index}});at=best},{passive:true});applyLanguage('${esc(languages[0]||'es')}');
  </script></body></html>`;
  return new Response(html,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-robots-tag':'noindex, nofollow'}});
}
