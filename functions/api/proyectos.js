/**
 * /api/proyectos — el censo, con lo que está vivo AHORA y si cumple la norma.
 *
 * Dos cosas que la página no sabía hacer y ahora hace sola:
 *
 * 1. LEER la versión en vez de tenerla escrita. La tabla llevaba los sellos a
 *    mano, con la fecha en que alguien los miró; eso convierte el registro en una
 *    foto vieja justo cuando más falta hace que sea un espejo. El mismo 3 de
 *    agosto la tabla declaraba de yokup la r14 del día 2, mientras la portada ya
 *    servía la r7 del día 3.
 *
 * 2. CONTROLAR que se cumple. La norma 07 dice cómo se escribe el sello
 *    (v.DD.MM.AAAA.rN.HH:MM, con la hora de publicación) y la 09 que cada cambio
 *    publicado sube la r. Una norma que nadie comprueba es una sugerencia: aquí
 *    se comprueba solución por solución y se dice quién la incumple.
 *
 * De dónde sale el sello y su firma:
 *   1. <meta name="admiranext-version">     — versión visible de la portada
 *   2. /version.json                         — firma obligatoria del responsable
 *   3. un v.… suelto en el HTML              — último recurso, el del pie
 *
 * Aunque exista meta se lee SIEMPRE version.json: la versión sin firma ya no
 * cumple. Los dos sellos deben coincidir y la firma debe ser exactamente
 * «AgenteConEquipo · EquipoFisico», con commit y worktree limpio.
 *
 * Se sirve en dos partes para no dispararle al edge más peticiones externas de
 * las que puede hacer en una sola invocación:
 *   /api/proyectos            censo + sello vivo + veredicto de la norma
 *   /api/proyectos?parte=retornos   censo + etiquetas reales de cada repositorio
 */
import { sesion } from '../_webmaster-gate.js';
import { PROYECTOS } from '../_proyectos.js';

const GH = 'https://api.github.com';
// Cualquier sello con pinta de tal, sea del formato que sea: primero hay que
// encontrarlo para poder decir que está mal escrito.
const SELLO = /v\.?\d{2,4}[.-]\d{2}[.-]\d{2,4}(?:\.r\d+)?(?:\.\d{2}:\d{2})?/i;
const SELLO_G = new RegExp(SELLO.source, 'gi');
// El canónico de la norma 07: fecha, release y HORA de publicación.
// Dos releases del mismo día ya se distinguían por la r, pero la r no dice
// CUÁNDO: con varias máquinas publicando a la vez, saber que algo salió a las
// 11:18 y no a las 09:40 es lo que permite cruzar un sello con un incidente.
const CANONICO = /^v\.\d{2}\.\d{2}\.\d{4}\.r\d+\.\d{2}:\d{2}$/;
// El formato anterior —el mismo pero sin hora— se sigue reconociendo para poder
// decir qué le falta, en vez de tratarlo como si estuviera escrito de cualquier manera.
const SIN_HORA = /^v\.\d{2}\.\d{2}\.\d{4}\.r\d+$/;
export const RESPONSABLE_POR_DEFECTO = 'NeoMacMini';
const RESPONSABLE_KEY = 'webmaster:responsable:';
const YOKUP_API = 'https://api.yokup.com';
const EQUIPOS_POR_APELLIDO = [
  ['mbaazul', 'MacBookAirAzul'], ['mbarosa', 'MacBookAirRosa'],
  ['mbacrema', 'MacBookAirCrema'], ['mbaplata', 'MacBookAirPlata'],
  ['mba16', 'MacBookAir16plata'], ['mbp14', 'MacBookProNegro14'],
  ['mbp16', 'MacBook Pro 16'], ['zenbook', 'ASUS Zenbook'],
  ['mini', 'Mac Mini'], ['dgx', 'DGX Spark'], ['pgx', 'ThinkStation PGX'],
];

const json = (o, s = 200) => new Response(JSON.stringify(o), {
  status: s,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

export function normalizarResponsable(valor) {
  const limpio = String(valor || '').trim().replace(/\s+/g, ' ');
  return limpio ? limpio.slice(0, 80) : RESPONSABLE_POR_DEFECTO;
}

export function equipoDelResponsable(valor) {
  const clave = String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '');
  const entrada = EQUIPOS_POR_APELLIDO.find(([apellido]) => clave.endsWith(apellido));
  return entrada ? entrada[1] : '';
}

function claveEquipo(valor) {
  return String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '').replace(/^admira/, '');
}

function slugProyecto(valor) {
  return String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function claveWeb(valor) {
  const raw = String(valor || '').trim();
  if (!raw) return '';
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    return `${url.hostname.toLowerCase().replace(/^www\./, '')}${url.pathname.replace(/\/+$/, '') || ''}`;
  } catch (_) { return ''; }
}

export function resolverProyectoYokup(proyecto, proyectosYokup) {
  const filas = Array.isArray(proyectosYokup) ? proyectosYokup : [];
  const ids = new Set([
    proyecto && proyecto.yokupId,
    proyecto && proyecto.clave,
    slugProyecto(proyecto && proyecto.nombre),
  ].map(slugProyecto).filter(Boolean));
  const porId = filas.find((fila) => ids.has(slugProyecto(fila && fila.id)));
  if (porId) return porId;

  const web = claveWeb(proyecto && proyecto.url);
  if (web) {
    const porWeb = filas.find((fila) => claveWeb(fila && fila.web) === web);
    if (porWeb) return porWeb;
  }
  const nombre = slugProyecto(proyecto && proyecto.nombre);
  return filas.find((fila) => slugProyecto(fila && fila.name) === nombre) || null;
}

export async function sincronizarResponsableYokup(proyecto, responsable, fetchYokup = fetch) {
  let listado;
  try {
    listado = await fetchYokup(`${YOKUP_API}/projects`, { cache:'no-store' });
  } catch (_) {
    throw Object.assign(new Error('Yokup no responde; no se ha guardado'), { status:502 });
  }
  if (!listado || !listado.ok) {
    throw Object.assign(new Error('Yokup no responde; no se ha guardado'), { status:502 });
  }
  const censo = await listado.json().catch(() => ({}));
  const destino = resolverProyectoYokup(proyecto, censo.projects);
  if (!destino) {
    throw Object.assign(new Error('el proyecto no tiene ficha canónica en Yokup'), { status:409 });
  }

  // El responsable de Webmaster no es una etiqueta editorial: define la unión
  // permanente proyecto → agente → equipo. Se preservan las asignaciones que ya
  // existían y se añade la principal; el pulso sólo decidirá si está conectada.
  const equipo = equipoDelResponsable(responsable);
  const agentes = [...new Set([...(Array.isArray(destino.agents) ? destino.agents : []), responsable])];
  const equipos = [...new Set(Array.isArray(destino.machines) ? destino.machines : [])];
  if (equipo && !equipos.some((actual) => claveEquipo(actual) === claveEquipo(equipo))) equipos.push(equipo);
  let guardado;
  try {
    guardado = await fetchYokup(`${YOKUP_API}/projects`, {
      method:'POST',
      headers:{ 'content-type':'application/json', 'x-admira-source':'webmaster' },
      body:JSON.stringify({
        id:destino.id,
        owner:responsable,
        primary_responsible:responsable,
        agents:agentes,
        machines:equipos,
        by:'AdmiraNeXT Webmaster',
      }),
    });
  } catch (_) {
    throw Object.assign(new Error('Yokup no pudo guardar el responsable'), { status:502 });
  }
  const resultado = await guardado.json().catch(() => ({}));
  const confirmado = resultado && resultado.project
    && (resultado.project.primary_responsible || resultado.project.owner) === responsable
    && Array.isArray(resultado.project.agents) && resultado.project.agents.includes(responsable)
    && (!equipo || (Array.isArray(resultado.project.machines)
      && resultado.project.machines.some((actual) => claveEquipo(actual) === claveEquipo(equipo))));
  if (!guardado.ok || !resultado.ok || !confirmado) {
    throw Object.assign(new Error(resultado.error || 'Yokup no confirmó el responsable'), { status:502 });
  }
  return { id:destino.id, name:destino.name || destino.id };
}

async function leerResponsables(env) {
  if (!env.PRESENTATION_IDEAS) return {};
  const pares = await Promise.all(PROYECTOS.map(async (p) => {
    try {
      const guardado = await env.PRESENTATION_IDEAS.get(`${RESPONSABLE_KEY}${p.clave}`, { type:'json' });
      return [p.clave, guardado && guardado.responsable];
    } catch (_) { return [p.clave, null]; }
  }));
  return Object.fromEntries(pares);
}

function cabecerasGh(env) {
  const h = { 'User-Agent': 'admiranext-webmaster', Accept: 'application/vnd.github+json' };
  // Los tres workers de la flota están en repositorios privados. Sin token, la
  // llamada devuelve el mismo 404 que un repositorio inexistente, así que sin
  // esto la ficha mentiría diciendo «no tiene etiquetas».
  if (env.GITHUB_TOKEN) h.Authorization = `Bearer ${env.GITHUB_TOKEN}`;
  return h;
}

/**
 * No preguntar dos veces lo mismo dentro de la misma petición.
 *
 * Con las veinte subsoluciones de admira.tv el censo pasó de 21 filas a 41, y
 * todas ellas comparten portada (`estadoUrl`) y repositorio con su padre: sin
 * esto, una sola carga de la tabla pedía la misma portada veintiuna veces y la
 * misma lista de commits otras tantas. Se memoriza la PROMESA, así que las
 * llamadas en paralelo se enganchan a la que ya está en vuelo en vez de abrir
 * otra. El mapa dura lo que la petición: nada se queda cacheado entre cargas.
 */
const memo = (cache, clave, calcular) => {
  if (!cache) return calcular();
  if (!cache.has(clave)) cache.set(clave, calcular());
  return cache.get(clave);
};

async function traer(url, opciones = {}) {
  try {
    const r = await fetch(url, { redirect: 'follow', cf: { cacheTtl: 300, cacheEverything: true }, ...opciones });
    return r.ok ? r : null;
  } catch (_) {
    return null;
  }
}

/**
 * Sitúa un sello en el calendario, escríbase como se escriba. Hace falta para
 * comparar con los commits: si no se sabe de qué día es el sello, no se puede
 * decir que se ha tocado el sitio después de publicarlo.
 */
function fechaDelSello(sello) {
  const m = String(sello || '').replace(/^v\.?/i, '').split('.');
  if (m.length < 3) return null;
  let [a, b, c] = m;
  let anio, mes, dia;
  if (a.length === 4) { anio = +a; mes = +b; dia = +c; }        // v.AAAA.MM.DD — año delante
  else if (c.length === 4) { dia = +a; mes = +b; anio = +c; }   // v.DD.MM.AAAA — el de la norma
  else { anio = 2000 + +a; mes = +b; dia = +c; }                // v.AA.MM.DD
  if (!anio || !mes || !dia || mes > 12 || dia > 31) return null;
  return new Date(Date.UTC(anio, mes - 1, dia));
}

/**
 * Demuestra que deployedAt puede gobernar el corte de commits. Además de ser
 * ISO UTC y no futuro, debe corresponder a la fecha/hora del sello vista desde
 * Madrid (el sello público usa la hora local). Se toleran diez minutos porque
 * el comando de Pages puede terminar unos minutos después de acuñar el sello.
 */
function evidenciaDespliegue(sello, valor) {
  const raw = String(valor || '');
  if (!raw) return { ok: false, instant: NaN, error: 'Falta deployedAt.' };
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(raw)) {
    return { ok: false, instant: NaN, error: 'deployedAt no es una fecha ISO UTC válida.' };
  }
  const instant = Date.parse(raw);
  if (!Number.isFinite(instant)) return { ok: false, instant: NaN, error: 'deployedAt no es una fecha válida.' };
  const normalizada = raw.includes('.') ? raw : raw.replace(/Z$/, '.000Z');
  if (new Date(instant).toISOString() !== normalizada) {
    return { ok: false, instant: NaN, error: 'deployedAt contiene una fecha u hora imposible.' };
  }
  if (instant > Date.now() + 10 * 60 * 1000) {
    return { ok: false, instant: NaN, error: 'deployedAt está en el futuro.' };
  }

  const stamp = String(sello || '').match(/^v\.(\d{2})\.(\d{2})\.(\d{4})\.r\d+\.(\d{2}):(\d{2})$/);
  if (!stamp) return { ok: false, instant: NaN, error: 'El sello no permite contrastar deployedAt.' };
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(instant)).filter((p) => p.type !== 'literal').map((p) => [p.type, p.value]));
  const declared = Date.UTC(+stamp[3], +stamp[2] - 1, +stamp[1], +stamp[4], +stamp[5]);
  const observed = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
  if (Math.abs(observed - declared) > 10 * 60 * 1000) {
    return { ok: false, instant: NaN, error: 'deployedAt no corresponde a la fecha y hora del sello.' };
  }
  return { ok: true, instant, error: '' };
}

/**
 * Salta la caché del edge sin renunciar del todo a ella.
 *
 * Sin esto el control acusa en falso: Cloudflare sirve la portada cacheada, así
 * que recién publicado se lee el sello ANTERIOR y la solución aparece «con
 * cambios sin versionar» cuando acaba de versionar. Pasó en el estreno, con
 * admiranext.com: producción servía ya la r1 y la lectura seguía viendo la r12.
 * El sufijo cambia cada minuto: dentro del mismo minuto sí se reaprovecha.
 */
const fresco = (url) => url + (url.includes('?') ? '&' : '?') + 'wm=' + Math.floor(Date.now() / 60000);

/** Lee de la portada qué versión está publicada de verdad. */
export async function selloVivo(p, cache) {
  if (!p.url) return { sello: null, fuente: 'sin-web' };

  // Una subsolución puede tener su propia URL de entrada y, aun así, compartir
  // exactamente el mismo artefacto y release que su sitio padre. `estadoUrl`
  // separa esas dos responsabilidades: la tabla abre `url`, pero verifica el
  // sello y version.json del despliegue que realmente la publica.
  const estadoUrl = p.estadoUrl || p.url;

  // Misma portada, misma respuesta: se lee una vez por petición.
  return memo(cache, `sello:${estadoUrl}`, () => leerSello(estadoUrl));
}

async function leerSello(estadoUrl) {
  const r = await traer(fresco(estadoUrl), { headers: { 'User-Agent': 'Mozilla/5.0 (admiranext-webmaster)' } });
  if (!r) return { sello: null, fuente: 'error' };

  const html = (await r.text()).slice(0, 400000);

  let sello = null, fuente = 'sin-sello';
  const meta = html.match(/<meta[^>]+name=["']admiranext-version["'][^>]*>/i);
  if (meta) {
    const contenido = (meta[0].match(/content=["']([^"']*)["']/i) || [])[1] || '';
    const m = contenido.match(SELLO);
    if (m) { sello = m[0]; fuente = 'meta'; }
    else if (contenido.trim()) { sello = contenido.trim(); fuente = 'meta'; }
  }

  let firma = { quien: '', machine: '', commit: '', deployedAt: '', version: '', valida: false, error: '' };
  const vj = await traer(fresco(`${estadoUrl.replace(/\/$/, '')}/version.json`));
  if (vj) {
    try {
      const d = await vj.json();          // un SPA devuelve su HTML aquí: revienta y seguimos
      if (d && d.version) {
        const versionFirmada = String(d.version);
        const responsable = String(d.deployer || d.agent || '');
        const machine = String(d.machine || '');
        const signature = String(d.signature || '');
        const commit = String(d.gitShort || d.git || '');
        const deployedAt = String(d.deployedAt || '');
        const despliegue = evidenciaDespliegue(versionFirmada, deployedAt);
        const esperada = responsable && machine ? `${responsable} · ${machine}` : '';
        if (!sello) { sello = versionFirmada; fuente = 'version.json'; }
        firma = {
          quien: signature,
          machine,
          commit,
          deployedAt: despliegue.ok ? deployedAt : '',
          version: versionFirmada,
          valida: !!(signature && esperada && signature === esperada && commit
            && d.dirty === false && versionFirmada === sello && despliegue.ok),
          error: !signature ? 'Falta signature.'
            : !responsable ? 'Falta deployer/agent.'
            : !machine ? 'Falta machine.'
            : signature !== esperada ? `La firma debe ser «${esperada}».`
            : !commit ? 'Falta gitShort/git.'
            : d.dirty !== false ? 'El release no declara dirty:false.'
            : versionFirmada !== sello ? `version.json firma ${versionFirmada}, pero la portada declara ${sello}.`
            : !despliegue.ok ? despliegue.error
            : '',
        };
      }
    } catch (_) { /* no era JSON */ }
  }

  if (sello) return { sello, fuente, ...firma };

  // Rebuscar en el HTML es el último recurso y el que más se equivoca: en
  // admira.store convivían el sello bueno del pie y un «v26.04.05» suelto de un
  // asset, y quedarse con el último daba por publicada una versión de abril. Se
  // elige la candidata más creíble, no la última que aparece.
  const sueltos = html.match(SELLO_G) || [];
  if (sueltos.length) {
    const mejor = sueltos.find((s) => CANONICO.test(s))
      || sueltos.filter((s) => /\.r\d+$/i.test(s)).pop()
      || sueltos[sueltos.length - 1];
    return { sello: mejor, fuente: 'html', ...firma };
  }

  return { sello: null, fuente: 'sin-sello' };
}

/**
 * El veredicto de la norma para una solución.
 *
 * `sinVersionar` es una señal, no una sentencia: hay repositorios que sostienen
 * más de una solución (tool lleva el sitio yokup y el worker yokup-rtc), así que
 * un commit posterior al sello puede no ser de esta. Por eso se dice cuántos
 * cambios hay y desde cuándo, y lo juzga quien mira.
 */
export async function veredicto(p, v, env, cache) {
  if (!p.url && p.tipo === 'worker') {
    return { estado: 'worker', texto: 'Worker: la versión viva se consulta con wrangler, no hay portada que sellar.' };
  }
  if (!p.url) {
    // No es que incumpla el sello: es que en el censo no consta dónde está
    // publicado, así que no hay portada donde ir a leerlo. Se arregla declarando
    // la url en _proyectos.js, no tocando el sitio.
    return { estado: 'sin-url', texto: 'El censo no declara en qué dirección está publicado: sin url no hay portada donde leer el sello.' };
  }
  if (!v.sello) {
    return {
      estado: 'sin-sello',
      texto: v.fuente === 'error'
        ? 'El sitio no respondió: no se puede saber qué versión está publicada.'
        : 'La portada no declara versión. Norma 07: el sello va en el pie y en <meta name="admiranext-version">.',
    };
  }

  const formatoOk = CANONICO.test(v.sello);
  const fecha = fechaDelSello(v.sello);
  const despliegue = evidenciaDespliegue(v.sello, v.deployedAt);
  const instantePublicado = despliegue.ok ? despliegue.instant : NaN;
  const firmaValida = !!v.valida && despliegue.ok;

  // ¿Se ha tocado el repositorio después de publicar ese sello?
  //
  // A un WORKER no se le pregunta esto (Morfeo, 2026-08-09). Un worker que publica su
  // sello en /version.json ya se puede verificar por la firma, que es lo que importa;
  // pero su repositorio sostiene además otras soluciones —`tool` lleva el sitio yokup
  // y este worker— así que cualquier commit del vecino lo dejaría en rojo para siempre
  // y el aviso dejaría de significar nada. Se juzga por la firma; la marcha atrás de un
  // worker tampoco es de git, es `wrangler rollback`.
  let sinVersionar = 0, ultimoCambio = '';
  if (fecha && p.tipo !== 'worker') {
    // version.json conoce el instante real del deploy. Usarlo evita el agujero
    // de la comparación antigua, que empezaba el día siguiente y no veía un
    // commit hecho a las 22:00 después de publicar a las 19:00. Los sitios
    // históricos sin deployedAt mantienen el fallback conservador anterior.
    const desde = Number.isFinite(instantePublicado)
      ? new Date(instantePublicado + 1000).toISOString()
      : new Date(fecha.getTime() + 24 * 3600 * 1000).toISOString();
    // Mismo repositorio y mismo sello ⇒ misma lista de commits: las veinte
    // subsoluciones de admira.tv se resuelven con una sola llamada a GitHub.
    const d = await memo(cache, `commits:${p.repo}:${desde}`, async () => {
      const r = await traer(`${GH}/repos/${p.repo}/commits?per_page=30&since=${desde}`, { headers: cabecerasGh(env) });
      if (!r) return null;
      try { return await r.json(); } catch (_) { return null; }   // ilegible
    });
    if (Array.isArray(d)) {
      sinVersionar = d.length;
      if (sinVersionar) ultimoCambio = d[0]?.commit?.author?.date || '';
    }
  }

  if (sinVersionar) {
    return {
      estado: 'sin-versionar', formatoOk, sinVersionar, ultimoCambio,
      texto: `${sinVersionar}${sinVersionar === 30 ? '+' : ''} cambio${sinVersionar === 1 ? '' : 's'} en el repositorio después del sello publicado. Norma 09: cada cambio que llega a producción sube la r.`,
    };
  }
  // Le falta solo la hora: está bien escrito, pero con el formato de antes. Se
  // dice aparte porque no es lo mismo tener el sello mal que tenerlo incompleto.
  if (!formatoOk && SIN_HORA.test(v.sello)) {
    return {
      estado: 'sin-hora', formatoOk: false,
      texto: `Le falta la hora de publicación. Norma 07: v.DD.MM.AAAA.rN.HH:MM — aquí sería ${v.sello}.HH:MM.`,
    };
  }
  if (!formatoOk) {
    const d = fecha
      ? `v.${String(fecha.getUTCDate()).padStart(2, '0')}.${String(fecha.getUTCMonth() + 1).padStart(2, '0')}.${fecha.getUTCFullYear()}.rN.HH:MM`
      : '';
    return {
      estado: 'formato', formatoOk: false,
      texto: `El sello no sigue la norma 07: se escribe v.DD.MM.AAAA.rN.HH:MM${d ? ` — aquí sería ${d}` : ''}.`,
    };
  }
  if (!firmaValida) {
    return {
      estado: 'sin-firma', formatoOk: true, sinVersionar: 0,
      texto: `Release sin firma verificable. Norma 08: version.json debe identificar responsable, equipo, commit e instante de despliegue${v.error || despliegue.error ? ` — ${v.error || despliegue.error}` : '.'}`,
    };
  }
  return { estado: 'ok', formatoOk: true, sinVersionar: 0, texto: 'Sello canónico, firmado por responsable y equipo, y sin cambios posteriores sin publicar.' };
}

/** Las etiquetas reales del repositorio — los puntos de retorno declarados. */
async function retornosVivos(p, env, cache) {
  // Las etiquetas son del repositorio, no de la fila: un repositorio que
  // sostiene varias soluciones (admira-tv y sus veinte, admira-next-web y las
  // suyas) se pregunta una sola vez. Se memoriza lo ya LEÍDO, no la respuesta:
  // el cuerpo de un Response se consume una sola vez, y compartir el objeto
  // dejaría a la segunda fila sin etiquetas.
  const leido = await memo(cache, `tags:${p.repo}`, async () => {
    const r = await traer(`${GH}/repos/${p.repo}/tags?per_page=6`, { headers: cabecerasGh(env) });
    if (!r) return { fallo: 'sin-respuesta' };
    try { return { tags: await r.json() }; } catch (_) { return { fallo: 'ilegible' }; }
  });

  if (leido.fallo === 'sin-respuesta') {
    return {
      tags: [],
      nota: p.privado && !env.GITHUB_TOKEN
        ? 'Repositorio privado: sin GITHUB_TOKEN en el entorno de Pages no se pueden leer sus etiquetas.'
        : 'No se pudieron leer las etiquetas del repositorio.',
    };
  }
  if (leido.fallo) return { tags: [], nota: 'Respuesta ilegible de GitHub.' };
  return { tags: (leido.tags || []).map((t) => t.name) };
}

/** El censo vivo de Yokup: cuántos proyectos hay y QUIÉNES pueden responder de
 *  ellos. La lista de agentes sale de la propia Yokup (responsable, owner y
 *  agentes asignados), así que cualquier nombre que ofrezca el desplegable es
 *  uno que Yokup ya reconoce — aquí no se inventa ningún rótulo. */
async function censoYokup() {
  const vacio = { total: null, agentes: [] };
  const r = await traer('https://api.yokup.com/projects');
  if (!r) return vacio;
  try {
    const d = await r.json();
    if (!Array.isArray(d && d.projects)) return vacio;
    const agentes = new Set();
    d.projects.forEach((p) => {
      [p.primary_responsible, p.owner, ...(Array.isArray(p.agents) ? p.agents : [])]
        .forEach((a) => { const v = String(a || '').trim(); if (v) agentes.add(v); });
    });
    return { total: d.projects.length, agentes: [...agentes] };
  } catch (_) {
    return vacio;
  }
}

/** Quién puede ser responsable: SOLO agentes del equipo AdmiraNeXT, es decir
 *  los que llevan un apellido de equipo reconocido (NeoMacMini, MorfeoMBACrema…).
 *  Los responsables ya asignados entran siempre aunque Yokup no los liste, para
 *  que ninguna fila enseñe un desplegable sin su propio valor dentro. */
export function censoAgentes(agentesYokup, responsablesEnUso) {
  const censo = new Set([RESPONSABLE_POR_DEFECTO]);
  (agentesYokup || []).forEach((a) => {
    const v = normalizarResponsable(a);
    if (equipoDelResponsable(v)) censo.add(v);
  });
  (responsablesEnUso || []).forEach((a) => { const v = String(a || '').trim(); if (v) censo.add(v); });
  return [...censo].sort((a, b) => a.localeCompare(b, 'es'));
}

export const cantidadReleases = (sello) => {
  const m = String(sello || '').match(/\.r(\d+)/i);
  return m ? Number(m[1]) : 0;
};

const base = (p, ordenAlta) => ({
  clave: p.clave, nombre: p.nombre, url: p.url, tipo: p.tipo, parentKey: p.parentKey || '',
  ordenAlta,
  repo: p.repo, repoTxt: p.repoTxt || p.repo.split('/')[1], privado: !!p.privado,
  pages: p.pages, publica: p.publica, shot: p.shot || null, nota: p.nota || '',
});

export async function onRequestGet({ request, env }) {
  if (!(await sesion(request, env))) return json({ ok: false, error: 'acceso restringido' }, 401);

  const parte = new URL(request.url).searchParams.get('parte') || 'vivo';

  // Vive y muere con esta petición: evita repetir portadas, commits y etiquetas
  // que varias filas comparten, sin cachear nada de una carga para la siguiente.
  const cache = new Map();

  if (parte === 'retornos') {
    const proyectos = await Promise.all(PROYECTOS.map(async (p, ordenAlta) => {
      const r = await retornosVivos(p, env, cache);
      return { ...base(p, ordenAlta), tags: r.tags, tagsNota: r.nota || '', volver: `git checkout <etiqueta> && ${p.publica}` };
    }));
    return json({ ok: true, parte, generado: new Date().toISOString(), proyectos });
  }

  const [proyectos, yokup, responsables] = await Promise.all([
    Promise.all(PROYECTOS.map(async (p, ordenAlta) => {
      const v = await selloVivo(p, cache);
      const c = await veredicto(p, v, env, cache);
      return {
        ...base(p, ordenAlta),
        version: v.sello, versionFuente: v.fuente,
        releaseCount: cantidadReleases(v.sello),
        publicadaPor: v.quien || '', versionCommit: v.commit || '',
        control: c,
      };
    })),
    censoYokup(),
    leerResponsables(env),
  ]);

  proyectos.forEach((p) => { p.responsable = normalizarResponsable(responsables[p.clave]); });
  const yokupTotal = yokup.total;
  const censo = censoAgentes(yokup.agentes, proyectos.map((p) => p.responsable));

  const cuenta = (e) => proyectos.filter((p) => p.control.estado === e).length;
  const claves = new Set(proyectos.map((p) => p.clave));
  const totalSubproyectos = proyectos.filter((p) => p.parentKey && claves.has(p.parentKey)).length;
  const totalProyectos = proyectos.length - totalSubproyectos;
  return json({
    ok: true, parte, generado: new Date().toISOString(), total: proyectos.length,
    totalProyectos, totalSubproyectos, yokupTotal, censo,
    coincideYokup: yokupTotal == null ? null : totalProyectos === yokupTotal,
    resumen: {
      ok: cuenta('ok'),
      sinVersionar: cuenta('sin-versionar'),
      formato: cuenta('formato'),
      sinHora: cuenta('sin-hora'),
      sinFirma: cuenta('sin-firma'),
      sinSello: cuenta('sin-sello') + cuenta('sin-url'),
      workers: cuenta('worker'),
    },
    proyectos,
  });
}

export async function onRequestPatch({ request, env }) {
  const email = await sesion(request, env);
  if (!email) return json({ ok:false, error:'acceso restringido' }, 401);
  if (!env.PRESENTATION_IDEAS) return json({ ok:false, error:'almacenamiento no configurado' }, 503);

  const origen = request.headers.get('Origin');
  if (origen && origen !== new URL(request.url).origin) return json({ ok:false, error:'origen no permitido' }, 403);

  let body;
  try { body = await request.json(); } catch (_) { return json({ ok:false, error:'JSON no válido' }, 400); }
  const clave = String(body && body.clave || '').trim();
  const proyecto = PROYECTOS.find((p) => p.clave === clave);
  if (!proyecto) return json({ ok:false, error:'proyecto no encontrado' }, 404);
  if (typeof body.responsable !== 'string') return json({ ok:false, error:'responsable no válido' }, 422);

  const responsable = normalizarResponsable(body && body.responsable);
  let yokupProject;
  try {
    const fetchYokup = env && typeof env.YOKUP_FETCH === 'function' ? env.YOKUP_FETCH : fetch;
    yokupProject = await sincronizarResponsableYokup(proyecto, responsable, fetchYokup);
  } catch (error) {
    return json({ ok:false, error:error && error.message || 'Yokup no pudo guardar el responsable' }, error && error.status || 502);
  }
  await env.PRESENTATION_IDEAS.put(`${RESPONSABLE_KEY}${clave}`, JSON.stringify({
    responsable,
    updatedAt: new Date().toISOString(),
    updatedBy: email,
  }));
  return json({ ok:true, clave, responsable, yokupSynced:true, yokupProject });
}
