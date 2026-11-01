export const FORMAT = 'admiranext-ainimation-presentation';
export const MAX_BYTES = 200000;

function text(value, limit, required = false) {
  if (typeof value !== 'string' || value.length > limit || (required && !value.trim())) {
    throw Error('El texto de la presentación no es compatible. No se ha recortado ni importado.');
  }
  return value;
}

// A projection, never a clone of the generator record: credentials, notes and briefs stay out.
export function validatePresentation(input) {
  if (!input || JSON.stringify(input).length > MAX_BYTES || input.format !== FORMAT || input.version !== 1) {
    throw Error('Necesitas un paquete de presentación AdmiraNeXT × AINimation (v1).');
  }
  if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(input.source?.id || '') ||
      !['es', 'ca', 'en'].includes(input.source?.language) ||
      !Array.isArray(input.slides) || input.slides.length < 2 || input.slides.length > 30) {
    throw Error('Revisa el origen, el idioma y las escenas de la presentación.');
  }
  const ids = new Set();
  const slides = input.slides.map(slide => {
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(slide.id || '') || ids.has(slide.id)) throw Error('Cada escena necesita una identidad única.');
    ids.add(slide.id);
    return {id: slide.id, title: text(slide.title, 220, true), message: text(slide.message, 1200),
      detail: text(slide.detail, 2000), chapter: text(slide.chapter, 120)};
  });
  return {format: FORMAT, version: 1, title: text(input.title, 220, true),
    source: {id: input.source.id, language: input.source.language, revision: text(input.source.revision, 100)}, slides};
}

export function trustedGeneratorOrigin(origin) {
  if (['https://www.admiranext.com', 'https://admiranext.com'].includes(origin)) return true;
  try { const u = new URL(origin); return u.origin === origin && u.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(u.hostname); } catch { return false; }
}

export function acceptsMessage(event, {origin, source, channel}) {
  return trustedGeneratorOrigin(origin) && event.origin === origin && event.source === source &&
    typeof channel === 'string' && /^[a-f0-9-]{36}$/.test(channel) && event.data?.channel === channel &&
    event.data?.type === 'admiranext:presentation:load';
}

export const demo = {
  format: FORMAT, version: 1, title: 'De una idea a una experiencia',
  source: {id: 'demo-ainimation', language: 'es', revision: 'demo-v1'},
  slides: [
    {id:'cover', chapter:'AINimation × AdmiraNeXT', title:'Las ideas se convierten en experiencias.', message:'Una presentación que puedes recorrer, explorar y dirigir.', detail:'Demo de diseño con contenido ficticio. Abre el mapa y elige por dónde empezar.'},
    {id:'story', chapter:'01 / El relato', title:'Tú decides por dónde seguir.', message:'Cada escena tiene una intención. Cada recorrido responde a una conversación.', detail:'Abre el mapa de escenas para saltar a cualquier parte. Usa las flechas del teclado para avanzar y volver.'},
    {id:'depth', chapter:'02 / La profundidad', title:'Deja espacio para descubrir.', message:'Primero, la idea principal. Después, los detalles que merece la pena explorar.', detail:'El botón Explorar abre una segunda capa de lectura. Aquí cabe el desarrollo completo del guion, sin sobrecargar el primer vistazo.'},
    {id:'motion', chapter:'03 / El movimiento', title:'Dale ritmo a lo que cuentas.', message:'Entradas suaves, una composición que respira y el control en tus manos.', detail:'Puedes detener el movimiento. Si prefieres reducir las animaciones en tu dispositivo, la presentación respeta esa preferencia.'},
    {id:'closing', chapter:'El siguiente paso', title:'Del generador al escenario.', message:'Construye el relato en AdmiraNeXT. Afina sus escenas y comportamientos en Director.', detail:'Esta primera conexión importa una copia del contenido. Los cambios en Director se guardan como película y no actualizan la presentación original.'}
  ]
};
