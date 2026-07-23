(function (root, factory) {
  var api = factory(root || {});
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AdmiraProductionBackchannel = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  var VERSION = 1;
  var PRIORITIES = ['normal', 'high', 'urgent'];
  var ROLES = ['presenter', 'operator'];
  var DEFAULT_TTL_MS = 30000;
  var MIN_TTL_MS = 1000;
  var MAX_TTL_MS = 300000;
  var MAX_TEXT_LENGTH = 500;
  var MAX_CHANNEL_LENGTH = 80;
  var MAX_CUES = 100;
  var MAX_SEEN_MESSAGES = 512;
  var MESSAGE_MARKER = 'admira-production-backchannel-v1';
  var CHANNEL_PREFIX = 'admira-production-backchannel:v1:';
  var STORAGE_PREFIX = 'admira.production-backchannel.signal.v1.';
  var fallbackHubs = Object.create(null);
  var sequence = 0;

  function own(object, key) {
    return Object.prototype.hasOwnProperty.call(object, key);
  }

  function isRecord(value) {
    return value !== null && typeof value === 'object' &&
      Object.prototype.toString.call(value) === '[object Object]';
  }

  function hasOnlyDataFields(value, allowed, required) {
    if (!isRecord(value)) return false;
    var descriptors;
    try {
      descriptors = Object.getOwnPropertyDescriptors(value);
    } catch (_) {
      return false;
    }
    if (Object.getOwnPropertySymbols(value).length) return false;
    var keys = Object.keys(descriptors);
    if (keys.some(function (key) {
      return allowed.indexOf(key) < 0 ||
        own(descriptors[key], 'get') || own(descriptors[key], 'set');
    })) return false;
    return required.every(function (key) { return own(descriptors, key); });
  }

  function validIdentifier(value, maxLength) {
    return typeof value === 'string' && value.length > 0 && value.length <= maxLength &&
      /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value);
  }

  function finiteInteger(value) {
    return typeof value === 'number' && Number.isFinite(value) && Math.floor(value) === value;
  }

  function copyCue(cue) {
    return {
      id: cue.id,
      text: cue.text,
      priority: cue.priority,
      createdAt: cue.createdAt,
      expiresAt: cue.expiresAt,
      status: cue.status
    };
  }

  function normalizeOutgoingCue(input) {
    if (!hasOnlyDataFields(input, ['text', 'priority', 'ttlMs'], ['text'])) {
      throw new TypeError('sendCue only accepts text, priority and ttlMs data fields.');
    }
    if (typeof input.text !== 'string') throw new TypeError('Cue text must be a string.');
    var text = input.text.trim();
    if (!text || text.length > MAX_TEXT_LENGTH || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(text)) {
      throw new RangeError('Cue text must contain 1 to ' + MAX_TEXT_LENGTH + ' safe characters.');
    }
    var priority = own(input, 'priority') && input.priority !== undefined ? input.priority : 'normal';
    if (PRIORITIES.indexOf(priority) < 0) {
      throw new RangeError('Cue priority must be normal, high or urgent.');
    }
    var ttlMs = own(input, 'ttlMs') && input.ttlMs !== undefined ? input.ttlMs : DEFAULT_TTL_MS;
    if (!finiteInteger(ttlMs) || ttlMs < MIN_TTL_MS || ttlMs > MAX_TTL_MS) {
      throw new RangeError('Cue ttlMs must be an integer between ' + MIN_TTL_MS + ' and ' + MAX_TTL_MS + '.');
    }
    return {text: text, priority: priority, ttlMs: ttlMs};
  }

  function validCue(cue) {
    return hasOnlyDataFields(
      cue,
      ['id', 'text', 'priority', 'createdAt', 'expiresAt', 'status'],
      ['id', 'text', 'priority', 'createdAt', 'expiresAt', 'status']
    ) &&
      validIdentifier(cue.id, 120) &&
      typeof cue.text === 'string' && cue.text.length > 0 && cue.text.length <= MAX_TEXT_LENGTH &&
      !/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(cue.text) &&
      PRIORITIES.indexOf(cue.priority) >= 0 &&
      finiteInteger(cue.createdAt) && finiteInteger(cue.expiresAt) &&
      cue.expiresAt - cue.createdAt >= MIN_TTL_MS &&
      cue.expiresAt - cue.createdAt <= MAX_TTL_MS &&
      cue.status === 'active';
  }

  function validEnvelope(message) {
    if (!hasOnlyDataFields(
      message,
      ['marker', 'version', 'type', 'channel', 'senderId', 'targetRole', 'messageId', 'cue', 'id', 'at'],
      ['marker', 'version', 'type', 'channel', 'senderId', 'targetRole', 'messageId', 'at']
    )) return false;
    if (message.marker !== MESSAGE_MARKER || message.version !== VERSION) return false;
    if (['cue', 'ack', 'hello'].indexOf(message.type) < 0) return false;
    if (!validIdentifier(message.channel, MAX_CHANNEL_LENGTH) ||
        !validIdentifier(message.senderId, 120) ||
        !validIdentifier(message.messageId, 120) ||
        ROLES.indexOf(message.targetRole) < 0 ||
        !finiteInteger(message.at)) return false;
    if (message.type === 'cue') return own(message, 'cue') && !own(message, 'id') && validCue(message.cue);
    if (message.type === 'ack') {
      return own(message, 'id') && !own(message, 'cue') && validIdentifier(message.id, 120);
    }
    return !own(message, 'cue') && !own(message, 'id');
  }

  function create(options) {
    options = options || {};
    if (!isRecord(options)) throw new TypeError('Backchannel options must be an object.');
    var role = options.role;
    var channelName = options.channelName;
    if (ROLES.indexOf(role) < 0) throw new RangeError('role must be presenter or operator.');
    if (!validIdentifier(channelName, MAX_CHANNEL_LENGTH)) {
      throw new RangeError('channelName must be 1 to ' + MAX_CHANNEL_LENGTH + ' URL-safe characters.');
    }

    var now = typeof options.now === 'function' ? options.now : Date.now;
    var schedule = typeof options.schedule === 'function'
      ? options.schedule
      : (typeof root.setTimeout === 'function' ? root.setTimeout.bind(root) : null);
    var cancel = typeof options.cancel === 'function'
      ? options.cancel
      : (typeof root.clearTimeout === 'function' ? root.clearTimeout.bind(root) : null);
    var BroadcastChannelConstructor = own(options, 'BroadcastChannel')
      ? options.BroadcastChannel
      : root.BroadcastChannel;
    var win = own(options, 'window') ? options.window : root.window;
    var storage = own(options, 'storage')
      ? options.storage
      : (function () {
          try { return win && win.localStorage; } catch (_) { return null; }
        }());
    var idFactory = typeof options.idFactory === 'function' ? options.idFactory : null;
    var senderId = makeId('peer');
    var transportChannel = CHANNEL_PREFIX + channelName;
    var storageKey = STORAGE_PREFIX + channelName;
    var cues = new Map();
    var listeners = [];
    var seenMessages = new Set();
    var seenOrder = [];
    var timer = null;
    var destroyed = false;
    var broadcastChannel = null;
    var memoryHub = null;
    var transport = 'memory';
    var removeWindowListeners = function () {};

    function time() {
      var value = Number(now());
      if (!Number.isFinite(value)) throw new Error('Backchannel clock returned a non-finite value.');
      return Math.floor(value);
    }

    function makeId(kind) {
      var candidate;
      if (idFactory) {
        candidate = idFactory(kind);
      } else {
        sequence += 1;
        var random = '';
        try {
          if (root.crypto && typeof root.crypto.randomUUID === 'function') {
            random = root.crypto.randomUUID().replace(/-/g, '');
          }
        } catch (_) {}
        candidate = kind + ':' + (random || (Date.now().toString(36) + ':' + sequence.toString(36)));
      }
      if (!validIdentifier(candidate, 120)) throw new Error('Generated backchannel id is invalid.');
      return candidate;
    }

    function remember(messageId) {
      if (seenMessages.has(messageId)) return false;
      seenMessages.add(messageId);
      seenOrder.push(messageId);
      if (seenOrder.length > MAX_SEEN_MESSAGES) {
        seenMessages.delete(seenOrder.shift());
      }
      return true;
    }

    function expireDue(announce) {
      var at = time();
      var changed = false;
      cues.forEach(function (cue) {
        if (cue.status === 'active' && cue.expiresAt <= at) {
          cue.status = 'expired';
          changed = true;
        }
      });
      if (changed && announce !== false) emit();
      scheduleExpiry();
      return changed;
    }

    function scheduleExpiry() {
      if (timer !== null && cancel) cancel(timer);
      timer = null;
      if (!schedule || destroyed) return;
      var at = time();
      var next = Infinity;
      cues.forEach(function (cue) {
        if (cue.status === 'active' && cue.expiresAt < next) next = cue.expiresAt;
      });
      if (next !== Infinity) {
        timer = schedule(function () {
          timer = null;
          if (!destroyed) expireDue(true);
        }, Math.max(0, next - at));
      }
    }

    function prune() {
      if (cues.size <= MAX_CUES) return;
      Array.from(cues.keys()).slice(0, cues.size - MAX_CUES).forEach(function (id) {
        cues.delete(id);
      });
    }

    function snapshotInternal(checkExpiry) {
      if (checkExpiry) expireDue(true);
      return {
        role: role,
        channelName: channelName,
        transport: transport,
        cues: Array.from(cues.values()).map(copyCue)
      };
    }

    function emit() {
      var state = snapshotInternal(false);
      listeners.slice().forEach(function (listener) {
        try { listener(state); } catch (_) {}
      });
    }

    function addCue(cue) {
      var existing = cues.get(cue.id);
      if (existing) {
        return existing.text === cue.text &&
          existing.priority === cue.priority &&
          existing.createdAt === cue.createdAt &&
          existing.expiresAt === cue.expiresAt;
      }
      cues.set(cue.id, copyCue(cue));
      prune();
      expireDue(false);
      emit();
      scheduleExpiry();
      return true;
    }

    function markAcknowledged(id) {
      var cue = cues.get(id);
      if (!cue) return false;
      expireDue(false);
      if (cue.status === 'expired') return false;
      if (cue.status === 'acknowledged') return true;
      cue.status = 'acknowledged';
      emit();
      scheduleExpiry();
      return true;
    }

    function envelope(type, targetRole, values) {
      var message = {
        marker: MESSAGE_MARKER,
        version: VERSION,
        type: type,
        channel: channelName,
        senderId: senderId,
        targetRole: targetRole,
        messageId: makeId('message'),
        at: time()
      };
      if (values && own(values, 'cue')) message.cue = copyCue(values.cue);
      if (values && own(values, 'id')) message.id = values.id;
      return message;
    }

    function receive(message) {
      if (destroyed || !validEnvelope(message) ||
          message.channel !== channelName ||
          message.senderId === senderId ||
          message.targetRole !== role ||
          !remember(message.messageId)) return;
      if (message.type === 'cue' && role === 'presenter') {
        addCue(message.cue);
      } else if (message.type === 'ack' && role === 'operator') {
        markAcknowledged(message.id);
      } else if (message.type === 'hello' && role === 'operator') {
        expireDue(false);
        cues.forEach(function (cue) {
          if (cue.status === 'active') publish(envelope('cue', 'presenter', {cue: cue}));
        });
      }
    }

    function sameOriginTarget(target) {
      if (!win || !target || target === win) return false;
      try {
        return Boolean(win.location && target.location &&
          win.location.origin && target.location.origin === win.location.origin);
      } catch (_) {
        return false;
      }
    }

    function postToRelatedWindows(message) {
      if (!win || !win.location || !win.location.origin) return;
      // A regular window "message" event is observable by every script in the
      // target document. Keep sensitive cue text on BroadcastChannel or the
      // closure-local hub; postMessage is only a control-plane fallback.
      if (message.type === 'cue') return;
      var targets = [];
      try { if (win.opener) targets.push(win.opener); } catch (_) {}
      try { if (win.parent && win.parent !== win) targets.push(win.parent); } catch (_) {}
      targets.forEach(function (target) {
        if (!sameOriginTarget(target) || typeof target.postMessage !== 'function') return;
        try { target.postMessage(message, win.location.origin); } catch (_) {}
      });
    }

    function storageSignal(message) {
      if (!storage || message.type === 'cue') return;
      // Never put cue text in localStorage. Only control envelopes with opaque ids
      // are written, and the key is removed synchronously after dispatch.
      try {
        storage.setItem(storageKey, JSON.stringify(message));
        storage.removeItem(storageKey);
      } catch (_) {}
    }

    function publish(message) {
      if (destroyed) return;
      if (broadcastChannel) {
        try { broadcastChannel.postMessage(message); } catch (_) {}
        return;
      }
      if (memoryHub) {
        memoryHub.slice().forEach(function (subscriber) {
          if (subscriber !== receive) subscriber(message);
        });
      }
      postToRelatedWindows(message);
      storageSignal(message);
    }

    if (typeof BroadcastChannelConstructor === 'function') {
      try {
        broadcastChannel = new BroadcastChannelConstructor(transportChannel);
        broadcastChannel.onmessage = function (event) { receive(event && event.data); };
        transport = 'broadcast-channel';
      } catch (_) {
        broadcastChannel = null;
      }
    }

    if (!broadcastChannel) {
      memoryHub = fallbackHubs[transportChannel] || (fallbackHubs[transportChannel] = []);
      memoryHub.push(receive);
      transport = 'memory+same-origin-postmessage+storage-signal';
      if (win && typeof win.addEventListener === 'function') {
        var onMessage = function (event) {
          if (!win.location || event.origin !== win.location.origin) return;
          var related = false;
          try {
            related = event.source !== win &&
              (event.source === win.opener || (win.parent !== win && event.source === win.parent));
          } catch (_) {}
          if (related) receive(event.data);
        };
        var onStorage = function (event) {
          if (event.key !== storageKey || typeof event.newValue !== 'string') return;
          try { receive(JSON.parse(event.newValue)); } catch (_) {}
        };
        win.addEventListener('message', onMessage);
        win.addEventListener('storage', onStorage);
        removeWindowListeners = function () {
          win.removeEventListener('message', onMessage);
          win.removeEventListener('storage', onStorage);
        };
      }
    }

    function sendCue(input) {
      if (destroyed) throw new Error('Backchannel has been destroyed.');
      if (role !== 'operator') throw new Error('Only the operator role can send cues.');
      var normalized = normalizeOutgoingCue(input);
      var createdAt = time();
      var cue = {
        id: makeId('cue'),
        text: normalized.text,
        priority: normalized.priority,
        createdAt: createdAt,
        expiresAt: createdAt + normalized.ttlMs,
        status: 'active'
      };
      addCue(cue);
      publish(envelope('cue', 'presenter', {cue: cue}));
      return copyCue(cue);
    }

    function acknowledge(id) {
      if (destroyed) throw new Error('Backchannel has been destroyed.');
      if (role !== 'presenter') throw new Error('Only the presenter role can acknowledge cues.');
      if (!validIdentifier(id, 120)) throw new TypeError('A valid cue id is required.');
      var cue = cues.get(id);
      expireDue(false);
      if (!cue || cue.status === 'expired') return false;
      if (cue.status !== 'acknowledged') {
        cue.status = 'acknowledged';
        emit();
        scheduleExpiry();
        publish(envelope('ack', 'operator', {id: id}));
      }
      return true;
    }

    function snapshot() {
      if (destroyed) throw new Error('Backchannel has been destroyed.');
      return snapshotInternal(true);
    }

    function onChange(listener) {
      if (destroyed) throw new Error('Backchannel has been destroyed.');
      if (typeof listener !== 'function') throw new TypeError('onChange requires a function.');
      listeners.push(listener);
      listener(snapshotInternal(true));
      var active = true;
      return function () {
        if (!active) return;
        active = false;
        var index = listeners.indexOf(listener);
        if (index >= 0) listeners.splice(index, 1);
      };
    }

    function destroy() {
      if (destroyed) return;
      destroyed = true;
      if (timer !== null && cancel) cancel(timer);
      timer = null;
      listeners.length = 0;
      if (broadcastChannel && typeof broadcastChannel.close === 'function') {
        try { broadcastChannel.close(); } catch (_) {}
      }
      if (memoryHub) {
        var index = memoryHub.indexOf(receive);
        if (index >= 0) memoryHub.splice(index, 1);
        if (!memoryHub.length) delete fallbackHubs[transportChannel];
      }
      removeWindowListeners();
      cues.clear();
    }

    var instance = {
      sendCue: sendCue,
      acknowledge: acknowledge,
      snapshot: snapshot,
      onChange: onChange,
      destroy: destroy
    };
    publish(envelope('hello', role === 'presenter' ? 'operator' : 'presenter'));
    return instance;
  }

  return {create: create};
}));
