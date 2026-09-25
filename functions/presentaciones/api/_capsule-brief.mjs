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

// Cabeceras de bloque del contrato de cápsula completa (PARA CARBONO / PARA
// SILICIO / APLICACIÓN) y la línea de fuente. Son rótulos, no contenido: si se
// cuelan, la voz del vídeo abre diciendo «Para carbono…» (#4398, 26-sep-2026).
const CABECERA = /^(?:para\s+carbono|para\s+silicio|aplicaci[oó]n|presentaci[oó]n)\s*:?\s*$/i;
const FUENTE = /^fuente\s*:/i;

/** El texto que se DICE: el bloque PARA CARBONO si la cápsula lo trae, sin rótulos. */
export function textoParaVoz(texto) {
  const lineas = String(texto || '').split(/\r?\n/);
  const bloques = [];
  let actual = null;
  for (const bruta of lineas) {
    const linea = bruta.replace(/^[#>\-*\s]+/, '').trim();
    if (CABECERA.test(linea)) { actual = { cabecera: linea.toLowerCase(), lineas: [] }; bloques.push(actual); continue; }
    if (!linea || FUENTE.test(linea)) continue;
    if (!actual) { actual = { cabecera: '', lineas: [] }; bloques.push(actual); }
    actual.lineas.push(linea);
  }
  // PARA CARBONO es la parte escrita para personas; SILICIO son instrucciones para
  // agentes y no se leen en voz alta en una cafetería.
  const carbono = bloques.find((b) => /carbono/.test(b.cabecera));
  const elegido = carbono || bloques.find((b) => b.lineas.length) || { lineas: [] };
  return elegido.lineas.join(' ').replace(/\s+/g, ' ').trim();
}

/** La frase que carga el sentido. Se elige, no se recorta: media frase no explica nada. */
export function ideaPrincipal(texto, maxPalabras = 40) {
  const limpio = textoParaVoz(texto);
  if (!limpio) return '';
  const frases = partirFrases(limpio).filter((f) => f.trim().length > 12);
  if (!frases.length) return recortaEnPausa(limpio, maxPalabras);
  // La primera frase larga suele ser la tesis; las cápsulas empiezan por el qué y
  // siguen con el porqué. Si no llega a 15 palabras, se le añade la siguiente
  // (solo si cabe entera): una frase de seis palabras deja el vídeo mudo.
  let elegida = frases[0];
  for (const siguiente of frases.slice(1)) {
    if (palabras(elegida) >= 15) break;
    if (palabras(elegida) + palabras(siguiente) > maxPalabras) break;
    elegida += ' ' + siguiente;
  }
  return palabras(elegida) > maxPalabras ? recortaEnPausa(elegida, maxPalabras) : elegida;
}

// Parte en frases sin romper abreviaturas: «el primer caza de EE. UU. en 143 días»
// es UNA frase. Se vuelve a pegar un trozo si el siguiente empieza en minúscula o
// cifra, o si los dos son siglas con punto (EE. UU.).
export function partirFrases(texto) {
  const out = [];
  for (const trozo of String(texto).split(/(?<=[.!?…])\s+/)) {
    const prev = out[out.length - 1];
    if (prev && (/^[a-záéíóúñü0-9(«"]/.test(trozo) || (/\b[A-ZÁÉÍÓÚ]{1,3}\.$/.test(prev) && /^[A-ZÁÉÍÓÚ]{1,3}\./.test(trozo)))) {
      out[out.length - 1] = prev + ' ' + trozo;
    } else out.push(trozo);
  }
  return out;
}

const palabras = (t) => String(t).trim().split(/\s+/).filter(Boolean).length;

// Si una sola frase no cabe, se corta en la última PAUSA (dos puntos, punto y
// coma, coma) que quepa, no a mitad de idea: «…cruza un umbral» se entiende,
// «…cruza un» no. Solo si no hay pausa útil se corta por palabras.
function recortaEnPausa(frase, maxPalabras) {
  const ws = frase.split(/\s+/);
  const dentro = ws.slice(0, maxPalabras);
  for (let i = dentro.length - 1; i >= Math.min(12, dentro.length - 1); i--) {
    if (/[:;,]$/.test(dentro[i])) return dentro.slice(0, i + 1).join(' ').replace(/[:;,]$/, '.');
  }
  return dentro.join(' ') + '…';
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
