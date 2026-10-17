/*
 * Tools roadmap_* del MCP de admiranext.com (Carlos, 16-10-2026):
 * "que todos los consejeros y agentes pongan su parte". Mismo almacén y validación
 * que /roadmap (functions/_roadmap-combo.js): regla del 123 y el abc, Ayer solo
 * lectura, las ideas enlazadas se editan en su proyecto.
 * Identidad: la del token MCP (email + etiqueta del token, ver _tokens.js). Un agente o
 * consejero solo escribe SU plan (la etiqueta del token o el email deben nombrarle);
 * un admin (Carlos) puede escribir cualquiera y es el único que aprueba.
 */
import { leer, guardar, EDITABLES, HORIZONTES } from '../_roadmap-combo.js';

// Supervisor de cada agente (Carlos, 17-10-2026). Sin entrada: cualquier consejero.
export const SUPERVISOR = { oraculo: 'elon', morfeo: 'elon' };
const ORDEN = ['hoy', 'manana', 'semana', 'mes', 'trimestre'];
const SUBS = ['a', 'b', 'c'];

export const REGLAS = `# Roadmap AdmiraNeXT · reglas (Carlos, 16-10-2026)

1. **Método 123 y abc**: cada horizonte tiene como máximo 3 ideas principales (1, 2, 3) en orden de prioridad; cada idea se divide en 3 subobjetivos (1a 1b 1c, 2a 2b 2c, 3a 3b 3c).
2. **Horizontes**: Ayer / Hoy / Mañana + Semana / Mes / Trimestre. Ayer es solo lectura (lo hecho: ✓ hecho, ◐ parcial, ✗ no hecho, o "sin registro"; nunca inventado).
3. **Plan diario listo a las 7:30 (Europe/Madrid)**: cada agente y consejero deja su Hoy (y Mañana) con roadmap_plan_diario antes de esa hora.
4. **Aprobado salvo objeción de Carlos**: el plan de cada consejero queda "propuesto" y vale salvo objeción; Carlos lo marca "OK Carlos" (roadmap_aprobar).
5. **Progreso por subobjetivos**: a/b/c hechos = 0/33/67/100 % (o % manual). Una idea puede sumar ideas de horizontes inferiores; el horizonte es la media de sus ideas y el proyecto la media de Hoy…Trimestre. Todo se reajusta en cascada (Hoy → Semana → Mes → Trimestre, y Admira.TV suma los 4 pilares).
6. **Cada encargo lleva proyecto** (admira.live: "Proyecto:" en el encargo).
7. **Responsables por vertical**: Trinity admira.studio · Neo admira.store · Oráculo admira.app · Morfeo admira.biz · consejero Elon admira.tv + admira.live · Jobs admiranext.
8. **Hecho declarado + sello del consejero**: el agente trabaja y, cuando lo juzga bien, puede subir/publicar él mismo; entonces declara el ítem hecho con roadmap_declarar_hecho (persona, id_idea, evidencia: URL o fichero). El consejero supervisor lo revisa y confirma con roadmap_sellar (revisor, id_idea, veredicto ok|rechazado, nota): su sello queda junto al ítem en /roadmap. **El consejero Elon supervisa a Oráculo y a Morfeo.** Un rechazo devuelve el ítem al agente (vuelve a declarar tras corregir).
9. Las ideas enlazadas a un proyecto se marcan/editan en su proyecto; no se inventan números ni fechas.

Vista web: https://www.admiranext.com/roadmap (?p=proyecto · ?a=agente · ?c=consejero).`;

export const ROADMAP_HELP = REGLAS + `

## Cómo poner tu parte (agentes y consejeros)
1. Conecta tu asistente a https://www.admiranext.com/mcp con tu token MCP (Authorization: Bearer anmcp_…). La etiqueta del token debe llevar tu nombre (p. ej. "Oráculo", "consejero Elon"): así el MCP sabe qué plan es el tuyo.
2. roadmap_reglas → roadmap_leer {vista:'agente'|'consejero', id:'<tu id>'}.
3. Antes de las 7:30: roadmap_plan_diario {persona, horizonte:'hoy', ideas:[{titulo, subs:[a,b,c]} ×3]} (y 'manana').
4. Durante el día: roadmap_marcar {persona, id_idea, sub:'a', hecho:true}. Las ideas enlazadas a tu proyecto se marcan igual y su avance sube en el proyecto, en tu plan y en Admira.TV.
5. roadmap_ayer {persona} para el resumen de ayer. Carlos aprueba con roadmap_aprobar.
6. Al terminar un ítem (agente): sube/publica si lo juzgas bien y roadmap_declarar_hecho {persona, id_idea, evidencia:'https://…' o ruta del fichero, nota}. En /roadmap sale "◷ declarado".
7. Revisión (consejero supervisor): roadmap_sellar {revisor:'elon', id_idea, veredicto:'ok'|'rechazado', nota}. Sale "✔ sello Elon" (o "✗ rechazado"). Elon revisa a Oráculo y Morfeo; para el resto sella cualquier consejero (o Carlos).`;

const persona = { type: 'string', description: 'id de agente o consejero (p. ej. oraculo, morfeo, elon, jobs). Lista en roadmap_leer.' };
const horizonte = { type: 'string', enum: ORDEN };
export const ROADMAP_TOOLS = [
  { name: 'roadmap_reglas', description: 'Reglas del roadmap: método 123 y abc, plan diario a las 7:30, aprobado salvo objeción de Carlos, horizontes, progreso en cascada y responsables por vertical. Léelas antes de escribir tu plan.', inputSchema: { type: 'object', properties: {} } },
  { name: 'roadmap_leer', description: 'Plan con progreso. vista: proyecto | agente | consejero; id (studio, store, app, biz, tv, live, next · trinity, neo, oraculo… · elon, jobs, jensen…). Sin id: lista de ids. horizonte opcional.', inputSchema: { type: 'object', properties: { vista: { type: 'string', enum: ['proyecto', 'agente', 'consejero'] }, id: { type: 'string' }, horizonte: { type: 'string', enum: HORIZONTES } }, required: ['vista'] } },
  { name: 'roadmap_plan_diario', description: 'Escribe TU plan (o cualquiera si eres admin) para un horizonte editable: hasta 3 ideas en orden de prioridad, cada una con exactamente 3 subobjetivos (a, b, c). Sustituye las ideas propias de ese horizonte. Hazlo antes de las 7:30 (Europe/Madrid).', inputSchema: { type: 'object', properties: { persona, horizonte, ideas: { type: 'array', maxItems: 3, items: { type: 'object', properties: { titulo: { type: 'string' }, subs: { type: 'array', minItems: 3, maxItems: 3, items: { type: 'string' } } }, required: ['titulo', 'subs'] } } }, required: ['persona', 'horizonte', 'ideas'] } },
  { name: 'roadmap_marcar', description: 'Marca un subobjetivo (a|b|c) como hecho o no, o fija un % manual (pct 0-100, o null para volver a automático) de una idea por su id_idea (ver roadmap_leer). Solo ideas de tu plan (o enlazadas en él) salvo admin. Ayer no se edita.', inputSchema: { type: 'object', properties: { persona: { type: 'string', description: 'tu id (o el proyecto si eres admin)' }, id_idea: { type: 'string' }, sub: { type: 'string', enum: SUBS }, hecho: { type: 'boolean' }, pct: { type: ['number', 'null'] } }, required: ['id_idea'] } },
  { name: 'roadmap_ayer', description: 'Resumen automático de Ayer para una persona o proyecto: hecho / parcial / no hecho / sin registro.', inputSchema: { type: 'object', properties: { persona } , required: ['persona'] } },
  { name: 'roadmap_declarar_hecho', description: 'Agente: declara hecho un ítem de tu plan (o enlazado en él) tras subir/publicar si lo juzgas bien. evidencia: URL o ruta del fichero. Queda "declarado" hasta el sello del consejero supervisor.', inputSchema: { type: 'object', properties: { persona: { type: 'string', description: 'tu id de agente (p. ej. oraculo, morfeo)' }, id_idea: { type: 'string' }, evidencia: { type: 'string', description: 'URL o fichero que lo demuestra' }, nota: { type: 'string' } }, required: ['persona', 'id_idea', 'evidencia'] } },
  { name: 'roadmap_sellar', description: 'Consejero supervisor: revisa un ítem declarado y pone su sello (veredicto ok | rechazado, nota). Elon supervisa a Oráculo y Morfeo.', inputSchema: { type: 'object', properties: { revisor: { type: 'string', description: 'tu id de consejero (p. ej. elon)' }, id_idea: { type: 'string' }, veredicto: { type: 'string', enum: ['ok', 'rechazado'] }, nota: { type: 'string' } }, required: ['revisor', 'id_idea', 'veredicto'] } },
  { name: 'roadmap_aprobar', description: 'Solo admin (Carlos): marca el plan de un consejero como "OK Carlos" (ok:false lo devuelve a "propuesto").', inputSchema: { type: 'object', properties: { persona, ok: { type: 'boolean' } }, required: ['persona'] } },
];
export const ROADMAP_READ_ONLY = ['roadmap_reglas', 'roadmap_leer', 'roadmap_ayer'];

const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
function indice(doc) {
  const byId = {}, items = {};
  doc.proyectos.forEach((p) => { byId[p.id] = p; Object.keys(p.roadmap || {}).forEach((h) => (p.roadmap[h] || []).forEach((i) => { if (i.id) items[i.id] = { i, p: p.id, h }; })); });
  return { byId, items };
}
const real = (ix, i) => (i && i.ref ? ix.items[i.ref] && ix.items[i.ref].i : i);
export function avance(ix, i, vis = {}) {
  i = real(ix, i); if (!i) return 0;
  if (i.id) { if (vis[i.id]) return 0; vis[i.id] = 1; }
  if (i.pct != null) return Number(i.pct);
  const de = (i.de || []).filter((x) => ix.items[x]);
  if (de.length) return Math.round(de.reduce((a, x) => a + avance(ix, ix.items[x].i, vis), 0) / de.length);
  const s = i.s || []; if (!s.length) return 0;
  return Math.round(((i.hs || []).filter(Boolean).length * 100) / s.length);
}
const media = (l) => (l.length ? Math.round(l.reduce((a, b) => a + b, 0) / l.length) : 0);
const avanceH = (ix, p, h) => media((p.roadmap[h] || []).filter((i) => real(ix, i)).map((i) => avance(ix, i)));
const avanceP = (ix, p) => media(ORDEN.filter((h) => (p.roadmap[h] || []).length).map((h) => avanceH(ix, p, h)));

/** ¿El token que llama es esta persona? Por etiqueta del token o por el email. */
export function esPersona(access, p) {
  if (!access || !p || !p.tipo) return false;
  const quien = norm(`${access.tokenLabel || ''} ${String(access.email || '').split('@')[0]}`);
  const claves = [p.id, ...norm(p.nombre).replace(/consejero|[()]/g, ' ').split(/\s+/)].map(norm).filter((x) => x.length >= 3);
  return claves.some((k) => new RegExp(`(^|[^a-z])${k}([^a-z]|$)`).test(quien));
}
const esAdmin = (access) => access && access.level === 'admin';

function vistaPlan(doc, ix, p, h) {
  const hs = h ? [h] : doc.horizontes;
  const plan = {};
  hs.forEach((hh) => {
    plan[hh] = {
      etiqueta: doc.etiquetas[hh], avance: hh === 'ayer' ? undefined : avanceH(ix, p, hh), editable: EDITABLES.has(hh),
      ideas: (p.roadmap[hh] || []).map((raw, n) => {
        const i = real(ix, raw); if (!i) return null;
        return { n: n + 1, id_idea: i.id || null, titulo: i.t, enlazada_de: raw.ref ? ix.items[raw.ref].p : undefined, estado: i.e,
          avance: hh === 'ayer' ? undefined : avance(ix, raw), pct_manual: i.pct,
          subs: (i.s || []).map((x, k) => ({ id: `${n + 1}${SUBS[k]}`, texto: x, hecho: !!(i.hs || [])[k] })) };
      }).filter(Boolean),
    };
  });
  return { id: p.id, nombre: p.nombre, tipo: p.tipo || 'proyecto', info: p.info || p.responsable, aprobacion: p.aprobacion, avance: avanceP(ix, p), sinPlan: doc.horizontes.every((x) => !(p.roadmap[x] || []).length) ? doc.sinPlan : undefined, plan, web: `https://www.admiranext.com/roadmap?${p.tipo === 'agente' ? 'a' : p.tipo === 'consejero' ? 'c' : 'p'}=${p.id}` };
}

async function escribir(ctx, doc) {
  const r = await guardar(ctx.env, doc, `${ctx.access.email} (MCP${ctx.access.tokenLabel ? ' · ' + ctx.access.tokenLabel : ''})`, true);
  if (!r.ok) throw new Error(r.error);
  return r;
}

export async function callRoadmapTool(ctx, name, a = {}) {
  if (name === 'roadmap_reglas') return { reglas: REGLAS };
  const doc = await leer(ctx.env);
  const ix = indice(doc);
  const buscar = (id) => { const p = ix.byId[String(id || '').toLowerCase()]; if (!p) throw new Error(`No existe "${id}". Usa roadmap_leer para ver los ids.`); return p; };
  switch (name) {
    case 'roadmap_leer': {
      const tipo = a.vista === 'proyecto' ? undefined : a.vista;
      if (!a.id) return { vista: a.vista, ids: doc.proyectos.filter((p) => p.tipo === tipo).map((p) => ({ id: p.id, nombre: p.nombre, info: p.info || p.responsable })) };
      if (a.horizonte && !HORIZONTES.includes(a.horizonte)) throw new Error('Horizonte no válido.');
      return vistaPlan(doc, ix, buscar(a.id), a.horizonte);
    }
    case 'roadmap_ayer': {
      const p = buscar(a.persona);
      const l = (p.roadmap.ayer || []).map((raw) => real(ix, raw)).filter(Boolean);
      const cuenta = { hecho: 0, parcial: 0, no: 0, sin_registro: 0 };
      const lineas = l.map((i) => { const k = i.e || 'sin_registro'; cuenta[k] = (cuenta[k] || 0) + 1; return `${{ hecho: '✓', parcial: '◐', no: '✗' }[i.e] || '·'} ${i.t}`; });
      return { persona: p.id, fecha: doc.etiquetas.ayer, resumen: l.length ? cuenta : { sin_registro: 1 }, lineas: lineas.length ? lineas : ['Sin registro de lo hecho ayer'] };
    }
    case 'roadmap_plan_diario': {
      const p = buscar(a.persona);
      if (!p.tipo) throw new Error('roadmap_plan_diario es para agentes y consejeros; los proyectos se editan en /roadmap.');
      if (!esAdmin(ctx.access) && !esPersona(ctx.access, p)) throw new Error(`Solo puedes escribir tu propio plan (tu token no corresponde a ${p.nombre}).`);
      if (!EDITABLES.has(a.horizonte)) throw new Error('Horizonte no editable (Ayer es solo lectura).');
      const ideas = Array.isArray(a.ideas) ? a.ideas : [];
      if (ideas.length > 3) throw new Error('Regla del 123: máximo 3 ideas.');
      const sello = Date.now().toString(36);
      const nuevas = ideas.map((x, n) => {
        const subs = Array.isArray(x && x.subs) ? x.subs.map((s) => String(s || '').trim()) : [];
        if (!String(x && x.titulo || '').trim() || subs.length !== 3 || subs.some((s) => !s)) throw new Error('Regla del abc: cada idea necesita título y exactamente 3 subobjetivos.');
        return { id: `${p.id}-${a.horizonte}-${sello}${n + 1}`, t: String(x.titulo).trim().slice(0, 120), s: subs.map((s) => s.slice(0, 200)), hs: [false, false, false] };
      });
      const enlazadas = (p.roadmap[a.horizonte] || []).filter((i) => i.ref);
      if (nuevas.length + enlazadas.length > 3) enlazadas.splice(3 - nuevas.length);
      p.roadmap[a.horizonte] = [...nuevas, ...enlazadas];
      if (p.tipo === 'consejero') p.aprobacion = 'propuesto';
      const r = await escribir(ctx, doc);
      return { ok: true, rev: r.rev, aviso: p.tipo === 'consejero' ? 'Plan propuesto: aprobado salvo objeción de Carlos.' : undefined, ...vistaPlan(r.doc, indice(r.doc), r.doc.proyectos.find((x) => x.id === p.id), a.horizonte) };
    }
    case 'roadmap_marcar': {
      const hit = ix.items[String(a.id_idea || '')];
      if (!hit) throw new Error('id_idea desconocido. Usa roadmap_leer.');
      if (!EDITABLES.has(hit.h)) throw new Error('Ayer es solo lectura.');
      if (!esAdmin(ctx.access)) {
        const p = a.persona ? buscar(a.persona) : null;
        const suya = p && esPersona(ctx.access, p) && Object.values(p.roadmap).some((l) => (l || []).some((i) => i.id === hit.i.id || i.ref === hit.i.id));
        if (!suya) throw new Error('Solo puedes marcar ideas de tu plan (o enlazadas en él). Pasa persona = tu id.');
      }
      const i = hit.i;
      if (a.sub) { const k = SUBS.indexOf(a.sub); if (k < 0 || k >= (i.s || []).length) throw new Error('sub debe ser a, b o c.'); i.hs = (i.s || []).map((_, j) => (j === k ? !!a.hecho : !!(i.hs || [])[j])); }
      if (a.pct === null) delete i.pct; else if (a.pct !== undefined) { const n = Number(a.pct); if (!Number.isFinite(n) || n < 0 || n > 100) throw new Error('pct entre 0 y 100.'); i.pct = Math.round(n); }
      if (!a.sub && a.pct === undefined) throw new Error('Indica sub+hecho o pct.');
      const r = await escribir(ctx, doc); const ix2 = indice(r.doc);
      const proy = ix2.byId[hit.p];
      return { ok: true, rev: r.rev, id_idea: i.id, proyecto: hit.p, avance_idea: avance(ix2, ix2.items[i.id].i), avance_horizonte: avanceH(ix2, proy, hit.h), avance_proyecto: avanceP(ix2, proy) };
    }
    case 'roadmap_declarar_hecho': {
      const p = buscar(a.persona);
      if (p.tipo !== 'agente') throw new Error('roadmap_declarar_hecho es para agentes (persona = tu id de agente).');
      if (!esAdmin(ctx.access) && !esPersona(ctx.access, p)) throw new Error(`Tu token no corresponde a ${p.nombre}.`);
      const hit = ix.items[String(a.id_idea || '')];
      if (!hit) throw new Error('id_idea desconocido. Usa roadmap_leer.');
      if (!Object.values(p.roadmap).some((l) => (l || []).some((i) => i.id === hit.i.id || i.ref === hit.i.id))) throw new Error('Ese ítem no está en tu plan.');
      const evidencia = String(a.evidencia || '').trim().slice(0, 400);
      if (!evidencia) throw new Error('Falta evidencia (URL o fichero).');
      hit.i.dec = { por: p.id, en: new Date().toISOString(), evidencia, nota: String(a.nota || '').trim().slice(0, 300) || undefined };
      delete hit.i.sel;
      const r = await escribir(ctx, doc);
      return { ok: true, rev: r.rev, id_idea: hit.i.id, estado: 'declarado', supervisor: SUPERVISOR[p.id] || 'cualquier consejero', aviso: 'Pendiente del sello del consejero supervisor.' };
    }
    case 'roadmap_sellar': {
      const c = buscar(a.revisor);
      if (c.tipo !== 'consejero') throw new Error('revisor debe ser un consejero.');
      if (!esAdmin(ctx.access) && !esPersona(ctx.access, c)) throw new Error(`Tu token no corresponde a ${c.nombre}.`);
      const hit = ix.items[String(a.id_idea || '')];
      if (!hit) throw new Error('id_idea desconocido. Usa roadmap_leer.');
      if (!hit.i.dec) throw new Error('Ese ítem no está declarado hecho todavía.');
      const sup = SUPERVISOR[hit.i.dec.por];
      if (sup && sup !== c.id && !esAdmin(ctx.access)) throw new Error(`Este ítem lo supervisa el consejero ${sup}.`);
      if (!['ok', 'rechazado'].includes(a.veredicto)) throw new Error('veredicto: ok | rechazado.');
      hit.i.sel = { por: c.id, nombre: c.nombre, veredicto: a.veredicto, nota: String(a.nota || '').trim().slice(0, 300) || undefined, en: new Date().toISOString() };
      const r = await escribir(ctx, doc);
      return { ok: true, rev: r.rev, id_idea: hit.i.id, sello: hit.i.sel };
    }
    case 'roadmap_aprobar': {
      if (!esAdmin(ctx.access)) throw new Error('Solo Carlos (admin) aprueba planes.');
      const p = buscar(a.persona);
      if (p.tipo !== 'consejero') throw new Error('Solo se aprueban planes de consejeros.');
      p.aprobacion = a.ok === false ? 'propuesto' : 'ok';
      const r = await escribir(ctx, doc);
      return { ok: true, rev: r.rev, persona: p.id, aprobacion: p.aprobacion };
    }
    default: throw new Error(`Tool desconocida: ${name}`);
  }
}
