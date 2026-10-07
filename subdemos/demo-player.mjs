// La misma proyección del proyecto sirve en reunión y en la copia sin conexión.
import {documentacionDemos} from './presentacion.mjs';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function demoGlobalHTML(project, {offline = false, presentation = 'presentacion', css = '/subdemos/demo-player.css', js = '/subdemos/demo-player.js'} = {}) {
  const data = {nombre:project.nombre, nota:project.nota, contexto:project.contexto,
    demos:documentacionDemos(project).filter(item => item.clave.includes('/')).map(item => ({
      clave:item.clave, titulo:item.titulo, desc:item.propuesta || project.propuestas?.[item.clave] || item.desc,
      url:item.url, cmd:item.cmd, guion:item.guion || [], muestra:item.muestra || null, caso:item.caso || null
    }))};
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${esc(project.nombre)} · Demo global</title><link rel="stylesheet" href="${esc(css)}"></head><body>
  <header><a href="${esc(presentation)}">← Presentación</a><span>${offline ? 'COPIA SIN CONEXIÓN' : 'DEMOSTRACIÓN GUIADA'}</span></header>
  <main><p class="eyebrow">ADMIRA · DEMO GLOBAL</p><h1>${esc(project.nombre)}</h1><p class="intro">Un proyecto, una campaña y su ejecución en tienda. Recorre las funciones a tu ritmo y escucha las muestras preparadas.</p>
  <div class="choices"><label>Función<select id="demo-select" aria-label="Elegir función"></select></label><p id="demo-count" aria-live="polite"></p></div>
  <article><p id="platform" class="eyebrow"></p><h2 id="demo-title"></h2><p id="demo-description"></p><div id="sample"></div><p id="sample-caption" class="muted"></p>
  <div class="walk"><p id="step-count" class="eyebrow" aria-live="polite"></p><p id="instruction"></p><div class="controls"><button id="previous-step">← Paso anterior</button><button id="next-step">Siguiente paso →</button></div></div>
  <details id="case"><summary>Datos del caso de demostración</summary><div id="case-fields"></div></details>
  <p class="connection-note">Estas demos muestran recorridos y resultados preparados. Las altas reales, la generación y la publicación requieren conexión y una sesión autorizada.</p><a id="native" target="_blank" rel="noopener noreferrer">Abrir la función online ↗</a></article>
  <nav class="controls bottom"><button id="previous-demo">← Función anterior</button><button id="next-demo">Siguiente función →</button></nav>
  <p class="muted">Para la reunión: Biz prepara el proyecto, Studio crea la campaña y Store la gestiona en tienda. Puedes elegir cualquier función en el menú.</p></main>
  <script type="application/json" id="demo-data">${json}</script><script src="${esc(js)}"></script></body></html>`;
}
