const MAX_HTML_BYTES = 900 * 1024;
const MAX_CSS_BYTES = 220 * 1024;
const MAX_STYLESHEETS = 3;

function clean(value, max = 180){
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, max);
}

function decodeEntities(value){
  const named={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '};
  return String(value||'').replace(/&(#x?[0-9a-f]+|[a-z]+);/gi,(_,entity)=>{
    if(entity[0]==='#'){
      const hex=entity[1]?.toLowerCase()==='x';
      const code=Number.parseInt(entity.slice(hex?2:1),hex?16:10);
      return Number.isFinite(code)&&code>0&&code<=0x10ffff?String.fromCodePoint(code):' ';
    }
    return named[entity.toLowerCase()]||' ';
  });
}

export function extractReadableText(html){
  const source=String(html||'')
    .replace(/<!--[^]*?-->/g,' ')
    .replace(/<(script|style|noscript|svg|template)\b[^>]*>[^]*?<\/\1>/gi,' ')
    .replace(/<(nav|footer|form)\b[^>]*>[^]*?<\/\1>/gi,' ')
    .replace(/<[^>]+>/g,' ');
  return clean(decodeEntities(source),5000);
}

function attribute(tag, name){
  const match=String(tag||'').match(new RegExp(`\\s${name}\\s*=\\s*(?:["']([^"']*)["']|([^\\s>]+))`,'i'));
  return clean(match?.[1]||match?.[2],2000);
}

function absoluteHttps(value, base){
  try{const url=new URL(String(value||''),base);return url.protocol==='https:'?url.toString():'';}catch(_){return '';}
}

export function sanitizeSvg(value){
  let svg=String(value||'').trim();
  if(!/^<svg\b/i.test(svg)||!/<\/svg>\s*$/i.test(svg)||svg.length>120*1024)return '';
  svg=svg.replace(/<script\b[\s\S]*?<\/script>/gi,'').replace(/<foreignObject\b[\s\S]*?<\/foreignObject>/gi,'').replace(/\s(?:on\w+|href|xlink:href)\s*=\s*(?:"[^"]*"|'[^']*')/gi,'');
  if(!/\sxmlns=/.test(svg))svg=svg.replace(/^<svg\b/i,'<svg xmlns="http://www.w3.org/2000/svg"');
  return svg;
}

function extractLogo(html,base){
  const candidates=[];
  for(const match of html.matchAll(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi)){
    const svg=sanitizeSvg(match[0]);if(!svg)continue;
    const opening=svg.slice(0,Math.min(svg.indexOf('>')+1,1500));
    const nearby=html.slice(Math.max(0,match.index-220),match.index+Math.min(match[0].length,1400));
    const signal=`${opening} ${nearby}`;
    let score=(/logo/i.test(signal)?90:0)+(/brand|wordmark|identity/i.test(signal)?28:0)+(/href=["']\/?["']/i.test(nearby)?12:0)+(/viewBox/i.test(opening)?4:0);
    if(/cookie|social|icon/i.test(signal))score-=55;
    candidates.push({score,type:'svg',svg,sourceUrl:String(base),alt:'Logo oficial'});
  }
  for(const match of html.matchAll(/<img\b[^>]*>/gi)){
    const tag=match[0],src=attribute(tag,'src')||attribute(tag,'data-src')||attribute(tag,'data-lazy-src');
    const url=absoluteHttps(src,base);if(!url)continue;
    const signal=[attribute(tag,'alt'),attribute(tag,'class'),attribute(tag,'id'),src].join(' ');
    let score=(/logo|wordmark/i.test(signal)?78:0)+(/brand|identity/i.test(signal)?24:0)+(/header|nav/i.test(signal)?10:0);
    if(/cookie|store|payment|partner|social|footer|app/i.test(signal))score-=48;
    if(score>0)candidates.push({score,type:'url',url,sourceUrl:url,alt:attribute(tag,'alt')||'Logo oficial'});
  }
  for(const match of html.matchAll(/<link\b[^>]*>/gi)){
    const tag=match[0],rel=attribute(tag,'rel');if(!/(?:^|\s)(?:icon|shortcut icon|apple-touch-icon)(?:\s|$)/i.test(rel))continue;
    const url=absoluteHttps(attribute(tag,'href'),base);if(url)candidates.push({score:/apple-touch-icon/i.test(rel)?18:10,type:'url',url,sourceUrl:url,alt:'Icono oficial'});
  }
  return candidates.sort((a,b)=>b.score-a.score)[0]||null;
}

/*
 * DEFENSAS SSRF (SubMorfeoMacMini, 01-10-2026 · FLT-101330 b). El analizador lo usan el
 * generador (privado) y, desde hoy, la página pública /marcablanca (POST /marcablanca/api/analizar),
 * así que todo lo que se descarga pasa por aquí:
 *   - solo https, puerto 443, sin usuario ni contraseña en la URL;
 *   - nunca una IP literal (v4 ni v6, en ninguna de sus formas: el parser WHATWG ya convierte
 *     0x7f.1 o 2130706433 en 127.0.0.1): una web de marca siempre tiene dominio;
 *   - nunca un nombre local o de metadatos: localhost, *.localhost, *.local, *.internal,
 *     *.home.arpa, *.lan, nombres de una sola etiqueta (metadata, instance-data…);
 *   - el dominio se resuelve por DNS sobre HTTPS y se rechaza si apunta a una red privada,
 *     de enlace local, CGNAT, multicast o reservada (defensa ante nombres «trampa» y
 *     rebinding: Workers ya no alcanza redes privadas, esto es la segunda puerta);
 *   - las redirecciones se siguen A MANO (máx. 4) y cada salto vuelve a pasar todo lo anterior;
 *   - un único plazo total para la cadena entera y un tope de bytes por respuesta.
 */
const NOMBRES_LOCALES = /(^|\.)(localhost|local|internal|intranet|home\.arpa|lan|corp|localdomain)$/;
export const MAX_REDIRECCIONES = 4;

function ipv4Privada(ip){
  const p = ip.split('.').map(Number);
  if (p.length !== 4 || p.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = p;
  return a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) || (a === 192 && b === 0 && (p[2] === 0 || p[2] === 2)) ||
    (a === 198 && (b === 18 || b === 19)) || (a === 198 && b === 51 && p[2] === 100) || (a === 203 && b === 0 && p[2] === 113);
}
function ipv6Privada(ip){
  const s = String(ip).toLowerCase();
  if (s === '::' || s === '::1') return true;
  const v4 = s.match(/(?:::ffff:|^::|^64:ff9b::)(\d+\.\d+\.\d+\.\d+)$/);
  if (v4) return ipv4Privada(v4[1]);
  if (/^::ffff:/.test(s) || /^64:ff9b:/.test(s)) return true;
  return /^(f[cd]|fe[89ab]|ff|2001:db8|2001:0?:|100::)/.test(s);
}
/** true si una IP (v4 o v6) no es pública. Exportada para las pruebas. */
export function ipPrivada(ip){ return String(ip).includes(':') ? ipv6Privada(ip) : ipv4Privada(String(ip)); }

export function assertPublicHttps(value){
  let url;
  try { url = new URL(String(value || '')); }
  catch (_) { throw new Error('La URL inspiradora no es válida.'); }
  if (url.protocol !== 'https:') throw new Error('La web inspiradora debe comenzar por https://');
  if (url.username || url.password || (url.port && url.port !== '443')) throw new Error('La URL inspiradora no está permitida.');
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (!host || NOMBRES_LOCALES.test(host)) throw new Error('La URL inspiradora no puede ser local.');
  if (host.includes(':') || /^[\d.]+$/.test(host)) throw new Error('La URL inspiradora no puede apuntar a una red privada ni a una IP: usa el dominio de la web.');
  if (!host.includes('.')) throw new Error('La URL inspiradora no puede ser local.');
  return url;
}

/** Resuelve A y AAAA por DNS sobre HTTPS (Cloudflare). Devuelve [] si el resolutor no contesta. */
export async function resolverDoh(host, {fetchImpl = fetch, timeoutMs = 3000} = {}){
  const tipos = ['A', 'AAAA'];
  const respuestas = await Promise.all(tipos.map(async tipo => {
    try {
      const r = await fetchImpl(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=${tipo}`, {headers:{accept:'application/dns-json'}, signal:AbortSignal.timeout(timeoutMs)});
      if (!r.ok) return [];
      const body = await r.json();
      return (body.Answer || []).filter(a => a.type === 1 || a.type === 28).map(a => String(a.data));
    } catch (_) { return []; }
  }));
  return respuestas.flat();
}

async function comprobarDns(host, resolver){
  if (!resolver) return;
  const ips = await resolver(host);
  // Si el resolutor no contesta se sigue (el runtime de Workers no enruta a redes privadas);
  // si contesta con CUALQUIER dirección no pública, se corta.
  if ((ips || []).some(ipPrivada)) throw new Error('La URL inspiradora apunta a una red privada.');
}

/**
 * fetch() endurecido: valida la URL, resuelve el dominio, sigue las redirecciones a mano
 * revalidando cada salto y aplica un plazo total. Devuelve {response, url} (url = la final).
 */
export async function fetchPublico(value, {accept = 'text/html,application/xhtml+xml', timeoutMs = 8000, maxRedirecciones = MAX_REDIRECCIONES, resolver, fetchImpl = fetch, userAgent = 'ADmiraNeXT Inspiration Analyzer/1.0'} = {}){
  const resolve = resolver === undefined ? (host => resolverDoh(host, {fetchImpl})) : resolver;
  const signal = AbortSignal.timeout(timeoutMs);
  let actual = assertPublicHttps(value);
  for (let salto = 0; ; salto += 1) {
    await comprobarDns(actual.hostname, resolve);
    const response = await fetchImpl(actual.toString(), {headers:{accept, 'user-agent':userAgent}, redirect:'manual', signal});
    if (![301, 302, 303, 307, 308].includes(response.status)) return {response, url:actual};
    try { await response.body?.cancel(); } catch (_) {}
    const destino = response.headers.get('location');
    if (!destino) throw new Error('La web redirige sin destino.');
    if (salto >= maxRedirecciones) throw new Error('La web redirige demasiadas veces.');
    let siguiente;
    try { siguiente = new URL(destino, actual); } catch (_) { throw new Error('La web redirige a una URL no válida.'); }
    actual = assertPublicHttps(siguiente.toString());
  }
}

/** Páginas de reto antibots (Cloudflare, Akamai, Incapsula, DataDome…): no son la web de la marca. */
export function esMuroAntibots(response, html){
  if (response?.headers?.get?.('cf-mitigated') === 'challenge') return true;
  const titulo = String(html || '').match(/<title[^>]*>([\s\S]{0,200}?)<\/title>/i)?.[1] || '';
  return /just a moment|attention required|access denied|acceso denegado|are you a (human|robot)|robot check|captcha|pardon our interruption|request unsuccessful|verifying you are human|security check/i.test(titulo) ||
    /<form[^>]+id=["']challenge-form|cf-browser-verification|_Incapsula_Resource|geo\.captcha-delivery\.com|px-captcha/i.test(String(html || '').slice(0, 20000));
}

/** Lee como mucho `maximum` bytes del cuerpo (lo comparten el análisis de marca y el estudio de la compañía). */
export async function limitedText(response, maximum){
  if(!response.body){const buffer=await response.arrayBuffer();return new TextDecoder().decode(buffer.slice(0,maximum));}
  const reader=response.body.getReader(),decoder=new TextDecoder();let total=0,out='';
  while(true){
    const {done,value}=await reader.read();if(done)break;
    const remaining=maximum-total;if(remaining<=0){await reader.cancel();break;}
    const chunk=value.byteLength>remaining?value.slice(0,remaining):value;
    out+=decoder.decode(chunk,{stream:true});total+=chunk.byteLength;
    if(value.byteLength>remaining||total>=maximum){await reader.cancel();break;}
  }
  return out+decoder.decode();
}

function normalizeHex(value){
  let hex = String(value || '').replace('#', '').toLowerCase();
  if (hex.length === 3 || hex.length === 4) hex = hex.split('').map(char => char + char).join('');
  if (hex.length === 8) {
    if (parseInt(hex.slice(6), 16) < 80) return '';
    hex = hex.slice(0, 6);
  }
  return /^[0-9a-f]{6}$/.test(hex) ? `#${hex}` : '';
}

function rgbToHex(red, green, blue, alpha = 1){
  if (Number(alpha) < .32) return '';
  const values = [red, green, blue].map(value => Math.max(0, Math.min(255, Math.round(Number(value)))));
  return `#${values.map(value => value.toString(16).padStart(2, '0')).join('')}`;
}

function rgb(hex){ return [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16)); }
function luminance(hex){
  const channels = rgb(hex).map(value => { const normalized = value / 255; return normalized <= .03928 ? normalized / 12.92 : ((normalized + .055) / 1.055) ** 2.4; });
  return .2126 * channels[0] + .7152 * channels[1] + .0722 * channels[2];
}
function saturation(hex){
  const values = rgb(hex).map(value => value / 255); const max = Math.max(...values), min = Math.min(...values);
  if (max === min) return 0;
  const light = (max + min) / 2;
  return (max - min) / (1 - Math.abs(2 * light - 1));
}
function distance(first, second){ return rgb(first).reduce((sum, value, index) => sum + Math.abs(value - rgb(second)[index]), 0); }

function collectColors(source){
  const scores = new Map();
  const add = (value, weight = 1) => {
    const color = normalizeHex(value); if (!color) return;
    scores.set(color, (scores.get(color) || 0) + weight);
  };
  for (const match of source.matchAll(/#[0-9a-f]{3,8}\b/gi)) add(match[0]);
  for (const match of source.matchAll(/rgba?\(\s*(\d{1,3})[^\d]+(\d{1,3})[^\d]+(\d{1,3})(?:[^\d.]+([\d.]+))?\s*\)/gi)) add(rgbToHex(match[1], match[2], match[3], match[4] || 1));
  for (const match of source.matchAll(/(?:--[\w-]*(?:brand|primary|accent|highlight|main)|(?:background(?:-color)?|color))\s*:\s*(#[0-9a-f]{3,8})/gi)) add(match[1], /brand|primary|accent|highlight|main/i.test(match[0]) ? 10 : 5);
  return [...scores.entries()].sort((a, b) => b[1] - a[1]);
}

function chooseColors(source, colors){
  const bodyBackground = [...source.matchAll(/(?:body|html|:root)[^{]{0,30}\{[^}]{0,900}?background(?:-color)?\s*:\s*(#[0-9a-f]{3,8})/gi)]
    .map(match => normalizeHex(match[1])).filter(Boolean);
  const neutral = colors.filter(([color]) => saturation(color) < .18);
  const vivid = colors.filter(([color]) => saturation(color) >= .18 && luminance(color) > .025 && luminance(color) < .92);
  const background = bodyBackground[0] || neutral[0]?.[0] || (colors.some(([color]) => luminance(color) < .08) ? '#080b12' : '#f5f6f8');
  const mode = luminance(background) < .34 ? 'dark' : 'light';
  const surface = neutral.find(([color]) => mode === 'dark' ? luminance(color) > luminance(background) + .012 && luminance(color) < .22 : luminance(color) < .99 && luminance(color) > .65)?.[0] || (mode === 'dark' ? '#111827' : '#ffffff');
  const accent = vivid[0]?.[0] || (mode === 'dark' ? '#3df08a' : '#ffb000');
  const secondary = vivid.find(([color, score]) => color !== accent && score >= (vivid[0]?.[1] || 1) * .55 && distance(color, accent) > 110)?.[0];
  const primary = secondary || (mode === 'dark' ? surface : accent);
  const text = mode === 'dark' ? '#f5f7fb' : '#142238';
  return {primary, accent, background, surface, text, mode, palette:[...new Set([primary, accent, background, surface, ...colors.slice(0, 5).map(item => item[0])])].slice(0, 7)};
}

function visualTraits(source){
  const fontMatches = [...source.matchAll(/font-family\s*:\s*([^;}]+)/gi)].map(match => clean(match[1], 120));
  const fontCounts = new Map(); fontMatches.forEach(font => fontCounts.set(font, (fontCounts.get(font) || 0) + 1));
  const sourceFont = [...fontCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '';
  const font = sourceFont.toLowerCase();
  const fontStyle = /mono|code|courier/.test(font) ? 'mono' : /serif|times|georgia|garamond|didot|bodoni/.test(font) && !/sans-serif/.test(font) ? 'serif' : /rounded|nunito|quicksand|poppins/.test(font) ? 'rounded' : 'grotesk';
  const radii = [...source.matchAll(/border-radius\s*:\s*([\d.]+)(px|rem)/gi)].map(match => Number(match[1]) * (match[2].toLowerCase() === 'rem' ? 16 : 1)).filter(Number.isFinite).sort((a, b) => a - b);
  const radius = Math.round(Math.max(0, Math.min(32, radii.length ? radii[Math.floor(radii.length / 2)] : 10)));
  const paddings = [...source.matchAll(/padding(?:-[\w]+)?\s*:\s*([\d.]+)(px|rem)/gi)].map(match => Number(match[1]) * (match[2].toLowerCase() === 'rem' ? 16 : 1)).filter(value => Number.isFinite(value) && value < 160);
  const averagePadding = paddings.length ? paddings.reduce((sum, value) => sum + value, 0) / paddings.length : 18;
  const density = averagePadding > 26 ? 'airy' : averagePadding < 12 ? 'compact' : 'balanced';
  const centered = (source.match(/text-align\s*:\s*center/gi) || []).length;
  const left = (source.match(/text-align\s*:\s*left/gi) || []).length;
  const layout = centered > Math.max(4, left * 1.4) ? 'centered' : 'editorial';
  const gradients = (source.match(/(?:linear|radial|conic)-gradient\(/gi) || []).length;
  const shadows = (source.match(/box-shadow\s*:/gi) || []).length;
  return {fontStyle, sourceFont, radius, radiusStyle:radius <= 3 ? 'sharp' : radius >= 18 ? 'rounded' : 'soft', density, layout, gradients, shadows};
}

export function extractInspiration({url, finalUrl, html, css = ''}){
  const source = `${html}\n${css}`.replace(/\/\*[\s\S]*?\*\//g, ' ');
  const colors = collectColors(source);
  const palette = chooseColors(source, colors);
  const traits = visualTraits(source);
  const title = clean(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1].replace(/<[^>]+>/g, '') || new URL(finalUrl || url).hostname, 140);
  const description = clean(html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/i)?.[1] || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i)?.[1], 240);
  const profile = traits.gradients >= 4 ? 'immersive' : traits.fontStyle === 'serif' ? 'editorial' : traits.radius >= 18 ? 'friendly' : traits.shadows <= 2 ? 'minimal' : 'structured';
  const logo=extractLogo(html,finalUrl||url);
  const meta=(name)=>{const tag=[...html.matchAll(/<meta\b[^>]*>/gi)].map(m=>m[0]).find(t=>new RegExp(`(?:name|property)\\s*=\\s*["']${name}["']`,'i').test(t));return tag?decodeEntities(attribute(tag,'content')):''};
  const siteName=clean(meta('og:site_name')||meta('application-name')||meta('apple-mobile-web-app-title'),80);
  const themeColor=normalizeHex(meta('theme-color'));
  return {
    schemaVersion:1, url:String(url), finalUrl:String(finalUrl || url), host:new URL(finalUrl || url).hostname,
    title, description, siteName, themeColor, contentExcerpt:extractReadableText(html), ...palette, ...traits, profile, logo,
    analyzedAt:new Date().toISOString()
  };
}

export function normalizeInspiration(value, expectedUrl = ''){
  if (!value || typeof value !== 'object') return null;
  const url = assertPublicHttps(expectedUrl || value.url).toString();
  if (expectedUrl && new URL(value.url || expectedUrl).toString() !== new URL(expectedUrl).toString()) return null;
  const allowed = (candidate, values, fallback) => values.includes(candidate) ? candidate : fallback;
  const validColor = (candidate, fallback) => normalizeHex(candidate) || fallback;
  let logo=null;
  if(value.logo&&typeof value.logo==='object'){
    if(value.logo.type==='svg'){
      const svg=sanitizeSvg(value.logo.svg);if(svg)logo={type:'svg',svg,sourceUrl:clean(value.logo.sourceUrl||url,1000),alt:clean(value.logo.alt,140)||'Logo oficial'};
    }else if(value.logo.type==='url'){
      try{const logoUrl=assertPublicHttps(value.logo.url).toString();logo={type:'url',url:logoUrl,sourceUrl:logoUrl,alt:clean(value.logo.alt,140)||'Logo oficial'};}catch(_){}
    }
  }
  return {
    schemaVersion:1, url, finalUrl:clean(value.finalUrl || url, 500), host:clean(value.host || new URL(url).hostname, 180),
    title:clean(value.title, 140), description:clean(value.description, 240), siteName:clean(value.siteName, 80), themeColor:normalizeHex(value.themeColor), contentExcerpt:clean(value.contentExcerpt, 5000),
    primary:validColor(value.primary, '#12233e'), accent:validColor(value.accent, '#ffb000'), background:validColor(value.background, '#f5f6f8'), surface:validColor(value.surface, '#ffffff'), text:validColor(value.text, '#142238'),
    palette:(Array.isArray(value.palette) ? value.palette : []).map(color => normalizeHex(color)).filter(Boolean).slice(0, 7),
    mode:allowed(value.mode, ['dark','light'], 'light'), fontStyle:allowed(value.fontStyle, ['grotesk','serif','rounded','mono'], 'grotesk'), sourceFont:clean(value.sourceFont, 120),
    radius:Math.max(0, Math.min(32, Number(value.radius) || 0)), radiusStyle:allowed(value.radiusStyle, ['sharp','soft','rounded'], 'soft'), density:allowed(value.density, ['compact','balanced','airy'], 'balanced'), layout:allowed(value.layout, ['editorial','centered'], 'editorial'),
    gradients:Math.max(0, Math.min(99, Number(value.gradients) || 0)), shadows:Math.max(0, Math.min(99, Number(value.shadows) || 0)), profile:allowed(value.profile, ['immersive','editorial','friendly','minimal','structured'], 'structured'), logo, analyzedAt:clean(value.analyzedAt, 40) || new Date().toISOString()
  };
}

/** Error del analizador con el código HTTP de la web analizada (403, 429…) y si es un muro antibots. */
export class ErrorAnalisis extends Error {
  constructor(message, {estado = 0, bloqueo = false} = {}){ super(message); this.name = 'ErrorAnalisis'; this.estado = estado; this.bloqueo = bloqueo; }
}

/**
 * Analiza una web pública. `opciones` (todas opcionales): resolver/fetchImpl (pruebas), timeoutMs y
 * detectarBloqueo (true en /marcablanca: una página de reto antibots no es la web de la marca y se
 * dice, en vez de sacar colores de ella).
 */
export async function analyzeInspiration(value, opciones = {}){
  const {detectarBloqueo = false, timeoutMs = 8000, fetchImpl = fetch} = opciones;
  // Una resolución DNS por dominio y análisis (la página y sus hojas suelen compartir dominio).
  const base = opciones.resolver === undefined ? (host => resolverDoh(host, {fetchImpl})) : opciones.resolver;
  const resueltos = new Map();
  const resolver = base ? (host => { if (!resueltos.has(host)) resueltos.set(host, base(host)); return resueltos.get(host); }) : null;
  const {response, url:finalUrl} = await fetchPublico(value, {...opciones, timeoutMs, resolver});
  const requested = assertPublicHttps(value);
  if (response.status === 401 || response.status === 403) throw new ErrorAnalisis(detectarBloqueo ? `La web ha rechazado la lectura (HTTP ${response.status}): bloquea a los analizadores automáticos.` : 'Esa URL no permite lectura pública. Usa su enlace público o una presentación de Pixeria/ADmiraNeXT.', {estado:response.status, bloqueo:true});
  if (response.status === 429) throw new ErrorAnalisis('La web limita las lecturas automáticas (HTTP 429). Prueba más tarde.', {estado:429, bloqueo:true});
  if (!response.ok) throw new ErrorAnalisis(`La web inspiradora responde con HTTP ${response.status}.`, {estado:response.status});
  const type = response.headers.get('content-type') || '';
  if (!/text\/html|application\/xhtml\+xml/i.test(type)) throw new ErrorAnalisis('La URL inspiradora no devuelve una página web HTML.', {estado:response.status});
  const html = await limitedText(response, MAX_HTML_BYTES);
  if (detectarBloqueo && esMuroAntibots(response, html)) throw new ErrorAnalisis(`La web devuelve una página de verificación antibots (HTTP ${response.status}) en lugar de su contenido: no se puede analizar de forma automática.`, {estado:response.status, bloqueo:true});
  const stylesheetUrls = [...html.matchAll(/<link[^>]+rel=["'][^"']*stylesheet[^"']*["'][^>]+href=["']([^"']+)["']/gi), ...html.matchAll(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*stylesheet[^"']*["']/gi)]
    .map(match => { try { return new URL(match[1], finalUrl); } catch (_) { return null; } })
    .filter(url => url && url.protocol === 'https:' && url.hostname === finalUrl.hostname)
    .filter((url, index, list) => list.findIndex(item => item.href === url.href) === index)
    .slice(0, MAX_STYLESHEETS);
  const sheets = await Promise.all(stylesheetUrls.map(async url => {
    try {
      const {response:sheet} = await fetchPublico(url.toString(), {...opciones, accept:'text/css,*/*;q=.1', timeoutMs:5000, resolver});
      if (!sheet.ok || !/text\/css/i.test(sheet.headers.get('content-type') || 'text/css')) return '';
      return limitedText(sheet, MAX_CSS_BYTES);
    } catch (_) { return ''; }
  }));
  return normalizeInspiration(extractInspiration({url:requested.toString(), finalUrl:finalUrl.toString(), html, css:sheets.join('\n')}), requested.toString());
}
