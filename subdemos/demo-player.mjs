// La misma proyección del proyecto sirve en reunión y en la copia sin conexión.
import {documentacionDemos} from './presentacion.mjs';
import {videoPorDemo} from './retail-videos.mjs';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function demoGlobalHTML(project, {offline = false, presentation = 'presentacion', css = '/subdemos/demo-player.css', js = '/subdemos/demo-player.js'} = {}) {
  const data = {nombre:project.nombre, nota:project.nota, contexto:project.contexto,
    demos:documentacionDemos(project).filter(item => item.clave.includes('/')).map(item => ({
      clave:item.clave, titulo:item.titulo, desc:item.propuesta || project.propuestas?.[item.clave] || item.desc,
      url:item.url, cmd:item.cmd, guion:item.guion || [], muestra:item.muestra || null, video:videoPorDemo(item), caso:item.caso || null
    }))};
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${esc(project.nombre)} · Demo global</title><link rel="stylesheet" href="${esc(css)}"></head><body>
  <header><a href="${esc(presentation)}">← Presentación</a><span>${offline ? 'COPIA SIN CONEXIÓN' : 'DEMOSTRACIÓN GUIADA'}</span></header>
  <main><p class="eyebrow">ADMIRA · DEMO GLOBAL</p><h1>${esc(project.nombre)}</h1><p class="intro">Un proyecto, una campaña y su ejecución en tienda. El recorrido automático pasa de Biz a Studio y Store mientras presentas. Puedes pausar, reanudar o tomar el control en cualquier momento.</p>
  <section id="director" class="director" aria-label="Control de demostración automática"><div class="director-options"><label>Ritmo del recorrido<select id="auto-duration"><option value="5">Ágil</option><option value="8" selected>Normal</option><option value="12">Pausado</option></select></label><label class="sound"><input id="auto-sound" type="checkbox" checked> Escuchar los vídeos</label></div><div class="controls"><button id="auto-start">▶ Iniciar recorrido completo</button><button id="auto-pause" disabled>Pausar</button><button id="auto-stop" disabled>Detener</button><button id="auto-mute" aria-pressed="false">Silenciar todo</button></div><p id="auto-status" role="status">Preparado · Biz → Studio → Store · sin voz del asistente</p><progress id="auto-progress" max="100" value="0" aria-label="Progreso del recorrido automático"></progress><p class="muted">Espacio: pausar o reanudar · Escape: detener. Los vídeos se escuchan al iniciar. Puedes silenciar todo o desactivar su sonido durante el recorrido. Cada función espera al final real de su vídeo; la duración total depende de los clips.</p></section>
  <div class="choices"><label>Función<select id="demo-select" aria-label="Elegir función"></select></label><p id="demo-count" aria-live="polite"></p></div>
  <article id="demo-view"><p id="platform" class="eyebrow"></p><h2 id="demo-title"></h2><p id="demo-description"></p><div id="function-video"></div><p id="video-description" class="muted"></p><div id="sample"></div><p id="sample-caption" class="muted"></p><p id="media-status" class="muted" role="status"></p>
  <div class="walk"><p id="step-count" class="eyebrow" aria-live="polite"></p><p id="instruction"></p><div class="controls"><button id="previous-step">← Paso anterior</button><button id="next-step">Siguiente paso →</button></div></div>
  <details id="case"><summary>Datos del caso de demostración</summary><div id="case-fields"></div></details>
  <p class="connection-note">Estas demos muestran recorridos y resultados preparados. Las altas reales, la generación y la publicación requieren conexión y una sesión autorizada.</p><a id="native" target="_blank" rel="noopener noreferrer">Abrir la función online ↗</a></article>
  <nav class="controls bottom"><button id="previous-demo">← Función anterior</button><button id="next-demo">Siguiente función →</button></nav>
  <p class="muted">Para la reunión: Biz prepara el proyecto, Studio crea la campaña y Store la gestiona en tienda. Puedes elegir cualquier función en el menú.</p></main>
  <script type="application/json" id="demo-data">${json}</script><script src="${esc(js)}"></script></body></html>`;
}
