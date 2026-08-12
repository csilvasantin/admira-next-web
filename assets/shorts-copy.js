/* El texto con el que un TikTok nuestro sale a YouTube Shorts.
 * ----------------------------------------------------------------------------
 * La bandeja no vale nada si el texto hay que reescribirlo: entonces solo cambia
 * el sitio donde trabajas, no el trabajo. Así que aquí se arma un paquete que se
 * pueda pegar TAL CUAL — título dentro del límite, descripción con la idea, y
 * hashtags del tema.
 *
 * Es determinista a propósito: nada de pedirle el texto a un modelo cada vez que
 * abres la página. Lo que sabe el catálogo (título, comentario, etiquetas) basta
 * para un pack correcto, sale al instante y no cuesta nada. Si algún día se
 * quiere afinar con Grok, se afina encima de esto, no en su lugar.
 */

// YouTube corta el título a 100 caracteres. Cortarlo nosotros —y en un espacio,
// no a mitad de palabra— es la diferencia entre un título y un tropiezo.
export const MAX_TITULO = 100;
const MARCA_SHORT = '#Shorts';

export const TEMAS_HASHTAGS = {
  tech: ['#tecnologia', '#innovacion', '#producto'],
  creativity: ['#creatividad', '#diseno', '#ideas'],
  business: ['#negocio', '#estrategia', '#empresa']
};
const BASE_HASHTAGS = ['#Shorts', '#Admira'];

const sinAcentos = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Tema de la pieza a partir de sus etiquetas; `null` si no lo dice ninguna. */
export function temaDePieza(pieza) {
  const etiquetas = (Array.isArray(pieza?.tags) ? pieza.tags : []).map(sinAcentos);
  if (etiquetas.some((e) => ['tech', 'tecnologia', 'ia', 'software'].includes(e))) return 'tech';
  if (etiquetas.some((e) => ['creativity', 'creatividad', 'diseno', 'design'].includes(e))) return 'creativity';
  if (etiquetas.some((e) => ['business', 'negocio', 'empresa', 'estrategia'].includes(e))) return 'business';
  return null;
}

/** Recorta en un espacio, nunca a mitad de palabra, y solo si hace falta. */
export function recorta(texto, limite) {
  const limpio = String(texto || '').replace(/\s+/g, ' ').trim();
  if (limpio.length <= limite) return limpio;
  const corte = limpio.slice(0, limite);
  const espacio = corte.lastIndexOf(' ');
  return (espacio > limite * 0.6 ? corte.slice(0, espacio) : corte).replace(/[\s.,;:—-]+$/, '') + '…';
}

/**
 * Paquete listo para pegar en YouTube. Devuelve `null` si la pieza no tiene ni
 * título: un Short sin título no se sube, y ofrecer el botón sería mentir.
 */
export function packShorts(pieza) {
  const bruto = String(pieza?.title || '').trim();
  if (!bruto) return null;

  const tema = temaDePieza(pieza);
  const hashtags = [...new Set([...BASE_HASHTAGS, ...(TEMAS_HASHTAGS[tema] || [])])];

  // El #Shorts va EN el título: es lo que YouTube mira, y así el título ya sale
  // marcado aunque alguien pegue solo esa línea y se olvide de la descripción.
  const sitio = MAX_TITULO - MARCA_SHORT.length - 1;
  const titulo = `${recorta(bruto, sitio)} ${MARCA_SHORT}`;

  const idea = String(pieza?.comment || '').replace(/\s+/g, ' ').trim();
  const descripcion = [
    idea || bruto,
    '',
    'Generado por AdmiraNeXT a partir de una cápsula de conocimiento.',
    '',
    hashtags.join(' ')
  ].join('\n');

  return { titulo, descripcion, hashtags, tema, largoTitulo: titulo.length };
}
