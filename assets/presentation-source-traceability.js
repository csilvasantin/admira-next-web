(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AdmiraSourceTraceability = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function list(value) { return Array.isArray(value) ? value : []; }

  function summarize(contract) {
    var sources = list(contract && contract.sources);
    var claims = list(contract && contract.claims);
    var sourceById = Object.create(null);
    sources.forEach(function (source) {
      if (source && typeof source.id === 'string') sourceById[source.id] = source;
    });
    var unsupportedClaimIds = claims.filter(function (claim) {
      var sourceIds = list(claim && claim.sourceIds);
      return !sourceIds.length || sourceIds.some(function (sourceId) {
        return !sourceById[sourceId] || sourceById[sourceId].verifiable !== true;
      });
    }).map(function (claim) { return String(claim.id || 'sin-id'); });
    var reviewed = Object.create(null);
    list(contract && contract.reviewedSlides).forEach(function (slideKey) { reviewed[slideKey] = true; });
    var unreviewedSlideKeys = list(contract && contract.slideKeys).filter(function (slideKey) { return !reviewed[slideKey]; });
    return {
      ready: unsupportedClaimIds.length === 0 && unreviewedSlideKeys.length === 0,
      totalClaims: claims.length,
      verifiableClaims: claims.length - unsupportedClaimIds.length,
      unsupportedClaimIds: unsupportedClaimIds,
      unreviewedSlideKeys: unreviewedSlideKeys
    };
  }

  function checklistStatus(contract) {
    var audit = summarize(contract);
    if (audit.ready) {
      return 'Trazabilidad verificada: ' + audit.verifiableClaims + ' afirmaciones con fuente y todas las diapositivas revisadas.';
    }
    var parts = [];
    if (audit.unsupportedClaimIds.length) parts.push(audit.unsupportedClaimIds.length + ' afirmaciones sin respaldo verificable');
    if (audit.unreviewedSlideKeys.length) parts.push(audit.unreviewedSlideKeys.length + ' diapositivas sin revisar');
    return 'Trazabilidad pendiente: ' + parts.join(' y ') + '. Corrige el registro antes de presentar.';
  }

  return { summarize: summarize, checklistStatus: checklistStatus };
});
