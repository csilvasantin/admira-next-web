// /avatar-metricas — panel de métricas de los avatares de DigitalAvatar.ai (GrokBot · MacMini, 7-oct-2026).
// Mismo perímetro que /webmaster: sesión de Google + directorio AUTH_DB (_webmaster-gate.js).
// El servidor pide los agregados al cerebro (brain.digitalavatar.ai/metrics) con el secreto
// AVATAR_METRICS_TOKEN; el navegador nunca ve el token. digitalavatar.ai/metricas redirige aquí.
import { sesionCompleta, respuestaLogin } from './_webmaster-gate.js';

const BRAIN = 'https://brain.digitalavatar.ai/metrics';
const RUTA = '/avatar-metricas';
const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const TEMAS = { pedido: 'Pedido guiado', alergenos: 'Alérgenos', temporada: 'Temporada', personalizar: 'Personalizar (tamaño, leche…)', precios_horarios: 'Precios / horarios (se remite a tienda)', carta: 'Carta y bebidas', identidad: '¿Quién eres?', ayuda_comandos: 'Ayuda y comandos', saludo: 'Saludos', demo: 'Pitch /demo 30 s', otros: 'Otros' };
const AVATARES = { admirito: 'Admirito (avatar)', luna: 'Luna (human)', neo: 'Neo (metahuman)' };
const IDIOMAS = { es: 'Español', en: 'English' };

function bars(list, labels = {}, color = '#00704A') {
  if (!list || !list.length) return '<p class="dim">Sin datos todavía.</p>';
  const max = Math.max(...list.map((x) => x.v), 1);
  const tot = list.reduce((a, x) => a + x.v, 0) || 1;
  return '<div class="bars">' + list.map((x) => `<div class="row"><span class="lb">${esc(labels[x.k] || x.k)}</span><span class="bar"><i style="width:${Math.max(3, Math.round((x.v / max) * 100))}%;background:${color}"></i></span><span class="n">${x.v} · ${Math.round((x.v / tot) * 100)}%</span></div>`).join('') + '</div>';
}
function fmtS(s) { s = Math.round(s || 0); return s >= 60 ? `${Math.floor(s / 60)} min ${s % 60} s` : `${s} s`; }

export function pagina(d, q, user) {
  const marca = q.get('brand') || '';
  const dias = q.get('days') || '7';
  const qa = q.get('qa') === '1';
  const sel = (v, cur) => (String(v) === String(cur) ? ' selected' : '');
  const dayMax = Math.max(1, ...d.por_dia.map((x) => x.v));
  const spark = d.por_dia.map((x) => `<div class="col" title="${esc(x.k)}: ${x.v}"><i style="height:${Math.round((x.v / dayMax) * 100)}%"></i><span>${esc(x.k.slice(8))}</span></div>`).join('');
  const top = d.top_preguntas.length ? '<ol class="top">' + d.top_preguntas.map((x) => `<li><span>${esc(x.k)}</span><b>${x.v}</b></li>`).join('') + '</ol>' : '<p class="dim">Sin preguntas todavía.</p>';
  const titulo = marca ? `${marca === 'starbucks' ? 'Starbucks' : esc(marca)} · Avatar digital` : 'Avatares digitales · todas las marcas';
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow">
<meta name="admiranext-version" content="v.07.10.2026.r10.10:57"><title>${titulo} · Métricas</title>
<style>:root{--bg:#f6f4ef;--card:#fff;--ink:#1e3932;--dim:#6b7c76;--line:#e3e0d8;--g:#00704A}*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font-family:Inter,-apple-system,"Segoe UI",Roboto,sans-serif}
.wrap{width:min(100% - 32px,1120px);margin:0 auto;padding:26px 0 60px}header{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap}
h1{margin:4px 0 2px;font-size:clamp(24px,3.4vw,34px);letter-spacing:-.02em}.k{font:700 11px/1 ui-monospace,monospace;letter-spacing:.18em;text-transform:uppercase;color:var(--g)}
.dim{color:var(--dim);font-size:13px}form{display:flex;gap:8px;flex-wrap:wrap;align-items:center}select,button{font:600 14px Inter,system-ui;padding:8px 10px;border-radius:10px;border:1px solid var(--line);background:#fff;color:var(--ink)}button{background:var(--g);color:#fff;border:0;cursor:pointer}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin:20px 0}.kpi{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:16px}.kpi b{display:block;font-size:30px;letter-spacing:-.02em}.kpi span{color:var(--dim);font-size:13px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:14px}.card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:16px 18px}.card h2{font-size:15px;margin:0 0 12px}
.bars .row{display:grid;grid-template-columns:minmax(110px,40%) 1fr auto;gap:10px;align-items:center;margin:7px 0;font-size:13px}.bar{background:#eef0ec;border-radius:99px;height:10px;overflow:hidden}.bar i{display:block;height:100%;border-radius:99px}.n{color:var(--dim);font-variant-numeric:tabular-nums}
.top{margin:0;padding-left:22px}.top li{display:flex;justify-content:space-between;gap:12px;padding:6px 0;border-bottom:1px solid var(--line);font-size:14px}.top li b{color:var(--g)}
.spark{display:flex;align-items:flex-end;gap:6px;height:120px}.col{flex:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;height:100%}.col i{display:block;width:100%;background:var(--g);border-radius:6px 6px 0 0;min-height:2px}.col span{font-size:10px;color:var(--dim);margin-top:4px}
footer{margin-top:26px;color:var(--dim);font-size:12px}</style></head><body><div class="wrap">
<header><div><div class="k">DigitalAvatar.ai · Métricas</div><h1>${titulo}</h1><div class="dim">${esc(d.desde)} → ${esc(d.hasta)} · ${d.dias} días${qa ? ' · incluye pruebas internas' : ''} · sesión de ${esc(user)}</div></div>
<form method="GET" action="${RUTA}"><select name="brand" aria-label="Marca"><option value=""${sel('', marca)}>Todas las marcas</option><option value="starbucks"${sel('starbucks', marca)}>Starbucks</option><option value="365"${sel('365', marca)}>365</option><option value="admira"${sel('admira', marca)}>AdmiraNeXT</option></select>
<select name="days" aria-label="Periodo"><option value="1"${sel(1, dias)}>Hoy</option><option value="7"${sel(7, dias)}>7 días</option><option value="30"${sel(30, dias)}>30 días</option><option value="90"${sel(90, dias)}>90 días</option></select>
<label class="dim"><input type="checkbox" name="qa" value="1"${qa ? ' checked' : ''}> pruebas internas</label><button>Ver</button></form></header>
<section class="kpis"><div class="kpi"><b>${d.conversaciones}</b><span>conversaciones</span></div><div class="kpi"><b>${d.preguntas}</b><span>preguntas</span></div><div class="kpi"><b>${fmtS(d.duracion_media_s)}</b><span>duración media (mediana ${fmtS(d.duracion_mediana_s)})</span></div><div class="kpi"><b>${d.preguntas_por_conversacion}</b><span>preguntas por conversación</span></div><div class="kpi"><b>${(d.respuesta_media_ms / 1000).toFixed(1)} s</b><span>tiempo de respuesta</span></div></section>
<div class="grid">
<div class="card" style="grid-column:1/-1"><h2>Preguntas por día</h2><div class="spark">${spark}</div></div>
<div class="card"><h2>Preguntas más frecuentes</h2>${top}</div>
<div class="card"><h2>Temas</h2>${bars(d.por_tema, TEMAS)}</div>
<div class="card"><h2>Idioma</h2>${bars(d.por_idioma, IDIOMAS, '#cba258')}</div>
<div class="card"><h2>Avatar</h2>${bars(d.por_avatar, AVATARES, '#1e3932')}</div>
<div class="card"><h2>Plataforma de origen</h2>${bars(d.por_plataforma, {}, '#00754A')}</div>
<div class="card"><h2>Marca</h2>${bars(d.por_marca, { starbucks: 'Starbucks', admira: 'AdmiraNeXT (sin marca)' }, '#cba258')}</div>
</div>
<footer>${esc(d.privacidad)} · Fuente: brain.digitalavatar.ai/metrics · GrokBot · MacMini</footer></div></body></html>`;
}

export async function onRequest(context) {
  const { request, env } = context;
  if (!env.WEBMASTER_SIGNING_KEY) return respuestaLogin(env, 'Acceso no disponible ahora mismo.', RUTA, 503);
  const user = await sesionCompleta(request, env);
  if (!user) return respuestaLogin(env, 'Métricas del avatar: identifícate para entrar.', RUTA, 401);
  const url = new URL(request.url);
  const q = new URLSearchParams();
  for (const k of ['brand', 'days', 'qa']) if (url.searchParams.get(k)) q.set(k, url.searchParams.get(k));
  if (!q.get('days')) q.set('days', '7');
  let d = null, err = '';
  try {
    if (!env.AVATAR_METRICS_TOKEN) throw new Error('falta AVATAR_METRICS_TOKEN');
    const r = await fetch(BRAIN + '?' + q.toString(), { headers: { Authorization: 'Bearer ' + env.AVATAR_METRICS_TOKEN }, signal: AbortSignal.timeout(15000) });
    d = await r.json();
    if (!d || !d.ok) throw new Error('cerebro ' + r.status);
  } catch (e) { err = String(e && e.message || e); }
  const headers = { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'private, no-store', 'x-robots-tag': 'noindex, nofollow' };
  if (!d || !d.ok) return new Response(`<!doctype html><meta charset="utf-8"><title>Métricas</title><p style="font-family:system-ui;padding:30px">No se pudieron cargar las métricas (${esc(err)}).</p>`, { status: 502, headers });
  return new Response(pagina(d, url.searchParams, user.display_name || user.email), { headers });
}
