// FLT-100646 · P0 de la sala WEB (Presentar) — Morfeo, 19-sep-2026.
//
// 1) La caja negra vacía. En BEST, `.best-figure img` y `.best-figure video`
//    llevan `display:block` de autor, y eso PISA al atributo `hidden` (que sólo
//    es `display:none` de la hoja del navegador). syncBestFigures() esconde con
//    `hidden` el elemento que no toca, pero seguía ocupando sitio: medido en la
//    sala del smoke, la figura mide 574 px y dentro había dos cajas de 512 px
//    (la imagen y un <video> sin src), así que la foto se iba a x=569 y el
//    hueco negro a x=1081 — fuera del viewport de 1440. En móvil de 390 px la
//    imagen salía en x=-140: el cliente veía un rectángulo negro y nada más.
//
// 2) El sondeo eterno. syncImages() sólo paraba con status==='complete'. Un set
//    que acaba 'partial' (en el smoke: 10 ready + 1 failed) dejaba al visor
//    pidiendo api/images cada 10 s durante toda la reunión. Se para también
//    cuando ya no queda ninguna lámina por llegar.
//
// 3) El invitado no genera. ensureBetterImages() hace POST a la API del
//    generador; a quien sólo tiene la contraseña de la sala le contesta 401 con
//    la página de login (5,5 KB de HTML), y el catch rearmaba otro intervalo de
//    15 s. Un 401/403 ya no se reintenta.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {onRequestGet as renderPresentation} from '../functions/presentaciones/[client]/presentacion.js';

function kv(values){return{async get(key,options){const value=values[key];return options?.type==='json'?value:JSON.stringify(value)}}}

test('en BEST, la imagen o el vídeo que sobra no ocupan sitio en la figura',async()=>{
  const config={displayName:'Demo',outputs:['website','backgrounds'],languages:['es'],brand:{logoUrl:'/presentaciones/demo/brand/logo'},theme:{},sequence:{}};
  const ideas={hero:{title:'Propuesta',summary:'Resumen'},objective:'Objetivo',skeleton:[{id:'uno',title:'Uno',message:'M',detail:'D'}],closing:{title:'Cierre',action:'Acción'},labels:{objective:'Objetivo',next:'Siguiente'}};
  const imageSet={status:'partial',slides:[{status:'ready',textFreeVerified:true,url:'/presentaciones/demo/images/slide-01.jpg'},{status:'failed'}]};
  const response=await renderPresentation({params:{client:'demo'},env:{PRESENTATION_IDEAS:kv({'presentation:demo':config,'ideas:demo':ideas,'image-set:demo':imageSet})},next(){throw new Error('unexpected next')}});
  const html=await response.text();
  // La figura sigue existiendo y el elemento que sobra sigue marcándose con hidden…
  assert.match(html,/<figure class="best-figure" aria-hidden="true"><img alt="" loading="lazy"><video class="best-figure-video"/);
  // …pero ahora hidden gana: ni la imagen ni el vídeo vacíos ocupan una columna.
  assert.match(html,/html\[data-quality="best"\] \.best-figure img\[hidden\],html\[data-quality="best"\] \.best-figure video\[hidden\]\{display:none\}/);
  // La regla del hueco tiene que ir ANTES de la que pinta el fondo negro del vídeo,
  // para que un `hidden` no acabe pisado otra vez por el mismo selector.
  assert.ok(html.indexOf('.best-figure video[hidden]{display:none}')<html.indexOf('.best-figure video{background:#05080f}'));
});

test('el visor deja de sondear cuando ya no queda lámina por llegar y no reintenta un 401',async()=>{
  const fuente=await readFile(new URL('../functions/presentaciones/[client]/presentacion.js',import.meta.url),'utf8');
  // Un set 'partial' con todo en ready/failed es un set cerrado: no hay nada más que esperar.
  assert.match(fuente,/lamina\.status==='ready'\|\|lamina\.status==='failed'/);
  assert.match(fuente,/data\.imageSet\?\.status==='complete'\|\|cerrado\)clearInterval\(imageTimer\)/);
  // El error de la API del generador viaja con su código para poder distinguir el 401.
  assert.match(fuente,/error\.status=response\.status/);
  assert.match(fuente,/if\(!\(error&&\(error\.status===401\|\|error\.status===403\)\)\)betterImagesTimer=setInterval/);
});

// FLT-100646 · P0-1 (Lucas, CSO): «sala WEB = acto vivo, no PDF en navegador».
// La sala abria SIEMPRE en GOOD, y en GOOD la regla
// `html[data-quality="good"] .slide[data-has-image="true"]:before{display:none}`
// apaga el fondo de todas las laminas. Medido en la sala del smoke: 120 KB y
// CERO imagenes de lamina transferidas, con 9 de 11 ya generadas y pagadas.
// Ahora, si la portada tiene arte y lo tiene al menos la mitad del deck, la sala
// abre en BEST — y `data-quality` sale ya del servidor, para que la primera
// pintada no sea el gris #c0c0c0 de `:root` a la espera de que corra el JS.
function laminaLista(cliente,n){return{status:'ready',textFreeVerified:true,url:`/presentaciones/${cliente}/images/slide-${n}.jpg`}}

async function sala(imageSet,bloques=1,acceso){
  const config={displayName:'Demo',outputs:['website','backgrounds'],languages:['es'],brand:{logoUrl:'/presentaciones/demo/brand/logo'},theme:{},sequence:{}};
  const skeleton=Array.from({length:bloques},(_,i)=>({id:`b${i}`,title:`T${i}`,message:'M',detail:'D'}));
  const ideas={hero:{title:'Propuesta',summary:'Resumen'},objective:'Objetivo',skeleton,closing:{title:'Cierre',action:'Acción'},labels:{objective:'Objetivo',next:'Siguiente'}};
  const response=await renderPresentation({params:{client:'demo'},data:acceso?{presentationAccess:acceso}:{},env:{PRESENTATION_IDEAS:kv({'presentation:demo':config,'ideas:demo':ideas,'image-set:demo':imageSet})},next(){throw new Error('unexpected next')}});
  return response.text();
}

test('una sala con arte abre en BEST, y la calidad sale ya del servidor',async()=>{
  // 4 laminas (portada, objetivo, un bloque, cierre) con las 4 ilustradas.
  const html=await sala({status:'partial',slides:[0,1,2,3].map(n=>laminaLista('demo',n))});
  assert.match(html,/<html lang="es" data-quality="best"/);
  assert.match(html,/quality:'best'/);
  assert.equal((html.match(/--slide-image:url\('\/presentaciones\/demo\/images\//g)||[]).length,4);
});

test('una sala sin arte en portada no se disfraza de BEST',async()=>{
  // La portada manda: sin ella, BEST enseñaria un hueco justo en los 3 s que venden.
  const html=await sala({status:'partial',slides:[{status:'failed'},laminaLista('demo',1),laminaLista('demo',2),laminaLista('demo',3)]});
  assert.match(html,/<html lang="es" data-quality="good"/);
  assert.match(html,/quality:'good'/);
});

test('una sala sin ninguna imagen sigue abriendo en GOOD',async()=>{
  const html=await sala({status:'partial',slides:[]});
  assert.match(html,/<html lang="es" data-quality="good"/);
  assert.doesNotMatch(html,/--slide-image:url/);
});

// FLT-100646 · P0-4: con la sala abriendo en BEST, cada visita se lleva 1,2 MB de
// láminas. El nombre del fichero NO es inmutable —rehacer una sola lámina dentro
// del mismo set reutiliza `slide-01-cover-<setId10>.jpg`— así que `immutable`
// mentiría. Lo honesto es revalidar: ETag y 304.
import {onRequestGet as serveImage} from '../functions/presentaciones/[client]/images/[file].js';

function bucket({etag='"abc123"',cambiada=false}={}){
  return {async get(key,options){
    if(!key.endsWith('slide-01-cover-b3a34698da.jpg')) return null;
    const meta={writeHttpMetadata(h){h.set('content-type','image/jpeg')},httpEtag:etag};
    // R2 devuelve el objeto SIN cuerpo cuando se cumple el If-None-Match.
    const coincide=options?.onlyIf?.get?.('if-none-match')===etag && !cambiada;
    return coincide?{...meta,body:null}:{...meta,body:new Uint8Array([255,216,255])};
  }};
}
const peticion=(headers={})=>({params:{client:'demo',file:'slide-01-cover-b3a34698da.jpg'},env:{PRESENTATION_MEDIA:bucket()},request:new Request('https://x/',{headers})});

test('la primera visita se lleva la imagen con su ETag',async()=>{
  const r=await serveImage(peticion());
  assert.equal(r.status,200);
  assert.equal(r.headers.get('etag'),'"abc123"');
  assert.equal(r.headers.get('content-type'),'image/jpeg');
});

test('quien ya la tiene recibe 304 y ni un byte de imagen',async()=>{
  const r=await serveImage(peticion({'if-none-match':'"abc123"'}));
  assert.equal(r.status,304);
  assert.equal(await r.text(),'');
  assert.equal(r.headers.get('etag'),'"abc123"');
});

test('si la lámina se rehizo, el ETag ya no cuadra y baja la nueva',async()=>{
  const ctx=peticion({'if-none-match':'"vieja"'});
  const r=await serveImage(ctx);
  assert.equal(r.status,200);
});

test('una sala con el set cerrado no llama a la API del generador ni sondea',async()=>{
  // 10 ready + 1 failed es el caso del smoke: no queda nada por llegar.
  const html=await sala({status:'partial',slides:[0,1,2,3].map(n=>laminaLista('demo',n))});
  assert.match(html,/const imageTimer=0/);
  assert.match(html,/if\(wantsImages&&false&&/);
  // applyQuality() tambien generaba, y corre en el arranque.
  assert.match(html,/syncBestFigures\(\);if\(false&&\(quality==='better'/);
});

const enCola={status:'partial',slides:[laminaLista('demo',0),{status:'queued'},laminaLista('demo',2),laminaLista('demo',3)]};

test('con láminas aún en cola, quien puede generar sigue sondeando y generando',async()=>{
  const html=await sala(enCola,1,{level:'editor',canGenerate:true});
  assert.match(html,/const imageTimer=setInterval\(syncImages,10000\)/);
  assert.match(html,/if\(wantsImages&&true&&/);
  assert.match(html,/syncBestFigures\(\);if\(true&&\(quality==='better'/);
});

// FLT-100766 b (Morfeo, 21-sep-2026): lo que decide si la sala genera es el PERMISO de
// quien mira, no sólo el estado del set. Con láminas en cola, el invitado (contraseña de
// la sala) disparaba ensureBetterImages() → POST /presentaciones/api/images → 401.
test('con láminas en cola, el invitado sondea su sala pero NO llama al generador',async()=>{
  const html=await sala(enCola,1,{level:'client',canGenerate:false});
  // Sigue viendo llegar las láminas que genere otro: el sondeo es lectura de su sala…
  assert.match(html,/const imageTimer=setInterval\(syncImages,10000\)/);
  // …pero ni el arranque ni applyQuality() hacen el POST que le contestaba 401.
  assert.match(html,/if\(wantsImages&&false&&/);
  assert.match(html,/syncBestFigures\(\);if\(false&&\(quality==='better'/);
});

test('sin permiso declarado por el middleware, la sala no genera (por defecto, cerrado)',async()=>{
  const html=await sala(enCola);
  assert.match(html,/if\(wantsImages&&false&&/);
  assert.match(html,/syncBestFigures\(\);if\(false&&\(quality==='better'/);
});
