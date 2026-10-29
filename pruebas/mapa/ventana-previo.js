/* Ventana de previo admira.tv: se arrastra por la cabecera y se redimensiona por la esquina.
   Sólo en escritorio (en móvil el player va en flujo, ver mapa.css). Recuerda posición y ancho. */
(function () {
  'use strict';
  var KEY = 'admiranext_mapa_previo', MIN_W = 240;
  function ready(fn) { if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }
  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch (e) { return null; } }
  function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }
  function clear() { try { localStorage.removeItem(KEY); } catch (e) {} }

  ready(function () {
    var win = document.getElementById('simulador-player');
    var stage = win && win.parentElement;
    var head = win && win.querySelector('.mapa-sim-head');
    if (!win || !stage || !head) return;
    var mq = window.matchMedia('(max-width:600px)');
    var grip = document.createElement('div');
    grip.className = 'mapa-sim-grip';
    grip.setAttribute('aria-hidden', 'true');
    grip.title = 'Redimensionar';
    win.appendChild(grip);
    win.classList.add('is-movible');
    head.title = 'Arrastra para mover · doble clic para recolocar';

    var state = load();
    function maxW() { return Math.max(MIN_W, stage.clientWidth - 8); }
    function apply() {
      if (mq.matches || !state) { win.style.left = win.style.top = win.style.right = win.style.width = ''; return; }
      var w = Math.min(maxW(), Math.max(MIN_W, state.w || win.offsetWidth));
      win.style.width = w + 'px';
      win.style.right = 'auto';
      var x = Math.min(Math.max(0, state.x), Math.max(0, stage.clientWidth - win.offsetWidth));
      var y = Math.min(Math.max(0, state.y), Math.max(0, stage.clientHeight - 40));
      win.style.left = x + 'px';
      win.style.top = y + 'px';
    }
    function current() { return { x: win.offsetLeft, y: win.offsetTop, w: win.offsetWidth }; }

    function drag(e, mode) {
      if (mq.matches || e.button > 0) return;
      e.preventDefault();
      var start = current(), sx = e.clientX, sy = e.clientY;
      state = start;
      win.classList.add(mode === 'move' ? 'is-moviendo' : 'is-redimensionando');
      try { e.target.setPointerCapture(e.pointerId); } catch (err) {}
      function onMove(ev) {
        var dx = ev.clientX - sx, dy = ev.clientY - sy;
        state = mode === 'move' ? { x: start.x + dx, y: start.y + dy, w: start.w } : { x: start.x, y: start.y, w: start.w + dx };
        apply();
      }
      function onUp() {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        document.removeEventListener('pointercancel', onUp);
        win.classList.remove('is-moviendo', 'is-redimensionando');
        state = current();
        save(state);
      }
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
      document.addEventListener('pointercancel', onUp);
    }

    head.addEventListener('pointerdown', function (e) {
      if (e.target.closest('button,a,input,select')) return;
      drag(e, 'move');
    });
    grip.addEventListener('pointerdown', function (e) { drag(e, 'resize'); });
    head.addEventListener('dblclick', function (e) {
      if (e.target.closest('button,a')) return;
      state = null; clear(); apply();
    });
    window.addEventListener('resize', apply);
    if (mq.addEventListener) mq.addEventListener('change', apply);
    // Al abrirse el player (hidden → visible) se recoloca dentro del mapa.
    new MutationObserver(function () { if (!win.hidden) apply(); }).observe(win, { attributes: true, attributeFilter: ['hidden'] });
    apply();
  });
})();
