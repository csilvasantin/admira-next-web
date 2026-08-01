const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const core = require('../assets/tiktok-core.js');

test('genera un plan vertical de tres escenas y quince segundos', () => {
  const plan = core.buildPlan({
    task: 'Encontrar acciones dentro de un PDF',
    solution: 'Súbelo a NotebookLM y pide tres acciones',
    result: 'Un plan claro',
    audience: 'Equipos con poco tiempo',
    cta: 'Guárdalo',
    presenter: 'fusion',
    tone: 'energetic'
  }, 0);

  assert.equal(plan.duration, 15);
  assert.deepEqual(plan.format, { width: 1080, height: 1920, aspectRatio: '9:16', fps: 30 });
  assert.equal(plan.scenes.length, 3);
  assert.deepEqual(plan.scenes.map(({ from, to }) => [from, to]), [[0, 3], [3, 11], [11, 15]]);
  assert.match(plan.script, /Menos clics\. Más hecho\./);
  assert.match(plan.grokPrompt, /PURE VIDEO CONTRACT/);
  assert.match(plan.grokPrompt, /9:16/);
  assert.ok(plan.grokPrompt.length <= 3000);
  assert.ok(plan.pace.words > 0);
});

test('limpia y acota el contenido aportado por el usuario', () => {
  const plan = core.buildPlan({
    task: `  Una tarea\ncon espacios ${'muy '.repeat(80)}larga  `,
    solution: 'Primer paso\u0000segundo paso',
    presenter: 'desconocido'
  });

  assert.equal(plan.presenter.key, 'fusion');
  assert.ok(plan.brief.task.length <= 180);
  assert.doesNotMatch(plan.brief.solution, /\u0000/);
  assert.equal(core.sceneAt(plan, 14.9).id, 'result');
  assert.equal(core.fileSlug('Acción útil: PDF'), 'accion-util-pdf');
});

test('convierte una idea de anuncio en un brief listo para el estudio', () => {
  const brief = core.buildBriefFromAd({
    idea: 'Llenar las horas valle del gimnasio',
    detail: 'Semana de prueba y entrenamientos guiados de 30 minutos',
    brand: 'Nexo Fitness',
    objective: 'leads',
    audience: 'Personas del barrio con poco tiempo'
  });

  assert.equal(brief.task, 'Llenar las horas valle del gimnasio');
  assert.equal(brief.solution, 'Semana de prueba y entrenamientos guiados de 30 minutos');
  assert.equal(brief.result, 'Más personas interesadas solicitando información');
  assert.equal(brief.cta, 'Pide información hoy');
  assert.equal(brief.presenter, 'fusion');

  const salesBrief = core.buildBriefFromAd({idea:'Anunciar una pizzería', objective:'sales'});
  assert.equal(salesBrief.result, 'Una propuesta clara que facilita la decisión');
  assert.equal(salesBrief.cta, 'Descúbrelo hoy');
});

test('la ruta pública carga los recursos del estudio', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'tiktok', 'index.html'), 'utf8');
  const middleware = fs.readFileSync(path.join(__dirname, '..', 'functions', 'presentaciones', '_middleware.js'), 'utf8');
  assert.match(html, /id="generatorForm"/);
  assert.match(html, /id="adIdeaForm"/);
  assert.match(html, /Ideas de anuncios/);
  assert.match(html, /Crear anuncio/);
  assert.match(html, /id="developAdIdea"/);
  assert.match(html, /Desarrollar idea/);
  assert.match(html, /\/assets\/tiktok-core\.js/);
  assert.match(html, /\/tiktok\/app\.js/);
  assert.match(html, /Exportar vídeo 9:16/);
  assert.match(html, /Grok · vídeo puro/);
  assert.match(html, /id="generateGrokVideo"/);
  assert.match(html, /Pixeria · envío automático activado/);
  assert.match(html, /id="retryPixeria"/);
  assert.match(middleware, /'grok-video'/);
  assert.match(middleware, /'ad-idea'/);
});
