// Catálogo de demos (Carlos, 7-oct-2026, demo Alsea · Starbucks).
// Demos globales = plataformas (las mismas ids que /demo del ⌘ Experto, suite/experto.js).
// Subdemos = funcionalidades dentro de cada una: URL que se abre y, si hace falta, la orden de Experto.
// Solo se listan subdemos con URL pública existente; las del gemelo Starbucks usan alsea-sbux-021.
const STORE = 'https://www.admira.store/admira-xp/?marca=starbucks&loc=alsea-sbux-021&project=starbucks&circuit=alsea_starbucks&lang=es';

// Para empezar (Carlos, 7-oct-2026): tres plataformas, admira.biz, admira.store y admira.studio.
export const GLOBALES = [
  {id: 'biz', nombre: 'admira.biz', desc: 'Negocio: alta del proyecto y de todo lo que se gestiona y comercializa', url: 'https://www.admira.biz/backoffice.html', subdemos: [
    {id: 'proyecto', letra: 'a', nombre: 'Alta de proyecto', desc: 'ID estable, nombre y circuito; desde el backoffice de admira.biz, «Proyectos · AdmiraNext»', url: 'https://www.admiranext.com/xpace/manage'},
    {id: 'circuito', letra: 'b', nombre: 'Alta de circuito', desc: 'El circuito (p. ej. alsea_starbucks) se fija al dar de alta el proyecto y no cambia después', url: 'https://www.admiranext.com/xpace/manage'},
    {id: 'gemelo', letra: 'c', nombre: 'Alta de gemelo digital', desc: '«+ Nuevo Xpace» en el backoffice: local, dirección, mapa y Xpacio asociado', url: 'https://www.admira.biz/backoffice.html'},
    {id: 'iot', letra: 'd', nombre: 'Alta de elementos IoT', desc: 'Surfaces del Xpace: pantallas y players del local («+ Añadir surface»)', url: 'https://www.admira.biz/backoffice.html'},
    {id: 'itil', letra: 'e', nombre: 'Alta ITIL', desc: 'Listado de los elementos a gestionar y comercializar, con su referencia ITIL', url: 'https://www.xpaceos.com/inventario/starbucks/?view=references'}
  ]},
  {id: 'store', nombre: 'admira.store', desc: 'Gemelo digital de la tienda en Matrix', url: STORE + '&demo=tpv#tpv', subdemos: [
    {id: 'tpv', nombre: 'TPV', desc: 'Un muffin viaja a la caja y dispara música y pantallas', url: STORE + '&demo=tpv#tpv', cmd: '/demo tpv'},
    {id: 'signage', nombre: 'Digital signage', desc: 'Playlists separadas de pared, TPV, iPad e hilo musical', url: STORE},
    {id: 'reglas', nombre: 'IF·THEN·DO', desc: 'Reacciones: música, locución, imagen o vídeo al coger un producto', url: STORE, cmd: '/ifthendothat'},
    {id: 'sincro', nombre: 'Sincro IA', desc: 'Pantallas sincronizadas por IA', url: STORE, cmd: '/sincro ia'},
    {id: 'navidad', nombre: 'Modo Navidad', desc: 'Campaña estacional en toda la tienda', url: STORE, cmd: '/navidad on'},
    {id: 'avatar', nombre: 'Avatar digital', desc: 'Admirito atiende en la pared de ladrillo', url: STORE, cmd: '/avatar digital good'},
    {id: 'resumen', nombre: 'Resumen del día', desc: 'Balance de la jornada del gemelo', url: STORE, cmd: '/resumen dia on'}
  ]},
  {id: 'studio', nombre: 'admira.studio', desc: 'Creatividad y contenidos con IA', url: 'https://www.admira.studio/anonimizador', subdemos: [
    {id: 'anonimizador', nombre: 'Anonimizador', desc: 'Visitante → personaje 8, 16 y 32 bits listo para el gemelo', url: 'https://www.admira.studio/anonimizador'},
    {id: 'imagenes', nombre: 'Imágenes IA', desc: 'Generación de imágenes de marca', url: 'https://www.admira.studio/imagenes.html'},
    {id: 'musica', nombre: 'Música', desc: 'Hilo musical y catálogo de pistas', url: 'https://www.admira.studio/musica.html'},
    {id: 'megafonia', nombre: 'Megafonía', desc: 'Locuciones para tienda', url: 'https://www.admira.studio/megafonia/'}
  ]}
];

export const PROYECTOS_INICIALES = [
  {id: 'alsea-starbucks', nombre: 'Alsea · Starbucks', nota: 'España y México · gemelo alsea-sbux-021', demos: ['biz', 'biz/proyecto', 'biz/circuito', 'biz/gemelo', 'biz/iot', 'biz/itil', 'store', 'store/tpv', 'studio']}
];

// 'store' = demo global; 'store/tpv' = subdemo. Devuelve {global, sub|null} o null.
export function resolver(clave) {
  const [g, s] = String(clave || '').split('/');
  const global = GLOBALES.find((x) => x.id === g);
  if (!global) return null;
  if (!s) return {global, sub: null};
  const sub = global.subdemos.find((x) => x.id === s);
  return sub ? {global, sub} : null;
}

// Guion de un proyecto en el orden del catálogo (plataformas y dentro sus subdemos).
export function guion(demos) {
  const set = new Set(demos || []);
  const pasos = [];
  for (const g of GLOBALES) {
    if (set.has(g.id)) pasos.push({clave: g.id, titulo: g.nombre, desc: g.desc, url: g.url, cmd: '/demo ' + g.id});
    for (const s of g.subdemos) if (set.has(g.id + '/' + s.id)) pasos.push({clave: g.id + '/' + s.id, titulo: g.nombre + ' · ' + (s.letra ? s.letra + '. ' : '') + s.nombre, desc: s.desc, url: s.url, cmd: s.cmd || ''});
  }
  return pasos;
}

export function guionTexto(proyecto) {
  const pasos = guion(proyecto.demos);
  return [proyecto.nombre + ' · guion de demo', ...pasos.map((p, i) => (i + 1) + '. ' + p.titulo + ' — ' + p.desc + '\n   ' + p.url + (p.cmd ? '\n   Experto: ' + p.cmd : ''))].join('\n');
}
