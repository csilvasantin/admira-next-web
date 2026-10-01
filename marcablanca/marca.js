/*!
 * marca.js · v1.1.0 · Marca blanca de la Galaxia Admira
 * Utilidades compartidas (navegador y Pages Functions) para trabajar con un cliente de
 * marcablanca/clientes/*.json sin depender del DOM:
 *   - crearMarca(datos)        → genera un JSON de cliente completo (mismo esquema) a partir de
 *                                nombre, logo, primario, secundario, acento, tipografía y modo.
 *   - normalizarMarca(json)    → limpia un JSON de cliente llegado de fuera (colores hex, fuentes,
 *                                URLs de logo seguras…) y rellena lo que falte.
 *   - variablesMarca(m, modo)  → el mapa { '--mb-…': valor } que también pinta marcablanca.js.
 *   - paletaDesdeColores(lista)→ elige primario, secundario y acento de un histograma de colores.
 * Lo usan el generador de presentaciones (marca del prospect) y /marcablanca/presentacion.
 */
export const VERSION = '1.1.0';
export const PLATAFORMAS = ['studio', 'store', 'app', 'yokup'];
export const CLAVES_PALETA = ['primario', 'primarioTexto', 'secundario', 'secundarioTexto', 'acento', 'acentoTexto',
  'fondo', 'fondoAlt', 'superficie', 'superficieAlt', 'borde', 'texto', 'textoSuave', 'textoTenue', 'ok', 'aviso', 'error', 'info'];

const HEX = /^#[0-9a-f]{6}$/i;
const ID = /^[a-z0-9][a-z0-9-]{0,40}$/;
const FUENTE = (familia, archivo, peso) => ({ familia, url: `/marcablanca/fuentes/${archivo}.woff2`, peso });
const SANS = "-apple-system, 'Segoe UI', Roboto, sans-serif";

/** Tipografías disponibles para una marca nueva: todas OFL y servidas desde /marcablanca/fuentes. */
export const TIPOGRAFIAS = {
  grotesca: { nombre: 'Grotesca · Inter', titulos: `Inter, ${SANS}`, texto: `Inter, ${SANS}`, etiquetas: `Inter, ${SANS}`, pesoTitulos: 800, transformTitulos: 'none', trackingTitulos: '-0.02em',
    fuentes: [FUENTE('Inter', 'inter', '400 800')], radios: { sm: '6px', md: '10px', lg: '16px', boton: '10px', pill: '999px' } },
  serif: { nombre: 'Editorial · Fraunces', titulos: "Fraunces, Georgia, 'Times New Roman', serif", texto: `Inter, ${SANS}`, etiquetas: `Inter, ${SANS}`, pesoTitulos: 700, transformTitulos: 'none', trackingTitulos: '-0.015em',
    fuentes: [FUENTE('Fraunces', 'fraunces', '400 800'), FUENTE('Inter', 'inter', '400 800')], radios: { sm: '8px', md: '14px', lg: '22px', boton: '999px', pill: '999px' } },
  condensada: { nombre: 'Condensada · Oswald', titulos: "Oswald, 'Arial Narrow', Impact, sans-serif", texto: `Inter, ${SANS}`, etiquetas: "Oswald, 'Arial Narrow', sans-serif", pesoTitulos: 600, transformTitulos: 'uppercase', trackingTitulos: '0.04em',
    fuentes: [FUENTE('Oswald', 'oswald', '400 700'), FUENTE('Inter', 'inter', '400 800')], radios: { sm: '0px', md: '2px', lg: '4px', boton: '2px', pill: '999px' } },
  redondeada: { nombre: 'Redondeada · Nunito', titulos: `Nunito, 'Arial Rounded MT Bold', ${SANS}`, texto: `Nunito, ${SANS}`, etiquetas: `Nunito, ${SANS}`, pesoTitulos: 800, transformTitulos: 'none', trackingTitulos: '-0.01em',
    fuentes: [FUENTE('Nunito', 'nunito', '400 900')], radios: { sm: '10px', md: '16px', lg: '24px', boton: '999px', pill: '999px' } },
  geometrica: { nombre: 'Geométrica · DM Sans', titulos: `'DM Sans', ${SANS}`, texto: `'DM Sans', ${SANS}`, etiquetas: `'DM Sans', ${SANS}`, pesoTitulos: 700, transformTitulos: 'none', trackingTitulos: '-0.02em',
    fuentes: [FUENTE('DM Sans', 'dmsans', '400 800')], radios: { sm: '6px', md: '12px', lg: '18px', boton: '12px', pill: '999px' } },
  moderna: { nombre: 'Moderna · Manrope', titulos: `Manrope, ${SANS}`, texto: `Manrope, ${SANS}`, etiquetas: `Manrope, ${SANS}`, pesoTitulos: 800, transformTitulos: 'none', trackingTitulos: '-0.02em',
    fuentes: [FUENTE('Manrope', 'manrope', '400 800')], radios: { sm: '4px', md: '8px', lg: '12px', boton: '8px', pill: '999px' } }
};

/* ── Color ─────────────────────────────────────────────────────────────── */
function rgb(hex) { const n = parseInt(String(hex).slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function hex(c) { return '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('').toUpperCase(); }
/** Mezcla a con b: t=0 → a, t=1 → b. */
export function mezclar(a, b, t) { const x = rgb(a), y = rgb(b); return hex(x.map((v, i) => v + (y[i] - v) * t)); }
export function luminancia(c) {
  return rgb(c).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); })
    .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
}
export function contraste(a, b) { const x = luminancia(a), y = luminancia(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
export function esHex(c) { return HEX.test(String(c || '')); }
function saturacion(c) { const [r, g, b] = rgb(c).map((v) => v / 255); const mx = Math.max(r, g, b), mn = Math.min(r, g, b); const l = (mx + mn) / 2; return mx === mn ? 0 : (mx - mn) / (1 - Math.abs(2 * l - 1)); }
function tono(c) { const [r, g, b] = rgb(c).map((v) => v / 255); const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; if (!d) return 0; let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; return h < 0 ? h + 360 : h; }
function distanciaTono(a, b) { const d = Math.abs(tono(a) - tono(b)); return Math.min(d, 360 - d); }
/** Texto legible sobre un color: el que más contraste dé (≥ 4,5 siempre que se pueda). */
export function textoSobre(fondo, tinta) {
  const opciones = ['#FFFFFF', tinta && esHex(tinta) ? tinta : mezclar('#000000', fondo, 0.18), '#111111', '#000000'];
  let mejor = opciones[0];
  for (const o of opciones) {
    if (contraste(o, fondo) >= 4.5 && (o === '#FFFFFF' || o === opciones[1])) return o;
    if (contraste(o, fondo) > contraste(mejor, fondo)) mejor = o;
  }
  return mejor;
}
/** Oscurece (o aclara) un color hacia `hacia` hasta lograr el contraste pedido con `fondo`. */
function ajustar(c, fondo, minimo, hacia) {
  let x = c;
  for (let i = 0; i < 20 && contraste(x, fondo) < minimo; i += 1) x = mezclar(x, hacia, 0.12);
  return x;
}

/** Paleta completa de un modo a partir de los tres colores de marca. */
export function derivarPaleta(primario, secundario, acento, modo) {
  const P = esHex(primario) ? primario.toUpperCase() : '#12233E';
  const S = esHex(secundario) ? secundario.toUpperCase() : mezclar(P, '#FFFFFF', 0.35);
  const A = esHex(acento) ? acento.toUpperCase() : '#FFB000';
  if (modo === 'oscuro') {
    const fondo = mezclar('#0B0D10', P, 0.10), texto = mezclar('#F5F6F8', P, 0.04);
    const primarioO = ajustar(P, fondo, 4.5, '#FFFFFF'), secundarioO = ajustar(S, fondo, 3, '#FFFFFF'), acentoO = ajustar(A, fondo, 3, '#FFFFFF');
    return {
      primario: primarioO, primarioTexto: textoSobre(primarioO, mezclar('#000000', P, 0.25)),
      secundario: secundarioO, secundarioTexto: textoSobre(secundarioO),
      acento: acentoO, acentoTexto: textoSobre(acentoO),
      fondo, fondoAlt: mezclar('#0B0D10', P, 0.15), superficie: mezclar('#15181D', P, 0.12), superficieAlt: mezclar('#1C2027', P, 0.15),
      borde: mezclar('#2A2F38', P, 0.20), texto, textoSuave: ajustar(mezclar(texto, fondo, 0.30), fondo, 4.5, '#FFFFFF'), textoTenue: mezclar(texto, fondo, 0.52),
      ok: '#6FCF97', aviso: '#F2C94C', error: '#EB5757', info: '#56CCF2'
    };
  }
  const fondo = mezclar('#FFFFFF', P, 0.035), texto = ajustar(mezclar('#111318', P, 0.12), fondo, 7, '#000000');
  const primarioC = ajustar(P, fondo, 3, '#000000'), secundarioC = ajustar(S, fondo, 3, '#000000'), acentoC = ajustar(A, fondo, 2.6, '#000000');
  return {
    primario: primarioC, primarioTexto: textoSobre(primarioC, mezclar('#000000', P, 0.25)),
    secundario: secundarioC, secundarioTexto: textoSobre(secundarioC),
    acento: acentoC, acentoTexto: textoSobre(acentoC),
    fondo, fondoAlt: mezclar('#FFFFFF', P, 0.08), superficie: '#FFFFFF', superficieAlt: mezclar('#FFFFFF', P, 0.05),
    borde: mezclar('#FFFFFF', P, 0.16), texto, textoSuave: ajustar(mezclar(texto, fondo, 0.32), fondo, 4.5, '#000000'), textoTenue: mezclar(texto, fondo, 0.52),
    ok: '#2F7D4F', aviso: '#B7791F', error: '#C0392B', info: '#2B6CB0'
  };
}

/**
 * Elige primario, secundario y acento de una lista de colores con peso (p. ej. el histograma de un
 * logo o la paleta que el analizador saca de la web). Ignora blancos, negros y grises casi puros.
 * @param {{hex:string,peso?:number}[]|string[]} lista
 */
export function paletaDesdeColores(lista) {
  const colores = (Array.isArray(lista) ? lista : []).map((c, i) => (typeof c === 'string' ? { hex: c, peso: lista.length - i } : c))
    .filter((c) => c && esHex(c.hex)).map((c) => ({ hex: c.hex.toUpperCase(), peso: Number(c.peso) || 1 }));
  const vivos = colores.filter((c) => { const l = luminancia(c.hex); return saturacion(c.hex) > 0.18 && l > 0.012 && l < 0.92; });
  const neutros = colores.filter((c) => !vivos.includes(c));
  vivos.sort((a, b) => b.peso - a.peso);
  const primario = vivos[0]?.hex || neutros.slice().sort((a, b) => b.peso - a.peso).find((c) => luminancia(c.hex) < 0.5)?.hex || '#12233E';
  const resto = vivos.filter((c) => c.hex !== primario && distanciaTono(c.hex, primario) > 18);
  const acento = resto.slice().sort((a, b) => saturacion(b.hex) * Math.min(distanciaTono(b.hex, primario), 90) - saturacion(a.hex) * Math.min(distanciaTono(a.hex, primario), 90))[0]?.hex || '#FFB000';
  const oscuro = neutros.slice().sort((a, b) => b.peso - a.peso).find((c) => luminancia(c.hex) < 0.2 && c.hex !== primario)?.hex;
  const secundario = resto.find((c) => c.hex !== acento)?.hex || oscuro || mezclar(primario, '#FFFFFF', 0.35);
  return { primario, secundario, acento };
}

/* ── Saneado ───────────────────────────────────────────────────────────── */
function texto(v, max) { return String(v == null ? '' : v).replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max); }
export function idMarca(v) {
  const s = String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 41).replace(/-$/, '');
  return ID.test(s) ? s : '';
}
const MAX_DATA_URL = 220000;
/** URL segura para un logo/favicon: ruta propia, https o data:image (sin javascript:, sin comillas). */
export function urlSegura(v, base = '/marcablanca/clientes/') {
  const s = String(v || '').trim();
  if (!s) return '';
  if (/^data:image\/(png|jpeg|webp|gif|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(s)) return s.length <= MAX_DATA_URL ? s : '';
  if (/^\.\.\/(logos|fuentes)\/[a-z0-9._-]+$/i.test(s) && base === '/marcablanca/clientes/') return '/marcablanca/' + s.slice(3);
  if (/^\/(marcablanca|presentaciones|assets)\/[A-Za-z0-9._/-]+$/.test(s) && !s.includes('..')) return s;
  if (/^https:\/\/[A-Za-z0-9.-]+(:\d+)?(\/[^\s"'()<>\\`]*)?$/.test(s) && s.length <= 600) return s;
  return '';
}
function pila(v, defecto) { const s = String(v || '').trim(); return /^[A-Za-z0-9 ,'".-]{1,220}$/.test(s) ? s : defecto; }
function medida(v, defecto) { const s = String(v == null ? '' : v).trim(); return /^(0|\d{1,3}(\.\d+)?(px|em|rem|%))$/.test(s) ? s : defecto; }
function sombra(v, defecto) { const s = String(v || '').trim(); return (/^[0-9a-z .,()#%-]{1,160}$/i.test(s) && !/url|expression/i.test(s)) ? s : defecto; }
function lista(v, max, largo) { return (Array.isArray(v) ? v : []).map((x) => texto(x, largo)).filter(Boolean).slice(0, max); }

function normalizarTipografia(t, defecto) {
  t = t && typeof t === 'object' ? t : {};
  const d = defecto || TIPOGRAFIAS.grotesca;
  const fuentes = (Array.isArray(t.fuentes) ? t.fuentes : d.fuentes || []).map((f) => ({
    familia: /^[A-Za-z0-9 -]{1,40}$/.test(String(f?.familia || '')) ? String(f.familia) : '',
    url: (() => { const u = urlSegura(f?.url); return /^\/marcablanca\/fuentes\/[a-z0-9-]+\.woff2$/.test(u) ? u : ''; })(),
    peso: /^\d{3}( \d{3})?$/.test(String(f?.peso || '')) ? String(f.peso) : '400 700'
  })).filter((f) => f.familia && f.url).slice(0, 4);
  const peso = Math.round(Number(t.pesoTitulos) / 100) * 100;
  return {
    titulos: pila(t.titulos, d.titulos), texto: pila(t.texto, d.texto),
    mono: pila(t.mono, 'ui-monospace, SFMono-Regular, Menlo, monospace'), etiquetas: pila(t.etiquetas, pila(t.texto, d.etiquetas || d.texto)),
    pesoTitulos: peso >= 100 && peso <= 900 ? peso : (d.pesoTitulos || 700),
    transformTitulos: ['none', 'uppercase', 'lowercase', 'capitalize'].includes(t.transformTitulos) ? t.transformTitulos : (d.transformTitulos || 'none'),
    trackingTitulos: /^(normal|-?\d?\.?\d{1,3}(em|px))$/.test(String(t.trackingTitulos || '')) ? String(t.trackingTitulos) : (d.trackingTitulos || 'normal'),
    fuentes
  };
}
function normalizarPaleta(p, base) {
  const r = {};
  for (const k of CLAVES_PALETA) r[k] = esHex(p?.[k]) ? String(p[k]).toUpperCase() : base[k];
  return r;
}
function normalizarLogo(l, nombre) {
  l = l && typeof l === 'object' ? l : {};
  const svg = urlSegura(l.svg), imagen = urlSegura(l.imagen);
  const out = { alt: texto(l.alt, 120) || nombre };
  // Un SVG sólo se incrusta si es nuestro (catálogo); cualquier otro va como imagen.
  if (svg && /^\/marcablanca\/logos\/[a-z0-9-]+\.svg$/.test(svg)) out.svg = svg;
  else if (svg || imagen) out.imagen = imagen || svg;
  return out;
}

/** Contenido de las maquetas para una marca que no trae el suyo. */
export function demoGenerica(nombre, sector) {
  const n = texto(nombre, 60) || 'La marca', corto = n.split(' ')[0];
  const tiendas = [['Centro', 'Gran Vía 24 · Madrid'], ['Diagonal', 'Av. Diagonal 512 · Barcelona'], ['Ruzafa', 'Carrer de Sueca 18 · Valencia']]
    .map(([b, dir]) => ({ nombre: `${corto} ${b}`, dir }));
  return {
    titular: `${n}, también en pantalla`, producto: 'Campaña de temporada', cta: 'Descúbrelo',
    prompt: `Cartel vertical de ${n}: producto protagonista, colores de marca, titular corto y llamada a la acción`,
    circuito: `Circuito ${corto} · 36 puntos`, puntos: 36, superficies: 148, imprDia: '84.200', cpm: '7,10 €',
    tipoEspacio: texto(sector, 40) || 'Retail físico', tiendas,
    superficiesTipo: ['escaparate', 'caja', 'pasillo'],
    piezas: ['Escaparate · temporada', 'Pantalla caja · promo', 'Pasillo · novedades'],
    incidencias: [
      { id: 'INC-4A21', equipo: 'Pantalla escaparate', tienda: tiendas[0].nombre, prioridad: 'Alta', estado: 'abierta' },
      { id: 'INC-4A17', equipo: 'Hilo musical', tienda: tiendas[1].nombre, prioridad: 'Media', estado: 'curso' },
      { id: 'INC-4A09', equipo: 'Player de caja', tienda: tiendas[2].nombre, prioridad: 'Baja', estado: 'resuelta' }
    ]
  };
}
function normalizarDemo(x, nombre, sector) {
  const g = demoGenerica(nombre, sector);
  if (!x || typeof x !== 'object') return g;
  const t3 = (v, f) => { const a = (Array.isArray(v) ? v : []).slice(0, 3); return a.length === 3 ? a.map(f) : null; };
  return {
    titular: texto(x.titular, 90) || g.titular, producto: texto(x.producto, 60) || g.producto, cta: texto(x.cta, 30) || g.cta,
    prompt: texto(x.prompt, 240) || g.prompt, circuito: texto(x.circuito, 60) || g.circuito,
    puntos: Number.isFinite(Number(x.puntos)) ? Math.max(0, Math.round(Number(x.puntos))) : g.puntos,
    superficies: Number.isFinite(Number(x.superficies)) ? Math.max(0, Math.round(Number(x.superficies))) : g.superficies,
    imprDia: texto(x.imprDia, 16) || g.imprDia, cpm: texto(x.cpm, 12) || g.cpm, tipoEspacio: texto(x.tipoEspacio, 40) || g.tipoEspacio,
    tiendas: t3(x.tiendas, (s) => ({ nombre: texto(s?.nombre, 40) || '—', dir: texto(s?.dir, 60) })) || g.tiendas,
    superficiesTipo: t3(x.superficiesTipo, (s) => texto(s, 24) || '—') || g.superficiesTipo,
    piezas: t3(x.piezas, (s) => texto(s, 50) || '—') || g.piezas,
    incidencias: t3(x.incidencias, (s) => ({ id: texto(s?.id, 12) || 'INC', equipo: texto(s?.equipo, 40), tienda: texto(s?.tienda, 40),
      prioridad: texto(s?.prioridad, 12), estado: ['abierta', 'curso', 'resuelta'].includes(s?.estado) ? s.estado : 'abierta' })) || g.incidencias
  };
}
function normalizarParcial(p, completa) {
  // Ajustes por plataforma (sólo la marca Admira los usa hoy): modo, logo, tipografía y colores parciales.
  const r = {};
  if (!p || typeof p !== 'object') return r;
  if (['claro', 'oscuro'].includes(p.modo)) r.modo = p.modo;
  if (p.logo) r.logo = normalizarLogo(p.logo, completa.nombre);
  if (p.tipografia) r.tipografia = normalizarTipografia({ ...completa.tipografia, ...p.tipografia }, completa.tipografia);
  if (p.colores && typeof p.colores === 'object') {
    r.colores = {};
    for (const modo of ['claro', 'oscuro']) if (p.colores[modo]) r.colores[modo] = normalizarPaleta({ ...completa.colores[modo], ...p.colores[modo] }, completa.colores[modo]);
  }
  return r;
}

/**
 * Limpia un JSON de cliente (del catálogo o generado en el navegador) para guardarlo con la
 * presentación o pintarlo en el servidor. Nunca lanza: lo que no se entiende se sustituye.
 */
export function normalizarMarca(m, opciones = {}) {
  m = m && typeof m === 'object' ? m : {};
  const nombre = texto(m.nombre, 80) || 'Prospect';
  const id = idMarca(m.id) || idMarca(nombre) || 'prospect';
  const modo = ['claro', 'oscuro'].includes(m.modo) ? m.modo : 'claro';
  const c = m.colores && typeof m.colores === 'object' ? m.colores : {};
  const ref = c[modo] || c.claro || c.oscuro || {};
  const base = { claro: derivarPaleta(ref.primario, ref.secundario, ref.acento, 'claro'), oscuro: derivarPaleta(ref.primario, ref.secundario, ref.acento, 'oscuro') };
  const tipo = normalizarTipografia(m.tipografia, TIPOGRAFIAS[opciones.tipografia] || TIPOGRAFIAS.grotesca);
  const radiosBase = (TIPOGRAFIAS[opciones.tipografia] || TIPOGRAFIAS.grotesca).radios;
  const r = m.radios || {}, s = m.sombras || {}, t = m.tono || {}, f = t.frases || {};
  const out = {
    $esquema: 'https://www.admiranext.com/marcablanca/clientes/esquema.json',
    id, nombre, nombreCorto: texto(m.nombreCorto, 40) || nombre.split(' ')[0],
    ejemplo: m.ejemplo === true,
    sector: texto(m.sector, 80), descripcion: texto(m.descripcion, 240),
    logo: normalizarLogo(m.logo, nombre),
    favicon: urlSegura(m.favicon) || '',
    modo,
    tipografia: tipo,
    radios: { sm: medida(r.sm, radiosBase.sm), md: medida(r.md, radiosBase.md), lg: medida(r.lg, radiosBase.lg), boton: medida(r.boton, radiosBase.boton), pill: medida(r.pill, '999px') },
    sombras: { sm: sombra(s.sm, '0 1px 2px rgba(0,0,0,.08)'), md: sombra(s.md, '0 8px 24px rgba(0,0,0,.12)'), lg: sombra(s.lg, '0 24px 60px rgba(0,0,0,.18)') },
    tono: {
      voz: texto(t.voz, 300) || `Claro, cercano y propio de ${nombre}.`, tratamiento: ['tú', 'usted', 'vosotros'].includes(t.tratamiento) ? t.tratamiento : 'tú',
      si: lista(t.si, 8, 40), no: lista(t.no, 8, 40),
      frases: { cta: texto(f.cta, 40) || 'Descúbrelo', vacio: texto(f.vacio, 120) || 'Todo en orden por aquí.', error: texto(f.error, 120) || 'Algo ha fallado. Lo estamos arreglando.', exito: texto(f.exito, 120) || '¡Listo!' }
    },
    colores: { claro: normalizarPaleta(c.claro, base.claro), oscuro: normalizarPaleta(c.oscuro, base.oscuro) }
  };
  if (m.plataformas && typeof m.plataformas === 'object') {
    const p = {};
    for (const k of PLATAFORMAS) if (m.plataformas[k]) p[k] = normalizarParcial(m.plataformas[k], out);
    if (Object.keys(p).length) out.plataformas = p;
  }
  out.demo = normalizarDemo(m.demo, nombre, out.sector);
  if (m.origen && typeof m.origen === 'object') out.origen = { tipo: texto(m.origen.tipo, 20), web: urlSegura(m.origen.web), creadaEn: texto(m.origen.creadaEn, 30) };
  return out;
}

/**
 * Genera un cliente completo con el mismo esquema que marcablanca/clientes/*.json.
 * @param {{nombre:string,id?:string,logo?:string|{svg?:string,imagen?:string,alt?:string},primario:string,secundario?:string,
 *          acento?:string,tipografia?:keyof TIPOGRAFIAS,modo?:'claro'|'oscuro',sector?:string,web?:string}} d
 */
export function crearMarca(d = {}) {
  const nombre = texto(d.nombre, 80) || 'Prospect';
  const tipo = TIPOGRAFIAS[d.tipografia] ? d.tipografia : 'grotesca';
  const T = TIPOGRAFIAS[tipo];
  // Sin modo pedido: un primario muy claro (amarillos, pasteles) luce mejor sobre oscuro.
  const modo = d.modo === 'oscuro' || d.modo === 'claro' ? d.modo : (esHex(d.primario) && luminancia(d.primario) > 0.45 ? 'oscuro' : 'claro');
  const logo = typeof d.logo === 'string' ? { imagen: d.logo } : (d.logo || {});
  return normalizarMarca({
    id: d.id || nombre, nombre, nombreCorto: d.nombreCorto, sector: d.sector || 'Prospect',
    descripcion: `Marca de ${nombre} generada en el generador de presentaciones de AdmiraNeXT.`,
    logo: { ...logo, alt: logo.alt || `Logo de ${nombre}` }, favicon: logo.svg || logo.imagen || '',
    modo,
    tipografia: { titulos: T.titulos, texto: T.texto, etiquetas: T.etiquetas, pesoTitulos: T.pesoTitulos, transformTitulos: T.transformTitulos, trackingTitulos: T.trackingTitulos, fuentes: T.fuentes },
    radios: T.radios,
    colores: { claro: derivarPaleta(d.primario, d.secundario, d.acento, 'claro'), oscuro: derivarPaleta(d.primario, d.secundario, d.acento, 'oscuro') },
    origen: { tipo: 'nueva', web: d.web || '', creadaEn: new Date().toISOString() }
  }, { tipografia: tipo });
}

/* ── Tokens ────────────────────────────────────────────────────────────── */
function esObjeto(o) { return o && typeof o === 'object' && !Array.isArray(o); }
export function fusionar(a, b) {
  const r = { ...(a || {}) };
  for (const k of Object.keys(b || {})) r[k] = esObjeto(r[k]) && esObjeto(b[k]) ? fusionar(r[k], b[k]) : b[k];
  return r;
}
function kebab(s) { return String(s).replace(/[A-Z]/g, (x) => '-' + x.toLowerCase()); }
/** La marca vista desde una plataforma (aplica plataformas[p] si existe). */
export function marcaEn(m, plataforma) { return plataforma && m?.plataformas?.[plataforma] ? fusionar(m, m.plataformas[plataforma]) : m; }
export function modoDe(m, pedido) { const d = Object.keys(m?.colores || {}); return d.includes(pedido) ? pedido : (d.includes(m?.modo) ? m.modo : (d[0] || 'claro')); }
/** Mismo mapa que marcablanca.js → variables(). */
export function variablesMarca(m, modo) {
  const v = {}, md = modoDe(m, modo);
  const paleta = m?.colores?.[md] || {};
  for (const k of Object.keys(paleta)) v['--mb-' + kebab(k)] = paleta[k];
  const t = m?.tipografia || {};
  if (t.titulos) v['--mb-fuente-titulos'] = t.titulos;
  if (t.texto) v['--mb-fuente-texto'] = t.texto;
  if (t.mono) v['--mb-fuente-mono'] = t.mono;
  v['--mb-fuente-etiquetas'] = t.etiquetas || t.texto || 'inherit';
  if (t.pesoTitulos) v['--mb-peso-titulos'] = String(t.pesoTitulos);
  v['--mb-titulos-transform'] = t.transformTitulos || 'none';
  v['--mb-titulos-tracking'] = t.trackingTitulos || 'normal';
  for (const k of Object.keys(m?.radios || {})) v['--mb-radio-' + kebab(k)] = m.radios[k];
  for (const k of Object.keys(m?.sombras || {})) v['--mb-sombra-' + kebab(k)] = m.sombras[k];
  return v;
}
/** Declaraciones CSS («--mb-x:valor;…») listas para un style o una regla. Descarta lo sospechoso. */
export function cssVariables(vars) {
  return Object.keys(vars).filter((k) => /^--mb-[a-z0-9-]+$/.test(k) && !/[;{}<>\\]/.test(String(vars[k]))).map((k) => `${k}:${vars[k]}`).join(';');
}
/** @font-face de las fuentes propias de la marca (sólo /marcablanca/fuentes). */
export function cssFuentes(m) {
  const vistas = new Set();
  return (m?.tipografia?.fuentes || []).filter((f) => /^\/marcablanca\/fuentes\/[a-z0-9-]+\.woff2$/.test(f.url) && /^[A-Za-z0-9 -]+$/.test(f.familia))
    .filter((f) => { const k = f.familia + f.url; if (vistas.has(k)) return false; vistas.add(k); return true; })
    .map((f) => `@font-face{font-family:'${f.familia}';font-style:normal;font-weight:${/^\d{3}( \d{3})?$/.test(f.peso) ? f.peso : '400 700'};font-display:swap;src:url('${f.url}') format('woff2')}`).join('');
}

if (typeof globalThis !== 'undefined' && typeof window !== 'undefined') {
  window.MarcaBlancaMarca = { VERSION, PLATAFORMAS, TIPOGRAFIAS, crearMarca, normalizarMarca, derivarPaleta, paletaDesdeColores, variablesMarca, cssVariables, cssFuentes, contraste, textoSobre, idMarca, urlSegura, marcaEn, modoDe };
}
