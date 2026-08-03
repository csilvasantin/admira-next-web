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
 * Los repos son públicos, así que GitHub no pide credenciales. La llamada la hace
 * el edge y se cachea 5 min: /webmaster está tras verja y lo miran dos personas,
 * así que el límite de 60 peticiones/hora por IP sobra.
 */
import { sesion } from '../_webmaster-gate.js';

// clave → dónde vive el código y dónde se publica
const PROYECTOS = {
  admiranext:        { repo: 'csilvasantin/admira-next-web',            pages: 'admiranext',      publica: './deploy.sh' },
  yokup:             { repo: 'csilvasantin/tool',                       pages: 'yokup',           publica: 'cd yokup-site && wrangler pages deploy .' },
  pixeria:           { repo: 'csilvasantin/pixeria',                    pages: 'pixeria',         publica: './deploy.sh' },
  'admira-live':     { repo: 'csilvasantin/32.-ConsejoAdmiraNextGame',  pages: 'admira-live',     publica: './deploy.sh' },
  'admira-tv':       { repo: 'csilvasantin/admira-tv',                  pages: 'admira-tv',       publica: './deploy.sh' },
  'clearchannel-tv': { repo: 'csilvasantin/clearchannel-tv',            pages: 'clearchannel-tv', publica: './deploy.sh' },
  'admira-store':    { repo: 'csilvasantin/admira-store',               pages: 'admira-store',    publica: './deploy.sh' },
  // GitHub Pages: sin dirección por despliegue. El punto de retorno es la etiqueta.
  xpaceos:           { repo: 'csilvasantin/xpaceos',                    pages: null, publica: 'git push (GitHub Pages)' },
  'admira-studio':   { repo: 'csilvasantin/admira-studio',              pages: null, publica: 'git push (GitHub Pages)' },
  ainimation:        { repo: 'csilvasantin/ainimation',                 pages: null, publica: 'git push (GitHub Pages)' },
  digitalavatar:     { repo: 'csilvasantin/digitalavatar.ai',           pages: null, publica: 'git push (GitHub Pages)' },
  // Workers: el rollback no es de git, es `wrangler rollback <version>`.
  'pixer-worker':    { repo: 'csilvasantin/pixer-worker',               pages: null, publica: 'wrangler deploy', worker: true },
  admiraxperience:   { repo: 'csilvasantin/01.-AdmiraXperience-Game',   pages: null, publica: 'git push (GitHub Pages)' },
};

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

async function gh(ruta) {
  const r = await fetch(`${GH}${ruta}`, { headers: UA, cf: { cacheTtl: 300, cacheEverything: true } });
  if (!r.ok) return null;
  return r.json();
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const clave = url.searchParams.get('p') || '';

  const json = (o, s = 200) => new Response(JSON.stringify(o), {
    status: s,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'private, max-age=300' },
  });

  if (!(await sesion(request, env))) return json({ ok: false, error: 'acceso restringido' }, 401);
  const P = PROYECTOS[clave];
  if (!P) return json({ ok: false, error: 'proyecto no reconocido' }, 400);

  // ── commits y etiquetas (siempre) ─────────────────────────────────────────
  const [commitsRaw, tagsRaw] = await Promise.all([
    gh(`/repos/${P.repo}/commits?per_page=40`),
    gh(`/repos/${P.repo}/tags?per_page=30`),
  ]);

  const commits = (commitsRaw || []).map((c) => ({
    sha: (c.sha || '').slice(0, 7),
    fecha: madrid(c.commit?.author?.date),
    dia: dia(c.commit?.author?.date),
    autor: c.commit?.author?.name || '',
    mensaje: asunto(c.commit?.message),
    cuerpo: String(c.commit?.message || '').split('\n').slice(1).join('\n').trim().slice(0, 900),
    url: c.html_url,
  }));

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
    aviso = P.worker
      ? 'Es un worker: no hay web que mirar. La marcha atrás es «wrangler rollback <version>», y descargar una versión vieja por API no funciona (solo devuelve metadatos).'
      : 'Está en GitHub Pages, que no guarda una dirección por despliegue: no hay snapshot que abrir. El punto de retorno es la etiqueta.';
  }

  return json({
    ok: true, proyecto: clave, repo: P.repo, publica: P.publica, aviso,
    commits, tags, deploys,
    total: { commits: commits.length, tags: tags.length, deploys: deploys.length },
  });
}
