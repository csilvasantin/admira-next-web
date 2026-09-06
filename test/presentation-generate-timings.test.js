import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPut } from '../functions/presentaciones/api/generate.js';

// FLT-100018 a (Carlos, 6-sep-2026: «presentarlo bien y rápido»). El alta mide cada paso y lo
// devuelve al operador; el logo y el guion van en paralelo; un tropiezo rápido de xAI se
// reintenta antes de caer al molde. Aquí xAI «no responde» (red) las dos veces: la
// presentación se crea igual, con el molde, y la respuesta dice cuántos intentos hubo.
function kv(){
  const values=new Map();
  return {
    values,
    async get(key,options){ const v=values.get(key); if(v==null) return null; return options?.type==='json'?JSON.parse(v):v; },
    async put(key,value){ values.set(key,String(value)); },
    async list(){ return {keys:[...values.keys()].map(name=>({name}))}; }
  };
}
const PNG=new Uint8Array([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0,0,0,0]);

test('el alta devuelve tiempos por paso, reintenta el guion y no se cae si xAI no responde', async () => {
  const realFetch=globalThis.fetch; const llamadasXai=[];
  globalThis.fetch=async (url,options={})=>{
    const u=String(url);
    if(u.includes('api.x.ai')){ llamadasXai.push(u); throw new Error('ECONNRESET'); }
    if(u.endsWith('/logo.png')) return new Response(PNG,{status:200,headers:{'content-type':'image/png','content-length':String(PNG.byteLength)}});
    throw new Error('fetch inesperado en el test: '+u);
  };
  try{
    const env={PRESENTATION_IDEAS:kv(),PRESENTATION_MEDIA:{async put(){}},PRES_SIGNING_KEY:'clave-de-prueba',XAI_API_KEY:'xai-prueba'};
    const body={
      displayName:'Cliente Prueba',website:'https://www.pixeria.com/',problem:'Sus pantallas no venden',audience:'Dirección comercial',
      inspiration:{url:'https://www.pixeria.com/',title:'Pixeria',description:'Pantallas',primary:'#112233',accent:'#ffaa00',logo:{type:'url',url:'https://www.pixeria.com/logo.png'}}
    };
    const request=new Request('https://www.admiranext.com/presentaciones/api/generate',{method:'PUT',headers:{'content-type':'application/json',Origin:'https://www.admiranext.com'},body:JSON.stringify(body)});
    const response=await onRequestPut({request,env,params:{},waitUntil(){}});
    const data=await response.json();
    assert.equal(response.status,201,JSON.stringify(data).slice(0,300));
    assert.equal(data.ok,true);
    assert.equal(data.slug,'cliente-prueba');
    assert.equal(data.narrativeSource,'template','sin xAI se crea igual, con el molde');
    assert.ok(data.narrativeFallback,'y el operador se entera del motivo');
    assert.ok(data.timings,'los tiempos viajan en la respuesta');
    for(const paso of ['web','logo+guion','guardado','version','total']) assert.ok(Number.isFinite(data.timings[paso]),`falta el tiempo del paso ${paso}`);
    assert.equal(data.timings.guionIntentos,2,'el guion se reintentó una vez antes de caer al molde');
    assert.ok(data.timings.total>=data.timings['logo+guion']);
    // el guion se pidió dos veces (reintento) y la traducción una: tres llamadas a xAI
    assert.equal(llamadasXai.length,3,'guion ×2 + traducción ×1');
    assert.ok(env.PRESENTATION_IDEAS.values.has('presentation:cliente-prueba'));
  } finally { globalThis.fetch=realFetch; }
});
