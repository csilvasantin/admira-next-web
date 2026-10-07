// Se ejecuta también en Chromium: no depende del contexto de Node.
function collectStylesheets(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return [...doc.querySelectorAll('style, link[rel~="stylesheet"]')]
    .filter(node => !(node.tagName === 'LINK' && node.hasAttribute('disabled')) &&
      !node.rel?.split(/\s+/).includes('alternate') &&
      (!node.type || node.type.toLowerCase() === 'text/css'))
    .map(node => ({
      css: node.tagName === 'STYLE' ? node.textContent : undefined,
      href: node.tagName === 'LINK' ? node.getAttribute('href') : undefined,
      media: node.getAttribute('media') || ''
    }))
    .filter(sheet => sheet.css !== undefined || (sheet.href && !sheet.href.includes('fonts.googleapis.com')));
}

async function inlineStylesheets(sheets, {base, read, localize}) {
  const css = [];
  for (const sheet of sheets) {
    const url = sheet.href ? new URL(sheet.href, base).href : base;
    const source = sheet.href ? await read(url) : sheet.css;
    const localized = await localize(source, url);
    // Mantener tanto el orden de cascada como la condición de cada hoja.
    css.push(sheet.media ? `@media ${sheet.media}{\n${localized}\n}` : localized);
  }
  return css.join('\n');
}

module.exports = {collectStylesheets, inlineStylesheets};
