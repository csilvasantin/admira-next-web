// ESM (FLT-100016). Yokup #3066: el director creativo recibe el producto del
// catálogo y el guion dice el precio LITERAL, aunque el modelo se lo deje.
import test from 'node:test';
import assert from 'node:assert/strict';

function kv(){
  const values = new Map();
  return { async get(k){ return values.get(k) ?? null; }, async put(k, v){ values.set(k, v); } };
}

const PRODUCTO = {
  p:11, seccion:'Bebidas', nombre:'COCA-COLA', marca:'Coca-Cola',
  detalle:'variedades · 12 ud x 33 cl (L 2,57 €) · la ud sale a 0,85 €',
  precio:10.20, unidad:'pack', destacado:true, catalogo:'Alcampo · 10–23 sep 2026',
  validez:{desde:'2026-09-10', hasta:'2026-09-23'}, origen:'admira.tv/contentcatalogue', catalogo_id:'alcampo-2026-09-10'
};

test('el producto viaja literal a Grok y el precio y la validez acaban en el guion', async () => {
  const {onRequest} = await import('../functions/presentaciones/api/ad-idea.js');
  let providerBody = null;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    providerBody = JSON.parse(init.body);
    // El modelo «olvida» el precio a propósito: la garantía literal debe reponerlo.
    const ad = {idea:'Coca-Cola: doce latas para la semana', detail:'Abrimos con la nevera llena de latas frías. Un pack para toda la semana, sin pensar. Cierre con el logo de Alcampo y la invitación a pasar por tienda.', brand:'Coca-Cola', objective:'sales', audience:'Familias que hacen la compra semanal'};
    return new Response(JSON.stringify({output:[{type:'message', content:[{type:'output_text', text:JSON.stringify({ad})}]}]}), {status:200, headers:{'content-type':'application/json'}});
  };
  try{
    const request = new Request('https://www.admiranext.com/presentaciones/api/ad-idea', {
      method:'POST', headers:{'content-type':'application/json', origin:'https://www.admiranext.com'},
      body:JSON.stringify({headline:'COCA-COLA · 10,20 € el pack · Alcampo 10–23 sep', producto:PRODUCTO})
    });
    const response = await onRequest({request, env:{XAI_API_KEY:'test', PRESENTATION_IDEAS:kv()}});
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.mode, 'producto');
    const system = providerBody.input[0].content[0].text;
    const user = JSON.parse(providerBody.input[1].content[0].text);
    assert.match(system, /Usa literalmente el precio y la unidad tal como llegan: «10,20 € el pack»/);
    assert.match(system, /No inventes precios, descuentos, promociones/);
    assert.equal(user.mode, 'catalog_product');
    assert.equal(user.producto.precio, '10,20 € el pack');
    assert.equal(user.producto.validez, 'del 10 al 23 de septiembre');
    assert.match(payload.ad.idea, /10,20 €/, 'el titular lleva el precio literal');
    assert.match(payload.ad.detail, /Precio: 10,20 € el pack\./, 'el detalle repone el precio que el modelo omitió');
    assert.match(payload.ad.detail, /Válido del 10 al 23 de septiembre\./);
    assert.equal(payload.producto.precio, '10,20 € el pack');
  }finally{ globalThis.fetch = originalFetch; }
});

test('un producto roto o sin precio ni promo se ignora y el flujo sigue como siempre', async () => {
  const mod = await import('../functions/presentaciones/api/ad-idea.js');
  assert.equal(mod.normalizeProducto(null), null);
  assert.equal(mod.normalizeProducto({nombre:'Sin datos'}), null);
  assert.equal(mod.normalizeProducto({nombre:'Trucha', precio:6.95, unidad:'€/kg'}).precioTexto, '6,95 € el kilo');
  assert.equal(mod.normalizeProducto({nombre:'Renova', promo:'2x1'}).precioTexto, '');
});
