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
    const src = type === 'animation' ? '' : safeAssetUrl(entry.src, client);
    if (type !== 'animation' && !src) {
      throw new Error(`El medio de “${slide}” debe usar una URL privada de /presentaciones/${client}/media/.`);
    }
    const poster = type === 'video' ? safeAssetUrl(entry.poster, client) : '';
    if (entry.poster && !poster) throw new Error(`El póster de “${slide}” no es una URL privada permitida.`);
    const rights = normalizeRights(entry.rights, slide, {legacy: !Object.prototype.hasOwnProperty.call(entry, 'rights')});
    let replacement = null;
    if (entry.replacement != null) {
      if (!entry.replacement || typeof entry.replacement !== 'object' || Array.isArray(entry.replacement)) {
        throw new Error(`La sustitución segura de “${slide}” debe ser un objeto.`);
      }
      const replacementSrc = type === 'animation' ? '' : safeAssetUrl(entry.replacement.src, client);
      if (type !== 'animation' && !replacementSrc) {
        throw new Error(`La sustitución segura de “${slide}” debe usar una URL privada de esta presentación.`);
      }
      const replacementPoster = type === 'video' ? safeAssetUrl(entry.replacement.poster, client) : '';
      if (entry.replacement.poster && !replacementPoster) {
        throw new Error(`El póster de sustitución de “${slide}” no es una URL privada permitida.`);
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
