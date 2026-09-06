/*
 * Markdown → HTML mínimo y SEGURO para documentos internos (zona militarizada, 06-09-2026).
 *
 * Cubre lo que usa el inventario de Wozniak (docs/GITHUB-INVENTARIO.md en admira-vault):
 * encabezados #..###, citas >, reglas ---, tablas con fila de alineación, listas - y 1.,
 * párrafos, **negrita**, `código`, _énfasis_ de línea entera y enlaces [texto](https://…).
 * Todo el texto se escapa ANTES de marcar nada: un `<script>` en el markdown sale como
 * texto, nunca como etiqueta. Los enlaces solo aceptan http(s); cualquier otro esquema
 * se queda como texto plano. No hay HTML crudo: aquí no se confía en el documento.
 */
export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function inline(text) {
  let out = esc(text);
  out = out.replace(/`([^`]+)`/g, (_, code) => `<code>${code}</code>`);
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, label, url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`);
  if (/^_[^_]+_$/.test(out)) out = `<em>${out.slice(1, -1)}</em>`;
  return out;
}

function celdas(line) {
  const inner = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return inner.split('|').map((c) => c.trim());
}

function alineaciones(line) {
  return celdas(line).map((c) => {
    const izq = c.startsWith(':'), der = c.endsWith(':');
    return izq && der ? 'center' : der ? 'right' : '';
  });
}

const esSeparadorTabla = (line) => /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(line);

export function markdownAHtml(markdown) {
  const lines = String(markdown ?? '').replace(/\r\n?/g, '\n').split('\n');
  const html = [];
  let i = 0;
  const parrafo = [];
  const cierraParrafo = () => { if (parrafo.length) { html.push(`<p>${parrafo.map(inline).join(' ')}</p>`); parrafo.length = 0; } };

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { cierraParrafo(); i++; continue; }

    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) { cierraParrafo(); html.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`); i++; continue; }

    if (/^---+\s*$/.test(line)) { cierraParrafo(); html.push('<hr>'); i++; continue; }

    if (/^>\s?/.test(line)) {
      cierraParrafo();
      const cita = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) { cita.push(lines[i].replace(/^>\s?/, '')); i++; }
      html.push(`<blockquote>${cita.map(inline).join('<br>')}</blockquote>`);
      continue;
    }

    if (/^\s*\|/.test(line) && i + 1 < lines.length && esSeparadorTabla(lines[i + 1])) {
      cierraParrafo();
      const head = celdas(line), align = alineaciones(lines[i + 1]);
      i += 2;
      const filas = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) { filas.push(celdas(lines[i])); i++; }
      const td = (c, k, tag) => `<${tag}${align[k] ? ` style="text-align:${align[k]}"` : ''}>${inline(c)}</${tag}>`;
      html.push(`<div class="tabla"><table><thead><tr>${head.map((c, k) => td(c, k, 'th')).join('')}</tr></thead><tbody>${
        filas.map((f) => `<tr>${f.map((c, k) => td(c, k, 'td')).join('')}</tr>`).join('')}</tbody></table></div>`);
      continue;
    }

    const lista = /^\s*([-*]|\d+\.)\s+(.*)$/.exec(line);
    if (lista) {
      cierraParrafo();
      const ordenada = /\d/.test(lista[1]);
      const items = [];
      while (i < lines.length) {
        const m = /^\s*([-*]|\d+\.)\s+(.*)$/.exec(lines[i]);
        if (!m || /\d/.test(m[1]) !== ordenada) break;
        items.push(m[2]); i++;
      }
      const tag = ordenada ? 'ol' : 'ul';
      html.push(`<${tag}>${items.map((t) => `<li>${inline(t)}</li>`).join('')}</${tag}>`);
      continue;
    }

    parrafo.push(line.trim()); i++;
  }
  cierraParrafo();
  return html.join('\n');
}
