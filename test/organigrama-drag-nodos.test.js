import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const html = await readFile(new URL('../organigrama.html', import.meta.url), 'utf8');

function extraerFuncion(nombre) {
  const ini = html.indexOf(`function ${nombre}(`);
  assert.ok(ini > 0, nombre);
  let i = html.indexOf('{', ini), prof = 0;
  for (; i < html.length; i++) {
    if (html[i] === '{') prof++;
    else if (html[i] === '}' && --prof === 0) break;
  }
  return html.slice(ini, i + 1);
}

test('drag de cajas: pointer/touch con captura, umbral y clic protegido', () => {
  assert.match(html, /canvas\.addEventListener\('pointerdown'/);
  assert.match(html, /canvas\.addEventListener\('pointermove'/);
  assert.match(html, /canvas\.addEventListener\('pointerup', endDrag\)/);
  assert.match(html, /canvas\.addEventListener\('pointercancel', endDrag\)/);
  assert.ok(html.includes('node.setPointerCapture(e.pointerId)'));
  assert.ok(html.includes('DRAG_THRESHOLD'));
  assert.ok(html.includes('suppressClick'), 'el clic tras soltar no compacta/descompacta');
  // las cajas no dejan que el navegador haga scroll/zoom táctil encima: el drag funciona en móvil
  assert.match(html, /\.org-node\{[\s\S]*?touch-action:none/);
  // el transform no va en transition CSS (lo pinta el muelle en JS, sin retraso)
  const nodeCss = html.slice(html.indexOf('  .org-node{'), html.indexOf('  .org-node.is-dragging{'));
  assert.doesNotMatch(nodeCss, /transition:[^;]*transform/);
  assert.ok(html.includes('.org-node.is-dragging{'));
  // el pan del fondo sigue ignorando los nodos
  assert.ok(html.includes("if (e.target.closest('.org-node')) return;"));
});

test('flechas SVG en vivo: drawLines en cada frame reutilizando paths', () => {
  const draw = extraerFuncion('drawLines');
  assert.ok(draw.includes('pathCache'), 'reutiliza paths por id');
  assert.ok(draw.includes("path.setAttribute('data-edge', id)"));
  assert.doesNotMatch(draw, /clearPaths\(\)/, 'no borra y recrea las flechas en cada frame');
  assert.ok(draw.includes('canvas.offsetWidth'), 'viewBox en px de mundo, correcto con zoom');
  const tick = extraerFuncion('tick');
  assert.ok(tick.includes('translate3d('));
  assert.ok(tick.includes('drawLines();'));
  assert.ok(tick.includes('requestAnimationFrame(tick)'));
});

test('nodos conectados: la rama sigue con muelle leve y el padre se inclina', () => {
  assert.ok(html.includes('function targetFor(id, parents)'), 'destino = local propio + ancestros');
  assert.ok(html.includes('depthBelow(id, activeId, parents)'), 'cada generación algo más lenta');
  assert.ok(html.includes('lean[drag.parent]'), 'inclinación del padre durante el tirón');
  assert.ok(html.includes('delete lean[d.parent]'), 'el padre vuelve al soltar');
  assert.ok(html.includes('revealFromParents'), 'al descompactar los hijos nacen desde el padre');
  assert.ok(html.includes("localStorage.setItem(LAYOUT_KEY"), 'la colocación se recuerda');
  assert.ok(html.includes('id="org-relayout"'), 'botón Recolocar');
  assert.doesNotMatch(html, /<script[^>]+src="[^"]*(d3|gsap|interact|draggable|popmotion)/i, 'sin librería pesada');
});

test('springStep converge suave, sin saltos bruscos', () => {
  const springStep = new Function(`${extraerFuncion('springStep')}; return springStep;`)();
  const k = Number(html.match(/SPRING_K = ([\d.]+)/)[1]);
  const damp = Number(html.match(/SPRING_DAMP = ([\d.]+)/)[1]);
  const p = {x: 0, y: 0, vx: 0, vy: 0};
  let frames = 0, maxPaso = 0, maxX = 0, quieto = false;
  while (!quieto && frames < 240) {
    const antes = p.x;
    quieto = springStep(p, 200, -80, k, damp);
    maxPaso = Math.max(maxPaso, Math.abs(p.x - antes));
    maxX = Math.max(maxX, p.x);
    frames++;
  }
  assert.ok(quieto, 'llega al reposo');
  assert.ok(frames < 90, `reposa en < 1,5 s a 60 fps (${frames} frames)`);
  assert.equal(p.x, 200);
  assert.equal(p.y, -80);
  assert.ok(maxPaso < 200 * 0.5, `ningún frame salta más de la mitad del recorrido (${maxPaso.toFixed(1)})`);
  assert.ok(maxX < 200 * 1.08, `rebote leve (< 8 %): ${maxX.toFixed(1)}`);
});

test('no rompe colapso por defecto, zoom/pan, presentador ni latido', () => {
  assert.match(html, /collapseAllByDefault\(\);\s*\n\s*startMatrix/);
  assert.ok(html.includes('function zoomBy('));
  assert.ok(html.includes("viewport.addEventListener('pointerdown'"));
  assert.ok(html.includes('function setPresenter(on)'));
  assert.ok(html.includes('setInterval(refreshFlota, 30000)'));
  assert.ok(html.includes('Arrastra una caja para recolocarla'));
});
