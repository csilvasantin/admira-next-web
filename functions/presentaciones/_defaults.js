/*
 * UNA CLAVE POR PRESENTACIÓN, NO UNA PARA TODAS (Neo · MBP14, 02-09-2026).
 * Hasta hoy, toda presentación creada sin escribir contraseña recibía la misma
 * constante 'AdmiraNeXT;)' — «débil, pero entrañable», decía la ayuda del formulario.
 * El problema no es la fuerza de la clave: es que era COMPARTIDA, y los slugs son
 * adivinables (/presentaciones/lenovo/, /caixa/, /nvidia/), así que un cliente con su
 * deck podía abrir los de los demás. El formulario, además, prometía otra cosa:
 * «Si se deja vacía, se genera automáticamente». Ahora la promesa se cumple.
 * Se conserva el guiño de la casa en el prefijo, y la aleatoriedad va detrás.
 */
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'; // sin l/I/O/0/1

export function createPresentationPassword(length = 12){
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let cuerpo = '';
  for (const byte of bytes) cuerpo += ALFABETO[byte % ALFABETO.length];
  return `AdmiraNeXT-${cuerpo}`;
}

export function ensureHttpsUrl(value, max = 500){
  const cleaned = String(value == null ? '' : value).replace(/\r\n?/g, '\n').trim();
  if (!cleaned) return '';
  if (/^https:\/\//i.test(cleaned)) return cleaned.slice(0, max);
  if (/^http:\/\//i.test(cleaned)) return `https://${cleaned.slice(7)}`.slice(0, max);
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(cleaned)) return cleaned.slice(0, max);
  return `https://${cleaned.replace(/^\/+/, '')}`.slice(0, max);
}
