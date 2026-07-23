(function (root, factory) {
  var api = factory(root || {});
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AdmiraSpeakerHandoff = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  var VERSION = 1;
  var STORAGE_SCHEMA = 'admira-speaker-handoff-private-v1';
  var STORAGE_PREFIX = 'admira.presentation-speaker-handoff.private.v1.';
  var ROLES = ['speaker', 'moderator'];
  var EVENT_TYPES = [
    'speaker-added',
    'queue-enqueued',
    'queue-removed',
    'speaker-state-updated',
    'handoff-requested',
    'handoff-cancelled',
    'handoff-completed'
  ];
  var MAX_SPEAKERS = 24;
  var MAX_NAME_LENGTH = 120;
  var MAX_NOTES_LENGTH = 4000;
  var MAX_REFERENCE_LENGTH = 1000;
  var MAX_QUEUE_LENGTH = 24;
  var MAX_SEEN_EVENTS = 256;
  var MAX_STORAGE_BYTES = 96 * 1024;
  var DEFAULT_COUNTDOWN_MS = 5000;
  var MIN_COUNTDOWN_MS = 1000;
  var MAX_COUNTDOWN_MS = 30000;
  var DEFAULT_RETENTION_MS = 8 * 60 * 60 * 1000;
  var MIN_RETENTION_MS = 60 * 1000;
  var MAX_RETENTION_MS = 24 * 60 * 60 * 1000;
  var sequence = 0;

  function own(value, key) {
    return Object.prototype.hasOwnProperty.call(value, key);
  }

  function isRecord(value) {
    return value !== null && typeof value === 'object' &&
      Object.prototype.toString.call(value) === '[object Object]';
  }

  function dataRecord(value, allowed, required) {
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
      var descriptor = descriptors[key];
      return allowed.indexOf(key) < 0 || own(descriptor, 'get') || own(descriptor, 'set');
    })) return false;
    return required.every(function (key) { return own(descriptors, key); });
  }

  function finiteInteger(value) {
    return typeof value === 'number' && Number.isFinite(value) && Math.floor(value) === value;
  }

  function validId(value, maxLength) {
    return typeof value === 'string' && value.length > 0 && value.length <= maxLength &&
      /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value);
  }

  function validPrivateText(value, maxLength) {
    return typeof value === 'string' && value.length <= maxLength &&
      !/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(value);
  }

  function normalizeSpeaker(input) {
    if (!dataRecord(input, ['id', 'name', 'role', 'state'], ['id', 'name'])) {
      throw new TypeError('A speaker only accepts id, name, role and optional state data fields.');
    }
    if (!validId(input.id, 80)) {
      throw new RangeError('Speaker id must be 1 to 80 URL-safe characters.');
    }
    if (typeof input.name !== 'string') throw new TypeError('Speaker name must be a string.');
    var name = input.name.trim();
    if (!name || name.length > MAX_NAME_LENGTH ||
        /[\u0000-\u001F\u007F]/.test(name)) {
      throw new RangeError('Speaker name must contain 1 to ' + MAX_NAME_LENGTH + ' safe characters.');
    }
    var role = own(input, 'role') && input.role !== undefined ? input.role : 'speaker';
    if (ROLES.indexOf(role) < 0) {
      throw new RangeError('Speaker role must be speaker or moderator.');
    }
    var state = own(input, 'state') && input.state !== undefined
      ? normalizeSpeakerState(input.state)
      : {slideIndex: 0, notes: '', reference: ''};
    return {id: input.id, name: name, role: role, state: state};
  }

  function normalizePrivateReference(value, depth) {
    depth = depth || 0;
    if (typeof value === 'string') {
      if (!validPrivateText(value, MAX_REFERENCE_LENGTH)) {
        throw new RangeError('reference must contain at most ' + MAX_REFERENCE_LENGTH + ' safe characters.');
      }
      return value;
    }
    if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (depth >= 4) throw new RangeError('reference nesting is too deep.');
    if (Array.isArray(value)) {
      if (value.length > 32) throw new RangeError('reference arrays are limited to 32 values.');
      var arrayDescriptors;
      try {
        arrayDescriptors = Object.getOwnPropertyDescriptors(value);
      } catch (_) {
        throw new TypeError('reference must be safe JSON data.');
      }
      if (Object.getOwnPropertySymbols(value).length) {
        throw new TypeError('reference must be safe JSON data.');
      }
      var arrayKeys = Object.keys(arrayDescriptors).filter(function (key) { return key !== 'length'; });
      if (arrayKeys.length !== value.length || arrayKeys.some(function (key, index) {
        var descriptor = arrayDescriptors[key];
        return key !== String(index) || own(descriptor, 'get') || own(descriptor, 'set');
      })) {
        throw new TypeError('reference must be dense safe JSON data.');
      }
      return arrayKeys.map(function (key) {
        return normalizePrivateReference(arrayDescriptors[key].value, depth + 1);
      });
    }
    if (!isRecord(value)) {
      throw new TypeError('reference must be safe JSON data.');
    }
    var descriptors;
    try {
      descriptors = Object.getOwnPropertyDescriptors(value);
    } catch (_) {
      throw new TypeError('reference must be safe JSON data.');
    }
    if (Object.getOwnPropertySymbols(value).length) {
      throw new TypeError('reference must be safe JSON data.');
    }
    var keys = Object.keys(descriptors);
    if (keys.length > 32) throw new RangeError('reference objects are limited to 32 fields.');
    var result = {};
    keys.forEach(function (key) {
      var descriptor = descriptors[key];
      if (!key || key.length > 80 ||
          key === '__proto__' || key === 'constructor' || key === 'prototype' ||
          own(descriptor, 'get') || own(descriptor, 'set')) {
        throw new TypeError('reference must be safe JSON data.');
      }
      result[key] = normalizePrivateReference(descriptor.value, depth + 1);
    });
    return result;
  }

  function normalizeSpeakerState(input) {
    if (!dataRecord(input, ['slideIndex', 'notes', 'reference'], ['slideIndex'])) {
      throw new TypeError('Speaker state only accepts slideIndex, notes and reference data fields.');
    }
    if (!finiteInteger(input.slideIndex) || input.slideIndex < 0 || input.slideIndex > 10000) {
      throw new RangeError('slideIndex must be an integer between 0 and 10000.');
    }
    var notes = own(input, 'notes') && input.notes !== undefined ? input.notes : '';
    var reference = own(input, 'reference') && input.reference !== undefined
      ? normalizePrivateReference(input.reference, 0)
      : '';
    if (!validPrivateText(notes, MAX_NOTES_LENGTH)) {
      throw new RangeError('notes must contain at most ' + MAX_NOTES_LENGTH + ' safe characters.');
    }
    var referenceSize = typeof reference === 'string'
      ? reference.length
      : JSON.stringify(reference).length;
    if (referenceSize > MAX_REFERENCE_LENGTH) {
      throw new RangeError('reference must contain at most ' + MAX_REFERENCE_LENGTH + ' serialized characters.');
    }
    return {slideIndex: input.slideIndex, notes: notes, reference: reference};
  }

  function copyState(state) {
    return {
      slideIndex: state.slideIndex,
      notes: state.notes,
      reference: normalizePrivateReference(state.reference, 0)
    };
  }

  function copySpeaker(speaker) {
    return {
      id: speaker.id,
      name: speaker.name,
      role: speaker.role,
      state: copyState(speaker.state)
    };
  }

  function publicSpeaker(speaker) {
    return speaker ? {id: speaker.id, name: speaker.name, role: speaker.role} : null;
  }

  function copyHandoff(handoff, at) {
    if (!handoff) return null;
    return {
      id: handoff.id,
      fromSpeakerId: handoff.fromSpeakerId,
      toSpeakerId: handoff.toSpeakerId,
      status: 'countdown',
      requestedAt: handoff.requestedAt,
      executeAt: handoff.executeAt,
      remainingMs: Math.max(0, handoff.executeAt - at)
    };
  }

  function storedHandoff(handoff) {
    if (!handoff) return null;
    return {
      id: handoff.id,
      fromSpeakerId: handoff.fromSpeakerId,
      toSpeakerId: handoff.toSpeakerId,
      requestedAt: handoff.requestedAt,
      executeAt: handoff.executeAt
    };
  }

  function copyEvent(event) {
    return JSON.parse(JSON.stringify(event));
  }

  function create(options) {
    options = options || {};
    if (!isRecord(options)) throw new TypeError('Speaker handoff options must be an object.');
    if (!validId(options.presentationId, 80)) {
      throw new RangeError('presentationId must be 1 to 80 URL-safe characters.');
    }

    var now = typeof options.now === 'function' ? options.now : Date.now;
    var schedule = typeof options.schedule === 'function'
      ? options.schedule
      : (typeof root.setTimeout === 'function' ? root.setTimeout.bind(root) : null);
    var cancel = typeof options.cancel === 'function'
      ? options.cancel
      : (typeof root.clearTimeout === 'function' ? root.clearTimeout.bind(root) : null);
    var idFactory = typeof options.idFactory === 'function' ? options.idFactory : null;
    var defaultCountdownMs = own(options, 'defaultCountdownMs')
      ? options.defaultCountdownMs
      : DEFAULT_COUNTDOWN_MS;
    var retentionMs = own(options, 'retentionMs') ? options.retentionMs : DEFAULT_RETENTION_MS;
    if (!finiteInteger(defaultCountdownMs) ||
        defaultCountdownMs < MIN_COUNTDOWN_MS ||
        defaultCountdownMs > MAX_COUNTDOWN_MS) {
      throw new RangeError('defaultCountdownMs must be between ' +
        MIN_COUNTDOWN_MS + ' and ' + MAX_COUNTDOWN_MS + '.');
    }
    if (!finiteInteger(retentionMs) ||
        retentionMs < MIN_RETENTION_MS ||
        retentionMs > MAX_RETENTION_MS) {
      throw new RangeError('retentionMs must be between ' +
        MIN_RETENTION_MS + ' and ' + MAX_RETENTION_MS + '.');
    }

    var storage = own(options, 'storage')
      ? options.storage
      : (function () {
          try { return root.localStorage || null; } catch (_) { return null; }
        }());
    var storageKey = own(options, 'storageKey')
      ? options.storageKey
      : STORAGE_PREFIX + options.presentationId;
    if (!validId(storageKey, 180)) {
      throw new RangeError('storageKey must be 1 to 180 URL-safe characters.');
    }

    var initialSpeakers = Array.isArray(options.speakers) ? options.speakers.slice() : [];
    if (own(options, 'actor') && options.actor !== undefined) {
      var actorDescriptor = normalizeSpeaker(options.actor);
      if (!initialSpeakers.some(function (speaker) {
        return speaker && speaker.id === actorDescriptor.id;
      })) initialSpeakers.unshift(actorDescriptor);
    }
    if (initialSpeakers.length > MAX_SPEAKERS) {
      throw new RangeError('At most ' + MAX_SPEAKERS + ' speakers are allowed.');
    }

    var speakers = new Map();
    initialSpeakers.forEach(function (input) {
      var speaker = normalizeSpeaker(input);
      if (speakers.has(speaker.id)) throw new Error('Speaker ids must be unique.');
      speakers.set(speaker.id, speaker);
    });

    var actorId = options.actorId || (options.actor && options.actor.id);
    if (!validId(actorId, 80) || !speakers.has(actorId)) {
      throw new Error('actorId must identify one declared speaker or moderator.');
    }
    var actor = speakers.get(actorId);
    var initialControllerId = own(options, 'initialControllerId')
      ? options.initialControllerId
      : (function () {
          var first = null;
          speakers.forEach(function (speaker) {
            if (first === null && speaker.role === 'speaker') first = speaker.id;
          });
          return first;
        }());
    if (initialControllerId !== null &&
        (!speakers.has(initialControllerId) || speakers.get(initialControllerId).role !== 'speaker')) {
      throw new Error('initialControllerId must identify a speaker.');
    }
    var initialQueue = Array.isArray(options.initialQueue) ? options.initialQueue.slice() : [];
    if (initialQueue.length > MAX_QUEUE_LENGTH ||
        new Set(initialQueue).size !== initialQueue.length ||
        initialQueue.some(function (id) {
          return !speakers.has(id) || speakers.get(id).role !== 'speaker' || id === initialControllerId;
        })) {
      throw new Error('initialQueue must contain unique declared speakers other than the controller.');
    }

    var presentationId = options.presentationId;
    var controllerId = initialControllerId;
    var queue = initialQueue;
    var handoff = null;
    var revision = 0;
    var seenEvents = new Set();
    var seenOrder = [];
    var listeners = [];
    var timer = null;
    var destroyed = false;
    var persistenceStatus = storage ? 'empty' : 'disabled';

    function time() {
      var value = Number(now());
      if (!Number.isFinite(value)) throw new Error('Speaker handoff clock returned a non-finite value.');
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
      if (!validId(candidate, 120)) throw new Error('Generated speaker handoff id is invalid.');
      return candidate;
    }

    function actorCanCoordinate(id) {
      var candidate = speakers.get(id);
      return Boolean(candidate && (candidate.role === 'moderator' || id === controllerId));
    }

    function remember(eventId) {
      if (seenEvents.has(eventId)) return false;
      seenEvents.add(eventId);
      seenOrder.push(eventId);
      if (seenOrder.length > MAX_SEEN_EVENTS) {
        seenEvents.delete(seenOrder.shift());
      }
      return true;
    }

    function persistenceRecord(at) {
      return {
        schema: STORAGE_SCHEMA,
        version: VERSION,
        presentationId: presentationId,
        expiresAt: at + retentionMs,
        revision: revision,
        controllerId: controllerId,
        queue: queue.slice(),
        speakers: Array.from(speakers.values()).map(copySpeaker),
        handoff: storedHandoff(handoff),
        seenEventIds: seenOrder.slice()
      };
    }

    function persist() {
      if (!storage || typeof storage.setItem !== 'function') {
        persistenceStatus = 'disabled';
        return false;
      }
      try {
        var serialized = JSON.stringify(persistenceRecord(time()));
        if (serialized.length > MAX_STORAGE_BYTES) {
          persistenceStatus = 'limit-exceeded';
          return false;
        }
        storage.setItem(storageKey, serialized);
        persistenceStatus = 'persisted';
        return true;
      } catch (_) {
        persistenceStatus = 'error';
        return false;
      }
    }

    function validStoredHandoff(value, restoredSpeakers, restoredController, restoredQueue) {
      return dataRecord(
        value,
        ['id', 'fromSpeakerId', 'toSpeakerId', 'requestedAt', 'executeAt'],
        ['id', 'fromSpeakerId', 'toSpeakerId', 'requestedAt', 'executeAt']
      ) &&
        validId(value.id, 120) &&
        value.fromSpeakerId === restoredController &&
        restoredSpeakers.has(value.fromSpeakerId) &&
        restoredSpeakers.has(value.toSpeakerId) &&
        restoredSpeakers.get(value.toSpeakerId).role === 'speaker' &&
        restoredQueue[0] === value.toSpeakerId &&
        finiteInteger(value.requestedAt) &&
        finiteInteger(value.executeAt) &&
        value.executeAt - value.requestedAt >= MIN_COUNTDOWN_MS &&
        value.executeAt - value.requestedAt <= MAX_COUNTDOWN_MS;
    }

    function restore() {
      if (!storage || typeof storage.getItem !== 'function') return false;
      var serialized;
      try {
        serialized = storage.getItem(storageKey);
      } catch (_) {
        persistenceStatus = 'error';
        return false;
      }
      if (typeof serialized !== 'string' || !serialized) return false;
      if (serialized.length > MAX_STORAGE_BYTES) {
        persistenceStatus = 'rejected';
        return false;
      }
      try {
        var record = JSON.parse(serialized);
        if (!dataRecord(
          record,
          ['schema', 'version', 'presentationId', 'expiresAt', 'revision', 'controllerId',
            'queue', 'speakers', 'handoff', 'seenEventIds'],
          ['schema', 'version', 'presentationId', 'expiresAt', 'revision', 'controllerId',
            'queue', 'speakers', 'handoff', 'seenEventIds']
        ) ||
            record.schema !== STORAGE_SCHEMA ||
            record.version !== VERSION ||
            record.presentationId !== presentationId ||
            !finiteInteger(record.expiresAt) ||
            !finiteInteger(record.revision) ||
            record.revision < 0 ||
            record.expiresAt <= time() ||
            !Array.isArray(record.speakers) ||
            record.speakers.length > MAX_SPEAKERS ||
            !Array.isArray(record.queue) ||
            record.queue.length > MAX_QUEUE_LENGTH ||
            !Array.isArray(record.seenEventIds) ||
            record.seenEventIds.length > MAX_SEEN_EVENTS) {
          persistenceStatus = 'rejected';
          return false;
        }
        var restoredSpeakers = new Map();
        record.speakers.forEach(function (input) {
          var speaker = normalizeSpeaker(input);
          if (restoredSpeakers.has(speaker.id)) throw new Error('duplicate-speaker');
          restoredSpeakers.set(speaker.id, speaker);
        });
        if (!restoredSpeakers.has(actorId) ||
            (record.controllerId !== null &&
              (!restoredSpeakers.has(record.controllerId) ||
               restoredSpeakers.get(record.controllerId).role !== 'speaker')) ||
            new Set(record.queue).size !== record.queue.length ||
            record.queue.some(function (id) {
              return !restoredSpeakers.has(id) ||
                restoredSpeakers.get(id).role !== 'speaker' ||
                id === record.controllerId;
            }) ||
            record.seenEventIds.some(function (id) { return !validId(id, 160); }) ||
            (record.handoff !== null &&
              !validStoredHandoff(record.handoff, restoredSpeakers, record.controllerId, record.queue))) {
          persistenceStatus = 'rejected';
          return false;
        }
        speakers = restoredSpeakers;
        actor = speakers.get(actorId);
        controllerId = record.controllerId;
        queue = record.queue.slice();
        handoff = record.handoff ? {
          id: record.handoff.id,
          fromSpeakerId: record.handoff.fromSpeakerId,
          toSpeakerId: record.handoff.toSpeakerId,
          requestedAt: record.handoff.requestedAt,
          executeAt: record.handoff.executeAt
        } : null;
        revision = record.revision;
        seenOrder = record.seenEventIds.slice();
        seenEvents = new Set(seenOrder);
        persistenceStatus = 'restored';
        return true;
      } catch (_) {
        persistenceStatus = 'rejected';
        return false;
      }
    }

    function scheduleHandoff() {
      if (timer !== null && cancel) cancel(timer);
      timer = null;
      if (!handoff || !schedule || destroyed) return;
      timer = schedule(function () {
        timer = null;
        if (!destroyed) completeDue();
      }, Math.max(0, handoff.executeAt - time()));
    }

    function privateSnapshot(at) {
      return {
        version: VERSION,
        presentationId: presentationId,
        revision: revision,
        actor: {id: actor.id, name: actor.name, role: actor.role},
        controllerId: controllerId,
        queue: queue.slice(),
        speakers: Array.from(speakers.values()).map(copySpeaker),
        handoff: copyHandoff(handoff, at),
        persistence: {status: persistenceStatus, storageKey: storageKey, retentionMs: retentionMs}
      };
    }

    function audienceSnapshotInternal(at) {
      var controller = controllerId ? speakers.get(controllerId) : null;
      var publicHandoff = null;
      if (handoff) {
        publicHandoff = {
          id: handoff.id,
          from: publicSpeaker(speakers.get(handoff.fromSpeakerId)),
          to: publicSpeaker(speakers.get(handoff.toSpeakerId)),
          status: 'countdown',
          requestedAt: handoff.requestedAt,
          executeAt: handoff.executeAt,
          remainingMs: Math.max(0, handoff.executeAt - at)
        };
      }
      return {
        version: VERSION,
        presentationId: presentationId,
        revision: revision,
        controller: publicSpeaker(controller),
        activeSlideIndex: controller ? controller.state.slideIndex : null,
        queue: queue.map(function (id) { return publicSpeaker(speakers.get(id)); }),
        handoff: publicHandoff
      };
    }

    function notify(event) {
      var state = privateSnapshot(time());
      var eventCopy = event ? copyEvent(event) : null;
      listeners.slice().forEach(function (listener) {
        try { listener(state, eventCopy); } catch (_) {}
      });
    }

    function eventEnvelope(type, payload) {
      return {
        id: makeId('event'),
        type: type,
        actorId: actorId,
        at: time(),
        payload: payload
      };
    }

    function validEventEnvelope(event) {
      return dataRecord(event, ['id', 'type', 'actorId', 'at', 'payload'],
        ['id', 'type', 'actorId', 'at', 'payload']) &&
        validId(event.id, 160) &&
        EVENT_TYPES.indexOf(event.type) >= 0 &&
        validId(event.actorId, 80) &&
        speakers.has(event.actorId) &&
        finiteInteger(event.at) &&
        isRecord(event.payload);
    }

    function requirePayload(payload, allowed, required) {
      if (!dataRecord(payload, allowed, required)) {
        throw new TypeError('Invalid payload for speaker handoff event.');
      }
    }

    function applyEventInternal(event) {
      if (!validEventEnvelope(event)) throw new TypeError('Invalid speaker handoff event.');
      if (seenEvents.has(event.id)) return false;
      var payload = event.payload;
      var eventActor = speakers.get(event.actorId);
      var nextSpeaker;

      if (event.type === 'speaker-added') {
        requirePayload(payload, ['speaker'], ['speaker']);
        if (!actorCanCoordinate(event.actorId)) throw new Error('Actor cannot add speakers.');
        nextSpeaker = normalizeSpeaker(payload.speaker);
        if (speakers.has(nextSpeaker.id)) throw new Error('Speaker already exists.');
        if (speakers.size >= MAX_SPEAKERS) throw new Error('Speaker limit reached.');
        speakers.set(nextSpeaker.id, nextSpeaker);
        if (controllerId === null && nextSpeaker.role === 'speaker') controllerId = nextSpeaker.id;
      } else if (event.type === 'queue-enqueued') {
        requirePayload(payload, ['speakerId'], ['speakerId']);
        if (!actorCanCoordinate(event.actorId)) throw new Error('Actor cannot edit the queue.');
        if (!validId(payload.speakerId, 80) ||
            !speakers.has(payload.speakerId) ||
            speakers.get(payload.speakerId).role !== 'speaker') {
          throw new Error('Queue target must identify a speaker.');
        }
        if (payload.speakerId === controllerId) throw new Error('Controller cannot be queued.');
        if (queue.indexOf(payload.speakerId) >= 0) return false;
        if (queue.length >= MAX_QUEUE_LENGTH) throw new Error('Queue limit reached.');
        queue.push(payload.speakerId);
      } else if (event.type === 'queue-removed') {
        requirePayload(payload, ['speakerId'], ['speakerId']);
        if (!actorCanCoordinate(event.actorId)) throw new Error('Actor cannot edit the queue.');
        var removeIndex = queue.indexOf(payload.speakerId);
        if (removeIndex < 0) return false;
        if (handoff && handoff.toSpeakerId === payload.speakerId) {
          throw new Error('Cannot remove the target of an active handoff.');
        }
        queue.splice(removeIndex, 1);
      } else if (event.type === 'speaker-state-updated') {
        requirePayload(payload, ['speakerId', 'state'], ['speakerId', 'state']);
        if (!speakers.has(payload.speakerId)) throw new Error('Unknown speaker.');
        if (eventActor.role !== 'moderator' && event.actorId !== payload.speakerId) {
          throw new Error('Actors can only update their own private state.');
        }
        speakers.get(payload.speakerId).state = normalizeSpeakerState(payload.state);
      } else if (event.type === 'handoff-requested') {
        requirePayload(payload, ['handoff'], ['handoff']);
        if (!actorCanCoordinate(event.actorId)) throw new Error('Actor cannot request a handoff.');
        if (handoff) throw new Error('A handoff is already active.');
        var requested = payload.handoff;
        if (!dataRecord(
          requested,
          ['id', 'fromSpeakerId', 'toSpeakerId', 'requestedAt', 'executeAt'],
          ['id', 'fromSpeakerId', 'toSpeakerId', 'requestedAt', 'executeAt']
        ) ||
            !validId(requested.id, 120) ||
            requested.fromSpeakerId !== controllerId ||
            queue[0] !== requested.toSpeakerId ||
            requested.requestedAt !== event.at ||
            !finiteInteger(requested.executeAt) ||
            requested.executeAt - event.at < MIN_COUNTDOWN_MS ||
            requested.executeAt - event.at > MAX_COUNTDOWN_MS) {
          throw new Error('Handoff must transfer the current controller to the first queued speaker.');
        }
        handoff = {
          id: requested.id,
          fromSpeakerId: requested.fromSpeakerId,
          toSpeakerId: requested.toSpeakerId,
          requestedAt: requested.requestedAt,
          executeAt: requested.executeAt
        };
      } else if (event.type === 'handoff-cancelled') {
        requirePayload(payload, ['handoffId'], ['handoffId']);
        if (!handoff || payload.handoffId !== handoff.id) return false;
        if (eventActor.role !== 'moderator' &&
            event.actorId !== handoff.fromSpeakerId &&
            event.actorId !== handoff.toSpeakerId) {
          throw new Error('Actor cannot cancel this handoff.');
        }
        handoff = null;
      } else if (event.type === 'handoff-completed') {
        requirePayload(payload, ['handoffId'], ['handoffId']);
        if (!handoff || payload.handoffId !== handoff.id) return false;
        if (eventActor.role !== 'moderator' &&
            event.actorId !== handoff.toSpeakerId &&
            !(event.actorId === handoff.fromSpeakerId && event.at >= handoff.executeAt)) {
          throw new Error('Only the target, moderator or elapsed countdown can complete a handoff.');
        }
        controllerId = handoff.toSpeakerId;
        if (queue[0] === controllerId) queue.shift();
        handoff = null;
      }

      remember(event.id);
      revision += 1;
      persist();
      scheduleHandoff();
      notify(event);
      return true;
    }

    function completeDue() {
      if (!handoff || time() < handoff.executeAt) {
        scheduleHandoff();
        return false;
      }
      var due = handoff;
      return applyEventInternal({
        id: 'complete:' + due.id,
        type: 'handoff-completed',
        actorId: due.fromSpeakerId,
        at: time(),
        payload: {handoffId: due.id}
      });
    }

    function assertActive() {
      if (destroyed) throw new Error('Speaker handoff has been destroyed.');
    }

    function settle() {
      assertActive();
      completeDue();
    }

    function addSpeaker(input) {
      settle();
      var speaker = normalizeSpeaker(input);
      var applied = applyEventInternal(eventEnvelope('speaker-added', {speaker: speaker}));
      return applied ? copySpeaker(speakers.get(speaker.id)) : null;
    }

    function enqueue(input) {
      settle();
      var speakerId;
      if (typeof input === 'string') {
        speakerId = input;
      } else {
        var speaker = normalizeSpeaker(input);
        speakerId = speaker.id;
        if (!speakers.has(speakerId)) {
          applyEventInternal(eventEnvelope('speaker-added', {speaker: speaker}));
        }
      }
      var applied = applyEventInternal(eventEnvelope('queue-enqueued', {speakerId: speakerId}));
      return applied ? queue.slice() : queue.slice();
    }

    function removeFromQueue(speakerId) {
      settle();
      return applyEventInternal(eventEnvelope('queue-removed', {speakerId: speakerId}));
    }

    function updateSpeakerState(speakerId, nextState) {
      settle();
      var normalized = normalizeSpeakerState(nextState);
      applyEventInternal(eventEnvelope('speaker-state-updated', {
        speakerId: speakerId,
        state: normalized
      }));
      return copyState(speakers.get(speakerId).state);
    }

    function requestHandoff(toSpeakerId, requestOptions) {
      settle();
      requestOptions = requestOptions || {};
      if (!isRecord(requestOptions) ||
          Object.keys(requestOptions).some(function (key) { return key !== 'countdownMs'; })) {
        throw new TypeError('requestHandoff only accepts countdownMs.');
      }
      var countdownMs = own(requestOptions, 'countdownMs')
        ? requestOptions.countdownMs
        : defaultCountdownMs;
      if (!finiteInteger(countdownMs) ||
          countdownMs < MIN_COUNTDOWN_MS ||
          countdownMs > MAX_COUNTDOWN_MS) {
        throw new RangeError('countdownMs must be between ' +
          MIN_COUNTDOWN_MS + ' and ' + MAX_COUNTDOWN_MS + '.');
      }
      if (!controllerId) throw new Error('A controller is required before handoff.');
      var requestedAt = time();
      var nextHandoff = {
        id: makeId('handoff'),
        fromSpeakerId: controllerId,
        toSpeakerId: toSpeakerId,
        requestedAt: requestedAt,
        executeAt: requestedAt + countdownMs
      };
      applyEventInternal({
        id: makeId('event'),
        type: 'handoff-requested',
        actorId: actorId,
        at: requestedAt,
        payload: {handoff: nextHandoff}
      });
      return copyHandoff(handoff, time());
    }

    function acceptHandoff(handoffId) {
      settle();
      if (!handoff || handoff.id !== handoffId) return false;
      return applyEventInternal(eventEnvelope('handoff-completed', {handoffId: handoffId}));
    }

    function cancelHandoff(handoffId) {
      settle();
      if (!handoff || handoff.id !== handoffId) return false;
      return applyEventInternal(eventEnvelope('handoff-cancelled', {handoffId: handoffId}));
    }

    function applyEvent(event) {
      settle();
      return applyEventInternal(event);
    }

    function snapshot() {
      settle();
      return privateSnapshot(time());
    }

    function audienceSnapshot() {
      settle();
      return audienceSnapshotInternal(time());
    }

    function onChange(listener) {
      settle();
      if (typeof listener !== 'function') throw new TypeError('onChange requires a function.');
      listeners.push(listener);
      listener(privateSnapshot(time()), null);
      var active = true;
      return function () {
        if (!active) return;
        active = false;
        var index = listeners.indexOf(listener);
        if (index >= 0) listeners.splice(index, 1);
      };
    }

    function clearPersistence() {
      assertActive();
      if (!storage || typeof storage.removeItem !== 'function') return false;
      try {
        storage.removeItem(storageKey);
        persistenceStatus = 'cleared';
        return true;
      } catch (_) {
        persistenceStatus = 'error';
        return false;
      }
    }

    function destroy() {
      if (destroyed) return;
      destroyed = true;
      if (timer !== null && cancel) cancel(timer);
      timer = null;
      listeners.length = 0;
    }

    restore();
    persist();
    completeDue();
    scheduleHandoff();

    return {
      addSpeaker: addSpeaker,
      enqueue: enqueue,
      removeFromQueue: removeFromQueue,
      updateSpeakerState: updateSpeakerState,
      requestHandoff: requestHandoff,
      acceptHandoff: acceptHandoff,
      cancelHandoff: cancelHandoff,
      applyEvent: applyEvent,
      snapshot: snapshot,
      audienceSnapshot: audienceSnapshot,
      onChange: onChange,
      clearPersistence: clearPersistence,
      destroy: destroy
    };
  }

  return {
    create: create,
    limits: Object.freeze({
      maxSpeakers: MAX_SPEAKERS,
      maxNotesLength: MAX_NOTES_LENGTH,
      maxReferenceLength: MAX_REFERENCE_LENGTH,
      minCountdownMs: MIN_COUNTDOWN_MS,
      maxCountdownMs: MAX_COUNTDOWN_MS,
      maxStorageBytes: MAX_STORAGE_BYTES
    })
  };
}));
