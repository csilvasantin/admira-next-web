import { PROYECTOS } from './_proyectos.js';

const YOKUP_PROJECTS = 'https://api.yokup.com/projects';

const clean = (value) => String(value || '').trim().slice(0, 120);

export async function catalogoProyectos(env = {}) {
  const rows = new Map();
  PROYECTOS.forEach((project, order) => rows.set(project.clave, {
    key: project.clave,
    name: project.nombre,
    parent_key: project.parentKey || '',
    url: project.url || '',
    source: 'webmaster',
    order,
  }));

  const fetchImpl = typeof env.YOKUP_FETCH === 'function' ? env.YOKUP_FETCH : fetch;
  try {
    const response = await fetchImpl(YOKUP_PROJECTS, {headers:{Accept:'application/json'}, cache:'no-store'});
    if (!response.ok) throw new Error(`Yokup HTTP ${response.status}`);
    const payload = await response.json();
    if (!payload || !Array.isArray(payload.projects)) throw new Error('censo Yokup inválido');
    payload.projects.forEach((project, index) => {
      const key = clean(project.id);
      if (!key || rows.has(key)) return;
      rows.set(key, {
        key,
        name: clean(project.name) || key,
        parent_key: '',
        url: clean(project.web),
        source: 'yokup',
        order: 10000 + Number(project.sort_order ?? index),
      });
    });
  } catch (error) {
    // El censo local sigue disponible; el API expone la degradación para que la
    // UI nunca confunda una lista parcial con el inventario completo.
    return {projects: ordenar([...rows.values()]), complete:false, warning:String(error && error.message || error)};
  }
  return {projects: ordenar([...rows.values()]), complete:true, warning:''};
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
