(function () {
  'use strict';
  // Pantalla completa para los vídeos de lámina (sala y web de la presentación).
  // - Fullscreen API sobre el contenedor [data-video-frame] (prefijo webkit para Safari).
  // - iPhone (sin Fullscreen API en elementos): webkitEnterFullscreen() del propio <video>.
  // - Esc sale (lo gestiona el navegador). No toca la tecla F ni ningún atajo de la sala.
  // - Al estar a pantalla completa se activan los controles nativos del vídeo.
  var LABELS = {
    es: 'Pantalla completa',
    ca: 'Pantalla completa',
    en: 'Full screen'
  };

  function currentElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || null;
  }

  function label() {
    var lang = String(document.documentElement.getAttribute('lang') || 'es').slice(0, 2).toLowerCase();
    return LABELS[lang] || LABELS.es;
  }

  function buttons() {
    return Array.prototype.slice.call(document.querySelectorAll('[data-video-fullscreen]'));
  }

  function frameOf(button) {
    return button.closest('[data-video-frame]');
  }

  function videoOf(frame) {
    return frame && frame.querySelector('video');
  }

  function swallow(result) {
    if (result && typeof result.catch === 'function') result.catch(function () {});
  }

  function enter(frame) {
    var video = videoOf(frame);
    var request = frame.requestFullscreen || frame.webkitRequestFullscreen;
    if (request) {
      try { swallow(request.call(frame)); return; } catch (_) {}
    }
    if (video && typeof video.webkitEnterFullscreen === 'function') {
      try { video.webkitEnterFullscreen(); } catch (_) {}
    }
  }

  function exit() {
    var close = document.exitFullscreen || document.webkitExitFullscreen;
    if (close) {
      try { swallow(close.call(document)); } catch (_) {}
    }
  }

  function sync() {
    var active = currentElement();
    var text = label();
    buttons().forEach(function (button) {
      var frame = frameOf(button);
      var on = Boolean(frame && active === frame);
      button.setAttribute('aria-pressed', String(on));
      button.setAttribute('aria-label', text);
      button.setAttribute('title', text + ' · Esc');
    });
    Array.prototype.slice.call(document.querySelectorAll('[data-video-frame]')).forEach(function (frame) {
      var video = videoOf(frame);
      if (!video) return;
      if (active === frame) {
        video.setAttribute('controls', '');
        video.setAttribute('controlslist', 'nofullscreen');
      } else if (frame.classList.contains('slide-media')) {
        // En la lámina a sangre los controles nativos sólo se usan a pantalla completa.
        video.removeAttribute('controls');
      }
    });
  }

  document.addEventListener('click', function (event) {
    var button = event.target && event.target.closest && event.target.closest('[data-video-fullscreen]');
    if (!button) return;
    var frame = frameOf(button);
    if (!frame) return;
    event.preventDefault();
    if (currentElement() === frame) exit();
    else enter(frame);
  });

  document.addEventListener('fullscreenchange', sync);
  document.addEventListener('webkitfullscreenchange', sync);
  if (window.MutationObserver) {
    new MutationObserver(sync).observe(document.documentElement, {attributes: true, attributeFilter: ['lang']});
  }
  sync();

  window.AdmiraVideoFullscreen = Object.freeze({enter: enter, exit: exit, sync: sync});
})();
