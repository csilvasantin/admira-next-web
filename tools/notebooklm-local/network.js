// PLAZO EN EL PRODUCTOR LOCAL (MorfeoMacMini, 21-09-2026 · FLT-100780 b).
//
// El worker atiende la cola EN SERIE: reclamar, actualizar, subir el entregable y bajar el
// logo del cliente esperaban a producción sin reloj. Una sola llamada colgada paraba la cola
// entera —y el vigilante del productor sólo lo notaba horas después como «encallado»—.
// Con plazo, la llamada vence, processNext() registra el error y el bucle sigue.
//
// El cuerpo se lee DENTRO del plazo: un servidor que manda cabeceras y luego se calla dejaría
// colgado el `.json()` de después, ya fuera de cualquier reloj. Por eso se devuelve una
// Response con el cuerpo ya en memoria.
//
// Vive aparte y sin dependencias para poder probarlo sin arrancar puppeteer ni sharp.
export const API_TIMEOUT_MS = 30000;
export const UPLOAD_TIMEOUT_MS = 120000;
// La subida crece con el tamaño: 120 s de base + 4 s por MB (≈250 KB/s de subida mínima).
// Con un plazo fijo, un vídeo de 100 MB por una línea modesta vencería sin estar colgado.
export function plazoSubida(bytes){ return UPLOAD_TIMEOUT_MS + Math.ceil(Number(bytes || 0) / (1024 * 1024)) * 4000; }

const SIN_CUERPO = new Set([101, 204, 205, 304]);

export async function fetchConPlazo(url, init = {}, ms = API_TIMEOUT_MS, fetchImpl = globalThis.fetch){
  const signal = AbortSignal.timeout(ms);
  try {
    const response = await fetchImpl(url, {...init, signal});
    const body = SIN_CUERPO.has(response.status) ? null : await response.arrayBuffer();
    return new Response(body, {status:response.status, statusText:response.statusText, headers:response.headers});
  } catch (error) {
    if (!signal.aborted) throw error;
    // Un plazo vencido NO prueba que producción no aplicara la operación (un claim o una
    // subida pueden haber entrado): se dice, para que nadie reintente a ciegas.
    const ruta = (() => { try { return new URL(url).pathname; } catch (_) { return String(url); } })();
    throw new Error(`Producción no respondió entera en ${ms / 1000} s (${String(init.method || 'GET')} ${ruta}). Revisa el estado del encargo antes de reintentar: la operación pudo aplicarse.`);
  }
}
