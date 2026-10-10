/*
 * PROSPECT · la presentación se viste con la marca de quien la recibe (Carlos, 01-10-2026).
 *
 * Una presentación puede marcarse como «prospect»: el destinatario es un cliente potencial y
 * TODO el deck (colores, tipografías, logo, portada, fondos, gráficos y las maquetas de Studio,
 * Store, App y Yokup) se pinta con su marca usando la marca blanca de /marcablanca:
 *   - catálogo: una marca de marcablanca/clientes/<id>.json (Lumbre Café, BRUMELLE, Frescaria…);
 *   - nueva: nombre, logo (subido o URL), primario, secundario, acento y tipografía → marca.js
 *     → crearMarca() genera un cliente con el MISMO esquema que los del catálogo.
 * La marca se guarda con la presentación (presentation.prospect.cliente) ya normalizada, así que
 * el render no depende de que el catálogo siga igual. Sin prospect, el deck no cambia: Admira.
 */
import {normalizarMarca, crearMarca, variablesMarca, cssVariables, cssFuentes, marcaEn, modoDe, idMarca, urlSegura, paletaDesdeColores, TIPOGRAFIAS, esHex} from '../../marcablanca/marca.js';
import {pintar, urlDe, PLATAFORMAS} from '../../marcablanca/maquetas.js';
import {persistBrandLogo} from './_brand.js';
import {obtenerMarca, listarMarcas} from '../marcablanca/_catalogo.js';

export const PROSPECT_CATALOGO = ['lumbre', 'brumelle', 'frescaria', 'admira'];
export const PROSPECT_LOGO_MAX = 160 * 1024; // bytes del logo subido
export const PROSPECT_CSS_VERSION = '20261001-prospect';

function esc(value){return String(value==null?'':value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function clean(value,max){return String(value==null?'':value).replace(/\s+/g,' ').trim().slice(0,max)}

/**
 * Una marca del CATÁLOGO ÚNICO (functions/marcablanca/_catalogo.js): las semillas de
 * marcablanca/clientes/*.json y las guardadas en KV (analizadas por URL o creadas aquí).
 */
export async function catalogBrand(env,request,id){
  const marca=idMarca(id);
  if(!marca)return null;
  try{
    const json=await obtenerMarca(env,request,marca);
    if(!json||json.id!==marca)return null;
    const m=normalizarMarca(json);
    m.ejemplo=json.catalogo?.tipo==='ejemplo'||json.ejemplo===true;
    return m;
  }catch(_){return null}
}

export async function catalogIds(env,request){
  try{
    const lista=await listarMarcas(env,request);
    const ids=(lista.clientes||[]).map(item=>idMarca(item.id)).filter(Boolean);
    if(ids.length)return ids;
  }catch(_){}
  return PROSPECT_CATALOGO;
}

function parseRaw(raw){
  if(raw==null)return undefined;
  if(typeof raw==='string'){const text=raw.trim();if(!text)return null;try{return JSON.parse(text)}catch(_){throw new Error('El campo prospect no es JSON válido.')}}
  if(typeof raw!=='object')throw new Error('El campo prospect no es válido.');
  return raw;
}

function dataUrlBytes(dataUrl){
  const match=/^data:(image\/(?:png|jpeg|webp|gif|svg\+xml));base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl||''));
  if(!match)return null;
  const binary=atob(match[2]);if(binary.length>PROSPECT_LOGO_MAX)throw new Error('El logo del prospect supera 160 KB.');
  const bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i+=1)bytes[i]=binary.charCodeAt(i);
  return {bytes,contentType:match[1]};
}
const EXT={'image/svg+xml':'svg','image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/gif':'gif'};

async function storeUploadedLogo(env,slug,displayName,dataUrl){
  const file=dataUrlBytes(dataUrl);if(!file)throw new Error('El logo subido debe ser PNG, JPG, WebP, GIF o SVG.');
  if(!env?.PRESENTATION_MEDIA)return {inline:dataUrl};
  const key=`presentations/${slug}/brand/logo.${EXT[file.contentType]}`;
  await env.PRESENTATION_MEDIA.put(key,file.bytes,{httpMetadata:{contentType:file.contentType,cacheControl:'private, max-age=86400'},customMetadata:{client:slug,kind:'prospect-logo'}});
  return {brand:{logoKey:key,logoUrl:`/presentaciones/${slug}/brand/logo`,sourceUrl:'subida en el generador',website:'',contentType:file.contentType,alt:`Logo de ${displayName}`,capturedAt:new Date().toISOString(),prospect:true}};
}

const TIPOS_DESDE_WEB={serif:'serif',rounded:'redondeada',mono:'grotesca',grotesk:'grotesca'};

/**
 * Resuelve el prospect pedido en el alta.
 *  - raw undefined → se conserva el de la presentación existente (llamadas a la API sin el campo).
 *  - raw '' / {activo:false} → sin prospect.
 *  - {activo:true, marca:'<id del catálogo>'} o {activo:true, marca:'nueva', nueva:{…}}.
 * Devuelve {prospect, brand} — brand es el registro del logo (R2) cuando se ha guardado uno.
 */
export async function resolveProspect({env,request,raw,existing,slug,displayName,website='',inspiration=null}){
  const parsed=parseRaw(raw);
  if(parsed===undefined)return {prospect:existing?.prospect||null,brand:null,kept:true};
  if(!parsed||parsed.activo===false||parsed.activo==='false')return {prospect:null,brand:null};
  const marca=String(parsed.marca||'').toLowerCase();
  const now=new Date().toISOString();
  if(marca&&marca!=='nueva'){
    const ids=await catalogIds(env,request);
    if(!ids.includes(marca))throw new Error(`La marca «${marca}» no está en el catálogo de marca blanca.`);
    let cliente=await catalogBrand(env,request,marca);
    // Sin ASSETS (tests, previews locales) vale la copia que manda el generador, si es la misma marca.
    if(!cliente&&parsed.cliente&&idMarca(parsed.cliente.id)===marca)cliente=normalizarMarca(parsed.cliente);
    if(!cliente)throw new Error(`No se pudo leer la marca «${marca}» del catálogo de marca blanca.`);
    return {prospect:{activo:true,marca,origen:'catalogo',nombre:cliente.nombre,cliente,actualizadoEn:now},brand:null};
  }
  if(marca!=='nueva')throw new Error('Elige una marca para el prospect o «nueva marca».');
  const nueva=parsed.nueva&&typeof parsed.nueva==='object'?parsed.nueva:{};
  const nombre=clean(nueva.nombre,80)||displayName;
  let {primario,secundario,acento}=nueva;
  let tipografia=TIPOGRAFIAS[nueva.tipografia]?nueva.tipografia:'';
  if(!esHex(primario)&&inspiration){
    const sacada=paletaDesdeColores([inspiration.primary,inspiration.accent,...(inspiration.palette||[])].filter(Boolean));
    primario=sacada.primario;secundario=secundario||sacada.secundario;acento=acento||inspiration.accent||sacada.acento;
  }
  if(!tipografia&&inspiration?.fontStyle)tipografia=TIPOS_DESDE_WEB[inspiration.fontStyle]||'';
  if(!esHex(primario))throw new Error('La nueva marca necesita al menos el color primario (o una web de la que sacarlo).');
  let brand=null,logo={};
  const prospectWeb=urlSegura(nueva.web)||website||'';
  if(nueva.logoData){
    const stored=await storeUploadedLogo(env,slug,nombre,nueva.logoData);
    if(stored.brand){brand=stored.brand;logo={imagen:stored.brand.logoUrl}}else logo={imagen:stored.inline};
  }else if(urlSegura(nueva.logoUrl)&&/^https:/.test(nueva.logoUrl)){
    if(env?.PRESENTATION_MEDIA){
      brand={...await persistBrandLogo(env,{slug,displayName:nombre,website:prospectWeb||nueva.logoUrl,analysis:{logo:{type:'url',url:nueva.logoUrl}}}),prospect:true};
      logo={imagen:brand.logoUrl};
    }else logo={imagen:urlSegura(nueva.logoUrl)};
  }else if(inspiration?.logo&&env?.PRESENTATION_MEDIA){
    try{brand={...await persistBrandLogo(env,{slug,displayName:nombre,website:prospectWeb,analysis:inspiration}),prospect:true};logo={imagen:brand.logoUrl}}catch(_){}
  }
  const cliente=crearMarca({id:idMarca(parsed.id||nombre)||'prospect',nombre,logo:{...logo,alt:`Logo de ${nombre}`},primario,secundario,acento,tipografia:tipografia||'grotesca',modo:['claro','oscuro'].includes(nueva.modo)?nueva.modo:undefined,web:prospectWeb,sector:clean(nueva.sector,80)||'Prospect'});
  // Para el catálogo único: el logo de la presentación vive en /presentaciones/<slug>/brand (privado),
  // así que al catálogo va la fuente pública (la subida en data:, la URL https o el SVG de su web).
  const svgWeb=inspiration?.logo?.type==='svg'&&inspiration.logo.svg?'data:image/svg+xml;base64,'+btoa(unescape(encodeURIComponent(inspiration.logo.svg))):'';
  const logoCatalogo=nueva.logoData||(urlSegura(nueva.logoUrl)&&/^https:/.test(nueva.logoUrl)?nueva.logoUrl:'')||(inspiration?.logo?.type==='url'?urlSegura(inspiration.logo.url):'')||svgWeb||'';
  return {prospect:{activo:true,marca:cliente.id,origen:'nueva',nombre:cliente.nombre,cliente,actualizadoEn:now},brand,catalogo:{marca:{...cliente,logo:{...cliente.logo,imagen:logoCatalogo||undefined,svg:undefined},favicon:''},web:prospectWeb}};
}

/** Tema clásico del deck derivado de la marca (lo leen el render antiguo, imágenes y producción). */
export function prospectTheme(cliente,heroDevice='none'){
  const m=normalizarMarca(cliente),modo=modoDe(m),p=m.colores[modo];
  const titulos=m.tipografia.titulos.toLowerCase();
  const fontStyle=/fraunces|georgia|serif/.test(titulos)&&!/sans-serif/.test(titulos.split(',').pop())?'serif':/nunito|rounded/.test(titulos)?'rounded':'grotesk';
  const radius=Math.max(0,Math.min(32,parseInt(m.radios.md,10)||10));
  return {primary:p.primario.toLowerCase(),accent:p.acento.toLowerCase(),background:p.fondo.toLowerCase(),surface:p.superficie.toLowerCase(),text:p.texto.toLowerCase(),mode:modo==='oscuro'?'dark':'light',fontStyle,radius,radiusStyle:radius>=14?'rounded':radius<=2?'sharp':'soft',density:'balanced',layout:'editorial',profile:'structured',heroDevice,prospect:m.id};
}

/** Instrucciones de marca para los entregables que produce un tercero (PDF, PowerPoint, vídeo…). */
export function prospectSource(prospect){
  if(!prospect?.activo||!prospect.cliente)return '';
  const m=normalizarMarca(prospect.cliente),modo=modoDe(m),p=m.colores[modo];
  return `\nPROSPECT · MARCA DEL DESTINATARIO (marca blanca Galaxia Admira)\n`+
    `- Esta presentación se viste con la marca de ${m.nombre}: TODOS los elementos (portada, fondos, tipografías, gráficos, iconos y maquetas de Studio, Store, App y Yokup) usan su identidad.\n`+
    `- Modo ${modo}. Primario ${p.primario} (texto ${p.primarioTexto}) · secundario ${p.secundario} · acento ${p.acento} · fondo ${p.fondo} · superficie ${p.superficie} · texto ${p.texto}.\n`+
    `- Tipografía de títulos: ${m.tipografia.titulos} (peso ${m.tipografia.pesoTitulos}${m.tipografia.transformTitulos!=='none'?`, ${m.tipografia.transformTitulos}`:''}). Texto: ${m.tipografia.texto}. Radios: ${m.radios.sm} / ${m.radios.md} / ${m.radios.lg}.\n`+
    `- Logo del prospect: ${m.logo.svg||m.logo.imagen||'no facilitado (usar el nombre en la tipografía de títulos)'}. Tono: ${m.tono.voz}\n`+
    `- AdmiraNeXT firma de forma discreta («${m.nombre} × ADmiraNeXT»); la marca protagonista es la del prospect.\n`+
    `- JSON de marca (mismo esquema que marcablanca/clientes): /marcablanca/clientes/esquema.json.\n`;
}

/* ── Render ─────────────────────────────────────────────────────────────── */
let logoCounter=0;
/** SVG de nuestro propio catálogo: se incrusta (currentColor) con ids únicos y sin nada ejecutable. */
function sanitizeOwnSvg(text){
  let svg=String(text||'');
  const start=svg.indexOf('<svg');if(start<0)return '';
  svg=svg.slice(start).replace(/<script[\s\S]*?<\/script>/gi,'').replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi,'').replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*')/gi,'').replace(/javascript:/gi,'');
  const suffix=`-p${++logoCounter}`;
  const ids=[...svg.matchAll(/\sid="([^"]+)"/g)].map(match=>match[1]);
  for(const id of ids){svg=svg.split(`id="${id}"`).join(`id="${id}${suffix}"`).split(`#${id})`).join(`#${id}${suffix})`).split(`"#${id}"`).join(`"#${id}${suffix}"`)}
  return svg.replace('<svg',`<svg class="mb-logo-svg" role="img"`);
}

async function loadLogoSvg(env,request,url){
  if(!/^\/marcablanca\/logos\/[a-z0-9-]+\.svg$/.test(url)||!env?.ASSETS)return '';
  try{const response=await env.ASSETS.fetch(new URL(url,request?.url||'https://www.admiranext.com/'));return response.ok?await response.text():''}catch(_){return ''}
}

/**
 * Prepara la marca para pintar un deck. `override` (?marca=<id> en la URL) permite ver la MISMA
 * presentación con otra marca del catálogo (demo y revisión); ?marca=admira la devuelve a Admira.
 */
export async function resolveRenderBrand({env,request,config,override}){
  let m=null;
  const pedido=override?String(override).toLowerCase():'';
  if(pedido==='admira'||pedido==='ninguna')return null;
  // ?marca=<id>: cualquier marca del catálogo único (semillas o guardadas). Sin ?marca no se lee nada.
  if(pedido&&idMarca(pedido)===pedido)m=await catalogBrand(env,request,pedido);
  if(!m&&config?.prospect?.activo&&config.prospect.cliente)m=normalizarMarca(config.prospect.cliente);
  if(!m)return null;
  const svgText=m.logo.svg?await loadLogoSvg(env,request,m.logo.svg):'';
  const svgFor=(plataforma)=>{
    const mp=marcaEn(m,plataforma);
    return mp.logo?.svg===m.logo.svg?svgText:'';
  };
  const logoHtml=(plataforma)=>{
    const mp=plataforma?marcaEn(m,plataforma):m;
    const own=plataforma?svgFor(plataforma):svgText;
    if(own){const svg=sanitizeOwnSvg(own);if(svg)return svg.replace('role="img"',`role="img" aria-label="${esc(mp.logo.alt||mp.nombre)}"`)}
    if(mp.logo?.imagen)return `<img class="mb-logo-img" src="${esc(mp.logo.imagen)}" alt="${esc(mp.logo.alt||mp.nombre)}">`;
    return `<b class="mb-logo-texto">${esc(mp.nombre)}</b>`;
  };
  return {m,id:m.id,modo:modoDe(m),logoHtml,override:Boolean(pedido&&m&&pedido===m.id)};
}

const PLAT_NOMBRE={studio:['admira.studio','crea'],store:['admira.store','distribuye'],tv:['admira.tv','emite'],app:['admira.biz','comercializa'],yokup:['admira.app','mantiene']};

/** Una maqueta completa (barra de navegador + pantalla) vestida con la marca en esa plataforma. */
export function maquetaHtml(brand,plataforma){
  const mp=marcaEn(brand.m,plataforma),modo=modoDe(mp);
  const vars=cssVariables(variablesMarca(mp,modo));
  const [nombre,verbo]=PLAT_NOMBRE[plataforma];
  return `<div class="mk pm-mk" data-plataforma="${plataforma}"><div class="mk-chrome"><i class="d"></i><i class="d"></i><i class="d"></i><span class="mk-url">${esc(urlDe(plataforma,brand.id))}</span><span class="mk-tag">${nombre} <i>${verbo}</i></span></div><div class="mk-scope" data-mb-marca="${esc(brand.id)}" data-mb-plataforma="${plataforma}" data-mb-modo="${modo}" style="${esc(vars)};color-scheme:${modo==='oscuro'?'dark':'light'}">${pintar(plataforma,mp,{logo:brand.logoHtml(plataforma)})}</div></div>`;
}

/** Qué plataforma de la Galaxia ilustra un bloque del guion (o '' si ninguna). */
export function plataformaDeBloque(item={}){
  const product=String(item.product||'').toLowerCase();
  if(/admira\.tv|\btv\b/.test(product))return 'tv';
  if(/admira\.biz/.test(product)&&/comercializa|sells|ingresos|dooh|retail media/.test(product))return 'app';
  if(/admira\.app/.test(product)&&/mantiene|maintenance|instalacion/.test(product))return 'yokup';
  if(/studio/.test(product))return 'studio';if(/store/.test(product))return 'store';if(/admira\.app|\bapp\b/.test(product))return 'app';if(/yokup/.test(product))return 'yokup';
  // Un producto explícito que no es ninguna de las cuatro (p. ej. «Contexto» o «Primer piloto» en la
  // propuesta automática) no lleva maqueta: no se adivina por el texto (FLT-101369).
  if(product)return '';
  const id=String(item.id||'').toLowerCase();
  if(id==='crear')return 'studio';if(id==='activar')return 'store';if(id==='medir')return 'app';
  const text=`${item.title||''} ${item.message||''} ${item.detail||''}`.toLowerCase();
  if(/yokup|incidencias?\b|mantenimiento/.test(text))return 'yokup';
  if(/admira\.studio|pixeria/.test(text))return 'studio';if(/admira\.store|xpaceos/.test(text))return 'store';if(/admira\.app|omnipublicity/.test(text))return 'app';
  return '';
}

const GALAXIA={
  es:{eyebrow:'Galaxia Admira · con tu marca',title:name=>`Así se ve ${name} en studio, store, tv, app y biz.`,detail:'studio crea · store distribuye · tv emite · app mantiene · biz comercializa. Las cinco patas, con la identidad de tu marca.'},
  ca:{eyebrow:'Galàxia Admira · amb la teva marca',title:name=>`Així es veu ${name} a studio, store, tv, app i biz.`,detail:'studio crea · store distribueix · tv emet · app manté · biz comercialitza. Les cinc potes, amb la identitat de la teva marca.'},
  en:{eyebrow:'Admira Galaxy · with your brand',title:name=>`This is ${name} on studio, store, tv, app and biz.`,detail:'studio creates · store distributes · tv broadcasts · app maintains · biz sells. All five pillars, in your brand identity.'}
};
function i18nAttrs(key,name){return ['es','ca','en'].map(language=>{const value=GALAXIA[language][key];return ` data-pg-${language}="${esc(typeof value==='function'?value(name):value)}"`}).join('')}

/** Lámina «Galaxia»: las cuatro maquetas con la marca del prospect, antes del cierre. */
export function galaxiaSlide(brand,language='es'){
  const name=brand.m.nombreCorto||brand.m.nombre,copy=GALAXIA[language]||GALAXIA.es;
  return `<section class="slide prospect-galaxia" data-slide-key="galaxia-prospect" data-segment="proposal" data-section="proposal"><div class="inner"><span class="eyebrow" data-pg-i18n${i18nAttrs('eyebrow',name)}>${esc(copy.eyebrow)}</span><h2 data-pg-i18n${i18nAttrs('title',name)}>${esc(copy.title(name))}</h2><p class="detail" data-pg-i18n${i18nAttrs('detail',name)}>${esc(copy.detail)}</p><div class="pg-grid">${PLATAFORMAS.map(p=>maquetaHtml(brand,p.id)).join('')}</div></div></section>`;
}

/** Firma de portada: logo del prospect × ADmiraNeXT. */
export function coverLockup(brand){
  return `<div class="pc-lockup"><span class="mb-logo pc-logo">${brand.logoHtml()}</span><span class="pc-x" aria-hidden="true">×</span><span class="pc-admira">ADmiraNeXT</span></div>`;
}

/** <link>/<style> de la marca: va DESPUÉS de los estilos del deck para mandar sobre GOOD, BETTER y BEST. */
export function prospectHead(brand){
  const m=brand.m,modo=brand.modo;
  const vars=cssVariables(variablesMarca(m,modo));
  const md=parseInt(m.radios.md,10)||10;
  const css=`${cssFuentes(m)}
:root{${vars}}
html[data-prospect]{--primary:var(--mb-primario)!important;--accent:var(--mb-acento)!important;--bg:var(--mb-fondo)!important;--surface:var(--mb-superficie)!important;--ink:var(--mb-texto)!important;--sans:var(--mb-fuente-texto)!important;--mono:var(--mb-fuente-etiquetas)!important;--radius:${md}px!important;--shape:var(--mb-radio-lg)!important;color-scheme:${modo==='oscuro'?'dark':'light'}}
html[data-prospect] body{background:var(--mb-fondo)!important;color:var(--mb-texto)!important;font-family:var(--mb-fuente-texto)!important}
html[data-prospect] .slide:not(.deck-slide){background:radial-gradient(70% 60% at 100% 0%,color-mix(in srgb,var(--mb-acento) 16%,transparent),transparent 62%),linear-gradient(160deg,var(--mb-fondo),var(--mb-fondo-alt))!important;color:var(--mb-texto)!important}
html[data-prospect] .slide:not(.deck-slide):nth-of-type(even){background:radial-gradient(70% 60% at 0% 100%,color-mix(in srgb,var(--mb-secundario) 14%,transparent),transparent 62%),linear-gradient(200deg,var(--mb-fondo),var(--mb-fondo-alt))!important}
html[data-prospect] .slide:not(.deck-slide):after{border-color:color-mix(in srgb,var(--mb-acento) 24%,transparent)!important;border-radius:var(--mb-radio-lg)!important}
html[data-prospect] .slide h1,html[data-prospect] .slide h2,html[data-prospect] .close strong{font-family:var(--mb-fuente-titulos)!important;font-weight:var(--mb-peso-titulos)!important;text-transform:var(--mb-titulos-transform);letter-spacing:var(--mb-titulos-tracking)!important;color:inherit}
html[data-prospect] .slide .num,html[data-prospect] .slide .eyebrow{color:var(--mb-primario)!important;font-family:var(--mb-fuente-etiquetas)!important}
html[data-prospect] .slide .message{color:var(--mb-texto)!important;font-family:var(--mb-fuente-texto)}
html[data-prospect] .slide .detail,html[data-prospect] .close span{color:var(--mb-texto-suave)!important}
html[data-prospect] .slide:not(.deck-slide):is(.cover,[data-slide-key="closing"]):nth-of-type(n){background:radial-gradient(80% 70% at 88% 8%,color-mix(in srgb,var(--mb-acento) 42%,transparent),transparent 60%),linear-gradient(150deg,var(--mb-primario),color-mix(in srgb,var(--mb-primario) 84%,var(--mb-primario-texto)))!important;color:var(--mb-primario-texto)!important}
html[data-prospect] .slide.cover .eyebrow,html[data-prospect] .slide.cover .detail,html[data-prospect] .slide[data-slide-key="closing"] .eyebrow,html[data-prospect] .slide[data-slide-key="closing"] .close span{color:color-mix(in srgb,var(--mb-primario-texto) 82%,transparent)!important}
html[data-prospect] .slide.cover:after,html[data-prospect] .slide[data-slide-key="closing"]:after{border-color:color-mix(in srgb,var(--mb-primario-texto) 14%,transparent)!important}
html[data-prospect] .slide[data-has-image="true"]:before{background-image:linear-gradient(105deg,color-mix(in srgb,var(--mb-fondo) 92%,transparent) 0%,color-mix(in srgb,var(--mb-fondo) 72%,transparent) 52%,color-mix(in srgb,var(--mb-primario) 34%,transparent) 100%),var(--slide-image)!important;filter:saturate(.9)!important}
html[data-prospect] .slide.cover[data-has-image="true"]:before,html[data-prospect] .slide[data-slide-key="closing"][data-has-image="true"]:before{background-image:linear-gradient(105deg,color-mix(in srgb,var(--mb-primario) 94%,transparent) 0%,color-mix(in srgb,var(--mb-primario) 74%,transparent) 55%,color-mix(in srgb,var(--mb-primario) 40%,transparent) 100%),var(--slide-image)!important}
html[data-prospect][data-quality="best"] .slide:not(.deck-slide)[data-has-image="true"] .inner,html[data-prospect][data-quality="best"] .slide:not(.deck-slide)[data-has-video="true"] .inner{background:color-mix(in srgb,var(--mb-superficie) 88%,transparent)!important;border-color:var(--mb-borde)!important;color:var(--mb-texto)!important;border-radius:var(--mb-radio-lg)!important;box-shadow:var(--mb-sombra-lg)!important}
html[data-prospect][data-quality="best"] .slide:not(.deck-slide)[data-has-image="true"] .message{color:var(--mb-texto)!important}
html[data-prospect][data-quality="best"] .slide:not(.deck-slide)[data-has-image="true"] .detail,html[data-prospect][data-quality="best"] .slide:not(.deck-slide)[data-has-image="true"] #coverSummary{color:var(--mb-texto-suave)!important}
html[data-prospect][data-quality="best"] .best-figure img,html[data-prospect][data-quality="best"] .best-figure video{border-radius:var(--mb-radio-lg)!important;border-color:var(--mb-borde)!important;box-shadow:var(--mb-sombra-lg)!important}
html[data-prospect] .deck-kicker{color:var(--mb-acento)!important;font-family:var(--mb-fuente-etiquetas)!important}
html[data-prospect] .deck-copy h2{font-family:var(--mb-fuente-titulos)!important;text-transform:var(--mb-titulos-transform)}
html[data-prospect] .deck-progress{border-radius:var(--mb-radio-pill)!important;border-color:var(--mb-borde)!important}
html[data-prospect] .languages,html[data-prospect] .section-nav,html[data-prospect] .nav{font-family:var(--mb-fuente-etiquetas)!important}
html[data-prospect] .languages button,html[data-prospect] .section-nav button{border-radius:var(--mb-radio-boton)!important}
html[data-prospect] .languages button[aria-pressed="true"],html[data-prospect] .section-nav button[aria-pressed="true"]{background:var(--mb-primario)!important;color:var(--mb-primario-texto)!important;border-color:var(--mb-primario)!important}
html[data-prospect] .brand-mark{background:var(--mb-superficie)!important;border-color:var(--mb-borde)!important;color:var(--mb-texto);border-radius:var(--mb-radio-sm)!important;width:auto!important;min-width:44px;padding:0 6px}
html[data-prospect] .brand-mark svg,html[data-prospect] .brand-mark img{height:22px!important;width:auto!important;max-width:120px!important;filter:none!important}
html[data-prospect] .slide-footer{font-family:var(--mb-fuente-etiquetas)!important;color:var(--mb-texto-tenue)!important}
.pc-lockup{display:flex;align-items:center;gap:16px;margin:0 0 34px;color:var(--mb-primario-texto)}
.pc-logo{height:clamp(40px,6vh,64px);color:var(--mb-primario-texto)}.pc-logo svg,.pc-logo img{height:100%;width:auto;max-width:320px;display:block;object-fit:contain}
.pc-logo .mb-logo-texto{font:var(--mb-peso-titulos) clamp(28px,4vh,44px)/1 var(--mb-fuente-titulos);text-transform:var(--mb-titulos-transform)}
.pc-x{font:300 28px/1 var(--mb-fuente-texto);opacity:.6}.pc-admira{font:800 12px/1 var(--mb-fuente-etiquetas);letter-spacing:.2em;text-transform:uppercase;opacity:.8}
html[data-prospect] .slide[data-mb-maqueta]{grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr)!important;gap:clamp(20px,4vw,64px)!important;place-items:center stretch!important;display:grid!important}
html[data-prospect] .slide[data-mb-maqueta] .inner{width:auto!important;max-width:none!important;order:1}
html[data-prospect] .slide[data-mb-maqueta] .best-figure{display:none!important}
html[data-prospect] .slide[data-mb-maqueta] h2{font-size:clamp(34px,4.6vw,72px)!important;line-height:1.02}
html[data-prospect] .slide[data-mb-maqueta] .message{font-size:clamp(18px,2vw,28px)!important}
.pm-figura{order:2;position:relative;z-index:2;margin:0;width:100%}
.pm-figura .mk,.pg-grid .mk{background:var(--mb-superficie);border-color:color-mix(in srgb,var(--mb-texto) 18%,transparent);box-shadow:var(--mb-sombra-lg),0 30px 80px rgba(0,0,0,.18);border-radius:calc(var(--mb-radio-md) + 4px)}
.pm-figura .mk-chrome,.pg-grid .mk-chrome{background:color-mix(in srgb,var(--mb-texto) 10%,var(--mb-fondo));border-color:color-mix(in srgb,var(--mb-texto) 14%,transparent);color:var(--mb-texto-suave)}
.pm-figura .mk-url,.pg-grid .mk-url{background:color-mix(in srgb,var(--mb-fondo) 70%,transparent);color:var(--mb-texto-suave)}
.pm-figura .mk-tag,.pg-grid .mk-tag{color:var(--mb-primario)}.pm-figura .mk-tag i,.pg-grid .mk-tag i{color:var(--mb-texto-tenue)}
.pm-figura .mk-scope{height:520px}
.prospect-galaxia .inner{width:min(1560px,100%)!important}
.prospect-galaxia h2{font-size:clamp(28px,3.4vw,52px)!important;max-width:none!important}
.prospect-galaxia .detail{margin-top:12px!important;max-width:none!important}
.pg-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:18px}
.prospect-galaxia{padding:5vh 5vw!important}
.pg-grid .mk{zoom:.5}
@media(max-height:820px){.pg-grid .mk{zoom:.4}}
@media(min-height:1000px) and (min-width:1700px){.pg-grid .mk{zoom:.6}}
@media(max-width:900px){html[data-prospect] .slide[data-mb-maqueta]{grid-template-columns:1fr!important}.pg-grid{grid-template-columns:1fr}.pg-grid .mk{zoom:.5}}
@media print{.pg-grid .mk{zoom:.5}.pm-figura .mk{zoom:.8}}`;
  return `<link rel="stylesheet" href="/marcablanca/marcablanca.css?v=${PROSPECT_CSS_VERSION}"><link rel="stylesheet" href="/marcablanca/maquetas.css?v=${PROSPECT_CSS_VERSION}"><style data-prospect-css>${css}</style>`;
}

/** Cambia los textos de la lámina Galaxia cuando el deck cambia de idioma. */
export const PROSPECT_LANGUAGE_SCRIPT=`<script>(function(){function idioma(){var l=document.documentElement.lang||'es';document.querySelectorAll('[data-pg-i18n]').forEach(function(n){var v=n.getAttribute('data-pg-'+l)||n.getAttribute('data-pg-es');if(v)n.textContent=v})}new MutationObserver(idioma).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});idioma()})()</script>`;

/** Resumen público (catálogo de clientes del generador): sin el JSON completo. */
export function publicProspect(prospect){
  if(!prospect?.activo)return null;
  return {activo:true,marca:prospect.marca||'',origen:prospect.origen||'',nombre:prospect.nombre||prospect.cliente?.nombre||''};
}
