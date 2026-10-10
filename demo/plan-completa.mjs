/**
 * plan-completa.mjs · plan de la DEMO COMPLETA AdmiraNeXT (merovingio · 06-10-2026).
 * v2 (06-10-2026): decisiones de Carlos — 1 altavoz con 2 playlists (hilo musical continuo +
 * locuciones disparadas desde el TPV), 3 equipos físicos y 4 playlists por local; marca
 * blanca SIEMPRE con la marca real del cliente (/marca <cliente> en las 5 plataformas);
 * contenido común de marca y desconexiones temporales por local preparadas (apagadas).
 *
 * Módulo puro (sin DOM ni red): lo usan el formulario /demo (navegador), la API
 * /api/demo (Cloudflare Pages Function) y los tests. Convierte lo que se rellena en
 * el formulario en el PLAN de los 7 pasos sobre los 5 componentes:
 *
 *   1 admira.app   cliente franquicia (cuenta de marca Yokup) + su marca blanca real
 *                  (/marcablanca → `/marca <cliente>` en studio/pixeria, store, tv, app, biz)
 *   2 admira.biz   ≥4 establecimientos reales en el mapa (dirección + coordenadas)
 *   3 admira.store un gemelo digital por establecimiento
 *   4 admira.app   inventario ITIL (Yokup): ≥3 equipos IoT por establecimiento
 *                  (altavoz, pantalla vertical, pantalla horizontal)
 *   5 admira.tv    ≥4 playlists por establecimiento  <cliente>.<xpacio>.<canal>
 *                  (el altavoz lleva 2: hilomusical continuo + locuciones bajo demanda TPV)
 *   6 pixeria      3 contenidos por playlist (canciones, locuciones, visuales V/H),
 *                  comunes a toda la marca
 *   7 admira.app   comprobación final
 *
 * NO ejecuta nada: describe qué se escribiría, dónde y con qué nombre. Compatible con la
 * cola existente: legacyPayload() devuelve los campos que ya entiende procesar_cola.py.
 */

export const SCHEMA = 'admiranext.demo-completa/2';
// dispositivos = equipos FÍSICOS (CIs ITIL); playlists = canales de emisión (el altavoz lleva 2).
export const MINIMOS = Object.freeze({ establecimientos: 4, dispositivos: 3, playlists: 4, contenidos: 3 });

// Tipos de Xpacio que ya acepta crear_demo.py (--xpacio-tipo). No se añaden tipos nuevos
// para no romper su argparse: el matiz va en xpacio_subtipo (p. ej. «panaderia»).
export const XPACIO_TIPOS = Object.freeze({
  demostore: { autostart: 'shoptalk', kind: 'DemoStore', label: 'DemoStore' },
  estanco: { autostart: 'xtanco', kind: 'Estanco', label: 'Estanco' },
  cafeteria: { autostart: 'cafeteria', kind: 'Cafetería', label: 'Cafetería' },
  other: { autostart: 'xtanco', kind: 'Retail', label: 'Otro' },
});

// Equipos IoT FÍSICOS (cada uno es un CI ITIL). Los tres primeros son el MÍNIMO (siempre
// marcados); el resto, extras. Cada equipo lleva sus playlists (canales):
//   reproduccion «continua»     → suena/emite en bucle todo el horario
//   reproduccion «bajo_demanda» → no hace bucle: el TPV dispara una pieza cuando hace falta
// El ALTAVOZ es uno solo con DOS playlists separadas: hilo musical (continuo) y locuciones
// (aviso de cierre, emergencias, avisos puntuales) que se lanzan desde el TPV.
const pl = (canal, contenido, extra = {}) => Object.freeze({ canal, contenido, reproduccion: 'continua', bucle: true, disparo: null, ...extra });
export const DISPOSITIVOS = Object.freeze([
  { id: 'altavoz', nombre: 'Altavoz (hilo musical + locuciones)', categoria: 'audio', rol: 'audio', orientacion: '', codigo: 'ALTV', minimo: true,
    playlists: [
      pl('hilomusical', 'cancion'),
      pl('locuciones', 'locucion', { reproduccion: 'bajo_demanda', bucle: false, disparo: 'tpv', prioridad: 'sobre-hilomusical' }),
    ] },
  { id: 'vertical', nombre: 'Pantalla vertical 9:16', categoria: 'pantalla', rol: 'signage', orientacion: 'vertical', codigo: 'PANV', minimo: true, playlists: [pl('vertical', 'visual-9x16')] },
  { id: 'horizontal', nombre: 'Pantalla horizontal 16:9', categoria: 'pantalla', rol: 'signage', orientacion: 'horizontal', codigo: 'PANH', minimo: true, playlists: [pl('horizontal', 'visual-16x9')] },
  { id: 'escaparate', nombre: 'Pantalla escaparate', categoria: 'pantalla', rol: 'escaparate', orientacion: 'vertical', codigo: 'ESCA', minimo: false, playlists: [pl('escaparate', 'visual-9x16')] },
  { id: 'menuboard', nombre: 'Menu board (carta digital)', categoria: 'pantalla', rol: 'menu-board', orientacion: 'horizontal', codigo: 'MENU', minimo: false, playlists: [pl('menuboard', 'visual-16x9')] },
  { id: 'kiosko', nombre: 'Kiosko / tótem táctil', categoria: 'kiosk', rol: 'autoservicio', orientacion: 'vertical', codigo: 'KIOS', minimo: false, playlists: [pl('kiosko', 'visual-9x16')] },
  { id: 'aforo', nombre: 'Sensor de aforo', categoria: 'iot', rol: 'aforo', orientacion: '', codigo: 'AFOR', minimo: false, playlists: [] },
]);
// Ids de la v1 (dos altavoces): se aceptan y se pliegan en el altavoz único.
const ALIAS_DISPOSITIVO = Object.freeze({ hilomusical: 'altavoz', locuciones: 'altavoz' });

// Locuciones bajo demanda: qué evento del TPV dispara cada una (en este orden).
export const EVENTOS_TPV = Object.freeze([
  { id: 'cierre', nombre: 'Aviso de cierre' },
  { id: 'emergencia', nombre: 'Emergencia · evacuación' },
  { id: 'puntual', nombre: 'Aviso puntual' },
]);

// Marca blanca: siempre la marca REAL del cliente, aplicada con `/marca <id>` (CLI Experto,
// suite/experto.js) en las 5 plataformas. Catálogo único: admiranext.com/marcablanca.
export const PLATAFORMAS_MARCA = Object.freeze([
  { id: 'studio', nombre: 'admira.studio · pixeria', url: 'https://www.admira.studio/', alt: 'https://www.pixeria.com/' },
  { id: 'store', nombre: 'admira.store', url: 'https://www.admira.store/' },
  { id: 'tv', nombre: 'admira.tv', url: 'https://admira.tv/' },
  { id: 'app', nombre: 'admira.app', url: 'https://admira.app/' },
  { id: 'biz', nombre: 'admira.biz', url: 'https://www.admira.biz/' },
]);

export const FUENTES_CONTENIDO = Object.freeze(['pixeria', 'stock']);

const URLS = {
  app: 'https://admira.app',
  biz: 'https://www.admira.biz/',
  catalogo: 'https://brain.digitalavatar.ai/locations',
  twin: 'https://www.admira.store/admira-xp/',
  itilLectura: 'https://data.yokup.com/api/itil/xpacios/',
  itilMcp: 'https://yokup.com/mcp',
  xpl: 'https://xpl.admira.store/playlists',
  tvPlaylist: 'https://admira.tv/api/playlist',
  api: 'https://api.admira.store',
  pixeria: 'https://www.pixeria.com',
  marcablanca: 'https://www.admiranext.com/marcablanca/',
  marcas: 'https://www.admiranext.com/marcablanca/api/marcas',
  analizar: 'https://www.admiranext.com/marcablanca/api/analizar',
  guardarMarca: 'https://www.admiranext.com/presentaciones/api/marcas',
};

// Estado de cada paso tras el dry-run del 06-10-2026, revisado con las decisiones de Carlos
// (v2, mismo día). Ver demo-completa-RESUMEN.md.
export const ESTADO_FECHA = '06-10-2026';
export const ESTADO_HOY = Object.freeze({
  1: { estado: 'PARCIAL', falta: 'La cuenta de marca nace sola en Yokup cuando sincroniza Xpacios con gemelo (external.brand); no hay alta directa de «cliente franquicia». La marca blanca real se crea en el catálogo de /marcablanca (analizar la web + guardar, con sesión del generador): hoy 365 no está (GET /marcablanca/api/marcas/365 → 404). `/marca 365` existe en el CLI Experto de las 5 plataformas.' },
  2: { estado: 'PARCIAL', falta: 'PUT del catálogo listo (crear_demo.py paso circuito), pero hoy usa presets de ciudad (1 Xpacio céntrico por ciudad). Falta aceptar la lista de establecimientos reales.' },
  3: { estado: 'LISTO', falta: 'Gemelo por Xpacio vía campo twin. No hay escena «panadería»: 365 usa autostart=cafeteria.' },
  4: { estado: 'PARCIAL', falta: 'itil_ci_upsert (MCP de flota yokup.com/mcp) existe con categoría y orientación: 3 CIs por local (altavoz, pantalla V, pantalla H). crear_demo.py no lo llama y el Xpacio debe estar antes sincronizado en Yokup (cron 2 min, pasadas cada 15 min).' },
  5: { estado: 'PARCIAL', falta: 'XPL y /api/playlist por pantalla existen; crear_demo.py crea UNA playlist <id>.xpacio.hilomusical. Faltan locuciones/vertical/horizontal por Xpacio y el disparo de locuciones desde el TPV (hoy megafonia/push + megafonia/next, sin evento de TPV).' },
  6: { estado: 'PARCIAL', falta: 'Motores listos (lyria3, megafonia/push, imagen/generate 9:16/16:9, stock/publish). crear_demo.py hace 2 canciones + 2 locuciones; faltan la 3.ª de cada (cierre · emergencia · aviso puntual) y los 6 visuales. Contenido común de marca: 12 piezas.' },
  7: { estado: 'FALTA', falta: 'Hay lecturas públicas (ITIL, playlist, grid/day) pero no un comprobador único ni players virtuales registrables sin sesión.' },
});

// Funciones nuevas de la v2 que no son un paso propio.
export const ESTADO_EXTRA = Object.freeze({
  marca_blanca: { estado: 'PARCIAL', falta: '365 no está en el catálogo único (se crea en el paso 1). /marca <id> está en el CLI Experto (suite/experto.js) de las 5 plataformas.' },
  disparo_tpv: { estado: 'FALTA', falta: 'No hay integración TPV → locución. megafonia/push existe; falta el evento del TPV (cierre, emergencia, aviso puntual).' },
  desconexiones: { estado: 'PROXIMAMENTE', falta: 'Modelo de datos preparado (desconexiones[] por local con ventana desde/hasta), vacío y apagado.' },
});

// Desconexiones temporales (PRÓXIMAMENTE): la misma playlist de marca con contenido propio de
// un local insertado durante una ventana de fechas. Hoy se guarda la forma, siempre vacía.
export const DESCONEXIONES = Object.freeze({
  activo: false,
  estado: 'proximamente',
  descripcion: 'Misma playlist de marca; durante una ventana [desde, hasta) un local inserta contenido propio en uno de sus canales y al acabar vuelve al contenido común.',
  esquema: Object.freeze({
    id: 'dsc_<xpacio>_<canal>_<AAAAMMDD>',
    canal: 'hilomusical | locuciones | vertical | horizontal | extras',
    desde: 'ISO 8601 con zona (inclusive)',
    hasta: 'ISO 8601 con zona (exclusiva)',
    modo: 'insertar',
    contenidos: '[{tipo, kind, titulo, …}] piezas propias del local',
    motivo: 'texto libre (fiesta del barrio, obra, promo local…)',
  }),
});

export function slug(texto, sep = '-') {
  return String(texto == null ? '' : texto)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, sep)
    .replace(new RegExp(`^\\${sep}+|\\${sep}+$`, 'g'), '');
}

export function ciudadCorta(ciudad) {
  const s = slug(ciudad, '');
  const conocidas = { barcelona: 'bcn', madrid: 'mad', valencia: 'vlc', london: 'lon', londres: 'lon', newyork: 'nyc', paris: 'par', milano: 'mil', lisboa: 'lis', mexico: 'mex', ciudaddemexico: 'mex', zaragoza: 'zgz', sevilla: 'svq', bilbao: 'bio' };
  return conocidas[s] || s.slice(0, 3) || 'xxx';
}

/** Código ITIL único: ^[A-Z0-9]{2,12}(-[A-Z0-9]{2,12}){1,3}$  (p. ej. 365BCN01-ALTV-01). */
export function itilCode(clienteId, ciudad, n, dispositivo, k = 1) {
  const cli = slug(clienteId, '').toUpperCase().slice(0, 5) || 'CLI';
  const ci = ciudadCorta(ciudad).toUpperCase().slice(0, 3);
  const head = `${cli}${ci}${String(n).padStart(2, '0')}`.slice(0, 12);
  return `${head}-${dispositivo.codigo}-${String(k).padStart(2, '0')}`;
}

export const ITIL_RE = /^[A-Z0-9]{2,12}(-[A-Z0-9]{2,12}){1,3}$/;
export const SCREEN_RE = /^[a-z0-9][a-z0-9-]{1,79}$/;

/** Nombre de playlist (convención ampliada de cliente.xpacio.hilomusical). */
export function playlistName(clienteId, xpacioSlug, canal) {
  return `${slug(clienteId)}.${slug(xpacioSlug)}.${canal}`;
}

export function playlistId(name) {
  return 'pl_' + String(name).replace(/[^a-z0-9]+/gi, '_').toLowerCase();
}

function num(v) {
  const n = typeof v === 'number' ? v : Number(String(v == null ? '' : v).replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
}

/** Normaliza y valida la entrada del formulario. Devuelve {ok, errores[], datos}. */
export function normalizar(entrada = {}) {
  const errores = [];
  const t = (v, max = 200) => String(v == null ? '' : v).trim().slice(0, max);
  const cliente = t(entrada.cliente || entrada.company, 80);
  const clienteId = slug(entrada.id_marca || cliente).slice(0, 40) || 'demo';
  const website = t(entrada.website || entrada.web, 300);
  const ciudadIn = entrada.ciudad && typeof entrada.ciudad === 'object' ? entrada.ciudad : { nombre: entrada.ciudad, pais: entrada.pais };
  const ciudad = t(ciudadIn.nombre, 60);
  const pais = t(ciudadIn.pais || entrada.pais || '', 2).toUpperCase();
  const xpacio_tipo = t(entrada.xpacio_tipo || 'cafeteria', 20).toLowerCase();
  const xpacio_subtipo = slug(t(entrada.xpacio_subtipo || '', 40));
  const nPedidos = Math.max(MINIMOS.establecimientos, Math.min(50, Math.trunc(num(entrada.n_establecimientos)) || MINIMOS.establecimientos));
  const contenidos = Math.max(MINIMOS.contenidos, Math.min(12, Math.trunc(num(entrada.contenidos_por_playlist)) || MINIMOS.contenidos));
  let idiomas = Array.isArray(entrada.idiomas) ? entrada.idiomas : String(entrada.idiomas || 'en,es').split(/[,;\s]+/);
  idiomas = [...new Set(idiomas.map((x) => t(x, 5).toLowerCase()).filter((x) => /^[a-z]{2}$/.test(x)))];
  if (!idiomas.length) idiomas = ['en', 'es'];
  const fuente = FUENTES_CONTENIDO.includes(entrada.fuente_contenido) ? entrada.fuente_contenido : 'pixeria';
  // v2: ya no se elige «marca del cliente / marca blanca». Siempre se crea la marca REAL del
  // cliente como marca blanca (id = cliente) y se aplica con `/marca <id>`.
  const avisos = [];
  const marcaIn = entrada.marca && typeof entrada.marca === 'object' ? entrada.marca : { modo: entrada.marca };
  if (marcaIn.modo === 'blanca' && marcaIn.id && slug(marcaIn.id) !== clienteId) {
    avisos.push(`La marca blanca es siempre la del cliente (${clienteId}); se ignora «${slug(marcaIn.id)}».`);
  }
  const simulacion = entrada.simulacion === undefined ? true : entrada.simulacion !== false && entrada.simulacion !== 'false' && entrada.simulacion !== 0;

  // Dispositivos: el mínimo SIEMPRE va; los extras se suman si vienen.
  const pedidos = new Set((Array.isArray(entrada.dispositivos) ? entrada.dispositivos : [])
    .map((d) => (typeof d === 'string' ? d : d && d.id)).filter(Boolean)
    .map((id) => ALIAS_DISPOSITIVO[id] || id));
  const dispositivos = DISPOSITIVOS.filter((d) => d.minimo || pedidos.has(d.id));

  const ests = (Array.isArray(entrada.establecimientos) ? entrada.establecimientos : []).slice(0, 50).map((e, i) => {
    const lat = num(e && e.lat); const lng = num(e && e.lng);
    const direccion = t(e && (e.direccion || e.addr), 200);
    return {
      ref: t(e && e.ref, 60),
      slug: slug(t(e && e.slug, 40)) || `${ciudadCorta(ciudad)}-${slug(direccion).split('-').filter((w) => !['carrer', 'calle', 'de', 'del', 'la', 'el', 'dels', 'placa', 'plaza', 'avinguda', 'avenida', 'ronda', 'passeig', 'paseo', 'c'].includes(w))[0] || String(i + 1)}`,
      nombre: t(e && e.nombre, 120) || `${cliente} · ${direccion}`,
      direccion,
      cp: t(e && e.cp, 10),
      barrio: t(e && e.barrio, 80),
      lat, lng,
      fuente: t(e && e.fuente, 120),
      fuente_url: t(e && e.fuente_url, 300),
    };
  });
  // Slugs únicos.
  const vistos = new Map();
  for (const e of ests) {
    const n = (vistos.get(e.slug) || 0) + 1; vistos.set(e.slug, n);
    if (n > 1) e.slug = `${e.slug}-${n}`;
  }

  if (!cliente) errores.push('Falta el cliente / marca.');
  if (website && !/^https?:\/\//i.test(website)) errores.push('La web debe ser una URL http(s).');
  if (!ciudad) errores.push('Falta la ciudad.');
  if (!/^[A-Z]{2}$/.test(pais)) errores.push('El país va en ISO-2 (ES, FR, GB…).');
  if (!XPACIO_TIPOS[xpacio_tipo]) errores.push(`Tipo de Xpacio inválido (vale: ${Object.keys(XPACIO_TIPOS).join(', ')}).`);
  if (ests.length < MINIMOS.establecimientos) errores.push(`Elige al menos ${MINIMOS.establecimientos} establecimientos (hay ${ests.length}).`);
  if (ests.length < nPedidos) errores.push(`Has pedido ${nPedidos} establecimientos y hay ${ests.length} elegidos.`);
  ests.forEach((e, i) => {
    if (!e.direccion) errores.push(`Establecimiento ${i + 1}: falta la dirección.`);
    if (!(e.lat >= -90 && e.lat <= 90) || !(e.lng >= -180 && e.lng <= 180)) errores.push(`Establecimiento ${i + 1}: coordenadas no válidas.`);
  });
  if (entrada.franquicia === false) errores.push('La demo completa es para marcas franquicia / cadena (marca «franquicia»).');
  // Contenido: de momento, común a toda la marca (decisión de Carlos, 06-10-2026).
  if (entrada.contenidos_compartidos === false) avisos.push('Contenido por local: aún no; de momento el contenido es común a toda la marca.');
  const dscIn = Array.isArray(entrada.desconexiones) ? entrada.desconexiones : [];
  if (dscIn.length) avisos.push(`Desconexiones temporales: próximamente. Se ignoran ${dscIn.length}.`);

  return {
    ok: errores.length === 0,
    errores,
    avisos,
    datos: {
      cliente, clienteId, website, color: /^#[0-9a-f]{6}$/i.test(entrada.color || '') ? String(entrada.color).toUpperCase() : '',
      franquicia: entrada.franquicia !== false,
      ciudad, pais, xpacio_tipo, xpacio_subtipo, n_establecimientos: Math.max(nPedidos, Math.min(ests.length, 50)),
      establecimientos: ests, dispositivos, contenidos, idiomas, fuente,
      marca: { modo: 'marca-blanca-cliente', id: clienteId },
      cierre: /^\d{1,2}:\d{2}$/.test(entrada.cierre || '') ? entrada.cierre : '21:00',
      contenidos_compartidos: true,
      simulacion,
      notas: t(entrada.notas, 500),
    },
  };
}

function contenidosDe(d, canal, idiomas, cierre, cliente) {
  const n = d.contenidos;
  const lang = (i) => idiomas[i % idiomas.length];
  const out = [];
  for (let i = 0; i < n; i++) {
    if (canal.contenido === 'cancion') {
      out.push({ tipo: 'audio', kind: 'song', lang: lang(i), titulo: `${lang(i).toUpperCase()} · ${cliente} Hilo · ${['Mañana de horno', 'Café y conversación', 'Tarde dulce', 'Pan del día'][i % 4]}`, motor: 'lyria3', endpoint: `${URLS.api}/lyria3/generate → /hilomusical/push` });
    } else if (canal.contenido === 'locucion') {
      const ev = EVENTOS_TPV[i % EVENTOS_TPV.length];
      const textos = { cierre: `Aviso de cierre ${cierre} · ${cliente}`, emergencia: `Emergencia · evacuación · ${cliente}`, puntual: `Aviso puntual · ${cliente}` };
      out.push({ tipo: 'audio', kind: 'voiceover', lang: lang(i), titulo: `${lang(i).toUpperCase()} · ${textos[ev.id]}`, evento_tpv: ev.id, disparo: 'tpv', motor: 'elevenlabs', endpoint: `${URLS.api}/megafonia/push` });
    } else if (canal.contenido.startsWith('visual')) {
      const ratio = canal.contenido === 'visual-9x16' ? '9:16' : '16:9';
      out.push({ tipo: 'video', kind: 'visual', ratio, titulo: `${cliente} · ${['Pan recién hecho', 'Café + bollería', 'Bocadillo del día', 'Pastelería'][i % 4]} · ${ratio}`, motor: 'imagen-4.0 → adaptador (imagen fija MP4)', endpoint: `${URLS.api}/imagen/generate → /stock/publish` });
    }
  }
  return out;
}

/** Marca blanca del cliente: siempre su marca real, creada en /marcablanca y aplicada con /marca. */
export function marcaBlanca(d) {
  const id = d.clienteId;
  return {
    modo: 'marca-blanca-cliente',
    id,
    nombre: d.cliente,
    web: d.website,
    tipo: 'real',
    comando: `/marca ${id}`,
    comando_off: '/marca off',
    plataformas: PLATAFORMAS_MARCA.map((p) => ({ id: p.id, nombre: p.nombre, url: `${p.url}?marca=${id}`, ...(p.alt ? { alt: `${p.alt}?marca=${id}` } : {}) })),
    referencia: URLS.marcablanca,
    catalogo: `${URLS.marcas}/${id}`,
    pasos: [
      { n: 1, accion: `Analizar ${d.website || 'la web del cliente'} (logo, paleta, tipografía; no guarda nada)`, endpoint: `POST ${URLS.analizar} {url}` },
      { n: 2, accion: `Guardar la marca «${d.cliente}» en el catálogo único (origen url, tipo real)`, endpoint: `POST ${URLS.guardarMarca} {marca, origen:"url", tipo:"real", web} · sesión del generador`, escritura: `marca:${id}` },
      { n: 3, accion: `Aplicar /marca ${id} en el CLI Experto: viste admira.studio/pixeria, admira.store, admira.tv, admira.app y admira.biz`, endpoint: `${URLS.marcablanca}?marca=${id}` },
    ],
    estado_hoy: ESTADO_EXTRA.marca_blanca.estado,
    falta: ESTADO_EXTRA.marca_blanca.falta,
  };
}

/** Plan completo (dry-run). No hace red. */
export function construirPlan(entrada = {}, { ahora = new Date().toISOString() } = {}) {
  const { ok, errores, avisos, datos: d } = normalizar(entrada);
  const tipo = XPACIO_TIPOS[d.xpacio_tipo] || XPACIO_TIPOS.cafeteria;
  const cc = ciudadCorta(d.ciudad);
  const circuito = `demo_${slug(d.clienteId, '_')}_${cc}`;
  const marca = marcaBlanca(d);
  // Contenido común de marca: la primera playlist de cada tipo genera las piezas y el resto las reutiliza.
  const unicos = { cancion: [], locucion: [], 'visual-9x16': [], 'visual-16x9': [] };

  const establecimientos = d.establecimientos.map((e, i) => {
    const xid = `${d.clienteId}-demo-${e.slug}`.slice(0, 80);
    const twin = `${URLS.twin}?autostart=${tipo.autostart}&visual=better&marca=${marca.id}&loc=${xid}&store=${xid}`;
    const equipos = d.dispositivos.map((disp) => {
      const playlists = disp.playlists.map((c) => {
        const nombre = playlistName(d.clienteId, e.slug, c.canal);
        let contenidos;
        if (unicos[c.contenido].length) contenidos = unicos[c.contenido];
        else { contenidos = contenidosDe(d, c, d.idiomas, d.cierre, d.cliente); unicos[c.contenido] = contenidos; }
        return {
          canal: c.canal,
          playlist: nombre,
          playlist_id: playlistId(nombre),
          reproduccion: c.reproduccion,
          bucle: c.bucle,
          disparo: c.disparo ? { origen: 'tpv', etiqueta: 'POS/TPV', eventos: EVENTOS_TPV.map((x) => x.id), endpoint: `${URLS.api}/megafonia/push` } : null,
          ...(c.prioridad ? { prioridad: c.prioridad } : {}),
          origen_contenido: 'marca',
          contenidos,
        };
      });
      return {
        dispositivo: disp.id,
        nombre: `${disp.nombre} · ${e.nombre}`.slice(0, 120),
        itil_code: itilCode(d.clienteId, d.ciudad, i + 1, disp),
        categoria: disp.categoria, rol: disp.rol, orientacion: disp.orientacion || null,
        pantalla_id: `${xid}-${disp.id}`.slice(0, 80),
        playlists,
      };
    });
    return {
      n: i + 1, id: xid, slug: e.slug, nombre: e.nombre, direccion: e.direccion, cp: e.cp, barrio: e.barrio,
      ciudad: d.ciudad, pais: d.pais, coords: [e.lng, e.lat], lat: e.lat, lng: e.lng,
      fuente: e.fuente || null, fuente_url: e.fuente_url || null, ref: e.ref || null,
      gemelo: twin, equipos,
      // Desconexiones temporales (próximamente): contenido propio del local en una ventana. Vacío.
      desconexiones: [],
    };
  });

  const todasPl = establecimientos.flatMap((e) => e.equipos.flatMap((q) => q.playlists));
  const nEquipos = establecimientos.reduce((a, e) => a + e.equipos.length, 0);
  const nAltavoces = establecimientos.reduce((a, e) => a + e.equipos.filter((q) => q.categoria === 'audio').length, 0);
  const nPantallas = establecimientos.reduce((a, e) => a + e.equipos.filter((q) => q.categoria === 'pantalla').length, 0);
  const nPlaylists = todasPl.length;
  const nDemanda = todasPl.filter((x) => x.reproduccion === 'bajo_demanda').length;
  const nSlots = todasPl.reduce((a, x) => a + x.contenidos.length, 0);
  const nUnicos = Object.values(unicos).reduce((a, l) => a + l.length, 0);
  const porLocal = d.dispositivos.reduce((a, q) => a + q.playlists.length, 0);

  const paso = (n, componente, titulo, accion, endpoint, escrituras) => ({
    n, componente, titulo, accion, endpoint, escrituras,
    estado_hoy: ESTADO_HOY[n].estado, falta: ESTADO_HOY[n].falta,
  });

  const pasos = [
    paso(1, 'admira.app', 'Cliente franquicia + marca blanca', `Cuenta de marca «${d.cliente}» (brand_key ${d.clienteId}) en admira.app / Yokup y su marca real como marca blanca: catálogo de /marcablanca y ${marca.comando} en las 5 plataformas.`,
      `Yokup admira-xpacio-sync (external.brand) · ${URLS.analizar} · ${URLS.guardarMarca} · CLI Experto ${marca.comando}`, [`brand_accounts:${d.clienteId}`, `marca:${marca.id}`]),
    paso(2, 'admira.biz', 'Establecimientos en el mapa', `Circuito ${circuito} con ${establecimientos.length} Xpacios reales (dirección + coordenadas).`,
      `GET → backup → unión → PUT ${URLS.catalogo}`, establecimientos.map((e) => `location:${e.id}`)),
    paso(3, 'admira.store', 'Gemelos digitales', `${establecimientos.length} gemelos (autostart=${tipo.autostart}, marca=${marca.id}).`,
      `${URLS.twin}?autostart=${tipo.autostart}&loc=<id>`, establecimientos.map((e) => `twin:${e.id}`)),
    paso(4, 'admira.app', 'Inventario ITIL (Yokup)', `${nEquipos} CIs: ${d.dispositivos.length} equipos físicos por establecimiento (${d.dispositivos.map((q) => q.id).join(', ')}).`,
      `${URLS.itilMcp} · itil_ci_upsert {admira_store_id, itil_code, name, category, role, orientation}`, establecimientos.flatMap((e) => e.equipos.map((q) => `ci:${q.itil_code}`))),
    paso(5, 'admira.tv', 'Playlists por canal', `${nPlaylists} playlists (${porLocal} por local) ${d.clienteId}.<xpacio>.<canal>; el altavoz lleva 2: hilomusical continuo y locuciones bajo demanda desde el TPV (${nDemanda}).`,
      `POST ${URLS.xpl} (lista completa, unión) · POST ${URLS.tvPlaylist} {screen, items} · locuciones: TPV → ${URLS.api}/megafonia/push`, todasPl.map((x) => `playlist:${x.playlist}`)),
    paso(6, 'pixeria', 'Contenidos de marca', `${d.contenidos} por playlist · ${nSlots} huecos · ${nUnicos} piezas únicas comunes a toda la marca · idiomas ${d.idiomas.join('/')} · locuciones: cierre, emergencia, aviso puntual.`,
      `${URLS.api}/lyria3/generate · /hilomusical/push · /megafonia/push · /imagen/generate · /stock/publish`, [`stock:${nUnicos} piezas`]),
    paso(7, 'admira.app', 'Comprobación final', 'Equipos online (o simulados), playlists asignadas, hilo y pantallas emitiendo y una locución de prueba disparada (simulada) desde el TPV.',
      `${URLS.itilLectura}<id> · ${URLS.tvPlaylist}?screen=<pantalla> · ${URLS.api}/grid/day?screen=<id>`, []),
  ];

  return {
    schema: SCHEMA,
    generado: ahora,
    valido: ok,
    errores,
    avisos,
    simulacion: d.simulacion,
    cliente: { nombre: d.cliente, id: d.clienteId, web: d.website, color: d.color, franquicia: d.franquicia, marca: { modo: marca.modo, id: marca.id } },
    marca_blanca: marca,
    ciudad: { nombre: d.ciudad, pais: d.pais, corta: cc },
    xpacio: { tipo: d.xpacio_tipo, subtipo: d.xpacio_subtipo || null, autostart: tipo.autostart, kind: tipo.kind },
    circuito,
    minimos: { ...MINIMOS },
    convencion: {
      xpacio: '<cliente>-demo-<ciudad>-<barrio>',
      playlist: '<cliente>.<xpacio>.<canal>  (canal: hilomusical | locuciones | vertical | horizontal | extras)',
      itil: '<CLI><CIU><NN>-<EQUIPO>-<NN>  (ALTV, PANV, PANH…)',
      pantalla: '<xpacio-id>-<dispositivo>',
      marca: '/marca <cliente>  (catálogo único admiranext.com/marcablanca)',
      legado: `${d.clienteId}.xpacio.hilomusical (crear_demo.py, playlist única de cliente)`,
    },
    contenido: {
      fuente: d.fuente, por_playlist: d.contenidos, idiomas: d.idiomas, cierre: d.cierre,
      compartidos: true, modelo: 'marca',
      eventos_tpv: EVENTOS_TPV.map((x) => ({ ...x })),
      desconexiones: { ...DESCONEXIONES, esquema: { ...DESCONEXIONES.esquema }, total: 0 },
    },
    establecimientos,
    pasos,
    estado_extra: Object.fromEntries(Object.entries(ESTADO_EXTRA).map(([k, v]) => [k, { ...v }])),
    estado_fecha: ESTADO_FECHA,
    totales: {
      establecimientos: establecimientos.length, gemelos: establecimientos.length,
      equipos: nEquipos, altavoces: nAltavoces, pantallas: nPantallas,
      playlists: nPlaylists, playlists_continuas: nPlaylists - nDemanda, playlists_bajo_demanda: nDemanda,
      huecos_contenido: nSlots, piezas_unicas: nUnicos,
      plataformas_marca: marca.plataformas.length, desconexiones: 0,
    },
    notas: d.notas,
  };
}

/** Campos que ya entiende la cola clásica (procesar_cola.py → crear_demo.py). */
export function legacyPayload(entrada = {}) {
  const { datos: d } = normalizar(entrada);
  const presets = ['london', 'newyork', 'barcelona', 'madrid', 'paris', 'milano', 'lisboa', 'valencia', 'mexico'];
  const c = slug(d.ciudad, '');
  return {
    cliente: d.cliente,
    website: d.website,
    color: d.color,
    xpacio_tipo: d.xpacio_tipo,
    xpacio_otro: d.xpacio_tipo === 'other' ? (d.xpacio_subtipo || '') : '',
    ciudades: presets.includes(c) ? [c] : [],
    cierre: d.cierre,
    idiomas: d.idiomas,
    notas: d.notas,
  };
}
