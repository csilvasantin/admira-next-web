(function (G) {
  'use strict';
  // Salas que la app nombró en la visita del 29 oct 2026. La captura 3D no las rotula.
  var NAMED = [
    {id:'cocina', name:'Cocina'},
    {id:'terraza', name:'Terraza'},
    {id:'pasillo', name:'Pasillo'}
  ];
  var BRIDGE = 'http://127.0.0.1:8765';
  var STATE_OK = /^[a-z0-9_]{1,40}$/;

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

  function bannerMessage(view, link) {
    if (view && view.connected) return t('CONECTADO', 'CONNECTED');
    if (link && link.live) return t('RESPUESTA LEÍDA / SIN POSE', 'RESPONSE READ / NO POSE');
    return t('SIMULACIÓN / SIN CONEXIÓN', 'SIMULATION / NO CONNECTION');
  }

  function buttonLabel(kind, outcome) {
    if (outcome && outcome.ok) {
      return kind === 'charge'
        ? t('Volver a la base', 'Return to dock')
        : t('Salir', 'Leave dock');
    }
    return kind === 'charge'
      ? t('Volver a la base · sin conexión', 'Return to dock · no connection')
      : t('Salir · sin conexión', 'Leave dock · no connection');
  }

  function failureStatus(kind) {
    return kind === 'charge'
      ? t('Sin conexión. Volver a la base no se ha enviado.', 'No connection. Return to dock was not sent.')
      : t('Sin conexión. Salir no se ha enviado.', 'No connection. Leave dock was not sent.');
  }

  function readOutcome(kind, response) {
    var expected = kind === 'charge' ? 'app_charge' : 'app_start';
    var body = response && response.body;
    if (!response || response.status !== 200 || !body || body.ok !== true || body.command !== expected) return null;
    if (typeof body.state !== 'string' || !STATE_OK.test(body.state)) return null;
    var outcome = {ok: true, command: expected, state: body.state};
    if (typeof body.battery === 'number' && Number.isInteger(body.battery) && body.battery >= 0 && body.battery <= 100) {
      outcome.battery = body.battery;
    }
    return outcome;
  }

  function outcomeStatus(outcome) {
    var line = t('Estado leído: ', 'State read: ') + outcome.state;
    if (typeof outcome.battery === 'number') line += t('. Batería: ', '. Battery: ') + outcome.battery;
    return line;
  }

  function ask(kind, fetchImpl) {
    var path = kind === 'charge' ? '/charge' : '/start';
    var fetcher = fetchImpl || G.fetch;
    if (typeof fetcher !== 'function') return Promise.resolve(null);
    return Promise.resolve().then(function () {
      return fetcher(BRIDGE + path, {
        method: 'POST',
        mode: 'cors',
        cache: 'no-store',
        headers: {'Content-Type': 'application/json'},
        body: '{}'
      });
    }).then(function (response) {
      if (!response || response.status !== 200 || typeof response.json !== 'function') return null;
      return response.json().then(function (body) {
        return readOutcome(kind, {status: 200, body: body});
      }, function () {return null;});
    }, function () {return null;});
  }

  function mount(root, options) {
    var api = create(options || {connected: false});
    var fetchImpl = options && options.fetch;
    var banner = root.querySelector('#limpieza-banner');
    var estado = root.querySelector('#limpieza-estado');
    var senal = root.querySelector('#limpieza-senal');
    var salir = root.querySelector('#limpieza-salir');
    var base = root.querySelector('#limpieza-base');
    var salirEstado = root.querySelector('#limpieza-salir-estado');
    var baseEstado = root.querySelector('#limpieza-base-estado');
    var last = {start: null, charge: null};
    var tried = {start: false, charge: false};

    function paint() {
      var view = api.view();
      var live = !!(last.start || last.charge);
      if (banner) banner.textContent = bannerMessage(view, {live: live});
      if (estado) estado.textContent = statusMessage(view);
      if (senal) senal.textContent = cameraMessage(view);
      if (salir) salir.textContent = buttonLabel('start', last.start);
      if (base) base.textContent = buttonLabel('charge', last.charge);
      if (salirEstado) salirEstado.textContent = last.start ? outcomeStatus(last.start) : (tried.start ? failureStatus('start') : '');
      if (baseEstado) baseEstado.textContent = last.charge ? outcomeStatus(last.charge) : (tried.charge ? failureStatus('charge') : '');
    }

    function wire(button, kind) {
      if (!button) return;
      button.addEventListener('click', function (event) {
        event.preventDefault();
        if (button.disabled) return;
        button.disabled = true;
        ask(kind, fetchImpl).then(function (outcome) {
          tried[kind] = true;
          last[kind] = outcome;
          button.disabled = false;
          paint();
        });
      });
    }

    root.querySelectorAll('[data-sala], #limpieza-parar').forEach(function (button) {
      button.disabled = !api.view().connected;
      button.addEventListener('click', function (event) {
        event.preventDefault();
        api.goToRoom(button.getAttribute('data-sala'));
        paint();
      });
    });
    wire(salir, 'start');
    wire(base, 'charge');
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
    buttonLabel: buttonLabel,
    failureStatus: failureStatus,
    readOutcome: readOutcome,
    outcomeStatus: outcomeStatus,
    ask: ask,
    mount: mount,
    t: t
  };
  if (G.document && G.document.getElementById && G.document.getElementById('limpieza')) {
    var boot = function () {mount(G.document.getElementById('limpieza'), {connected: false});};
    if (G.document.readyState === 'loading') G.document.addEventListener('DOMContentLoaded', boot);
    else boot();
  }
})(typeof window !== 'undefined' ? window : globalThis);
