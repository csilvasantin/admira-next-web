/*
 * URLs externas embebidas en una presentación (Neo · MBP14, 02-09-2026).
 *
 * Carlos: «tenemos que poder añadir en el generador urls externas como podrían ser
 * nuestras soluciones, en este caso XpaceOS y un par más, embebidas». Es la máxima de
 * la casa —Xperiences, no powerpoints: la demo se enseña viva, no en captura—.
 *
 * Decisiones que van aquí y no en el render, para que sean una sola:
 *  · Sólo https. Un iframe http dentro de una página https lo bloquea el navegador y el
 *    cliente ve un hueco negro sin explicación.
 *  · Como mucho CINCO. No es un límite estético: cada embebido es una web entera
 *    cargándose dentro del deck, y una presentación no es un navegador de pestañas.
 *  · El título es neutro (el nombre del producto), no se traduce: «XpaceOS» es XpaceOS
 *    en las dos lenguas, y una etiqueta a medio traducir se nota más que ninguna.
 *  · Se guarda el host aparte para poder enseñarlo bajo el marco: quien mira una demo
 *    embebida tiene derecho a saber de dónde sale.
 */
const MAX_EMBEDS = 5;

function texto(valor, max){
  return String(valor == null ? '' : valor).replace(/[\r\n]+/g, ' ').trim().slice(0, max);
}

export function normalizeEmbeds(valor){
  // El formulario del generador manda un textarea, es decir, una cadena con una URL por
  // linea; el API y el editor de ideas mandan un array. Se aceptan las dos formas aqui y
  // no en cada llamador, que es como se acaba con tres validaciones distintas.
  if (typeof valor === 'string') return embedsDesdeTexto(valor);
  const lista = Array.isArray(valor) ? valor : [];
  const vistos = new Set();
  const salida = [];
  for (const bruto of lista) {
    if (salida.length >= MAX_EMBEDS) break;
    const entrada = typeof bruto === 'string' ? {url: bruto} : (bruto || {});
    const url = texto(entrada.url, 500);
    if (!/^https:\/\/[^\s]+$/i.test(url)) continue;   // sólo https, y sin espacios
    let anfitrion = '';
    try { anfitrion = new URL(url).host; } catch (_) { continue; }
    if (vistos.has(url)) continue;                    // el mismo sitio dos veces no aporta
    vistos.add(url);
    salida.push({
      id: texto(entrada.id, 60).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
        || `embed-${salida.length + 1}`,
      url,
      host: anfitrion,
      title: texto(entrada.title, 120) || anfitrion.replace(/^www\./, ''),
      note: texto(entrada.note, 240)
    });
  }
  return salida;
}

export function embedsDesdeTexto(valor){
  // El formulario los pide pegados, uno por línea: «https://url  Título opcional».
  return normalizeEmbeds(String(valor || '').split(/\n+/).map(linea => {
    const limpio = linea.trim();
    if (!limpio) return null;
    const corte = limpio.search(/\s/);
    return corte < 0 ? {url: limpio} : {url: limpio.slice(0, corte), title: limpio.slice(corte + 1)};
  }).filter(Boolean));
}

export const MAX_EMBEDS_POR_PRESENTACION = MAX_EMBEDS;
