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
 *    (v.DD.MM.AAAA.rN) y la 09 que cada cambio publicado sube la r. Una norma que
 *    nadie comprueba es una sugerencia: aquí se comprueba solución por solución y
 *    se dice quién la incumple.
 *
 * De dónde sale el sello, en este orden:
 *   1. <meta name="admiranext-version">     — lo llevan 8 de los sitios
 *   2. /version.json                         — yokup añade además quién publicó
 *   3. un v.… suelto en el HTML              — último recurso, el del pie
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
const SELLO = /v\.?\d{2,4}[.-]\d{2}[.-]\d{2,4}(?:\.r\d+)?/i;
const SELLO_G = new RegExp(SELLO.source, 'gi');
// El canónico de la norma 07, y solo ese.
const CANONICO = /^v\.\d{2}\.\d{2}\.\d{4}\.r\d+$/;

function cabecerasGh(env) {
  const h = { 'User-Agent': 'admiranext-webmaster', Accept: 'application/vnd.github+json' };
  // Los tres workers de la flota están en repositorios privados. Sin token, la
  // llamada devuelve el mismo 404 que un repositorio inexistente, así que sin
  // esto la ficha mentiría diciendo «no tiene etiquetas».
  if (env.GITHUB_TOKEN) h.Authorization = `Bearer ${env.GITHUB_TOKEN}`;
  return h;
}

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

/** Lee de la portada qué versión está publicada de verdad. */
async function selloVivo(p) {
  if (!p.url) return { sello: null, fuente: 'sin-web' };

  const r = await traer(p.url, { headers: { 'User-Agent': 'Mozilla/5.0 (admiranext-webmaster)' } });
  if (!r) return { sello: null, fuente: 'error' };

  const html = (await r.text()).slice(0, 400000);

  const meta = html.match(/<meta[^>]+name=["']admiranext-version["'][^>]*>/i);
  if (meta) {
    const contenido = (meta[0].match(/content=["']([^"']*)["']/i) || [])[1] || '';
    const m = contenido.match(SELLO);
    if (m) return { sello: m[0], fuente: 'meta' };
    if (contenido.trim()) return { sello: contenido.trim(), fuente: 'meta' };
  }

  const vj = await traer(`${p.url.replace(/\/$/, '')}/version.json`);
  if (vj) {
    try {
      const d = await vj.json();          // un SPA devuelve su HTML aquí: revienta y seguimos
      if (d && d.version) {
        return {
          sello: String(d.version), fuente: 'version.json',
          quien: d.signature || d.deployer || '', commit: d.gitShort || d.git || '',
        };
      }
    } catch (_) { /* no era JSON */ }
  }

  // Rebuscar en el HTML es el último recurso y el que más se equivoca: en
  // admira.store convivían el sello bueno del pie y un «v26.04.05» suelto de un
  // asset, y quedarse con el último daba por publicada una versión de abril. Se
  // elige la candidata más creíble, no la última que aparece.
  const sueltos = html.match(SELLO_G) || [];
  if (sueltos.length) {
    const mejor = sueltos.find((s) => CANONICO.test(s))
      || sueltos.filter((s) => /\.r\d+$/i.test(s)).pop()
      || sueltos[sueltos.length - 1];
    return { sello: mejor, fuente: 'html' };
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
async function veredicto(p, v, env) {
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

  // ¿Se ha tocado el repositorio después de publicar ese sello?
  let sinVersionar = 0, ultimoCambio = '';
  if (fecha) {
    const desde = new Date(fecha.getTime() + 24 * 3600 * 1000).toISOString();  // desde el día siguiente
    const r = await traer(`${GH}/repos/${p.repo}/commits?per_page=30&since=${desde}`, { headers: cabecerasGh(env) });
    if (r) {
      try {
        const d = await r.json();
        sinVersionar = Array.isArray(d) ? d.length : 0;
        if (sinVersionar) ultimoCambio = d[0]?.commit?.author?.date || '';
      } catch (_) { /* ilegible */ }
    }
  }

  if (sinVersionar) {
    return {
      estado: 'sin-versionar', formatoOk, sinVersionar, ultimoCambio,
      texto: `${sinVersionar}${sinVersionar === 30 ? '+' : ''} cambio${sinVersionar === 1 ? '' : 's'} en el repositorio después del sello publicado. Norma 09: cada cambio que llega a producción sube la r.`,
    };
  }
  if (!formatoOk) {
    return {
      estado: 'formato', formatoOk: false,
      texto: `El sello no sigue la norma 07: se escribe v.DD.MM.AAAA.rN${fecha ? ` — aquí sería v.${String(fecha.getUTCDate()).padStart(2, '0')}.${String(fecha.getUTCMonth() + 1).padStart(2, '0')}.${fecha.getUTCFullYear()}.rN` : ''}.`,
    };
  }
  return { estado: 'ok', formatoOk: true, sinVersionar: 0, texto: 'Sello canónico y sin cambios posteriores sin publicar.' };
}

/** Las etiquetas reales del repositorio — los puntos de retorno declarados. */
async function retornosVivos(p, env) {
  const r = await traer(`${GH}/repos/${p.repo}/tags?per_page=6`, { headers: cabecerasGh(env) });
  if (!r) {
    return {
      tags: [],
      nota: p.privado && !env.GITHUB_TOKEN
        ? 'Repositorio privado: sin GITHUB_TOKEN en el entorno de Pages no se pueden leer sus etiquetas.'
        : 'No se pudieron leer las etiquetas del repositorio.',
    };
  }
  try {
    const d = await r.json();
    return { tags: (d || []).map((t) => t.name) };
  } catch (_) {
    return { tags: [], nota: 'Respuesta ilegible de GitHub.' };
  }
}

const base = (p) => ({
  clave: p.clave, nombre: p.nombre, url: p.url, tipo: p.tipo,
  repo: p.repo, repoTxt: p.repoTxt || p.repo.split('/')[1], privado: !!p.privado,
  pages: p.pages, publica: p.publica, shot: p.shot || null, nota: p.nota || '',
});

export async function onRequestGet({ request, env }) {
  const json = (o, s = 200) => new Response(JSON.stringify(o), {
    status: s,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'private, max-age=120' },
  });

  if (!(await sesion(request, env))) return json({ ok: false, error: 'acceso restringido' }, 401);

  const parte = new URL(request.url).searchParams.get('parte') || 'vivo';

  if (parte === 'retornos') {
    const proyectos = await Promise.all(PROYECTOS.map(async (p) => {
      const r = await retornosVivos(p, env);
      return { ...base(p), tags: r.tags, tagsNota: r.nota || '', volver: `git checkout <etiqueta> && ${p.publica}` };
    }));
    return json({ ok: true, parte, generado: new Date().toISOString(), proyectos });
  }

  const proyectos = await Promise.all(PROYECTOS.map(async (p) => {
    const v = await selloVivo(p);
    const c = await veredicto(p, v, env);
    return {
      ...base(p),
      version: v.sello, versionFuente: v.fuente,
      publicadaPor: v.quien || '', versionCommit: v.commit || '',
      control: c,
    };
  }));

  const cuenta = (e) => proyectos.filter((p) => p.control.estado === e).length;
  return json({
    ok: true, parte, generado: new Date().toISOString(), total: proyectos.length,
    resumen: {
      ok: cuenta('ok'),
      sinVersionar: cuenta('sin-versionar'),
      formato: cuenta('formato'),
      sinSello: cuenta('sin-sello') + cuenta('sin-url'),
      workers: cuenta('worker'),
    },
    proyectos,
  });
}
