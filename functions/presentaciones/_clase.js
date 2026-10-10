/*
 * Etiqueta del catálogo de presentaciones (encargo #5547).
 * cliente · prospecto · interno. La etiqueta guardada manda; si no hay, se deduce.
 * Internas que citó Carlos: Cápsula, Prioridad DeepAgents, PRUEBA flota,
 * Alta asíncrona, Consejo. Un prospecto activo no cuenta como cliente.
 */

const CLASES = new Set(['cliente', 'prospecto', 'interno']);

function fold(value) {
  return String(value == null ? '' : value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function esInterna(item) {
  const slug = fold(item && item.slug);
  const texto = fold([item && item.slug, item && item.displayName].filter(Boolean).join(' '));
  if (!texto) return false;
  if (/capsul|deepagent|alta asinc/.test(texto)) return true;
  if (/(^| )consejo( |$)/.test(texto)) return true;
  if (/prueba flota|prioridad deep/.test(texto)) return true;
  return /^(capsula|consejo|prueba|flota|alta|prioridad|deepagent)(-|$)/.test(slug);
}

function esProspecto(item) {
  const p = item && item.prospect;
  return Boolean(p && (p.activo === true || p.marca || p.nombre || p.cliente));
}

export function clasificarPresentacion(item) {
  const guardada = fold(item && item.clase);
  if (CLASES.has(guardada)) return guardada;
  if (esInterna(item)) return 'interno';
  if (esProspecto(item)) return 'prospecto';
  return 'cliente';
}

export function contarClases(lista) {
  const n = { cliente: 0, prospecto: 0, interno: 0 };
  for (const item of lista || []) n[clasificarPresentacion(item)] += 1;
  return n;
}
