/*
 * /github — ZONA MILITARIZADA: inventario GitHub de AdmiraNeXT (encargo #2494, Wozniak/Carlos, 06-09-2026).
 *
 * Verja de SERVIDOR, no de interfaz: sin sesión el HTML no sale del edge (401 con el
 * login de Google, patrón /webmaster y /usuarios). Con sesión, solo entra quien es del
 * dominio @admira.com o la cuenta propietaria csilvasantin@gmail.com; el resto del
 * directorio recibe 403 sin una sola línea del inventario. El contenido vive en D1
 * (admiranext_docs, slug github-inventario) y se renderiza aquí desde markdown; nunca
 * hay un HTML con la tabla de privados en claro. Cada lectura y cada rechazo quedan en
 * la auditoría de /usuarios (github_view / github_denied).
 */
import { sesionCompleta, respuestaLogin, respuestaHtml, auditar } from './_webmaster-gate.js';
import { leerDoc } from './_docs.js';
import { markdownAHtml, esc } from './_markdown.js';

export const DOC_SLUG = 'github-inventario';
export const ACCESO_EXCEPCIONES = new Set(['csilvasantin@gmail.com']);

/** Lista estrecha inicial: *@admira.com + las excepciones de propietario. */
export function accesoGithub(email) {
  const e = String(email || '').trim().toLowerCase();
  return e.endsWith('@admira.com') || ACCESO_EXCEPCIONES.has(e);
}

async function leerVersion(request, env) {
  const fetchImpl = env.VERSION_FETCH || ((u, i) => fetch(u, i));
  try {
    const res = await fetchImpl(new URL('/version.json', request.url).toString(), { signal: AbortSignal.timeout(1500) });
    const data = await res.json();
    return String(data.version || '');
  } catch (_) { return ''; }
}

const fecha = (ms) => ms ? new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Madrid' }).format(new Date(Number(ms))) : '';

const CSS = `:root{color-scheme:dark;--bg:#070b12;--panel:#101724;--line:#25344b;--ink:#eef6ff;--dim:#8ea0b8;--cyan:#63e6d5;--warn:#ffbd69;--bad:#ff6b7a;--mono:ui-monospace,SFMono-Regular,Menlo,monospace}
*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 80% -20%,#14332f 0,transparent 42%),var(--bg);color:var(--ink);font-family:system-ui,-apple-system,sans-serif}
.shell{width:min(1460px,calc(100% - 32px));margin:0 auto;padding:28px 0 64px}header{display:flex;justify-content:space-between;gap:18px;align-items:center;margin-bottom:22px;flex-wrap:wrap}
h1{margin:4px 0;font-size:clamp(28px,4vw,44px)}.eyebrow,.meta{font:700 12px/1.4 var(--mono);letter-spacing:.14em;text-transform:uppercase;color:var(--cyan)}.meta{color:var(--dim);text-transform:none;letter-spacing:0}
.actions{display:flex;gap:10px;flex-wrap:wrap}a.btn{border:1px solid var(--line);background:#121c2c;color:var(--ink);padding:10px 14px;border-radius:10px;text-decoration:none;font:700 13px var(--mono)}a.btn:hover{border-color:var(--cyan)}
.aviso{border:1px solid #5a4a26;background:#1a1610;border-radius:12px;padding:12px 16px;font:600 12px/1.6 var(--mono);color:var(--warn);margin:0 0 18px}
article{background:color-mix(in srgb,var(--panel) 94%,transparent);border:1px solid var(--line);border-radius:16px;padding:22px 26px;box-shadow:0 18px 50px #0004}
article h1{font-size:26px;margin:6px 0 14px}article h2{font-size:20px;margin:30px 0 10px;color:var(--cyan)}article h3{font-size:15px;margin:24px 0 8px;font-family:var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--dim)}
article p,article li{font-size:14px;line-height:1.6}article blockquote{margin:0 0 14px;padding:10px 14px;border-left:3px solid var(--warn);background:#151a12;color:var(--warn);font:600 13px/1.6 var(--mono)}
article code{font:12px var(--mono);background:#09111d;border:1px solid var(--line);border-radius:6px;padding:1px 6px;color:var(--cyan)}article hr{border:0;border-top:1px solid var(--line);margin:26px 0}
article em{color:var(--dim);font-style:normal;font:600 12px var(--mono)}article a{color:var(--cyan)}
.tabla{overflow:auto;margin:10px 0 6px;border:1px solid var(--line);border-radius:10px}table{width:100%;border-collapse:collapse;font-size:13px}th,td{text-align:left;padding:9px 10px;border-bottom:1px solid var(--line);vertical-align:top;white-space:nowrap}
td:nth-child(7),td:nth-child(8){white-space:normal;min-width:260px}th{position:sticky;top:0;background:#0d1522;font:700 11px var(--mono);color:var(--dim);text-transform:uppercase;letter-spacing:.1em}tr:hover td{background:#0d1522}
footer{margin-top:22px;color:var(--dim);font:12px var(--mono);display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}
@media(max-width:760px){header{align-items:flex-start;flex-direction:column}article{padding:16px}}`;

function cabecera(titulo, sello) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow">${
    sello ? `<meta name="admiranext-version" content="AdmiraNeXT ${esc(sello)}">` : ''}<title>${esc(titulo)} · AdmiraNeXT</title><style>${CSS}</style></head><body><main class="shell"><!--email_off-->`;
}
// <!--email_off-->: Cloudflare reescribe los correos del HTML como «[email protected]» y su descodificador
// es un script que nuestra CSP bloquea (06-09-2026, r4 en producción). Con el marcador no toca nada.
const PIE = '<!--/email_off--></main></body></html>';

export function paginaDenegada(email, sello = '') {
  return `${cabecera('Zona militarizada', sello)}<header><div><div class="eyebrow">AdmiraNeXT · Zona militarizada</div><h1>Sin acceso a esta zona</h1><div class="meta">${esc(email)} está en el directorio, pero /github es solo para cuentas @admira.com y la propiedad.</div></div><div class="actions"><a class="btn" href="/webmaster">← Webmaster</a></div></header><div class="aviso">Este intento queda anotado en la auditoría de /usuarios. Si necesitas entrar, pídeselo a un administrador.</div>${PIE}`;
}

export function paginaInventario(current, doc, sello = '') {
  const cuerpo = doc ? markdownAHtml(doc.markdown) : '<p>Todavía no hay inventario cargado en D1 (slug github-inventario).</p>';
  return `${cabecera('Inventario GitHub', sello)}<header><div><div class="eyebrow">AdmiraNeXT · Zona militarizada</div><h1>Inventario GitHub</h1><div class="meta">${esc(current.email)} · ${esc(current.role)} · acceso @admira.com y propiedad · ${
    doc ? `actualizado ${esc(fecha(doc.updated_at))}${doc.updated_by ? ' por ' + esc(doc.updated_by) : ''}` : 'sin documento'}</div></div><div class="actions"><a class="btn" href="/webmaster">← Webmaster</a><a class="btn" href="/usuarios">Usuarios</a></div></header>
<div class="aviso">Zona militarizada: este inventario nombra repositorios PRIVADOS. Se sirve solo con sesión y no se copia a chats, capturas ni documentos públicos. Cada lectura queda en la auditoría.</div>
<article>${cuerpo}</article>
<footer><span>Fuente: admira-vault · docs/GITHUB-INVENTARIO.md (privado) · cargado en D1</span><span>${sello ? 'AdmiraNeXT ' + esc(sello) : ''}</span></footer>${PIE}`;
}

export async function onRequest({ request, env }) {
  if (!env.WEBMASTER_SIGNING_KEY) return respuestaLogin(env, 'Acceso no disponible ahora mismo.', '/github', 503);
  const current = await sesionCompleta(request, env);
  if (!current) return respuestaLogin(env, 'Zona militarizada: identifícate para ver el inventario.', '/github', 401);
  const sello = await leerVersion(request, env);
  if (!accesoGithub(current.email)) {
    await auditar(env, current.email, '-', 'github_denied', 'zona militarizada: solo @admira.com y propiedad').catch(() => {});
    return respuestaHtml(paginaDenegada(current.email, sello), 403);
  }
  const doc = await leerDoc(env, DOC_SLUG);
  await auditar(env, current.email, '-', 'github_view', doc ? `inventario ${fecha(doc.updated_at)}` : 'sin inventario cargado').catch(() => {});
  return respuestaHtml(paginaInventario(current, doc, sello), 200);
}
