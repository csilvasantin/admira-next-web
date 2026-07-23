(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AdmiraPresentationShareGuardian = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var PROTOCOL = 'admira-presentation-share-guardian-v1';
  var DISCLAIMER = 'El navegador solo informa de la superficie elegida para esta captura; no puede verificar otras ventanas ni garantizar qué ve el público.';
  var DISPLAY_SURFACES = ['browser', 'window', 'monitor', 'application'];

  function finite(value, fallback) {
    value = Number(value);
    return Number.isFinite(value) ? value : fallback;
  }

  function create(options) {
    options = options || {};
    var role = options.role === 'audience' ? 'audience' : 'presenter';
    var navigatorObject = options.navigator || (typeof navigator !== 'undefined' ? navigator : null);
    var BroadcastChannelConstructor = options.BroadcastChannel || (typeof BroadcastChannel === 'function' ? BroadcastChannel : null);
    var now = typeof options.now === 'function' ? options.now : Date.now;
    var setIntervalFunction = options.setInterval || (typeof setInterval === 'function' ? setInterval : null);
    var clearIntervalFunction = options.clearInterval || (typeof clearInterval === 'function' ? clearInterval : null);
    var onChange = typeof options.onChange === 'function' ? options.onChange : function () {};
    var heartbeatMs = Math.max(250, finite(options.heartbeatMs, 2000));
    var freshnessMs = Math.max(heartbeatMs, finite(options.freshnessMs, heartbeatMs * 2.5));
    var channelName = String(options.channelName || 'admira-presenter-share-guardian');
    var mediaDevices = navigatorObject && navigatorObject.mediaDevices;
    var supported = Boolean(mediaDevices && typeof mediaDevices.getDisplayMedia === 'function');
    var channel = null;
    var timer = null;
    var sequence = 0;
    var lastAckAt = null;
    var lastAckSequence = null;
    var stream = null;
    var track = null;
    var trackListeners = [];
    var capture = {
      support: supported ? 'supported' : 'unsupported',
      permission: 'not-requested',
      phase: supported ? 'idle' : 'unsupported',
      trackState: 'none',
      displaySurface: 'unknown',
      selectionReported: false,
      failure: supported ? null : 'display-capture-unsupported'
    };

    function audienceState(at) {
      if (!BroadcastChannelConstructor) {
        return {transport: 'unsupported', status: 'unsupported', lastAckAt: null, ageMs: null, freshnessMs: freshnessMs};
      }
      if (role === 'audience') {
        return {transport: 'available', status: channel ? 'ready' : 'waiting', lastAckAt: null, ageMs: null, freshnessMs: freshnessMs};
      }
      if (lastAckAt === null) {
        return {transport: 'available', status: 'waiting', lastAckAt: null, ageMs: null, freshnessMs: freshnessMs};
      }
      var age = Math.max(0, finite(at, now()) - lastAckAt);
      return {
        transport: 'available',
        status: age <= freshnessMs ? 'fresh' : 'stale',
        lastAckAt: lastAckAt,
        ageMs: age,
        freshnessMs: freshnessMs
      };
    }

    function getState(at) {
      return {
        role: role,
        capture: {
          support: capture.support,
          permission: capture.permission,
          phase: capture.phase,
          trackState: capture.trackState,
          displaySurface: capture.displaySurface,
          selectionReported: capture.selectionReported,
          failure: capture.failure
        },
        audience: audienceState(at),
        assurance: {
          canVerifyExternalWindows: false,
          message: DISCLAIMER
        }
      };
    }

    function notify() {
      try {
        onChange(getState());
      } catch (_) {
        // Consumer rendering must never break capture tracking.
      }
    }

    function removeTrackListeners() {
      if (!track || typeof track.removeEventListener !== 'function') {
        trackListeners = [];
        return;
      }
      trackListeners.forEach(function (entry) {
        track.removeEventListener(entry[0], entry[1]);
      });
      trackListeners = [];
    }

    function readDisplaySurface(mediaTrack) {
      if (!mediaTrack || typeof mediaTrack.getSettings !== 'function') return 'unknown';
      var value = String(mediaTrack.getSettings().displaySurface || '').toLowerCase();
      return DISPLAY_SURFACES.indexOf(value) >= 0 ? value : 'unknown';
    }

    function setTrackState(nextState, phase) {
      capture.trackState = nextState;
      capture.phase = phase;
      notify();
    }

    function bindTrack(mediaTrack) {
      removeTrackListeners();
      track = mediaTrack;
      var onMute = function () {
        if (track && track.readyState !== 'ended') setTrackState('muted', 'muted');
      };
      var onUnmute = function () {
        if (track && track.readyState !== 'ended') setTrackState('live', 'live');
      };
      var onEnded = function () {
        capture.trackState = 'ended';
        capture.phase = 'ended';
        notify();
      };
      if (typeof mediaTrack.addEventListener === 'function') {
        [['mute', onMute], ['unmute', onUnmute], ['ended', onEnded]].forEach(function (entry) {
          mediaTrack.addEventListener(entry[0], entry[1]);
          trackListeners.push(entry);
        });
      }
      capture.trackState = mediaTrack.readyState === 'ended' ? 'ended' : (mediaTrack.muted ? 'muted' : 'live');
      capture.phase = capture.trackState === 'ended' ? 'ended' : (capture.trackState === 'muted' ? 'muted' : 'live');
      capture.displaySurface = readDisplaySurface(mediaTrack);
      capture.selectionReported = capture.displaySurface !== 'unknown';
    }

    function isExplicitUserGesture(event) {
      if (typeof options.isUserGesture === 'function') return options.isUserGesture(event) === true;
      var activation = navigatorObject && navigatorObject.userActivation;
      if (activation && typeof activation.isActive === 'boolean') return activation.isActive === true;
      return Boolean(event && event.isTrusted === true);
    }

    function requestShareFromGesture(event) {
      if (!supported) {
        capture.failure = 'display-capture-unsupported';
        notify();
        return Promise.reject(errorWithCode('La captura de pantalla no está soportada.', 'display-capture-unsupported'));
      }
      if (!isExplicitUserGesture(event)) {
        capture.phase = 'idle';
        capture.failure = 'explicit-user-gesture-required';
        notify();
        return Promise.reject(errorWithCode('Selecciona la superficie desde una acción explícita.', 'explicit-user-gesture-required'));
      }

      capture.phase = 'requesting';
      capture.permission = 'not-requested';
      capture.failure = null;
      notify();
      var request;
      try {
        // Keep this call synchronous with the verified user gesture.
        request = mediaDevices.getDisplayMedia({video: true, audio: false});
      } catch (error) {
        return failCapture(error);
      }
      return Promise.resolve(request).then(function (nextStream) {
        var tracks = nextStream && typeof nextStream.getVideoTracks === 'function' ? nextStream.getVideoTracks() : [];
        if (!tracks.length) {
          stopTracks(nextStream);
          throw errorWithCode('La selección no devolvió una pista de vídeo.', 'no-video-track');
        }
        if (stream && stream !== nextStream) stopTracks(stream);
        stream = nextStream;
        capture.permission = 'granted';
        capture.failure = null;
        bindTrack(tracks[0]);
        notify();
        return {stream: stream, state: getState()};
      }).catch(function (error) {
        return failCapture(error);
      });
    }

    function failCapture(error) {
      var name = String(error && error.name || '');
      var explicitCode = String(error && error.code || '');
      capture.permission = name === 'NotAllowedError' ? 'denied-or-dismissed' : capture.permission;
      capture.phase = name === 'NotAllowedError' ? 'not-authorized' : 'error';
      capture.trackState = 'none';
      capture.displaySurface = 'unknown';
      capture.selectionReported = false;
      capture.failure = explicitCode || (name === 'NotAllowedError' ? 'permission-denied-or-dismissed' : 'capture-failed');
      notify();
      return Promise.reject(error);
    }

    function stopTracks(mediaStream) {
      if (!mediaStream || typeof mediaStream.getTracks !== 'function') return;
      mediaStream.getTracks().forEach(function (mediaTrack) {
        if (mediaTrack && typeof mediaTrack.stop === 'function') mediaTrack.stop();
      });
    }

    function stopShare() {
      var activeStream = stream;
      removeTrackListeners();
      stream = null;
      track = null;
      stopTracks(activeStream);
      capture.phase = supported ? 'idle' : 'unsupported';
      capture.permission = 'not-requested';
      capture.trackState = 'none';
      capture.displaySurface = 'unknown';
      capture.selectionReported = false;
      capture.failure = null;
      notify();
    }

    function post(message) {
      if (channel) channel.postMessage(message);
    }

    function heartbeat() {
      if (role !== 'presenter' || !channel) return;
      sequence += 1;
      post({protocol: PROTOCOL, type: 'audience-probe', sequence: sequence, sentAt: now()});
      notify();
    }

    function receive(event) {
      var message = event && event.data;
      if (!message || message.protocol !== PROTOCOL) return;
      if (role === 'audience' && message.type === 'audience-probe' && Number.isFinite(Number(message.sequence))) {
        post({protocol: PROTOCOL, type: 'audience-ack', sequence: Number(message.sequence), sentAt: now()});
        return;
      }
      if (role === 'presenter' && message.type === 'audience-ack' && Number.isFinite(Number(message.sequence))) {
        var acknowledged = Number(message.sequence);
        if (acknowledged <= finite(lastAckSequence, -1) || acknowledged > sequence) return;
        lastAckSequence = acknowledged;
        lastAckAt = now();
        notify();
      }
    }

    function start() {
      if (channel || !BroadcastChannelConstructor) {
        notify();
        return getState();
      }
      channel = new BroadcastChannelConstructor(channelName);
      if (typeof channel.addEventListener === 'function') channel.addEventListener('message', receive);
      else channel.onmessage = receive;
      if (role === 'presenter') {
        heartbeat();
        if (setIntervalFunction) timer = setIntervalFunction(heartbeat, heartbeatMs);
      } else {
        notify();
      }
      return getState();
    }

    function stop() {
      if (timer !== null && clearIntervalFunction) clearIntervalFunction(timer);
      timer = null;
      if (channel) {
        if (typeof channel.removeEventListener === 'function') channel.removeEventListener('message', receive);
        else if (channel.onmessage === receive) channel.onmessage = null;
        if (typeof channel.close === 'function') channel.close();
      }
      channel = null;
      notify();
    }

    function destroy() {
      stop();
      stopShare();
    }

    return {
      getState: getState,
      requestShareFromGesture: requestShareFromGesture,
      stopShare: stopShare,
      start: start,
      stop: stop,
      destroy: destroy
    };
  }

  function errorWithCode(message, code) {
    var error = new Error(message);
    error.code = code;
    return error;
  }

  return {
    create: create,
    protocol: PROTOCOL,
    disclaimer: DISCLAIMER
  };
}));
