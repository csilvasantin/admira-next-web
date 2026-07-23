const TYPES = new Set(['video', 'audio', 'animation']);
const PRELOAD = new Set(['none', 'metadata', 'auto']);
const ANIMATIONS = new Set(['fade', 'rise', 'zoom', 'pulse']);
const SPECIAL_SLIDES = new Set(['cover', 'objective', 'closing']);

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
      durationMs: Math.max(300, Math.min(20000, Math.round(Number(entry.durationMs) || 900)))
    });
    occupied.add(slide);
  }
  return normalized;
}
