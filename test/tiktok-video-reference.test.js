const test = require('node:test');
const assert = require('node:assert/strict');

function kv(){
  const values = new Map();
  const puts = [];
  return {
    puts,
    async get(key){ return values.get(key) || null; },
    async put(key, value, options){ values.set(key, value); puts.push({key, value, options}); }
  };
}

function frame(char = 'A'){
  return `data:image/jpeg;base64,${char.repeat(120)}`;
}

test('convierte fotogramas de referencia en una guía original para Grok', async (t) => {
  const {onRequest} = await import('../functions/presentaciones/api/video-reference.js');
  const originalFetch = global.fetch;
  let upstream;
  global.fetch = async (_url, options) => {
    upstream = JSON.parse(options.body);
    return Response.json({output:[{type:'message', content:[{type:'output_text', text:JSON.stringify({
      summary:'Energía urbana limpia y contemporánea',
      camera:'Travellings cortos y encuadres bajos',
      rhythm:'Cambios visuales rápidos con pausas de producto',
      palette:'Negros, rojos cálidos y blancos',
      lighting:'Contraste alto con luz lateral',
      composition:'Sujeto centrado y profundidad marcada',
      avoid:'No repetir personas, marcas, textos ni planos exactos'
    })}]}]});
  };
  t.after(() => { global.fetch = originalFetch; });
  const store = kv();
  const response = await onRequest({
    request:new Request('https://www.admiranext.com/presentaciones/api/video-reference', {
      method:'POST', headers:{'content-type':'application/json', origin:'https://www.admiranext.com', 'CF-Connecting-IP':'203.0.113.9'},
      body:JSON.stringify({frames:[frame('A'), frame('B'), frame('C'), frame('D')]})
    }),
    env:{XAI_API_KEY:'secret', PRESENTATION_IDEAS:store}
  });
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.match(payload.profile.promptFragment, /REFERENCE STYLE GUIDE/);
  assert.match(payload.profile.promptFragment, /Do not reproduce identifiable people/);
  assert.equal(upstream.input[1].content.filter(item => item.type === 'input_image').length, 4);
  assert.equal(store.puts[0].options.expirationTtl, 60);
  assert.equal(JSON.stringify(payload).includes('secret'), false);
});

test('rechaza referencias externas, demasiado grandes o con pocas muestras', async () => {
  const {onRequest} = await import('../functions/presentaciones/api/video-reference.js');
  const foreign = await onRequest({
    request:new Request('https://www.admiranext.com/presentaciones/api/video-reference', {
      method:'POST', headers:{'content-type':'application/json', origin:'https://evil.example'},
      body:JSON.stringify({frames:[frame(), frame(), frame()]})
    }), env:{XAI_API_KEY:'secret'}
  });
  assert.equal(foreign.status, 403);

  const few = await onRequest({
    request:new Request('https://www.admiranext.com/presentaciones/api/video-reference', {
      method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({frames:[frame(), frame()]})
    }), env:{XAI_API_KEY:'secret'}
  });
  assert.equal(few.status, 400);
});
