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

// 'tiktok' NO es decorativa: es la marca por la que el Stock manda la pieza a la
// categoría «tiktoks». Si se pierde, el vídeo cae donde Gemini decida y deja de
// estar donde se le busca. 'vertical' es la llave con la que el MUPI emite en
// 9:16 nativo en vez de recortar. Ninguna de las dos es negociable.
export const ETIQUETAS_BASE = ['admiranext', 'tiktok', 'vertical'];

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
  const tags = [...new Set([...ETIQUETAS_BASE, ...propias])].slice(0, MAX_ETIQUETAS);
  return { title, comment, tags };
}
