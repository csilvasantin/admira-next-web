// Nombres de comando de las demos (encargo 5476). Sin red y sin DOM.
export const RESERVADOS = [
  'hoy', 'today', 'editor', 'editar', 'edit', 'list', 'lista', 'help', 'ayuda',
  'proyectos', 'projects', 'marcas', 'brands', 'roadmap', 'idioma', 'language',
  'global', 'auto', 'todas', 'todos', 'all', 'pausa', 'pause', 'reanudar', 'resume',
  'continuar', 'parar', 'stop', 'off', 'estado', 'status', 'siguiente', 'next', 'sig',
  'soluciones', 'solutions', 'studio', 'store', 'tv', 'app', 'biz', 'pixeria', 'yokup', 'demos',
];

export const ORIGENES_DEMO = [
  'https://www.admiranext.com', 'https://admiranext.com',
  'https://www.admira.live', 'https://admira.live',
  'https://www.admira.biz', 'https://admira.biz',
  'https://www.admira.app', 'https://admira.app',
  'https://www.yokup.com', 'https://yokup.com',
  'https://www.admira.store', 'https://admira.store',
  'https://www.xpaceos.com', 'https://xpaceos.com',
  'https://www.admira.studio', 'https://admira.studio',
  'https://www.pixeria.com', 'https://pixeria.com',
  'https://www.admira.tv', 'https://admira.tv',
  'https://www.clearchannel.tv', 'https://clearchannel.tv',
];

const SLUG = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

export function reservado(nombre) {
  return RESERVADOS.includes(String(nombre || '').toLowerCase());
}

export function aSlug(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
}

export function slugValido(nombre) {
  const texto = String(nombre || '');
  return texto.length >= 1 && texto.length <= 40 && SLUG.test(texto) && !reservado(texto);
}

export function comandoDe(doc) {
  if (!doc) return '';
  return doc.slug || doc.id || '';
}

function normal(texto) {
  return String(texto || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function renombrarComando(doc, nuevo) {
  const nombre = aSlug(nuevo);
  if (!slugValido(nombre)) return { ok: false, error: 'reservado' };
  const actual = normal(doc.slug || doc.id || '');
  if (nombre === actual) return { ok: true, doc };
  const aliases = (Array.isArray(doc.aliases) ? doc.aliases : [])
    .map((alias) => normal(alias))
    .filter((alias) => alias && alias !== nombre && alias !== actual);
  if (actual && slugValido(actual)) aliases.push(actual);
  return { ok: true, doc: { ...doc, slug: nombre, aliases } };
}

function propios(doc) {
  const lista = [];
  if (doc.kind === 'macro') {
    lista.push(doc.slug || doc.id);
    for (const alias of doc.aliases || []) lista.push(alias);
  } else {
    for (const sub of doc.subdemos || []) {
      if (sub.slug && normal(sub.slug) !== normal(sub.id)) lista.push(sub.slug);
    }
  }
  return lista.map(normal).filter(slugValido);
}

export function choque(docs, doc) {
  const ocupados = new Set();
  for (const otro of docs || []) {
    if (!otro || otro.id === doc.id || otro.status === 'deleted') continue;
    if (otro.kind === 'macro') {
      ocupados.add(normal(otro.slug || otro.id));
      for (const alias of otro.aliases || []) ocupados.add(normal(alias));
    }
    if (otro.kind === 'demo') {
      for (const sub of otro.subdemos || []) {
        ocupados.add(normal(sub.id));
        if (sub.slug) ocupados.add(normal(sub.slug));
        for (const alias of sub.aliases || []) ocupados.add(normal(alias));
      }
    }
  }
  for (const nombre of propios(doc)) {
    if (reservado(nombre) || ocupados.has(nombre)) return nombre;
  }
  return '';
}

function nombresMacro(macro) {
  return [macro.slug, macro.id, ...(macro.aliases || [])].map(normal).filter(Boolean);
}

function nombresSub(sub, ref) {
  const cola = String(ref || '').split('/')[1] || '';
  return [cola, sub && sub.slug, sub && sub.id, ...((sub && sub.aliases) || [])].map(normal).filter(Boolean);
}

function subDe(demos, ref) {
  const [site, id] = String(ref || '').split('/');
  const candidatos = demos
    .filter((demo) => demo.site === site)
    .sort((a, b) => (a.id === a.site ? 0 : 1) - (b.id === b.site ? 0 : 1));
  for (const demo of candidatos) {
    const sub = (demo.subdemos || []).find((item) => item.id === id);
    if (sub) return sub;
  }
  return null;
}

function indicePieza(macro, demos, nombre) {
  const items = macro.items || [];
  for (let index = 0; index < items.length; index += 1) {
    if (nombresSub(subDe(demos, items[index].ref), items[index].ref).includes(nombre)) return index;
  }
  return -1;
}

function viaMacro(macro, nombre) {
  return nombre === normal(macro.slug || macro.id) || nombre === normal(macro.id) ? 'nombre' : 'alias';
}

function catalogoNombres(macros, demos) {
  const visto = new Set();
  const nombres = [];
  const sumar = (nombre) => {
    const texto = normal(nombre);
    if (!slugValido(texto) || visto.has(texto)) return;
    visto.add(texto);
    nombres.push(texto);
  };
  for (const macro of macros) {
    sumar(macro.slug || macro.id);
    for (const alias of macro.aliases || []) sumar(alias);
  }
  for (const demo of demos) {
    for (const sub of demo.subdemos || []) sumar(sub.slug || sub.id);
  }
  return nombres.sort();
}

export function resolverNombre(docs, bruto) {
  const texto = normal(bruto);
  const publicados = (docs || []).filter((doc) => doc && doc.status === 'published');
  const macros = publicados.filter((doc) => doc.kind === 'macro');
  const demos = publicados.filter((doc) => doc.kind === 'demo');
  if (!texto) return { tipo: 'lista', nombre: '', nombres: catalogoNombres(macros, demos) };
  let macroNombre = texto;
  let piezaNombre = '';
  if (texto.includes(' ')) {
    const partes = texto.split(/\s+/);
    if (partes.length !== 2) return { tipo: 'no', nombre: texto };
    macroNombre = partes[0];
    piezaNombre = partes[1];
  } else if (texto.includes('.')) {
    const partes = texto.split('.');
    if (partes.length !== 2 || !partes[0] || !partes[1]) return { tipo: 'no', nombre: texto };
    macroNombre = partes[0];
    piezaNombre = partes[1];
  }
  if (reservado(macroNombre) || (piezaNombre && reservado(piezaNombre))) return { tipo: 'reservado', nombre: texto };
  const macrosHit = macros.filter((macro) => nombresMacro(macro).includes(macroNombre));
  if (piezaNombre) {
    if (macrosHit.length !== 1) {
      return { tipo: macrosHit.length ? 'ambiguo' : 'no', nombre: texto, candidatos: macrosHit.map((macro) => macro.slug || macro.id) };
    }
    const macro = macrosHit[0];
    const index = indicePieza(macro, demos, piezaNombre);
    if (index < 0) return { tipo: 'no', nombre: texto, id: macro.id };
    return { tipo: 'pieza', nombre: texto, id: macro.id, index, via: viaMacro(macro, macroNombre), macro };
  }
  if (macrosHit.length > 1) {
    return { tipo: 'ambiguo', nombre: texto, candidatos: macrosHit.map((macro) => macro.slug || macro.id) };
  }
  if (macrosHit.length === 1) {
    const macro = macrosHit[0];
    return { tipo: 'macro', nombre: texto, id: macro.id, via: viaMacro(macro, macroNombre), macro };
  }
  const claves = new Map();
  for (const demo of demos) {
    for (const sub of demo.subdemos || []) {
      const ref = demo.site + '/' + sub.id;
      if (nombresSub(sub, ref).includes(texto)) claves.set(ref, { demo, sub, ref });
    }
  }
  if (claves.size > 1) return { tipo: 'ambiguo', nombre: texto, candidatos: [...claves.keys()] };
  if (claves.size === 1) {
    const pieza = [...claves.values()][0];
    const contenedor = macros.find((macro) => (macro.items || []).some((item) => item.ref === pieza.ref));
    if (contenedor) {
      return {
        tipo: 'pieza', nombre: texto, id: contenedor.id, via: 'subdemo', macro: contenedor,
        index: contenedor.items.findIndex((item) => item.ref === pieza.ref),
      };
    }
    return { tipo: 'demo', nombre: texto, id: pieza.demo.id, site: pieza.demo.site, sub: pieza.sub.id, demo: pieza.demo };
  }
  return { tipo: 'no', nombre: texto };
}
