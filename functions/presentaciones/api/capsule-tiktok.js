/* POST /presentaciones/api/capsule-tiktok
 * ----------------------------------------------------------------------------
 * Convierte una CÁPSULA DE CONOCIMIENTO en un TikTok de 15 s que la explica.
 *
 * Una cápsula es texto que alguien aprendió y guardó. Hasta hoy nacía y se
 * quedaba ahí: se lee, no se ve. Esto la pone en pantalla.
 *
 * NO reimplementa la generación: arma el brief (_capsule-brief.mjs) y se lo pasa
 * al motor que ya existe —/presentaciones/api/grok-video, 15 s en 9:16 nativo—,
 * que además publica solo en el Stock de Pixeria. Si mañana el motor mejora, esta
 * puerta lo hereda sin tocarse.
 *
 * Devuelve el requestId del motor: quien llama sondea el estado con
 * GET /presentaciones/api/grok-video?id=…, igual que hace el estudio.
 */
import { briefDesdeCapsula } from './_capsule-brief.mjs';
// Se INVOCA el motor, no se le llama por red. Una Function haciendo fetch a su
// propio host es un antipatrón en Cloudflare: el borde devuelve 502 y desde el
// otro lado parece que el generador está caído. Aquí viven los dos en el mismo
// bundle, así que se llama a la función y punto — menos latencia y una pieza
// menos que puede fallar.
import { onRequest as motorGrokVideo } from './grok-video.js';

const MAX_BODY_BYTES = 8 * 1024;
const RESOLUCION = '720p';   // suficiente para MUPI vertical y mucho más rápido que 1080p

function json(payload, status = 200) {
  return Response.json(payload, {
    status,
    headers: {
      'cache-control': 'no-store',
      'content-type': 'application/json; charset=utf-8',
      'x-content-type-options': 'nosniff'
    }
  });
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST' && request.method !== 'GET') {
    return json({ error: 'Método no permitido.' }, 405);
  }
  // Puerta de servidor a servidor: la dispara el worker del Stock cuando se
  // publica una cápsula, no un navegador. Se exige el mismo secreto de ingesta
  // que ya usa la publicación en Pixeria, para no inventar una credencial nueva.
  const secreto = env.PIXERIA_INGEST_TOKEN;
  if (!secreto) return json({ error: 'La puerta de cápsulas no está configurada.' }, 503);
  if (request.headers.get('x-admiranext-ingest') !== secreto) {
    return json({ error: 'No autorizado.' }, 401);
  }

  // ESTADO del encargo. El endpoint del motor vive detrás del perímetro humano
  // (está en isGeneratorApi), así que preguntarle desde fuera devuelve la PÁGINA
  // DE LOGIN, no el estado — y quien pregunta nunca ve el «done». Se expone por
  // esta puerta, que ya se autentica con el secreto de ingesta, invocando al motor
  // EN PROCESO. Así el perímetro no se abre para nadie más.
  // Preguntar NO es solo consultar: es lo que dispara la publicación en Pixeria
  // cuando el vídeo está listo. Sin alguien preguntando, Grok genera y el vídeo no
  // llega a ninguna parte.
  if (request.method === 'GET') {
    const id = new URL(request.url).searchParams.get('id') || '';
    if (!id) return json({ error: 'Falta el id del encargo.' }, 400);
    const consulta = new Request(new URL(`/presentaciones/api/grok-video?id=${encodeURIComponent(id)}`, request.url),
      { method: 'GET', headers: { accept: 'application/json' } });
    try { return await motorGrokVideo({ ...context, request: consulta }); }
    catch (error) {
      console.error('capsule-tiktok:estado', JSON.stringify({ id, message: String(error?.message || error).slice(0, 240) }));
      return json({ ok: false, error: 'No se pudo consultar el estado.' }, 502);
    }
  }

  const declarado = Number(request.headers.get('content-length') || 0);
  if (declarado > MAX_BODY_BYTES) return json({ error: 'Petición demasiado grande.' }, 413);

  let capsula;
  try { capsula = await request.json(); }
  catch { return json({ error: 'JSON no válido.' }, 400); }

  const brief = briefDesdeCapsula(capsula);
  // Que una cápsula no dé para vídeo NO es un error: hay cápsulas de dos líneas.
  // Se contesta 200 con el motivo para que quien llama no lo reintente en bucle
  // creyendo que fue un fallo de red.
  if (!brief) {
    return json({ ok: true, generado: false, motivo: 'La cápsula no tiene texto suficiente para 15 segundos.' });
  }

  const cuerpo = JSON.stringify({
    prompt: brief.prompt,
    resolution: RESOLUCION,
    clientRequestId: crypto.randomUUID()
  });
  const peticionMotor = new Request(new URL('/presentaciones/api/grok-video', request.url), {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json', 'content-length': String(cuerpo.length) },
    body: cuerpo
  });
  let respuesta, datos = {};
  try {
    respuesta = await motorGrokVideo({ ...context, request: peticionMotor });
    datos = await respuesta.json().catch(() => ({}));
  } catch (error) {
    console.error('capsule-tiktok:motor', JSON.stringify({ message: String(error?.message || error).slice(0, 300) }));
    return json({ ok: false, error: 'El motor de vídeo no respondió.' }, 502);
  }

  if (!respuesta.ok || !datos.requestId) {
    return json({ ok: false, error: datos.error || 'El motor de vídeo rechazó la petición.' }, 502);
  }

  return json({
    ok: true,
    generado: true,
    requestId: datos.requestId,
    tema: brief.tema,
    titulo: brief.titulo,
    idea: brief.idea,
    tags: brief.tags,
    // Quien llama sondea aquí, igual que el estudio.
    estado: `/presentaciones/api/grok-video?id=${encodeURIComponent(datos.requestId)}`
  });
}
