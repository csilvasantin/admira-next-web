// Deterministic narration derived only from the visible audience deck and its saved snapshot.
export const normalizeNarrationText = value => String(value ?? '').normalize('NFC').replace(/\s+/gu, ' ').trim();
export const clientSlug = value => /^[a-z0-9][a-z0-9-]{0,79}$/.test(String(value || '')) ? String(value) : '';
export function visibleSlideText(slide) {
  const copy = slide.cloneNode(true);
  for (const node of copy.querySelectorAll('script,style,a,button,nav,footer,.slide-footer,.eyebrow,.deck-eyebrow,[hidden],[aria-hidden="true"],[data-speaker-notes],.speaker-notes,.presenter-notes')) node.remove();
  const values = [...copy.querySelectorAll('h1,h2,h3,p.message,p.detail,.deck-detail,.deck-copy p,li,#coverSummary,#objectiveText,#closingTitle,#closingAction')]
    .map(node => normalizeNarrationText(node.textContent)).filter(Boolean);
  return normalizeNarrationText([...new Set(values)].join('. '));
}
export function extractPresentationSlides(document) {
  return [...document.querySelectorAll('.slide')].map((slide,index) => ({
    slideIndex:index, demoKey:slide.dataset.demoKey || '', text:visibleSlideText(slide)
  }));
}
export function buildRemotePlan(slides, project, lang='es') {
  if (!['es','en','ca'].includes(lang)) throw new Error('Unsupported narration language.');
  if (!Array.isArray(slides) || !slides.length || slides.length>300) throw new Error('Presentation slides are missing.');
  if (!project || !Array.isArray(project.documentacion)) throw new Error('Saved demo documentation is missing.');
  const demos = new Map(project.documentacion.filter(d => /^[a-z0-9-]+\/[a-z0-9-]+$/.test(d.clave || '')).map(d=>[d.clave,d]));
  const plan=[];
  slides.forEach((slide,index) => {
    const text=normalizeNarrationText(slide.text);
    if (!text) throw new Error('A presentation slide has no visible narration text.');
    plan.push({id:'s'+String(index+1).padStart(3,'0'),type:'slide',text,lang,slideIndex:index});
    const demo=demos.get(slide.demoKey);
    if (!demo) return;
    if (!Array.isArray(demo.guion) || !demo.guion.length) throw new Error('A selected demo has no saved rehearsal steps.');
    demo.guion.forEach((phase,phaseIndex) => {
      let body=normalizeNarrationText(typeof phase==='string'?phase:phase?.texto || phase?.text || '');
      if (phase?.accion==='espera' && /^\d+(?:\.\d+)?$/.test(body)) body='Revisamos la muestra durante '+body+' segundos.';
      if (!body) throw new Error('A rehearsal phase has no narration text.');
      plan.push({id:'d-'+demo.clave.replace('/','-')+'-p'+String(phaseIndex+1).padStart(2,'0'),type:'demo-phase',
        text:normalizeNarrationText((phaseIndex===0?demo.titulo+'. ':'')+body),lang,slideIndex:index,demoKey:demo.clave,phaseIndex});
    });
  });
  const inserted=new Set(plan.filter(p=>p.type==='demo-phase').map(p=>p.demoKey));
  if ([...demos.keys()].some(key=>!inserted.has(key))) throw new Error('Selected demos are absent from the presentation.');
  return plan;
}
export async function hashNarrationText(text, cryptoAPI=globalThis.crypto) {
  const bytes=await cryptoAPI.subtle.digest('SHA-256',new TextEncoder().encode(normalizeNarrationText(text)));
  return [...new Uint8Array(bytes)].map(n=>n.toString(16).padStart(2,'0')).join('');
}
