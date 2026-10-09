/*
 * /neo58 — prueba en vivo de Neo en Unreal 5.8 (boca por audio), DETRÁS de la zona
 * desmilitarizada (Carlos, 09-10-2026): solo entra quien tiene sesión del directorio
 * de AdmiraNeXT, el mismo perímetro que /flota u /organigrama (_webmaster-gate.js).
 * No hay sistema de acceso nuevo.
 *
 * La prueba vive en un Mac (MacBookPro16) y sale por un Funnel de Tailscale. Esa
 * dirección no sirve nada a quien no traiga la clave NEO58_ORIGIN_KEY; aquí se
 * comprueba la sesión y, solo entonces, se reenvía la petición con la clave:
 *   GET  /neo58/            → página de la prueba
 *   GET  /neo58/<fichero>   → reproductor (uiless.html, .js, .css…)
 *   WS   /neo58/            → señalización del vídeo
 *   POST /neo58/decir       → frase que dirá Neo (mismo origen, sesión viva)
 * Verja de SERVIDOR: sin sesión no sale ni el HTML ni el vídeo ni se acepta la frase.
 */
import { sesionCompleta, respuestaLogin } from '../_webmaster-gate.js';

export const RUTA_NEO58 = '/neo58/';
export const ORIGEN_NEO58 = 'https://macbook-pro-16.tail48b61c.ts.net';

function texto(mensaje, status) {
  return new Response(mensaje + '\n', { status, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'private, no-store', 'x-robots-tag': 'noindex, nofollow' } });
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  if (url.pathname === '/neo58') return Response.redirect(url.origin + RUTA_NEO58 + url.search, 302);
  const resto = url.pathname.slice('/neo58'.length) || '/';
  const esSocket = String(request.headers.get('Upgrade') || '').toLowerCase() === 'websocket';
  const esPagina = resto === '/' && request.method === 'GET' && !esSocket;

  if (!env.WEBMASTER_SIGNING_KEY) return esPagina ? respuestaLogin(env, 'Acceso no disponible ahora mismo.', RUTA_NEO58, 503) : texto('Acceso no disponible ahora mismo.', 503);
  const current = await sesionCompleta(request, env);
  if (!current) return esPagina ? respuestaLogin(env, 'Zona protegida: identifícate para entrar.', RUTA_NEO58, 401) : texto('Sin sesión.', 401);

  if (request.method === 'POST') {
    if (resto !== '/decir') return texto('Método no permitido.', 405);
    // La frase solo se acepta desde la propia página: otra web no puede hacer hablar a Neo con la sesión de alguien.
    if (request.headers.get('Origin') !== url.origin) return texto('Origen no permitido.', 403);
  } else if (request.method !== 'GET' && request.method !== 'HEAD') {
    return texto('Método no permitido.', 405);
  }
  if (!env.NEO58_ORIGIN_KEY) return texto('La prueba de Neo no está configurada.', 503);

  const headers = new Headers(request.headers);
  headers.delete('cookie');
  headers.delete('authorization');
  headers.set('x-neo58-clave', env.NEO58_ORIGIN_KEY);
  headers.set('x-neo58-usuario', current.email);
  const destino = ORIGEN_NEO58 + resto + url.search;
  let respuesta;
  try {
    respuesta = await fetch(destino, { method: request.method, headers, body: request.method === 'POST' ? request.body : undefined, redirect: 'manual' });
  } catch (_) {
    return texto('La prueba de Neo no responde: puede que el Mac esté apagado.', 502);
  }
  if (respuesta.status === 101) return respuesta;   // WebSocket de señalización: se entrega tal cual
  const salida = new Headers(respuesta.headers);
  salida.set('cache-control', 'private, no-store');
  salida.set('x-robots-tag', 'noindex, nofollow');
  return new Response(respuesta.body, { status: respuesta.status, statusText: respuesta.statusText, headers: salida });
}
