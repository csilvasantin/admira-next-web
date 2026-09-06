// ESM (FLT-100016, 6-sep-2026): con `require` este fichero reventaba en `node --test` y no vigilaba nada.
import test from 'node:test';
import assert from 'node:assert/strict';

function kv(initialValue = null){
  const puts = [];
  return {
    puts,
    async get(){ return initialValue; },
    async put(key, value, options){ puts.push({key, value, options}); }
  };
}

function request(body, origin = 'https://www.admiranext.com'){
  return new Request('https://www.admiranext.com/presentaciones/api/ad-idea', {
    method:'POST',
    headers:{'content-type':'application/json', origin, 'CF-Connecting-IP':'203.0.113.21'},
    body:JSON.stringify(body)
  });
}

test('desarrolla un titular mínimo en un anuncio estructurado sin exponer la clave', async (t) => {
  const {onRequest} = await import('../functions/presentaciones/api/ad-idea.js');
  const originalFetch = global.fetch;
  let upstream;
  global.fetch = async (url, options) => {
    upstream = {url:String(url), options, body:JSON.parse(options.body)};
    return Response.json({
      output:[{type:'message', content:[{type:'output_text', text:JSON.stringify({ad:{
        idea:'La noche pide pizza recién hecha',
        detail:'Abrimos con una cena sin inspiración y la transformamos visualmente en un momento compartido alrededor de una pizza. Cerramos invitando a descubrir la propuesta de la pizzería, sin inventar precios ni promociones.',
        brand:'Tu pizzería',
        objective:'visits',
        audience:'Personas de la zona que buscan una cena fácil para compartir'
      }})}]}]
    });
  };
  t.after(() => { global.fetch = originalFetch; });
  const usage = kv();
  const env = {XAI_API_KEY:'secret-not-for-output', XAI_TEXT_MODEL:'grok-4.5', PRESENTATION_IDEAS:usage};
  const response = await onRequest({request:request({headline:'anuncio de pizzería'}), env});
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.mode, 'develop');
  assert.equal(payload.ad.brand, 'Tu pizzería');
  assert.equal(payload.ad.objective, 'visits');
  assert.equal(upstream.url, 'https://api.x.ai/v1/responses');
  assert.equal(upstream.options.headers.authorization, 'Bearer secret-not-for-output');
  assert.equal(upstream.body.store, false);
  assert.equal(upstream.body.text.format.type, 'json_schema');
  assert.match(upstream.body.input[1].content[0].text, /anuncio de pizzería/);
  assert.match(upstream.body.input[1].content[0].text, /develop_headline/);
  assert.equal(JSON.stringify(payload).includes(env.XAI_API_KEY), false);
  assert.equal(usage.puts.length, 1);
  assert.equal(usage.puts[0].options.expirationTtl, 60);
});

test('crea una campaña completa desde cero cuando no hay titular', async (t) => {
  const {onRequest} = await import('../functions/presentaciones/api/ad-idea.js');
  const originalFetch = global.fetch;
  let upstream;
  global.fetch = async (_url, options) => {
    upstream = JSON.parse(options.body);
    return Response.json({output:[{type:'message', content:[{type:'output_text', text:JSON.stringify({ad:{
      idea:'Cinco minutos para volver a moverte',
      detail:'Una persona rompe una tarde inmóvil con una rutina breve y visualmente sencilla. La pieza muestra el primer gesto, el cambio de energía y termina invitando a empezar hoy sin prometer resultados concretos.',
      brand:'Impulso · estudio de movimiento',
      objective:'leads',
      audience:'Personas con poco tiempo que quieren recuperar el hábito de moverse'
    }})}]}]});
  };
  t.after(() => { global.fetch = originalFetch; });
  const response = await onRequest({request:request({headline:''}), env:{XAI_API_KEY:'secret', PRESENTATION_IDEAS:kv()}});
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.mode, 'create');
  assert.equal(payload.ad.idea, 'Cinco minutos para volver a moverte');
  const assignment = upstream.input[0].content[0].text;
  const userInput = JSON.parse(upstream.input[1].content[0].text);
  assert.match(assignment, /Inventa desde cero una idea/);
  assert.equal(userInput.mode, 'create_from_scratch');
  assert.equal(userInput.headline, null);
});

test('protege origen, configuración, tamaño y frecuencia del desarrollador creativo', async () => {
  const {onRequest} = await import('../functions/presentaciones/api/ad-idea.js');
  const ready = {XAI_API_KEY:'secret', PRESENTATION_IDEAS:kv()};
  assert.equal((await onRequest({request:request({headline:'anuncio de pizzería'}, 'https://evil.example'), env:ready})).status, 403);
  assert.equal((await onRequest({request:request({headline:'anuncio de pizzería'}), env:{PRESENTATION_IDEAS:kv()}})).status, 503);
  assert.equal((await onRequest({request:request({headline:'x'.repeat(5000)}), env:ready})).status, 413);
  assert.equal((await onRequest({request:request({headline:'anuncio de pizzería'}), env:{XAI_API_KEY:'secret', PRESENTATION_IDEAS:kv('used')}})).status, 429);
});

test('falla cerrado si el proveedor devuelve un anuncio incompleto', async (t) => {
  const {onRequest} = await import('../functions/presentaciones/api/ad-idea.js');
  const originalFetch = global.fetch;
  global.fetch = async () => Response.json({output:[{type:'message', content:[{type:'output_text', text:'{"ad":{"idea":"corta"}}'}]}]});
  t.after(() => { global.fetch = originalFetch; });
  const response = await onRequest({request:request({headline:'anuncio de pizzería'}), env:{XAI_API_KEY:'secret', PRESENTATION_IDEAS:kv()}});
  assert.equal(response.status, 502);
});
