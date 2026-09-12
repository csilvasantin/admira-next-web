/* La IMAGEN REAL del producto del folleto (FLT-100318, 12-sep-2026).
 * ----------------------------------------------------------------------------
 * admira.tv/contentcatalogue manda en el deep-link ?producto= un campo `imagen`
 * (URL pública, JPEG ≤512 px, CORS *). Aquí se decide qué URLs se aceptan, se
 * descarga la foto en la Function y se convierte en referencia para Grok
 * (`image: {url}` de POST /v1/videos/generations, docs.x.ai → image-to-video).
 * Todo es tolerante: si la URL no vale o la descarga falla, el vídeo sale sin
 * referencia y el máster sigue llevando la foto real en el overlay.
 */

// Solo se descarga desde casa: la Function nunca hace de proxy de terceros.
export const HOSTS_IMAGEN = new Set(['admira.tv', 'www.admira.tv', 'api.admira.store', 'admiranext.com', 'www.admiranext.com']);
export const MAX_IMAGEN_BYTES = 3 * 1024 * 1024;
const TIPOS_IMAGEN = /^image\/(jpeg|png|webp)\b/i;
const MAX_PROMPT_CHARS = 3200;
export const FRASE_REFERENCIA = 'El producto que aparece es EXACTAMENTE el de la imagen de referencia: mismo packaging, misma etiqueta y mismos colores, sin alterarlo ni inventar otro envase.';

/** URL https de casa, sin credenciales ni espacios; vacío si no sirve. */
export function urlImagenProducto(value) {
  const raw = String(value == null ? '' : value).trim();
  if(!/^https:\/\/\S{4,500}$/.test(raw)) return '';
  try{
    const url = new URL(raw);
    if(url.protocol !== 'https:' || url.username || url.password) return '';
    if(!HOSTS_IMAGEN.has(url.hostname)) return '';
    return url.href;
  }catch(_){ return ''; }
}

/** Con referencia, el prompt lo dice; sin ella, se devuelve tal cual. */
export function promptConReferencia(prompt, tieneImagen) {
  const base = String(prompt == null ? '' : prompt).trim();
  if(!tieneImagen) return base;
  const hueco = MAX_PROMPT_CHARS - FRASE_REFERENCIA.length - 1;
  return `${base.slice(0, hueco).trim()} ${FRASE_REFERENCIA}`;
}

function base64(bytes) {
  let binario = '';
  const paso = 0x8000;
  for(let i = 0; i < bytes.length; i += paso) binario += String.fromCharCode.apply(null, bytes.subarray(i, i + paso));
  return btoa(binario);
}

/**
 * Descarga la foto y la devuelve como data URI. null si no es una imagen de
 * un tipo admitido, pesa de más o la red falla: nunca lanza.
 */
export async function descargarImagenProducto(url, fetchFn = fetch) {
  const limpia = urlImagenProducto(url);
  if(!limpia) return null;
  try{
    const response = await fetchFn(limpia, {headers:{accept:'image/jpeg,image/png,image/webp'}, redirect:'follow'});
    if(!response.ok) return null;
    const contentType = String(response.headers.get('content-type') || '');
    if(!TIPOS_IMAGEN.test(contentType)) return null;
    const declarado = Number(response.headers.get('content-length') || 0);
    if(declarado > MAX_IMAGEN_BYTES) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    if(!bytes.length || bytes.length > MAX_IMAGEN_BYTES) return null;
    const tipo = contentType.split(';')[0].trim().toLowerCase();
    return {url:limpia, contentType:tipo, bytes:bytes.length, dataUrl:`data:${tipo};base64,${base64(bytes)}`};
  }catch(_){ return null; }
}
