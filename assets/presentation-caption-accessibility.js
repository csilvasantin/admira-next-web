(function (global) {
  'use strict';

  var API_VERSION = '1.0.0';
  var DEFAULT_SOURCE_LANGUAGE = 'es';
  var DEFAULT_LABEL = 'Subtítulos en directo';

  function normalizeLanguage(value, fallback) {
    var language = String(value || '').trim().replace(/_/g, '-');
    return /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i.test(language) ? language.toLowerCase() : fallback;
  }

  function normalizeText(value) {
    return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  }

  function isWordCharacter(character) {
    return !!character && /[\p{L}\p{N}_]/u.test(character);
  }

  function replaceTerm(text, term, replacement) {
    var source = String(text);
    var sourceLower = source.toLocaleLowerCase();
    var termLower = term.toLocaleLowerCase();
    var cursor = 0;
    var result = '';
    var match;
    while ((match = sourceLower.indexOf(termLower, cursor)) >= 0) {
      var before = match > 0 ? source[match - 1] : '';
      var afterIndex = match + term.length;
      var after = afterIndex < source.length ? source[afterIndex] : '';
      if ((!before || !isWordCharacter(before)) && (!after || !isWordCharacter(after))) {
        result += source.slice(cursor, match) + replacement;
        cursor = afterIndex;
      } else {
        result += source.slice(cursor, match + term.length);
        cursor = match + term.length;
      }
    }
    return result + source.slice(cursor);
  }

  function createGlossary(initialEntries) {
    var entries = new Map();

    function set(values) {
      entries.clear();
      if (!values || typeof values !== 'object') return list();
      Object.keys(values).forEach(function (term) {
        upsert(term, values[term]);
      });
      return list();
    }

    function upsert(term, replacement) {
      var safeTerm = normalizeText(term);
      var safeReplacement = normalizeText(replacement);
      if (!safeTerm || !safeReplacement || safeTerm.length > 120 || safeReplacement.length > 240) return false;
      entries.set(safeTerm.toLocaleLowerCase(), {term: safeTerm, replacement: safeReplacement});
      return true;
    }

    function remove(term) {
      return entries.delete(normalizeText(term).toLocaleLowerCase());
    }

    function list() {
      var copy = {};
      entries.forEach(function (entry) { copy[entry.term] = entry.replacement; });
      return copy;
    }

    function apply(text) {
      var translated = String(text);
      Array.from(entries.values())
        .sort(function (a, b) { return b.term.length - a.term.length; })
        .forEach(function (entry) { translated = replaceTerm(translated, entry.term, entry.replacement); });
      return translated;
    }

    set(initialEntries);
    return {set: set, upsert: upsert, remove: remove, list: list, apply: apply};
  }

  function createElement(documentRef, tag, className) {
    var element = documentRef.createElement(tag);
    element.className = className;
    return element;
  }

  function create(options) {
    options = options || {};
    var documentRef = options.document || global.document || null;
    var sourceLanguage = normalizeLanguage(options.sourceLanguage, DEFAULT_SOURCE_LANGUAGE);
    var targetLanguage = normalizeLanguage(options.targetLanguage, sourceLanguage);
    var glossary = createGlossary(options.glossary);
    var translatorPromise = null;
    var translatorPair = '';
    var layer = null;
    var caption = null;
    var status = null;
    var sequence = 0;
    var destroyed = false;

    function notify(type, detail) {
      var payload = Object.assign({type: type, sourceLanguage: sourceLanguage, targetLanguage: targetLanguage}, detail || {});
      if (typeof options.onStatus === 'function') options.onStatus(payload);
      return payload;
    }

    function mount(root) {
      if (layer || !documentRef) return layer;
      var host = root || options.container || documentRef.body;
      if (!host || typeof host.appendChild !== 'function') return null;
      layer = createElement(documentRef, 'section', 'presenter-caption-layer');
      layer.hidden = true;
      layer.setAttribute('role', 'region');
      layer.setAttribute('aria-label', options.label || DEFAULT_LABEL);
      layer.setAttribute('data-caption-state', 'idle');
      layer.setAttribute('data-caption-contrast', options.highContrast ? 'high' : 'auto');
      caption = createElement(documentRef, 'p', 'presenter-caption-text');
      caption.setAttribute('aria-live', 'polite');
      caption.setAttribute('aria-atomic', 'true');
      status = createElement(documentRef, 'span', 'presenter-caption-status');
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');
      layer.appendChild(caption);
      layer.appendChild(status);
      host.appendChild(layer);
      return layer;
    }

    function render(result) {
      if (destroyed) return result;
      mount();
      if (layer && caption && status) {
        caption.textContent = result.text;
        if (result.translated) status.textContent = 'Traducción local · ' + targetLanguage.toUpperCase();
        else if (result.reason === 'translation-pending') status.textContent = 'Original · ' + sourceLanguage.toUpperCase() + ' · traduciendo';
        else if (result.reason === 'unsupported') status.textContent = 'Traducción local no disponible · original ' + sourceLanguage.toUpperCase();
        else if (result.reason === 'translation-error' || result.reason === 'empty-translation') status.textContent = 'Falló la traducción local · original ' + sourceLanguage.toUpperCase();
        else status.textContent = 'Original · ' + sourceLanguage.toUpperCase();
        layer.hidden = !result.text;
        layer.setAttribute('data-caption-state', result.status);
        layer.setAttribute('lang', result.translated ? targetLanguage : sourceLanguage);
      }
      if (typeof options.onCaption === 'function') options.onCaption(result);
      return result;
    }

    async function browserTranslator() {
      var pair = sourceLanguage + '>' + targetLanguage;
      if (translatorPromise && translatorPair === pair) return translatorPromise;
      translatorPair = pair;
      var TranslatorApi = global.Translator;
      translatorPromise = (async function () {
        if (!TranslatorApi || typeof TranslatorApi.create !== 'function') throw new Error('translator-unavailable');
        if (typeof TranslatorApi.availability === 'function') {
          var availability = await TranslatorApi.availability({sourceLanguage: sourceLanguage, targetLanguage: targetLanguage});
          if (availability === 'unavailable' || availability === 'no') throw new Error('translator-unavailable');
        }
        var translator = await TranslatorApi.create({sourceLanguage: sourceLanguage, targetLanguage: targetLanguage});
        if (translator && translator.ready && typeof translator.ready.then === 'function') await translator.ready;
        if (!translator || typeof translator.translate !== 'function') throw new Error('translator-unavailable');
        return translator;
      })();
      return translatorPromise;
    }

    function originalResult(original, reason) {
      return {
        text: original,
        originalText: original,
        translated: false,
        status: 'original',
        reason: reason,
        sourceLanguage: sourceLanguage,
        targetLanguage: targetLanguage
      };
    }

    async function translate(value) {
      var original = normalizeText(value);
      if (!original) return originalResult('', 'empty');
      if (!targetLanguage || targetLanguage === sourceLanguage) return originalResult(original, 'same-language');
      try {
        var translator = await browserTranslator();
        var translated = normalizeText(await translator.translate(original));
        if (!translated) return originalResult(original, 'empty-translation');
        return {
          text: glossary.apply(translated),
          originalText: original,
          translated: true,
          status: 'translated',
          reason: null,
          sourceLanguage: sourceLanguage,
          targetLanguage: targetLanguage
        };
      } catch (error) {
        translatorPromise = null;
        notify('translation-fallback', {reason: error && error.message === 'translator-unavailable' ? 'unsupported' : 'translation-error'});
        return originalResult(original, error && error.message === 'translator-unavailable' ? 'unsupported' : 'translation-error');
      }
    }

    async function show(value) {
      var original = normalizeText(value);
      var requestId = ++sequence;
      render(originalResult(original, targetLanguage === sourceLanguage ? 'same-language' : 'translation-pending'));
      if (!original || targetLanguage === sourceLanguage) return originalResult(original, !original ? 'empty' : 'same-language');
      if (layer) layer.setAttribute('data-caption-state', 'translating');
      notify('translation-start', {text: original});
      var result = await translate(original);
      if (requestId !== sequence || destroyed) return Object.assign({}, result, {stale: true});
      render(result);
      notify(result.translated ? 'translation-complete' : 'translation-original', {reason: result.reason});
      return result;
    }

    function hide() {
      sequence += 1;
      if (layer) {
        layer.hidden = true;
        layer.setAttribute('data-caption-state', 'idle');
      }
    }

    function setLanguages(nextSource, nextTarget) {
      sourceLanguage = normalizeLanguage(nextSource, sourceLanguage);
      targetLanguage = normalizeLanguage(nextTarget, sourceLanguage);
      translatorPromise = null;
      translatorPair = '';
      return {sourceLanguage: sourceLanguage, targetLanguage: targetLanguage};
    }

    function setHighContrast(enabled) {
      if (!layer) mount();
      if (layer) layer.setAttribute('data-caption-contrast', enabled ? 'high' : 'auto');
    }

    function destroy() {
      destroyed = true;
      sequence += 1;
      if (layer && layer.parentNode) layer.parentNode.removeChild(layer);
      layer = caption = status = null;
      translatorPromise = null;
    }

    return Object.freeze({
      mount: mount,
      show: show,
      hide: hide,
      translate: translate,
      setLanguages: setLanguages,
      setGlossary: glossary.set,
      updateGlossary: glossary.upsert,
      removeGlossary: glossary.remove,
      getGlossary: glossary.list,
      setHighContrast: setHighContrast,
      destroy: destroy
    });
  }

  global.AdmiraPresenterCaptions = Object.freeze({
    version: API_VERSION,
    storage: 'memory-only',
    create: create,
    capabilities: function () {
      return Object.freeze({
        browserTranslation: !!(global.Translator && typeof global.Translator.create === 'function'),
        externalServices: false,
        persistentGlossary: false
      });
    }
  });
})(window);
