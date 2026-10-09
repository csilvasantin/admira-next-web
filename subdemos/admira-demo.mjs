// Esquema admira.demo/2. Parte de las reglas de editor-catalogo.mjs
// (id estable, URL https, sin ejecutar pasos) y no admite JavaScript libre.
import { slugValido } from './nombres-demo.mjs';

export const ESQUEMA = 'admira.demo/2';
export const SITIOS = ['biz', 'store', 'studio', 'app', 'tv'];
export const OPS = ['navigate', 'say', 'point', 'click', 'open', 'close', 'fill', 'select', 'video', 'audio', 'wait', 'cli', 'check', 'native'];
const MODOS = ['recorrido', 'ensayo', 'video', 'muestra'];
const CAMPOS = {
  navigate: ['url', 'text', 'path'],
  say: ['text', 'path'],
  point: ['selector', 'text', 'path'],
  click: ['selector', 'text', 'path'],
  open: ['selector', 'text', 'path'],
  close: ['selector', 'text', 'path'],
  fill: ['selector', 'value', 'text', 'path'],
  select: ['selector', 'value', 'text', 'path'],
  video: ['url', 'text', 'path'],
  audio: ['url', 'text', 'path'],
  wait: ['seconds', 'text', 'path'],
  cli: ['command', 'text', 'path'],
  check: ['selector', 'expect', 'text', 'path'],
  native: ['id', 'text', 'path'],
};
const VERBOS = ['help', 'hoy', 'today', 'proyectos', 'projects', 'idioma', 'language', 'marcas', 'brands', 'roadmap', 'biz', 'store', 'studio', 'app', 'tv', 'editor', 'lista', 'list'];
const TITULOS = {
  biz: 'admira.biz',
  store: 'admira.store',
  studio: 'Admira Studio / Pixeria',
  app: 'admira.app',
  tv: 'admira.tv',
  'biz/proyecto': 'Register a project',
  'biz/circuito': 'Register a DooH circuit',
  'biz/gemelo': 'Register digital twins · Retail Media',
  'biz/iot': 'Register IoT devices',
  'biz/itil': 'Add to the technology inventory · ITIL',
  'store/voz': 'Voiceover management',
  'store/musica': 'Music management',
  'store/imagenes': 'Image management',
  'store/video': 'Video management',
  'store/tpv': 'POS management',
  'studio/voz': 'Create a voiceover',
  'studio/musica': 'Create music',
  'studio/imagen': 'Create an image',
  'studio/video': 'Create a video',
  'studio/adaptar': 'Adapt formats',
  'app/establecimientos': 'Locations',
  'app/inventario': 'Inventory',
  'app/incidencias': 'Incidents',
  'app/itil': 'ITIL',
};

const fallo = (mensaje) => { throw new Error(mensaje); };
const clon = (value) => JSON.parse(JSON.stringify(value));
const idOk = (value) => /^[a-z0-9-]{1,40}$/.test(value || '');

export function comandoPermitido(command) {
  const texto = String(command || '').trim();
  if (!texto.startsWith('/') || /[;&|`$<>(){}]/.test(texto) || /javascript:/i.test(texto) || /\n/.test(texto)) return false;
  if (texto === '/demo' || texto === '/help' || texto === '/idioma' || texto === '/language') return true;
  const partes = texto.split(/\s+/);
  if (partes.length === 2 && partes[0] === '/demos' && (partes[1] === 'editar' || partes[1] === 'edit')) return true;
  const slugSuelto = (valor) => /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(valor || '') && !['ayuda', 'editar', 'edit', 'pausa', 'pause', 'reanudar', 'resume', 'continuar', 'parar', 'stop', 'off', 'auto', 'todas', 'todos', 'all', 'estado', 'status', 'siguiente', 'next', 'sig', 'global', 'soluciones', 'solutions', 'pixeria', 'yokup', 'demos'].includes(valor);
  if (partes.length === 3 && partes[0] === '/demo' && slugSuelto(partes[1]) && slugSuelto(partes[2])) return true;
  if (partes.length !== 2 || partes[0] !== '/demo') return false;
  const arg = partes[1];
  if (VERBOS.includes(arg) || arg === 'ayuda' || /^[1-9]\d?$/.test(arg) || /^(biz|store|studio|app|tv)\/[a-z0-9-]{1,40}$/.test(arg)) return true;
  if (slugSuelto(arg)) return true;
  return /^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/.test(arg);
}

export { urlDePieza } from './macro-url.mjs';

function texto(value, etiqueta) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fallo(etiqueta + ': falta el texto en español y en inglés');
  if (Object.keys(value).some((key) => key !== 'es' && key !== 'en')) fallo(etiqueta + ': el texto solo tiene es y en');
  if (typeof value.es !== 'string' || typeof value.en !== 'string' || !value.es.trim() || !value.en.trim()) fallo(etiqueta + ': falta el texto en español y en inglés');
  if (value.es.length > 800 || value.en.length > 800) fallo(etiqueta + ': texto demasiado largo');
  sinCodigo(value.es);
  sinCodigo(value.en);
  return { es: value.es, en: value.en };
}

function httpsORuta(value, etiqueta) {
  if (typeof value !== 'string' || value.length > 2048) fallo(etiqueta + ': URL no válida');
  if (value.startsWith('/') && !value.startsWith('//')) return value;
  let url;
  try { url = new URL(value); } catch { fallo(etiqueta + ': URL https obligatoria'); }
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) fallo(etiqueta + ': URL https obligatoria');
  return value;
}

function selector(value, etiqueta) {
  if (typeof value !== 'string' || !value.trim() || value.length > 200 || /[<>]/.test(value) || /javascript:/i.test(value)) fallo(etiqueta + ': selector no válido');
  return value;
}

function sinCodigo(value) {
  if (typeof value === 'string' && /<script|javascript:|\beval\s*\(|\bfunction\s*\(/i.test(value)) fallo('El paso no puede llevar JavaScript');
}

function revisarLegacy(value, profundidad = 0) {
  if (profundidad > 10) fallo('El manifiesto clásico es demasiado profundo');
  if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) {
    if (typeof value === 'string') {
      sinCodigo(value);
      if (value.length > 4000) fallo('Texto clásico demasiado largo');
    }
    if (typeof value === 'number' && !Number.isFinite(value)) fallo('Número clásico no válido');
    return;
  }
  if (Array.isArray(value)) {
    if (value.length > 80) fallo('Lista clásica demasiado larga');
    value.forEach((item) => revisarLegacy(item, profundidad + 1));
    return;
  }
  if (!value || typeof value !== 'object') fallo('Manifiesto clásico no válido');
  const claves = Object.keys(value);
  if (claves.length > 40) fallo('Manifiesto clásico demasiado ancho');
  for (const clave of claves) {
    if (['__proto__', 'constructor', 'prototype', 'script', 'eval'].includes(clave)) fallo('Campo clásico no permitido: ' + clave);
    revisarLegacy(value[clave], profundidad + 1);
  }
}

export function validarPaso(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fallo('Paso no válido');
  const op = raw.op;
  if (!OPS.includes(op)) fallo('Paso no permitido: ' + op);
  const permitidos = new Set(['op', ...CAMPOS[op]]);
  if (Object.keys(raw).some((key) => !permitidos.has(key))) fallo('El paso ' + op + ' lleva un campo desconocido');
  const paso = { op };
  if (raw.text !== undefined) paso.text = texto(raw.text, op);
  if (raw.path !== undefined) paso.path = httpsORuta(raw.path, op);
  if (op === 'navigate') paso.url = httpsORuta(raw.url, op);
  if (op === 'point') {
    paso.text = texto(raw.text, op);
    if (raw.selector !== undefined) paso.selector = selector(raw.selector, op);
  }
  if (op === 'click' || op === 'open') paso.selector = selector(raw.selector, op);
  if (op === 'close' && raw.selector !== undefined) paso.selector = selector(raw.selector, op);
  if (op === 'fill' || op === 'select') {
    paso.selector = selector(raw.selector, op);
    if (typeof raw.value !== 'string' || raw.value.length > 500) fallo(op + ': valor no válido');
    sinCodigo(raw.value);
    paso.value = raw.value;
  }
  if (op === 'video' || op === 'audio') paso.url = httpsORuta(raw.url, op);
  if (op === 'wait') {
    if (typeof raw.seconds !== 'number' || !Number.isFinite(raw.seconds) || raw.seconds <= 0 || raw.seconds > 30) fallo('La espera es de 1 a 30 segundos');
    paso.seconds = raw.seconds;
  }
  if (op === 'cli') {
    if (!comandoPermitido(raw.command)) fallo('Comando no permitido');
    paso.command = String(raw.command).trim();
  }
  if (op === 'check' && raw.selector === undefined && raw.expect === undefined) fallo('La comprobación necesita un selector o un resultado');
  if (op === 'check' && raw.selector !== undefined) paso.selector = selector(raw.selector, op);
  if (op === 'check' && raw.expect !== undefined) {
    if (typeof raw.expect !== 'string' || !raw.expect.trim() || raw.expect.length > 200) fallo('Resultado de la comprobación no válido');
    sinCodigo(raw.expect);
    paso.expect = raw.expect;
  }
  if (op === 'native') {
    if (!idOk(raw.id)) fallo('El recorrido nativo cita un id no válido');
    paso.id = raw.id;
  }
  Object.values(paso).forEach(sinCodigo);
  return paso;
}

function validarSubdemo(raw, site) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fallo('Subdemo no válida');
  const claves = ['id', 'n', 'title', 'url', 'mode', 'steps', 'aliases', 'slug'];
  if (Object.keys(raw).some((key) => !claves.includes(key))) fallo('La subdemo lleva un campo desconocido');
  if (!idOk(raw.id)) fallo('ID: usa minúsculas, números y guiones (máximo 40)');
  if (!Number.isInteger(raw.n) || raw.n < 1 || raw.n > 40) fallo('El número de la subdemo no es válido');
  if (!MODOS.includes(raw.mode)) fallo('Modo de subdemo no válido');
  const sub = {
    id: raw.id,
    n: raw.n,
    title: texto(raw.title, raw.id),
    url: httpsORuta(raw.url, raw.id),
    mode: raw.mode,
    steps: Array.isArray(raw.steps) ? raw.steps.map(validarPaso) : fallo('La subdemo no tiene pasos'),
  };
  if (sub.steps.length > 80) fallo('Demasiados pasos');
  if (raw.aliases !== undefined) {
    if (!Array.isArray(raw.aliases) || raw.aliases.length > 20 || raw.aliases.some((alias) => typeof alias !== 'string' || !alias.trim() || alias.length > 80)) fallo('Aliases no válidos');
    sub.aliases = raw.aliases.map((alias) => alias.trim());
  }
  if (raw.slug !== undefined) {
    if (!slugValido(raw.slug)) fallo('Nombre de comando no válido');
    sub.slug = raw.slug;
  }
  if (new URL(sub.url).protocol !== 'https:') fallo(site + '/' + sub.id + ': la subdemo se abre por https');
  return sub;
}

export function validar(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fallo('Documento no válido');
  if (raw.schema !== ESQUEMA) fallo('El esquema tiene que ser admira.demo/2');
  if (raw.kind === 'macro') return validarMacro(raw);
  if (raw.kind !== 'demo') fallo('El documento es una demo o una macro');
  const claves = ['schema', 'kind', 'site', 'id', 'title', 'mode', 'version', 'status', 'subdemos', 'legacy'];
  if (Object.keys(raw).some((key) => !claves.includes(key))) fallo('La demo lleva un campo desconocido');
  if (!SITIOS.includes(raw.site) || !idOk(raw.id)) fallo('La demo pertenece a biz, store, studio, app o tv');
  if (!MODOS.includes(raw.mode)) fallo('Modo de demo no válido');
  if (!Number.isInteger(raw.version) || raw.version < 1) fallo('Versión de demo no válida');
  if (!['draft', 'published', 'deleted'].includes(raw.status)) fallo('Estado de demo no válido');
  if (!Array.isArray(raw.subdemos) || raw.subdemos.length < 1 || raw.subdemos.length > 40) fallo('La demo no tiene subdemos');
  const subdemos = raw.subdemos.map((sub) => validarSubdemo(sub, raw.site));
  if (new Set(subdemos.map((sub) => sub.id)).size !== subdemos.length) fallo('IDs repetidos');
  if (new Set(subdemos.map((sub) => sub.n)).size !== subdemos.length) fallo('Números repetidos');
  const demo = {
    schema: ESQUEMA,
    kind: 'demo',
    site: raw.site,
    id: raw.id,
    title: texto(raw.title, raw.id),
    mode: raw.mode,
    version: raw.version,
    status: raw.status,
    subdemos,
  };
  if (raw.legacy !== undefined) {
    if (!raw.legacy || typeof raw.legacy !== 'object' || !raw.legacy.manifest) fallo('El legado no guarda el manifiesto');
    revisarLegacy(raw.legacy.manifest);
    if (raw.legacy.manifest.plataforma !== raw.site) fallo('El manifiesto clásico es de otro sitio');
    demo.legacy = { manifest: clon(raw.legacy.manifest) };
  }
  if (JSON.stringify(demo).length > 500000) fallo('Demo demasiado grande');
  return demo;
}

function validarMacro(raw) {
  const claves = ['schema', 'kind', 'id', 'title', 'context', 'transition', 'items', 'status', 'version', 'slug', 'aliases'];
  if (Object.keys(raw).some((key) => !claves.includes(key))) fallo('La macro lleva un campo desconocido');
  if (!idOk(raw.id)) fallo('ID de macro no válido');
  if (!['draft', 'published', 'deleted'].includes(raw.status)) fallo('La macro está en borrador o publicada');
  if (!Number.isInteger(raw.version) || raw.version < 1) fallo('Versión de macro no válida');
  const context = raw.context;
  if (!context || typeof context !== 'object' || ['marca', 'project', 'circuit'].some((key) => typeof context[key] !== 'string' || context[key].length > 80)) fallo('Contexto de macro no válido');
  if (!['es', 'en'].includes(context.lang) || Object.keys(context).some((key) => !['marca', 'project', 'circuit', 'lang'].includes(key))) fallo('Contexto de macro no válido');
  const transition = raw.transition;
  if (!transition || typeof transition.card !== 'string' || transition.card.length > 120) fallo('La transición necesita una cartela');
  if (typeof transition.seconds !== 'number' || transition.seconds < 0 || transition.seconds > 30) fallo('La transición dura entre 0 y 30 segundos');
  if (Object.keys(transition).some((key) => !['card', 'seconds'].includes(key))) fallo('Transición no válida');
  if (!Array.isArray(raw.items) || raw.items.length < 1 || raw.items.length > 40) fallo('La macro no tiene piezas');
  const items = raw.items.map((item) => {
    if (!item || Object.keys(item).some((key) => key !== 'ref') || !/^(biz|store|studio|app|tv)\/[a-z0-9-]{1,40}$/.test(item.ref || '')) fallo('La pieza cita sitio/subdemo');
    return { ref: item.ref };
  });
  const macro = {
    schema: ESQUEMA,
    kind: 'macro',
    id: raw.id,
    title: texto(raw.title, raw.id),
    context: { marca: context.marca, project: context.project, circuit: context.circuit, lang: context.lang },
    transition: { card: transition.card, seconds: transition.seconds },
    items,
    status: raw.status,
    version: raw.version,
  };
  if (raw.slug !== undefined) {
    if (!slugValido(raw.slug)) fallo('Nombre de comando no válido');
    macro.slug = raw.slug;
  }
  if (raw.aliases !== undefined) {
    if (!Array.isArray(raw.aliases) || raw.aliases.length > 20) fallo('Aliases no válidos');
    const aliases = raw.aliases.map((alias) => String(alias || '').trim().toLowerCase());
    if (aliases.some((alias) => !slugValido(alias)) || new Set(aliases).size !== aliases.length) fallo('Aliases no válidos');
    if (macro.slug && aliases.includes(macro.slug)) fallo('El alias repite el nombre');
    macro.aliases = aliases;
  }
  return macro;
}

function guionAPaso(fila) {
  const text = { es: String(fila.texto || ''), en: String(fila.texto || '') };
  if (fila.accion === 'di') return validarPaso({ op: 'say', text });
  if (fila.accion === 'señala') return validarPaso({ op: 'point', text });
  fallo('Acción de guion no migrada: ' + fila.accion);
}

function numeroDeLetra(letra) {
  if (typeof letra !== 'string' || letra.length !== 1) return 0;
  const n = letra.toLowerCase().charCodeAt(0) - 96;
  return n >= 1 && n <= 26 ? n : 0;
}

export function aEsquema(manifiesto, recorrido = {}) {
  revisarLegacy(manifiesto);
  if (manifiesto.version !== 1 || !SITIOS.includes(manifiesto.plataforma) || !Array.isArray(manifiesto.subdemos)) fallo('Manifiesto clásico no válido');
  const site = manifiesto.plataforma;
  const demo = {
    schema: ESQUEMA,
    kind: 'demo',
    site,
    id: site,
    title: { es: manifiesto.nombre, en: TITULOS[site] || manifiesto.nombre },
    mode: manifiesto.default_mode || 'recorrido',
    version: 1,
    status: 'published',
    subdemos: manifiesto.subdemos.map((sub, index) => {
      const nativos = recorrido[sub.id];
      const steps = Array.isArray(nativos) && nativos.length ? nativos : (sub.guion || []).map(guionAPaso);
      return {
        id: sub.id,
        n: numeroDeLetra(sub.letra) || index + 1,
        title: { es: sub.nombre, en: TITULOS[site + '/' + sub.id] || sub.nombre },
        url: sub.url,
        mode: manifiesto.default_mode || 'recorrido',
        aliases: sub.aliases || [],
        steps,
      };
    }),
    legacy: { manifest: clon(manifiesto) },
  };
  return validar(demo);
}

export function aJsonActual(demo) {
  const doc = validar(demo);
  if (!doc.legacy?.manifest) fallo('Esta demo no guarda el JSON clásico');
  return clon(doc.legacy.manifest);
}

export function resolverMacro(macro, demos) {
  const doc = validar(macro);
  return {
    ...doc,
    items: doc.items.map((item) => {
      const [site, id] = item.ref.split('/');
      const candidatos = demos
        .filter((entrada) => entrada.kind === 'demo' && entrada.status === 'published' && entrada.site === site)
        .sort((a, b) => (a.id === a.site ? 0 : 1) - (b.id === b.site ? 0 : 1));
      let subdemo = null;
      for (const demo of candidatos) {
        subdemo = demo.subdemos.find((sub) => sub.id === id) || null;
        if (subdemo) break;
      }
      return { ref: item.ref, subdemo };
    }),
  };
}
