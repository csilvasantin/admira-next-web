/**
 * GET /api/agente-entrada — estado de la entrada de agentes (#5411), sin clave.
 * Pregunta a fleet.admira.live si la sesión de lectura existe. Devuelve solo
 * desplegado / sesión / nombre. No reenvía errores, cookies ni secretos.
 */
export function resumirEntrada(status, json) {
  const nombre = json && typeof json.name === 'string' && /^[A-Za-z0-9._-]{2,40}$/.test(json.name) ? json.name : '';
  if (status === 404) return { ok: true, desplegado: false, sesion: false, nombre: null };
  if (status === 200 && json && json.agent === true && nombre) return { ok: true, desplegado: true, sesion: true, nombre };
  if (typeof status === 'number' && status >= 200 && status < 500) return { ok: true, desplegado: true, sesion: false, nombre: null };
  return { ok: false, desplegado: false, sesion: false, nombre: null };
}

export async function onRequestGet() {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4000);
  let status = 0;
  let json = null;
  try {
    const r = await fetch('https://fleet.admira.live/api/auth/session', {
      headers: { accept: 'application/json' },
      signal: ctrl.signal,
    });
    status = r.status;
    try { json = JSON.parse(await r.text()); } catch (_) { json = null; }
  } catch (_) {
    status = 0;
    json = null;
  } finally {
    clearTimeout(timer);
  }
  return new Response(JSON.stringify(resumirEntrada(status, json)), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}
