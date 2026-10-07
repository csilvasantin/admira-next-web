// /subdemos: escoger proyectos y qué demos (globales y subdemos) se enseñan en cada uno.
// Se guarda en este navegador (localStorage «ax-subdemos»); Exportar/Importar lo mueve a otro.
import {GLOBALES, PROYECTOS_INICIALES, guion, guionTexto} from './catalogo.mjs?v=20261007-subdemos-1';

const KEY = 'ax-subdemos';
const $ = (s) => document.querySelector(s);
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const slug = (t) => String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'proyecto';

function cargar() {
  try { const j = JSON.parse(localStorage.getItem(KEY) || 'null'); if (j && Array.isArray(j.proyectos) && j.proyectos.length) return j; } catch (_) {}
  return {proyectos: structuredClone(PROYECTOS_INICIALES), activo: PROYECTOS_INICIALES[0].id};
}
let estado = cargar();
function guardar() { try { localStorage.setItem(KEY, JSON.stringify(estado)); } catch (_) {} }
const activo = () => estado.proyectos.find((p) => p.id === estado.activo) || estado.proyectos[0];

function pintarProyectos() {
  $('#proyectos').innerHTML = estado.proyectos.map((p) =>
    `<button type="button" class="proy${p.id === activo().id ? ' on' : ''}" data-id="${esc(p.id)}" aria-pressed="${p.id === activo().id}">${esc(p.nombre)}<small>${guion(p.demos).length} demos</small></button>`).join('');
}
function pintarCatalogo() {
  const sel = new Set(activo().demos);
  $('#catalogo').innerHTML = GLOBALES.map((g, i) => `
    <fieldset class="global">
      <legend><label><input type="checkbox" data-clave="${g.id}"${sel.has(g.id) ? ' checked' : ''}> <b>${i + 1} · ${esc(g.nombre)}</b></label> <span>${esc(g.desc)}</span> <code>/demo ${g.id}</code></legend>
      <div class="subs">${g.subdemos.map((s) => `
        <label class="sub"><input type="checkbox" data-clave="${g.id}/${s.id}"${sel.has(g.id + '/' + s.id) ? ' checked' : ''}>
          <span><b>${s.letra ? s.letra + '. ' : ''}${esc(s.nombre)}</b> ${esc(s.desc)}${s.cmd ? ` <code>${esc(s.cmd)}</code>` : ''}</span></label>`).join('')}
      </div>
    </fieldset>`).join('');
}
function pintarGuion() {
  const p = activo(), pasos = guion(p.demos);
  $('#guion-titulo').textContent = p.nombre + (p.nota ? ' · ' + p.nota : '');
  $('#guion').innerHTML = pasos.length ? pasos.map((s) => `
    <li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.titulo)}</a> <span>${esc(s.desc)}</span>${s.cmd ? ` <code>${esc(s.cmd)}</code>` : ''}</li>`).join('')
    : '<li class="vacio">Marca demos arriba para montar el guion.</li>';
  $('#borrar').disabled = estado.proyectos.length < 2;
}
function pintar() { pintarProyectos(); pintarCatalogo(); pintarGuion(); }
function aviso(t) { $('#estado').textContent = t; setTimeout(() => { if ($('#estado').textContent === t) $('#estado').textContent = ''; }, 2500); }

$('#proyectos').addEventListener('click', (e) => { const b = e.target.closest('.proy'); if (!b) return; estado.activo = b.dataset.id; guardar(); pintar(); });
$('#catalogo').addEventListener('change', (e) => {
  const c = e.target.dataset.clave; if (!c) return;
  const p = activo(), set = new Set(p.demos);
  if (e.target.checked) set.add(c); else set.delete(c);
  p.demos = [...set]; guardar(); pintarProyectos(); pintarGuion();
});
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
  a.href = URL.createObjectURL(new Blob([JSON.stringify(estado, null, 2)], {type: 'application/json'}));
  a.download = 'subdemos.json'; a.click(); URL.revokeObjectURL(a.href);
});
$('#importar').addEventListener('change', async (e) => {
  const f = e.target.files[0]; if (!f) return;
  try { const j = JSON.parse(await f.text()); if (!Array.isArray(j.proyectos) || !j.proyectos.length) throw 0; estado = j; guardar(); pintar(); aviso('Importado.'); }
  catch (_) { aviso('Archivo no válido.'); }
  e.target.value = '';
});
pintar();
