(function(){
  'use strict';
  if(!window.__ADMIRA_PRESENTATION_STATE__)return;
  const params=new URLSearchParams(location.search);
  if(params.get('audience')==='1')return;
  if(document.documentElement.classList.contains('presenter-audience-mode'))return;
  if(document.querySelector('.quality-levels'))return;
  const state=window.__ADMIRA_PRESENTATION_STATE__;
  const style=document.createElement('style');
  style.textContent='.quality-levels{position:fixed;z-index:31;left:18px;top:18px;display:flex;align-items:center;gap:5px;padding:4px;background:color-mix(in srgb,var(--surface) 84%,transparent);border:1px solid color-mix(in srgb,var(--ink) 18%,transparent);border-radius:calc(var(--radius) + 16px);backdrop-filter:blur(12px);box-shadow:0 8px 24px rgba(0,0,0,.14);font:800 9px/1 var(--mono);letter-spacing:.05em;text-transform:uppercase}.quality-levels button{border:0;padding:8px 10px;border-radius:calc(var(--radius) + 10px);background:transparent;color:color-mix(in srgb,var(--ink) 60%,transparent);font:inherit;letter-spacing:inherit;text-transform:inherit;cursor:pointer}.quality-levels button[aria-pressed="true"]{background:var(--accent);color:var(--bg)}.quality-levels button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}@media(max-width:700px){.quality-levels{left:12px;top:12px}}.inline-editor{top:68px}@media(max-width:700px){.inline-editor{top:auto}}';
  document.head.appendChild(style);
  const quality=document.createElement('div'),activeQuality=state.quality||document.querySelector('.deck-slide')?.dataset.deckQuality||'good',qualityHelp={es:{good:'Look & feel de la presentación Admira',better:'Cada lámina con imagen temática del tema (Grok)',best:'Imagen descriptiva encima del fondo + tipografía editorial'},ca:{good:'Look & feel de la presentació d\'Admira',better:'Cada làmina amb imatge temàtica del tema (Grok)',best:'Imatge descriptiva sobre el fons + tipografia editorial'},en:{good:'Admira presentation look and feel',better:'Each slide gets a thematic image for its topic (Grok)',best:'Descriptive figure over the background + editorial type'}};
  quality.className='quality-levels';
  quality.setAttribute('aria-label','Good, Better and Best');
  quality.innerHTML=['good','better','best'].map(level=>`<button type="button" data-quality="${level}" aria-pressed="${level===activeQuality?'true':'false'}">${level[0].toUpperCase()+level.slice(1)}</button>`).join('');
  const localizeQuality=language=>{const labels=qualityHelp[language]||qualityHelp.es;quality.querySelectorAll('[data-quality]').forEach(button=>button.title=labels[button.dataset.quality])};
  localizeQuality(state.language);
  document.addEventListener('admira:language',event=>localizeQuality(event.detail?.language));
  quality.addEventListener('click',event=>{
    const button=event.target.closest('[data-quality]');
    if(!button||typeof window.__ADMIRA_APPLY_QUALITY__!=='function')return;
    window.__ADMIRA_APPLY_QUALITY__(button.dataset.quality);
    const url=new URL(location.href);
    url.searchParams.set('quality',button.dataset.quality);
    history.replaceState(null,'',url);
  });
  document.body.prepend(quality);
})();
