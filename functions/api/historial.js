/**
 * /api/historial?p=<clave>
 *
 * TODOS los cambios de un proyecto y TODAS las formas de volver atrás, venga de
 * donde venga. Hasta ahora /webmaster solo sabía navegar los despliegues de
 * Cloudflare Pages, así que los cuatro sitios en GitHub Pages y los workers se
 * quedaban sin historial: se veía su versión, pero no cómo habían llegado ahí.
 *
 * Se cruzan tres fuentes:
 *   · commits  — GitHub. El cambio, quién y cuándo. Existe SIEMPRE, esté el sitio
 *                donde esté desplegado.
 *   · tags     — GitHub. Los puntos de retorno declarados a propósito.
 *   · deploys  — Cloudflare Pages, cuando el proyecto está ahí: cada uno con su
 *                dirección permanente, que es la única marcha atrás que se puede
 *                MIRAR antes de ejecutarla.
 *
 * Qué proyectos existen ya no se decide aquí: sale del censo de _proyectos.js,
 * que es el mismo que pinta la tabla y las fichas. Cuando esta lista era propia,
 * se desincronizó de la tabla —admiraxperience tenía historial sin fila desde la
 * que abrirlo, y el worker yokup-rtc enseñaba el historial del sitio yokup.
 *
 * Los repos públicos no piden credenciales; los tres workers de la flota son
 * privados y necesitan GITHUB_TOKEN en el entorno de Pages. La llamada la hace el
 * edge y se cachea 5 min: /webmaster está tras el perímetro de seguridad y lo
 * miran dos personas, así que el límite de 60 peticiones/hora por IP sobra.
 */
import { sesion } from '../_webmaster-gate.js';
import { porClave } from '../_proyectos.js';

const GH = 'https://api.github.com';
const UA = { 'User-Agent': 'admiranext-webmaster', Accept: 'application/vnd.github+json' };

function madrid(iso, conHora = true) {
  const o = { timeZone: 'Europe/Madrid', day: '2-digit', month: '2-digit', year: 'numeric' };
  if (conHora) { o.hour = '2-digit'; o.minute = '2-digit'; }
  return new Intl.DateTimeFormat('es-ES', o).format(new Date(iso));
}
function dia(iso) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
}
// De un mensaje de commit interesa el asunto: el cuerpo son párrafos.
function asunto(msg) {
  const s = String(msg || '').split('\n')[0].trim();
  return s.length > 120 ? s.slice(0, 118).trimEnd() + '…' : s;
}

async function gh(ruta, env) {
  const cab = { ...UA };
  // Sin token, un repositorio privado responde igual que uno inexistente.
  if (env && env.GITHUB_TOKEN) cab.Authorization = `Bearer ${env.GITHUB_TOKEN}`;
  const r = await fetch(`${GH}${ruta}`, { headers: cab, cf: { cacheTtl: 300, cacheEverything: true } });
  if (!r.ok) return null;
  return r.json();
}

import { quienPublica, etiquetaResponsable } from '../quien-publica.js';

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const clave = url.searchParams.get('p') || '';

  const json = (o, s = 200) => new Response(JSON.stringify(o), {
    status: s,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'private, max-age=300' },
  });

  if (!(await sesion(request, env))) return json({ ok: false, error: 'acceso restringido' }, 401);
  const P = porClave(clave);
  if (!P) return json({ ok: false, error: 'proyecto no reconocido' }, 400);

  // ── commits y etiquetas (siempre) ─────────────────────────────────────────
  const [commitsRaw, tagsRaw] = await Promise.all([
    gh(`/repos/${P.repo}/commits?per_page=40`, env),
    gh(`/repos/${P.repo}/tags?per_page=30`, env),
  ]);

  const commits = (commitsRaw || []).map((c) => {
    const mensaje = asunto(c.commit?.message);
    const cuerpo = String(c.commit?.message || '').split('\n').slice(1).join('\n').trim();
    // QUIÉN publicó, no con qué cuenta se hizo el commit. Ver functions/quien-publica.js:
    // `author.name` es el git config de la máquina y en la flota casi nunca es el agente.
    const quien = quienPublica({ autorGit: c.commit?.author?.name || '', asunto: mensaje, cuerpo });
    return {
    sha: (c.sha || '').slice(0, 7),
    fecha: madrid(c.commit?.author?.date),
    dia: dia(c.commit?.author?.date),
    autor: c.commit?.author?.name || '',
    responsable: etiquetaResponsable(quien),
    responsableAgente: quien.agente,
    responsableMaquina: quien.maquina,
    responsableFiable: quien.fiable,
    mensaje,
    cuerpo: cuerpo.slice(0, 900),
    url: c.html_url,
  };
  });

  // Las etiquetas no traen fecha: se cruza con el commit al que apuntan.
  const porSha = new Map((commitsRaw || []).map((c) => [c.sha, c.commit?.author?.date]));
  const tags = (tagsRaw || []).map((t) => ({
    nombre: t.name,
    sha: (t.commit?.sha || '').slice(0, 7),
    fecha: porSha.has(t.commit?.sha) ? madrid(porSha.get(t.commit.sha), false) : '',
    volver: `git checkout ${t.name} && ${P.publica}`,
  }));

  // ── despliegues de Pages (solo si el proyecto vive ahí) ───────────────────
  let deploys = [];
  let aviso = '';
  if (P.pages && env.CF_API_TOKEN && env.CF_ACCOUNT_ID) {
    const r = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/pages/projects/${P.pages}/deployments?per_page=25`,
      { headers: { Authorization: `Bearer ${env.CF_API_TOKEN}` } }
    );
    if (r.ok) {
      const d = await r.json();
      deploys = (d.result || [])
        .filter((x) => x.environment === 'production')
        .map((x) => {
          const m = x.deployment_trigger?.metadata || {};
          return {
            id: x.short_id,
            url: x.url,                       // el snapshot que se puede MIRAR
            fecha: madrid(x.created_on),
            dia: dia(x.created_on),
            mensaje: asunto((m.commit_message || '').replace(/\[commit_message truncated\]\s*$/i, '')),
            commit: (m.commit_hash || '').slice(0, 7),
          };
        });
    }
  } else if (!P.pages) {
    aviso = P.tipo === 'worker'
      ? 'Es un worker: no hay web que mirar. La marcha atrás es «wrangler rollback <version>», y descargar una versión vieja por API no funciona (solo devuelve metadatos).'
      : 'Está en GitHub Pages, que no guarda una dirección por despliegue: no hay snapshot que abrir. El punto de retorno es la etiqueta.';
  }

  // Un repositorio privado sin token responde igual que uno que no existe: hay
  // que decirlo, o la ficha se lee como «este proyecto no tiene historial».
  if (P.privado && !env.GITHUB_TOKEN && !commits.length) {
    aviso = 'Repositorio privado: sin GITHUB_TOKEN en el entorno de Pages, GitHub responde lo mismo que si no existiera. No es que no tenga historial: es que no se puede leer.';
  }

  return json({
    ok: true, proyecto: clave, repo: P.repo, publica: P.publica, aviso,
    commits, tags, deploys,
    total: { commits: commits.length, tags: tags.length, deploys: deploys.length },
  });
}
