/*
 * Documentos internos en D1 (admiranext-auth), tabla admiranext_docs (06-09-2026).
 *
 * POR QUÉ NO VAN EN EL REPO: admira-next-web es PÚBLICO en GitHub. El inventario de
 * repos nombra los privados, así que no puede vivir en un fichero del repo ni en un
 * HTML estático: se guarda en D1 y solo lo sirve una Function tras el perímetro.
 * Se carga/actualiza con wrangler (d1 execute --remote) o desde una ruta admin futura.
 */
export const DOCS_TABLE_SQL =
  'CREATE TABLE IF NOT EXISTS admiranext_docs (slug TEXT PRIMARY KEY, markdown TEXT NOT NULL, updated_at INTEGER NOT NULL, updated_by TEXT)';

const READY = new WeakSet();

export async function asegurarDocs(env) {
  if (!env || !env.AUTH_DB || READY.has(env.AUTH_DB)) return;
  await env.AUTH_DB.prepare(DOCS_TABLE_SQL).run();
  READY.add(env.AUTH_DB);
}

export async function leerDoc(env, slug) {
  await asegurarDocs(env);
  return await env.AUTH_DB.prepare('SELECT slug,markdown,updated_at,updated_by FROM admiranext_docs WHERE slug=?').bind(String(slug)).first();
}

export async function guardarDoc(env, slug, markdown, by = '') {
  await asegurarDocs(env);
  await env.AUTH_DB.prepare(
    'INSERT INTO admiranext_docs(slug,markdown,updated_at,updated_by) VALUES(?,?,?,?) ON CONFLICT(slug) DO UPDATE SET markdown=excluded.markdown,updated_at=excluded.updated_at,updated_by=excluded.updated_by'
  ).bind(String(slug), String(markdown), Date.now(), String(by).slice(0, 120)).run();
}
