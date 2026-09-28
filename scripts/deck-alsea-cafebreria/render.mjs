// Renderiza la sala con el MISMO código de producción (functions/presentaciones/[client]/presentacion.js)
// y los datos vivos del KV (live/*.json). Uso: node render.mjs <slug> > out.html
import fs from 'node:fs';
const mod = await import('/Users/csilvasantin/Claude/admira-next-web/functions/presentaciones/[client]/presentacion.js');
const slug = process.argv[2];
const env = { PRESENTATION_IDEAS: { async get(key){ const p = new URL(`./live/${key}.json`, import.meta.url); return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p,'utf8')) : null; } } };
const res = await mod.onRequestGet({ params:{client:slug}, env, request:{url:`https://www.admiranext.com/presentaciones/${slug}/presentacion`}, data:{}, next:()=>new Response('next',{status:404}) });
process.stdout.write(await res.text());
