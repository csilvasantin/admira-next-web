// LÍMITE DE INTENTOS DE LOGIN (MorfeoMacMini, 21-09-2026 · FLT-100778 a).
//
// Las tres puertas que aceptan contraseña —/presentaciones, /presentations y /presites—
// comparaban sin límite: cualquiera podía probar contraseñas sin fin contra la maestra,
// la de editor, la genérica y las de cada cliente. La recuperación sí tenía tope; el
// login, que es lo que se ataca, no.
//
// El contador es POR IP Y COMÚN A LAS TRES PUERTAS, a propósito. La maestra vale en
// cualquier slug —incluso en uno que no existe—, así que un contador por IP+presentación
// se esquivaba cambiando de slug cada pocos intentos, y uno por puerta, cambiando de
// puerta. Sólo se bloquea a la IP que falla: un atacante no puede dejar fuera a un
// cliente legítimo que entra desde otra conexión, y un acierto borra el contador.
//
// Vive en el mismo KV que la recuperación. KV es eventualmente consistente y acepta una
// escritura por segundo por clave: una ráfaga paralela puede colar algún intento de más
// antes de que el contador se propague. Es un freno, no una garantía criptográfica —
// que la contraseña sea larga sigue siendo la primera defensa.
export const LOGIN_FAIL_LIMIT = 10;
export const LOGIN_WINDOW_SEC = 15 * 60;
export const LOGIN_LOCKOUT_SEC = 15 * 60;

const rateKey = ip => `access:login-rate:${ip}`;
// Cloudflare siempre pone CF-Connecting-IP en producción. Sin ella (pruebas locales) no
// se limita: agrupar a todos bajo una clave «desconocida» bloquearía a justos por pecadores.
const clientIp = request => String(request.headers.get('CF-Connecting-IP') || '').trim();

// Segundos de bloqueo que le quedan a esta IP (0 = puede intentarlo).
export async function loginLockout(env, request, now = Date.now()){
  const ip = clientIp(request);
  if (!ip || !env?.PRESENTATION_IDEAS) return 0;
  try {
    const record = await env.PRESENTATION_IDEAS.get(rateKey(ip), {type:'json'});
    const left = Math.ceil((Number(record?.blockedUntil || 0) - now) / 1000);
    return left > 0 ? left : 0;
  } catch (_) { return 0; }
}

// Anota el resultado de un intento. Un fallo suma (y al llegar al tope bloquea); un
// acierto borra el historial de esa IP. Nunca rompe el login: si KV falla, se sigue.
export async function noteLoginAttempt(env, request, ok, now = Date.now()){
  const ip = clientIp(request);
  if (!ip || !env?.PRESENTATION_IDEAS) return;
  const key = rateKey(ip);
  try {
    if (ok) { await env.PRESENTATION_IDEAS.delete(key); return; }
    let record = await env.PRESENTATION_IDEAS.get(key, {type:'json'});
    if (!record || !Number(record.first) || now - Number(record.first) > LOGIN_WINDOW_SEC * 1000) record = {fails:0, first:now};
    record.fails = Number(record.fails || 0) + 1;
    if (record.fails >= LOGIN_FAIL_LIMIT) record.blockedUntil = now + LOGIN_LOCKOUT_SEC * 1000;
    const vida = record.blockedUntil
      ? LOGIN_LOCKOUT_SEC
      : LOGIN_WINDOW_SEC - Math.floor((now - record.first) / 1000);
    await env.PRESENTATION_IDEAS.put(key, JSON.stringify(record), {expirationTtl:Math.max(60, vida)});
  } catch (_) { /* KV caído o escritura limitada: el login sigue funcionando. */ }
}

export function lockoutMessage(seconds, language = 'es'){
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  return language === 'en'
    ? `Too many failed attempts from your connection. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`
    : `Demasiados intentos fallidos desde tu conexión. Vuelve a probar en ${minutes} minuto${minutes === 1 ? '' : 's'}.`;
}
