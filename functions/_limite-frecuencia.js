// LÍMITE DE FRECUENCIA POR IP, GENÉRICO (SubMorfeoMacMini, 01-10-2026 · FLT-101330 b).
//
// Hermano de presentaciones/_login-rate.js (que cuenta FALLOS de login y bloquea): este cuenta
// USOS de un endpoint público que cuesta algo —p. ej. /marcablanca/api/analizar descarga webs de
// terceros— en ventanas fijas. Mismas reglas de convivencia:
//   - por IP (CF-Connecting-IP); sin ella (pruebas locales) no se limita, para no meter a todos
//     bajo una clave común;
//   - vive en el KV que ya existe (PRESENTATION_IDEAS) con prefijo propio `rate:<ámbito>:`;
//   - KV es eventualmente consistente: es un freno, no una garantía. Si KV falla, se deja pasar.
const ipDe = request => String(request.headers.get('CF-Connecting-IP') || '').trim();

/**
 * Anota un uso y dice si cabe.
 * @returns {Promise<{permitido:boolean, restantes:number, reintentarEn:number}>}
 */
export async function limitarFrecuencia(env, request, {ambito, maximo = 12, ventanaSeg = 600} = {}, ahora = Date.now()){
  const ip = ipDe(request);
  if (!ip || !env?.PRESENTATION_IDEAS || !ambito) return {permitido:true, restantes:maximo, reintentarEn:0};
  const tramo = Math.floor(ahora / (ventanaSeg * 1000));
  const clave = `rate:${ambito}:${ip}:${tramo}`;
  const reintentarEn = Math.ceil(((tramo + 1) * ventanaSeg * 1000 - ahora) / 1000);
  try {
    const usados = Number(await env.PRESENTATION_IDEAS.get(clave)) || 0;
    if (usados >= maximo) return {permitido:false, restantes:0, reintentarEn};
    await env.PRESENTATION_IDEAS.put(clave, String(usados + 1), {expirationTtl:Math.max(60, ventanaSeg + 60)});
    return {permitido:true, restantes:maximo - usados - 1, reintentarEn:0};
  } catch (_) { return {permitido:true, restantes:maximo, reintentarEn:0}; }
}
