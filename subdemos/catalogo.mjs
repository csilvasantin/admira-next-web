// Catálogo de demos (Carlos, 7-oct-2026, demo Alsea · Starbucks).
// Demos globales = las cinco soluciones (mismas que /demo del ⌘ Experto, suite/experto.js).
// Subdemos = funcionalidades dentro de cada una: URL que se abre y, si hace falta, la orden de Experto.
// Solo se listan subdemos con URL pública existente; las del gemelo Starbucks usan alsea-sbux-021.
const STORE = 'https://www.admira.store/admira-xp/?marca=starbucks&loc=alsea-sbux-021&project=starbucks&circuit=alsea_starbucks&lang=es';

export const GLOBALES = [
  {id: 'studio', nombre: 'admira.studio', desc: 'Creatividad y contenidos con IA', url: 'https://www.admira.studio/anonimizador', subdemos: [
    {id: 'anonimizador', nombre: 'Anonimizador', desc: 'Visitante → personaje 8, 16 y 32 bits listo para el gemelo', url: 'https://www.admira.studio/anonimizador'},
    {id: 'imagenes', nombre: 'Imágenes IA', desc: 'Generación de imágenes de marca', url: 'https://www.admira.studio/imagenes.html'},
    {id: 'musica', nombre: 'Música', desc: 'Hilo musical y catálogo de pistas', url: 'https://www.admira.studio/musica.html'},
    {id: 'megafonia', nombre: 'Megafonía', desc: 'Locuciones para tienda', url: 'https://www.admira.studio/megafonia/'}
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
  {id: 'tv', nombre: 'admira.tv', desc: 'Canal, calle y audiencia', url: 'https://admira.tv/adcelerate/demo/?view=human&site=starbucks', subdemos: [
    {id: 'calle', nombre: 'Fachada → Matrix', desc: 'Starbucks Passeig de Gràcia 103 desde la calle', url: 'https://admira.tv/adcelerate/demo/?view=human&site=starbucks'},
    {id: 'audiencia', nombre: 'Audiencia', desc: 'Videoanalytics: quién mira y cuánto', url: 'https://admira.tv/videoanalytics/xtore/'}
  ]},
  {id: 'app', nombre: 'admira.app · Yokup', desc: 'Operación de la red', url: 'https://www.yokup.com/retailer?marca=starbucks', subdemos: [
    {id: 'red', nombre: 'Red de tiendas', desc: 'Estado de cada tienda Starbucks', url: 'https://www.yokup.com/retailer?marca=starbucks'},
    {id: 'itil', nombre: 'Inventario ITIL', desc: 'Equipos e incidencias por referencia', url: 'https://www.xpaceos.com/inventario/starbucks/'}
  ]},
  {id: 'biz', nombre: 'admira.biz', desc: 'Comercialización y retail media', url: 'https://www.admira.biz/', subdemos: [
    {id: 'retailmedia', nombre: 'Retail media', desc: 'Campañas de marca sobre las pantallas de la red', url: 'https://www.admira.biz/'},
    {id: 'dooh', nombre: 'DOOH en vivo', desc: 'Pixer Feed sobre pantallas reales de Clear Channel', url: 'https://www.admira.studio/clearchannel/'}
  ]}
];

export const PROYECTOS_INICIALES = [
  {id: 'alsea-starbucks', nombre: 'Alsea · Starbucks', nota: 'España y México · gemelo alsea-sbux-021', demos: ['studio', 'store', 'store/tpv', 'tv', 'app', 'biz']}
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

// Guion de un proyecto en el orden del catálogo (las cinco soluciones y dentro sus subdemos).
export function guion(demos) {
  const set = new Set(demos || []);
  const pasos = [];
  for (const g of GLOBALES) {
    if (set.has(g.id)) pasos.push({clave: g.id, titulo: g.nombre, desc: g.desc, url: g.url, cmd: '/demo ' + g.id});
    for (const s of g.subdemos) if (set.has(g.id + '/' + s.id)) pasos.push({clave: g.id + '/' + s.id, titulo: g.nombre + ' · ' + s.nombre, desc: s.desc, url: s.url, cmd: s.cmd || ''});
  }
  return pasos;
}

export function guionTexto(proyecto) {
  const pasos = guion(proyecto.demos);
  return [proyecto.nombre + ' · guion de demo', ...pasos.map((p, i) => (i + 1) + '. ' + p.titulo + ' — ' + p.desc + '\n   ' + p.url + (p.cmd ? '\n   Experto: ' + p.cmd : ''))].join('\n');
}
