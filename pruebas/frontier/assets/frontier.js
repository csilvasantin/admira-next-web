/*
 * Frontier · idioma (Carlos, 10-10-2026). Bilingüe ES/EN como el resto de admiranext.com:
 * ?lang= manda (y se recuerda), luego la clave común «admiranext_expert_lang» y, si no hay
 * nada, español. Escucha admira:languagechange (lo emite ⌘ Experto con /idioma) y avisa con
 * el mismo evento al cambiar desde los botones ESP / ENG. Los textos van en pares
 * [data-l="es"] / [data-l="en"]; la hoja oculta el que no toca.
 */
(function () {
  'use strict';
  var CLAVE = 'admiranext_expert_lang';
  var raiz = document.documentElement;
  function normal(v) {
    v = String(v || '').toLowerCase();
    if (/^(en|eng|english)$/.test(v)) return 'en';
    if (/^(es|esp|spanish|espanol|español)$/.test(v)) return 'es';
    return '';
  }
  function inicial() {
    var q = '';
    try { q = normal(new URLSearchParams(location.search).get('lang')); } catch (e) {}
    if (q) { try { localStorage.setItem(CLAVE, q); } catch (e) {} return q; }
    var g = '';
    try { g = normal(localStorage.getItem(CLAVE)); } catch (e) {}
    return g || 'es';
  }
  function aplicar(lang) {
    raiz.lang = lang;
    raiz.setAttribute('data-fx-lang', lang);
    var t = document.querySelector('meta[name="fx-title-' + lang + '"]');
    if (t) document.title = t.content;
    document.querySelectorAll('[data-fx-lang-btn]').forEach(function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-fx-lang-btn') === lang ? 'true' : 'false');
    });
    // Los enlaces internos de Frontier conservan el idioma (?lang=), como en la suite.
    document.querySelectorAll('a[data-fx-keep]').forEach(function (a) {
      try { var u = new URL(a.getAttribute('href'), location.href); u.searchParams.set('lang', lang); a.href = u.pathname + u.search + u.hash; } catch (e) {}
    });
  }
  function elegir(lang, avisar) {
    lang = normal(lang) || 'es';
    try { localStorage.setItem(CLAVE, lang); } catch (e) {}
    try { var u = new URL(location.href); u.searchParams.set('lang', lang); history.replaceState(null, '', u.pathname + u.search + u.hash); } catch (e) {}
    aplicar(lang);
    if (avisar) { try { window.dispatchEvent(new CustomEvent('admira:languagechange', {detail: {lang: lang, source: 'frontier'}})); } catch (e) {} }
  }
  aplicar(inicial());
  document.addEventListener('click', function (ev) {
    var b = ev.target.closest && ev.target.closest('[data-fx-lang-btn]');
    if (b) elegir(b.getAttribute('data-fx-lang-btn'), true);
  });
  window.addEventListener('admira:languagechange', function (ev) {
    var d = ev && ev.detail || {};
    if (d.source === 'frontier') return;
    elegir(d.lang, false);
  });
})();
