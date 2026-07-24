import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {onRequestGet as renderPresentation} from '../functions/presentaciones/[client]/presentacion.js';
import {normalizeSlideMedia} from '../functions/presentaciones/_slide-media.js';

function kv(values){
  return {
    async get(key, options){
      const value=values[key];
      return options?.type==='json' ? value : JSON.stringify(value);
    }
  };
}

const ideas={
  hero:{title:'Propuesta',summary:'Resumen'},
  objective:'Objetivo',
  skeleton:[],
  closing:{title:'Cierre',action:'Acción'},
  labels:{objective:'Objetivo',next:'Siguiente'},
  notes:'Notas privadas'
};

const validRights={
  source:'https://assets.example/licencias/apertura',
  permission:'licensed',
  license:'Licencia comercial 2026',
  holder:'Example Studios',
  attribution:'© Example Studios',
  expiresAt:'2099-12-31T23:59:59Z'
};

function media(overrides={}){
  return {
    slide:'cover',
    type:'video',
    src:'/presentaciones/demo/media/apertura.mp4',
    caption:'Apertura autorizada',
    fallback:'Apertura estática disponible.',
    rights:validRights,
    ...overrides
  };
}

async function render(slideMedia, audience=false){
  const config={
    displayName:'Demo',
    outputs:['website'],
    languages:['es'],
    theme:{},
    sequence:{},
    slideMedia
  };
  const response=await renderPresentation({
    params:{client:'demo'},
    request:new Request(`https://admiranext.test/presentaciones/demo/presentacion${audience?'?audience=1':''}`),
    env:{PRESENTATION_IDEAS:kv({'presentation:demo':config,'ideas:demo':ideas})},
    next(){throw new Error('unexpected next');}
  });
  return {response,html:await response.text()};
}

test('legacy media remains playable but is explicitly marked for review',()=>{
  const [{usable,rightsStatus,rights}]=normalizeSlideMedia([{
    slide:'cover',
    type:'video',
    src:'/presentaciones/demo/media/legado.mp4'
  }],'demo');
  assert.equal(usable,true);
  assert.equal(rightsStatus,'legacy-review');
  assert.equal(rights.permission,'legacy');
});

test('valid permission preserves the audit record while missing, denied and expired rights fail closed',()=>{
  const [valid,missing,denied,expired]=normalizeSlideMedia([
    media(),
    media({slide:'objective',src:'/presentaciones/demo/media/sin-detalle.mp4',rights:{permission:'licensed'}}),
    media({slide:'closing',src:'/presentaciones/demo/media/denegado.mp4',rights:{...validRights,permission:'denied'}}),
    media({
      slide:'historia',
      src:'/presentaciones/demo/media/caducado.mp4',
      rights:{...validRights,expiresAt:'2020-01-01T00:00:00Z'}
    })
  ],'demo');

  assert.equal(valid.usable,true);
  assert.equal(valid.rightsStatus,'usable');
  assert.equal(valid.rights.attribution,'© Example Studios');
  assert.equal(missing.usable,false);
  assert.equal(missing.rightsStatus,'missing-details');
  assert.equal(denied.usable,false);
  assert.equal(denied.rightsStatus,'denied');
  assert.equal(expired.usable,false);
  assert.equal(expired.rightsStatus,'expired');
  for(const entry of [missing,denied,expired]) assert.equal(entry.effectiveSrc,'');
});

test('unusable media renders only the safe fallback and never exposes its source',async()=>{
  const blocked=media({
    src:'/presentaciones/demo/media/caducado.mp4',
    rights:{...validRights,expiresAt:'2020-01-01T00:00:00Z'}
  });
  const {response,html}=await render([blocked]);
  assert.equal(response.status,200);
  assert.doesNotMatch(html,/caducado\.mp4/);
  assert.match(html,/data-media-rights-status="expired"/);
  assert.match(html,/data-media-state="fallback"/);
  assert.match(html,/Apertura estática disponible\./);
});

test('safe replacement becomes the effective asset and its own rights drive the private audit',async()=>{
  const replacementRights={
    source:'https://commons.example/sustitucion',
    permission:'public-domain',
    license:'CC0 1.0',
    holder:'',
    attribution:'Archivo público'
  };
  const entry=media({
    src:'/presentaciones/demo/media/original-denegado.mp4',
    rights:{...validRights,permission:'denied'},
    replacement:{
      src:'/presentaciones/demo/media/sustitucion.mp4',
      caption:'Sustitución autorizada',
      rights:replacementRights
    }
  });
  const [normalized]=normalizeSlideMedia([entry],'demo');
  assert.equal(normalized.replacementUsed,true);
  assert.equal(normalized.rightsStatus,'replacement');
  assert.equal(normalized.effectiveSrc,'/presentaciones/demo/media/sustitucion.mp4');

  const {html}=await render([entry]);
  assert.doesNotMatch(html,/original-denegado\.mp4/);
  assert.match(html,/sustitucion\.mp4/);
  assert.match(html,/window\.__ADMIRA_MEDIA_RIGHTS__/);
  assert.match(html,/CC0 1\.0/);
  assert.match(html,/Archivo público/);
});

test('attribution and provenance stay private while audience receives only the playable asset',async()=>{
  const entry=media();
  const presenter=await render([entry]);
  const audience=await render([entry],true);
  assert.match(presenter.html,/window\.__ADMIRA_MEDIA_RIGHTS__/);
  assert.match(presenter.html,/Licencia comercial 2026/);
  assert.match(presenter.html,/© Example Studios/);
  assert.doesNotMatch(audience.html,/__ADMIRA_MEDIA_RIGHTS__/);
  assert.doesNotMatch(audience.html,/Licencia comercial 2026|© Example Studios|assets\.example/);
  assert.match(audience.html,/\/presentaciones\/demo\/media\/apertura\.mp4/);
});

test('replacement remains client-scoped and rejects unsafe or cross-client sources',()=>{
  assert.throws(()=>normalizeSlideMedia([media({
    rights:{...validRights,permission:'denied'},
    replacement:{src:'https://tracker.invalid/media.mp4',rights:validRights}
  })],'demo'),/sustitución segura|URL privada/i);
  assert.throws(()=>normalizeSlideMedia([media({
    rights:{...validRights,permission:'denied'},
    replacement:{src:'/presentaciones/otro/media/filtracion.mp4',rights:validRights}
  })],'demo'),/sustitución segura|URL privada/i);
});

test('licensed images render through the same rights gate and have complete runtime load/error support',async()=>{
  const entry=media({
    type:'image',
    src:'/presentaciones/demo/images/fondo-autorizado.webp',
    caption:'Imagen autorizada'
  });
  const {html}=await render([entry]);
  assert.match(html,/<img\b[^>]*data-slide-media-element[^>]*fondo-autorizado\.webp/);
  assert.match(html,/data-media-rights-status="usable"/);

  const runtime=await readFile(new URL('../assets/presentation-slide-media.js',import.meta.url),'utf8');
  assert.match(runtime,/querySelector\(['"]\[data-slide-media-element\]['"]\)/);
  assert.match(runtime,/media\.tagName\s*===\s*['"]IMG['"]\s*\?\s*['"]load['"]/);
  assert.match(runtime,/addEventListener\(['"]error['"]/);
  assert.match(runtime,/media\.complete\s*&&\s*media\.naturalWidth/);
});
