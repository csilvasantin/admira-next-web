const TYPES = new Set(['image', 'video', 'audio', 'animation']);
const PRELOAD = new Set(['none', 'metadata', 'auto']);
const ANIMATIONS = new Set(['fade', 'rise', 'zoom', 'pulse']);
const SPECIAL_SLIDES = new Set(['cover', 'objective', 'closing']);
const RIGHTS_PERMISSIONS = new Set(['owned', 'granted', 'licensed', 'public-domain', 'pending', 'denied']);

function text(value, max = 240){
  return String(value == null ? '' : value).replace(/\r\n?/g, '\n').trim().slice(0, max);
}

function safeSlide(value){
  const slide = text(value, 80).toLowerCase();
  return SPECIAL_SLIDES.has(slide) || /^[a-z0-9][a-z0-9_-]{0,79}$/.test(slide) ? slide : '';
}

function safeAssetUrl(value, client){
  const url = text(value, 500);
  if (!url) return '';
  const escapedClient = String(client || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^/presentaciones/${escapedClient}/(?:media|images)/[a-z0-9][a-z0-9._-]{0,159}$`, 'i').test(url) ? url : '';
}

/**
 * Fleet / AdmiraNeXT HTTPS video assets for BEST motion (FLT-100237).
 * Hosts: www.admira.live, admira.live, www.admiranext.com, admiranext.com.
 * Path must look like media: ends with .mp4/.webm/.mov OR under /assets/ or /presentaciones/.
 * Rights model unchanged — fleet clips should declare permission owned or acceptedByCarlos.
 */
export function safeExternalVideoUrl(value){
  const raw = text(value, 500);
  if (!raw) return '';
  let parsed;
  try { parsed = new URL(raw); }
  catch (_) { return ''; }
  if (parsed.protocol !== 'https:') return '';
  const host = parsed.hostname.toLowerCase();
  const allowed = new Set(['www.admira.live', 'admira.live', 'www.admiranext.com', 'admiranext.com']);
  if (!allowed.has(host)) return '';
  const path = parsed.pathname || '';
  const looksMedia = /\.(mp4|webm|mov)$/i.test(path) || /^\/assets\//i.test(path) || /^\/presentaciones\//i.test(path);
  return looksMedia ? parsed.toString() : '';
}

function safeVideoSrc(value, client){
  return safeAssetUrl(value, client) || safeExternalVideoUrl(value);
}

function safeVideoPoster(value, client){
  return safeAssetUrl(value, client) || safeExternalVideoUrl(value);
}

function rawEntries(value){
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return [];
  let parsed;
  try { parsed = JSON.parse(value); }
  catch (_) { throw new Error('La configuración multimedia debe ser un array JSON válido.'); }
  if (!Array.isArray(parsed)) throw new Error('La configuración multimedia debe ser un array JSON.');
  return parsed;
}

function normalizeExpiry(value, label){
  const expiresAt = text(value, 40);
  if (!expiresAt) return '';
  const timestamp = Date.parse(expiresAt);
  if (!Number.isFinite(timestamp)) throw new Error(`La caducidad de derechos de “${label}” no es una fecha válida.`);
  return new Date(timestamp).toISOString();
}

function normalizeRights(value, label, {legacy = false} = {}){
  if (legacy) {
    return {
      source: '',
      permission: 'legacy',
      license: '',
      holder: '',
      attribution: '',
      expiresAt: '',
      acceptedByCarlos: false,
      acceptedAt: '',
      approvalNote: '',
      status: 'legacy-review',
      usable: true
    };
  }
  const rights = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const acceptedByCarlos = rights.acceptedByCarlos === true;
  const source = text(rights.source, 300);
  const permission = text(rights.permission, 30).toLowerCase();
  const license = text(rights.license, 120);
  const holder = text(rights.holder, 160);
  const attribution = text(rights.attribution, 240);
  let expiresAt = '';
  try { expiresAt = normalizeExpiry(rights.expiresAt, label); }
  catch (error) {
    if (!acceptedByCarlos) throw error;
    expiresAt = text(rights.expiresAt, 40);
  }
  const acceptedAt = text(rights.acceptedAt, 40);
  const approvalNote = text(rights.approvalNote, 240);
  const complete = Boolean(source && license && (permission === 'public-domain' || holder));
  const permitted = RIGHTS_PERMISSIONS.has(permission) && !['pending', 'denied'].includes(permission);
  const expired = Boolean(expiresAt && Date.parse(expiresAt) <= Date.now());
  return {
    source,
    permission: RIGHTS_PERMISSIONS.has(permission) ? permission : 'pending',
    license,
    holder,
    attribution,
    expiresAt,
    acceptedByCarlos,
    acceptedAt,
    approvalNote,
    status: acceptedByCarlos ? 'carlos-approved' : expired ? 'expired' : !complete ? 'missing-details' : permitted ? 'usable' : permission === 'denied' ? 'denied' : 'pending',
    usable: acceptedByCarlos || (complete && permitted && !expired)
  };
}

export function normalizeSlideMedia(value, client){
  const entries = rawEntries(value).slice(0, 40);
  const normalized = [];
  const occupied = new Set();
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error('Cada medio debe ser un objeto.');
    const slide = safeSlide(entry.slide);
    const type = text(entry.type, 20).toLowerCase();
    if (!slide) throw new Error('Cada medio necesita una diapositiva válida.');
    if (!TYPES.has(type)) throw new Error(`Tipo multimedia no válido en “${slide}”.`);
    if (occupied.has(slide)) throw new Error(`Solo puede haber un medio principal en “${slide}”.`);
    const src = type === 'animation' ? '' : (type === 'video' ? safeVideoSrc(entry.src, client) : safeAssetUrl(entry.src, client));
    if (type !== 'animation' && !src) {
      throw new Error(type === 'video'
        ? `El vídeo de “${slide}” debe usar una URL privada de /presentaciones/${client}/media/ o un asset HTTPS de admira.live / admiranext.com.`
        : `El medio de “${slide}” debe usar una URL privada de /presentaciones/${client}/media/.`);
    }
    const poster = type === 'video' ? safeVideoPoster(entry.poster, client) : '';
    if (entry.poster && !poster) throw new Error(`El póster de “${slide}” no es una URL de imagen/vídeo permitida.`);
    const rights = normalizeRights(entry.rights, slide, {legacy: !Object.prototype.hasOwnProperty.call(entry, 'rights')});
    let replacement = null;
    if (entry.replacement != null) {
      if (!entry.replacement || typeof entry.replacement !== 'object' || Array.isArray(entry.replacement)) {
        throw new Error(`La sustitución segura de “${slide}” debe ser un objeto.`);
      }
      const replacementSrc = type === 'animation' ? '' : (type === 'video' ? safeVideoSrc(entry.replacement.src, client) : safeAssetUrl(entry.replacement.src, client));
      if (type !== 'animation' && !replacementSrc) {
        throw new Error(type === 'video'
          ? `La sustitución segura de “${slide}” debe usar URL privada o asset HTTPS de flota (admira.live / admiranext.com).`
          : `La sustitución segura de “${slide}” debe usar una URL privada de esta presentación.`);
      }
      const replacementPoster = type === 'video' ? safeVideoPoster(entry.replacement.poster, client) : '';
      if (entry.replacement.poster && !replacementPoster) {
        throw new Error(`El póster de sustitución de “${slide}” no es una URL permitida.`);
      }
      const replacementRights = normalizeRights(entry.replacement.rights, `${slide} (sustitución)`);
      replacement = {
        src: replacementSrc,
        poster: replacementPoster,
        caption: text(entry.replacement.caption, 180),
        rights: replacementRights,
        usable: replacementRights.usable
      };
    }
    const replacementUsed = !rights.usable && Boolean(replacement?.usable);
    const usable = rights.usable || replacementUsed || type === 'animation';
    const autoplay = entry.autoplay === true;
    const animation = ANIMATIONS.has(entry.animation) ? entry.animation : 'fade';
    normalized.push({
      slide,
      type,
      src,
      poster,
      caption: text(entry.caption, 180),
      fallback: text(entry.fallback, 240) || 'El contenido multimedia no está disponible. Continúa con el relato de la diapositiva.',
      preload: PRELOAD.has(entry.preload) ? entry.preload : 'metadata',
      autoplay,
      loop: entry.loop === true,
      muted: type === 'video' ? (autoplay || entry.muted === true) : false,
      animation,
      durationMs: Math.max(300, Math.min(20000, Math.round(Number(entry.durationMs) || 900))),
      rights,
      replacement,
      usable,
      rightsStatus: type === 'animation' ? 'not-applicable' : replacementUsed ? 'replacement' : rights.status,
      replacementUsed,
      effectiveSrc: replacementUsed ? replacement.src : usable ? src : '',
      effectivePoster: replacementUsed ? replacement.poster : usable ? poster : '',
      effectiveCaption: replacementUsed ? (replacement.caption || text(entry.caption, 180)) : text(entry.caption, 180)
    });
    occupied.add(slide);
  }
  return normalized;
}


/** Fleet smoke / demo clip for BEST motion (FLT-100315). HTTPS admira.live /assets/. */
export const FLEET_EXAMPLE_VIDEO = 'https://www.admira.live/assets/mouth-v2/boca-v2-ciclo.mp4';

export function exampleVideoEntry({src, slide = 'cover', caption} = {}){
  const url = safeExternalVideoUrl(src) || FLEET_EXAMPLE_VIDEO;
  return {
    slide: safeSlide(slide) || 'cover',
    type: 'video',
    src: url,
    loop: true,
    muted: true,
    autoplay: true,
    caption: text(caption, 180) || 'Ejemplo en movimiento',
    fallback: 'El ejemplo de vídeo no está disponible. Continúa con el relato.',
    rights: {source: url, permission: 'owned', license: 'AdmiraNeXT fleet', holder: 'AdmiraNeXT'}
  };
}

export function wantsExampleVideo(raw = {}){
  const flag = raw.includeExampleVideo;
  if (flag === true || flag === 1 || flag === 'on' || flag === 'true' || flag === '1') return true;
  if (String(raw.exampleVideoUrl || raw.videoUrl || '').trim()) return true;
  const outputs = Array.isArray(raw.outputs) ? raw.outputs.map(value => String(value).toLowerCase()) : [];
  if (outputs.some(value => value === 'video' || value === 'tiktok' || value.includes('tiktok'))) return true;
  const blob = JSON.stringify({embeds: raw.embeds, title: raw.title, summary: raw.summary}).toLowerCase();
  return /\btiktok\b|youtube\.com\/shorts/.test(blob);
}

/** Inject a real fleet (or caller) MP4 when the video/TikTok path is used and no video slide exists. */
export function ensureExampleVideo(slideMedia, raw = {}, client = ''){
  const list = rawEntries(slideMedia).slice();
  if (list.some(entry => String(entry?.type || '').toLowerCase() === 'video' && entry.src)) return list;
  if (!wantsExampleVideo({...raw, slideMedia: list})) return list;
  const occupied = new Set(list.map(entry => safeSlide(entry?.slide)).filter(Boolean));
  const requested = safeSlide(raw.videoSlide || raw.exampleVideoSlide || 'cover') || 'cover';
  let slide = requested;
  if (occupied.has(slide)) {
    slide = ['cover', 'objective', 'vision', 'activar', 'crear', 'closing'].find(id => !occupied.has(id)) || '';
    if (!slide) return list;
  }
  list.push(exampleVideoEntry({
    src: raw.exampleVideoUrl || raw.videoUrl,
    slide,
    caption: raw.exampleVideoCaption
  }));
  return list;
}
