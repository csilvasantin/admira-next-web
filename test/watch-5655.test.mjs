import test from 'node:test';
import assert from 'node:assert/strict';
import { playlistWatch } from '../functions/pruebas/visor/watch-playlist.js';
import { imagenWatch } from '../functions/pruebas/visor/watch-img.js';
import { encode } from '../functions/pruebas/_jpeg/encoder.js';
import { medidasJpeg } from '../functions/pruebas/visor/img.js';
test('watch playlist fixed screen, durations and same-origin allowed media only', async () => {
 const data = await playlistWatch(async (url, options) => {
  assert.equal(url, 'https://admira.tv/api/playlist?screen=virtual-frescaria');
  assert.equal(options.redirect, 'follow');
  return Response.json({ draft: { rev: 7, items: [
   {id:'a',title:'Image',asset:'https://stock.admira.store/a.jpg',assetType:'image',seconds:12},
   {id:'b',title:'Video',asset:'https://stock.admira.store/b.mp4',assetType:'video',seconds:5},
   {id:'x',asset:'https://evil.example/a.jpg',assetType:'image'},
  ] }});
 });
 assert.equal(data.screen,'virtual-frescaria'); assert.equal(data.items.length,2);
 assert.equal(data.items[0].seconds,12); assert.match(data.items[0].url,/^\/pruebas\/visor\/watch-img\?src=/);
 assert.match(data.items[1].url,/^\/pruebas\/visor\/vid\?src=/);
});
test('server downsizes a portrait JPEG into Ultra bounds', async () => {
 const jpeg = encode({width:600,height:800,data:new Uint8Array(600*800*4).fill(255)},72).data;
 const response = await imagenWatch('https://stock.admira.store/a.jpg',async()=>new Response(jpeg));
 assert.equal(response.status,200);
 const size = medidasJpeg(new Uint8Array(await response.arrayBuffer()));
 assert.ok(size.w <= 410 && size.h <= 502); assert.equal(response.headers.get('access-control-allow-origin'),null);
});
test('watch image rejects untrusted host without fetching', async () => {
 const r = await imagenWatch('https://evil.example/a.jpg',()=>{throw new Error('must not fetch')});
 assert.equal(r.status,400);
});
