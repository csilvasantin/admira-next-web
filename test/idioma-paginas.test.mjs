// Traducción completa ESP↔ENG de admiranext.com, página a página (Carlos, 9-oct-2026).
// Criterio: tras /idioma, menos del 10 % del texto visible de cada página queda sin cambiar.
// Esta prueba lo mide sin navegador: cuenta las letras del texto visible de la página y cuántas
// quedan fuera de un bloque con data-en (la versión inglesa entera del bloque, que el armazón
// pone al pedir inglés; ver traducirBloques en assets/admira-frame.js). Lo que el diccionario
// traduce por nodos sueltos NO se descuenta aquí: la cifra es, por tanto, un techo.
// Al traducir una página nueva, añádela a PAGINAS.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const leer = (ruta) => readFileSync(new URL('../' + ruta, import.meta.url), 'utf8');
const PAGINAS = ['normativa.html'];
const MAX_SIN_CAMBIAR = 0.10;

const VACIOS = new Set(['br', 'img', 'hr', 'input', 'meta', 'link', 'source', 'wbr', 'col', 'area', 'base', 'embed', 'track', 'param']);
const INVISIBLES = new Set(['script', 'style', 'svg', 'template', 'noscript', 'head', 'title', 'textarea']);
// Una sola pasada: «&amp;lt;» es «&lt;» (un nivel), no «<». Las demás entidades (&rarr;, &middot;…) se dejan
// como están: aparecen igual en el original y en la traducción.
const ENT = {amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'", nbsp: ' '};
const entidades = (s) => s.replace(/&(amp|lt|gt|quot|apos|#39|nbsp);/g, (_, k) => ENT[k]);
const letras = (s) => (s.match(/[A-Za-zÀ-ÿ]/g) || []).length;
const sinEtiquetas = (h) => entidades(h.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const etiquetas = (h) => [...h.matchAll(/<\s*(\/?[a-zA-Z][a-zA-Z0-9]*)/g)].map((m) => m[1].toLowerCase());

// Recorre el HTML y devuelve las letras visibles, cuántas caen dentro de un bloque con data-en y los bloques.
function medir(html) {
  const cuerpo = html.slice(html.search(/<body\b/i));
  const re = /<!--[\s\S]*?-->|<(script|style)\b[\s\S]*?<\/\1\s*>|<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b((?:"[^"]*"|'[^']*'|[^>"'])*)>|([^<]+)/g;
  const pila = [], bloques = [];
  let total = 0, traducidas = 0, anidados = 0, m;
  while ((m = re.exec(cuerpo))) {
    if (m[5] != null) {
      if (pila.some((n) => n.invisible || n.armazon)) continue;
      const n = letras(entidades(m[5]));
      total += n;
      const bloque = [...pila].reverse().find((x) => x.en != null);
      if (bloque) { traducidas += n; }
      continue;
    }
    if (!m[3]) continue;
    const tag = m[3].toLowerCase();
    if (m[2]) {
      for (let k = pila.length - 1; k >= 0; k--) if (pila[k].tag === tag) {
        const nodo = pila[k];
        if (nodo.en != null) bloques.push({tag, en: nodo.en, es: cuerpo.slice(nodo.dentro, m.index)});
        pila.length = k; break;
      }
      continue;
    }
    if (VACIOS.has(tag) || /\/\s*$/.test(m[4])) continue;
    const en = (m[4].match(/\sdata-en="([^"]*)"/) || [])[1];
    if (en != null && pila.some((x) => x.en != null)) anidados++;
    pila.push({tag, invisible: INVISIBLES.has(tag), armazon: /\sdata-yk-head\b/.test(m[4]), en: en == null ? null : entidades(en), dentro: re.lastIndex});
  }
  return {total, traducidas, anidados, bloques};
}

for (const pagina of PAGINAS) {
  test(pagina + ': menos del 10 % del texto visible queda fuera de la traducción', () => {
    const r = medir(leer(pagina));
    assert.ok(r.total > 500, 'la página tiene texto');
    const fuera = (r.total - r.traducidas) / r.total;
    assert.ok(fuera <= MAX_SIN_CAMBIAR, `${pagina}: ${(fuera * 100).toFixed(1)} % del texto visible queda sin bloque traducido (máximo ${MAX_SIN_CAMBIAR * 100} %)`);
  });

  test(pagina + ': cada bloque traducido dice otra cosa que el original y conserva su marcado', () => {
    const r = medir(leer(pagina));
    assert.equal(r.anidados, 0, 'ningún data-en dentro de otro: el de fuera pisaría al de dentro');
    const iguales = r.bloques.filter((b) => sinEtiquetas(b.en) === sinEtiquetas(b.es));
    assert.deepEqual(iguales.map((b) => sinEtiquetas(b.es).slice(0, 60)), [], 'bloques con data-en idéntico al castellano');
    const rotos = r.bloques.filter((b) => etiquetas(b.en).join(' ') !== etiquetas(b.es).join(' '));
    assert.deepEqual(rotos.map((b) => sinEtiquetas(b.es).slice(0, 60)), [], 'bloques cuya traducción no tiene las mismas etiquetas');
    // Lo que va en <code> no se traduce.
    const codigo = (h) => [...h.matchAll(/<code\b[^>]*>([\s\S]*?)<\/code>/g)].map((x) => x[1].replace(/\s+/g, ' ').trim());
    const codigoCambiado = r.bloques.filter((b) => codigo(b.en).join('\u0001') !== codigo(b.es).join('\u0001'));
    assert.deepEqual(codigoCambiado.map((b) => sinEtiquetas(b.es).slice(0, 60)), [], 'bloques que tradujeron el contenido de <code>');
  });
}

test('el armazón aplica los bloques data-en y el diccionario no entra en ellos', () => {
  const js = leer('assets/admira-frame.js');
  assert.match(js, /function traducirBloques\(zona, en\)/);
  assert.match(js, /e\.innerHTML = e\.getAttribute\('data-en'\)/);
  assert.match(js, /else if \(reg && reg\.en != null && actual === reg\.en\) e\.innerHTML = reg\.es;/, 'al volver a castellano se repone el original');
  assert.match(js, /var FUERA = '[^']*\[data-en\]'/, 'el diccionario no traduce dentro de un bloque data-en');
  assert.match(js, /try \{ traducirBloques\(body, en\); \}/);
});

test('medir(): un bloque sin data-en cuenta como texto sin traducir', () => {
  const r = medir('<body><main><p data-en="Hello &lt;b&gt;world&lt;/b&gt;">Hola <b>mundo</b></p><p>Adios mundo cruel</p><script>var texto = "no cuenta";</script></main></body>');
  assert.equal(r.total, 9 + 15);
  assert.equal(r.traducidas, 9);
  assert.equal(r.bloques.length, 1);
  assert.equal(r.bloques[0].en, 'Hello <b>world</b>');
});
