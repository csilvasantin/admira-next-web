(function (G) {
  'use strict';
  // Salas que la app nombró en la visita del 29 oct 2026. La captura 3D no las rotula.
  var NAMED = [
    {id:'cocina', name:'Cocina'},
    {id:'terraza', name:'Terraza'},
    {id:'pasillo', name:'Pasillo'}
  ];

  function t(es, en) {
    var doc = G.document && G.document.documentElement;
    var lang = doc && doc.getAttribute ? doc.getAttribute('lang') : '';
    return /^en/i.test(lang || '') ? en : es;
  }

  function create(options) {
    var pose = options && options.connected && options.pose ? options.pose : null;
    var connected = !!pose;
    return {
      rooms: function () {return NAMED;},
      goToRoom: function () {return false;},
      stop: function () {},
      view: function () {
        return {connected: connected, pose: pose, cameraConnected: false};
      }
    };
  }

  function statusMessage(view) {
    if (!view || !view.connected || !view.pose) return t('Sin conexión. No hay pose leída.', 'No connection. No pose has been read.');
    return t('Pose leída.', 'Pose read.');
  }

  function cameraMessage(view) {
    return view && view.cameraConnected ? t('Cámara conectada', 'Camera connected') : t('Cámara no conectada', 'Camera not connected');
  }

  function bannerMessage(view) {
    if (!view || !view.connected) return t('SIMULACIÓN / SIN CONEXIÓN', 'SIMULATION / NO CONNECTION');
    return t('CONECTADO', 'CONNECTED');
  }

  function mount(root, options) {
    var api = create(options || {connected: false});
    var banner = root.querySelector('#limpieza-banner');
    var estado = root.querySelector('#limpieza-estado');
    var senal = root.querySelector('#limpieza-senal');
    function paint() {
      var view = api.view();
      if (banner) banner.textContent = bannerMessage(view);
      if (estado) estado.textContent = statusMessage(view);
      if (senal) senal.textContent = cameraMessage(view);
    }
    root.querySelectorAll('[data-sala], #limpieza-parar').forEach(function (button) {
      button.disabled = !api.view().connected;
      button.addEventListener('click', function (event) {
        event.preventDefault();
        api.goToRoom(button.getAttribute('data-sala'));
        paint();
      });
    });
    if (G.addEventListener) G.addEventListener('admira:languagechange', paint);
    paint();
    return api;
  }

  G.AdmiraLimpieza = {
    rooms: NAMED,
    create: create,
    statusMessage: statusMessage,
    cameraMessage: cameraMessage,
    bannerMessage: bannerMessage,
    mount: mount,
    t: t
  };
  if (G.document && G.document.getElementById && G.document.getElementById('limpieza')) {
    var boot = function () {mount(G.document.getElementById('limpieza'), {connected: false});};
    if (G.document.readyState === 'loading') G.document.addEventListener('DOMContentLoaded', boot);
    else boot();
  }
})(typeof window !== 'undefined' ? window : globalThis);
