/**
 * Estructura AdmiraNeXT — 45 minutos en tres actos de 15
 * (admira.studio · admira.store · admira.app), cada uno con portada + capítulos a/b/c
 * de 5 minutos. Encargo #4295 / referencia Lucas FLT-100996.
 */

export const ADMIRANEXT_STRUCTURE_ID = 'admiranext';
export const ADMIRANEXT_ACTS = [
  { id: 'studio', product: 'admira.studio', label: 'Crear', minutes: 15 },
  { id: 'store', product: 'admira.store', label: 'Activar el espacio', minutes: 15 },
  { id: 'app', product: 'admira.app', label: 'Medir y decidir', minutes: 15 }
];
export const ADMIRANEXT_CHAPTERS = ['a', 'b', 'c'];
export const CHAPTER_MINUTES = 5;
/** El brief del cliente no se corta a 1.200: límite operativo amplio. */
export const BRIEF_MAX = 50000;
export const TITLE_MAX = 220;
export const MESSAGE_MAX = 4000;
export const PROMISE_MAX = 2000;

function clean(value, max) {
  return String(value == null ? '' : value).replace(/\r\n?/g, '\n').trim().slice(0, max);
}

function slugCode(value) {
  return clean(value, 80)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 63);
}

function durationMinutes(value, fallback = CHAPTER_MINUTES) {
  if (value == null || value === '') return fallback;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw new Error(`duración no válida: ${value}`);
  return n;
}

/** Plantilla canónica: 3 portadas + 9 capítulos (a/b/c × 3 actos). */
export function admiranextBlueprint(displayName = 'el cliente') {
  const name = clean(displayName, 100) || 'el cliente';
  const slides = [];
  for (const act of ADMIRANEXT_ACTS) {
    slides.push({
      code: `${act.id}-cover`,
      title: `Acto · ${act.product}`,
      message: `${act.label}: cómo ${name} trabaja con ${act.product}.`,
      duration: 0,
      promise: `Abrir el acto ${act.product} con una promesa concreta.`,
      act: act.id,
      role: 'cover',
      chapter: null,
      product: act.product
    });
    for (const chapter of ADMIRANEXT_CHAPTERS) {
      const titles = {
        a: { studio: 'El brief que importa', store: 'El xpacio que responde', app: 'La señal que decide' },
        b: { studio: 'Crear sin perder el control', store: 'Activar en el punto correcto', app: 'Medir lo que el negocio siente' },
        c: { studio: 'La primera pieza lista', store: 'El recorrido en vivo', app: 'El siguiente ciclo' }
      };
      const messages = {
        a: {
          studio: `Definir con ${name} el problema creativo que Pixeria / admira.studio debe resolver.`,
          store: `Anclar la experiencia física de ${name} en un xpacio medible (XpaceOS / admira.store).`,
          app: `Conectar exposición y resultado para que ${name} decida con evidencia (admira.app).`
        },
        b: {
          studio: `Producir variantes gobernadas: marca, formato, canal y aprobación en un solo flujo.`,
          store: `Programar, emitir y adaptar el contenido al momento y al punto de ${name}.`,
          app: `Leer comportamiento y resultado en el circuito, no en un informe a posteriori.`
        },
        c: {
          studio: `Cerrar el acto con una pieza concreta lista para activar.`,
          store: `Cerrar el acto con un recorrido que se pueda ensayar en sala.`,
          app: `Cerrar el acto con la métrica y la decisión del próximo ciclo.`
        }
      };
      slides.push({
        code: `${act.id}-${chapter}`,
        title: titles[chapter][act.id],
        message: messages[chapter][act.id],
        duration: CHAPTER_MINUTES,
        promise: `Capítulo ${chapter.toUpperCase()} del acto ${act.product}: 5 minutos.`,
        act: act.id,
        role: 'chapter',
        chapter,
        product: act.product
      });
    }
  }
  return slides;
}

/**
 * Normaliza `slides` o `structure:"admiranext"`.
 * Cada lámina: code, title, message, duration, promise, act (+ opcionales role/chapter/product).
 */
export function normalizeStructureInput(raw = {}) {
  const structure = clean(raw.structure, 40).toLowerCase();
  const hasSlides = Array.isArray(raw.slides);
  if (!structure && !hasSlides) return null;
  if (structure && structure !== ADMIRANEXT_STRUCTURE_ID) {
    throw new Error(`structure desconocida: «${structure}». Usa "admiranext" o pasa slides[].`);
  }
  if (hasSlides && raw.slides.length === 0) throw new Error('slides[] no puede estar vacío.');

  if (!hasSlides && structure !== ADMIRANEXT_STRUCTURE_ID) {
    throw new Error('Indica structure:"admiranext" o un array slides[].');
  }
  const blueprint = admiranextBlueprint(raw.displayName);
  const source = hasSlides ? raw.slides : blueprint;

  const seen = new Set();
  const slides = source.map((row, index) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      throw new Error(`slides[${index}] debe ser un objeto.`);
    }
    const allowed = new Set(['code', 'title', 'message', 'duration', 'promise', 'act', 'role', 'chapter', 'product', 'detail', 'minutes', 'seconds', 'id']);
    const unknown = Object.keys(row).filter((key) => !allowed.has(key));
    if (unknown.length) throw new Error(`slides[${index}] campos desconocidos: ${unknown.join(', ')}.`);

    const fallback = blueprint[index] || blueprint[blueprint.length - 1];
    const code = slugCode(row.code || row.id || fallback?.code || `slide-${index + 1}`);
    if (!code) throw new Error(`slides[${index}]: code obligatorio.`);
    if (seen.has(code)) throw new Error(`slides: code duplicado «${code}».`);
    seen.add(code);

    const act = clean(row.act || fallback?.act, 40).toLowerCase();
    if (!ADMIRANEXT_ACTS.some((item) => item.id === act)) {
      throw new Error(`slides[${index}]: act debe ser studio|store|app (recibido «${act || ''}»).`);
    }
    const duration = durationMinutes(row.duration ?? row.minutes ?? fallback?.duration, CHAPTER_MINUTES);
    const role = clean(row.role || (String(code).endsWith('-cover') || String(code).includes('portada') ? 'cover' : 'chapter'), 20) || 'chapter';
    return {
      code,
      title: clean(row.title || fallback?.title, TITLE_MAX) || code,
      message: clean(row.message || fallback?.message, MESSAGE_MAX) || '',
      detail: clean(row.detail || row.promise || fallback?.promise, PROMISE_MAX) || '',
      promise: clean(row.promise || row.detail || fallback?.promise, PROMISE_MAX) || '',
      duration,
      minutes: duration,
      act,
      role,
      chapter: clean(row.chapter || fallback?.chapter, 8) || null,
      product: clean(row.product || fallback?.product, 80) || ''
    };
  });

  if (structure === ADMIRANEXT_STRUCTURE_ID || (!hasSlides && structure === ADMIRANEXT_STRUCTURE_ID)) {
    // Con structure:"admiranext" exigimos exactamente 12 láminas (3×(portada+a+b+c)).
    if (!hasSlides && slides.length !== 12) {
      throw new Error(`structure admiranext debe producir 12 láminas (3 portadas + 9 capítulos); hay ${slides.length}.`);
    }
    if (hasSlides) {
      const expected = admiranextBlueprint().map((item) => item.code);
      if (slides.length !== expected.length) {
        throw new Error(`structure admiranext exige ${expected.length} láminas en orden; recibidas ${slides.length}.`);
      }
      slides.forEach((slide, index) => {
        if (slide.code !== expected[index]) {
          throw new Error(`structure admiranext: en posición ${index + 1} se esperaba code «${expected[index]}», llegó «${slide.code}».`);
        }
      });
    }
  }

  return { id: ADMIRANEXT_STRUCTURE_ID, slides };
}

/** Convierte la estructura normalizada en el esqueleto del generador. */
export function skeletonFromStructure(structure, displayName) {
  const name = clean(displayName, 100) || 'Cliente';
  return structure.slides.map((slide) => ({
    id: slide.code,
    title: slide.title,
    message: slide.message,
    detail: slide.promise || slide.detail || '',
    enabled: true,
    minutes: slide.duration,
    act: slide.act,
    role: slide.role,
    chapter: slide.chapter,
    product: slide.product,
    promise: slide.promise
  })).concat([]); // copy
}

export function structureIdeasSeed(structure, input, slug, languages) {
  const name = input.displayName || 'Cliente';
  const problem = input.problem || `Recorrido AdmiraNeXT de 45 minutos con ${name}.`;
  const audience = input.audience || 'Dirección de negocio, operaciones, marketing e innovación';
  return {
    schemaVersion: 2,
    client: slug,
    displayName: name,
    languages,
    translations: {},
    embeds: [],
    inspiration: input.inspiration || null,
    brand: input.brand || null,
    hero: {
      eyebrow: `Estructura AdmiraNeXT · ${name}`,
      title: input.title || `${name}: tres actos, 45 minutos.`,
      summary: input.summary || `admira.studio → admira.store → admira.app. ${problem}`
    },
    objective: input.objective || `Recorrer con ${audience} los tres actos AdmiraNeXT y acordar el primer piloto.`,
    skeleton: skeletonFromStructure(structure, name),
    closing: {
      title: input.closingTitle || `Elijamos el primer acto con ${name}.`,
      action: input.closingAction || 'Fijar acto piloto, responsables, señales disponibles y tres métricas de éxito.'
    },
    labels: { objective: 'El objetivo', next: 'Siguiente paso' },
    narrativeSource: 'admiranext-structure',
    structure: structure.id,
    notes: `Estructura AdmiraNeXT forzada (${structure.slides.length} láminas). Validar identidad y lenguaje antes de compartir. Web: ${input.website || ''}.`,
    updatedAt: new Date().toISOString()
  };
}

export function normalizeFooter(value) {
  if (value == null || value === false) return null;
  if (value === true) return { text: 'ADmiraNeXT', showSlideNumber: true, showBrand: true };
  if (typeof value === 'string') {
    const text = clean(value, 200);
    return text ? { text, showSlideNumber: true, showBrand: true } : null;
  }
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('footer debe ser string, objeto {text, showSlideNumber, showBrand} o false.');
  }
  const allowed = new Set(['text', 'showSlideNumber', 'showBrand', 'enabled']);
  const unknown = Object.keys(value).filter((key) => !allowed.has(key));
  if (unknown.length) throw new Error(`footer campos desconocidos: ${unknown.join(', ')}.`);
  if (value.enabled === false) return null;
  const text = clean(value.text, 200);
  return {
    text: text || 'ADmiraNeXT',
    showSlideNumber: value.showSlideNumber !== false,
    showBrand: value.showBrand !== false
  };
}
