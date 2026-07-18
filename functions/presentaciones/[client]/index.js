import { normalizeGeneration } from '../_generation.js';

function esc(value){ return String(value==null?'':value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function color(value,fallback){ return /^#[0-9a-f]{6}$/i.test(String(value||''))?value:fallback; }
function option(value,allowed,fallback){ return allowed.includes(value)?value:fallback; }
function fontStack(style){ return style==='serif'?'Georgia,"Times New Roman",serif':style==='mono'?'ui-monospace,"SF Mono",Menlo,monospace':style==='rounded'?'"Arial Rounded MT Bold",Nunito,-apple-system,sans-serif':'Inter,-apple-system,"Segoe UI",Roboto,Arial,sans-serif'; }

function dateTime(value){
  const date=new Date(value||'');
  if(!Number.isFinite(date.getTime())) return '';
  return new Intl.DateTimeFormat('es-ES',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Madrid'}).format(date);
}
function publicStatus(item){
  if(!item) return 'error';
  if(item?.url&&['ready','published','complete'].includes(item.status)) return 'complete';
  if(['failed','skipped'].includes(item?.status)||item?.status==='complete') return 'error';
  return 'processing';
}
function statusCopy(item){
  const status=publicStatus(item);
  if(status==='complete') return `Hecho${dateTime(item.completedAt||item.updatedAt)?` · ${dateTime(item.completedAt||item.updatedAt)}`:''}`;
  if(status==='error'){
    const detail=item?.error || (!item?'No consta una orden de producción para este entregable.':item?.status==='skipped'?'El entregable fue omitido por la producción.':'La producción terminó sin devolver un archivo.');
    return `Error: ${detail}`;
  }
  const since=dateTime(item?.startedAt||item?.updatedAt);
  return since?`Procesándose desde ${since}`:'Procesándose · hora de inicio no disponible';
}
function lifecycle(number,title,hint,icon,copy,item){
  const branded=/notebook\s*lm/i.test(hint)?'AdmiraNeXT':hint;
  const status=publicStatus(item);
  return `<section class="sec wrap"><div class="sec-h"><span class="n">${number}</span><h2>${esc(title)}</h2><span class="hint">${esc(branded)}</span></div><div class="card lifecycle ${status}"><div class="row"><div class="ico">${esc(icon)}</div><div><h3>${esc(title)} de la presentación</h3><p>${esc(copy)}</p><div class="fmt">Preparado por AdmiraNeXT</div></div></div><span class="state ${status}" data-output-state="${esc(item?.label||title)}" data-public-status="${status}">${esc(statusCopy(item))}</span></div></section>`;
}

function artifact(number,title,hint,icon,copy,item,kind){
  if (!item || !['ready','published','complete'].includes(item.status) || !item.url) return lifecycle(number,title,hint,icon,copy,item);
  const url=esc(item.url);
  let media='';
  if(kind==='audio') media=`<audio class="media" controls preload="metadata" src="${url}"></audio>`;
  else if(kind==='video') media=`<video class="media" controls preload="metadata" src="${url}"></video>`;
  else if(kind==='image') media=`<a href="${url}" target="_blank" rel="noopener"><img class="media image" src="${url}" alt="${esc(title)}"></a>`;
  else media=`<a class="btn primary" href="${url}" target="_blank" rel="noopener">Abrir ${esc(title)}</a>`;
  return `<section class="sec wrap"><div class="sec-h"><span class="n">${number}</span><h2>${esc(title)}</h2><span class="hint">${esc(hint)}</span></div><div class="card"><div class="row"><div class="ico">${icon}</div><div><h3>${esc(title)} de la presentación</h3><p>${esc(copy)}</p><div class="fmt">Preparado por AdmiraNeXT</div></div></div><div class="artifact-media">${media}</div><span class="state complete" data-output-state="${esc(item.label||title)}" data-public-status="complete">${esc(statusCopy(item))}</span></div></section>`;
}

export async function onRequestGet(context){
  const client=String(context.params.client||'').toLowerCase();
  const [config,generation]=await Promise.all([
    context.env.PRESENTATION_IDEAS?.get(`presentation:${client}`,{type:'json'}),
    context.env.PRESENTATION_IDEAS?.get(`generation:${client}`,{type:'json'})
  ]);
  if(!config) return context.next();
  const primary=color(config.theme?.primary,'#12233e'); const accent=color(config.theme?.accent,'#ffb000');
  const mode=option(config.theme?.mode,['dark','light'],'light'),layout=option(config.theme?.layout,['editorial','centered'],'editorial'),profile=option(config.theme?.profile,['immersive','editorial','friendly','minimal','structured'],'structured');
  const background=color(config.theme?.background,mode==='dark'?'#080b12':'#f3f6f9'),surface=color(config.theme?.surface,mode==='dark'?'#111827':'#ffffff'),ink=color(config.theme?.text,mode==='dark'?'#f5f7fb':'#142238');
  const radius=Math.max(0,Math.min(32,Number(config.theme?.radius)||10)),shape=config.theme?.radiusStyle==='rounded'?'50%':`${Math.max(2,radius)}px`,density=option(config.theme?.density,['compact','balanced','airy'],'balanced');
  const heroPad=density==='airy'?'clamp(92px,13vw,154px)':density==='compact'?'clamp(52px,7vw,82px)':'clamp(68px,10vw,120px)',sectionPad=density==='airy'?'52px':density==='compact'?'27px':'38px';
  const muted=mode==='dark'?'#a7b3c7':'#607087',line=mode==='dark'?'#293449':'#dce4ec';
  const name=esc(config.displayName); const website=config.website && /^https:\/\//i.test(config.website)?esc(config.website):'';
  const allOutputs=['website','audio','video','pdf','powerpoint','documents','infographic'];
  const selected=new Set(Array.isArray(config.outputs)&&config.outputs.length?config.outputs:allOutputs);
  const positions={website:3,audio:4,video:5,pdf:6,powerpoint:7,documents:8,infographic:9};
  const hiddenCss=allOutputs.filter(item=>!selected.has(item)).map(item=>`.sec:nth-of-type(${positions[item]}){display:none}`).join('')+(selected.has('website')?'':'.tools .primary{display:none}');
  const currentGeneration=normalizeGeneration(generation);
  const arts=currentGeneration?.artifacts||{};
  const html=`<!doctype html><html lang="es" data-mode="${mode}" data-layout="${layout}" data-profile="${profile}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${name} · ADmiraNeXT</title><style>
  :root{--brand:${accent};--navy:${primary};--bg:${background};--panel:${surface};--ink:${ink};--mut:${muted};--line:${line};--radius:${radius}px;--shape:${shape};--mono:ui-monospace,"SF Mono",Menlo,monospace;--sans:${fontStack(config.theme?.fontStyle)}}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--sans);line-height:1.5}.wrap{width:min(1100px,calc(100% - 40px));margin:auto}.top{background:color-mix(in srgb,var(--panel) 92%,transparent);backdrop-filter:blur(16px);border-bottom:1px solid var(--line);padding:14px 0;position:sticky;top:0;z-index:5}.top .wrap{display:flex;align-items:center;justify-content:space-between;gap:18px}.brand{font:800 12px/1 var(--mono);letter-spacing:.13em;text-transform:uppercase}.brand b{color:var(--brand)}.tools{display:flex;gap:9px}.btn{display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--line);border-radius:var(--radius);padding:10px 14px;color:var(--ink);background:var(--panel);text-decoration:none;font:750 12px/1 var(--mono)}.btn.primary{background:var(--navy);border-color:var(--navy);color:#fff}.hero{position:relative;overflow:hidden;background:radial-gradient(80% 100% at 100% 0%,color-mix(in srgb,var(--brand) 24%,transparent),transparent 68%),linear-gradient(118deg,var(--navy),color-mix(in srgb,var(--navy) 64%,#000));color:#fff;padding:${heroPad} 0}.hero:after{content:"";position:absolute;width:440px;height:440px;border:76px solid color-mix(in srgb,var(--brand) 24%,transparent);border-radius:var(--shape);right:-150px;bottom:-260px;transform:rotate(-12deg)}.eyebrow{font:800 11px/1 var(--mono);letter-spacing:.17em;text-transform:uppercase;color:var(--brand)}h1{font-size:clamp(38px,6vw,68px);line-height:1.02;letter-spacing:-.035em;max-width:850px;margin:22px 0 0}.hero p{font-size:clamp(16px,2vw,20px);color:rgba(255,255,255,.76);max-width:760px;margin:23px 0 0}html[data-layout="centered"] .hero .wrap{text-align:center}html[data-layout="centered"] .hero h1,html[data-layout="centered"] .hero p{margin-left:auto;margin-right:auto}.sec{padding:${sectionPad} 0 6px}.sec-h{display:flex;align-items:baseline;gap:12px;margin-bottom:17px}.n{font:900 11px/1 var(--mono);color:var(--brand)}h2{font-size:24px;margin:0}.hint{margin-left:auto;color:var(--mut);font:700 11px/1 var(--mono)}.site{height:min(690px,76vh);background:#07101c;border-radius:calc(var(--radius) + 6px);overflow:hidden;box-shadow:0 18px 55px rgba(10,24,45,.18)}.site iframe{width:100%;height:100%;border:0}.actions{display:flex;gap:9px;flex-wrap:wrap;margin-top:12px}.card{background:var(--panel);border:1px solid var(--line);border-radius:calc(var(--radius) + 4px);padding:21px}.row{display:flex;gap:15px}.ico{width:46px;height:46px;flex:none;display:grid;place-items:center;border-radius:var(--radius);background:color-mix(in srgb,var(--brand) 14%,var(--panel));color:var(--brand);font:900 11px/1 var(--mono)}.card h3{margin:0;font-size:18px}.card p{margin:5px 0 0;color:var(--mut);font-size:14px}.fmt,.state{font:750 10px/1.45 var(--mono);letter-spacing:.06em;color:var(--mut)}.fmt{text-transform:uppercase;margin-top:10px}.state{display:flex;align-items:center;gap:8px;margin-top:18px}.state.complete{color:#128459}.state.processing{color:#266fe8}.state.processing:before{content:"";width:8px;height:8px;border-radius:50%;background:currentColor;box-shadow:0 0 0 0 color-mix(in srgb,currentColor 38%,transparent);animation:pulse 1.7s infinite}.state.error{color:#c9364a}.lifecycle{border-style:dashed}.lifecycle.error{border-color:color-mix(in srgb,#c9364a 52%,var(--line))}@keyframes pulse{70%{box-shadow:0 0 0 8px transparent}100%{box-shadow:0 0 0 0 transparent}}.artifact-media{margin-top:18px}.media{display:block;width:100%;max-height:680px;border-radius:var(--radius);background:#07101c}.media.image{height:auto;background:var(--panel);border:1px solid var(--line)}.foot{margin-top:52px;background:var(--navy);color:#fff;padding:28px 0}.foot .wrap{display:flex;justify-content:space-between;gap:18px;font:700 11px/1.5 var(--mono)}html[data-profile="minimal"] .hero:after{display:none}html[data-profile="immersive"] .hero{background:radial-gradient(70% 120% at 80% 0%,color-mix(in srgb,var(--brand) 42%,transparent),transparent 70%),linear-gradient(135deg,var(--navy),var(--bg))}@media(max-width:700px){.wrap{width:min(100% - 26px,1100px)}.tools .edit{display:none}.hint{display:none}.site{height:68vh}}
  ${hiddenCss}</style></head><body><header class="top"><div class="wrap"><div class="brand"><b>ADmiraNeXT</b> × ${name}</div><div class="tools">${website?`<a class="btn" href="${website}" target="_blank" rel="noopener">Web oficial ↗</a>`:''}<a class="btn primary" href="presentacion" target="_blank">Abrir site</a></div></div></header><section class="hero"><div class="wrap"><div class="eyebrow" data-ideas-eyebrow>Presentación privada · ${name}</div><h1 data-ideas-title>${name}: cada espacio puede aprender.</h1><p data-ideas-summary>Una propuesta creada desde un problema concreto y preparada para evolucionar.</p></div></section><section class="sec wrap"><div class="sec-h"><span class="n">00</span><h2>Esqueleto</h2><span class="hint">Fuente única editable</span></div><div data-presentation-skeleton data-client="${esc(client)}" data-base="/presentaciones/${esc(client)}"></div></section><section class="sec wrap"><div class="sec-h"><span class="n">01</span><h2>Site</h2><span class="hint">Generado desde el esqueleto</span></div><div class="site"><iframe src="presentacion" title="Presentación ${name}" loading="eager"></iframe></div><div class="actions"><a class="btn primary" href="presentacion" target="_blank">Abrir site completo</a></div></section>${artifact('02','Audio','AdmiraNeXT','♪','Resumen sonoro ejecutivo de la propuesta.',arts.audio,'audio')}${artifact('03','Vídeo','AdmiraNeXT','▶','Resumen audiovisual de la propuesta.',arts.video,'video')}${artifact('04','PDF','Diapositivas','PDF','Versión descargable del deck.',arts.pdf,'file')}${artifact('05','PowerPoint','Presentación','PPT','Versión editable de la presentación.',arts.powerpoint,'file')}${artifact('06','Documentos de trabajo','Brief · Guía · Fuentes','DOC','Documento ejecutivo, alcance y próximos pasos.',arts.documents,'file')}${artifact('07','Infografía','Resumen visual','INFO','Síntesis visual de la propuesta y del piloto.',arts.infographic,'image')}<footer class="foot"><div class="wrap"><span>ADmiraNeXT · Espacio privado</span><span>${name}</span></div></footer><script src="/assets/presentation-skeleton.js"></script><script>(()=>{const nodes=[...document.querySelectorAll('[data-output-state]')];if(!nodes.some(node=>node.dataset.publicStatus==='processing'))return;const visible=item=>item&&item.url&&['ready','published','complete'].includes(item.status)?'complete':['failed','skipped'].includes(item?.status)||item?.status==='complete'?'error':'processing';setInterval(async()=>{try{const response=await fetch('api/generation',{headers:{accept:'application/json'},cache:'no-store'});if(!response.ok)return;const data=await response.json();const artifacts=Object.values(data.generation?.artifacts||{});if(nodes.some(node=>{const item=artifacts.find(entry=>(entry.label||'')===node.dataset.outputState);return item&&visible(item)!==node.dataset.publicStatus}))location.reload()}catch(_){}},15000)})()</script></body></html>`;
  return new Response(html,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-robots-tag':'noindex, nofollow'}});
}
