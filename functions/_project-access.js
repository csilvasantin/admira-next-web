import { commercialCatalog } from './_xpace-registry.js';
import { PROYECTOS } from './_proyectos.js';
import { fichaProyecto } from './_modelo-proyectos.js';

const YOKUP_PROJECTS = 'https://api.yokup.com/projects';

const clean = (value) => String(value || '').trim().slice(0, 120);

function metaDe(project, extras = {}) {
  const ficha = fichaProyecto(project);
  return {
    xpacio: ficha.xpacio,
    responsible: ficha.responsible,
    carbon_responsible: ficha.carbon_responsible,
    help: ficha.help,
    mcp: ficha.mcp,
    ...extras,
  };
}

export async function catalogoProyectos(env = {}) {
  const rows = new Map();
  PROYECTOS.forEach((project, order) => rows.set(project.clave, {
    key: project.clave,
    name: project.nombre,
    parent_key: project.parentKey || '',
    url: project.url || '',
    source: 'webmaster',
    order,
    ...metaDe({ id: project.clave, name: project.nombre, web: project.url }),
  }));

  for(const project of await commercialCatalog(env)) rows.set(project.key,project);

  const fetchImpl = typeof env.YOKUP_FETCH === 'function' ? env.YOKUP_FETCH : fetch;
  let payload = null;
  try {
    const response = await fetchImpl(YOKUP_PROJECTS, {headers:{Accept:'application/json'}, cache:'no-store'});
    if (!response.ok) throw new Error(`Yokup HTTP ${response.status}`);
    payload = await response.json();
    if (!payload || !Array.isArray(payload.projects)) throw new Error('censo Yokup inválido');
    payload.projects.forEach((project, index) => {
      const key = clean(project.id);
      if (!key) return;
      const overlay = metaDe(project);
      if (rows.has(key)) {
        rows.set(key, { ...rows.get(key), ...overlay, url: rows.get(key).url || overlay.url || clean(project.web) });
        return;
      }
      rows.set(key, {
        key,
        name: clean(project.name) || key,
        parent_key: '',
        url: clean(project.web),
        source: 'yokup',
        order: 10000 + Number(project.sort_order ?? index),
        ...overlay,
      });
    });
  } catch (error) {
    // El censo local sigue disponible; el API expone la degradación para que la
    // UI nunca confunda una lista parcial con el inventario completo.
    return {projects: ordenar([...rows.values()]), complete:false, warning:String(error && error.message || error), yokup:null};
  }
  return {projects: ordenar([...rows.values()]), complete:true, warning:'', yokup:payload.projects};
}

// Claves de ACL que no son el id del censo pero son el mismo proyecto.
// generador/presentaciones: grant del Generador (presentaciones/_directory.js).
// admira-store: yokupId xpaceos en _proyectos.js. admiranext-webmaster es el
// mismo sitio que el id Yokup webmaster-admiranext. ainimation es el id viejo
// de ainimation-studio. El dominio del correo (account_kind team) no concede
// proyecto: no hay alta por @dominio.
const ALIAS_A_CENSO = {
  generador: 'generador-de-presentaciones',
  presentaciones: 'generador-de-presentaciones',
  'admira-next': 'admiranext',
  'admiranext.com': 'admiranext',
  'www.admiranext.com': 'admiranext',
  'admira-store': 'xpaceos',
  'admiranext-webmaster': 'webmaster-admiranext',
  ainimation: 'ainimation-studio',
};

const normClave = (value) => String(value || '').trim().toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '');

function hostDe(url) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  try {
    const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    return u.hostname.toLowerCase().replace(/^www\./, '');
  } catch { return ''; }
}

function rutaDe(url) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  try {
    const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    return u.pathname.replace(/\/+$/, '');
  } catch { return ''; }
}

/**
 * El combo de /usuarios enseña el mismo censo que /proyectos (GET
 * api.yokup.com/projects). Las claves de ACL —subproyectos de Webmaster,
 * alias y claves viejas— se traducen a esos ids para filtrar.
 * Un token MCP no guarda proyecto: es el del Generador
 * (generador-de-presentaciones) y hereda sus ids.
 */
export function vistaCenso(catalog, yokupProjects) {
  const raw = Array.isArray(yokupProjects) ? yokupProjects : [];
  const byKey = new Map((catalog.projects || []).map((project) => [project.key, project]));
  const projects = [];
  const censusIds = new Set();
  raw.forEach((item) => {
    const key = clean(item && item.id);
    if (!key || censusIds.has(key)) return;
    censusIds.add(key);
    const known = byKey.get(key);
    projects.push(known ? {...known, source:'yokup'} : {
      key, name: clean(item.name) || key, parent_key: '', url: clean(item.web),
      source: 'yokup', order: projects.length, depth: 0,
      ...metaDe(item),
    });
  });
  const parentOf = (key) => (byKey.get(key) || {}).parent_key || '';
  const urlOf = (key) => (byKey.get(key) || projects.find((project) => project.key === key) || {}).url || '';
  const siteOwner = (host) => projects.find((project) => hostDe(project.url) === host && rutaDe(project.url) === '')?.key || '';
  const resolve = (key) => {
    const low = String(key || '').trim().toLowerCase();
    if (!low) return '';
    if (ALIAS_A_CENSO[low]) return ALIAS_A_CENSO[low];
    if (byKey.has(low) || censusIds.has(low)) return low;
    const folded = normClave(low);
    const byNorm = [...byKey.keys(), ...censusIds].find((candidate) => normClave(candidate) === folded);
    if (byNorm) return byNorm;
    const host = low.replace(/^www\./, '');
    if (host.includes('.')) return siteOwner(host) || low;
    return low;
  };
  const targets = (key) => {
    const raw = String(key || '').trim().toLowerCase();
    const out = new Set();
    const seen = new Set();
    // Se parte de la clave tal cual: un alias (presentaciones, admiranext-webmaster)
    // conserva el padre del catálogo además del id del censo.
    const stack = [raw];
    while (stack.length) {
      const current = stack.pop();
      if (!current || seen.has(current)) continue;
      seen.add(current);
      if (censusIds.has(current)) out.add(current);
      const alias = ALIAS_A_CENSO[current];
      if (alias) stack.push(alias);
      const parent = parentOf(current);
      if (parent) stack.push(parent);
    }
    // La familia del host solo se abre si la clave ES el proyecto dueño del
    // sitio (ruta vacía). Un alias (ainimation → ainimation-studio) no arrastra
    // al resto de proyectos de ese host.
    const aliased = !!(ALIAS_A_CENSO[raw] && ALIAS_A_CENSO[raw] !== raw);
    const canon = resolve(raw);
    const host = hostDe(urlOf(canon));
    if (!aliased && censusIds.has(canon) && host && rutaDe(urlOf(canon)) === '') {
      projects.forEach((project) => { if (hostDe(project.url) === host) out.add(project.key); });
    }
    // Un proyecto hospedado (sin padre en el catálogo, p. ej. generador-de-presites)
    // cuenta para el filtro del dueño del sitio, y no para sus hermanos.
    if (!aliased && censusIds.has(canon) && host) {
      const owner = siteOwner(host);
      if (owner) out.add(owner);
    }
    return [...out].sort();
  };
  const grants = {};
  (catalog.projects || []).forEach((project) => { grants[project.key] = targets(project.key); });
  Object.keys(ALIAS_A_CENSO).forEach((alias) => { grants[alias] = targets(alias); });
  grants.__mcp__ = targets('generador-de-presentaciones');
  const commercial = (catalog.projects || []).filter((project) => project.key === 'commercial-projects' || project.key.startsWith('commercial:'));
  return {projects, grants, commercial};
}

function ordenar(projects) {
  const byParent = new Map();
  projects.forEach((project) => {
    const parent = project.parent_key || '';
    if (!byParent.has(parent)) byParent.set(parent, []);
    byParent.get(parent).push(project);
  });
  for (const list of byParent.values()) list.sort((a,b) => a.order-b.order || a.name.localeCompare(b.name,'es'));
  const output = [], seen = new Set();
  const visit = (project, depth=0) => {
    if (seen.has(project.key)) return;
    seen.add(project.key); output.push({...project,depth});
    (byParent.get(project.key) || []).forEach((child) => visit(child, depth+1));
  };
  (byParent.get('') || []).forEach((project) => visit(project));
  projects.forEach((project) => visit(project));
  return output;
}

export function normalizarPermisos(values, catalog) {
  const requested = [...new Set((Array.isArray(values) ? values : []).map(clean).filter(Boolean))];
  if (requested.includes('*')) return ['*'];
  const allowed = new Set((catalog || []).map((project) => project.key));
  return requested.filter((key) => allowed.has(key)).sort();
}

export function proyectoPermitido(projectKeys, projectKey, projects = PROYECTOS) {
  const granted = new Set(projectKeys || []);
  if (granted.has('*') || granted.has(projectKey)) return true;
  const byKey = new Map(projects.map((project) => [project.clave || project.key, project]));
  let current = byKey.get(projectKey), guard = 0;
  while (current && guard++ < 20) {
    const parent = current.parentKey || current.parent_key || '';
    if (!parent) return false;
    if (granted.has(parent)) return true;
    current = byKey.get(parent);
  }
  return false;
}
