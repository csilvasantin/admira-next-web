/*
 * API del LIBRO DE ESTILO de una presentación (16-oct-2026).
 *   GET  /presentaciones/<slug>/api/stylebook            → JSON {revision, sections[], history, markdown, urls}
 *   GET  …/api/stylebook?format=md                       → text/markdown (el documento entero, para pasarlo como referencia)
 *   GET  …/api/stylebook?section=paleta                  → JSON de una sección (id, número o prefijo del título)
 *   PUT  …/api/stylebook {section, body, reason, baseRevision?}   → sustituye una sección (override [MAN])
 *   PUT  …/api/stylebook {section, reset:true, reason}            → la devuelve a la versión automática
 *   PUT  …/api/stylebook {markdown, reason, baseRevision?}        → edición del documento entero (solo cambia lo que difiera)
 *   PUT  …/api/stylebook {measured:[{item,value,method?}], reason} → registra mediciones (pasa lo inferido a medido; sección 12)
 * Zona interna (editor/admin y tokens MCP de editor): el middleware lo trata como la de Ideas/Historial.
 */
import {captureVersion} from '../../_versions.js';
import {STYLEBOOK_KEY,loadStylebookContext,renderStylebookMarkdown,stylebookView,applyStylebookEdit,resolveSection,buildSections,SECTIONS} from '../../_stylebook.js';

const MAX_BYTES=256*1024;
const headers={'cache-control':'no-store, must-revalidate','x-content-type-options':'nosniff','x-robots-tag':'noindex, nofollow'};
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{...headers,'content-type':'application/json; charset=utf-8'}});

function trustedCaller(context){
  const origin=context.request.headers.get('origin');
  return (Boolean(origin)&&origin===new URL(context.request.url).origin)||context.data?.presentationAccess?.via==='agent-token';
}

export async function onRequest(context){
  const slug=String(context.params.client||'').toLowerCase();
  if(!/^[a-z0-9][a-z0-9-]{1,62}$/.test(slug))return json({error:'Presentación no válida.'},400);
  if(!context.env.PRESENTATION_IDEAS)return json({error:'Almacenamiento no configurado.'},503);
  const method=context.request.method;
  if(method!=='GET'&&method!=='PUT')return json({error:'Método no permitido.'},405);
  const {doc,ctx}=await loadStylebookContext(context.env,slug);
  if(!ctx.presentation)return json({error:'No existe esa presentación.'},404);
  const url=new URL(context.request.url);

  if(method==='GET'){
    const format=String(url.searchParams.get('format')||'').toLowerCase();
    if(format==='md'||format==='markdown')return new Response(renderStylebookMarkdown(slug,doc,ctx),{headers:{...headers,'content-type':'text/markdown; charset=utf-8','content-disposition':`inline; filename="STYLEBOOK-${slug}.md"`}});
    const wanted=url.searchParams.get('section');
    if(wanted){
      const section=resolveSection(wanted);
      if(!section)return json({error:`Sección no válida. Usa una de: ${SECTIONS.map(item=>`${item.id} (${item.n})`).join(', ')}.`},400);
      const view=stylebookView(slug,doc,ctx);
      return json({ok:true,client:slug,revision:view.revision,section:view.sections.find(item=>item.id===section.id),autoBody:buildSections(slug,doc||{overrides:{},history:[]},ctx).find(item=>item.id===section.id).auto});
    }
    return json({...stylebookView(slug,doc,ctx),markdown:renderStylebookMarkdown(slug,doc,ctx)});
  }

  if(!trustedCaller(context))return json({error:'Origen no permitido.'},403);
  if(Number(context.request.headers.get('content-length')||0)>MAX_BYTES)return json({error:'Petición demasiado grande.'},413);
  let body;try{body=await context.request.json()}catch(_){return json({error:'JSON no válido.'},400)}
  if(!body||typeof body!=='object'||Array.isArray(body))return json({error:'Formato no válido.'},400);
  const allowed=new Set(['section','body','reset','markdown','measured','reason','baseRevision']);
  const unknown=Object.keys(body).filter(key=>!allowed.has(key));
  if(unknown.length)return json({error:`Campos desconocidos: ${unknown.join(', ')}.`},400);
  let result;
  try{result=applyStylebookEdit(slug,doc,body,ctx,context.data?.presentationAccess||{})}
  catch(error){return json({error:error.message||'No se pudo editar el libro de estilo.'},error.status||400)}
  if(result.unchanged)return json({ok:true,unchanged:true,revision:result.doc.revision,message:'Sin cambios: el contenido ya era el vigente.'});
  await context.env.PRESENTATION_IDEAS.put(STYLEBOOK_KEY(slug),JSON.stringify(result.doc));
  await captureVersion(context.env,slug,`libro de estilo r${result.doc.revision}: ${String(body.reason).trim().slice(0,120)}`);
  return json({ok:true,changed:result.changed,kind:result.kind,...stylebookView(slug,result.doc,ctx)});
}
