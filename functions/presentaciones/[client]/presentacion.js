function esc(value){ return String(value==null?'':value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function color(value,fallback){ return /^#[0-9a-f]{6}$/i.test(String(value||''))?value:fallback; }
function safeJson(value){ return JSON.stringify(value).replace(/</g,'\\u003c'); }
function option(value,allowed,fallback){ return allowed.includes(value)?value:fallback; }
function fontStack(style){ return style==='serif'?'Georgia,"Times New Roman",serif':style==='mono'?'ui-monospace,"SF Mono",Menlo,monospace':style==='rounded'?'"Arial Rounded MT Bold",Nunito,-apple-system,sans-serif':'Inter,-apple-system,"Segoe UI",Roboto,Arial,sans-serif'; }
import {getDeckPack} from '../_deck-library.js';
import {normalizeSlideMedia} from '../_slide-media.js';

function slideMediaMarkup(entry){
  if(!entry)return '';
  const common=`data-slide-media-root data-media-slide="${esc(entry.slide)}" data-media-type="${esc(entry.type)}" data-media-preload="${esc(entry.preload)}" data-media-autoplay="${entry.autoplay?'true':'false'}" data-media-rights-status="${esc(entry.rightsStatus)}" data-media-state="${entry.usable?'idle':'fallback'}"`;
  const fallback=`<div class="slide-media-fallback" data-slide-media-fallback role="status" aria-live="polite"${entry.usable?' hidden':''}><strong>Contenido alternativo</strong><span>${esc(entry.fallback)}</span></div>`;
  if(entry.type==='animation'){
    return `<div class="slide-media-animation" ${common} data-slide-media data-slide-media-animation="${esc(entry.animation)}" data-animation="${esc(entry.animation)}" data-animation-state="idle" style="--slide-media-duration:${entry.durationMs}ms">${fallback}</div>`;
  }
  const source=entry.effectiveSrc;
  const caption=entry.effectiveCaption;
  const media=!source?'':entry.type==='video'
    ? `<video data-slide-media-element src="${esc(source)}"${entry.effectivePoster?` poster="${esc(entry.effectivePoster)}"`:''}${entry.muted?' muted':''}${entry.loop?' loop':''} preload="none" playsinline aria-label="${esc(caption||'Vídeo de la diapositiva')}"></video>`
    : entry.type==='audio'
      ? `<audio data-slide-media-element src="${esc(source)}"${entry.loop?' loop':''} preload="none" aria-label="${esc(caption||'Audio de la diapositiva')}"></audio>`
      : `<img data-slide-media-element src="${esc(source)}" alt="${esc(caption||'Imagen de la diapositiva')}" loading="lazy">`;
  const control=source&&['video','audio'].includes(entry.type)?'<button class="slide-media-control" type="button" data-slide-media-control aria-label="Reproducir o pausar el contenido multimedia">Reproducir</button>':'';
  return `<figure class="slide-media" ${common} data-slide-media>${media}${caption?`<figcaption>${esc(caption)}</figcaption>`:''}${control}${fallback}</figure>`;
}

function visibleBlock(value={}){
  // El tiempo declarado viaja con el bloque. Esta proyeccion recortaba a los cinco
  // campos de texto, asi que los minutos guardados en el esqueleto no llegaban nunca
  // a la lamina: cuarto y ultimo eslabon del mismo contrato (leer, escribir, guardar
  // y proyectar), y cada uno lo perdia en silencio.
  const tiempo=Number(value.seconds)>0?{seconds:Number(value.seconds)}:(Number(value.minutes)>0?{minutes:Number(value.minutes)}:{});
  return {id:value.id||'',title:value.title||'',message:value.message||'',detail:value.detail||'',enabled:value.enabled!==false,...tiempo};
}
function visibleLocale(value={},fallback={}){
  return {
    hero:{eyebrow:value.hero?.eyebrow||fallback.hero?.eyebrow||'',title:value.hero?.title||fallback.hero?.title||'',summary:value.hero?.summary||fallback.hero?.summary||''},
    objective:value.objective||fallback.objective||'',
    skeleton:(value.skeleton||fallback.skeleton||[]).filter(item=>item.enabled!==false).map(visibleBlock),
    closing:{title:value.closing?.title||fallback.closing?.title||'',action:value.closing?.action||fallback.closing?.action||''},
    labels:{objective:value.labels?.objective||fallback.labels?.objective||'',next:value.labels?.next||fallback.labels?.next||''}
  };
}
function visibleIdeas(value={}){
  const base=visibleLocale(value),translations={};
  for(const [language,translation] of Object.entries(value.translations||{})) translations[language]=visibleLocale(translation,base);
  return {...base,translations};
}

function withPresenterMode(html,notes,audienceMode=false,sourceTraceability=null,compatibilityLab=null,roomDeviceLab=null,mediaRights=[]){
  const publicHtml=audienceMode?html.replace(/\sdata-speaker-notes=(?:"[^"]*"|'[^']*')/gi,''):html;
  const marked=audienceMode?publicHtml.replace('<html','<html class="presenter-audience-mode" data-presenter-surface="audience"'):publicHtml;
  const presenterData=audienceMode?'':`<script>window.__ADMIRA_PRESENTER_NOTES__=${safeJson(String(notes||''))};window.__ADMIRA_SOURCE_TRACEABILITY__=${safeJson(sourceTraceability||null)};window.__ADMIRA_COMPATIBILITY_LAB__=${safeJson(compatibilityLab||null)};window.__ADMIRA_ROOM_DEVICE_LAB__=${safeJson(roomDeviceLab||null)};window.__ADMIRA_MEDIA_RIGHTS__=${safeJson(mediaRights)}</script>`;
  const sourceTraceabilityScript=audienceMode?'':'<script src="/assets/presentation-source-traceability.js?v=20260724-1"></script>';
  const roomDeviceLabScript=audienceMode?'':'<script src="/assets/presentation-room-device-lab.js?v=20260724-1"></script>';
  const speakerHandoffScript=audienceMode?'':'<script src="/assets/presentation-speaker-handoff.js?v=20260723-1"></script>';
  const productionBackchannelScript=audienceMode?'':'<script src="/assets/presentation-production-backchannel.js?v=20260723-1"></script>';
  const translationReviewStyle=audienceMode?'':'<link rel="stylesheet" href="/assets/presentation-translation-review.css?v=20260723-1">';
  const translationReviewScript=audienceMode?'':'<script src="/assets/presentation-translation-review.js?v=20260723-1"></script>';
  return marked
    .replace('</head>',`<link rel="stylesheet" href="/assets/presentation-presenter-mode.css?v=20260902-2"><link rel="stylesheet" href="/assets/presentation-caption-accessibility.css?v=20260723-2"><link rel="stylesheet" href="/assets/presentation-slide-media.css?v=20260723-1"><link rel="stylesheet" href="/assets/presentation-floating-labels.css?v=20260902-1"><link rel="stylesheet" href="/assets/presentation-clean-mode.css?v=20260903-1">${translationReviewStyle}</head>`)
    .replace('</body>',`${presenterData}<script src="/assets/presentation-caption-accessibility.js?v=20260723-2"></script><script src="/assets/presentation-pace-coach.js?v=20260723-1"></script><script src="/assets/presentation-share-guardian.js?v=20260723-1"></script>${speakerHandoffScript}${productionBackchannelScript}${sourceTraceabilityScript}${roomDeviceLabScript}<script src="/assets/presentation-presenter-mode.js?v=20260902-2"></script><script src="/assets/presentation-slide-media.js?v=20260724-carlos-approval"></script>${translationReviewScript}<script src="/assets/presentation-ui-i18n.js?v=20260902-3"></script><script src="/assets/presentation-floating-labels.js?v=20260902-1"></script><script src="/assets/presentation-clean-mode.js?v=20260903-1"></script></body>`);
}

const sectionLabels={
  es:{who:'Quiénes somos',what:'Qué hacemos',how:'Cómo lo hacemos',proposal:'Qué proponemos'},
  ca:{who:'Qui som',what:'Què fem',how:'Com ho fem',proposal:'Què proposem'},
  en:{who:'Who we are',what:'What we do',how:'How we do it',proposal:'What we propose'}
};
const uiLabels={
  es:{languages:'Idiomas',sections:'Segmentos de la presentación',presentation:'Presentación',fullscreen:'Pantalla completa',fullscreenActive:'Pantalla completa activa · Esc para salir',logoAlt:'Logo de cliente'},
  ca:{languages:'Idiomes',sections:'Segments de la presentació',presentation:'Presentació',fullscreen:'Pantalla completa',fullscreenActive:'Pantalla completa activa · Esc per sortir',logoAlt:'Logotip del client'},
  en:{languages:'Languages',sections:'Presentation sections',presentation:'Presentation',fullscreen:'Full screen',fullscreenActive:'Full screen active · Esc to exit',logoAlt:'Client logo'}
};
function sectionForSlide(sourceSlide,position){if(position==='after')return 'proposal';const number=Number(sourceSlide)||1;return number<=10?'who':number<=20?'what':'how'}

function deckSlides(packId,client,position,options={}){
  const pack=getDeckPack(packId,client,options);if(!pack)return '';
  const adapted=Array.isArray(options.adaptedImages)?options.adaptedImages:[];
  return pack.slides.map(slide=>{
    const section=sectionForSlide(slide.sourceSlide,position),better={es:slide.bestUrl,ca:slide.bestUrl,en:slide.bestUrl},bestUrl=adapted[(slide.index-1)%adapted.length]||slide.bestUrl,best={es:bestUrl,ca:bestUrl,en:bestUrl},variants={good:slide.urls,better,best},urls=variants[pack.quality]||variants.good;
    const detail=slide.details||{},detailMarkup=detail.es?`<p class="deck-detail" data-deck-detail data-title-es="${esc(detail.es)}" data-title-ca="${esc(detail.ca)}" data-title-en="${esc(detail.en)}">${esc(detail.es)}</p>`:'';
    return `<section class="slide deck-slide deck-${esc(pack.quality)}" data-segment="${position}" data-section="${section}" data-deck-name="${esc(pack.shortTitle)}" data-deck-quality="${esc(pack.quality)}" data-deck-source="${slide.sourceSlide}"><img data-deck-image src="${esc(urls.es)}" data-src-good-es="${esc(slide.urls.es)}" data-src-good-ca="${esc(slide.urls.ca)}" data-src-good-en="${esc(slide.urls.en)}" data-src-better-es="${esc(better.es)}" data-src-better-ca="${esc(better.ca)}" data-src-better-en="${esc(better.en)}" data-src-best-es="${esc(best.es)}" data-src-best-ca="${esc(best.ca)}" data-src-best-en="${esc(best.en)}" data-alt-es="${esc(slide.titles.es)}" data-alt-ca="${esc(slide.titles.ca)}" data-alt-en="${esc(slide.titles.en)}" alt="${esc(slide.titles.es)}" loading="${slide.index===1?'eager':'lazy'}"><div class="deck-copy"><span class="deck-kicker" data-deck-kicker data-title-es="${esc(sectionLabels.es[section])}" data-title-ca="${esc(sectionLabels.ca[section])}" data-title-en="${esc(sectionLabels.en[section])}">${esc(sectionLabels.es[section])}</span><h2 data-deck-copy-title data-title-es="${esc(slide.titles.es)}" data-title-ca="${esc(slide.titles.ca)}" data-title-en="${esc(slide.titles.en)}">${esc(slide.titles.es)}</h2>${detailMarkup}</div><span class="deck-progress"><span data-deck-progress-label data-title-es="${esc(sectionLabels.es[section])}" data-title-ca="${esc(sectionLabels.ca[section])}" data-title-en="${esc(sectionLabels.en[section])}">${esc(sectionLabels.es[section])}</span> · ${slide.index}/${pack.slides.length}</span></section>`;
  }).join('');
}

export async function onRequestGet(context){
  const client=String(context.params.client||'').toLowerCase();
  const audienceMode=new URL(context.request?.url||`https://admiranext.local/presentaciones/${client}/presentacion`).searchParams.get('audience')==='1';
  const [config,ideas,imageSet]=await Promise.all([
    context.env.PRESENTATION_IDEAS?.get(`presentation:${client}`,{type:'json'}),
    context.env.PRESENTATION_IDEAS?.get(`ideas:${client}`,{type:'json'}),
    context.env.PRESENTATION_IDEAS?.get(`image-set:${client}`,{type:'json'})
  ]);
  if(client==='lacaixa'&&ideas&&context.env.ASSETS){
    const source=new URL('/presentaciones/LaCaixa/presentacion.html',context.request.url);
    const asset=await context.env.ASSETS.fetch(source);
    if(asset.ok){
      const marker='<script src="/presentaciones/LaCaixa/content-data?v=20260716-1"></script>';
      const presentationIdeas=audienceMode?visibleIdeas(ideas):ideas;
      const html=(await asset.text())
        .replace(marker,'')
        .replace('ideas=window.__ADMIRA_PRESENTATION_CONTENT__||null;',`ideas=${safeJson(presentationIdeas)};`);
      return new Response(withPresenterMode(html,ideas.notes,audienceMode,config?.sourceTraceability,config?.compatibilityLab,config?.roomDeviceLab),{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store, must-revalidate','x-robots-tag':'noindex, nofollow'}});
    }
  }
  if(!config||!ideas) return context.next();
  if(Array.isArray(config.outputs)&&config.outputs.length&&!config.outputs.includes('website')) return new Response('Website no solicitado',{status:404});

  const primary=color(config.theme?.primary,'#12233e'),accent=color(config.theme?.accent,'#ffb000');
  const mode=option(config.theme?.mode,['dark','light'],'dark'),layout=option(config.theme?.layout,['editorial','centered'],'editorial'),profile=option(config.theme?.profile,['immersive','editorial','friendly','minimal','structured'],'structured');
  const background=color(config.theme?.background,mode==='dark'?'#07101b':'#f4f6f8'),surface=color(config.theme?.surface,mode==='dark'?'#111827':'#ffffff'),text=color(config.theme?.text,mode==='dark'?'#f8fbff':'#142238');
  const radius=Math.max(0,Math.min(32,Number(config.theme?.radius)||10)),shape=config.theme?.radiusStyle==='rounded'?'50%':`${Math.max(2,radius)}px`,density=option(config.theme?.density,['compact','balanced','airy'],'balanced');
  const slidePad=density==='airy'?'11vh 9vw':density==='compact'?'7vh 6vw':'9vh 7vw';
  const name=esc(config.displayName); const logo=config.brand?.logoUrl===`/presentaciones/${client}/brand/logo`?esc(config.brand.logoUrl):''; const baseBlocks=(ideas.skeleton||[]).filter(item=>item.enabled!==false).map(visibleBlock);
  const languages=(Array.isArray(config.languages)&&config.languages.length?config.languages:ideas.languages)||['es'];
  // EL DECK NACE EN SU IDIOMA, NO EN CASTELLANO Y LUEGO CORREGIDO (Neo · MBP14, 02-09-2026).
  // El HTML se pintaba siempre con el contenido base —que por convencion del modelo ES el
  // castellano— y el idioma real lo aplicaba el script al cargar. Mientras NVIDIA fue solo
  // inglesa daba igual; con los dos idiomas, el cliente ve un parpadeo de castellano antes
  // de que salte el ingles, y si el script no llega a correr se queda en el idioma que no es.
  // Ojo: NO se toca baseBlocks, porque de ahi sale locales.es y lo dejariamos en ingles.
  // Los ids y los minutos siguen viniendo del esqueleto base; solo se sustituye el texto.
  const idiomaInicial=languages[0]||'es';
  const traduccionInicial=idiomaInicial==='es'?null:(ideas.translations||{})[idiomaInicial];
  const enIdiomaInicial=(bloque,indice)=>{
    if(!traduccionInicial)return bloque;
    const lista=Array.isArray(traduccionInicial.skeleton)?traduccionInicial.skeleton:[];
    const fuente=lista.find(item=>item&&item.id===bloque.id)||lista[indice];
    return fuente?{...bloque,title:fuente.title||bloque.title,message:fuente.message||bloque.message,detail:fuente.detail||bloque.detail}:bloque;
  };
  const heroInicial=traduccionInicial?.hero||ideas.hero;
  const objetivoInicial=traduccionInicial?.objective||ideas.objective;
  const cierreInicial=traduccionInicial?.closing||ideas.closing;
  const etiquetasIniciales=traduccionInicial?.labels||null;
  // WEBS VIVAS DENTRO DEL DECK (Neo · MBP14, 02-09-2026). Ver _embeds.js para el modelo.
  // Van DESPUES del argumento y antes del cierre: son la prueba, no la tesis.
  // El iframe nace INERTE (pointer-events:none) y se activa al hacer clic. Sin eso, una web
  // a pantalla completa dentro de un deck con scroll-snap se traga la rueda del raton y la
  // presentacion deja de pasar de lamina — el clasico «se ha colgado» que no es tal.
  const embeds=Array.isArray(ideas.embeds)?ideas.embeds:[];
  const embedSlides=embeds.map((item,indice)=>`<section class="slide embed-slide" data-slide-key="embed-${esc(item.id)}" data-segment="proposal" data-section="proposal" data-embed-host="${esc(item.host)}">
    <div class="inner">
      <span class="num">${String(baseBlocks.length+indice+1).padStart(2,'0')}</span>
      <h2>${esc(item.title)}</h2>
      ${item.note?`<p class="detail">${esc(item.note)}</p>`:''}
      <div class="embed-frame" data-embed-idle="1">
        <iframe title="${esc(item.title)}" data-embed-src="${esc(item.url)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox" allow="fullscreen; autoplay; clipboard-write"></iframe>
        <button type="button" class="embed-activate" data-embed-activate>${esc(item.host)} ·  ▶</button>
      </div>
      <a class="embed-out" href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">${esc(item.url)} ↗</a>
    </div>
  </section>`).join('');
  const locales={es:visibleLocale({...ideas,skeleton:baseBlocks})};
  for(const language of languages){
    if(language==='es') continue;
    const translated=ideas.translations?.[language];
    locales[language]=translated?visibleLocale(translated):null;
  }
  const imageSlides=Array.isArray(imageSet?.slides)?imageSet.slides:[];
  const slideMedia=[],occupiedMediaSlides=new Set();
  for(const rawMedia of Array.isArray(config.slideMedia)?config.slideMedia:[]){
    try{
      const [entry]=normalizeSlideMedia([rawMedia],client);
      if(entry&&!occupiedMediaSlides.has(entry.slide)){slideMedia.push(entry);occupiedMediaSlides.add(entry.slide)}
    }catch(_){}
  }
  const mediaFor=slide=>slideMediaMarkup(slideMedia.find(entry=>entry.slide===String(slide).toLowerCase()));
  const mediaRights=slideMedia.map(entry=>{
    const effectiveRights=entry.replacementUsed?entry.replacement?.rights:entry.rights;
    return {
      slide:entry.slide,
      type:entry.type,
      status:entry.rightsStatus,
      originalStatus:entry.rights?.status||'',
      replacementUsed:entry.replacementUsed,
      source:effectiveRights?.source||'',
      permission:effectiveRights?.permission||'',
      license:effectiveRights?.license||'',
      holder:effectiveRights?.holder||'',
      attribution:effectiveRights?.attribution||'',
      expiresAt:effectiveRights?.expiresAt||'',
      acceptedByCarlos:effectiveRights?.acceptedByCarlos===true,
      acceptedAt:effectiveRights?.acceptedAt||'',
      approvalNote:effectiveRights?.approvalNote||''
    };
  });
  const adaptedImages=imageSlides.filter(slide=>slide?.status==='ready'&&slide?.textFreeVerified===true&&new RegExp(`^/presentaciones/${client}/images/[a-z0-9._-]+$`,'i').test(String(slide?.url||''))).map(slide=>slide.url);
  const imageAttr=index=>{const slide=imageSlides[index],url=String(slide?.url||'');return slide?.status==='ready'&&slide?.textFreeVerified===true&&new RegExp(`^/presentaciones/${client}/images/[a-z0-9._-]+$`,'i').test(url)?` data-has-image="true" style="--slide-image:url('${esc(url)}')"`:''};
  // EL GUION DE ENSAYO SALE DEL DOCUMENTO, NO DEL REPARTO A PARTES IGUALES
  // (Neo · MBP14, 02-09-2026). El entrenador de ritmo YA leia data-presenter-seconds
  // por lamina (presentation-presenter-mode.js:1988), pero ningun sitio lo escribia:
  // todas las laminas de contenido pesaban 1.15 y el plan salia plano —dos minutos
  // para «donde encaja NVIDIA» y dos para «donde aterriza», que no es lo mismo—.
  // Ahora un bloque del esqueleto puede declarar sus minutos (minutes) o segundos
  // (seconds) y el ensayo los respeta; sin declarar, todo sigue como estaba.
  const presenterSeconds=item=>{
    const segundos=Number(item?.seconds)>0?Number(item.seconds):Number(item?.minutes)*60;
    return Number.isFinite(segundos)&&segundos>0?` data-presenter-seconds="${Math.round(Math.min(segundos,3600))}"`:'';
  };
  const slides=baseBlocks.map((bloqueBase,index)=>{const item=enIdiomaInicial(bloqueBase,index);const key=String(item.id||`idea-${index+1}`).toLowerCase();return `<section class="slide"${presenterSeconds(item)}${mediaFor(key)?' data-slide-media':''} data-slide-key="${esc(key)}" data-segment="proposal" data-section="proposal" data-image-index="${index+2}" data-block="${index}" data-block-id="${esc(item.id||`idea-${index+1}`)}"${imageAttr(index+2)}>${mediaFor(key)}<div class="inner"><span class="num">${String(index+1).padStart(2,'0')}</span><h2 data-edit-field="skeleton.title">${esc(item.title)}</h2><p class="message" data-edit-field="skeleton.message">${esc(item.message)}</p><p class="detail" data-edit-field="skeleton.detail">${esc(item.detail)}</p></div></section>`}).join('');
  const initialUi=uiLabels[idiomaInicial]||uiLabels.es;
  const buttons=(logo?`<button type="button" class="brand-identity" data-client-fullscreen aria-pressed="false" aria-label="${esc(initialUi.fullscreen)}" title="${esc(initialUi.fullscreen)}"><span class="brand-mark"><img src="${logo}" alt="${esc(initialUi.logoAlt)} · ${name}"></span><span class="brand-name">${name}</span></button>`:'')+languages.map((language,index)=>`<button type="button" data-language="${esc(language)}" aria-pressed="${index===0?'true':'false'}">${esc(language.toUpperCase())}</button>`).join('');
  const initialQuality=option(config.sequence?.beforeQuality,['good','better','best'],'good');
  const beforeSlides=deckSlides(config.sequence?.before,client,'before',{length:config.sequence?.beforeLength,quality:initialQuality,adaptedImages}),afterSlides=deckSlides(config.sequence?.after,client,'after',{quality:initialQuality,adaptedImages});
  const sectionNav=Object.entries(sectionLabels.es).map(([section,label],index)=>`<button type="button" data-section-target="${section}" aria-pressed="${index===0?'true':'false'}"><b>${String(index+1).padStart(2,'0')}</b><span data-section-label data-label-es="${esc(label)}" data-label-ca="${esc(sectionLabels.ca[section])}" data-label-en="${esc(sectionLabels.en[section])}">${esc(label)}</span></button>`).join('');

  let html=`<!doctype html><html lang="${esc(languages[0]||'es')}" data-mode="${mode}" data-layout="${layout}" data-profile="${profile}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${name} · Presentación</title><style>
  :root{--primary:${primary};--accent:${accent};--bg:${background};--surface:${surface};--ink:${text};--radius:${radius}px;--shape:${shape};--mono:ui-monospace,"SF Mono",Menlo,monospace;--sans:${fontStack(config.theme?.fontStyle)}}*{box-sizing:border-box}html{scroll-snap-type:y mandatory;scroll-behavior:smooth}body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--sans)}.slide{min-height:100vh;scroll-snap-align:start;display:grid;place-items:center;padding:${slidePad};position:relative;overflow:hidden;background:radial-gradient(80% 75% at 100% 0%,color-mix(in srgb,var(--accent) 24%,transparent),transparent 65%),linear-gradient(135deg,var(--primary),var(--bg))}.slide:nth-child(even){background:radial-gradient(80% 75% at 0% 100%,color-mix(in srgb,var(--accent) 20%,transparent),transparent 65%),linear-gradient(225deg,var(--primary),var(--bg))}.slide[data-has-image="true"]:before{content:"";position:absolute;inset:0;background-image:linear-gradient(105deg,color-mix(in srgb,var(--bg) 92%,transparent) 0%,color-mix(in srgb,var(--bg) 72%,transparent) 52%,color-mix(in srgb,var(--primary) 38%,transparent) 100%),var(--slide-image);background-size:cover;background-position:center;filter:saturate(.92);transform:scale(1.01)}.slide:after{content:"";position:absolute;width:36vw;height:36vw;border:6vw solid color-mix(in srgb,var(--accent) 12%,transparent);border-radius:var(--shape);right:-18vw;bottom:-22vw;transform:rotate(-12deg)}.inner{position:relative;z-index:1;width:min(1050px,100%)}html[data-layout="centered"] .inner{text-align:center;margin:auto}html[data-layout="centered"] h1,html[data-layout="centered"] h2,html[data-layout="centered"] p,html[data-layout="centered"] .close span{margin-left:auto;margin-right:auto}.num,.eyebrow{display:block;font:800 12px/1 var(--mono);letter-spacing:.18em;text-transform:uppercase;color:var(--accent);margin-bottom:28px}h1,h2{font-size:clamp(44px,8vw,100px);line-height:.98;letter-spacing:-.05em;margin:0;max-width:1000px}.cover h1{font-size:clamp(50px,9vw,118px)}.message{font-size:clamp(21px,3vw,38px);line-height:1.2;font-weight:700;max-width:920px;margin:34px 0 0}.detail{font-size:clamp(15px,1.6vw,20px);line-height:1.55;color:color-mix(in srgb,var(--ink) 66%,transparent);max-width:760px;margin:24px 0 0}.close strong{display:block;font-size:clamp(42px,7vw,90px);line-height:1;letter-spacing:-.045em}.close span{display:block;font-size:clamp(18px,2.5vw,30px);color:color-mix(in srgb,var(--ink) 68%,transparent);margin-top:28px;max-width:850px}.nav{position:fixed;z-index:9;right:18px;bottom:18px;background:color-mix(in srgb,var(--surface) 72%,transparent);backdrop-filter:blur(10px);border:1px solid color-mix(in srgb,var(--ink) 15%,transparent);border-radius:calc(var(--radius) + 16px);padding:10px 14px;font:700 10px/1 var(--mono);letter-spacing:.08em;color:color-mix(in srgb,var(--ink) 72%,transparent)}.languages{position:fixed;z-index:10;right:18px;top:18px;display:flex;background:color-mix(in srgb,var(--surface) 72%,transparent);border:1px solid color-mix(in srgb,var(--ink) 15%,transparent);border-radius:calc(var(--radius) + 16px);padding:4px;backdrop-filter:blur(10px)}.languages button{border:0;border-radius:calc(var(--radius) + 12px);padding:9px 11px;background:transparent;color:color-mix(in srgb,var(--ink) 68%,transparent);font:800 10px/1 var(--mono);cursor:pointer}.languages button[aria-pressed="true"]{background:var(--accent);color:var(--bg)}.embed-slide .inner{width:min(1280px,100%)}.embed-frame{position:relative;margin-top:24px;aspect-ratio:16/9;border:1px solid color-mix(in srgb,var(--ink) 16%,transparent);border-radius:var(--radius);overflow:hidden;background:#05070a}.embed-frame iframe{display:block;width:100%;height:100%;border:0}.embed-frame[data-embed-idle] iframe{pointer-events:none}.embed-activate{position:absolute;inset:auto 12px 12px auto;z-index:2;border:1px solid color-mix(in srgb,var(--ink) 22%,transparent);border-radius:999px;padding:9px 13px;background:color-mix(in srgb,var(--surface) 88%,transparent);color:var(--ink);font:800 10px/1 var(--mono);letter-spacing:.08em;cursor:pointer;backdrop-filter:blur(10px)}.embed-frame:not([data-embed-idle]) .embed-activate{display:none}.embed-out{display:inline-block;margin-top:14px;color:color-mix(in srgb,var(--ink) 62%,transparent);font:700 11px/1.4 var(--mono);text-decoration:none;overflow-wrap:anywhere}.embed-out:hover{color:var(--accent)}.deck-slide{padding:0;background:#07090d}.deck-slide:after{display:none}.deck-slide img{display:block;width:100%;height:100vh;object-fit:contain;background:#07090d}.deck-copy{display:none}.deck-better img,.deck-best img{object-fit:cover;filter:saturate(.7) contrast(1.08) brightness(.62);transform:scale(1.015)}.deck-best img{filter:saturate(.9) contrast(1.12) brightness(.7)}.deck-better:before,.deck-best:before{content:"";position:absolute;z-index:1;inset:0;background:linear-gradient(90deg,rgba(4,8,15,.94) 0%,rgba(4,8,15,.72) 42%,rgba(4,8,15,.12) 76%),linear-gradient(0deg,rgba(4,8,15,.6),transparent 44%)}.deck-copy{position:absolute;z-index:2;left:7vw;bottom:15vh;width:min(760px,72vw);color:#fff}.deck-better .deck-copy,.deck-best .deck-copy{display:block}.deck-kicker{display:block;margin-bottom:25px;color:var(--accent);font:800 12px/1 var(--mono);letter-spacing:.2em;text-transform:uppercase}.deck-copy h2{font-size:clamp(46px,7.5vw,105px);line-height:.92;text-wrap:balance;text-shadow:0 3px 36px rgba(0,0,0,.55)}.deck-best .deck-kicker{color:#ffbe2e}.deck-best .deck-copy h2{font-family:Georgia,"Times New Roman",serif;font-weight:500;letter-spacing:-.04em}.deck-progress{position:absolute;left:18px;bottom:18px;z-index:3;padding:9px 12px;border-radius:999px;background:rgba(5,8,12,.76);color:#fff;font:800 9px/1 var(--mono);letter-spacing:.06em;backdrop-filter:blur(10px)}html[data-profile="minimal"] .slide:after{display:none}html[data-profile="editorial"] h1,html[data-profile="editorial"] h2{letter-spacing:-.035em}html[data-profile="friendly"] h1,html[data-profile="friendly"] h2{letter-spacing:-.03em}html[data-profile="immersive"] .slide:not([data-has-image="true"]):not(.deck-slide){background:radial-gradient(100% 100% at 85% 0%,color-mix(in srgb,var(--accent) 36%,transparent),transparent 65%),linear-gradient(145deg,var(--primary),var(--bg))}@media(max-width:650px){.slide:not(.deck-slide){padding:10vh 8vw}.nav{display:none}.deck-progress{left:10px;bottom:10px}.deck-copy{left:8vw;bottom:13vh;width:84vw}.deck-copy h2{font-size:clamp(38px,13vw,68px)}}
  </style><style>html[data-quality="good"]{--primary:#e9ece2;--accent:#789b3a;--bg:#f7f8f3;--surface:#fff;--ink:#18212a;--sans:Inter,-apple-system,"Segoe UI",Arial,sans-serif}html[data-quality="better"]{--primary:#12233e;--accent:#ffb000;--bg:#07101b;--surface:#111827;--ink:#f8fbff;--sans:Inter,-apple-system,"Segoe UI",Arial,sans-serif}html[data-quality="good"] .slide:not(.deck-slide){background:linear-gradient(135deg,#fff,#edf0e7)}html[data-quality="good"] .slide:not(.deck-slide):after{border-color:rgba(120,155,58,.13)}html[data-quality="better"] .slide:not(.deck-slide){background:radial-gradient(90% 80% at 85% 0%,rgba(255,176,0,.24),transparent 62%),linear-gradient(145deg,#12233e,#07101b)}html[data-quality="good"] .slide[data-has-image="true"]:before,html[data-quality="better"] .slide[data-has-image="true"]:before{display:none}.deck-slide,.slide{transition:background .35s,color .35s}.deck-best .deck-copy h2{font-family:var(--sans);font-weight:750}.deck-best .deck-kicker{color:var(--accent)}html[data-quality="best"] .deck-best img{filter:saturate(.94) contrast(1.08) brightness(.66)}.section-nav{position:fixed;z-index:20;left:50%;top:18px;transform:translateX(-50%);display:flex;gap:3px;padding:4px;border:1px solid color-mix(in srgb,var(--ink) 15%,transparent);border-radius:999px;background:color-mix(in srgb,var(--surface) 78%,transparent);backdrop-filter:blur(12px)}.section-nav button{display:flex;align-items:center;gap:7px;border:0;border-radius:999px;padding:8px 11px;background:transparent;color:color-mix(in srgb,var(--ink) 64%,transparent);font:750 10px/1 var(--sans);cursor:pointer;white-space:nowrap}.section-nav button b{font:800 9px/1 var(--mono);color:var(--accent)}.section-nav button[aria-pressed="true"]{background:var(--accent);color:var(--bg)}.section-nav button[aria-pressed="true"] b{color:inherit}.section-nav button:disabled{display:none}@media(max-width:1050px){.section-nav button{padding:9px}.section-nav button span{display:none}}@media(max-width:650px){.section-nav{top:auto;bottom:14px}.section-nav button{padding:8px 10px}}</style></head><body><div class="languages" aria-label="Idiomas">${buttons}</div><nav class="section-nav" aria-label="Segmentos de la presentación">${sectionNav}</nav>${beforeSlides}<section class="slide cover"${mediaFor('cover')?' data-slide-media':''} data-slide-key="cover" data-segment="proposal" data-section="proposal" data-image-index="0"${imageAttr(0)}>${mediaFor('cover')}<div class="inner"><span class="eyebrow" data-edit-field="hero.eyebrow">${esc(heroInicial?.eyebrow||`ADmiraNeXT × ${config.displayName}`)}</span><h1 id="coverTitle" data-edit-field="hero.title">${esc(heroInicial?.title)}</h1><p class="detail" id="coverSummary" data-edit-field="hero.summary">${esc(heroInicial?.summary)}</p></div></section><section class="slide"${mediaFor('objective')?' data-slide-media':''} data-slide-key="objective" data-segment="proposal" data-section="proposal" data-image-index="1"${imageAttr(1)}>${mediaFor('objective')}<div class="inner"><span class="eyebrow" id="objectiveLabel" data-edit-field="labels.objective">${esc(etiquetasIniciales?.objective||locales.es.labels.objective)}</span><h2 id="objectiveText" data-edit-field="objective">${esc(objetivoInicial)}</h2></div></section>${slides}${embedSlides}<section class="slide"${mediaFor('closing')?' data-slide-media':''} data-slide-key="closing" data-segment="proposal" data-section="proposal" data-image-index="${baseBlocks.length+2}"${imageAttr(baseBlocks.length+2)}>${mediaFor('closing')}<div class="inner close"><span class="eyebrow" id="nextLabel" data-edit-field="labels.next">${esc(etiquetasIniciales?.next||locales.es.labels.next)}</span><strong id="closingTitle" data-edit-field="closing.title">${esc(cierreInicial?.title)}</strong><span id="closingAction" data-edit-field="closing.action">${esc(cierreInicial?.action)}</span></div></section>${afterSlides}<div class="nav" id="sequenceNav">↑ ↓ · F pantalla completa</div><script>
  // Las webs embebidas se cargan cuando su lamina se acerca, no todas al abrir el deck:
  // cinco webs enteras arrancando a la vez hunden la presentacion justo cuando se abre
  // delante del cliente. Y se activan al clic, para no robarle la rueda al deck.
  (function(){
    var marcos=[].slice.call(document.querySelectorAll('.embed-frame'));
    if(!marcos.length)return;
    var cargar=function(marco){
      var iframe=marco.querySelector('iframe[data-embed-src]');
      if(!iframe||iframe.src)return;
      iframe.src=iframe.getAttribute('data-embed-src');
    };
    if('IntersectionObserver'in window){
      var vigia=new IntersectionObserver(function(entradas){
        entradas.forEach(function(entrada){
          if(!entrada.isIntersecting)return;
          cargar(entrada.target);vigia.unobserve(entrada.target);
        });
      },{rootMargin:'200% 0px'});
      marcos.forEach(function(marco){vigia.observe(marco)});
    }else marcos.forEach(cargar);
    document.addEventListener('click',function(evento){
      var boton=evento.target.closest('[data-embed-activate]');
      if(!boton)return;
      var marco=boton.closest('.embed-frame');
      cargar(marco);marco.removeAttribute('data-embed-idle');
    });
  })();
  const presentationState=window.__ADMIRA_PRESENTATION_STATE__={locales:${safeJson(locales)},languages:${safeJson(languages)},emptyLocale:${safeJson(visibleLocale({}))}${audienceMode?'':`,terminology:${safeJson(config.terminology||ideas.terminology||[])}`},sectionLabels:${safeJson(sectionLabels)},uiLabels:${safeJson(uiLabels)},displayName:${safeJson(config.displayName)},revision:${safeJson(ideas.updatedAt||'')},language:'es',quality:'${initialQuality}'};const slides=[...document.querySelectorAll('.slide')];let at=0;
  function syncNav(){const slide=slides[at],section=slide?.dataset.section||'proposal',label=presentationState.sectionLabels[presentationState.language]?.[section]||presentationState.sectionLabels.es[section]||'Presentación',nav=document.getElementById('sequenceNav');nav.textContent=label+' · '+(at+1)+'/'+slides.length+' · ↑ ↓ · F · H'+(nav.dataset.editorHint||'');document.querySelectorAll('[data-section-target]').forEach(button=>button.setAttribute('aria-pressed',button.dataset.sectionTarget===section?'true':'false'))}
  function go(n){at=Math.max(0,Math.min(slides.length-1,n));slides[at].scrollIntoView();syncNav();document.dispatchEvent(new CustomEvent('admira:slide-change',{detail:{index:at}}))}
  function applyDeckSource(){document.querySelectorAll('[data-deck-image]').forEach(image=>{const source=image.getAttribute('data-src-'+presentationState.quality+'-'+presentationState.language)||image.getAttribute('data-src-good-'+presentationState.language)||image.getAttribute('data-src-good-es'),alt=image.getAttribute('data-alt-'+presentationState.language)||image.getAttribute('data-alt-es')||'';if(source&&image.getAttribute('src')!==source)image.setAttribute('src',source);image.alt=alt})}
  function applyQuality(quality){if(!['good','better','best'].includes(quality))quality='good';presentationState.quality=quality;document.documentElement.dataset.quality=quality;document.querySelectorAll('.deck-slide').forEach(slide=>{slide.classList.remove('deck-good','deck-better','deck-best');slide.classList.add('deck-'+quality);slide.dataset.deckQuality=quality});applyDeckSource();document.querySelectorAll('[data-quality]').forEach(button=>button.setAttribute('aria-pressed',button.dataset.quality===quality?'true':'false'))}
  function applyLanguage(language){const content=presentationState.locales[language]||presentationState.emptyLocale,ui=presentationState.uiLabels[language]||presentationState.uiLabels.es;presentationState.language=language;document.documentElement.lang=language;document.title=presentationState.displayName+' · '+ui.presentation;document.querySelector('[data-edit-field="hero.eyebrow"]').textContent=content.hero?.eyebrow||'';document.getElementById('coverTitle').textContent=content.hero?.title||'';document.getElementById('coverSummary').textContent=content.hero?.summary||'';document.getElementById('objectiveText').textContent=content.objective||'';document.getElementById('objectiveLabel').textContent=content.labels?.objective||'';document.getElementById('nextLabel').textContent=content.labels?.next||'';document.getElementById('closingTitle').textContent=content.closing?.title||'';document.getElementById('closingAction').textContent=content.closing?.action||'';document.querySelectorAll('[data-block]').forEach((slide,index)=>{const block=(content.skeleton||[])[index]||{};slide.dataset.blockId=block.id||slide.dataset.blockId||'';slide.querySelector('h2').textContent=block.title||'';slide.querySelector('.message').textContent=block.message||'';slide.querySelector('.detail').textContent=block.detail||''});applyDeckSource();document.querySelectorAll('[data-deck-copy-title],[data-deck-kicker],[data-deck-progress-label],[data-deck-detail]').forEach(node=>{node.textContent=node.getAttribute('data-title-'+language)||node.getAttribute('data-title-es')||''});document.querySelectorAll('[data-section-label]').forEach(node=>{node.textContent=node.getAttribute('data-label-'+language)||node.getAttribute('data-label-es')||''});document.querySelector('.languages')?.setAttribute('aria-label',ui.languages);document.querySelector('.section-nav')?.setAttribute('aria-label',ui.sections);const fullscreen=document.querySelector('[data-client-fullscreen]');if(fullscreen){const active=Boolean(document.fullscreenElement);fullscreen.setAttribute('aria-pressed',String(active));fullscreen.setAttribute('aria-label',active?ui.fullscreenActive:ui.fullscreen);fullscreen.title=active?ui.fullscreenActive:ui.fullscreen;const image=fullscreen.querySelector('img');if(image)image.alt=ui.logoAlt+' · '+presentationState.displayName}document.querySelectorAll('[data-language]').forEach(button=>button.setAttribute('aria-pressed',button.dataset.language===language?'true':'false'));document.dispatchEvent(new CustomEvent('admira:language',{detail:{language}}));syncNav()}
  document.querySelectorAll('[data-language]').forEach(button=>button.addEventListener('click',()=>{applyLanguage(button.dataset.language);const url=new URL(location.href);url.searchParams.set('lang',button.dataset.language);history.replaceState(null,'',url)}));
  document.querySelectorAll('[data-section-target]').forEach(button=>{const target=slides.findIndex(slide=>slide.dataset.section===button.dataset.sectionTarget);button.disabled=target<0;button.addEventListener('click',()=>{if(target>=0)go(target)})});
  function applyImageSet(set){const imageSlides=Array.isArray(set?.slides)?set.slides:[],allowedImageUrl=new RegExp('^/presentaciones/${client}/images/[a-z0-9._-]+$','i'),adapted=[];let imported=0;document.querySelectorAll('[data-image-index]').forEach(slide=>{const image=imageSlides[Number(slide.dataset.imageIndex)],url=String(image?.url||'');if(image?.status!=='ready'||image?.textFreeVerified!==true||!allowedImageUrl.test(url))return;slide.dataset.hasImage='true';slide.style.setProperty('--slide-image',"url('"+url+"')");adapted.push(url);imported+=1});if(adapted.length)document.querySelectorAll('[data-deck-image]').forEach((image,index)=>{const url=adapted[index%adapted.length];for(const language of ['es','ca','en'])image.setAttribute('data-src-best-'+language,url)});applyDeckSource();return imported}
  async function syncImages(){try{const response=await fetch('api/images',{headers:{accept:'application/json'},cache:'no-store'});if(!response.ok)return;const data=await response.json();applyImageSet(data.imageSet);if(data.imageSet?.status==='complete')clearInterval(imageTimer)}catch(_){}}
  function enterFullscreen(){const target=document.documentElement,request=target.requestFullscreen||target.webkitRequestFullscreen;if(request&&!document.fullscreenElement){try{const pending=request.call(target);if(pending?.catch)pending.catch(()=>{})}catch(_){}}}
  document.querySelector('[data-client-fullscreen]')?.addEventListener('click',enterFullscreen);addEventListener('fullscreenchange',()=>applyLanguage(presentationState.language));
  window.__ADMIRA_APPLY_LANGUAGE__=applyLanguage;window.__ADMIRA_APPLY_QUALITY__=applyQuality;window.__ADMIRA_SYNC_NAV__=syncNav;addEventListener('keydown',event=>{if(event.target?.isContentEditable||event.target?.closest?.('input,textarea,select,button'))return;if(['ArrowDown','ArrowRight',' '].includes(event.key)){event.preventDefault();go(at+1)}if(['ArrowUp','ArrowLeft'].includes(event.key)){event.preventDefault();go(at-1)}if(event.key.toLowerCase()==='f')enterFullscreen()});addEventListener('scroll',()=>{let best=0,dist=Infinity;slides.forEach((slide,index)=>{const delta=Math.abs(slide.getBoundingClientRect().top);if(delta<dist){dist=delta;best=index}});at=best;syncNav()},{passive:true});// PANTALLA COMPLETA HASTA QUE SE PULSE ESC (Carlos, 02-09-2026). El cliente entra por el
  // boton del portal, que ahora trae ?fullscreen=1. El navegador solo concede pantalla
  // completa dentro de un gesto del usuario y el gesto se queda en la pagina anterior, asi
  // que se intenta de inmediato y, si lo rechaza, se arma UNA sola vez al primer clic o
  // tecla. Una sola vez a proposito: al salir con ESC no debe volver a entrar sola, que
  // seria imposible de abandonar. Salir es ESC, que es lo que ya hace el navegador.
  (function(){
    if(new URLSearchParams(location.search).get('fullscreen')!=='1')return;
    var raiz=document.documentElement,pedir=raiz.requestFullscreen||raiz.webkitRequestFullscreen;
    if(!pedir)return;
    var hecho=false;
    var entrar=function(){
      if(hecho||document.fullscreenElement)return;
      hecho=true;
      try{var p=pedir.call(raiz);if(p&&p.catch)p.catch(function(){});}catch(_){}
    };
    var alPrimerGesto=function(){entrar();quitar();};
    var quitar=function(){
      document.removeEventListener('pointerdown',alPrimerGesto,true);
      document.removeEventListener('keydown',alPrimerGesto,true);
    };
    try{
      var intento=pedir.call(raiz);
      if(intento&&intento.then)intento.then(quitar).catch(function(){
        document.addEventListener('pointerdown',alPrimerGesto,{capture:true,once:true});
        document.addEventListener('keydown',alPrimerGesto,{capture:true,once:true});
      });
      else quitar();
    }catch(_){
      document.addEventListener('pointerdown',alPrimerGesto,{capture:true,once:true});
      document.addEventListener('keydown',alPrimerGesto,{capture:true,once:true});
    }
  })();
  const query=new URLSearchParams(location.search),requestedLanguage=query.get('lang'),requestedQuality=query.get('quality');applyLanguage(presentationState.locales[requestedLanguage]?requestedLanguage:'${esc(languages[0]||'es')}');applyQuality(['good','better','best'].includes(requestedQuality)?requestedQuality:presentationState.quality);syncNav();const imageTimer=${Array.isArray(config.outputs)&&config.outputs.includes('backgrounds')&&imageSet?.status!=='complete'?'setInterval(syncImages,10000)':'0'};if(imageTimer){syncImages();addEventListener('pagehide',()=>clearInterval(imageTimer),{once:true})}
  </script></body></html>`;
  const responsiveGoodCss=`.deck-good{background:linear-gradient(145deg,#fbfcf8,#e8eddd)}.deck-good img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center;opacity:.72;filter:saturate(.84) contrast(.98) brightness(.98);transform:scale(1.04);background:#eef2e5}.deck-good:before{content:"";position:absolute;z-index:1;inset:0;background:linear-gradient(105deg,rgba(250,252,246,.92) 0%,rgba(250,252,246,.68) 30%,rgba(232,239,216,.2) 56%,rgba(120,155,58,.03) 100%)}.deck-good .deck-copy{display:flex;flex-direction:column;justify-content:flex-end;left:8vw;top:18vh;bottom:14vh;width:min(920px,80vw);color:#172126}.deck-good .deck-kicker{color:#789b3a}.deck-good .deck-copy h2{max-width:920px;font-family:Inter,-apple-system,"Segoe UI",Arial,sans-serif;font-size:clamp(52px,9vw,132px);font-weight:780;line-height:.9;letter-spacing:-.065em;text-shadow:0 1px 18px rgba(255,255,255,.46)}.deck-good .deck-progress{border:1px solid rgba(24,33,42,.16);background:rgba(255,255,255,.82);color:#263229}@media(max-aspect-ratio:4/5){.deck-good .deck-copy{left:8vw;top:19vh;bottom:14vh;width:84vw}.deck-good .deck-copy h2{font-size:clamp(46px,14vw,104px);line-height:.92}.deck-good img{opacity:.56;transform:scale(1.18)}.deck-good:before{background:linear-gradient(105deg,rgba(250,252,246,.95) 0%,rgba(250,252,246,.82) 52%,rgba(232,239,216,.38) 82%,rgba(120,155,58,.08) 100%)}}`;
  const responsiveDetailCss=`.deck-detail{display:none}.deck-good .deck-detail{display:block;max-width:720px;margin:24px 0 0;color:rgba(23,33,38,.68);font-size:clamp(17px,2vw,27px);font-weight:620;line-height:1.32}@media(max-aspect-ratio:4/5){.deck-good .deck-detail{max-width:82vw;font-size:clamp(16px,4.4vw,25px)}}`;
  const brandIdentityCss=`.brand-identity{display:flex;align-items:center;gap:8px;margin:0 5px 0 1px;padding:0 7px 0 1px;border:0;border-right:1px solid color-mix(in srgb,var(--ink) 14%,transparent);border-radius:0;background:transparent;color:inherit;font:inherit}.brand-mark{display:grid;place-items:center;width:44px;height:34px;flex:none;overflow:hidden;border:1px solid rgba(10,18,28,.22);border-radius:11px;background:linear-gradient(145deg,#fff 0%,#f4f6f8 58%,#dfe4e9 100%);box-shadow:inset 0 0 0 1px rgba(255,255,255,.9),0 2px 9px rgba(0,0,0,.18)}.brand-mark img{display:block;width:auto;height:24px;max-width:34px;object-fit:contain;background:transparent!important;filter:drop-shadow(0 0 1.2px rgba(255,255,255,.98)) drop-shadow(0 0 1.4px rgba(8,13,20,.92))}.brand-name{max-width:88px;overflow:hidden;text-overflow:ellipsis;color:color-mix(in srgb,var(--ink) 82%,transparent);font:800 9px/1 var(--mono);letter-spacing:.06em;text-transform:uppercase;white-space:nowrap}@media(max-width:760px){.brand-name{display:none}.brand-identity{gap:0;padding-right:4px}.brand-mark{width:40px}}`;
  html=html.replace('</head>',`<style>${responsiveGoodCss}${responsiveDetailCss}${brandIdentityCss}</style></head>`);
  return new Response(withPresenterMode(html,ideas.notes,audienceMode,config.sourceTraceability,config.compatibilityLab,config.roomDeviceLab,mediaRights),{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-robots-tag':'noindex, nofollow'}});
}
