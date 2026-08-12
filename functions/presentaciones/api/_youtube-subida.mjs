/* Subir un TikTok nuestro a YouTube Shorts.
 * ----------------------------------------------------------------------------
 * Shorts NO es una API aparte: un vídeo es Short por ser vertical y durar poco.
 * Así que esto es un videos.insert normal de YouTube Data API v3 — lo que decide
 * que salga como Short es el material, que ya generamos en 9:16 y 15 s.
 *
 * Dos cosas que marcan el diseño:
 *
 * 1. LA CUOTA. videos.insert cuesta 1600 unidades de las 10.000 diarias por
 *    defecto: unas SEIS subidas al día. No es un detalle de configuración, es el
 *    límite real del sistema. Por eso `puedeSubir()` existe y por eso el error de
 *    cuota se distingue de los demás: reintentar una subida agotada no la
 *    arregla, solo quema lo que quede.
 *
 * 2. QUÉ SE PUBLICA Y CÓMO. Se sube como `private` por defecto. Una pieza
 *    generada sola que aparece en público sin que nadie la haya visto es una
 *    forma rápida de tener un disgusto; que Carlos la pase a pública es un clic,
 *    y deshacer una publicación no lo es.
 */

// YouTube Data API v3 · https://developers.google.com/youtube/v3/docs/videos/insert
export const COSTE_SUBIDA = 1600;
export const CUOTA_DIARIA = 10000;
export const URL_SUBIDA = 'https://www.googleapis.com/upload/youtube/v3/videos';
export const URL_TOKEN = 'https://oauth2.googleapis.com/token';

const MAX_TITULO = 100;      // límite duro de YouTube
const MAX_DESCRIPCION = 5000;

/** Cuántas subidas quedan hoy con las unidades que se hayan gastado ya. */
export function subidasRestantes(gastado = 0, cuota = CUOTA_DIARIA) {
  return Math.max(0, Math.floor((cuota - Math.max(0, gastado)) / COSTE_SUBIDA));
}

export function puedeSubir(gastado = 0, cuota = CUOTA_DIARIA) {
  return subidasRestantes(gastado, cuota) > 0;
}

/**
 * Los metadatos del vídeo, tal como los quiere videos.insert.
 * El título y la descripción vienen ya armados por shorts-copy.js: aquí solo se
 * ajustan a los límites de YouTube, que es lo único que este lado sabe.
 */
export function cuerpoInsert({ titulo, descripcion, etiquetas = [], visibilidad = 'private' }) {
  const t = String(titulo || '').replace(/\s+/g, ' ').trim().slice(0, MAX_TITULO);
  if (!t) throw new Error('Un vídeo sin título no se sube.');
  return {
    snippet: {
      title: t,
      description: String(descripcion || '').slice(0, MAX_DESCRIPCION),
      // YouTube rechaza el lote entero si una etiqueta lleva '<' o '>'.
      tags: etiquetas.map((e) => String(e).replace(/[<>]/g, '').slice(0, 30)).filter(Boolean).slice(0, 15),
      categoryId: '22'   // People & Blogs: el cajón neutro cuando la pieza no es de un género claro
    },
    status: {
      privacyStatus: ['private', 'unlisted', 'public'].includes(visibilidad) ? visibilidad : 'private',
      selfDeclaredMadeForKids: false
    }
  };
}

/**
 * Cambia el refresh token por uno de acceso. El refresh es el que se guarda en la
 * bóveda y dura; el de acceso vive una hora y no se guarda en ningún sitio.
 */
export async function tokenDeAcceso({ clientId, clientSecret, refreshToken }, buscar = fetch) {
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Falta la credencial de YouTube: no se ha dado el consentimiento del canal.');
  }
  const res = await buscar(URL_TOKEN, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId, client_secret: clientSecret,
      refresh_token: refreshToken, grant_type: 'refresh_token'
    })
  });
  const d = await res.json().catch(() => ({}));
  // Un refresh token revocado devuelve 400 invalid_grant, y eso NO se arregla
  // reintentando: hay que volver a dar el consentimiento. Se dice con esas
  // palabras para que quien lo lea sepa qué hacer.
  if (!res.ok || !d.access_token) {
    const revocado = d.error === 'invalid_grant';
    throw new Error(revocado
      ? 'El permiso del canal ya no vale: hay que volver a autorizar YouTube una vez.'
      : `Google no dio el token de acceso (${d.error || res.status}).`);
  }
  return d.access_token;
}

/** Traduce el fallo de YouTube a algo accionable, distinguiendo la cuota. */
export function motivoDelFallo(status, payload) {
  const razon = payload?.error?.errors?.[0]?.reason || '';
  if (status === 403 && /quota/i.test(razon)) {
    return { cuotaAgotada: true, mensaje: 'Se acabó la cuota diaria de YouTube (unas 6 subidas). Mañana se reanuda.' };
  }
  if (status === 401) return { cuotaAgotada: false, mensaje: 'YouTube no aceptó la credencial: hay que volver a autorizar el canal.' };
  if (status === 400) return { cuotaAgotada: false, mensaje: `YouTube rechazó los datos del vídeo (${razon || 'petición no válida'}).` };
  return { cuotaAgotada: false, mensaje: `YouTube falló al subir (${status}${razon ? ' · ' + razon : ''}).` };
}
