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
