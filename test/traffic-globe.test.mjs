import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {globeLocations,rayHeight,closestAngle} from '../analitics/globe-model.mjs';
import {aggregateGeography,buildQuery,period} from '../functions/_analytics.js';
const centres=JSON.parse(await readFile(new URL('../analitics/country-centres.json',import.meta.url)));

test('geografía consulta todos los sites y respeta el filtro y el periodo',()=>{
  const range=period(7,new Date('2026-10-02T12:00:00Z'));
  assert.match(buildQuery('account',range),/geography:rumPageloadEventsAdaptiveGroups\(limit:1000/);
  assert.match(buildQuery('account',range,'admira.biz'),/countryName requestHost/);
  assert.match(buildQuery('account',range,'admira.biz'),/requestHost_in:\["admira.biz","www.admira.biz"\]/);
});
test('no sumar previews al país y rayos basados en visitas, no páginas',()=>{
  const rows=[{dimensions:{countryName:'ES',requestHost:'www.admira.app'},sum:{visits:2},count:7},{dimensions:{countryName:'ES',requestHost:'admira.biz'},sum:{visits:3},count:4},{dimensions:{countryName:'US',requestHost:'preview.pages.dev'},sum:{visits:100},count:100}];
  const geography=aggregateGeography(rows);
  assert.deepEqual(geography,[{country:'ES',visits:5,pageviews:11}]);
  const model=globeLocations({mode:'history',geography},centres);
  assert.equal(model.locations[0].code,'ES');assert.equal(model.locations[0].visits,5);
  assert.equal(rayHeight(4,10,100),2*rayHeight(2,10,100));
});
test('presencia deduplica una sesión con varias páginas sin fusionar dominios',()=>{
  const visitors=[{host:'admira.app',visitor:'Visitante a',country:'ES',path:'/'},{host:'admira.app',visitor:'Visitante a',country:'ES',path:'/mcp/'},{host:'admira.biz',visitor:'Visitante a',country:'ES',path:'/'},{host:'admira.store',visitor:'Visitante b',country:'',path:'/'}];
  const result=globeLocations({mode:'live',visitors},centres);
  assert.equal(result.locations[0].visits,2);assert.equal(result.unknown,1);
});
test('no inventa ubicación para país ausente y admite nombres de países',()=>{
  const result=globeLocations({mode:'history',geography:[{country:'Spain',visits:3},{country:'?',visits:4},{country:'US',visits:0}]},centres);
  assert.equal(result.locations.length,1);assert.equal(result.locations[0].code,'ES');assert.equal(result.unknown,4);
});
test('cruce del meridiano mantiene el giro más corto',()=>{
  assert.equal(closestAngle(170,-170),190);assert.equal(closestAngle(-170,170),-190);
});
