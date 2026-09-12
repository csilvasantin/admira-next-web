// ESM. Yokup #3183 (12-sep-2026): toda pieza creada desde un catálogo llega al
// Stock con la meta `catalogo` y sus 7 hashtags, para que el Stock de Pixeria
// la agrupe en la opción «Catálogo» y la asigne a players. Sin catálogo (briefs
// de Xtore, estudio libre) no se añade NADA.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

let mod;
test.before(async () => { mod = await import('../functions/presentaciones/api/_ficha-video.mjs'); });

const CATALOGO = {id:'alcampo-2026-09-10', nombre:'Alcampo · 10–23 sep 2026', desde:'2026-09-10', hasta:'2026-09-23', proyecto:'admira-tv', producto:'COCA-COLA'};

test('la meta catalogo sale con el contrato fijo: cliente desde el id, mes AAAA-MM, slug del producto', () => {
  const c = mod.saneaCatalogo({...CATALOGO, producto:'Coca-Cola Zero · 12 ud'});
  assert.deepEqual(c, {
    id:'alcampo-2026-09-10', cliente:'alcampo', nombre:'Alcampo · 10–23 sep 2026',
    desde:'2026-09-10', hasta:'2026-09-23', proyecto:'admira-tv', producto:'coca-cola-zero-12-ud'
  });
  assert.equal(mod.clienteDeCatalogo('alcampo-2026-09-10'), 'alcampo');
  assert.equal(mod.clienteDeCatalogo('el-corte-ingles-2026-10'), 'el', 'antes del PRIMER guion, tal como fija el contrato');
  assert.equal(mod.mesDe('2026-09-10'), '2026-09');
  assert.equal(mod.mesDe('10/09/2026'), '', 'lo que no es ISO no da mes');
  assert.equal(mod.slug('COCA-COLA Zéro'), 'coca-cola-zero');
});

test('sin proyecto se asume admira-tv y las fechas rotas no viajan', () => {
  const c = mod.saneaCatalogo({id:'alcampo-2026-09-10', desde:'ayer', hasta:null});
  assert.equal(c.proyecto, 'admira-tv');
  assert.equal(c.desde, '');
  assert.equal(c.hasta, '');
  assert.equal(c.producto, '');
});

test('la ficha de catálogo lleva los 7 hashtags del contrato, en su orden, y la meta', () => {
  const f = mod.saneaFicha({title:'COCA-COLA · 10,20 € · Alcampo', externalId:'admiranext:catalogo:alcampo-2026-09-10:coca-cola', catalogo:CATALOGO});
  assert.deepEqual(f.tags, ['admiranext', 'tiktok', 'vertical', 'catalogo', 'alcampo', 'alcampo-2026-09-10', '2026-09']);
  assert.equal(f.catalogo.cliente, 'alcampo');
  assert.equal(f.catalogo.producto, 'coca-cola');
  assert.equal(f.externalId, 'admiranext:catalogo:alcampo-2026-09-10:coca-cola');
  assert.deepEqual(mod.etiquetasCatalogo(f.catalogo), f.tags);
});

test('con catálogo el tope sube a 10 y las propias van detrás sin repetirse', () => {
  const f = mod.saneaFicha({title:'X', catalogo:CATALOGO, tags:['alcampo', 'bebidas', 'tiktok', 'oferta', 'a', 'b', 'c', 'd']});
  assert.equal(f.tags.length, 10);
  assert.equal(new Set(f.tags).size, 10);
  assert.equal(f.tags[7], 'bebidas', 'la primera propia que no estaba ya va justo detrás de las 7 del catálogo');
});

test('sin catálogo no se añade nada: ni meta, ni hashtag catalogo, y el tope sigue en 4', () => {
  for (const sin of [undefined, null, {}, {id:''}, {id:'   '}, 'alcampo-2026-09-10']) {
    const f = mod.saneaFicha({title:'Aparca. Entra. Estrena.', tags:['xtore'], externalId:'admiranext:xtore:coche', catalogo:sin});
    assert.ok(!('catalogo' in f), `con catalogo=${JSON.stringify(sin)} no aparece la propiedad`);
    assert.deepEqual(f.tags, ['admiranext', 'tiktok', 'vertical', 'xtore']);
    assert.equal(mod.saneaCatalogo(sin), null);
  }
  assert.deepEqual(mod.etiquetasCatalogo(null), mod.ETIQUETAS_BASE);
});

test('el máster de catálogo viaja al Stock con catalogo y los 7 tags; el brief de Xtore, sin catalogo', async () => {
  const {onRequest} = await import('../functions/presentaciones/api/video-package.js');
  const kv = () => { const v = new Map(); return {async get(k, o){ const x = v.get(k); return x == null ? null : o?.type === 'json' ? JSON.parse(x) : x; }, async put(k, x){ v.set(k, x); }}; };
  const r2 = () => {
    const v = new Map();
    const obj = k => { const o = v.get(k); return o ? {size:o.bytes.byteLength, body:new Blob([o.bytes]).stream(), writeHttpMetadata(h){ h.set('content-type', o.options?.httpMetadata?.contentType || 'video/mp4'); }} : null; };
    return {
      async put(k, body, options){ const bytes = new Uint8Array(await new Response(body).arrayBuffer()); v.set(k, {bytes, options}); return {size:bytes.byteLength}; },
      async get(k){ return obj(k); }, async head(k){ return obj(k); }, async delete(k){ v.delete(k); }
    };
  };
  async function publica(ficha){
    let body = null;
    const bytes = new Uint8Array(2048).fill(7);
    const response = await onRequest({
      request:new Request('https://www.admiranext.com/presentaciones/api/video-package', {
        method:'POST',
        headers:{origin:'https://www.admiranext.com', 'content-type':'video/mp4', 'content-length':String(bytes.byteLength), 'x-client-request-id':crypto.randomUUID(), 'x-package-ficha':encodeURIComponent(JSON.stringify(ficha))},
        body:bytes
      }),
      env:{PRESENTATION_IDEAS:kv(), PRESENTATION_MEDIA:r2(), PIXERIA_INGEST_TOKEN:'t'},
      data:{pixeriaFetch:async request => {
        if(request.method === 'GET') return Response.json({ok:true, exists:false});
        body = await request.json();
        return Response.json({ok:true, id:'auto-1234567890abcdef1234', url:'https://api.admira.store/stock/asset/auto-1234567890abcdef1234'});
      }}
    });
    assert.equal(response.status, 201);
    return body;
  }
  const conCatalogo = await publica({title:'COCA-COLA · 10,20 € · Alcampo', comment:'Alcampo', tags:['admiranext', 'tiktok', 'vertical', 'catalogo', 'alcampo', 'alcampo-2026-09-10', '2026-09'], externalId:'admiranext:catalogo:alcampo-2026-09-10:coca-cola', catalogo:CATALOGO});
  assert.deepEqual(conCatalogo.catalogo, {id:'alcampo-2026-09-10', cliente:'alcampo', nombre:'Alcampo · 10–23 sep 2026', desde:'2026-09-10', hasta:'2026-09-23', proyecto:'admira-tv', producto:'coca-cola'});
  assert.deepEqual(conCatalogo.tags, ['admiranext', 'tiktok', 'vertical', 'catalogo', 'alcampo', 'alcampo-2026-09-10', '2026-09']);
  const xtore = await publica({title:'Aparca. Entra. Estrena. · Xtore · coche', comment:'Xtore', tags:['xtore'], externalId:'admiranext:xtore:coche'});
  assert.ok(!('catalogo' in xtore), 'los briefs de Xtore no cambian');
  assert.deepEqual(xtore.tags, ['admiranext', 'tiktok', 'vertical', 'xtore']);
});

test('el estudio manda la meta catalogo en la ficha y enseña hashtags + enlace «Ver en el Stock · Catálogo»', async () => {
  const app = await readFile(new URL('../tiktok/app.js', import.meta.url), 'utf8');
  const html = await readFile(new URL('../tiktok/index.html', import.meta.url), 'utf8');
  assert.match(app, /function catalogoStock\(p\)/);
  assert.match(app, /cliente:slugCatalogo\(p\.catalogo_id\.split\('-'\)\[0\]\)/, 'cliente = antes del primer guion del id');
  assert.match(app, /proyecto:'admira-tv'/);
  assert.match(app, /tags:etiquetasCatalogo\(catalogo\),\s*catalogo,/, 'fichaProducto lleva los 7 tags y la meta; video-package la recibe por x-package-ficha sin recalcular');
  assert.match(app, /'catalogo', c\.cliente, c\.id, c\.desde \? c\.desde\.slice\(0, 7\) : ''/);
  assert.match(app, /https:\/\/www\.pixeria\.com\/stock\.html\?catalogo=\$\{encodeURIComponent\(c\.id\)\}/);
  assert.match(app, /packageTags\.textContent = ficha\?\.tags\?\.length \? `Publicado con \$\{ficha\.tags\.map\(t => `#\$\{t\}`\)\.join\(' '\)\}` : ''/);
  assert.match(app, /const fichaBruto = \{\s*\.\.\.ficha,/, 'el bruto de fallback hereda catalogo y tags de la ficha');
  assert.match(html, /id="openStockCatalogo"[^>]*hidden>Ver en el Stock · Catálogo<\/a>/);
  assert.match(html, /id="packageTags"[^>]*hidden>/);
  // fichaBrief (Xtore) sigue sin catálogo.
  const brief = app.slice(app.indexOf('function fichaBrief('), app.indexOf('const briefCampana'));
  assert.ok(!/catalogo/.test(brief), 'el brief de Xtore no lleva catalogo');
});
