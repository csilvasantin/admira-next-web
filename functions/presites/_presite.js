const LANGUAGES = new Set(['es','ca','en']);
const QUALITIES = new Set(['good','better','best']);
const BLOCK_IDS = ['hero','challenge','promise','capabilities','proof','cta'];
const MAX_VERSIONS = 20;

export function cleanText(value, limit = 1200){
  return String(value == null ? '' : value).trim().replace(/\s+/g,' ').slice(0,limit);
}
export function slugify(value){
  return cleanText(value,100).normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,64);
}
export function esc(value){
  return String(value == null ? '' : value).replace(/[<>&"]/g,char=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[char]));
}
function color(value,fallback){
  const next=String(value||'').trim();
  return /^#[0-9a-f]{6}$/i.test(next)?next.toLowerCase():fallback;
}
function copy(language){
  return {
    es:{challenge:'El reto',promise:'La idea',capabilities:'Cómo cobra vida',proof:'Por qué funcionará',cta:'Siguiente paso',button:'Activar este presite'},
    ca:{challenge:'El repte',promise:'La idea',capabilities:'Com cobra vida',proof:'Per què funcionarà',cta:'Següent pas',button:'Activar aquest presite'},
    en:{challenge:'The challenge',promise:'The idea',capabilities:'How it comes alive',proof:'Why it will work',cta:'Next step',button:'Activate this presite'}
  }[language];
}
function seedBlocks(input,language){
  const labels=copy(language),brand=input.displayName||'Tu marca',objective=input.objective||'Convertir una primera visita en una conversación que importe.';
  return [
    {id:'hero',eyebrow:`ADmiraNeXT × ${brand}`,title:input.title||`${brand}, antes de explicar: impresiona.`,body:input.brief||'Una home concebida para detener, orientar y mover a la acción desde el primer segundo.'},
    {id:'challenge',eyebrow:'01',title:labels.challenge,body:input.brief||'La atención llega fragmentada. La primera pantalla debe convertir contexto en claridad.'},
    {id:'promise',eyebrow:'02',title:labels.promise,body:objective},
    {id:'capabilities',eyebrow:'03',title:labels.capabilities,body:`Narrativa adaptada a ${input.audience||'la audiencia decisora'}, jerarquía editorial y una llamada a la acción inequívoca.`},
    {id:'proof',eyebrow:'04',title:labels.proof,body:'Una arquitectura modular, responsive y medible que puede crecer hacia contenido y visuales generados con IA.'},
    {id:'cta',eyebrow:'05',title:labels.cta,body:input.cta||objective,button:labels.button}
  ];
}
export function normalizePresite(raw={},existing=null){
  const displayName=cleanText(raw.displayName||existing?.displayName,100);
  const slug=slugify(raw.slug||displayName||existing?.slug);
  const language=LANGUAGES.has(String(raw.language||existing?.language).toLowerCase())?String(raw.language||existing?.language).toLowerCase():'es';
  const quality=QUALITIES.has(String(raw.quality||existing?.quality).toLowerCase())?String(raw.quality||existing?.quality).toLowerCase():'good';
  const input={
    displayName,slug,language,quality,
    brief:cleanText(raw.brief||existing?.brief,1400),
    objective:cleanText(raw.objective||existing?.objective,1000),
    audience:cleanText(raw.audience||existing?.audience,500),
    title:cleanText(raw.title||existing?.title,220),
    cta:cleanText(raw.cta||existing?.cta,500)
  };
  const submitted=Array.isArray(raw.blocks)?raw.blocks:null;
  const previous=Array.isArray(existing?.blocks)?existing.blocks:null;
  const source=submitted||previous||seedBlocks(input,language);
  const byId=new Map(source.map(block=>[String(block?.id||''),block]));
  const defaults=new Map(seedBlocks(input,language).map(block=>[block.id,block]));
  input.blocks=BLOCK_IDS.map(id=>{
    const base=defaults.get(id),block=byId.get(id)||base;
    return {
      id,
      eyebrow:cleanText(block.eyebrow||base.eyebrow,80),
      title:cleanText(block.title||base.title,220),
      body:cleanText(block.body||base.body,1200),
      ...(id==='cta'?{button:cleanText(block.button||base.button,80)}:{})
    };
  });
  input.theme={
    primary:color(raw.theme?.primary||existing?.theme?.primary,'#09141d'),
    accent:color(raw.theme?.accent||existing?.theme?.accent,'#65e9f4'),
    glow:color(raw.theme?.glow||existing?.theme?.glow,'#3df08a')
  };
  const now=new Date().toISOString();
  return {
    schemaVersion:1,...input,
    status:existing?.status||'draft',
    publication:existing?.publication||{mode:'simulation',published:false},
    createdAt:existing?.createdAt||now,updatedAt:now
  };
}
export function validatePresite(site){
  if(!site.displayName||site.displayName.length<2)return 'Indica un nombre de marca válido.';
  if(!site.slug||site.slug.length<2)return 'El identificador de URL no es válido.';
  if(!site.brief)return 'Resume el reto o brief del proyecto.';
  if(!site.objective)return 'Indica el objetivo principal de la home.';
  if(!site.audience)return 'Indica a quién debe convencer.';
  return '';
}
export function presiteKey(slug){return `presite:site:${slug}`}
export function versionsKey(slug){return `presite:versions:${slug}`}
export function listKey(){return 'presite:index'}
export function appendVersion(versions,site,label='guardado'){
  return [{id:crypto.randomUUID(),label:cleanText(label,100),createdAt:new Date().toISOString(),site},...(Array.isArray(versions)?versions:[])].slice(0,MAX_VERSIONS);
}
export function publicSummary(site){
  return {slug:site.slug,displayName:site.displayName,language:site.language,quality:site.quality,status:site.status,publication:site.publication,updatedAt:site.updatedAt,createdAt:site.createdAt};
}
export function json(value,status=200){
  return new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
}

export function renderPresite(site,{standalone=true}={}){
  const quality=QUALITIES.has(site.quality)?site.quality:'good',theme=site.theme||{};
  const blocks=new Map((site.blocks||[]).map(block=>[block.id,block]));
  const block=id=>blocks.get(id)||{};
  const featureIds=['challenge','promise','capabilities','proof'];
  const cards=featureIds.map(id=>{const item=block(id);return `<article class="ps-card"><span>${esc(item.eyebrow)}</span><h2>${esc(item.title)}</h2><p>${esc(item.body)}</p></article>`}).join('');
  const hero=block('hero'),cta=block('cta');
  return `<!doctype html><html lang="${esc(site.language)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${esc(site.displayName)} · Presite</title><style>
  :root{--bg:${esc(theme.primary||'#09141d')};--accent:${esc(theme.accent||'#65e9f4')};--glow:${esc(theme.glow||'#3df08a')};--ink:#f5f8fb;--mut:#a6b6c8;--line:color-mix(in srgb,var(--accent) 28%,transparent)}
  *{box-sizing:border-box}html{background:var(--bg);scroll-behavior:smooth}body{margin:0;color:var(--ink);background:var(--bg);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;overflow-x:hidden}a{color:inherit}.ps-noise{position:fixed;inset:0;pointer-events:none;opacity:.22;background-image:linear-gradient(rgba(255,255,255,.028) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.028) 1px,transparent 1px);background-size:34px 34px}.ps-wrap{width:min(1180px,calc(100% - 42px));margin:auto;position:relative}.ps-nav{height:74px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line);font:800 11px/1 ui-monospace,monospace;letter-spacing:.14em;text-transform:uppercase}.ps-nav b{color:var(--accent)}.ps-nav i{width:8px;height:8px;background:var(--glow);box-shadow:0 0 18px var(--glow)}.ps-hero{min-height:min(820px,88vh);display:grid;align-content:center;position:relative;padding:80px 0}.ps-hero::after{content:"";position:absolute;width:48vw;aspect-ratio:1;right:-16vw;top:8%;border:1px solid var(--line);transform:rotate(12deg);background:radial-gradient(circle at 35% 35%,color-mix(in srgb,var(--accent) 32%,transparent),transparent 58%);filter:blur(.1px)}.ps-eyebrow{display:flex;align-items:center;gap:12px;color:var(--accent);font:800 11px/1 ui-monospace,monospace;letter-spacing:.2em;text-transform:uppercase}.ps-eyebrow::before{content:"";width:34px;height:2px;background:var(--accent)}h1{max-width:900px;margin:24px 0 22px;font-size:clamp(54px,9vw,128px);line-height:.88;letter-spacing:-.065em;position:relative;z-index:1}.ps-lead{max-width:680px;margin:0;color:var(--mut);font-size:clamp(17px,2vw,23px);line-height:1.55}.ps-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1px;background:var(--line);border:1px solid var(--line);margin:0 0 120px}.ps-card{min-height:330px;padding:clamp(28px,5vw,62px);background:color-mix(in srgb,var(--bg) 94%,white 6%);display:flex;flex-direction:column;justify-content:flex-end}.ps-card span{color:var(--accent);font:800 10px/1 ui-monospace,monospace;letter-spacing:.18em}.ps-card h2{font-size:clamp(28px,4vw,52px);line-height:.95;letter-spacing:-.04em;margin:22px 0 18px}.ps-card p{color:var(--mut);font-size:16px;line-height:1.6;max-width:48ch;margin:0}.ps-cta{margin-bottom:42px;padding:clamp(40px,7vw,90px);border:1px solid var(--line);background:linear-gradient(120deg,color-mix(in srgb,var(--accent) 14%,var(--bg)),var(--bg));position:relative;overflow:hidden}.ps-cta h2{font-size:clamp(38px,6vw,78px);max-width:840px;line-height:.98;letter-spacing:-.045em;margin:20px 0}.ps-cta p{color:var(--mut);font-size:18px;max-width:60ch}.ps-button{display:inline-flex;margin-top:26px;padding:16px 20px;background:var(--accent);color:#041014;text-decoration:none;font:900 12px/1 ui-monospace,monospace;text-transform:uppercase;letter-spacing:.08em}.ps-foot{display:flex;justify-content:space-between;padding:28px 0 44px;color:var(--mut);font:700 10px/1 ui-monospace,monospace;letter-spacing:.12em;text-transform:uppercase}
  body[data-quality="better"] .ps-hero{grid-template-columns:minmax(0,1fr) 18vw}body[data-quality="better"] .ps-grid{transform:skewY(-1.5deg);margin-top:40px}body[data-quality="better"] .ps-card>*{transform:skewY(1.5deg)}body[data-quality="better"] .ps-card:nth-child(2),body[data-quality="better"] .ps-card:nth-child(3){background:color-mix(in srgb,var(--bg) 86%,var(--accent) 14%)}
  body[data-quality="best"]{background:radial-gradient(100% 90% at 80% -10%,color-mix(in srgb,var(--accent) 25%,transparent),transparent 65%),var(--bg)}body[data-quality="best"] .ps-hero::before{content:"";position:absolute;inset:10% -10% 4% 38%;background:linear-gradient(135deg,color-mix(in srgb,var(--glow) 32%,transparent),transparent 48%),linear-gradient(45deg,transparent 48%,var(--line) 49%,transparent 50%);clip-path:polygon(18% 0,100% 0,82% 100%,0 100%);opacity:.75}body[data-quality="best"] h1{mix-blend-mode:screen;text-shadow:0 0 60px color-mix(in srgb,var(--accent) 28%,transparent)}body[data-quality="best"] .ps-grid{grid-template-columns:1fr 1.35fr}body[data-quality="best"] .ps-card{min-height:410px}body[data-quality="best"] .ps-card:nth-child(2),body[data-quality="best"] .ps-card:nth-child(4){transform:translateY(36px);background:linear-gradient(145deg,color-mix(in srgb,var(--accent) 18%,var(--bg)),var(--bg))}
  @media(max-width:720px){.ps-wrap{width:min(100% - 28px,1180px)}.ps-nav{height:62px}.ps-hero{min-height:78vh;padding:64px 0}.ps-hero::after{width:90vw;right:-52vw}.ps-grid,body[data-quality="best"] .ps-grid{grid-template-columns:1fr}.ps-card,body[data-quality="best"] .ps-card{min-height:280px}body[data-quality="better"] .ps-grid{transform:none}body[data-quality="better"] .ps-card>*{transform:none}body[data-quality="best"] .ps-card:nth-child(2),body[data-quality="best"] .ps-card:nth-child(4){transform:none}.ps-foot{gap:20px;flex-direction:column}}
  @media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
  </style></head><body data-quality="${quality}"><div class="ps-noise"></div><div class="ps-wrap"><nav class="ps-nav"><span><b>ADmiraNeXT</b> · Presite</span><i aria-hidden="true"></i></nav><main><section class="ps-hero"><div><div class="ps-eyebrow">${esc(hero.eyebrow)}</div><h1>${esc(hero.title)}</h1><p class="ps-lead">${esc(hero.body)}</p></div></section><section class="ps-grid">${cards}</section><section class="ps-cta"><div class="ps-eyebrow">${esc(cta.eyebrow)}</div><h2>${esc(cta.title)}</h2><p>${esc(cta.body)}</p><a class="ps-button" href="#contact">${esc(cta.button)}</a></section></main><footer class="ps-foot"><span>${esc(site.displayName)}</span><span>${quality.toUpperCase()} · ${esc(site.language.toUpperCase())}</span></footer></div></body></html>`;
}
