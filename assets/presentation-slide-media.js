(function () {
  'use strict';

  var slides = Array.prototype.slice.call(document.querySelectorAll('.slide'));
  var records = [];
  var startedAt = performance.now();
  var activeIndex = -1;
  var audienceMode = new URLSearchParams(location.search).get('audience') === '1';

  function emit(record, phase, extra) {
    var payload = Object.assign({
      phase: phase,
      slide: record.slide.dataset.slideKey || String(record.index),
      index: record.index,
      type: record.type,
      elapsedMs: Math.max(0, Math.round(performance.now() - record.requestedAt))
    }, extra || {});
    record.metrics.push(payload);
    document.dispatchEvent(new CustomEvent('admira:slide-media-metric', {detail: payload}));
    refreshDiagnostics();
  }

  function resourceMetrics(record) {
    var source = record.media && (record.media.currentSrc || record.media.src);
    if (!source || !performance.getEntriesByName) return {};
    var entries = performance.getEntriesByName(source);
    var resource = entries[entries.length - 1];
    if (!resource) return {};
    return {
      transferBytes: Number(resource.transferSize || 0),
      decodedBytes: Number(resource.decodedBodySize || 0),
      loadMs: Math.max(0, Math.round(resource.responseEnd - resource.startTime))
    };
  }

  function showFallback(record, reason) {
    if (!record.fallback) return;
    record.fallback.hidden = false;
    record.root.dataset.mediaState = 'fallback';
    emit(record, 'fallback', {reason: String(reason || 'unavailable').slice(0, 80)});
  }

  function prepare(record, priority) {
    if (!record.media) return;
    if (record.prepared) {
      if (priority === 'current' && record.media.preload !== record.requestedPreload) {
        record.media.preload = record.requestedPreload;
        if (typeof record.media.load === 'function') {
          try { record.media.load(); } catch (_) {}
        }
      }
      return;
    }
    record.prepared = true;
    record.requestedAt = performance.now();
    if ('preload' in record.media) record.media.preload = priority === 'current' ? record.requestedPreload : (record.requestedPreload === 'none' ? 'none' : 'metadata');
    if (!record.media.getAttribute('src') && record.media.dataset.src) record.media.src = record.media.dataset.src;
    record.root.dataset.mediaState = 'loading';
    emit(record, 'preload', {priority: priority, preload: record.media.preload || 'lazy'});
    if (typeof record.media.load === 'function') {
      try { record.media.load(); } catch (_) {}
    }
    record.stallTimer = setTimeout(function () {
      if (!record.ready) showFallback(record, 'timeout');
    }, 8000);
  }

  function pause(record) {
    if (record.media && typeof record.media.pause === 'function') {
      try { record.media.pause(); } catch (_) {}
      record.control && (record.control.textContent = 'Reproducir');
    }
    if (record.animation) {
      record.animation.classList.remove('is-active');
      record.animation.dataset.animationState = 'idle';
    }
  }

  function play(record, source) {
    if (record.animation) {
      record.animation.classList.remove('is-active');
      void record.animation.offsetWidth;
      record.animation.dataset.animationState = 'playing';
      record.animation.classList.add('is-active');
      emit(record, 'play', {source: source || 'activation'});
      return;
    }
    if (!record.media || typeof record.media.play !== 'function') return;
    prepare(record, 'current');
    var promise;
    try { promise = record.media.play(); }
    catch (_) { showFallback(record, 'play-error'); return; }
    if (promise && typeof promise.catch === 'function') {
      promise.then(function () {
        record.control && (record.control.textContent = 'Pausar');
      });
      promise.catch(function () {
        record.control && (record.control.textContent = 'Reproducir');
        emit(record, 'play-blocked', {source: source || 'activation'});
      });
    }
  }

  function activate(index) {
    if (index === activeIndex || index < 0 || index >= slides.length) return;
    activeIndex = index;
    records.forEach(function (record) {
      if (record.index === index) {
        prepare(record, 'current');
        if (record.autoplay || record.animation) play(record, 'activation');
      } else {
        pause(record);
      }
    });
    var nextRecord = records.find(function (record) { return record.index === index + 1; });
    if (nextRecord) prepare(nextRecord, 'next');
  }

  function refreshDiagnostics() {
    if (audienceMode || !diagnostics) return;
    var ready = records.filter(function (record) { return record.ready; }).length;
    var failed = records.filter(function (record) { return record.root.dataset.mediaState === 'fallback'; }).length;
    var bytes = records.reduce(function (sum, record) {
      var last = record.metrics[record.metrics.length - 1] || {};
      return sum + Number(last.transferBytes || 0);
    }, 0);
    var rights = records.reduce(function (summary, record) {
      var status = record.root.dataset.mediaRightsStatus || 'legacy-review';
      if (status === 'replacement') summary.replaced += 1;
      else if (status === 'carlos-approved') summary.approved += 1;
      else if (['expired', 'denied', 'pending', 'missing-details'].indexOf(status) >= 0) summary.blocked += 1;
      else if (status === 'legacy-review') summary.review += 1;
      return summary;
    }, {approved: 0, blocked: 0, replaced: 0, review: 0});
    diagnostics.textContent = 'Multimedia · ' + ready + '/' + records.length + ' lista · ' + failed + ' fallback · derechos: ' + rights.approved + ' aceptados por Carlos, ' + rights.blocked + ' bloqueados, ' + rights.replaced + ' sustituidos, ' + rights.review + ' por revisar · ' + Math.round(bytes / 1024) + ' KB medidos';
  }

  var diagnostics = null;
  if (!audienceMode) {
    diagnostics = document.createElement('output');
    diagnostics.className = 'slide-media-diagnostics';
    diagnostics.setAttribute('data-presenter-private', '');
    diagnostics.setAttribute('aria-live', 'polite');
    document.body.appendChild(diagnostics);
    var rightsInventory = Array.isArray(window.__ADMIRA_MEDIA_RIGHTS__) ? window.__ADMIRA_MEDIA_RIGHTS__ : [];
    if (rightsInventory.length) {
      var rightsPanel = document.createElement('details');
      rightsPanel.className = 'slide-media-rights';
      rightsPanel.setAttribute('data-presenter-private', '');
      var rightsSummary = document.createElement('summary');
      rightsSummary.textContent = 'Derechos multimedia · ' + rightsInventory.length;
      rightsPanel.appendChild(rightsSummary);
      rightsInventory.forEach(function (item) {
        var row = document.createElement('p');
        var owner = item.holder || 'titular pendiente';
        var expiry = item.expiresAt ? ' · caduca ' + item.expiresAt.slice(0, 10) : '';
        var approval = item.acceptedByCarlos ? ' · aceptación final de Carlos' + (item.acceptedAt ? ' (' + item.acceptedAt.slice(0, 10) + ')' : '') : '';
        row.textContent = item.slide + ' · ' + item.status + approval + ' · ' + (item.license || item.permission || 'sin licencia') + ' · ' + owner + expiry;
        rightsPanel.appendChild(row);
      });
      document.body.appendChild(rightsPanel);
    }
  }

  slides.forEach(function (slide, index) {
    var root = slide.querySelector('[data-slide-media-root]');
    if (!root) return;
    var media = root.querySelector('[data-slide-media-element]');
    var animation = root.matches('[data-slide-media-animation]') ? root : root.querySelector('[data-slide-media-animation]');
    var fallback = root.querySelector('[data-slide-media-fallback]');
    var control = root.querySelector('[data-slide-media-control]');
    var record = {
      index: index,
      slide: slide,
      root: root,
      media: media,
      animation: animation,
      fallback: fallback,
      control: control,
      type: root.dataset.mediaType || '',
      autoplay: root.dataset.mediaAutoplay === 'true',
      requestedPreload: root.dataset.mediaPreload || 'metadata',
      requestedAt: startedAt,
      prepared: false,
      ready: Boolean(animation),
      metrics: [],
      stallTimer: 0
    };
    if (media) {
      if ('preload' in media) media.preload = 'none';
      var markReady = function () {
        record.ready = true;
        clearTimeout(record.stallTimer);
        root.dataset.mediaState = 'ready';
        emit(record, 'ready', Object.assign({duration: Number.isFinite(media.duration) ? Number(media.duration.toFixed(2)) : 0}, resourceMetrics(record)));
      };
      media.addEventListener(media.tagName === 'IMG' ? 'load' : 'loadedmetadata', markReady, {once: true});
      if (media.tagName !== 'IMG') media.addEventListener('canplay', function () { emit(record, 'canplay', resourceMetrics(record)); }, {once: true});
      media.addEventListener('error', function () { clearTimeout(record.stallTimer); showFallback(record, 'media-error'); }, {once: true});
      if (media.tagName !== 'IMG') {
        media.addEventListener('ended', function () {
          control && (control.textContent = 'Reproducir');
          emit(record, 'ended');
        });
      } else if (media.complete && media.naturalWidth) {
        markReady();
      }
    }
    if (control && media) {
      control.addEventListener('click', function () {
        if (media.paused) {
          play(record, 'manual');
          control.textContent = 'Pausar';
        } else {
          pause(record);
          emit(record, 'pause', {source: 'manual'});
        }
      });
    }
    records.push(record);
  });

  if (!records.length) {
    if (diagnostics) diagnostics.remove();
    return;
  }

  window.AdmiraSlideMedia = Object.freeze({
    activate: activate,
    snapshot: function () {
      return {
        activeIndex: activeIndex,
        elapsedMs: Math.round(performance.now() - startedAt),
        records: records.map(function (record) {
          return {
            slide: record.slide.dataset.slideKey || String(record.index),
            index: record.index,
            type: record.type,
            state: record.root.dataset.mediaState || 'idle',
            ready: record.ready,
            metrics: record.metrics.slice()
          };
        })
      };
    }
  });

  if ('IntersectionObserver' in window) {
    var observer = new IntersectionObserver(function (entries) {
      var visible = entries.filter(function (entry) { return entry.isIntersecting; })
        .sort(function (a, b) { return b.intersectionRatio - a.intersectionRatio; })[0];
      if (visible) activate(slides.indexOf(visible.target));
    }, {threshold: [0.55, 0.8]});
    slides.forEach(function (slide) { observer.observe(slide); });
    addEventListener('pagehide', function () { observer.disconnect(); }, {once: true});
  } else {
    var sync = function () {
      var best = 0;
      var distance = Infinity;
      slides.forEach(function (slide, index) {
        var current = Math.abs(slide.getBoundingClientRect().top);
        if (current < distance) { best = index; distance = current; }
      });
      activate(best);
    };
    addEventListener('scroll', sync, {passive: true});
    sync();
  }
  document.addEventListener('admira:slide-change', function (event) {
    activate(Number(event.detail && event.detail.index));
  });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) records.forEach(pause);
    else if (activeIndex >= 0) {
      var activeRecord = records.find(function (record) { return record.index === activeIndex; });
      if (activeRecord && (activeRecord.autoplay || activeRecord.animation)) play(activeRecord, 'visibility');
    }
  });
  addEventListener('pagehide', function () {
    records.forEach(function (record) {
      clearTimeout(record.stallTimer);
      pause(record);
    });
  }, {once: true});
  activate(0);
  refreshDiagnostics();
})();
