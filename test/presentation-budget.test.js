import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
  computeLine, computeBudget, normalizeBudgetLines, publicBudget, persistBudget, formatMoney
} from '../functions/presentaciones/_budget.js';
import {onRequestPut} from '../functions/presentaciones/api/generate.js';
import {onRequestGet as renderPresentation} from '../functions/presentaciones/[client]/presentacion.js';
import {onRequest as handleInlineEdit} from '../functions/presentaciones/[client]/api/inline-edit.js';
import {callTool} from '../functions/mcp/_server.js';

const SAMPLE_LINES = [
  {id:'a', concept:'Piloto sala', price:1000, discount:10, iva:21, amount:999999},
  {id:'b', concept:'Informe vivo', price:250, discount:0, iva:21, amount:1}
];

test('budget math: two lines, net/tax/amount and totals', () => {
  const a = computeLine({concept:'Piloto sala', price:1000, discount:10, iva:21});
  assert.equal(a.net, 900);
  assert.equal(a.tax, 189);
  assert.equal(a.amount, 1089);
  const b = computeLine({concept:'Informe vivo', price:250, discount:0, iva:21});
  assert.equal(b.net, 250);
  assert.equal(b.tax, 52.5);
  assert.equal(b.amount, 302.5);
  const budget = computeBudget([
    {concept:'Piloto sala', price:1000, discount:10, iva:21},
    {concept:'Informe vivo', price:250, discount:0, iva:21}
  ]);
  assert.equal(budget.totals.base, 1250);
  assert.equal(budget.totals.discountTotal, 100);
  assert.equal(budget.totals.ivaTotal, 241.5);
  assert.equal(budget.totals.total, 1391.5);
  assert.equal(budget.totals.currency, 'EUR');
});

test('budget ignores client-supplied amount and empty input is valid', () => {
  const line = computeLine({concept:'X', price:1000, discount:10, iva:21, amount:1, importe:2, net:3, tax:4});
  assert.equal(line.amount, 1089);
  assert.equal(line.net, 900);
  const empty = publicBudget(undefined);
  assert.deepEqual(empty.lines, []);
  assert.equal(empty.totals.total, 0);
  assert.equal(empty.totals.base, 0);
  assert.deepEqual(persistBudget([]), {currency:'EUR', lines:[]});
  assert.equal(normalizeBudgetLines(null).length, 0);
});

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

test('generate persists ideas.budget and overwrite without budgetLines preserves it', async () => {
  const realFetch = globalThis.fetch;
  const PNG = new Uint8Array([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0,0,0,0]);
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes('api.x.ai')) throw new Error('ECONNRESET');
    if (u.endsWith('/logo.png')) return new Response(PNG, {status:200, headers:{'content-type':'image/png','content-length':String(PNG.byteLength)}});
    throw new Error('fetch inesperado: '+u);
  };
  try {
    const env = {PRESENTATION_IDEAS:kv(), PRESENTATION_MEDIA:{async put(){}}, PRES_SIGNING_KEY:'clave-de-prueba', XAI_API_KEY:'xai-prueba'};
    const created = await onRequestPut({
      request: new Request('https://www.admiranext.com/presentaciones/api/generate', {
        method:'PUT', headers:{'content-type':'application/json', Origin:'https://www.admiranext.com'},
        body: JSON.stringify({
          displayName:'Cliente Presupuesto', slug:'cliente-presupuesto', website:'https://www.pixeria.com/',
          outputs:['website','documents'], inspiration,
          budgetLines: SAMPLE_LINES
        })
      }),
      env, params:{}, waitUntil(){}
    });
    assert.equal(created.status, 201, JSON.stringify(await created.clone().json()).slice(0,400));
    const saved = JSON.parse(env.PRESENTATION_IDEAS.values.get('ideas:cliente-presupuesto'));
    assert.equal(saved.budget.currency, 'EUR');
    assert.equal(saved.budget.lines.length, 2);
    assert.equal(saved.budget.lines[0].concept, 'Piloto sala');
    assert.equal(saved.budget.lines[0].price, 1000);
    assert.equal(saved.budget.lines[0].amount, undefined);
    assert.equal(saved.budget.lines[1].concept, 'Informe vivo');

    const overwritten = await onRequestPut({
      request: new Request('https://www.admiranext.com/presentaciones/api/generate', {
        method:'PUT', headers:{'content-type':'application/json', Origin:'https://www.admiranext.com'},
        body: JSON.stringify({
          displayName:'Cliente Presupuesto', slug:'cliente-presupuesto', website:'https://www.pixeria.com/',
          outputs:['website','documents'], inspiration, overwrite:true
        })
      }),
      env, params:{}, waitUntil(){}
    });
    assert.equal(overwritten.status, 201, JSON.stringify(await overwritten.clone().json()).slice(0,400));
    const preserved = JSON.parse(env.PRESENTATION_IDEAS.values.get('ideas:cliente-presupuesto'));
    assert.equal(preserved.budget.lines.length, 2);
    assert.equal(preserved.budget.lines[0].concept, 'Piloto sala');
    assert.equal(preserved.budget.lines[0].price, 1000);

    const replaced = await onRequestPut({
      request: new Request('https://www.admiranext.com/presentaciones/api/generate', {
        method:'PUT', headers:{'content-type':'application/json', Origin:'https://www.admiranext.com'},
        body: JSON.stringify({
          displayName:'Cliente Presupuesto', slug:'cliente-presupuesto', website:'https://www.pixeria.com/',
          outputs:['website','documents'], inspiration, overwrite:true, budgetLines:[]
        })
      }),
      env, params:{}, waitUntil(){}
    });
    assert.equal(replaced.status, 201);
    const emptied = JSON.parse(env.PRESENTATION_IDEAS.values.get('ideas:cliente-presupuesto'));
    assert.deepEqual(emptied.budget.lines, []);
  } finally { globalThis.fetch = realFetch; }
});

test('renderPresentation puts Presupuesto after closing with two concept cells and totals', async () => {
  const presentation = {displayName:'Cliente Demo', outputs:['website'], languages:['es','en'], theme:{}, sequence:{}};
  const ideas = {
    displayName:'Cliente Demo', languages:['es','en'], translations:{},
    hero:{eyebrow:'Privada',title:'Título',summary:'Resumen'}, objective:'Objetivo',
    skeleton:[{id:'problema',title:'El problema',message:'Mensaje',detail:'Detalle',enabled:true}],
    closing:{title:'Cierre',action:'Siguiente acción'}, labels:{objective:'El objetivo',next:'Siguiente paso'},
    budget: persistBudget(SAMPLE_LINES)
  };
  const values = {
    'presentation:cliente-demo': presentation,
    'ideas:cliente-demo': ideas
  };
  const env = {PRESENTATION_IDEAS:{
    async get(key, options){ const value=values[key]; if(value==null) return null; return options?.type==='json'?value:JSON.stringify(value); }
  }};
  const response = await renderPresentation({
    params:{client:'cliente-demo'}, env,
    request:new Request('https://admiranext.test/presentaciones/cliente-demo/presentacion'),
    next(){ return new Response('missing',{status:404}); }
  });
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /data-slide-key="budget"/);
  assert.match(html, /data-section="budget"/);
  assert.match(html, /data-segment="budget"/);
  assert.match(html, /Presupuesto/);
  assert.match(html, /Piloto sala/);
  assert.match(html, /Informe vivo/);
  const money = html.includes(formatMoney(1391.5)) || /1\.391,50|1391[,.]5/.test(html);
  assert.ok(money, 'totals should show 1.391,50 or 1391.5');
  assert.ok(html.includes(formatMoney(1089)) || /1\.089|1089/.test(html), 'line amount 1089 visible');
  const closingAt = html.lastIndexOf('data-slide-key="closing"');
  const budgetAt = html.lastIndexOf('data-slide-key="budget"');
  assert.ok(budgetAt > closingAt, 'budget slide must be after closing');
  const afterAt = html.lastIndexOf('${afterSlides}');
  assert.equal(afterAt, -1);
  assert.match(html, /budget-table/);
  assert.match(html, /data-title-ca="Pressupost"/);
  assert.match(html, /data-title-en="Quote"/);
});

test('empty budget still renders the last slide so Ctrl+E can add lines', async () => {
  const presentation = {displayName:'Vacío', outputs:['website'], languages:['es'], theme:{}, sequence:{}};
  const ideas = {
    hero:{title:'T',summary:'S'}, objective:'O',
    skeleton:[{id:'problema',title:'P',message:'M',detail:'D',enabled:true}],
    closing:{title:'C',action:'A'}, labels:{objective:'Objetivo',next:'Siguiente'}
  };
  const env = {PRESENTATION_IDEAS:{
    async get(key, options){
      const values = {'presentation:vacio':presentation,'ideas:vacio':ideas};
      const value=values[key]; if(value==null) return null; return options?.type==='json'?value:JSON.stringify(value);
    }
  }};
  const html = await (await renderPresentation({
    params:{client:'vacio'}, env,
    request:new Request('https://admiranext.test/presentaciones/vacio/presentacion'),
    next(){ return new Response('missing',{status:404}); }
  })).text();
  assert.match(html, /data-slide-key="budget"/);
  assert.match(html, /Sin partidas/);
  assert.match(html, /0,00 €|0\.00 €/);
});

test('MCP forwards budgetLines and omits the field when not provided', async () => {
  const log = [];
  const fetchImpl = async (url, init) => {
    log.push({url, method:init.method, body:init.body});
    const path = new URL(url).pathname;
    const ok = (data, status=200) => ({status, ok:status<400, text: async () => JSON.stringify(data)});
    if (path === '/presentaciones/api/clients') return ok({clients:[{slug:'valiant-alcampo', displayName:'Valiant Alcampo'}]});
    if (path === '/presentaciones/api/generate') {
      let slug='nuevo-cliente';
      try { const b=JSON.parse(init.body||'{}'); if(b.slug) slug=b.slug; } catch {}
      return ok({ok:true, slug, password:'abc'});
    }
    return ok({error:'no'}, 404);
  };
  const ctx = {env:{PRES_SIGNING_KEY:'clave'}, access:{level:'owner', email:'x@admira.com', name:'X', sessionVersion:1, source:'directory'}, fetchImpl};
  await callTool(ctx, 'create_presentation', {
    displayName:'Con Presupuesto', slug:'con-presupuesto',
    budgetLines:[{concept:'Piloto sala', price:1000, discount:10, iva:21}]
  });
  const forwarded = JSON.parse(log.find(e => e.body && e.body.includes('con-presupuesto')).body);
  assert.equal(forwarded.budgetLines[0].concept, 'Piloto sala');
  log.length = 0;
  await callTool(ctx, 'create_presentation', {displayName:'Sin Presupuesto', slug:'sin-presupuesto'});
  const omitted = JSON.parse(log.find(e => e.body && e.body.includes('sin-presupuesto')).body);
  assert.equal(Object.prototype.hasOwnProperty.call(omitted, 'budgetLines'), false);
});

test('inline-edit setBudget updates ideas.budget without calling translate', async () => {
  const presentation = {displayName:'Cliente Demo', outputs:['website'], languages:['es','ca','en'], theme:{}, updatedAt:'2026-07-19T10:00:00.000Z'};
  const ideas = {
    displayName:'Cliente Demo', languages:['es','ca','en'], translations:{}, updatedAt:'2026-07-19T10:00:00.000Z',
    hero:{eyebrow:'Presentación privada',title:'Título original',summary:'Resumen'}, objective:'Acordar un piloto',
    skeleton:[{id:'problema',title:'El problema',message:'Mensaje original',detail:'Detalle',enabled:true}],
    closing:{title:'Cierre',action:'Siguiente acción'}, labels:{objective:'El objetivo',next:'Siguiente paso'}
  };
  const values = new Map([
    ['presentation:cliente-demo', JSON.stringify(presentation)],
    ['ideas:cliente-demo', JSON.stringify(ideas)]
  ]);
  const env = {XAI_API_KEY:'secret-not-for-output', PRESENTATION_IDEAS:{
    async get(key, options){ const value=values.get(key); return options?.type==='json'&&value?JSON.parse(value):value||null; },
    async put(key, value){ values.set(key, value); }
  }};
  let translated = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { translated = true; throw new Error('translateEdits no debe llamarse para setBudget'); };
  try {
    const request = new Request('https://admiranext.test/presentaciones/cliente-demo/api/inline-edit', {
      method:'PUT', headers:{origin:'https://admiranext.test','content-type':'application/json'},
      body: JSON.stringify({action:'setBudget', language:'es', revision:ideas.updatedAt, lines:SAMPLE_LINES})
    });
    const response = await handleInlineEdit({request, env, params:{client:'cliente-demo'}});
    assert.equal(response.status, 200, JSON.stringify(await response.clone().json()).slice(0,300));
    const result = await response.json();
    assert.equal(translated, false);
    assert.equal(result.locales.es.budget.lines.length, 2);
    assert.equal(result.locales.es.budget.totals.total, 1391.5);
    assert.equal(result.locales.ca.budget.totals.total, 1391.5);
    const saved = JSON.parse(values.get('ideas:cliente-demo'));
    assert.equal(saved.budget.lines[0].concept, 'Piloto sala');
    assert.equal(saved.budget.lines[0].amount, undefined);
    assert.equal(saved.hero.title, 'Título original');
  } finally { globalThis.fetch = originalFetch; }
});

test('generator UI assigns budgetLines from the visible table', async () => {
  const generator = await readFile(new URL('../assets/presentation-generator-20260721-11.js', import.meta.url), 'utf8');
  assert.match(generator, /Valoración económica \(final de sala\)/);
  assert.match(generator, /data\.budgetLines\s*=\s*collectLines\(\)/);
  assert.match(generator, /function collectLines\(\)/);
  assert.match(generator, /budget-gen-table/);
  assert.match(generator, /Añadir partida/);
  assert.match(generator, /20260912-budget/);
  const editor = await readFile(new URL('../assets/presentation-inline-editor.js', import.meta.url), 'utf8');
  assert.match(editor, /action:'setBudget'/);
  assert.match(editor, /Añadir partida/);
  assert.match(editor, /function collectBudgetLines/);
});

test('PDF print keeps the budget table (3 lines + totals) as its own page', async () => {
  const three = [
    {id:'a', concept:'Piloto sala', price:1000, discount:10, iva:21},
    {id:'b', concept:'Informe vivo', price:250, discount:0, iva:21},
    {id:'c', concept:'Soporte primer mes', price:100, discount:0, iva:10}
  ];
  const budget = computeBudget(three);
  assert.equal(budget.totals.base, 1350);
  assert.equal(budget.totals.discountTotal, 100);
  assert.equal(budget.totals.ivaTotal, 251.5);
  assert.equal(budget.totals.total, 1501.5);
  const presentation = {displayName:'PDF Demo', outputs:['website','documents'], languages:['es','en'], theme:{}, sequence:{}};
  const ideas = {
    hero:{title:'Presentación',summary:'Delante'}, objective:'Piloto',
    skeleton:[{id:'problema',title:'Problema',message:'Mensaje',detail:'Detalle',enabled:true}],
    closing:{title:'Cierre',action:'Siguiente'}, labels:{objective:'El objetivo',next:'Siguiente paso'},
    budget: persistBudget(three)
  };
  const env = {PRESENTATION_IDEAS:{
    async get(key, options){
      const values = {'presentation:pdf-demo':presentation,'ideas:pdf-demo':ideas};
      const value=values[key]; if(value==null) return null; return options?.type==='json'?value:JSON.stringify(value);
    }
  }};
  const html = await (await renderPresentation({
    params:{client:'pdf-demo'}, env,
    request:new Request('https://admiranext.test/presentaciones/pdf-demo/presentacion?pdf=1'),
    next(){ return new Response('missing',{status:404}); }
  })).text();
  assert.match(html, /@media print/);
  assert.match(html, /\.budget-slide\{page-break-inside:avoid/);
  assert.match(html, /\.budget-table\{font-size:11pt/);
  assert.match(html, /data-print/);
  assert.match(html, /Soporte primer mes/);
  assert.match(html, /Piloto sala/);
  assert.match(html, /Informe vivo/);
  assert.ok(html.includes(formatMoney(1501.5)) || /1\.501,50|1501[,.]5/.test(html), 'PDF HTML must show 1.501,50 total');
  assert.match(html, /class="deck-print"/);
});
