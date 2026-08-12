/* De una CÁPSULA DE CONOCIMIENTO a un TikTok de 15 segundos.
 * ----------------------------------------------------------------------------
 * Una cápsula es texto: lo que alguien aprendió, guardado en el Stock con
 * type capsula|guion y el contenido en `comment` (no llevan fichero — su texto ES
 * la pieza). Hoy nacen y se quedan ahí: se leen, no se ven. Esto las convierte en
 * una pieza vertical de 15 s que las explica.
 *
 * Quince segundos son unas 40 palabras dichas en voz alta. No cabe la cápsula: hay
 * que quedarse con UNA idea. Por eso esto no resume — elige.
 *
 * El TEMA manda en el tono, y sale de las etiquetas que la cápsula ya trae
 * (tech, business, creativity). No se inventa una taxonomía nueva para esto.
 */

export const TEMAS = {
  tech: {
    etiqueta: 'tech',
    titulo: 'Tecnología',
    // El tono NO es decoración: es lo que hace que un vídeo de negocio no parezca
    // uno de tecnología. Va literal al prompt del motor.
    tono: 'preciso y sobrio, con la calma de quien explica algo que domina',
    plano: 'planos cerrados de materia y mecanismo, luz fría, sin caras',
    cierre: 'Así funciona.'
  },
  creativity: {
    etiqueta: 'creativity',
    titulo: 'Creatividad',
    tono: 'vivo y con juego, como quien enseña un truco que acaba de descubrir',
    plano: 'gesto y textura, color saturado, movimiento a mano',
    cierre: 'Pruébalo.'
  },
  business: {
    etiqueta: 'business',
    titulo: 'Negocio',
    tono: 'directo y con consecuencia, hablando de lo que cuesta y de lo que gana',
    plano: 'espacios de trabajo reales, luz natural, ritmo firme',
    cierre: 'Ahí está el negocio.'
  }
};

// Sinónimos que ya usan las cápsulas del Stock. Sin esto, «negocio» no encontraría
// su tema y todo caería en el genérico.
const ALIAS = {
  tech: ['tech', 'tecnologia', 'tecnología', 'technology', 'ia', 'ai', 'software', 'producto'],
  creativity: ['creativity', 'creatividad', 'creative', 'diseno', 'diseño', 'design', 'arte'],
  business: ['business', 'negocio', 'negocios', 'empresa', 'ventas', 'estrategia', 'liderazgo']
};

const sinAcentos = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Tema de una cápsula a partir de sus etiquetas. `null` si no lo dice ninguna. */
export function temaDeCapsula(capsula) {
  const etiquetas = (Array.isArray(capsula?.tags) ? capsula.tags : []).map(sinAcentos);
  for (const [clave, alias] of Object.entries(ALIAS)) {
    if (etiquetas.some((e) => alias.includes(e))) return clave;
  }
  return null;
}

/** La frase que carga el sentido. Se elige, no se recorta: media frase no explica nada. */
export function ideaPrincipal(texto, maxPalabras = 40) {
  const limpio = String(texto || '')
    .replace(/\s+/g, ' ')
    .replace(/^[#>\-*\s]+/, '')
    .trim();
  if (!limpio) return '';
  const frases = limpio.split(/(?<=[.!?])\s+/).filter((f) => f.trim().length > 12);
  if (!frases.length) return limpio.split(/\s+/).slice(0, maxPalabras).join(' ');
  // La primera frase larga suele ser la tesis; las cápsulas empiezan por el qué y
  // siguen con el porqué. Si no llega a 15 palabras, se le añade la siguiente:
  // una frase de seis palabras deja el vídeo mudo.
  let elegida = frases[0];
  if (elegida.split(/\s+/).length < 15 && frases[1]) elegida += ' ' + frases[1];
  const palabras = elegida.split(/\s+/);
  return palabras.length > maxPalabras ? palabras.slice(0, maxPalabras).join(' ') + '…' : elegida;
}

/**
 * Prompt para el motor de vídeo. Devuelve `null` si la cápsula no da para un
 * vídeo — sin texto no hay nada que explicar, y es mejor no generar que generar
 * quince segundos de relleno que alguien tendrá que revisar y tirar.
 */
export function briefDesdeCapsula(capsula) {
  const texto = String(capsula?.comment || capsula?.prompt || '').trim();
  const idea = ideaPrincipal(texto);
  if (idea.length < 40) return null;

  const clave = temaDeCapsula(capsula) || 'tech';
  const tema = TEMAS[clave];
  const titulo = String(capsula?.title || '').trim().slice(0, 120);

  const prompt = [
    `Vídeo vertical 9:16 de 15 segundos que explica UNA idea de ${tema.titulo.toLowerCase()}.`,
    `La idea, dicha tal cual: «${idea}»`,
    titulo ? `Título de la pieza: ${titulo}.` : '',
    `Tono: ${tema.tono}.`,
    `Imagen: ${tema.plano}.`,
    'Sin texto sobreimpreso, sin logotipos y sin caras reconocibles.',
    `Cierra con la sensación de: ${tema.cierre}`
  ].filter(Boolean).join(' ');

  return {
    tema: clave,
    titulo: titulo || `${tema.titulo} en 15 segundos`,
    idea,
    prompt,
    // Etiquetas de EMISIÓN: 'vertical' es la llave con la que el MUPI emite en
    // 9:16 nativo en vez de recortar, igual que en el paquete de TikTok.
    tags: ['capsula', 'vertical', '15s', tema.etiqueta]
  };
}
