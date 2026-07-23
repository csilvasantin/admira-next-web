import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

async function loadBackchannel(context = {}) {
  const source = await readFile(
    new URL('../assets/presentation-production-backchannel.js', import.meta.url),
    'utf8'
  );
  const sandbox = {...context};
  vm.runInNewContext(source, sandbox);
  return sandbox.AdmiraProductionBackchannel;
}

function fakeClock(start = 1000) {
  let value = start;
  const timers = new Map();
  let sequence = 0;
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
          .sort((a, b) => a[1].at - b[1].at)[0];
        if (due) {
          timers.delete(due[0]);
          due[1].fn();
        }
      } while (due);
    }
  };
}

function fakeBroadcastChannel() {
  const channels = new Map();
  return class FakeBroadcastChannel {
    constructor(name) {
      this.name = name;
      this.onmessage = null;
      const peers = channels.get(name) || [];
      peers.push(this);
      channels.set(name, peers);
    }
    postMessage(message) {
      for (const peer of channels.get(this.name) || []) {
        if (peer !== this && peer.onmessage) peer.onmessage({data: structuredClone(message)});
      }
    }
    close() {
      const peers = channels.get(this.name) || [];
      channels.set(this.name, peers.filter(peer => peer !== this));
    }
  };
}

function ids(prefix) {
  let sequence = 0;
  return () => `${prefix}:${++sequence}`;
}

test('operator cues reach the presenter with priority, bounded TTL and isolated snapshots', async () => {
  const api = await loadBackchannel();
  const BroadcastChannel = fakeBroadcastChannel();
  const clock = fakeClock();
  const shared = {channelName: 'deck-production-42', BroadcastChannel, ...clock};
  const operator = api.create({...shared, role: 'operator', idFactory: ids('operator')});
  const presenter = api.create({...shared, role: 'presenter', idFactory: ids('presenter')});

  const cue = operator.sendCue({text: 'Cierra la demo en 30 segundos', priority: 'urgent', ttlMs: 5000});

  assert.deepEqual(
    JSON.parse(JSON.stringify(presenter.snapshot().cues)),
    JSON.parse(JSON.stringify([cue]))
  );
  assert.equal(cue.status, 'active');
  assert.equal(cue.expiresAt, 6000);
  assert.equal(operator.snapshot().transport, 'broadcast-channel');
  operator.destroy();
  presenter.destroy();
});

test('acknowledgement is idempotent and synchronized to the operator', async () => {
  const api = await loadBackchannel();
  const BroadcastChannel = fakeBroadcastChannel();
  const clock = fakeClock();
  const shared = {channelName: 'ack-room', BroadcastChannel, ...clock};
  const operator = api.create({...shared, role: 'operator', idFactory: ids('operator')});
  const presenter = api.create({...shared, role: 'presenter', idFactory: ids('presenter')});
  const cue = operator.sendCue({text: 'Da paso a preguntas'});
  let changes = 0;
  presenter.onChange(() => { changes += 1; });

  assert.equal(presenter.acknowledge(cue.id), true);
  assert.equal(presenter.acknowledge(cue.id), true);
  assert.equal(changes, 2, 'initial subscription plus one real transition');
  assert.equal(presenter.snapshot().cues[0].status, 'acknowledged');
  assert.equal(operator.snapshot().cues[0].status, 'acknowledged');
  operator.destroy();
  presenter.destroy();
});

test('active cues expire deterministically and cannot be acknowledged afterwards', async () => {
  const api = await loadBackchannel();
  const BroadcastChannel = fakeBroadcastChannel();
  const clock = fakeClock(10000);
  const shared = {channelName: 'expiry-room', BroadcastChannel, ...clock};
  const operator = api.create({...shared, role: 'operator', idFactory: ids('operator')});
  const presenter = api.create({...shared, role: 'presenter', idFactory: ids('presenter')});
  const cue = operator.sendCue({text: 'Aviso efímero', ttlMs: 1000});

  clock.advance(999);
  assert.equal(presenter.snapshot().cues[0].status, 'active');
  clock.advance(1);
  assert.equal(presenter.snapshot().cues[0].status, 'expired');
  assert.equal(operator.snapshot().cues[0].status, 'expired');
  assert.equal(presenter.acknowledge(cue.id), false);
  operator.destroy();
  presenter.destroy();
});

test('payload allowlist rejects hostile fields, accessors, controls and abusive limits', async () => {
  const api = await loadBackchannel();
  const operator = api.create({
    role: 'operator',
    channelName: 'hostile-room',
    BroadcastChannel: fakeBroadcastChannel(),
    idFactory: ids('operator')
  });

  assert.throws(
    () => operator.sendCue({text: 'hola', audienceHtml: '<script>alert(1)</script>'}),
    /only accepts/
  );
  assert.throws(
    () => operator.sendCue({text: 'hola', [Symbol('hidden')]: 'payload'}),
    /only accepts/
  );
  assert.throws(
    () => operator.sendCue(Object.defineProperty({}, 'text', {get() { throw new Error('executed'); }})),
    /only accepts/
  );
  assert.throws(() => operator.sendCue({text: 'oculto\u0000'}), /safe characters/);
  assert.throws(() => operator.sendCue({text: 'x'.repeat(501)}), /safe characters/);
  assert.throws(() => operator.sendCue({text: 'hola', ttlMs: 999}), /ttlMs/);
  assert.throws(() => operator.sendCue({text: 'hola', priority: 'critical'}), /priority/);
  operator.destroy();
});

test('role capabilities are enforced and audience-like roles cannot join', async () => {
  const api = await loadBackchannel();
  const BroadcastChannel = fakeBroadcastChannel();
  const operator = api.create({
    role: 'operator', channelName: 'role-room', BroadcastChannel, idFactory: ids('operator')
  });
  const presenter = api.create({
    role: 'presenter', channelName: 'role-room', BroadcastChannel, idFactory: ids('presenter')
  });

  assert.throws(() => presenter.sendCue({text: 'No permitido'}), /Only the operator/);
  assert.throws(() => operator.acknowledge('cue:unknown'), /Only the presenter/);
  assert.throws(
    () => api.create({role: 'audience', channelName: 'role-room', BroadcastChannel}),
    /role must/
  );
  operator.destroy();
  presenter.destroy();
});

test('different channel names are completely isolated', async () => {
  const api = await loadBackchannel();
  const BroadcastChannel = fakeBroadcastChannel();
  const operator = api.create({
    role: 'operator', channelName: 'private-a', BroadcastChannel, idFactory: ids('operator')
  });
  const rightPresenter = api.create({
    role: 'presenter', channelName: 'private-a', BroadcastChannel, idFactory: ids('right')
  });
  const wrongPresenter = api.create({
    role: 'presenter', channelName: 'private-b', BroadcastChannel, idFactory: ids('wrong')
  });

  operator.sendCue({text: 'Solo canal A', priority: 'high'});
  assert.equal(rightPresenter.snapshot().cues.length, 1);
  assert.equal(wrongPresenter.snapshot().cues.length, 0);
  operator.destroy();
  rightPresenter.destroy();
  wrongPresenter.destroy();
});

test('fallback works in-process and localStorage signals never contain cue text', async () => {
  const writes = [];
  const posts = [];
  const storage = {
    setItem(key, value) { writes.push({key, value}); },
    removeItem() {}
  };
  const related = {
    location: {origin: 'https://presenter.test'},
    postMessage(value) { posts.push(value); }
  };
  const fakeWindow = {
    location: {origin: 'https://presenter.test'},
    opener: related,
    parent: null,
    addEventListener() {},
    removeEventListener() {}
  };
  fakeWindow.parent = fakeWindow;
  const api = await loadBackchannel();
  const shared = {
    channelName: 'fallback-room',
    BroadcastChannel: null,
    storage,
    window: fakeWindow
  };
  const operator = api.create({...shared, role: 'operator', idFactory: ids('operator')});
  const presenter = api.create({...shared, role: 'presenter', idFactory: ids('presenter')});
  const cue = operator.sendCue({text: 'Secreto de producción'});
  presenter.acknowledge(cue.id);

  assert.equal(presenter.snapshot().cues[0].text, 'Secreto de producción');
  assert.equal(operator.snapshot().cues[0].status, 'acknowledged');
  assert.ok(writes.length >= 1);
  assert.equal(writes.some(write => write.value.includes('Secreto de producción')), false);
  assert.equal(posts.some(post => JSON.stringify(post).includes('Secreto de producción')), false);
  assert.equal(operator.snapshot().transport, 'memory+same-origin-postmessage+storage-signal');
  operator.destroy();
  presenter.destroy();
});

test('late presenter receives active operator cues through the hello resync', async () => {
  const api = await loadBackchannel();
  const BroadcastChannel = fakeBroadcastChannel();
  const clock = fakeClock();
  const operator = api.create({
    role: 'operator',
    channelName: 'late-room',
    BroadcastChannel,
    ...clock,
    idFactory: ids('operator')
  });
  const cue = operator.sendCue({text: 'Cue anterior', ttlMs: 5000});
  const presenter = api.create({
    role: 'presenter',
    channelName: 'late-room',
    BroadcastChannel,
    ...clock,
    idFactory: ids('presenter')
  });

  assert.equal(presenter.snapshot().cues[0].id, cue.id);
  operator.destroy();
  presenter.destroy();
});

test('the module is offline-only and does not persist sensitive cue content', async () => {
  const source = await readFile(
    new URL('../assets/presentation-production-backchannel.js', import.meta.url),
    'utf8'
  );
  assert.doesNotThrow(() => new Function(source));
  assert.match(source, /AdmiraProductionBackchannel/);
  assert.match(source, /BroadcastChannel/);
  assert.match(source, /postMessage/);
  assert.match(source, /localStorage/);
  assert.doesNotMatch(source, /\bfetch\s*\(|WebSocket|EventSource|sendBeacon/);
  assert.doesNotMatch(source, /localStorage\.setItem/);
  assert.match(source, /message\.type === 'cue'\) return/);
});
