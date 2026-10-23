/**
 * /api/censo-papelera — baja diferida del censo de /proyectos.
 *
 * GET lo puede leer cualquiera: solo devuelve los id ocultos, para que el
 * contador público no cuente la papelera. La lista, el csrf y las escrituras
 * son de admin. La copia no sale del servidor.
 */
import { exigirRol, sesionCompleta, csrfValido } from '../_webmaster-gate.js';
import { eliminarProyecto, purgarVencidas, restaurarProyecto, vistaPapelera } from '../_papelera-proyectos.js';

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  },
});

async function cuerpo(request) {
  const tipo = String(request.headers.get('content-type') || '');
  if (!tipo.includes('application/json')) return null;
  try { return await request.json(); } catch (_) { return null; }
}

export async function onRequestGet({ request, env }) {
  try {
    await purgarVencidas(env, Date.now(), request);
    const current = await exigirRol(request, env, ['admin']);
    const vista = await vistaPapelera(env);
    if (!current) return json({ ok: true, admin: false, hidden: vista.hidden });
    return json({
      ok: true, admin: true, csrf: current.csrf,
      hidden: vista.hidden, papelera: vista.papelera,
    });
  } catch (error) {
    return json({ ok: false, error: error.message || 'no se pudo leer la papelera' }, error.status || 500);
  }
}

export async function onRequestPost({ request, env }) {
  const current = await exigirRol(request, env, ['admin']);
  if (!current) {
    const any = await sesionCompleta(request, env);
    return json({ ok: false, error: any ? 'solo un admin' : 'acceso restringido' }, any ? 403 : 401);
  }
  if (!csrfValido(request, current)) return json({ ok: false, error: 'la sesión no autoriza el cambio' }, 403);
  const body = await cuerpo(request);
  if (!body) return json({ ok: false, error: 'JSON requerido' }, 400);
  const accion = String(body.action || '');
  try {
    if (accion === 'delete') {
      await eliminarProyecto(env, {
        id: body.id, confirm: body.confirm, actor: current.email, request,
      });
    } else if (accion === 'restore') {
      await restaurarProyecto(env, { id: body.id, actor: current.email, request });
    } else {
      return json({ ok: false, error: 'acción desconocida' }, 400);
    }
    const vista = await vistaPapelera(env);
    return json({ ok: true, admin: true, hidden: vista.hidden, papelera: vista.papelera });
  } catch (error) {
    return json({ ok: false, error: error.message || 'no se pudo completar' }, error.status || 500);
  }
}
