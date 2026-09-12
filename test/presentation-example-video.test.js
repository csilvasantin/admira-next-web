import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
  FLEET_EXAMPLE_VIDEO, exampleVideoEntry, wantsExampleVideo, ensureExampleVideo, normalizeSlideMedia
} from '../functions/presentaciones/_slide-media.js';
import {onRequestPut} from '../functions/presentaciones/api/generate.js';

test('wantsExampleVideo only when video path, TikTok or explicit flag/url', () => {
  assert.equal(wantsExampleVideo({}), false);
  assert.equal(wantsExampleVideo({outputs:['website','documents']}), false);
  assert.equal(wantsExampleVideo({outputs:['website','video']}), true);
  assert.equal(wantsExampleVideo({includeExampleVideo:'on'}), true);
  assert.equal(wantsExampleVideo({exampleVideoUrl:FLEET_EXAMPLE_VIDEO}), true);
  assert.equal(wantsExampleVideo({title:'Informe TikTok Alcampo'}), true);
  assert.equal(wantsExampleVideo({embeds:[{url:'https://www.tiktok.com/@admira/video/1'}]}), true);
  assert.equal(wantsExampleVideo({problem:'mejorar el vídeo corporativo del hall'}), false);
});

test('ensureExampleVideo injects fleet MP4 and does not duplicate an existing video', () => {
  const injected = ensureExampleVideo([], {outputs:['video']});
  assert.equal(injected.length, 1);
  assert.equal(injected[0].type, 'video');
  assert.equal(injected[0].src, FLEET_EXAMPLE_VIDEO);
  assert.equal(injected[0].slide, 'cover');
  const custom = ensureExampleVideo([], {includeExampleVideo:true, exampleVideoUrl:FLEET_EXAMPLE_VIDEO, videoSlide:'vision'});
  assert.equal(custom[0].slide, 'vision');
  const already = [{slide:'cover', type:'video', src:FLEET_EXAMPLE_VIDEO}];
  const kept = ensureExampleVideo(already, {outputs:['video']});
  assert.equal(kept.length, 1);
  assert.equal(kept[0].src, FLEET_EXAMPLE_VIDEO);
  const normalized = normalizeSlideMedia(injected, 'demo');
  assert.equal(normalized[0].src, FLEET_EXAMPLE_VIDEO);
  assert.equal(normalized[0].type, 'video');
  assert.equal(normalized[0].usable, true);
  const entry = exampleVideoEntry({src:'https://evil.example/x.mp4'});
  assert.equal(entry.src, FLEET_EXAMPLE_VIDEO, 'unsafe URL falls back to fleet');
});

test('generate injects example video when outputs include video and not otherwise', async () => {
  const realFetch = globalThis.fetch;
  const PNG = new Uint8Array([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0,0,0,0]);
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes('api.x.ai')) throw new Error('ECONNRESET');
    if (u.endsWith('/logo.png')) return new Response(PNG, {status:200, headers:{'content-type':'image/png','content-length':String(PNG.byteLength)}});
    throw new Error('fetch inesperado: '+u);
  };
  function kv(){
    const values = new Map();
    return {
      values,
      async get(key, options){ const v=values.get(key); if(v==null) return null; return options?.type==='json'?JSON.parse(v):v; },
      async put(key, value){ values.set(key, String(value)); },
      async list(){ return {keys:[...values.keys()].map(name=>({name}))}; }
    };
  }
  const inspiration = {url:'https://www.pixeria.com/',title:'Pixeria',description:'Pantallas',primary:'#112233',accent:'#ffaa00',logo:{type:'url',url:'https://www.pixeria.com/logo.png'}};
  try {
    const env = {PRESENTATION_IDEAS:kv(), PRESENTATION_MEDIA:{async put(){}}, PRES_SIGNING_KEY:'clave-de-prueba', XAI_API_KEY:'xai-prueba'};
    const withVideo = await onRequestPut({
      request: new Request('https://www.admiranext.com/presentaciones/api/generate', {
        method:'PUT', headers:{'content-type':'application/json', Origin:'https://www.admiranext.com'},
        body: JSON.stringify({displayName:'Demo Video', website:'https://www.pixeria.com/', outputs:['website','video'], inspiration})
      }),
      env, params:{}, waitUntil(){}
    });
    assert.equal(withVideo.status, 201, JSON.stringify(await withVideo.clone().json()).slice(0,300));
    const saved = JSON.parse(env.PRESENTATION_IDEAS.values.get('presentation:demo-video'));
    assert.ok(saved.slideMedia.some(item => item.type==='video' && item.src===FLEET_EXAMPLE_VIDEO));

    const env2 = {PRESENTATION_IDEAS:kv(), PRESENTATION_MEDIA:{async put(){}}, PRES_SIGNING_KEY:'clave-de-prueba', XAI_API_KEY:'xai-prueba'};
    const plain = await onRequestPut({
      request: new Request('https://www.admiranext.com/presentaciones/api/generate', {
        method:'PUT', headers:{'content-type':'application/json', Origin:'https://www.admiranext.com'},
        body: JSON.stringify({displayName:'Demo Texto', website:'https://www.pixeria.com/', outputs:['website','documents'], inspiration})
      }),
      env: env2, params:{}, waitUntil(){}
    });
    assert.equal(plain.status, 201);
    const savedPlain = JSON.parse(env2.PRESENTATION_IDEAS.values.get('presentation:demo-texto'));
    assert.equal((savedPlain.slideMedia||[]).some(item => item.type==='video'), false);
  } finally { globalThis.fetch = realFetch; }
});

test('generator UI exposes incluir ejemplo vídeo and sala editor documents the delete gesture', async () => {
  const generator = await readFile(new URL('../assets/presentation-generator-20260721-11.js', import.meta.url), 'utf8');
  assert.match(generator, /includeExampleVideo/);
  assert.match(generator, /Incluir ejemplo vídeo/);
  assert.match(generator, /20260912-norma-video/);
  const editor = await readFile(new URL('../assets/presentation-inline-editor.js', import.meta.url), 'utf8');
  assert.match(editor, /Ctrl\+⌫ quitar lámina/);
  assert.match(editor, /__ADMIRA_REFRESH_SLIDES__/);
});
