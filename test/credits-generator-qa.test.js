import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const kernelSource = await readFile(new URL('../creditos/kernel.js', import.meta.url), 'utf8');
const appSource = await readFile(new URL('../creditos/app.js', import.meta.url), 'utf8');
const indexSource = await readFile(new URL('../creditos/index.html', import.meta.url), 'utf8');

function canvasContext(trace = []) {
  const ctx = {
    font: '', fillStyle: '', strokeStyle: '', globalAlpha: 1, textAlign: '', textBaseline: '', lineWidth: 1,
    measureText(text) { return { width: Array.from(String(text)).length * 18 }; },
    createRadialGradient() { return { addColorStop(...args) { trace.push(['stop', ...args]); } }; }
  };
  for (const name of ['beginPath', 'moveTo', 'lineTo', 'arcTo', 'closePath', 'fillRect', 'stroke',
    'fillText', 'save', 'restore', 'rect', 'clip']) {
    ctx[name] = (...args) => trace.push([name, ...args]);
  }
  return ctx;
}

function loadKernel() {
  const context = vm.createContext({});
  vm.runInContext(kernelSource, context);
  return { context, kernel: context.AdmiraCreditsKernel };
}

class FakeElement {
  constructor(id = '', tagName = 'div') {
    this.id = id;
    this.tagName = tagName.toUpperCase();
    this.value = '';
    this.textContent = '';
    this.innerHTML = '';
    this.hidden = false;
    this.disabled = false;
    this.style = {};
    this.dataset = {};
    this.children = [];
    this.attributes = {};
    this.listeners = {};
    this.parentNode = null;
  }
  addEventListener(type, listener) { (this.listeners[type] ||= []).push(listener); }
  dispatch(type, extra = {}) {
    const event = { target: this, preventDefault() { this.defaultPrevented = true; }, ...extra };
    for (const listener of this.listeners[type] || []) listener(event);
    return event;
  }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name]; }
  appendChild(child) { child.parentNode = this; this.children.push(child); return child; }
  replaceChildren(...children) { this.children = []; children.forEach((child) => this.appendChild(child)); }
  remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter((item) => item !== this); }
  click() { this.dispatch('click'); }
  closest(selector) {
    if (/input/.test(selector) && this.tagName === 'INPUT') return this;
    if (/textarea/.test(selector) && this.tagName === 'TEXTAREA') return this;
    if (/select/.test(selector) && this.tagName === 'SELECT') return this;
    if (/button/.test(selector) && this.tagName === 'BUTTON') return this;
    if (/contenteditable/.test(selector) && this.attributes.contenteditable === 'true') return this;
    return null;
  }
  requestFullscreen() { return Promise.resolve(); }
}

const fieldDefaults = {
  'project-title': 'Demo', 'project-kicker': 'Kicker',
  'credits-input': '[TEAM]\nRole | Name\nA single line',
  'final-message': 'Thanks', format: 'wide', theme: 'signal', duration: '8'
};

function appHarness(options = {}) {
  const { kernel } = loadKernel();
  const ids = [
    ...Object.keys(fieldDefaults), 'credits-canvas', 'duration-output', 'timecode', 'play-pause',
    'stage-play', 'export-html', 'export-video', 'export-cancel', 'export-progress',
    'export-progress-bar', 'export-progress-label', 'live-status', 'storage-status',
    'diagnostics-list', 'adjust-duration', 'credits-transcript', 'credits-form',
    'load-example', 'clear-data', 'restart', 'fullscreen', 'stage-wrap'
  ];
  const elements = Object.fromEntries(ids.map((id) => [id, new FakeElement(id,
    /input|title|kicker|message|duration$/.test(id) ? 'input'
      : id === 'credits-input' ? 'textarea'
        : id === 'format' || id === 'theme' ? 'select'
          : /play|export|cancel|example|clear|restart|fullscreen|adjust/.test(id) ? 'button' : 'div')]));
  Object.entries(fieldDefaults).forEach(([id, value]) => { elements[id].value = value; });
  const trace = [];
  elements['credits-canvas'].getContext = () => canvasContext(trace);
  elements['credits-canvas'].captureStream = options.captureStream === false ? undefined
    : () => options.stream || { getTracks: () => [] };
  const documentListeners = {};
  const body = new FakeElement('body', 'body');
  const document = {
    body, activeElement: body, hidden: false, fullscreenElement: null,
    getElementById: (id) => elements[id],
    createElement: (tag) => new FakeElement('', tag),
    addEventListener(type, listener) { (documentListeners[type] ||= []).push(listener); },
    exitFullscreen() { this.fullscreenElement = null; }
  };
  const raf = [];
  const cancelled = new Set();
  const windowListeners = {};
  const media = { matches: Boolean(options.reduced), addEventListener() {}, addListener() {} };
  const storage = options.storage || {
    values: new Map(),
    getItem(key) { return this.values.get(key) ?? null; },
    setItem(key, value) { this.values.set(key, String(value)); },
    removeItem(key) { this.values.delete(key); }
  };
  const downloads = [];
  let now = 0;
  const windowObject = {
    AdmiraCreditsKernel: kernel,
    AdmiraCreditsKernelFactory: loadKernel().context.AdmiraCreditsKernelFactory,
    matchMedia: () => media,
    addEventListener(type, listener) { (windowListeners[type] ||= []).push(listener); },
    setTimeout: () => 1
  };
  const context = vm.createContext({
    window: windowObject, document, Element: FakeElement, localStorage: storage,
    MediaRecorder: options.MediaRecorder,
    performance: { now: () => now },
    requestAnimationFrame(callback) { raf.push(callback); return raf.length; },
    cancelAnimationFrame(id) { cancelled.add(id); },
    setTimeout: () => 1, clearTimeout() {},
    Blob, DOMException,
    URL: {
      createObjectURL(blob) { downloads.push({ blob, anchor: null }); return `blob:${downloads.length}`; },
      revokeObjectURL() {}
    }
  });
  vm.runInContext(appSource, context);
  return {
    context, elements, trace, storage, downloads, media,
    hooks: windowObject.AdmiraCreditsAppTestHooks,
    keydown(event) { for (const listener of windowListeners.keydown || []) listener(event); },
    runRaf(time) {
      now = time;
      const pending = raf.splice(0);
      pending.forEach((callback, index) => { if (!cancelled.has(index + 1)) callback(time); });
    }
  };
}

test('parser preserves semantic content, Unicode and hard bounds on hostile input', () => {
  const { kernel } = loadKernel();
  const parsed = kernel.parseCredits('[ ]\r\n| Nombre\r\nRol |\r\nUno | Dos | Tres\r\n👩🏽‍💻'.repeat(40));
  assert.equal(parsed.rows[0].text, 'SECCIÓN');
  assert.deepEqual([parsed.rows[1].role, parsed.rows[1].name], ['—', 'Nombre']);
  assert.deepEqual([parsed.rows[2].role, parsed.rows[2].name], ['Rol', '—']);
  assert.equal(parsed.rows[3].name, 'Dos | Tres');
  assert.ok(parsed.rows.some((row) => JSON.stringify(row).includes('👩🏽‍💻')));
  assert.ok(parsed.rows.length <= kernel.LIMITS.maxLines);
  assert.ok(parsed.diagnostics.some((item) => item.code === 'empty-section'));
  assert.ok(parsed.diagnostics.filter((item) => item.code === 'empty-pair-side').length >= 2);
});

test('all 3 formats × 4 themes share parser, analysis and renderer semantics', () => {
  const { context, kernel } = loadKernel();
  const recreated = vm.runInContext(`(${context.AdmiraCreditsKernelFactory.toString()})()`, context);
  const credits = '[TEAM]\nRole | Name\nUna línea larguísima ' + 'sinseparadores'.repeat(30);
  for (const format of Object.keys(kernel.FORMATS)) {
    for (const theme of Object.keys(kernel.THEMES)) {
      const data = { projectTitle: '<Proyecto>', credits, finalMessage: 'Fin', format, theme, duration: 8 };
      assert.equal(JSON.stringify(recreated.analyze(data)), JSON.stringify(kernel.analyze(data)));
      const layout = kernel.getLayout(canvasContext(), data);
      assert.equal(layout.format, kernel.FORMATS[format]);
      assert.ok(layout.contentHeight > 0);
      for (const elapsed of [0, 4, 8]) {
        const result = kernel.renderAt(canvasContext(), data, elapsed);
        assert.equal(result.data.format, format);
        assert.equal(result.data.theme, theme);
        assert.equal(JSON.stringify(result.analysis.rows.map(({ lines, roleLines, nameLines, ...row }) => row)),
          JSON.stringify(kernel.parseCredits(credits).rows));
      }
    }
  }
});

test('dense credits produce bounded duration guidance and wrapped layouts', () => {
  const { kernel } = loadKernel();
  const credits = Array.from({ length: 120 }, (_, index) => `Responsabilidad ${index} | Persona ${index}`).join('\n');
  for (const format of Object.keys(kernel.FORMATS)) {
    const analysis = kernel.analyze({ credits, format, duration: 8 });
    assert.ok(analysis.recommendedDuration > 8);
    assert.ok(analysis.recommendedDuration <= 90);
    assert.ok(analysis.diagnostics.some((item) => item.code === 'duration-short'));
    const layout = kernel.getLayout(canvasContext(), { credits: `X${'y'.repeat(600)}`, format, duration: 8 });
    assert.ok(layout.rows[0].lines.length > 1);
  }
});

test('standalone HTML is inert to script injection, self-contained and compilable for every variant', () => {
  const harness = appHarness();
  for (const format of ['wide', 'vertical', 'square']) {
    for (const theme of ['signal', 'electric', 'warm', 'mono']) {
      const html = harness.hooks.htmlDocument({
        projectTitle: '</title><script>globalThis.pwned=1</script>',
        projectKicker: 'Árbol', credits: '[TEAM]\nRole | </script><img src=x onerror=1>',
        finalMessage: 'Fin 👩🏽‍💻', format, theme, duration: 8
      });
      assert.equal((html.match(/<script>/g) || []).length, 1);
      assert.doesNotMatch(html, /<script>globalThis\.pwned/);
      assert.doesNotMatch(html, /<script src=|<link /);
      const script = html.match(/<script>([\s\S]*)<\/script>/)?.[1];
      assert.ok(script);
      assert.doesNotThrow(() => new Function(script));
      assert.match(html, /\\u003c\/script>/);
    }
  }
});

test('standalone reduced-motion execution uses the shared renderer and creates a transcript without RAF', () => {
  const harness = appHarness();
  const html = harness.hooks.htmlDocument({
    projectTitle: 'Demo', projectKicker: 'K', credits: '[TEAM]\nRole | Name',
    finalMessage: 'Fin', format: 'square', theme: 'warm', duration: 8
  });
  const script = html.match(/<script>([\s\S]*)<\/script>/)[1];
  const canvas = { width: 0, height: 0, getContext: () => canvasContext() };
  const section = { textContent: '' };
  let rafCount = 0;
  vm.runInNewContext(script, {
    document: { querySelector: (selector) => selector === 'canvas' ? canvas : section },
    matchMedia: () => ({ matches: true }),
    requestAnimationFrame: () => { rafCount += 1; },
    performance: { now: () => 0 }
  });
  assert.equal(rafCount, 0);
  assert.equal(canvas.width, 1080);
  assert.match(section.textContent, /Demo.*TEAM.*Role: Name.*Fin/);
});

test('blocked and corrupt storage never abort startup and corrupt drafts are discarded', () => {
  const blocked = {
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('blocked'); },
    removeItem() { throw new Error('blocked'); }
  };
  const first = appHarness({ storage: blocked });
  assert.equal(first.hooks.safeStorage('get', 'x').ok, false);
  assert.match(first.elements['storage-status'].textContent, /no está disponible/i);

  const values = new Map([['admiranext-credits-v2', '{broken']]);
  const corrupt = {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
  const second = appHarness({ storage: corrupt });
  assert.equal(values.has('admiranext-credits-v2'), false);
  assert.match(second.elements['storage-status'].textContent, /dañado/i);
});

test('keyboard, progress, transcript and reduced-motion accessibility contracts remain functional', () => {
  assert.match(indexSource, /id="export-progress-bar"[^>]*role="progressbar"[^>]*aria-valuemin="0"[^>]*aria-valuemax="100"/);
  assert.match(indexSource, /id="credits-canvas"[^>]*aria-describedby="credits-transcript"/);
  const regular = appHarness();
  let prevented = false;
  regular.keydown({ code: 'Space', target: regular.elements['stage-wrap'], preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(regular.hooks.getState().playing, true);
  regular.keydown({ code: 'Space', target: regular.elements['project-title'], preventDefault() { throw new Error('must not prevent'); } });
  assert.equal(regular.hooks.getState().playing, true);
  assert.deepEqual(regular.elements['credits-transcript'].children.map((item) => item.textContent),
    ['Demo', 'TEAM', 'Role: Name', 'A single line', 'Thanks']);

  const reduced = appHarness({ reduced: true });
  assert.equal(reduced.elements['play-pause'].disabled, true);
  assert.equal(reduced.elements['stage-play'].hidden, true);
  reduced.elements['play-pause'].click();
  assert.equal(reduced.hooks.getState().playing, false);
  assert.match(reduced.elements['live-status'].textContent, /Movimiento reducido/i);
});

test('MediaRecorder absence and constructor/start failures reset UI and stop tracks', async () => {
  const absent = appHarness({ MediaRecorder: undefined });
  await absent.hooks.exportVideo();
  assert.match(absent.elements['live-status'].textContent, /HTML autónomo/);
  assert.equal(absent.hooks.getState().exporting, false);

  for (const phase of ['constructor', 'start']) {
    let stopped = 0;
    class BrokenRecorder {
      static isTypeSupported() { return true; }
      constructor() {
        this.state = 'inactive';
        if (phase === 'constructor') throw new Error('constructor boom');
      }
      start() { this.state = 'recording'; throw new Error('start boom'); }
      stop() { this.state = 'inactive'; }
    }
    const harness = appHarness({
      MediaRecorder: BrokenRecorder,
      stream: { getTracks: () => [{ stop() { stopped += 1; } }] }
    });
    await harness.hooks.exportVideo();
    assert.match(harness.elements['live-status'].textContent, /boom/);
    assert.equal(stopped, 1);
    assert.equal(harness.elements['export-video'].disabled, false);
    assert.equal(harness.elements['export-progress'].hidden, true);
    assert.equal(harness.hooks.getState().exporting, false);
  }
});

test('MediaRecorder success maps MIME to extension, emits progress, cleans up and blocks reentry', async () => {
  let constructed = 0;
  let tracksStopped = 0;
  class Recorder {
    static isTypeSupported(type) { return type.includes('mp4'); }
    constructor(stream, options) { constructed += 1; this.state = 'inactive'; this.mimeType = options.mimeType; }
    start() { this.state = 'recording'; }
    stop() {
      if (this.state === 'inactive') return;
      this.state = 'inactive';
      this.ondataavailable?.({ data: new Blob(['video'], { type: this.mimeType }) });
      this.onstop?.();
    }
  }
  const harness = appHarness({
    MediaRecorder: Recorder,
    stream: { getTracks: () => [{ stop() { tracksStopped += 1; } }] }
  });
  const first = harness.hooks.exportVideo();
  const second = harness.hooks.exportVideo();
  assert.equal(constructed, 1);
  harness.runRaf(8001);
  await first;
  await second;
  assert.equal(harness.downloads.length, 1);
  assert.equal(harness.downloads[0].blob.type, 'video/mp4;codecs=avc1');
  assert.equal(harness.elements['export-progress-bar'].getAttribute('aria-valuenow'), '100');
  assert.equal(tracksStopped, 1);
  assert.equal(harness.hooks.getState().exporting, false);
  assert.equal(harness.hooks.extensionForMime('video/ogg'), 'ogv');
  assert.equal(harness.hooks.extensionForMime('video/webm;codecs=vp9'), 'webm');
});

test('MediaRecorder early stop, error, no chunks and cancellation never download and always clean up', async () => {
  for (const mode of ['early', 'error', 'empty', 'cancel']) {
    let tracksStopped = 0;
    let instance;
    class Recorder {
      static isTypeSupported() { return true; }
      constructor() { instance = this; this.state = 'inactive'; this.mimeType = 'video/webm'; }
      start() {
        this.state = 'recording';
        queueMicrotask(() => {
          if (mode === 'early') { this.state = 'inactive'; this.onstop?.(); }
          if (mode === 'error') this.onerror?.();
        });
      }
      stop() {
        if (this.state === 'inactive') return;
        this.state = 'inactive';
        if (mode !== 'empty' && mode !== 'cancel') this.ondataavailable?.({ data: new Blob(['x']) });
        this.onstop?.();
      }
    }
    const harness = appHarness({
      MediaRecorder: Recorder,
      stream: { getTracks: () => [{ stop() { tracksStopped += 1; } }] }
    });
    const exporting = harness.hooks.exportVideo();
    if (mode === 'empty') harness.runRaf(8001);
    if (mode === 'cancel') harness.hooks.cancelVideoExport();
    await exporting;
    assert.equal(harness.downloads.length, 0, mode);
    assert.equal(tracksStopped, 1, mode);
    assert.equal(harness.hooks.getState().exporting, false, mode);
    assert.match(harness.elements['live-status'].textContent,
      mode === 'cancel' ? /cancelada/i : /No se pudo|terminó antes/i);
    assert.equal(instance.state, 'inactive');
  }
});
