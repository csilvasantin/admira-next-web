/* AdmiraNeXT · SELLO SOLO CON SESIÓN (Carlos, 06-10-2026).
 *
 * En la parte pública de admiranext.com («zona desmilitarizada») no se enseña el sello de
 * versión ni sus novedades: ni el rectángulo «v.… NUEVO» ni el popover. Solo quien tiene
 * sesión válida del directorio (la misma de /webmaster) los ve.
 *
 * Este cargador pregunta a /api/sello —200 siempre, {sesion:true|false}, sin caché— y SOLO
 * con sesión inyecta el cargador común /assets/sello-novedades.js (que sigue siendo el de
 * toda la suite: aquí no se toca su comportamiento para los demás sitios). Sin sesión no
 * hay sello en el marcado ni se pide nada más. El resultado se comparte en
 * window.__admiraSesionSello para que el armazón (admira-frame.js) no pregunte dos veces.
 */
(function (root) {
  'use strict';
  if (typeof document === 'undefined') return;
  var SELLO_SRC = '/assets/sello-novedades.js?v=20261006-options-sello-5';

  function preguntar() {
    if (root.__admiraSesionSello) return root.__admiraSesionSello;
    var p;
    if (typeof root.fetch !== 'function' || location.protocol === 'file:') p = Promise.resolve(false);
    else p = root.fetch('/api/sello', { credentials: 'same-origin', cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { return !!(d && d.sesion === true); })
      .catch(function () { return false; });
    root.__admiraSesionSello = p;
    return p;
  }

  preguntar().then(function (conSesion) {
    document.documentElement.classList.toggle('admira-con-sesion', conSesion);
    if (!conSesion) return;
    if (typeof root.AdmiraSelloArranque === 'function') { try { root.AdmiraSelloArranque(); } catch (e) {} }
    try { if (root.self !== root.top) return; } catch (e) { return; }
    if (document.querySelector('script[data-admira-sello-loader]')) return;
    var s = document.createElement('script');
    s.src = SELLO_SRC;
    s.defer = true;
    s.setAttribute('data-admira-sello-loader', '');
    (document.head || document.documentElement).appendChild(s);
  });
})(typeof window !== 'undefined' ? window : this);
