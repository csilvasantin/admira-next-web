import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

async function loadHandoff(context = {}) {
  const source = await readFile(
    new URL('../assets/presentation-speaker-handoff.js', import.meta.url),
    'utf8'
  );
  const sandbox = {...context};
  vm.runInNewContext(source, sandbox);
  return sandbox.AdmiraSpeakerHandoff;
}

function fakeClock(start = 1000) {
  let value = start;
  let sequence = 0;
  const timers = new Map();
  return {
    now: () => value,
    schedule(fn, delay) {
      const id = ++sequence;
      timers.set(id, {fn, at: value + delay});
      return id;
    },
    cancel(id) {
      timers.delete(id);
    },
    advance(ms) {
      value += ms;
      let due;
      do {
        due = [...timers.entries()]
          .filter(([, timer]) => timer.at <= value)
          .sort((left, right) => left[1].at - right[1].at)[0];
        if (due) {
          timers.delete(due[0]);
          due[1].fn();
        }
      } while (due);
    },
    pending: () => timers.size
  };
}

function fakeStorage() {
  const values = new Map();
  const writes = [];
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
      writes.push({key, value: String(value)});
    },
    removeItem(key) {
      values.delete(key);
    },
    values,
    writes
  };
}

function ids(prefix) {
  let sequence = 0;
  return kind => `${prefix}:${kind}:${++sequence}`;
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

function people() {
  return [
    {id: 'director', name: 'Dirección de sala', role: 'moderator'},
    {id: 'ana', name: 'Ana', role: 'speaker'},
    {id: 'bruno', name: 'Bruno', role: 'speaker'},
    {id: 'carla', name: 'Carla', role: 'speaker'}
  ];
}

function createModerator(api, extra = {}) {
  return api.create({
    presentationId: 'deck-safe-handoff',
    speakers: people(),
    actorId: 'director',
    initialControllerId: 'ana',
    idFactory: ids('moderator'),
    ...extra
  });
}

test('maintains an ordered, unique queue and supports bounded dynamic speaker registration', async () => {
  const api = await loadHandoff();
  const handoff = createModerator(api);

  assert.deepEqual(plain(handoff.enqueue('bruno')), ['bruno']);
  assert.deepEqual(plain(handoff.enqueue('carla')), ['bruno', 'carla']);
  assert.deepEqual(plain(handoff.enqueue('bruno')), ['bruno', 'carla']);
  assert.equal(handoff.removeFromQueue('bruno'), true);
  assert.deepEqual(plain(handoff.snapshot().queue), ['carla']);

  handoff.enqueue({id: 'diego', name: 'Diego'});
  const state = handoff.snapshot();
  assert.deepEqual(plain(state.queue), ['carla', 'diego']);
  assert.equal(state.speakers.find(speaker => speaker.id === 'diego').name, 'Diego');
  assert.equal(state.speakers.find(speaker => speaker.id === 'diego').role, 'speaker');
  assert.throws(
    () => handoff.enqueue({id: 'hostile', name: 'Hostile', role: 'audience'}),
    /role must/
  );
  assert.throws(() => handoff.enqueue('ana'), /Controller cannot be queued/);
  handoff.destroy();
});

test('transfers control to the first queued speaker after a deterministic countdown', async () => {
  const api = await loadHandoff();
  const clock = fakeClock(10000);
  const handoff = createModerator(api, {...clock});
  handoff.enqueue('bruno');
  handoff.enqueue('carla');

  const transfer = handoff.requestHandoff('bruno', {countdownMs: 5000});
  assert.equal(transfer.fromSpeakerId, 'ana');
  assert.equal(transfer.toSpeakerId, 'bruno');
  assert.equal(transfer.status, 'countdown');
  assert.equal(transfer.remainingMs, 5000);
  assert.equal(handoff.snapshot().controllerId, 'ana');

  clock.advance(4999);
  assert.equal(handoff.snapshot().controllerId, 'ana');
  assert.equal(handoff.snapshot().handoff.remainingMs, 1);
  clock.advance(1);
  assert.equal(handoff.snapshot().controllerId, 'bruno');
  assert.deepEqual(plain(handoff.snapshot().queue), ['carla']);
  assert.equal(handoff.snapshot().handoff, null);
  handoff.destroy();
});

test('cancels an active countdown without changing control or queue order', async () => {
  const api = await loadHandoff();
  const clock = fakeClock();
  const handoff = createModerator(api, {...clock});
  handoff.enqueue('bruno');
  const transfer = handoff.requestHandoff('bruno', {countdownMs: 3000});

  clock.advance(1200);
  assert.equal(handoff.cancelHandoff(transfer.id), true);
  assert.equal(handoff.cancelHandoff(transfer.id), false);
  clock.advance(5000);
  const state = handoff.snapshot();
  assert.equal(state.controllerId, 'ana');
  assert.deepEqual(plain(state.queue), ['bruno']);
  assert.equal(state.handoff, null);
  handoff.destroy();
});

test('accepts a handoff early when the engine actor is a moderator', async () => {
  const api = await loadHandoff();
  const clock = fakeClock();
  const handoff = createModerator(api, {...clock});
  handoff.enqueue('bruno');
  const transfer = handoff.requestHandoff('bruno', {countdownMs: 10000});

  clock.advance(1000);
  assert.equal(handoff.acceptHandoff(transfer.id), true);
  assert.equal(handoff.acceptHandoff(transfer.id), false);
  assert.equal(handoff.snapshot().controllerId, 'bruno');
  assert.deepEqual(plain(handoff.snapshot().queue), []);
  handoff.destroy();
});

test('enforces identity, role capabilities, queue order and active-handoff invariants', async () => {
  const api = await loadHandoff();
  const clock = fakeClock();
  const speakerEngine = api.create({
    presentationId: 'speaker-capabilities',
    speakers: people(),
    actorId: 'bruno',
    initialControllerId: 'ana',
    idFactory: ids('bruno'),
    ...clock
  });

  assert.throws(
    () => speakerEngine.updateSpeakerState('ana', {slideIndex: 2, notes: '', reference: ''}),
    /only update their own/
  );
  assert.throws(() => speakerEngine.enqueue('carla'), /cannot edit the queue/);
  speakerEngine.updateSpeakerState('bruno', {
    slideIndex: 4,
    notes: 'Mi nota privada',
    reference: {notesScrollTop: 72, promptPlaying: true}
  });
  const brunoState = speakerEngine.snapshot().speakers.find(speaker => speaker.id === 'bruno').state;
  assert.equal(brunoState.slideIndex, 4);
  assert.deepEqual(plain(brunoState.reference), {notesScrollTop: 72, promptPlaying: true});
  speakerEngine.destroy();

  const moderator = createModerator(api, {...clock});
  moderator.enqueue('bruno');
  moderator.enqueue('carla');
  assert.throws(
    () => moderator.requestHandoff('carla', {countdownMs: 2000}),
    /first queued speaker/
  );
  const transfer = moderator.requestHandoff('bruno', {countdownMs: 2000});
  assert.throws(() => moderator.removeFromQueue('bruno'), /active handoff/);
  assert.throws(() => moderator.requestHandoff('bruno'), /already active/);
  moderator.cancelHandoff(transfer.id);
  moderator.destroy();
});

test('applies event ids once and never emits duplicate state transitions', async () => {
  const api = await loadHandoff();
  const handoff = createModerator(api);
  let capturedEvent;
  let changes = 0;
  handoff.onChange((_state, event) => {
    if (event) {
      capturedEvent = event;
      changes += 1;
    }
  });

  handoff.updateSpeakerState('ana', {
    slideIndex: 7,
    notes: 'Recordatorio',
    reference: 'internal://slide-7'
  });
  assert.equal(changes, 1);
  assert.equal(handoff.applyEvent(capturedEvent), false);
  assert.equal(handoff.applyEvent(structuredClone(capturedEvent)), false);
  assert.equal(changes, 1);
  assert.equal(handoff.snapshot().revision, 1);
  handoff.destroy();
});

test('recovers exact per-speaker private state, queue and pending countdown from bounded local storage', async () => {
  const api = await loadHandoff();
  const clock = fakeClock(50000);
  const storage = fakeStorage();
  const first = createModerator(api, {
    ...clock,
    storage,
    storageKey: 'handoff.private.recovery',
    idFactory: ids('first')
  });
  first.updateSpeakerState('ana', {
    slideIndex: 8,
    notes: 'Citar el dato reservado del comité',
    reference: 'private://appendix/a'
  });
  first.updateSpeakerState('bruno', {
    slideIndex: 11,
    notes: 'Abrir la demo local',
    reference: 'private://demo/b'
  });
  first.enqueue('bruno');
  first.enqueue('carla');
  const transfer = first.requestHandoff('bruno', {countdownMs: 5000});
  const before = first.snapshot();
  first.destroy();

  clock.advance(2000);
  const recovered = createModerator(api, {
    ...clock,
    storage,
    storageKey: 'handoff.private.recovery',
    idFactory: ids('recovered')
  });
  const after = recovered.snapshot();
  assert.equal(after.persistence.status, 'persisted');
  assert.equal(after.revision, before.revision);
  assert.equal(after.controllerId, 'ana');
  assert.deepEqual(plain(after.queue), ['bruno', 'carla']);
  assert.deepEqual(plain(after.speakers), plain(before.speakers));
  assert.equal(after.handoff.id, transfer.id);
  assert.equal(after.handoff.executeAt, transfer.executeAt);
  assert.equal(after.handoff.remainingMs, 3000);

  clock.advance(3000);
  assert.equal(recovered.snapshot().controllerId, 'bruno');
  assert.deepEqual(plain(recovered.snapshot().queue), ['carla']);
  recovered.destroy();

  assert.ok(storage.writes.length > 0);
  assert.ok(storage.writes.every(write => write.key === 'handoff.private.recovery'));
  assert.ok(storage.writes.every(write => write.value.length <= api.limits.maxStorageBytes));
});

test('audience snapshots are allowlisted and never contain notes, references or inactive slide state', async () => {
  const api = await loadHandoff();
  const clock = fakeClock();
  const handoff = createModerator(api, {...clock});
  handoff.updateSpeakerState('ana', {
    slideIndex: 6,
    notes: 'SECRETO-NOTAS-ANA',
    reference: 'SECRETO-REF-ANA'
  });
  handoff.updateSpeakerState('bruno', {
    slideIndex: 99,
    notes: 'SECRETO-NOTAS-BRUNO',
    reference: 'SECRETO-REF-BRUNO'
  });
  handoff.enqueue('bruno');
  handoff.requestHandoff('bruno', {countdownMs: 5000});

  const audience = handoff.audienceSnapshot();
  const serialized = JSON.stringify(audience);
  assert.equal(audience.activeSlideIndex, 6);
  assert.equal(audience.controller.id, 'ana');
  assert.equal(audience.queue[0].id, 'bruno');
  assert.equal(audience.handoff.to.id, 'bruno');
  assert.doesNotMatch(serialized, /SECRETO|notes|reference|state|99/);
  assert.deepEqual(
    plain(Object.keys(audience).sort()),
    ['activeSlideIndex', 'controller', 'handoff', 'presentationId', 'queue', 'revision', 'version']
  );
  handoff.destroy();
});

test('rejects accessor payloads, unsafe controls and values beyond private persistence limits', async () => {
  const api = await loadHandoff();
  const handoff = createModerator(api);
  let accessorExecuted = false;

  assert.throws(
    () => handoff.addSpeaker(Object.defineProperty({}, 'id', {
      get() { accessorExecuted = true; throw new Error('must not execute'); }
    })),
    /only accepts/
  );
  assert.equal(accessorExecuted, false);
  const hostileEvent = Object.defineProperty({}, 'id', {
    enumerable: true,
    get() { accessorExecuted = true; return 'event:hostile'; }
  });
  assert.throws(() => handoff.applyEvent(hostileEvent), /Invalid speaker handoff event/);
  assert.equal(accessorExecuted, false);
  const hostileReference = [];
  Object.defineProperty(hostileReference, '0', {
    enumerable: true,
    get() { accessorExecuted = true; return 'private'; }
  });
  hostileReference.length = 1;
  assert.throws(
    () => handoff.updateSpeakerState('ana', {
      slideIndex: 1,
      notes: '',
      reference: hostileReference
    }),
    /safe JSON data/
  );
  assert.equal(accessorExecuted, false);
  assert.throws(
    () => handoff.updateSpeakerState('ana', {
      slideIndex: 1,
      notes: 'x'.repeat(api.limits.maxNotesLength + 1),
      reference: ''
    }),
    /notes/
  );
  assert.throws(
    () => handoff.updateSpeakerState('ana', {
      slideIndex: 1,
      notes: 'unsafe\u0000',
      reference: ''
    }),
    /notes/
  );
  assert.throws(
    () => handoff.requestHandoff('bruno', {countdownMs: api.limits.maxCountdownMs + 1}),
    /countdownMs/
  );
  handoff.destroy();
});

test('clearPersistence only removes the presentation-scoped private record', async () => {
  const api = await loadHandoff();
  const storage = fakeStorage();
  storage.setItem('unrelated', 'keep-me');
  const handoff = createModerator(api, {
    storage,
    storageKey: 'handoff.private.clear',
    idFactory: ids('clear')
  });
  handoff.updateSpeakerState('ana', {
    slideIndex: 2,
    notes: 'Temporal',
    reference: 'private://temporary'
  });
  assert.equal(storage.values.has('handoff.private.clear'), true);
  assert.equal(handoff.clearPersistence(), true);
  assert.equal(storage.values.has('handoff.private.clear'), false);
  assert.equal(storage.getItem('unrelated'), 'keep-me');
  handoff.destroy();
});
