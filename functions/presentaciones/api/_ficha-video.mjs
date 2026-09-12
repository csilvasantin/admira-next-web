/* La FICHA con la que un vídeo generado llega al Stock.
 * ----------------------------------------------------------------------------
 * Hasta ahora el motor publicaba con título y comentario fijos en el código:
 * los 14 TikToks del catálogo se llamaban todos «TikTok 15s · ADmiraNeXT» y
 * decían todos lo mismo. Da igual cuánto se afine el brief —el tema, la idea
 * elegida, el tono— si al llegar al catálogo se tira todo y se pone una etiqueta
 * genérica. Y catorce piezas con el mismo nombre no se pueden ni subir: YouTube
 * las ve como duplicados y nadie sabe cuál es cuál.
 *
 * Así que quien encarga el vídeo manda también su ficha, y esto la sanea. Es la
 * misma idea que el resto del sistema: la decide quien publica, no la adivina el
 * catálogo.
 */

// El Stock ya recorta a 300/2000, pero recortar aquí evita mandar por la red un
// comentario de 50 KB que va a acabar cortado igual.
const MAX_TITULO = 200;
const MAX_COMENTARIO = 1200;
// CUATRO, que es lo que el Stock guarda de verdad (recorta el resto sin avisar).
// Recortar aquí no quita nada: hace que la pérdida la decidamos nosotros —por
// orden de importancia— en vez de que se caiga lo último que toque. La primera
// vez que pasó se perdió el tema de la pieza, que es de donde salen sus hashtags.
const MAX_ETIQUETAS = 4;
// Piezas de CATÁLOGO (Yokup #3183): el Stock sube el tope a 10 para que quepan
// las 7 que agrupan la opción «Catálogo» de Pixeria (cliente, id, mes) y aún
// sobren tres para las propias. Hasta que ese Worker esté vivo recorta a 4 él
// mismo: mandar 7 no rompe nada.
const MAX_ETIQUETAS_CATALOGO = 10;
// El Stock exige ^[A-Za-z0-9:_-]{16,160}$ para externalId y deriva de él el id
// del asset (sha256 → auto-…): el mismo externalId devuelve el MISMO asset. Por
// eso quien encarga puede fijarlo cuando la pieza tiene identidad propia —un
// producto de catálogo— y el catálogo sabe si ya existe sin preguntar.
const MAX_EXTERNAL_ID = 120;

// 'tiktok' NO es decorativa: es la marca por la que el Stock manda la pieza a la
// categoría «tiktoks». Si se pierde, el vídeo cae donde Gemini decida y deja de
// estar donde se le busca. 'vertical' es la llave con la que el MUPI emite en
// 9:16 nativo en vez de recortar. Ninguna de las dos es negociable.
export const ETIQUETAS_BASE = ['admiranext', 'tiktok', 'vertical'];
// FORMATO de la pieza (FLT-100372, 12-sep-2026): el catálogo puede pedir la
// versión vertical (9:16, la de siempre), la horizontal (16:9) o las dos. La
// etiqueta de orientación es la que decide cómo emite el player: 'vertical' =
// MUPI en 9:16 nativo; 'horizontal' = pantalla apaisada. Nunca las dos a la vez.
export const FORMATOS = new Set(['9:16', '16:9']);
export function saneaFormato(v) { return FORMATOS.has(String(v || '').trim()) ? String(v).trim() : '9:16'; }
export function etiquetaOrientacion(formato) { return saneaFormato(formato) === '16:9' ? 'horizontal' : 'vertical'; }
function etiquetasBase(formato) { return ['admiranext', 'tiktok', etiquetaOrientacion(formato)]; }
// Proyecto con el que el Stock agrupa las piezas de catálogo (opción «Catálogo»
// de Pixeria): fijo, porque los folletos llegan siempre desde admira.tv.
export const PROYECTO_CATALOGO = 'admira-tv';
const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;

export const FICHA_POR_DEFECTO = {
  title: 'TikTok 15s · ADmiraNeXT',
  comment: 'Publicado automáticamente desde admiranext.com/tiktok.',
  tags: ETIQUETAS_BASE
};

const texto = (v, max) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);

/** Etiqueta de catálogo: minúsculas, sin espacios ni signos. */
function etiqueta(v) {
  return String(v == null ? '' : v)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32);
}

/** Slug de producto o catálogo: minúsculas, guiones, sin acentos (espejo de slugCatalogo en tiktok/app.js). */
export function slug(v, max = 40) {
  return String(v == null ? '' : v)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, max);
}

/** Mes «AAAA-MM» de una fecha ISO; vacío si no es una fecha. */
export function mesDe(iso) {
  const v = String(iso == null ? '' : iso).trim();
  return FECHA_ISO.test(v) ? v.slice(0, 7) : '';
}

/** Cliente de un catalogo_id: lo que va antes del primer guion («alcampo-2026-09-10» → «alcampo»). */
export function clienteDeCatalogo(id) {
  return slug(String(id == null ? '' : id).split('-')[0], 32);
}

/**
 * Meta `catalogo` con la que la pieza llega al Stock (contrato Yokup #3183):
 * {id, cliente, nombre, desde, hasta, proyecto, producto}. Devuelve null si no
 * hay un id de catálogo aprovechable: sin catálogo no se añade NADA, ni la meta
 * ni sus etiquetas — los briefs de Xtore siguen exactamente igual.
 */
export function saneaCatalogo(bruto) {
  if (!bruto || typeof bruto !== 'object') return null;
  const id = slug(bruto.id, 40);
  if (!id) return null;
  const cliente = clienteDeCatalogo(id);
  if (!cliente) return null;
  const desde = FECHA_ISO.test(String(bruto.desde || '')) ? String(bruto.desde) : '';
  const hasta = FECHA_ISO.test(String(bruto.hasta || '')) ? String(bruto.hasta) : '';
  return {
    id, cliente,
    nombre: texto(bruto.nombre, 80),
    desde, hasta,
    proyecto: slug(bruto.proyecto, 40) || PROYECTO_CATALOGO,
    producto: slug(bruto.producto, 40)
  };
}

/**
 * Las 7 etiquetas de una pieza de catálogo, en el orden del contrato: las tres
 * de casa, 'catalogo', el cliente, el id del catálogo y el mes «AAAA-MM» de
 * inicio de validez (con el que el Stock agrupa por folleto).
 */
export function etiquetasCatalogo(catalogo, formato = '9:16') {
  if (!catalogo) return etiquetasBase(formato);
  return [...etiquetasBase(formato), 'catalogo', catalogo.cliente, catalogo.id, mesDe(catalogo.desde)].filter(Boolean);
}

/** Clave externa: solo lo que el Stock admite; vacío si no sirve. */
export function claveExterna(v) {
  const limpia = String(v == null ? '' : v)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9:_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, MAX_EXTERNAL_ID);
  return limpia.length >= 8 ? limpia : '';
}

/**
 * Ficha lista para publicar. Nunca falla y nunca devuelve vacío: si no llega
 * nada aprovechable se cae a la genérica, porque un vídeo sin ficha debe
 * publicarse igual — perderlo sería peor que publicarlo mal titulado.
 */
export function saneaFicha(bruto) {
  const title = texto(bruto?.title, MAX_TITULO) || FICHA_POR_DEFECTO.title;
  const comment = texto(bruto?.comment, MAX_COMENTARIO) || FICHA_POR_DEFECTO.comment;
  const propias = (Array.isArray(bruto?.tags) ? bruto.tags : []).map(etiqueta).filter(Boolean);
  // Las base van SIEMPRE y van primero: que quien encarga no pueda dejar la pieza
  // fuera de su categoría por olvidarse una etiqueta. Detrás, las suyas EN SU
  // ORDEN — con solo un hueco libre, ese orden es el que decide qué sobrevive,
  // así que quien encarga pone primero la que más le importa.
  // Pieza de catálogo: sus 7 etiquetas van fijas y delante (son las que agrupan
  // la opción «Catálogo» del Stock), y el tope sube a 10.
  const catalogo = saneaCatalogo(bruto?.catalogo);
  const formato = saneaFormato(bruto?.formato);
  // La orientación contraria se quita de las propias: una pieza 16:9 con la
  // etiqueta 'vertical' acabaría en un MUPI recortada.
  const contraria = formato === '16:9' ? 'vertical' : 'horizontal';
  const propiasLimpias = propias.filter(t => t !== contraria);
  const tags = catalogo
    ? [...new Set([...etiquetasCatalogo(catalogo, formato), ...propiasLimpias])].slice(0, MAX_ETIQUETAS_CATALOGO)
    : [...new Set([...etiquetasBase(formato), ...propiasLimpias])].slice(0, MAX_ETIQUETAS);
  const externalId = claveExterna(bruto?.externalId);
  const ficha = externalId ? { title, comment, tags, externalId, formato } : { title, comment, tags, formato };
  if (catalogo) ficha.catalogo = catalogo;
  // Encargo (brief/producto): el BRUTO de Grok no va al Stock; se retiene en
  // R2 como fuente del máster y solo el máster (identidad exacta) se publica.
  // El 11-sep-2026 Carlos vio tres piezas del mismo anuncio de coche en el Stock.
  if(bruto?.brutoAlStock === false) ficha.brutoAlStock = false;
  return ficha;
}
