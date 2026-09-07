/*
 * Modelo canónico usuario + proyecto (FLT-100047 · SmithMacMini · 7-sep-2026).
 *
 * Tres directorios conviven y no son el mismo:
 *   1) Carbono  — Google email en admiranext_users (/usuarios)
 *   2) Silicio  — persona+máquina en el censo Yokup (api.yokup.com/projects)
 *   3) Lista blanca de admira.live — otro correo, otra puerta
 *
 * Un proyecto vive en UN xpacio (AdmiraNeXT o Yokup). Norma 24: cada uno
 * publica /help (carbono) y /mcp (silicio). El proyecto principal del día se
 * declara con POST /projects/principal; si un alta no lleva project_id, Yokup
 * hereda ese principal — por eso hay que pasarlo siempre.
 */

export function xpacioDe({ id, key, web, url } = {}) {
  const slug = String(id || key || '').toLowerCase();
  const site = String(web || url || '').toLowerCase();
  if (slug === 'yokup' || slug.startsWith('yokup-') || site.includes('yokup.com')) return 'Yokup';
  return 'AdmiraNeXT';
}

export function originDe(web) {
  const raw = String(web || '').trim();
  if (!raw) return '';
  try {
    const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
    return u.origin;
  } catch {
    return '';
  }
}

export function puertasDe(web) {
  const origin = originDe(web);
  if (!origin) return { help: '', mcp: '' };
  return { help: `${origin}/help`, mcp: `${origin}/mcp` };
}

export function fichaProyecto(project = {}) {
  const id = String(project.id || project.key || '').trim();
  const web = String(project.web || project.url || '').trim();
  const puertas = puertasDe(web);
  return {
    id,
    name: String(project.name || project.nombre || id).trim() || id,
    web,
    xpacio: xpacioDe({ id, key: project.key, web, url: project.url }),
    responsible: String(project.primary_responsible || project.owner || project.silicon_responsible || '').trim(),
    carbon_responsible: String(project.carbon_responsible || '').trim(),
    help: puertas.help,
    mcp: puertas.mcp,
  };
}
