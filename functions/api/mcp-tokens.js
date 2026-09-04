/*
 * /api/mcp-tokens — tokens del MCP del Generador de Presentaciones. Solo admin con sesión.
 *   GET            → lista (sin el token: solo hash guardado).
 *   POST {email,label} → crea y devuelve el token UNA vez.
 *   DELETE {id}    → revoca.
 * El email tiene que existir en el directorio; el acceso real se decide en cada llamada.
 */
import { exigirRol, csrfValido, buscarUsuario, auditar } from '../_webmaster-gate.js';
import { createToken, listTokens, revokeToken } from '../mcp/_tokens.js';

const json = (body, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });

async function admin(request, env, write){
  const current = await exigirRol(request, env, ['admin']);
  if (!current) return { error: json({ ok: false, error: 'administrador requerido' }, 403) };
  if (write && !csrfValido(request, current)) return { error: json({ ok: false, error: 'CSRF inválido' }, 403) };
  return { current };
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
  const { token, row } = await createToken(env, { email, label: body.label, createdBy: auth.current.email });
  await auditar(env, auth.current.email, email, 'mcp_token_created', JSON.stringify({ id: row.id, label: row.label })).catch(() => {});
  return json({ ok: true, token, id: row.id, email, label: row.label, aviso: 'Guarda el token: no se vuelve a mostrar.' }, 201);
}

export async function onRequestDelete({ request, env }){
  const auth = await admin(request, env, true); if (auth.error) return auth.error;
  let body; try { body = await request.json(); } catch (_) { return json({ ok: false, error: 'JSON no válido' }, 400); }
  const id = String(body.id || '').trim(); if (!id) return json({ ok: false, error: 'id requerido' }, 422);
  await revokeToken(env, id, auth.current.email);
  await auditar(env, auth.current.email, '-', 'mcp_token_revoked', id).catch(() => {});
  return json({ ok: true, id });
}
