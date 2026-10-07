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
  {id: 'studio', nombre: 'admira.studio', desc: 'Contenidos con IA: locución, música, imagen, vídeo y formatos', url: 'https://www.admira.studio/', subdemos: [
    {id: 'voz', letra: 'a', nombre: 'Crear locución', desc: 'De un guion breve a una voz lista para escuchar.', url: 'https://www.admira.studio/audio.html', cmd: '/demo 1', aliases: ['locucion', 'voz']},
    {id: 'musica', letra: 'b', nombre: 'Crear música', desc: 'Del ambiente de una marca a su hilo musical.', url: 'https://www.admira.studio/musica.html', cmd: '/demo 2', aliases: ['musica']},
    {id: 'imagen', letra: 'c', nombre: 'Crear imagen', desc: 'Del briefing a una creatividad visual.', url: 'https://www.admira.studio/imagenes.html', cmd: '/demo 3', aliases: ['imagen']},
    {id: 'video', letra: 'd', nombre: 'Crear vídeo', desc: 'De una imagen al movimiento de un clip.', url: 'https://www.admira.studio/video.html', cmd: '/demo 4', aliases: ['video']},
    {id: 'adaptar', letra: 'e', nombre: 'Adaptar formatos', desc: 'Una misma pieza en horizontal, vertical, cuadrado y barra.', url: 'https://www.admira.studio/adaptaciones/', cmd: '/demo 5', aliases: ['adaptar', 'formatos', 'adaptacion']}
  ]}
];

export const PROYECTOS_INICIALES = [
  {id: 'alsea-starbucks', nombre: 'Alsea · Starbucks', nota: 'España y México · gemelo alsea-sbux-021', demos: ['biz', 'biz/proyecto', 'biz/circuito', 'biz/gemelo', 'biz/iot', 'biz/itil', 'store', 'store/tpv', 'studio', 'studio/voz', 'studio/musica', 'studio/imagen', 'studio/video', 'studio/adaptar']}
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
// Ids anteriores de Studio (antes del pack de Trinity) que pueden seguir guardados en un navegador.
export const RENOMBRADAS = {'studio/locucion': 'studio/voz', 'studio/formatos': 'studio/adaptar'};
export function guion(demos) {
  const set = new Set((demos || []).map((d) => RENOMBRADAS[d] || d));
  const pasos = [];
  for (const g of GLOBALES) {
    if (set.has(g.id)) pasos.push({clave: g.id, titulo: g.nombre, desc: g.desc, url: g.url, cmd: '/demo ' + g.id, steps: []});
    for (const s of g.subdemos) if (set.has(g.id + '/' + s.id)) pasos.push({clave: g.id + '/' + s.id, titulo: g.nombre + ' · ' + (s.letra ? s.letra + '. ' : '') + s.nombre, desc: s.desc, url: s.url, cmd: s.cmd || '', steps: s.steps || [], guion: s.guion || [], muestra: s.muestra || null});
  }
  return pasos;
}

export function guionTexto(proyecto) {
  const pasos = guion(proyecto.demos);
  return [proyecto.nombre + ' · guion de demo', ...pasos.map((p, i) => (i + 1) + '. ' + p.titulo + ' — ' + p.desc + '\n   ' + p.url + (p.cmd ? '\n   Experto: ' + p.cmd : '') + (p.muestra && p.muestra.url ? '\n   Muestra: ' + p.muestra.url : '') +
    [...(p.steps || []), ...(p.guion || [])].map((x) => '\n   - ' + pasoTexto(x)).join(''))].join('\n');
}
// Un paso puede ser texto o un objeto del manifiesto ({accion, selector, texto} del guion de Trinity).
export function pasoTexto(x) {
  if (x == null) return '';
  if (typeof x !== 'object') return String(x);
  const t = x.texto || x.text || x.descripcion || x.titulo || '';
  return (x.accion ? x.accion + ': ' : '') + (t || JSON.stringify(x));
}

// Manifiesto por plataforma (<plataforma>.subdemos.json, 7-oct-2026):
// {version, plataforma, default_mode, activacion, subdemos:[{id, letra, nombre, desc, url, cmd, aliases, muestra:{tipo, url, variantes},
// guion:[{selector, accion, texto}], steps}]} (contrato de Trinity, pixeria demo/studio.subdemos.json). steps, muestra, guion
// y variantes se conservan como objetos; ejecucion_real_opcional se guarda como dato y nunca se ejecuta desde aquí.
// Sustituye las subdemos de esa plataforma. Devuelve la plataforma aplicada o lanza Error.
export const MANIFIESTOS = ['studio'];
export function aplicarManifiesto(m) {
  const g = m && GLOBALES.find((x) => x.id === m.plataforma);
  if (!g) throw new Error('plataforma desconocida');
  if (!Array.isArray(m.subdemos) || !m.subdemos.length) throw new Error('sin subdemos');
  const subs = m.subdemos.map((x) => {
    if (!x || !/^[a-z0-9-]{1,40}$/.test(x.id) || !x.nombre || !/^https:\/\//.test(x.url || '')) throw new Error('subdemo no válida: ' + (x && x.id));
    const s = JSON.parse(JSON.stringify(x));
    Object.assign(s, {id: x.id, nombre: String(x.nombre), desc: String(x.desc || ''), url: x.url});
    if (x.letra) s.letra = String(x.letra);
    if (x.cmd) s.cmd = String(x.cmd);
    if (!Array.isArray(s.steps)) delete s.steps;
    if (!Array.isArray(s.guion)) delete s.guion;
    if (!Array.isArray(s.aliases)) delete s.aliases;
    if (s.muestra && (typeof s.muestra !== 'object' || !/^https:\/\//.test(s.muestra.url || ''))) delete s.muestra;
    return s;
  });
  if (new Set(subs.map((x) => x.id)).size !== subs.length) throw new Error('ids repetidos');
  g.subdemos = subs;
  return g.id;
}
