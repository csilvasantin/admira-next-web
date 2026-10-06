/**
 * plan-completa.mjs · plan de la DEMO COMPLETA AdmiraNeXT (merovingio · 06-10-2026).
 *
 * Módulo puro (sin DOM ni red): lo usan el formulario /demo (navegador), la API
 * /api/demo (Cloudflare Pages Function) y los tests. Convierte lo que se rellena en
 * el formulario en el PLAN de los 7 pasos sobre los 5 componentes:
 *
 *   1 admira.app   cliente franquicia (cuenta de marca Yokup)
 *   2 admira.biz   ≥4 establecimientos reales en el mapa (dirección + coordenadas)
 *   3 admira.store un gemelo digital por establecimiento
 *   4 admira.app   inventario ITIL (Yokup): ≥4 equipos IoT por establecimiento
 *   5 admira.tv    una playlist por equipo  <cliente>.<xpacio>.<canal>
 *   6 pixeria      3 contenidos por playlist (locuciones, canciones, visuales V/H)
 *   7 admira.app   comprobación final
 *
 * NO ejecuta nada: describe qué se escribiría, dónde y con qué nombre. Compatible con la
 * cola existente: legacyPayload() devuelve los campos que ya entiende procesar_cola.py.
 */

export const SCHEMA = 'admiranext.demo-completa/1';
export const MINIMOS = Object.freeze({ establecimientos: 4, dispositivos: 4, contenidos: 3 });

// Tipos de Xpacio que ya acepta crear_demo.py (--xpacio-tipo). No se añaden tipos nuevos
// para no romper su argparse: el matiz va en xpacio_subtipo (p. ej. «panaderia»).
export const XPACIO_TIPOS = Object.freeze({
  demostore: { autostart: 'shoptalk', kind: 'DemoStore', label: 'DemoStore' },
  estanco: { autostart: 'xtanco', kind: 'Estanco', label: 'Estanco' },
  cafeteria: { autostart: 'cafeteria', kind: 'Cafetería', label: 'Cafetería' },
  other: { autostart: 'xtanco', kind: 'Retail', label: 'Otro' },
});

// Equipos IoT. Los cuatro primeros son el MÍNIMO (siempre marcados); el resto, extras.
// canal = sufijo de la playlist; contenido = qué pone Pixeria en ella.
export const DISPOSITIVOS = Object.freeze([
  { id: 'hilomusical', nombre: 'Altavoz hilo musical', categoria: 'audio', rol: 'hilo-musical', orientacion: '', canal: 'hilomusical', contenido: 'cancion', codigo: 'HILO', minimo: true },
  { id: 'locuciones', nombre: 'Altavoz locuciones', categoria: 'audio', rol: 'megafonia', orientacion: '', canal: 'locuciones', contenido: 'locucion', codigo: 'LOCU', minimo: true },
  { id: 'vertical', nombre: 'Pantalla vertical 9:16', categoria: 'pantalla', rol: 'signage', orientacion: 'vertical', canal: 'vertical', contenido: 'visual-9x16', codigo: 'PANV', minimo: true },
  { id: 'horizontal', nombre: 'Pantalla horizontal 16:9', categoria: 'pantalla', rol: 'signage', orientacion: 'horizontal', canal: 'horizontal', contenido: 'visual-16x9', codigo: 'PANH', minimo: true },
  { id: 'escaparate', nombre: 'Pantalla escaparate', categoria: 'pantalla', rol: 'escaparate', orientacion: 'vertical', canal: 'escaparate', contenido: 'visual-9x16', codigo: 'ESCA', minimo: false },
  { id: 'menuboard', nombre: 'Menu board (carta digital)', categoria: 'pantalla', rol: 'menu-board', orientacion: 'horizontal', canal: 'menuboard', contenido: 'visual-16x9', codigo: 'MENU', minimo: false },
  { id: 'kiosko', nombre: 'Kiosko / tótem táctil', categoria: 'kiosk', rol: 'autoservicio', orientacion: 'vertical', canal: 'kiosko', contenido: 'visual-9x16', codigo: 'KIOS', minimo: false },
  { id: 'aforo', nombre: 'Sensor de aforo', categoria: 'iot', rol: 'aforo', orientacion: '', canal: '', contenido: '', codigo: 'AFOR', minimo: false },
]);

export const FUENTES_CONTENIDO = Object.freeze(['pixeria', 'stock']);
export const MARCA_MODOS = Object.freeze(['cliente', 'blanca']);

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
};

// Estado de cada paso tras el dry-run del 06-10-2026 (ver demo-completa-RESUMEN.md).
export const ESTADO_HOY = Object.freeze({
  1: { estado: 'PARCIAL', falta: 'La cuenta de marca nace sola en Yokup cuando sincroniza Xpacios con gemelo (external.brand). No hay alta directa de «cliente franquicia» por API ni lista de franquicias.' },
  2: { estado: 'PARCIAL', falta: 'PUT del catálogo listo (crear_demo.py paso circuito), pero hoy usa presets de ciudad (1 Xpacio céntrico por ciudad). Falta aceptar la lista de establecimientos reales.' },
  3: { estado: 'LISTO', falta: 'Gemelo por Xpacio vía campo twin. No hay escena «panadería»: 365 usa autostart=cafeteria.' },
  4: { estado: 'PARCIAL', falta: 'itil_ci_upsert (MCP de flota yokup.com/mcp) existe con categoría y orientación. crear_demo.py no lo llama y el Xpacio debe estar antes sincronizado en Yokup (cron 2 min, pasadas cada 15 min).' },
  5: { estado: 'PARCIAL', falta: 'XPL y /api/playlist por pantalla existen; crear_demo.py crea UNA playlist <id>.xpacio.hilomusical. Faltan las de locuciones/vertical/horizontal por Xpacio.' },
  6: { estado: 'PARCIAL', falta: 'Motores listos (lyria3, megafonia/push, imagen/generate 9:16/16:9, stock/publish). crear_demo.py hace 2 canciones + 2 locuciones; faltan la 3.ª de cada y los 6 visuales.' },
  7: { estado: 'FALTA', falta: 'Hay lecturas públicas (ITIL, playlist, grid/day) pero no un comprobador único ni players virtuales registrables sin sesión.' },
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

/** Código ITIL único: ^[A-Z0-9]{2,12}(-[A-Z0-9]{2,12}){1,3}$  (p. ej. 365BCN01-HILO-01). */
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
  const marcaIn = entrada.marca && typeof entrada.marca === 'object' ? entrada.marca : { modo: entrada.marca };
  const marcaModo = MARCA_MODOS.includes(marcaIn.modo) ? marcaIn.modo : 'cliente';
  const marcaId = marcaModo === 'blanca' ? (slug(marcaIn.id || 'admiranext') || 'admiranext') : clienteId;
  const simulacion = entrada.simulacion === undefined ? true : entrada.simulacion !== false && entrada.simulacion !== 'false' && entrada.simulacion !== 0;

  // Dispositivos: el mínimo SIEMPRE va; los extras se suman si vienen.
  const pedidos = new Set((Array.isArray(entrada.dispositivos) ? entrada.dispositivos : [])
    .map((d) => (typeof d === 'string' ? d : d && d.id)).filter(Boolean));
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

  return {
    ok: errores.length === 0,
    errores,
    datos: {
      cliente, clienteId, website, color: /^#[0-9a-f]{6}$/i.test(entrada.color || '') ? String(entrada.color).toUpperCase() : '',
      franquicia: entrada.franquicia !== false,
      ciudad, pais, xpacio_tipo, xpacio_subtipo, n_establecimientos: Math.max(nPedidos, Math.min(ests.length, 50)),
      establecimientos: ests, dispositivos, contenidos, idiomas, fuente,
      marca: { modo: marcaModo, id: marcaId },
      cierre: /^\d{1,2}:\d{2}$/.test(entrada.cierre || '') ? entrada.cierre : '21:00',
      contenidos_compartidos: entrada.contenidos_compartidos !== false,
      simulacion,
      notas: t(entrada.notas, 500),
    },
  };
}

function contenidosDe(d, disp, idiomas, cierre, cliente) {
  const n = d.contenidos;
  const lang = (i) => idiomas[i % idiomas.length];
  const out = [];
  for (let i = 0; i < n; i++) {
    if (disp.contenido === 'cancion') {
      out.push({ tipo: 'audio', kind: 'song', lang: lang(i), titulo: `${lang(i).toUpperCase()} · ${cliente} Hilo · ${['Mañana de horno', 'Café y conversación', 'Tarde dulce', 'Pan del día'][i % 4]}`, motor: 'lyria3', endpoint: `${URLS.api}/lyria3/generate → /hilomusical/push` });
    } else if (disp.contenido === 'locucion') {
      const textos = [
        `Bienvenida · ${cliente}`,
        `Promo del día · ${cliente}`,
        `Cierre ${cierre} · ${cliente}`,
      ];
      out.push({ tipo: 'audio', kind: 'voiceover', lang: lang(i), titulo: `${lang(i).toUpperCase()} · ${textos[i % textos.length]}`, motor: 'elevenlabs', endpoint: `${URLS.api}/megafonia/push` });
    } else if (disp.contenido.startsWith('visual')) {
      const ratio = disp.contenido === 'visual-9x16' ? '9:16' : '16:9';
      out.push({ tipo: 'video', kind: 'visual', ratio, titulo: `${cliente} · ${['Pan recién hecho', 'Café + bollería', 'Bocadillo del día', 'Pastelería'][i % 4]} · ${ratio}`, motor: 'imagen-4.0 → adaptador (imagen fija MP4)', endpoint: `${URLS.api}/imagen/generate → /stock/publish` });
    }
  }
  return out;
}

/** Plan completo (dry-run). No hace red. */
export function construirPlan(entrada = {}, { ahora = new Date().toISOString() } = {}) {
  const { ok, errores, datos: d } = normalizar(entrada);
  const tipo = XPACIO_TIPOS[d.xpacio_tipo] || XPACIO_TIPOS.cafeteria;
  const cc = ciudadCorta(d.ciudad);
  const circuito = `demo_${slug(d.clienteId, '_')}_${cc}`;
  const unicos = { cancion: [], locucion: [], 'visual-9x16': [], 'visual-16x9': [] };

  const establecimientos = d.establecimientos.map((e, i) => {
    const xid = `${d.clienteId}-demo-${e.slug}`.slice(0, 80);
    const twin = `${URLS.twin}?autostart=${tipo.autostart}&visual=better&marca=${d.marca.id}&loc=${xid}&store=${xid}`;
    const equipos = d.dispositivos.map((disp) => {
      const pl = disp.canal ? playlistName(d.clienteId, e.slug, disp.canal) : '';
      let contenidos = [];
      if (disp.contenido) {
        if (d.contenidos_compartidos && unicos[disp.contenido].length) contenidos = unicos[disp.contenido];
        else {
          contenidos = contenidosDe(d, disp, d.idiomas, d.cierre, d.cliente);
          if (!unicos[disp.contenido].length) unicos[disp.contenido] = contenidos;
        }
      }
      return {
        dispositivo: disp.id,
        nombre: `${disp.nombre} · ${e.nombre}`.slice(0, 120),
        itil_code: itilCode(d.clienteId, d.ciudad, i + 1, disp),
        categoria: disp.categoria, rol: disp.rol, orientacion: disp.orientacion || null,
        pantalla_id: `${xid}-${disp.id}`.slice(0, 80),
        playlist: pl || null,
        playlist_id: pl ? playlistId(pl) : null,
        contenidos,
      };
    });
    return {
      n: i + 1, id: xid, slug: e.slug, nombre: e.nombre, direccion: e.direccion, cp: e.cp, barrio: e.barrio,
      ciudad: d.ciudad, pais: d.pais, coords: [e.lng, e.lat], lat: e.lat, lng: e.lng,
      fuente: e.fuente || null, fuente_url: e.fuente_url || null, ref: e.ref || null,
      gemelo: twin, equipos,
    };
  });

  const nEquipos = establecimientos.reduce((a, e) => a + e.equipos.length, 0);
  const nPlaylists = establecimientos.reduce((a, e) => a + e.equipos.filter((q) => q.playlist).length, 0);
  const nSlots = establecimientos.reduce((a, e) => a + e.equipos.reduce((b, q) => b + q.contenidos.length, 0), 0);
  const nUnicos = d.contenidos_compartidos
    ? Object.values(unicos).reduce((a, l) => a + l.length, 0)
    : nSlots;

  const paso = (n, componente, titulo, accion, endpoint, escrituras) => ({
    n, componente, titulo, accion, endpoint, escrituras,
    estado_hoy: ESTADO_HOY[n].estado, falta: ESTADO_HOY[n].falta,
  });

  const pasos = [
    paso(1, 'admira.app', 'Cliente franquicia', `Cuenta de marca «${d.cliente}» (brand_key ${d.clienteId}) en admira.app / Yokup${d.marca.modo === 'blanca' ? ` con marca blanca ${d.marca.id}` : ''}.`,
      'Yokup admira-xpacio-sync (external.brand) · admiranext.com/presentaciones/api/marcas', [`brand_accounts:${d.clienteId}`, `marcablanca:${d.marca.id}`]),
    paso(2, 'admira.biz', 'Establecimientos en el mapa', `Circuito ${circuito} con ${establecimientos.length} Xpacios reales (dirección + coordenadas).`,
      `GET → backup → unión → PUT ${URLS.catalogo}`, establecimientos.map((e) => `location:${e.id}`)),
    paso(3, 'admira.store', 'Gemelos digitales', `${establecimientos.length} gemelos (autostart=${tipo.autostart}).`,
      `${URLS.twin}?autostart=${tipo.autostart}&loc=<id>`, establecimientos.map((e) => `twin:${e.id}`)),
    paso(4, 'admira.app', 'Inventario ITIL (Yokup)', `${nEquipos} CIs (${d.dispositivos.length} por establecimiento: ${d.dispositivos.map((q) => q.id).join(', ')}).`,
      `${URLS.itilMcp} · itil_ci_upsert {admira_store_id, itil_code, name, category, role, orientation}`, establecimientos.flatMap((e) => e.equipos.map((q) => `ci:${q.itil_code}`))),
    paso(5, 'admira.tv', 'Playlists por equipo', `${nPlaylists} playlists ${d.clienteId}.<xpacio>.<canal>.`,
      `POST ${URLS.xpl} (lista completa, unión) · POST ${URLS.tvPlaylist} {screen, items}`, establecimientos.flatMap((e) => e.equipos.filter((q) => q.playlist).map((q) => `playlist:${q.playlist}`))),
    paso(6, 'pixeria', 'Contenidos', `${d.contenidos} por playlist · ${nSlots} huecos · ${nUnicos} piezas únicas${d.contenidos_compartidos ? ' (compartidas entre establecimientos)' : ''} · idiomas ${d.idiomas.join('/')}.`,
      `${URLS.api}/lyria3/generate · /hilomusical/push · /megafonia/push · /imagen/generate · /stock/publish`, [`stock:${nUnicos} piezas`]),
    paso(7, 'admira.app', 'Comprobación final', 'Equipos online (o simulados), playlists asignadas y contenido sonando.',
      `${URLS.itilLectura}<id> · ${URLS.tvPlaylist}?screen=<pantalla> · ${URLS.api}/grid/day?screen=<id>`, []),
  ];

  return {
    schema: SCHEMA,
    generado: ahora,
    valido: ok,
    errores,
    simulacion: d.simulacion,
    cliente: { nombre: d.cliente, id: d.clienteId, web: d.website, color: d.color, franquicia: d.franquicia, marca: d.marca },
    ciudad: { nombre: d.ciudad, pais: d.pais, corta: cc },
    xpacio: { tipo: d.xpacio_tipo, subtipo: d.xpacio_subtipo || null, autostart: tipo.autostart, kind: tipo.kind },
    circuito,
    minimos: { ...MINIMOS },
    convencion: {
      xpacio: '<cliente>-demo-<ciudad>-<barrio>',
      playlist: '<cliente>.<xpacio>.<canal>  (canal: hilomusical | locuciones | vertical | horizontal | extras)',
      itil: '<CLI><CIU><NN>-<EQUIPO>-<NN>  (HILO, LOCU, PANV, PANH…)',
      pantalla: '<xpacio-id>-<dispositivo>',
      legado: `${d.clienteId}.xpacio.hilomusical (crear_demo.py, playlist única de cliente)`,
    },
    contenido: { fuente: d.fuente, por_playlist: d.contenidos, idiomas: d.idiomas, compartidos: d.contenidos_compartidos, cierre: d.cierre },
    establecimientos,
    pasos,
    totales: { establecimientos: establecimientos.length, gemelos: establecimientos.length, equipos: nEquipos, playlists: nPlaylists, huecos_contenido: nSlots, piezas_unicas: nUnicos },
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
