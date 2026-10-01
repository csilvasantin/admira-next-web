/*!
 * logo-paleta.js · v1.0.0 · Marca blanca de la Galaxia Admira (navegador)
 * Lo que necesita el NAVEGADOR para trabajar con el logo de una marca, compartido por el panel
 * prospect del generador (assets/presentation-prospect.js) y «Tu marca · introduce una URL» de
 * /marcablanca (marcablanca/propuesta.js):
 *   - coloresDeImagen(src) → histograma [{hex, peso}] de un logo (ignora transparencias); con
 *                            marca.js → paletaDesdeColores() da primario, secundario y acento.
 *   - aligerar(dataUrl)    → reduce un logo de mapa de bits a ≤ 512 px para que viaje ligero.
 *   - leerArchivo(file)    → File → data: URL.
 * Un logo de otro dominio sin CORS no se puede leer (canvas «contaminado»): por eso /marcablanca
 * recibe el logo ya como data: desde /marcablanca/api/analizar.
 */
export const LOGO_MAX = 120 * 1024;

export function leerArchivo(file) {
  return new Promise((ok, ko) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = ko; r.readAsDataURL(file); });
}
export function cargarImagen(src) {
  return new Promise((ok, ko) => { const img = new Image(); img.crossOrigin = 'anonymous'; img.onload = () => ok(img); img.onerror = () => ko(new Error('No se pudo cargar el logo.')); img.src = src; });
}
/** Reduce un logo de mapa de bits a ≤ 512 px y lo recodifica (PNG o WebP) para que viaje ligero. */
export async function aligerar(dataUrl) {
  if (dataUrl.startsWith('data:image/svg+xml')) return dataUrl;
  const img = await cargarImagen(dataUrl);
  const k = Math.min(1, 512 / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  const png = c.toDataURL('image/png');
  return png.length * 0.75 <= LOGO_MAX ? png : c.toDataURL('image/webp', 0.9);
}
/** Histograma de colores de un logo (ignora transparencias). Falla si la imagen es de otro origen sin CORS. */
export async function coloresDeImagen(src) {
  const img = await cargarImagen(src);
  const w = img.naturalWidth || 160, h = img.naturalHeight || 160, k = Math.min(1, 160 / Math.max(w, h));
  const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
  const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0, c.width, c.height);
  const d = ctx.getImageData(0, 0, c.width, c.height).data, cubos = new Map();
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 160) continue;
    const clave = ((d[i] >> 4) << 8) | ((d[i + 1] >> 4) << 4) | (d[i + 2] >> 4);
    const b = cubos.get(clave) || {r: 0, g: 0, b: 0, n: 0};
    b.r += d[i]; b.g += d[i + 1]; b.b += d[i + 2]; b.n += 1; cubos.set(clave, b);
  }
  const hex = (v) => Math.round(v).toString(16).padStart(2, '0');
  return [...cubos.values()].sort((a, b) => b.n - a.n).slice(0, 24).map((b) => ({hex: ('#' + hex(b.r / b.n) + hex(b.g / b.n) + hex(b.b / b.n)).toUpperCase(), peso: b.n}));
}
