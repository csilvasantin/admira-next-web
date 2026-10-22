/*
 * Encargos abiertos por persona — tabla matinal (Carlos, 19-10-2026).
 *
 * Vive en functions/ a propósito: Cloudflare Pages no sirve esta carpeta como
 * asset (GET /functions/... da 404), así que las cifras solo salen por
 * /roadmap/encargos, detrás del login (functions/roadmap/encargos.js).
 *
 * De dónde salen las cifras, por orden:
 *   1) KV PRESENTATION_IDEAS, clave «encargos:matinal» (mismo formato que SEMILLA).
 *      Permite refrescar cada mañana SIN redesplegar. Si falta o está mal, se ignora.
 *   2) SEMILLA, abajo: la tabla del 19-10-2026 08:01 (Europe/Madrid).
 * Hoy no hay ningún endpoint ni secreto en este repo que lea el bot-inbox de
 * admira.live en vivo; no se inventa uno. Para regenerar el JSON desde el HTML
 * matinal: node scripts/encargos-matinal.mjs <tabla.html>.
 *
 * Cada fila puede traer, además del recuento:
 *   encargos: [{ numero, titulo, estado, desde }]
 *     estado: pending | ack | in_progress | blocked | done | cancelled
 *     desde: fecha ISO
 *   trabajando: true  — si el parte sabe que hay un encargo en curso y aún no
 *     trae la lista. Un encargo in_progress también marca la fila.
 * La página parte las filas en dos tablas (agentes | consejeros). «Resto de
 * agentes» a cero se abre en Cypher, Switch, Link, Perséfone, Seraph,
 * Arquitecto y Merovingio, que es lo que ya decía la nota. Huang se ve como
 * Jensen.
 */
export const CLAVE_KV = 'encargos:matinal';

export const SEMILLA = Object.freeze({
  fecha: '2026-10-19T08:01:00+02:00',
  fuente: 'semilla · tabla matinal del 19-10-2026',
  filas: [
    { persona: 'Wozniak', abiertos: 0, hoy: 0, ayer: 0, anteriores: 0 },
    { persona: 'Jobs', abiertos: 1, hoy: 1, ayer: 0, anteriores: 0 },
    { persona: 'Lucas', abiertos: 1, hoy: 0, ayer: 0, anteriores: 1 },
    { persona: 'Disney', abiertos: 0, hoy: 0, ayer: 0, anteriores: 0 },
    { persona: 'Musk', abiertos: 5, hoy: 2, ayer: 3, anteriores: 0 },
    { persona: 'Huang', abiertos: 0, hoy: 0, ayer: 0, anteriores: 0 },
    { persona: 'Neo', abiertos: 5, hoy: 0, ayer: 1, anteriores: 4 },
    { persona: 'Morfeo', abiertos: 8, hoy: 0, ayer: 8, anteriores: 0 },
    { persona: 'Trinity', abiertos: 9, hoy: 0, ayer: 5, anteriores: 4 },
    { persona: 'Oráculo', abiertos: 6, hoy: 0, ayer: 4, anteriores: 2 },
    { persona: 'Smith', abiertos: 18, hoy: 0, ayer: 7, anteriores: 11 },
    { persona: 'Niobe', abiertos: 8, hoy: 0, ayer: 7, anteriores: 1 },
    { persona: 'Resto de agentes', abiertos: 0, hoy: 0, ayer: 0, anteriores: 0 },
  ],
  notas: [
    'De Y no hay cifras.',
  ],
});

export const COLUMNAS = Object.freeze(['abiertos', 'hoy', 'ayer', 'anteriores']);

/** Orden pedido: agentes a la izquierda, consejeros a la derecha. */
export const AGENTES = Object.freeze(['Neo', 'Morfeo', 'Trinity', 'Oráculo', 'Smith', 'Cypher', 'Niobe', 'Switch', 'Link', 'Perséfone', 'Seraph', 'Arquitecto', 'Merovingio']);
export const CONSEJEROS = Object.freeze(['Wozniak', 'Jobs', 'Lucas', 'Disney', 'Musk', 'Huang', 'Lasseter', 'Ive', 'Y']);

const RESTO_MIEMBROS = Object.freeze(['Cypher', 'Switch', 'Link', 'Perséfone', 'Seraph', 'Arquitecto', 'Merovingio']);
const ESTADOS = new Set(['pending', 'ack', 'in_progress', 'blocked', 'done', 'cancelled']);
const ETIQUETA = Object.freeze({ Huang: 'Jensen' });
const ALIAS = new Map([
  ['neo', 'Neo'], ['morfeo', 'Morfeo'], ['trinity', 'Trinity'], ['oraculo', 'Oráculo'],
  ['smith', 'Smith'], ['cypher', 'Cypher'], ['niobe', 'Niobe'], ['switch', 'Switch'],
  ['link', 'Link'], ['persefone', 'Perséfone'], ['seraph', 'Seraph'], ['arquitecto', 'Arquitecto'],
  ['merovingio', 'Merovingio'], ['wozniak', 'Wozniak'], ['jobs', 'Jobs'], ['lucas', 'Lucas'],
  ['disney', 'Disney'], ['musk', 'Musk'], ['huang', 'Huang'], ['jensen', 'Huang'],
  ['jensen huang', 'Huang'], ['lasseter', 'Lasseter'], ['ive', 'Ive'], ['jony', 'Ive'],
  ['jony ive', 'Ive'], ['y', 'Y'],
]);

const entero = (v) => (Number.isInteger(v) && v >= 0 ? v : null);
const clave = (s) => String(s || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();

export function canonPersona(persona) {
  const raw = String(persona || '').trim().replace(/\s+/g, ' ');
  return ALIAS.get(clave(raw)) || raw;
}

export function etiqueta(persona) {
  const id = canonPersona(persona);
  return ETIQUETA[id] || id;
}

export function ladoDe(persona) {
  const id = canonPersona(persona);
  if (CONSEJEROS.includes(id) || clave(persona).includes('consejer')) return 'consejeros';
  return 'agentes';
}

export function estaEnCurso(fila) {
  return !!(fila && (fila.trabajando === true || (fila.encargos || []).some((e) => e.estado === 'in_progress')));
}

function encargosDe(f) {
  if (f.encargos == null) return [];
  if (!Array.isArray(f.encargos) || f.encargos.length > 100) return null;
  const out = [];
  for (const e of f.encargos) {
    if (!e || typeof e !== 'object') return null;
    const numero = typeof e.numero === 'number' ? e.numero : Number(String(e.numero ?? '').trim());
    if (!Number.isInteger(numero) || numero <= 0) return null;
    const titulo = String(e.titulo ?? '').trim().slice(0, 200);
    if (!titulo) return null;
    const estado = String(e.estado ?? '').trim();
    if (!ESTADOS.has(estado)) return null;
    const desde = String(e.desde ?? '').trim();
    if (Number.isNaN(new Date(desde).getTime())) return null;
    out.push({ numero, titulo, estado, desde });
  }
  return out;
}

/** Valida y normaliza un parte; devuelve null si no sirve (nunca medio parte). */
export function normalizar(parte) {
  if (!parte || typeof parte !== 'object' || !Array.isArray(parte.filas) || !parte.filas.length) return null;
  const fecha = new Date(parte.fecha);
  if (Number.isNaN(fecha.getTime())) return null;
  const filas = [];
  for (const f of parte.filas) {
    const persona = String((f && f.persona) || '').trim().slice(0, 80);
    if (!persona) return null;
    const fila = { persona };
    for (const c of COLUMNAS) {
      const n = entero(f[c]);
      if (n === null) return null;
      fila[c] = n;
    }
    const encargos = encargosDe(f);
    if (encargos === null) return null;
    if (encargos.length) fila.encargos = encargos;
    if (f.trabajando != null) {
      if (typeof f.trabajando !== 'boolean') return null;
      if (f.trabajando) fila.trabajando = true;
    }
    filas.push(fila);
  }
  const notas = Array.isArray(parte.notas) ? parte.notas.map((n) => String(n).slice(0, 300)).filter(Boolean).slice(0, 10) : [];
  return { fecha: parte.fecha, fuente: String(parte.fuente || 'kv').slice(0, 120), filas, notas };
}

export function totales(filas) {
  const t = { persona: 'Total' };
  for (const c of COLUMNAS) t[c] = filas.reduce((s, f) => s + f[c], 0);
  return t;
}

function fusionar(filas) {
  const map = new Map();
  const orden = [];
  for (const f of filas) {
    const id = canonPersona(f.persona);
    const prev = map.get(id);
    if (!prev) {
      map.set(id, { ...f, persona: id, encargos: f.encargos ? f.encargos.slice() : undefined });
      orden.push(id);
      continue;
    }
    for (const c of COLUMNAS) prev[c] += f[c];
    if (f.encargos) prev.encargos = (prev.encargos || []).concat(f.encargos);
    if (f.trabajando) prev.trabajando = true;
  }
  return orden.map((id) => {
    const f = map.get(id);
    if (f.encargos && !f.encargos.length) delete f.encargos;
    return f;
  });
}

function expandirResto(filas) {
  const resto = filas.find((f) => clave(f.persona) === 'resto de agentes');
  const vacio = resto && COLUMNAS.every((c) => resto[c] === 0) && !(resto.encargos && resto.encargos.length) && !resto.trabajando;
  const base = vacio ? filas.filter((f) => f !== resto) : filas.slice();
  if (!vacio) return base;
  const presentes = new Set(base.map((f) => canonPersona(f.persona)));
  for (const n of RESTO_MIEMBROS) {
    if (!presentes.has(n)) base.push({ persona: n, abiertos: 0, hoy: 0, ayer: 0, anteriores: 0 });
  }
  return base;
}

function ordenar(filas, roster) {
  const rank = new Map(roster.map((n, i) => [n, i]));
  return filas.slice().sort((a, b) => {
    const ra = rank.has(a.persona) ? rank.get(a.persona) : roster.length;
    const rb = rank.has(b.persona) ? rank.get(b.persona) : roster.length;
    if (ra !== rb) return ra - rb;
    return etiqueta(a.persona).localeCompare(etiqueta(b.persona), 'es');
  });
}

/** Dos listas, ya ordenadas, listas para pintar. No muta el parte. */
export function dividir(filas) {
  const agentes = [];
  const consejeros = [];
  for (const f of expandirResto(fusionar(filas))) {
    (ladoDe(f.persona) === 'consejeros' ? consejeros : agentes).push(f);
  }
  return { agentes: ordenar(agentes, AGENTES), consejeros: ordenar(consejeros, CONSEJEROS) };
}

/** El parte vigente: KV si es válido, si no la semilla. */
export async function parteVigente(env) {
  try {
    const kv = env && env.PRESENTATION_IDEAS;
    if (kv && typeof kv.get === 'function') {
      const crudo = await kv.get(CLAVE_KV);
      if (crudo) {
        const p = normalizar(JSON.parse(crudo));
        if (p) return { ...p, origen: 'kv' };
      }
    }
  } catch (_) { /* KV caído o JSON roto: se sirve la semilla */ }
  return { ...normalizar(SEMILLA), origen: 'semilla' };
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function fechaMadrid(iso) {
  const d = new Date(iso);
  const dia = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', day: 'numeric', month: 'short', year: 'numeric' }).format(d).replace(/\s+de\s+/g, '-').replace(/\./g, '').replace(/\s+/g, '-');
  const hora = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
  return `${dia} a las ${hora}`;
}

function filaHtml(f) {
  const id = canonPersona(f.persona);
  const curso = estaEnCurso(f);
  const attrs = [
    curso ? 'class="enc-activo"' : '',
    `data-persona="${esc(id)}"`,
    `data-orden="${esc(etiqueta(id))}"`,
    'tabindex="0"',
    'aria-expanded="false"',
    'aria-controls="enc-detalle"',
  ].filter(Boolean).join(' ');
  const nombre = esc(etiqueta(id)) + (curso ? ' <span class="enc-curso">en curso</span>' : '');
  return `<tr ${attrs}><td>${nombre}</td>${COLUMNAS.map((c) => `<td>${f[c]}</td>`).join('')}</tr>`;
}

function totalHtml(filas) {
  const t = totales(filas);
  return `<tr><td>${esc(t.persona)}</td>${COLUMNAS.map((c) => `<td>${t[c]}</td>`).join('')}</tr>`;
}

function detalleJson(filas) {
  const o = {};
  for (const f of filas) {
    if (!f.encargos || !f.encargos.length) continue;
    o[canonPersona(f.persona)] = f.encargos.map((e) => ({
      numero: e.numero,
      titulo: e.titulo,
      estado: e.estado,
      desde: fechaMadrid(e.desde),
    }));
  }
  return JSON.stringify(o)
    .replace(/[<>&]/g, (c) => ({ '<': '\\u003c', '>': '\\u003e', '&': '\\u0026' }[c]))
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/** Pinta las dos tablas, sus totales y el detalle para inyectar en roadmap/encargos.html. */
export function htmlParte(parte) {
  const { agentes, consejeros } = dividir(parte.filas);
  return {
    fecha: esc(fechaMadrid(parte.fecha)),
    origen: parte.origen === 'kv' ? 'parte del día (KV)' : 'semilla del 19-10-2026',
    agentes: agentes.map(filaHtml).join('\n'),
    totalAgentes: totalHtml(agentes),
    consejeros: consejeros.map(filaHtml).join('\n'),
    totalConsejeros: totalHtml(consejeros),
    detalle: detalleJson(agentes.concat(consejeros)),
    notas: parte.notas.map((n) => `<p class="enc-nota">${esc(n)}</p>`).join('\n'),
  };
}
