/*
 * /presentaciones/<slug>/estilo — el LIBRO DE ESTILO de la presentación, en una página interna.
 * Solo lectura (se edita con PUT /api/stylebook o con la tool MCP update_stylebook). Los datos se calculan al
 * abrir: nunca se queda viejo respecto a las láminas, los colores o los medios.
 */
import {markdownAHtml,esc} from '../../_markdown.js';
import {loadStylebookContext,renderStylebookMarkdown,stylebookUrls} from '../_stylebook.js';

export async function onRequestGet(context){
  const slug=String(context.params.client||'').toLowerCase();
  if(!/^[a-z0-9][a-z0-9-]{1,62}$/.test(slug)||!context.env.PRESENTATION_IDEAS)return context.next();
  const {doc,ctx}=await loadStylebookContext(context.env,slug);
  if(!ctx.presentation)return context.next();
  const name=esc(ctx.presentation.displayName||slug);
  const markdown=renderStylebookMarkdown(slug,doc,ctx);
  const urls=stylebookUrls(slug);
  const page=`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Libro de estilo · ${name}</title><style>
:root{--bg:#070a10;--panel:#0d1522;--line:#26324a;--ink:#edf3fb;--dim:#8fa3c2;--brand:#6a9a3f;--blue:#6aa7ff}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.6 -apple-system,"Segoe UI",Roboto,system-ui,sans-serif}
header{position:sticky;top:0;z-index:2;background:rgba(7,10,16,.92);backdrop-filter:blur(8px);border-bottom:1px solid var(--line)}
.bar{max-width:1040px;margin:0 auto;padding:12px 22px;display:flex;gap:14px;align-items:center;flex-wrap:wrap}.bar b{letter-spacing:.04em}.sp{flex:1}
.btn{color:var(--ink);text-decoration:none;border:1px solid var(--line);border-radius:9px;padding:7px 12px;font:600 13px/1 ui-monospace,monospace}.btn:hover{border-color:var(--brand);color:var(--brand)}
main{max-width:1040px;margin:0 auto;padding:30px 22px 90px}h1{font-size:30px;margin:6px 0 14px}h2{margin:44px 0 12px;padding-top:18px;border-top:1px solid var(--line);font-size:22px}h3{font-size:17px}
a{color:var(--blue)}code{background:#121c2e;border:1px solid var(--line);border-radius:6px;padding:1px 6px;font:13px ui-monospace,monospace;word-break:break-word}
.tabla{overflow-x:auto;margin:12px 0}table{border-collapse:collapse;min-width:100%;font-size:14px}th,td{border:1px solid var(--line);padding:7px 10px;text-align:left;vertical-align:top}th{background:var(--panel);color:var(--dim);font-size:12px;letter-spacing:.06em;text-transform:uppercase}
blockquote{margin:12px 0;padding:8px 14px;border-left:3px solid var(--brand);background:var(--panel);color:var(--dim)}hr{border:0;border-top:1px solid var(--line);margin:24px 0}li{margin:3px 0}
.note{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:12px 16px;color:var(--dim);font-size:14px;margin-bottom:22px}
</style></head><body><header><div class="bar"><b>ADmiraNeXT · Libro de estilo</b><span class="sp"></span><a class="btn" href="presentacion">Sala</a><a class="btn" href="ideas">Ideas</a><a class="btn" href="versiones">Historial</a><a class="btn" href="${esc(urls.markdown.replace(`/presentaciones/${slug}/`,''))}" download="STYLEBOOK-${esc(slug)}.md">Descargar .md</a></div></header><main><div class="note">Zona interna de Admira. Se calcula al abrir a partir de los datos vivos de la presentación; las secciones marcadas [MAN] las ha editado una persona o un agente. Para editar: <code>update_stylebook</code> (MCP) o <code>PUT ${esc(urls.api)}</code>.</div>${markdownAHtml(markdown)}</main></body></html>`;
  return new Response(page,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-robots-tag':'noindex, nofollow'}});
}
