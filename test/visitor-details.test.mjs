import test from 'node:test';
import assert from 'node:assert/strict';
import {safeReferrer,visitorDetails} from '../functions/_visitor-details.js';
import {trafficBreakdown} from '../functions/_analytics.js';
import {globeLocations} from '../analitics/globe-model.mjs';
const request=(ua,cf)=>Object.assign(new Request('https://www.admiranext.com/api/presence',{headers:{'user-agent':ua}}),{cf});
test('procedencia conserva página, elimina credenciales, parámetros y fragmentos',()=>{
  assert.equal(safeReferrer('https://www.admira.app/mcp/?token=secret#private'),'https://www.admira.app/mcp/');
  assert.equal(safeReferrer('https://user:password@example.com/'),'');assert.equal(safeReferrer('javascript:alert(1)'),'');
  assert.equal(safeReferrer('https://site.example/auth/callback/token'),'https://site.example/');
});
test('ciudad y coordenadas vienen de Cloudflare, nunca de valores del cliente',()=>{
  const r=visitorDetails(request('Mozilla/5.0 Macintosh Chrome/140.0 Safari/537.36',{city:'Barcelona',region:'Catalonia',latitude:'41.38879',longitude:'2.15899'}),{city:'invented',latitude:0,referrer:'https://www.admira.app/mcp/?secret=x'});
  assert.equal(r.city,'Barcelona');assert.equal(r.latitude,41.389);assert.equal(r.longitude,2.159);assert.equal(r.browser,'Chrome');assert.equal(r.os,'macOS');assert.equal(r.referrer,'https://www.admira.app/mcp/');
  const invalid=visitorDetails(request('test',{latitude:'invalid',longitude:'999'}),{});assert.equal(invalid.latitude,null);assert.equal(invalid.longitude,null);
});
test('distingue móvil, tableta y escritorio y familias de navegador/sistema',()=>{
  assert.equal(visitorDetails(request('Mozilla Android Mobile Chrome/140',{}),{}).device,'Móvil');
  assert.equal(visitorDetails(request('Mozilla Android Chrome/140',{}),{}).device,'Tableta');
  assert.equal(visitorDetails(request('Mozilla iPad Safari/605',{}),{}).os,'iOS / iPadOS');
  assert.equal(visitorDetails(request('Mozilla Macintosh Safari/605',{}),{deviceHint:'tablet'}).device,'Tableta');
  assert.equal(visitorDetails(request('Mozilla Windows Chrome/140 Safari/605 Edg/140',{}),{}).browser,'Edge');
});
test('dos ciudades españolas aparecen como dos ubicaciones sin inventar ciudad para el histórico',()=>{
  const centres={ES:{name:'Spain',lat:40,lng:-4,aliases:['Spain']}};
  const visitors=[{host:'admira.app',visitor:'a',country:'ES',city:'Barcelona',latitude:41.389,longitude:2.159,path:'/'},{host:'admira.biz',visitor:'b',country:'ES',city:'Madrid',latitude:40.417,longitude:-3.703,path:'/help/'}];
  const live=globeLocations({mode:'live',visitors},centres);assert.equal(live.locations.length,2);assert.equal(live.locations[0].lat,41.389);assert.equal(live.locations[0].geoSource,'Cloudflare IP');
  const past=globeLocations({mode:'history',geography:[{country:'ES',visits:10}]},centres);assert.equal(past.locations[0].city,undefined);assert.equal(past.locations[0].geoSource,'País');
});
test('histórico agrega procedencia completa y excluye previews',()=>{
  const rows=[{dimensions:{requestHost:'admira.app',refererHost:'google.com',refererScheme:'https',refererPath:'/search?q=secret'},sum:{visits:3},count:5},{dimensions:{requestHost:'a.pages.dev',refererHost:'google.com',refererPath:'/search'},sum:{visits:100},count:100}];
  assert.deepEqual(trafficBreakdown(rows,'referrers'),[{label:'https://google.com/search',visits:3,pageviews:5}]);
});
