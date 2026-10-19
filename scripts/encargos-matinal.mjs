#!/usr/bin/env node
/*
 * Convierte la tabla matinal de encargos (HTML con Persona · Abiertos · Hoy · Ayer ·
 * Anteriores y <tfoot> Total) en el JSON que lee /roadmap/encargos.
 *
 *   node scripts/encargos-matinal.mjs tabla.html [--fecha 2026-10-20T08:01:00+02:00] > parte.json
 *
 * Valida que el Total del HTML cuadra con la suma de filas; si no cuadra, sale con
 * error y no escribe nada (mejor sin parte que con un parte que miente).
 * El JSON se publica de una de estas dos formas (ver PR / docs):
 *   a) sin redesplegar: wrangler kv key put --binding PRESENTATION_IDEAS encargos:matinal --path parte.json --remote
 *   b) con commit: pegarlo como SEMILLA en functions/_encargos-matinal.js.
 * No lleva credenciales ni las lee: wrangler usa la sesión de quien lo ejecuta.
 */
import { readFileSync } from 'node:fs';
import { normalizar, totales, COLUMNAS } from '../functions/_encargos-matinal.js';

const limpio = (s) => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
const filasDe = (bloque) => [...bloque.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((m) => [...m[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) => limpio(c[1])));
const aFila = (c) => ({ persona: c[0], ...Object.fromEntries(COLUMNAS.map((k, i) => [k, Number(c[i + 1])])) });

export function parsear(texto, fechaArg) {
  const tbody = (texto.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/) || [])[1] || '';
  const tfoot = (texto.match(/<tfoot[^>]*>([\s\S]*?)<\/tfoot>/) || [])[1] || '';
  const filas = filasDe(tbody).filter((c) => c.length >= 5).map(aFila);
  let fecha = fechaArg;
  if (!fecha) {
    const m = texto.match(/(\d{1,2})-([a-z]{3})-(\d{4})\s+(?:a las\s+)?(\d{2}):(\d{2})/i);
    const MES = { ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, oct: 10, nov: 11, dic: 12 };
    if (m && MES[m[2].toLowerCase()]) {
      const p2 = (n) => String(n).padStart(2, '0');
      // La tabla matinal va en hora de Madrid; el desfase se calcula para ese día.
      const local = `${m[3]}-${p2(MES[m[2].toLowerCase()])}-${p2(m[1])}T${m[4]}:${m[5]}:00`;
      const off = new Intl.DateTimeFormat('en', { timeZone: 'Europe/Madrid', timeZoneName: 'longOffset' }).formatToParts(new Date(local + 'Z')).find((x) => x.type === 'timeZoneName').value.replace('GMT', '') || '+00:00';
      fecha = local + off;
    }
  }
  const notas = [...texto.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)].map((m) => limpio(m[1])).filter((t) => /^Resto de agentes|no hay cifras/i.test(t));
  const parte = normalizar({ fecha, fuente: 'tabla matinal', filas, notas: notas.flatMap((n) => n.split(/(?<=\.)\s+(?=De )/)) });
  if (!parte) throw new Error('la tabla no tiene filas válidas o falta la fecha (usa --fecha)');
  const total = filasDe(tfoot).find((c) => /^total$/i.test(c[0]));
  if (total) {
    const t = totales(parte.filas), esperado = aFila(total);
    for (const k of COLUMNAS) if (t[k] !== esperado[k]) throw new Error(`el Total de ${k} (${esperado[k]}) no cuadra con la suma (${t[k]})`);
  }
  return parte;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const args = process.argv.slice(2);
  const i = args.indexOf('--fecha');
  const fichero = args.find((a, k) => !a.startsWith('--') && args[k - 1] !== '--fecha');
  if (!fichero) { console.error('uso: node scripts/encargos-matinal.mjs tabla.html [--fecha ISO]'); process.exit(2); }
  const html = readFileSync(fichero, 'utf8');
  try { process.stdout.write(JSON.stringify(parsear(html, i >= 0 ? args[i + 1] : undefined), null, 2) + '\n'); }
  catch (e) { console.error('✗ ' + e.message); process.exit(1); }
}
