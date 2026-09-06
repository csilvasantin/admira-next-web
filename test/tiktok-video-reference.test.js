// ESM (FLT-100016, 6-sep-2026): con `require` este fichero reventaba en `node --test` y no vigilaba nada.
import test from 'node:test';
import assert from 'node:assert/strict';

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

test('acepta una URL YouTube allowlisted y analiza sus miniaturas sin proxy abierto', async (t) => {
  const {onRequest} = await import('../functions/presentaciones/api/video-reference.js');
  const originalFetch = global.fetch;
  const fetched = [];
  global.fetch = async (url, options) => {
    fetched.push(String(url));
    if(String(url).startsWith('https://i.ytimg.com/vi/M7lc1UVf-VE/')){
      const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
      return new Response(bytes, {headers:{'content-type':'image/jpeg', 'content-length':String(bytes.length)}});
    }
    assert.equal(String(url), 'https://api.x.ai/v1/responses');
    const request = JSON.parse(options.body);
    assert.equal(request.input[1].content.filter(item => item.type === 'input_image').length, 4);
    return Response.json({output:[{type:'message', content:[{type:'output_text', text:JSON.stringify({
      summary:'Tratamiento dinámico', camera:'Cámara baja', rhythm:'Ritmo rápido', palette:'Azules y negros',
      lighting:'Luz lateral', composition:'Centro limpio', avoid:'No copiar personas ni marcas'
    })}]}]});
  };
  t.after(() => { global.fetch = originalFetch; });
  const response = await onRequest({
    request:new Request('https://www.admiranext.com/presentaciones/api/video-reference', {
      method:'POST', headers:{'content-type':'application/json', origin:'https://www.admiranext.com', 'CF-Connecting-IP':'203.0.113.10'},
      body:JSON.stringify({sourceUrl:'https://www.youtube.com/watch?v=M7lc1UVf-VE'})
    }),
    env:{XAI_API_KEY:'secret', PRESENTATION_IDEAS:kv()}
  });
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(payload.source, {kind:'youtube', videoId:'M7lc1UVf-VE'});
  assert.equal(fetched.filter(url => url.startsWith('https://i.ytimg.com/')).length, 4);

  const blocked = await onRequest({
    request:new Request('https://www.admiranext.com/presentaciones/api/video-reference', {
      method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({sourceUrl:'https://youtube.com.evil.example/watch?v=M7lc1UVf-VE'})
    }), env:{XAI_API_KEY:'secret'}
  });
  assert.equal(blocked.status, 400);
});
