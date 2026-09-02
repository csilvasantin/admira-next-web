import test from 'node:test';
import assert from 'node:assert/strict';
import {briefFromPresentation, briefFromWeb, onRequest, parseSourceUrl} from '../functions/presentaciones/api/source-brief.js';
import {extractReadableText} from '../functions/presentaciones/_inspiration.js';

const URL_NVIDIA = 'https://www.admiranext.com/presentaciones/nvidia/presentacion?lang=en';

function nvidiaFixture(){
  return {
    config:{slug:'nvidia', displayName:'NVIDIA', audience:['Media teams', 'Technology leaders'], privateNotes:'never expose this'},
    ideas:{
      hero:{title:'Propuesta NVIDIA', summary:'Un recorrido por la propuesta.'},
      objective:'Explicar dónde encaja la plataforma.',
      skeleton:[
        {id:'one', title:'Contexto', message:'El reto que debe resolver el equipo.', detail:'Detalle privado de apoyo.'},
        {id:'two', title:'Propuesta', message:'Una vía clara para avanzar.'},
        {id:'off', title:'Oculta', message:'No debe aparecer.', enabled:false}
      ],
      closing:{title:'Siguiente paso acordado', action:'Revisa la propuesta completa'},
      translations:{en:{
        hero:{title:'NVIDIA proposal', summary:'A concise walkthrough of the proposal.'},
        objective:'Explain where the platform fits.',
        skeleton:[
          {id:'one', title:'Context', message:'The challenge the team needs to solve.'},
          {id:'two', title:'Proposal', message:'A clear way forward.'}
        ],
        closing:{title:'An agreed next step', action:'Review the full proposal'}
      }}
    }
  };
}

test('detecta una presentación y respeta el idioma de la URL', () => {
  const parsed = parseSourceUrl(URL_NVIDIA);
  assert.equal(parsed.presentation.client, 'nvidia');
  assert.equal(parsed.presentation.language, 'en');
  assert.equal(parseSourceUrl('https://example.com/article').presentation, null);
  assert.throws(() => parseSourceUrl('http://127.0.0.1/private'), /https/);
});

test('convierte una presentación traducida en un brief factual de 15 segundos', () => {
  const {config, ideas} = nvidiaFixture();
  const result = briefFromPresentation(config, ideas, 'en');
  assert.equal(result.source.title, 'NVIDIA proposal');
  assert.equal(result.source.slideCount, 5);
  assert.equal(result.brief.presenter, 'nexo');
  assert.equal(result.brief.tone, 'expert');
  assert.match(result.brief.solution, /Explain where the platform fits/);
  assert.equal(result.brief.cta, 'Review the full proposal');
  assert.doesNotMatch(JSON.stringify(result), /privateNotes|Detalle privado|No debe aparecer/);
});

test('el endpoint lee NVIDIA desde KV sin raspar la página privada', async () => {
  const {config, ideas} = nvidiaFixture();
  const kv = {get:async key => key === 'presentation:nvidia' ? config : key === 'ideas:nvidia' ? ideas : null};
  const response = await onRequest({
    request:new Request('https://www.admiranext.com/presentaciones/api/source-brief', {
      method:'POST',
      headers:{origin:'https://www.admiranext.com', 'content-type':'application/json'},
      body:JSON.stringify({url:URL_NVIDIA})
    }),
    env:{PRESENTATION_IDEAS:kv}
  });
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.ok, true);
  assert.equal(payload.source.client, 'nvidia');
  assert.equal(payload.source.language, 'en');
  assert.equal(payload.source.url, URL_NVIDIA);
});

test('extrae texto legible de una web y elimina navegación y scripts', () => {
  const text = extractReadableText('<html><nav>Menú secreto</nav><main><h1>Clean energy</h1><p>A practical plan for cities &amp; teams.</p></main><script>alert(1)</script></html>');
  assert.equal(text, 'Clean energy A practical plan for cities & teams.');
  const result = briefFromWeb({title:'Clean energy', host:'example.com', description:'A practical plan for cities and teams.', contentExcerpt:text});
  assert.equal(result.source.kind, 'web');
  assert.match(result.brief.solution, /practical plan/);
});
