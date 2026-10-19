/*
 * /api/mcp-tokens — tokens del MCP del Generador de Presentaciones. Solo admin con sesión.
 *   GET            → lista (sin el token: solo hash guardado).
 *   POST {email,label} → crea y devuelve el token UNA vez.
 *   DELETE {id}    → revoca.
 * El email tiene que existir en el directorio; el acceso real se decide en cada llamada.
 */
import { buscarUsuario } from '../_webmaster-gate.js';
import { exigirDmz, jsonDmz } from '../_usuarios-dmz.js';
import { createToken, listTokens, revokeToken } from '../mcp/_tokens.js';

const json = (body, status = 200) => jsonDmz(body, status);

// Zona DMZ (19-10-2026): emitir o revocar un token es tan sensible como dar un alta.
async function admin(request, env, write){
  return exigirDmz(request, env, { escritura: !!write, ambito: 'mcp-tokens' });
}

export async function onRequestGet({ request, env }){
  const auth = await admin(request, env, false); if (auth.error) return auth.error;
  return json({ ok: true, tokens: await listTokens(env), endpoint: 'https://www.admiranext.com/mcp', help: 'https://www.admiranext.com/mcp/generador' });
}

export async function onRequestPost({ request, env }){
  const auth = await admin(request, env, true); if (auth.error) return auth.error;
  let body; try { body = await request.json(); } catch (_) { return json({ ok: false, error: 'JSON no válido' }, 400); }
  const email = String(body.email || '').trim().toLowerCase();
  const user = email ? await buscarUsuario(env, email) : null;
  if (!user) return json({ ok: false, error: 'ese email no está en el directorio (/usuarios)' }, 422);
  if (user.status !== 'active') return json({ ok: false, error: 'el usuario no está activo' }, 422);
  const kind = String(user.account_kind || 'team');
  if (kind === 'guest' || kind === 'partner') {
    const rows = await env.AUTH_DB.prepare('SELECT app_key FROM admiranext_user_apps WHERE user_email=?').bind(email).all().catch(() => ({ results: [] }));
    const apps = (rows.results || []).map((r) => r.app_key);
    if (!apps.includes('mcp')) return json({ ok: false, error: 'este tercero no tiene MCP contratado (ni MCP de flota)' }, 403);
  }
  const { token, row } = await createToken(env, { email, label: body.label, createdBy: auth.current.email });
  await auth.auditar(email, 'mcp_token_created', JSON.stringify({ id: row.id, label: row.label })).catch(() => {});
  return json({ ok: true, token, id: row.id, email, label: row.label, aviso: 'Guarda el token: no se vuelve a mostrar.' }, 201);
}

export async function onRequestDelete({ request, env }){
  const auth = await admin(request, env, true); if (auth.error) return auth.error;
  let body; try { body = await request.json(); } catch (_) { return json({ ok: false, error: 'JSON no válido' }, 400); }
  const id = String(body.id || '').trim(); if (!id) return json({ ok: false, error: 'id requerido' }, 422);
  await revokeToken(env, id, auth.current.email);
  await auth.auditar('-', 'mcp_token_revoked', id).catch(() => {});
  return json({ ok: true, id });
}

const noPermitido = () => jsonDmz({ ok: false, error: 'método no permitido' }, 405, { allow: 'GET, POST, DELETE' });
export const onRequestPut = noPermitido;
export const onRequestPatch = noPermitido;
export const onRequestOptions = noPermitido;
