/**
 * /api/deployments?p=<proyecto>[&d=AAAA-MM-DD]
 *
 * Devuelve los despliegues de un proyecto de Cloudflare Pages para que /webmaster
 * pueda navegar por los snapshots. Cada despliegue de Pages queda accesible para
 * siempre en su propia URL (https://<short_id>.<proyecto>.pages.dev): ESE es el
 * snapshot: la web tal y como estaba en ese momento, no una captura ni una nota.
 *
 * La llamada a la API de Cloudflare la hace el EDGE, no el navegador: el token
 * vive como secreto del proyecto Pages (CF_API_TOKEN) y nunca sale de aquí.
 *
 * Sin fecha devuelve HOY (Madrid). d=all devuelve los últimos 100 sin filtrar.
 */

import { sesionCompleta } from '../_webmaster-gate.js';
import { proyectoPermitido } from '../_project-access.js';

// Lista blanca: solo proyectos del ecosistema. Un parámetro no puede pedir otra cosa.
const PROYECTOS = new Set([
  'admiranext', 'yokup', 'admira-tv', 'pixeria', 'admira-live',
  'clearchannel-tv', 'admira-store', 'admira-app', 'narrativa-impacto', 'admira-academy',
]);

// Día en Madrid sin depender de librerías: es la fecha con la que trabaja el equipo.
function diaMadrid(iso) {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(iso));
}
function horaMadrid(iso) {
  return new Intl.DateTimeFormat('es-ES', {
    timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso));
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const proyecto = url.searchParams.get('p') || '';
  const dia = url.searchParams.get('d') || diaMadrid(new Date().toISOString());

  const json = (obj, status = 200) => new Response(JSON.stringify(obj), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      // 60 s: suficiente para no machacar la API, poco para no mentir sobre «hoy».
      'cache-control': 'public, max-age=60',
    },
  });

  // Mismo perímetro de seguridad que la página: de nada sirve proteger /webmaster si el historial
  // de despliegues se puede pedir por su cuenta.
  const current = await sesionCompleta(request, env);
  if (!current) {
    return json({ ok: false, error: 'acceso restringido' }, 401);
  }

  if (!PROYECTOS.has(proyecto)) {
    return json({ ok: false, error: 'proyecto no reconocido' }, 400);
  }
  if (!proyectoPermitido(current.project_keys, proyecto)) {
    return json({ ok:false, error:'proyecto no autorizado' }, 403);
  }
  if (!env.CF_API_TOKEN || !env.CF_ACCOUNT_ID) {
    return json({ ok: false, error: 'sin credenciales en el edge' }, 503);
  }

  // per_page tiene un techo de 25 (más devuelve 400, código 8000024), y un día
  // movido pasa de 25 despliegues de sobra. Se pagina hasta 4 páginas.
  const base = `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}`
             + `/pages/projects/${proyecto}/deployments?per_page=25`;
  const crudos = [];
  for (let page = 1; page <= 4; page++) {
    let r;
    try {
      r = await fetch(`${base}&page=${page}`, {
        headers: { Authorization: `Bearer ${env.CF_API_TOKEN}` },
      });
    } catch (e) {
      return json({ ok: false, error: 'no se pudo consultar Cloudflare' }, 502);
    }
    if (!r.ok) return json({ ok: false, error: `Cloudflare respondió ${r.status}` }, 502);

    const data = await r.json();
    if (!data.success) return json({ ok: false, error: 'Cloudflare rechazó la consulta' }, 502);

    const lote = data.result || [];
    crudos.push(...lote);
    if (lote.length < 25) break;                       // no hay más
    // Si ya hemos bajado por debajo del día pedido, seguir sería gastar por gastar.
    if (dia !== 'all' && diaMadrid(lote[lote.length - 1].created_on) < dia) break;
  }

  const todos = crudos
    .filter((d) => d.environment === 'production')
    .map((d) => {
      const meta = (d.deployment_trigger && d.deployment_trigger.metadata) || {};
      const stage = d.latest_stage || {};
      // Del mensaje del commit interesa el ASUNTO: la primera línea. El cuerpo
      // son párrafos enteros y Cloudflare además le pega su propio aviso de
      // recorte, así que una lista con el mensaje completo no se puede leer.
      const completo = (meta.commit_message || '').replace(/\[commit_message truncated\]\s*$/i, '').trim();
      const asunto = completo.split('\n')[0].trim();

      return {
        id: d.short_id,
        url: d.url,                       // el snapshot navegable
        fecha: diaMadrid(d.created_on),
        hora: horaMadrid(d.created_on),
        creado: d.created_on,
        mensaje: asunto.length > 110 ? asunto.slice(0, 108).trimEnd() + '…' : asunto,
        mensajeLargo: completo,           // para el tooltip
        commit: (meta.commit_hash || '').slice(0, 7),
        ok: stage.name === 'deploy' && stage.status === 'success',
      };
    });

  const dias = [...new Set(todos.map((d) => d.fecha))].sort().reverse();
  const lista = dia === 'all' ? todos : todos.filter((d) => d.fecha === dia);

  return json({
    ok: true,
    proyecto,
    dia,
    dias,                                  // para poder saltar a días anteriores
    total: lista.length,
    // El más reciente del día es el que está EN ANTENA si el día es hoy.
    despliegues: lista,
  });
}
