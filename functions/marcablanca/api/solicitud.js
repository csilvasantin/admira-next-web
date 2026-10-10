/*
 * POST /marcablanca/api/solicitud · «Pide tu propuesta» (encargo #5552).
 *
 * Un visitante sin sesión deja nombre, correo y web. Se guarda una SOLICITUD
 * pendiente. No crea la propuesta comercial: esa solo nace dentro del generador,
 * con sesión y con el cupo de 20 al día. Aquí no se importa ese motor.
 *
 * La vista previa de la marca (URL o logo) no pasa por este endpoint: no se guarda.
 */
import {limitarFrecuencia} from '../../_limite-frecuencia.js';

export const SOLICITUDES_POR_DIA = 8;
export const VENTANA_SOLICITUD_SEG = 24 * 60 * 60;
export const PREFIJO_SOLICITUD = 'solicitud:';
const MAX_CUERPO = 4096;

function respuesta(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'x-robots-tag': 'noindex',
      ...extra
    }
  });
}

function limpio(valor, max) {
  return String(valor == null ? '' : valor).replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function correoValido(valor) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor) && valor.length <= 120;
}

function webValida(valor) {
  if (!valor) return '';
  try {
    const u = new URL(valor);
    if (u.protocol !== 'https:') return null;
    return u.toString().slice(0, 300);
  } catch (_) {
    return null;
  }
}

export async function onRequestPost(context) {
  const {request, env} = context;
  const origen = request.headers.get('Origin');
  if (!origen || origen !== new URL(request.url).origin) return respuesta({error: 'Origen no permitido.'}, 403);
  if (Number(request.headers.get('content-length') || 0) > MAX_CUERPO) return respuesta({error: 'Petición demasiado grande.'}, 413);
  let body;
  try {
    const texto = await request.text();
    if (texto.length > MAX_CUERPO) return respuesta({error: 'Petición demasiado grande.'}, 413);
    body = JSON.parse(texto);
  } catch (_) {
    return respuesta({error: 'JSON no válido.'}, 400);
  }
  const nombre = limpio(body?.nombre, 80);
  const email = limpio(body?.email, 120).toLowerCase();
  const nota = limpio(body?.nota, 500);
  const idioma = body?.idioma === 'en' ? 'en' : 'es';
  const web = webValida(limpio(body?.web, 300));
  if (nombre.length < 2) return respuesta({error: 'Escribe el nombre de la marca.'}, 400);
  if (!correoValido(email)) return respuesta({error: 'Escribe un correo para responderte.'}, 400);
  if (web === null) return respuesta({error: 'La web, si la indicas, debe empezar por https://'}, 400);
  if (!env?.PRESENTATION_IDEAS) return respuesta({error: 'Ahora mismo no puedo guardar la solicitud.'}, 503);

  const cupo = await limitarFrecuencia(env, request, {
    ambito: 'marcablanca-solicitud',
    maximo: SOLICITUDES_POR_DIA,
    ventanaSeg: VENTANA_SOLICITUD_SEG
  });
  if (!cupo.permitido) {
    return respuesta({
      error: `Has llegado al límite de ${SOLICITUDES_POR_DIA} solicitudes al día desde tu conexión.`,
      estado: 'limite',
      propuesta: null,
      limite: {maximo: SOLICITUDES_POR_DIA, restantes: 0}
    }, 429, {'retry-after': String(cupo.reintentarEn)});
  }

  const id = 'sol-' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  const reg = {
    id,
    estado: 'pendiente',
    nombre,
    email,
    web: web || '',
    idioma,
    nota,
    creadaEn: new Date().toISOString()
  };
  await env.PRESENTATION_IDEAS.put(PREFIJO_SOLICITUD + id, JSON.stringify(reg), {
    expirationTtl: 90 * 24 * 3600,
    metadata: {estado: 'pendiente', creadaEn: reg.creadaEn}
  });
  return respuesta({
    ok: true,
    id,
    estado: 'pendiente',
    propuesta: null,
    limite: {maximo: SOLICITUDES_POR_DIA, restantes: cupo.restantes},
    aviso: 'Solicitud pendiente. La propuesta real solo se crea con aprobación interna, con un máximo de 20 al día.'
  });
}
