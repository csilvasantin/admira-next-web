// /subdemos: escoger proyectos y qué demos (globales y subdemos) se enseñan en cada uno.
// Se guarda en este navegador (localStorage «ax-subdemos»); Exportar/Importar lo mueve a otro.
import {GLOBALES, PROYECTOS_INICIALES, MANIFIESTOS, aplicarManifiesto, guion, guionTexto, pasoTexto, proyectoLimpio, CONTEXTO, ANTERIORES} from './catalogo.mjs?v=20261007-subdemos-5';

import {normalizarCatalogo, catalogoActual, guardarSubdemo, borrarSubdemo} from './editor-catalogo.mjs';

const KEY = 'ax-subdemos';
const KEY_MANIF = 'ax-subdemos-manifiestos'; // manifiestos importados a mano en este navegador
const $ = (s) => document.querySelector(s);
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const slug = (t) => String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'proyecto';

function cargar() {
  try { const j = JSON.parse(localStorage.getItem(KEY) || 'null'); if (j && Array.isArray(j.proyectos) && j.proyectos.length) return limpio(j); } catch (_) {}
  return {proyectos: structuredClone(PROYECTOS_INICIALES), activo: PROYECTOS_INICIALES[0].id};
}
function limpio(j) { const proyectos = j.proyectos.map(proyectoLimpio); return {proyectos, activo: proyectos.some((p) => p.id === j.activo) ? j.activo : proyectos[0].id}; }
let estado = cargar();
function guardar() { try { localStorage.setItem(KEY, JSON.stringify(estado)); } catch (_) {} }
const activo = () => estado.proyectos.find((p) => p.id === estado.activo) || estado.proyectos[0];

function pintarProyectos() {
  $('#proyectos').innerHTML = estado.proyectos.map((p) =>
    `<button type="button" class="proy${p.id === activo().id ? ' on' : ''}" data-id="${esc(p.id)}" aria-pressed="${p.id === activo().id}">${esc(p.nombre)}<small>${guion(p.demos).length} demos</small></button>`).join('');
}
function pintarCatalogo() {
  const sel = new Set(activo().demos);
  const checkbox = (g,s) => `<label class="sub"><input type="checkbox" data-clave="${g.id}/${s.id}"${sel.has(g.id+'/'+s.id)?' checked':''}><span><b>${s.letra?esc(s.letra)+'. ':''}${esc(s.nombre)}</b> ${esc(s.desc)}${s.cmd?` <code>${esc(s.cmd)}</code>`:''}</span></label>`;
  $('#catalogo').innerHTML = GLOBALES.map(g => {
    const legacy=(ANTERIORES[g.id]||[]).filter(s=>sel.has(g.id+'/'+s.id)&&!g.subdemos.some(x=>x.id===s.id));
    return `<fieldset class="global"><legend><label><input type="checkbox" data-clave="${g.id}"${sel.has(g.id)?' checked':''}> <b>${esc(g.nombre)}</b></label> <span>${esc(g.desc)}</span> <code>/demo ${g.id}</code></legend>
      <div class="subs">${g.subdemos.map(s=>`<div class="sub-editor">${checkbox(g,s)}<div class="sub-tools"><button type="button" data-edit-sub="${g.id}/${s.id}">Editar</button><button type="button" data-delete-sub="${g.id}/${s.id}">Eliminar</button></div></div>`).join('')}</div>
      ${legacy.length?`<h3>Otras subdemos guardadas</h3><div class="subs">${legacy.map(s=>checkbox(g,s)).join('')}</div>`:''}
      <button type="button" class="btn" data-add-sub="${g.id}">+ Añadir subdemo</button></fieldset>`;
  }).join('');
}
let editingSub = null;
function editarSubdemo(platform,id='') {
  const g=GLOBALES.find(x=>x.id===platform), entry=g?.subdemos.find(s=>s.id===id);
  if(!g||id&&!entry)return;
  editingSub=id?{platform,id,entry}:null;
  $('#sub-plataforma').value=platform;$('#sub-plataforma').disabled=Boolean(id);
  for(const key of ['id','letra','nombre','desc','url','cmd'])$('#sub-'+key).value=entry?.[key]||'';
  $('#sub-id').readOnly=Boolean(id);
  $('#editor-subdemo').hidden=false;$('#sub-error').textContent='';$('#sub-nombre').focus();
}
function cerrarEditor(){editingSub=null;$('#editor-subdemo').hidden=true;}
function catalogoEditor(){const stored=manifiestosGuardados();return catalogoActual(GLOBALES).map(m=>({...stored[m.plataforma],...m}));}
function aplicarCatalogo(manifests){for(const m of normalizarCatalogo(manifests))GLOBALES.find(g=>g.id===m.plataforma).subdemos=m.subdemos;}
function persistirCatalogo(manifests,platform){const stored=manifiestosGuardados();for(const m of manifests)if(!platform||m.plataforma===platform)stored[m.plataforma]=m;localStorage.setItem(KEY_MANIF,JSON.stringify(stored));aplicarCatalogo(manifests);}
$('#catalogo').addEventListener('click',e=>{
  const add=e.target.closest('[data-add-sub]'),edit=e.target.closest('[data-edit-sub]'),del=e.target.closest('[data-delete-sub]');
  if(add)editarSubdemo(add.dataset.addSub);
  if(edit){const [g,id]=edit.dataset.editSub.split('/');editarSubdemo(g,id);}
  if(del){const [g,id]=del.dataset.deleteSub.split('/');if(!confirm('¿Eliminar esta subdemo del catálogo y quitarla de los proyectos de este navegador?'))return;
    try{const next=borrarSubdemo(catalogoEditor(),g,id);persistirCatalogo(next,g);for(const p of estado.proyectos)p.demos=p.demos.filter(k=>k!==g+'/'+id);guardar();cerrarEditor();pintar();aviso('Subdemo eliminada.');}catch(err){aviso(err.message);}}
});
$('#sub-cancelar').addEventListener('click',cerrarEditor);
$('#editor-subdemo').addEventListener('submit',e=>{
  e.preventDefault();
  try{const platform=$('#sub-plataforma').value,entry={...(editingSub?.entry||{})};
    for(const key of ['id','letra','nombre','desc','url','cmd'])entry[key]=$('#sub-'+key).value.trim();
    entry.aliases ||= [entry.id];
    const next=guardarSubdemo(catalogoEditor(),platform,entry,editingSub?.id||'');persistirCatalogo(next,platform);cerrarEditor();pintar();aviso('Subdemo guardada en este navegador.');
  }catch(err){$('#sub-error').textContent=err.message;}
});
function pintarGuion() {
  const p = activo(), pasos = guion(p.demos);
  $('#guion-titulo').textContent = p.nombre + (p.nota ? ' · ' + p.nota : '');
  $('#guion').innerHTML = pasos.length ? pasos.map((s) => `
    <li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.titulo)}</a> <span>${esc(s.desc)}</span>${s.cmd ? ` <code>${esc(s.cmd)}</code>` : ''}${s.muestra && s.muestra.url ? ` <a class="muestra" href="${esc(s.muestra.url)}" target="_blank" rel="noopener">muestra</a>` : ''}${s.ensayo_url ? ` <a class="ensayo" href="${esc(s.ensayo_url)}" target="_blank" rel="noopener">Ensayar recorrido</a>` : ''}${s.steps.length + s.guion.length ? `<ol class="pasos">${[...s.steps, ...s.guion].map((x) => `<li>${esc(pasoTexto(x))}</li>`).join('')}</ol>` : ''}</li>`).join('')
    : '<li class="vacio">Marca demos arriba para montar el guion.</li>';
  $('#borrar').disabled = estado.proyectos.length < 2;
  $('#d-presentation').value = p.presentation_id || '';
  for (const k of CONTEXTO) $('#d-' + k).value = (p.contexto && p.contexto[k]) || '';
}
function pintar() { pintarProyectos(); pintarCatalogo(); pintarGuion(); }
function aviso(t) { $('#estado').textContent = t; setTimeout(() => { if ($('#estado').textContent === t) $('#estado').textContent = ''; }, 2500); }

$('#proyectos').addEventListener('click', (e) => { const b = e.target.closest('.proy'); if (!b) return; estado.activo = b.dataset.id; guardar(); pintar(); });
$('#catalogo').addEventListener('change', (e) => {
  const c = e.target.dataset.clave; if (!c) return;
  const p = activo(), set = new Set(p.demos);
  if (e.target.checked) {if(!set.has(c)&&set.size>=40){e.target.checked=false;aviso('Máximo 40 demos por proyecto.');return;}set.add(c);} else set.delete(c);
  p.demos = [...set]; guardar(); pintarProyectos(); pintarCatalogo(); pintarGuion();
});
$('#datos').addEventListener('input', () => {
  const p = activo(), c = {};
  for (const k of CONTEXTO) c[k] = $('#d-' + k).value;
  Object.assign(p, proyectoLimpio({...p, presentation_id: $('#d-presentation').value, contexto: c}));
  if (!p.presentation_id) delete p.presentation_id;
  if (!proyectoLimpio(p).contexto) delete p.contexto;
  guardar();
});
$('#datos').addEventListener('submit', (e) => e.preventDefault());
$('#nuevo').addEventListener('submit', (e) => {
  e.preventDefault();
  const nombre = $('#nuevo-nombre').value.trim(); if (!nombre) return;
  let id = slug(nombre), n = 2; while (estado.proyectos.some((p) => p.id === id)) id = slug(nombre) + '-' + n++;
  estado.proyectos.push({id, nombre, nota: '', demos: GLOBALES.map((g) => g.id)});
  estado.activo = id; $('#nuevo-nombre').value = ''; guardar(); pintar();
});
$('#borrar').addEventListener('click', () => {
  const p = activo(); if (estado.proyectos.length < 2 || !confirm('¿Quitar ' + p.nombre + '?')) return;
  estado.proyectos = estado.proyectos.filter((x) => x !== p); estado.activo = estado.proyectos[0].id; guardar(); pintar();
});
$('#copiar').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(guionTexto(activo())); aviso('Guion copiado.'); } catch (_) { aviso('No se pudo copiar.'); }
});
$('#empezar').addEventListener('click', () => { const s = guion(activo().demos)[0]; if (s) location.assign(s.url); });
$('#exportar').addEventListener('click', () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify({...estado,version:1,manifiestos:catalogoEditor()}, null, 2)], {type: 'application/json'}));
  a.download = 'subdemos.json'; a.click(); URL.revokeObjectURL(a.href);
});
$('#importar').addEventListener('change', async (e) => {
  const f = e.target.files[0]; if (!f) return;
  try {
    const j = JSON.parse(await f.text());
    if (j && j.plataforma && Array.isArray(j.subdemos)) {
      // Manifiesto de plataforma: cambia el catálogo de subdemos de esa plataforma.
      const [manifest]=normalizarCatalogo([j]);
      const id=manifest.plataforma;aplicarCatalogo([manifest]);
      const guardados = manifiestosGuardados(); guardados[id] = manifest;
      try { localStorage.setItem(KEY_MANIF, JSON.stringify(guardados)); } catch (_) {}
      pintar(); aviso('Subdemos de ' + id + ' cargadas.');
    } else {
      if (!Array.isArray(j.proyectos) || !j.proyectos.length) throw 0;
      const manifests=normalizarCatalogo(j.manifiestos||[]),next=limpio(j);
      if(manifests.length)persistirCatalogo(manifests);estado=next;guardar();cerrarEditor();pintar();aviso('Importado.');
    }
  } catch (err) { aviso('Archivo no válido' + (err && err.message ? ': ' + err.message : '.')); }
  e.target.value = '';
});
function manifiestosGuardados() { try { return JSON.parse(localStorage.getItem(KEY_MANIF) || '{}') || {}; } catch (_) { return {}; } }
// Manifiestos publicados: primero el de la propia plataforma (studio = www.admira.studio/demo/, el pack de Trinity),
// si no responde la copia de /subdemos/<plataforma>.subdemos.json; encima, los importados aquí.
const ORIGEN = {studio:'https://www.admira.studio/demo/studio.subdemos.json',store:'/subdemos/store.subdemos.json',biz:'/subdemos/biz.subdemos.json'};
async function cargarManifiestos() {
  await Promise.all(MANIFIESTOS.map(async (id) => {
    for (const u of [ORIGEN[id], '/subdemos/' + id + '.subdemos.json'].filter(Boolean)) {
      try { const r = await fetch(u, {cache: 'no-store'}); if (r.ok) { aplicarManifiesto(await r.json()); return; } } catch (_) {}
    }
  }));
  for (const m of Object.values(manifiestosGuardados())) { try { aplicarCatalogo([m]); } catch (_) {} }
}
pintar();
cargarManifiestos().then(pintar);
