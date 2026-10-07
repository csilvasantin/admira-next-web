// Snapshot de un proyecto de demos para anexarlo a su presentación, también desde API/MCP.
import {GLOBALES, PROYECTOS_INICIALES, RENOMBRADAS, guion} from './catalogo.mjs';
const slug = value => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const texto = (value, max) => String(value || '').trim().slice(0, max);
const validas = new Set(GLOBALES.flatMap(g => [g.id, ...g.subdemos.map(s => g.id + '/' + s.id)]));
const basicas = ['biz', 'store', 'studio', ...GLOBALES.find(g => g.id === 'studio').subdemos.map(s => 'studio/' + s.id)];
const alsea = {
  marca: 'starbucks', loc: 'alsea-sbux-021', project: 'starbucks', circuito: 'alsea_starbucks'
};
const propuestasAlsea = {
  'studio/voz': 'Locuciones para anunciar productos y promociones de Starbucks en el local piloto.',
  'studio/musica': 'Música para acompañar los momentos de consumo en la cafetería.',
  'studio/imagen': 'Creatividades de café y bollería para las pantallas del local.',
  'studio/video': 'Clips de producto para acompañar las campañas en tienda.',
  'studio/adaptar': 'Una misma campaña adaptada a las pantallas horizontales, verticales, cuadradas y de barra.',
  'store/tpv': 'Demostrar cómo la selección de un producto en el TPV puede activar contenidos en el gemelo de Starbucks.'
};

export function proyectoParaPresentacion(proyectos, {slug: id, displayName, marca} = {}) {
  const presentationId = slug(id || displayName);
  const explicit = (proyectos || []).filter(p => presentationId && presentationId === slug(p.presentation_id));
  // La vinculación expresa gana al nombre; dos vínculos siguen siendo ambiguos.
  if (explicit.length) return explicit.length === 1 ? explicit[0] : null;
  const candidates = [id, displayName, marca].map(slug).filter(Boolean);
  const matches = (proyectos || []).filter(p => candidates.some(c => c === slug(p.id) || c === slug(p.nombre)));
  // No elegir silenciosamente un proyecto si dos presentaciones comparten marca.
  return matches.length === 1 ? matches[0] : null;
}

export function normalizarDemoProject(raw, cliente = {}) {
  const name = texto(cliente.displayName, 120) || 'Cliente';
  const isAlsea = [cliente.slug, name].some(value => ['alsea', 'alsea-starbucks'].includes(slug(value))) && (!cliente.marca || ['alsea', 'starbucks'].includes(slug(cliente.marca)));
  const inicial = isAlsea ? PROYECTOS_INICIALES.find(p => p.id === 'alsea-starbucks') : null;
  const source = raw === undefined ? (inicial || {id: slug(cliente.slug || name), nombre: name, demos: basicas}) : raw;
  if (!source || typeof source !== 'object' || Array.isArray(source)) throw new Error('demoProject debe ser un proyecto de subdemos.');
  if (!Array.isArray(source.demos) || source.demos.length > 40 || source.demos.some(d => typeof d !== 'string')) throw new Error('demoProject.demos debe ser una lista de claves (máximo 40).');
  const demos = [...new Set(source.demos.map(d => RENOMBRADAS[d] || d))];
  if (demos.some(d => !validas.has(d))) throw new Error('demoProject contiene una demo desconocida.');
  const knownAlsea = source.id === 'alsea-starbucks';
  const inputContext = source.contexto ?? (knownAlsea ? alsea : {});
  if (!inputContext || typeof inputContext !== 'object' || Array.isArray(inputContext)) throw new Error('demoProject.contexto debe ser un objeto.');
  const contexto = {};
  for (const key of ['marca', 'loc', 'project', 'circuito']) {
    const value = String(inputContext[key] || '').trim();
    // El editor admite texto libre: omitirlo, nunca convertirlo en un id distinto.
    if (value && value.length <= 80 && /^[a-zA-Z0-9_-]+$/.test(value)) contexto[key] = value;
  }
  contexto.marca ||= slug(cliente.marca || cliente.slug || name);
  const inputProposals = source.propuestas ?? (knownAlsea ? propuestasAlsea : {});
  if (!inputProposals || typeof inputProposals !== 'object' || Array.isArray(inputProposals)) throw new Error('demoProject.propuestas debe ser un objeto.');
  const propuestas = {};
  for (const key of demos) {
    if (typeof inputProposals[key] === 'string') propuestas[key] = texto(inputProposals[key], 600);
  }
  return {version: 1, id: slug(source.id) || slug(cliente.slug || name), nombre: texto(source.nombre, 120) || name,
    nota: texto(source.nota, 400), demos, contexto, propuestas, documentacion: structuredClone(guion(demos))};
}

export function documentacionDemos(project, idioma = 'es', overrideMarca = '') {
  const {contexto} = project;
  const reemplazo = overrideMarca && overrideMarca !== contexto.marca;
  return (project.documentacion || guion(project.demos)).map(item => {
    const url = new URL(item.url);
    // El catálogo de Store es una demostración Starbucks; nunca heredar su local en otro cliente.
    for (const key of ['marca', 'loc', 'project', 'circuit', 'circuito']) url.searchParams.delete(key);
    url.searchParams.set('marca', overrideMarca || contexto.marca);
    url.searchParams.set('lang', ['es', 'ca', 'en'].includes(idioma) ? idioma : 'es');
    if (!reemplazo) for (const key of ['loc', 'project', 'circuito']) {
      if (contexto[key]) url.searchParams.set(key === 'circuito' ? 'circuit' : key, contexto[key]);
    }
    if (url.pathname.startsWith('/inventario/starbucks/')) url.pathname = url.pathname.replace('/inventario/starbucks/', '/inventario/' + encodeURIComponent(overrideMarca || contexto.marca) + '/');
    return {...item, url: url.href, propuesta: project.propuestas[item.clave] || item.desc};
  });
}
