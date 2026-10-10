/*
 * Frontier · idioma (Carlos, 10-10-2026). Bilingüe ES/EN como el resto de admiranext.com:
 * ?lang= manda (y se recuerda), luego la clave común «admiranext_expert_lang» y, si no hay
 * nada, español. Escucha admira:languagechange (lo emite ⌘ Experto con /idioma) y avisa con
 * window.setLanguage, que es lo primero que llama /idioma. Sin botones propios (Walt, 10-10-2026):
 * el idioma se cambia con /idioma o /language en ⌘ Experto, como en el editor de demos.
 * Los textos van en pares [data-l="es"] / [data-l="en"]; la hoja oculta el que no toca.
 *
 * ⌘ minimizado: como en el editor de demos, la franja de Experto se queda visible abajo
 * («› /ayuda») mientras está plegada; aquí se marca html.fx-cli-min y el raíl deja de ser inert.
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
  window.setLanguage = function (l) { elegir(l, false); };
  window.addEventListener('admira:languagechange', function (ev) {
    var d = ev && ev.detail || {};
    if (d.source === 'frontier') return;
    elegir(d.lang, false);
  });

  // ⌘ minimizado siempre presente (cuatro lados del armazón cuadrático).
  function lineaExperto() {
    var rail = document.getElementById('ykExpertRail');
    if (!rail) return false;
    var plegado = !raiz.classList.contains('yk-open-bottom');
    raiz.classList.toggle('fx-cli-min', plegado);
    if (plegado) { rail.inert = false; rail.setAttribute('aria-hidden', 'false'); }
    return true;
  }
  function vigilar() {
    var listo = lineaExperto();
    new MutationObserver(lineaExperto).observe(raiz, {attributes: true, attributeFilter: ['class']});
    if (listo) return;
    var obs = new MutationObserver(function () { if (lineaExperto()) obs.disconnect(); });
    obs.observe(document.body, {childList: true, subtree: true});
  }
  // Al enviar una orden desde la franja, se despliega para ver la respuesta.
  document.addEventListener('submit', function (ev) {
    var rail = document.getElementById('ykExpertRail');
    if (rail && rail.contains(ev.target) && raiz.classList.contains('fx-cli-min') && window.AdmiraFrame && typeof window.AdmiraFrame.abrir === 'function') window.AdmiraFrame.abrir('bottom', true);
  }, true);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', vigilar); else vigilar();
})();
