(function () {
  'use strict';

  var query = new URLSearchParams(location.search);
  var fragment = new URLSearchParams(location.hash.slice(1));
  var fallbackDeck = String(query.get('deck') || '');
  var safeFallbackDeck = /^\/presentaciones\/[^?#\u0000-\u001f]+\/presentacion(?:\.html)?\/?$/.test(fallbackDeck);
  var pairing = document.getElementById('remotePairing');
  var secretInput = document.getElementById('remoteSecret');
  var controlsPanel = document.getElementById('remoteControls');
  var connection = document.getElementById('remoteConnection');
  var privacy = document.getElementById('remotePrivacy');
  var slide = document.getElementById('remoteSlide');
  var clock = document.getElementById('remoteClock');
  var pace = document.getElementById('remotePace');
  var timer = document.getElementById('remoteTimer');
  var timerReset = document.getElementById('remoteTimerReset');
  var controls = Array.prototype.slice.call(controlsPanel.querySelectorAll('button'));
  var remoteSession = null;
  var pollTimer = 0;
  var pollBusy = false;
  var commandBusy = false;
  var commandSequence = 0;
  var lastStateSequence = 0;
  var pendingCommands = [];
  var localChannel = null;
  var localChannelName = '';
  var localSequence = 0;
  var lastStageSignalAt = 0;

  function setEnabled(enabled) {
    controls.forEach(function (button) { button.disabled = !enabled; });
  }

  function setConnection(label, className) {
    connection.textContent = label;
    connection.className = className;
  }

  function formatTime(seconds) {
    seconds = Math.max(0, Math.floor(Number(seconds) || 0));
    return String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');
  }

  function validPart(value, max) {
    return typeof value === 'string' && value.length > 0 && value.length <= max && /^[A-Za-z0-9._~-]+$/.test(value);
  }

  function apiBase(client) {
    return '/presentaciones/' + encodeURIComponent(client) + '/api/remote';
  }

  async function request(path, options) {
    var response = await fetch(path, Object.assign({credentials: 'same-origin'}, options || {}));
    var body = null;
    if (response.status !== 204) {
      try { body = await response.json(); } catch (_) {}
    }
    if (!response.ok) {
      var error = new Error(body && body.error || 'remote_request_failed');
      error.code = body && body.error || 'remote_request_failed';
      error.status = response.status;
      throw error;
    }
    return body;
  }

  function terminalError(error) {
    return error && (error.status === 410 || error.code === 'expired' || error.code === 'revoked');
  }

  function stopNetwork(label) {
    clearTimeout(pollTimer);
    pollTimer = 0;
    remoteSession = null;
    pendingCommands.length = 0;
    setEnabled(false);
    setConnection(label, 'is-offline');
  }

  function renderState(state) {
    if (!state || !Number.isSafeInteger(Number(state.seq)) || Number(state.seq) <= lastStateSequence) return;
    lastStateSequence = Number(state.seq);
    var index = Math.max(0, Math.floor(Number(state.index) || 0));
    var count = Math.max(index + 1, Math.floor(Number(state.count) || 0));
    slide.textContent = (index + 1) + ' / ' + count;
    clock.textContent = formatTime(state.elapsed);
    var paceLabels = {ready: 'Listo', 'on-time': 'En ritmo', ahead: 'Vas por delante', behind: 'Conviene acelerar'};
    pace.textContent = paceLabels[state.paceLabel] || (state.running ? 'En curso' : 'En pausa');
    timer.textContent = state.running ? 'Pausar tiempo' : (Number(state.elapsed) > 0 ? 'Continuar tiempo' : 'Iniciar tiempo');
    var acknowledged = Math.max(0, Math.floor(Number(state.ackCommandSeq) || 0));
    pendingCommands = pendingCommands.filter(function (item) { return item.seq > acknowledged; });
    setEnabled(true);
    setConnection(pendingCommands.length ? '● Conectado · aplicando orden…' : '● Conectado', 'is-online');
  }

  function schedulePoll(delay) {
    clearTimeout(pollTimer);
    if (!remoteSession) return;
    pollTimer = setTimeout(pollState, Math.max(0, Number(delay) || 0));
  }

  async function pollState() {
    pollTimer = 0;
    if (!remoteSession || pollBusy) return;
    pollBusy = true;
    var session = remoteSession;
    try {
      var data = await request(apiBase(session.client) + '/sessions/' + encodeURIComponent(session.sessionId) + '/state', {
        headers: {'authorization': 'Bearer ' + session.remoteToken}
      });
      if (data && data.revoked) {
        stopNetwork('Sesión revocada');
        return;
      }
      renderState(data && data.state);
      session.failureCount = 0;
    } catch (error) {
      if (terminalError(error)) {
        stopNetwork(error.code === 'expired' ? 'Sesión caducada' : 'Sesión revocada');
        return;
      }
      session.failureCount += 1;
      setEnabled(false);
      setConnection(error && error.status === 429 ? 'Demasiadas peticiones · reintentando…' : 'Reconectando…', 'is-waiting');
    } finally {
      pollBusy = false;
      if (remoteSession === session) {
        schedulePoll(Math.min(8000, session.pollAfterMs * Math.pow(2, Math.min(session.failureCount, 3))));
      }
    }
  }

  async function flushCommands() {
    if (!remoteSession || commandBusy || !pendingCommands.length) return;
    var item = pendingCommands.find(function (pending) { return !pending.sent; });
    if (!item) return;
    commandBusy = true;
    var session = remoteSession;
    try {
      await request(apiBase(session.client) + '/sessions/' + encodeURIComponent(session.sessionId) + '/commands', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer ' + session.remoteToken,
          'content-type': 'application/json'
        },
        body: JSON.stringify(item.index === undefined
          ? {seq: item.seq, command: item.command}
          : {seq: item.seq, command: item.command, index: item.index})
      });
      item.sent = true;
      setConnection('● Orden enviada · esperando escenario', 'is-online');
    } catch (error) {
      if (terminalError(error)) {
        stopNetwork(error.code === 'expired' ? 'Sesión caducada' : 'Sesión revocada');
        return;
      }
      if (error && error.status === 409 && error.code === 'stale_seq') {
        pendingCommands = pendingCommands.filter(function (pending) { return pending !== item; });
      }
      setConnection('Orden pendiente · reintentando…', 'is-waiting');
      await new Promise(function (resolve) { setTimeout(resolve, session.pollAfterMs); });
    } finally {
      commandBusy = false;
      if (remoteSession === session && pendingCommands.some(function (pending) { return !pending.sent; })) flushCommands();
    }
  }

  function sendNetworkCommand(command, index) {
    if (!remoteSession || ['prev', 'next', 'skip', 'timer-toggle', 'timer-reset'].indexOf(command) < 0) return;
    var item = {seq: ++commandSequence, command: command, sent: false};
    if (command === 'skip' && Number.isSafeInteger(Number(index))) item.index = Number(index);
    pendingCommands.push(item);
    setEnabled(false);
    flushCommands();
  }

  async function pair(client, sessionId, pairingSecret) {
    if (!validPart(client, 128) || !validPart(sessionId, 256) || !validPart(pairingSecret, 512)) {
      setConnection('Datos de emparejamiento no válidos', 'is-offline');
      pairing.hidden = false;
      return;
    }
    pairing.hidden = true;
    setConnection('Emparejando de forma segura…', 'is-waiting');
    try {
      var data = await request(apiBase(client) + '/sessions/' + encodeURIComponent(sessionId) + '/pair', {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify({pairingSecret: pairingSecret})
      });
      if (!data || !data.remoteToken) throw new Error('invalid_pair_contract');
      remoteSession = {
        client: client,
        sessionId: String(data.sessionId || sessionId),
        remoteToken: String(data.remoteToken),
        pollAfterMs: Math.max(500, Math.min(5000, Number(data.pollAfterMs) || 750)),
        failureCount: 0
      };
      secretInput.value = '';
      controlsPanel.hidden = false;
      privacy.textContent = 'Emparejado. Este mando recibe únicamente estado mínimo y envía órdenes allowlisted; el token vive solo en la memoria de esta pestaña.';
      setEnabled(false);
      schedulePoll(0);
    } catch (error) {
      pairing.hidden = false;
      setConnection(
        error && error.code === 'already_paired' ? 'Código ya utilizado · crea una sesión nueva en el escenario' :
          terminalError(error) ? 'Sesión caducada o revocada' : 'No se pudo emparejar',
        'is-offline'
      );
    }
  }

  function sendLocal(type, command) {
    if (!localChannelName) return;
    var payload = {
      source: 'remote',
      type: type,
      command: command,
      messageId: 'remote:' + Date.now() + ':' + (++localSequence)
    };
    if (localChannel) localChannel.postMessage(payload);
    try { localStorage.setItem(localChannelName, JSON.stringify(Object.assign({nonce: Date.now()}, payload))); } catch (_) {}
  }

  function receiveLocal(payload) {
    if (!payload || payload.source !== 'stage' || payload.type !== 'state') return;
    lastStageSignalAt = Date.now();
    renderState({
      seq: lastStageSignalAt,
      index: payload.index,
      count: payload.slideCount,
      elapsed: payload.elapsed,
      running: payload.running,
      paceLabel: payload.pace,
      ackCommandSeq: 0
    });
    setConnection('● Fallback local · mismo navegador', 'is-online');
  }

  function startLocalFallback() {
    localChannelName = 'admira-presenter:' + fallbackDeck;
    localChannel = typeof BroadcastChannel === 'function' ? new BroadcastChannel(localChannelName) : null;
    controlsPanel.hidden = false;
    privacy.textContent = 'Modo degradado: este control solo funciona en otra pestaña del mismo navegador. No conecta dispositivos distintos.';
    setEnabled(false);
    setConnection('Fallback local · esperando escenario…', 'is-waiting');
    if (localChannel) localChannel.addEventListener('message', function (event) { receiveLocal(event.data); });
    addEventListener('storage', function (event) {
      if (event.key !== localChannelName || !event.newValue) return;
      try { receiveLocal(JSON.parse(event.newValue)); } catch (_) {}
    });
    sendLocal('ready', '');
    setInterval(function () {
      if (lastStageSignalAt && Date.now() - lastStageSignalAt <= 4000) return;
      setEnabled(false);
      setConnection('Fallback local · reconectando…', 'is-waiting');
      sendLocal('ready', '');
    }, 1500);
  }

  document.querySelectorAll('[data-command]').forEach(function (button) {
    button.addEventListener('click', function () {
      if (remoteSession) sendNetworkCommand(button.dataset.command);
      else sendLocal('command', button.dataset.command);
    });
  });
  timer.addEventListener('click', function () {
    if (remoteSession) sendNetworkCommand('timer-toggle');
    else sendLocal('command', 'timer-toggle');
  });
  timerReset.addEventListener('click', function () {
    if (remoteSession) sendNetworkCommand('timer-reset');
    else sendLocal('command', 'timer-reset');
  });
  pairing.addEventListener('submit', function (event) {
    event.preventDefault();
    var parts = secretInput.value.trim().split(':');
    if (parts.length !== 3) {
      setConnection('Código completo no válido', 'is-offline');
      return;
    }
    pair(parts[0], parts[1], parts[2]);
  });
  addEventListener('pagehide', function () {
    clearTimeout(pollTimer);
    if (localChannel) localChannel.close();
    remoteSession = null;
  }, {once: true});

  setEnabled(false);
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  if (safeFallbackDeck) {
    startLocalFallback();
    return;
  }
  var fragmentClient = String(fragment.get('client') || '');
  var fragmentSession = String(fragment.get('session') || '');
  var fragmentSecret = String(fragment.get('pair') || '');
  if (fragmentClient && fragmentSession && fragmentSecret) {
    pair(fragmentClient, fragmentSession, fragmentSecret);
    return;
  }
  pairing.hidden = false;
  setConnection('Introduce el código mostrado en el escenario', 'is-waiting');
}());
