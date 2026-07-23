(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AdmiraPresentationVisualAuditor = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  var VERSION = 1;
  var PRIVATE_SELECTOR = '[data-speaker-notes],[data-presenter-private],#admiraPresenterPanel,.presenter-panel,.inline-editor,script,style,noscript';
  var TEXT_SELECTOR = 'h1,h2,h3,h4,h5,h6,p,li,dt,dd,blockquote,figcaption,span,strong,small,a,button';
  var SAFE_AREA_RATIO = 0.05;
  var nextIssueId = 0;

  function number(value, fallback) {
    var parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function parseColor(value) {
    var match = String(value || '').match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)/i);
    if (!match) return null;
    return {
      r: clamp(number(match[1], 0), 0, 255),
      g: clamp(number(match[2], 0), 0, 255),
      b: clamp(number(match[3], 0), 0, 255),
      a: clamp(match[4] === undefined ? 1 : number(match[4], 1), 0, 1)
    };
  }

  function composite(foreground, background) {
    if (!foreground) return background;
    if (!background) background = {r: 255, g: 255, b: 255, a: 1};
    var alpha = foreground.a + background.a * (1 - foreground.a);
    if (!alpha) return {r: 255, g: 255, b: 255, a: 0};
    return {
      r: (foreground.r * foreground.a + background.r * background.a * (1 - foreground.a)) / alpha,
      g: (foreground.g * foreground.a + background.g * background.a * (1 - foreground.a)) / alpha,
      b: (foreground.b * foreground.a + background.b * background.a * (1 - foreground.a)) / alpha,
      a: alpha
    };
  }

  function channel(value) {
    value /= 255;
    return value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  }

  function luminance(color) {
    return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
  }

  function contrastRatio(foreground, background) {
    var lighter = Math.max(luminance(foreground), luminance(background));
    var darker = Math.min(luminance(foreground), luminance(background));
    return (lighter + 0.05) / (darker + 0.05);
  }

  function backgroundColor(element, view) {
    var current = element;
    var result = {r: 255, g: 255, b: 255, a: 1};
    var layers = [];
    while (current && current.nodeType === 1) {
      var color = parseColor(view.getComputedStyle(current).backgroundColor);
      if (color && color.a > 0) layers.push(color);
      current = current.parentElement;
    }
    for (var index = layers.length - 1; index >= 0; index -= 1) result = composite(layers[index], result);
    return result;
  }

  function isPrivate(element) {
    return Boolean(element && element.closest && element.closest(PRIVATE_SELECTOR));
  }

  function isVisible(element, style, rect) {
    return !isPrivate(element) &&
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      number(style.opacity, 1) > 0.01 &&
      rect.width > 1 &&
      rect.height > 1;
  }

  function elementPath(element, slide) {
    if (!element || element === slide) return '';
    if (element.id) return '#' + String(element.id).replace(/[^A-Za-z0-9_-]/g, '\\$&');
    var path = [];
    var current = element;
    while (current && current !== slide && path.length < 4) {
      var name = String(current.tagName || '').toLowerCase();
      if (!name) break;
      var siblings = current.parentElement ? Array.prototype.filter.call(current.parentElement.children, function (child) {
        return child.tagName === current.tagName;
      }) : [];
      if (siblings.length > 1) name += ':nth-of-type(' + (siblings.indexOf(current) + 1) + ')';
      path.unshift(name);
      current = current.parentElement;
    }
    return path.join(' > ');
  }

  function addIssue(issues, slide, slideIndex, element, rule, severity, title, detail, metric) {
    issues.push({
      id: 'visual-audit-' + (++nextIssueId),
      rule: rule,
      severity: severity,
      slideIndex: slideIndex,
      slideNumber: slideIndex + 1,
      slideTitle: slideTitle(slide, slideIndex),
      selector: elementPath(element, slide),
      title: title,
      detail: detail,
      metric: metric || ''
    });
  }

  function slideTitle(slide, index) {
    var heading = slide.querySelector('h1,h2,h3,[data-deck-copy-title]');
    var text = heading && !isPrivate(heading) ? String(heading.textContent || '').replace(/\s+/g, ' ').trim() : '';
    if (text.length > 70) text = text.slice(0, 67) + '…';
    return text || 'Diapositiva ' + (index + 1);
  }

  function auditContrast(slide, slideIndex, view, issues) {
    Array.prototype.forEach.call(slide.querySelectorAll(TEXT_SELECTOR), function (element) {
      if (element.querySelector(TEXT_SELECTOR)) return;
      var style = view.getComputedStyle(element);
      var rect = element.getBoundingClientRect();
      var text = String(element.textContent || '').replace(/\s+/g, ' ').trim();
      if (!text || !isVisible(element, style, rect)) return;
      var foreground = parseColor(style.color);
      if (!foreground) return;
      foreground = composite(foreground, backgroundColor(element, view));
      var ratio = contrastRatio(foreground, backgroundColor(element, view));
      var fontSize = number(style.fontSize, 16);
      var fontWeight = number(style.fontWeight, 400);
      var large = fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700);
      var target = large ? 3 : 4.5;
      if (ratio >= target) return;
      addIssue(
        issues, slide, slideIndex, element, 'contrast',
        ratio < (large ? 2.5 : 3) ? 'blocking' : 'warning',
        'Contraste insuficiente',
        'El texto no alcanza el contraste recomendado para su tamaño.',
        ratio.toFixed(2) + ':1 · objetivo ' + target + ':1'
      );
    });
  }

  function auditImages(slide, slideIndex, view, issues) {
    Array.prototype.forEach.call(slide.querySelectorAll('img,svg,video'), function (element) {
      var style = view.getComputedStyle(element);
      var rect = element.getBoundingClientRect();
      if (!isVisible(element, style, rect)) return;
      var tag = String(element.tagName).toLowerCase();
      if (tag === 'img') {
        if (element.complete && element.naturalWidth === 0) {
          addIssue(issues, slide, slideIndex, element, 'media', 'blocking', 'Imagen no disponible', 'La imagen no ha cargado o su recurso está roto.');
          return;
        }
        if (!element.complete) {
          addIssue(issues, slide, slideIndex, element, 'media', 'warning', 'Imagen pendiente de cargar', 'Repite la auditoría cuando el recurso termine de cargar.');
          return;
        }
        if (!String(element.getAttribute('alt') || '').trim() && !element.hasAttribute('aria-hidden')) {
          addIssue(issues, slide, slideIndex, element, 'media', 'warning', 'Imagen sin alternativa', 'Añade una descripción o marca la imagen como decorativa.');
        }
        if (element.naturalWidth + 2 < rect.width || element.naturalHeight + 2 < rect.height) {
          addIssue(issues, slide, slideIndex, element, 'media', 'warning', 'Resolución de imagen limitada', 'La imagen se muestra por encima de su resolución intrínseca.', Math.round(rect.width) + '×' + Math.round(rect.height) + ' px');
        }
        var intrinsicRatio = element.naturalWidth / Math.max(1, element.naturalHeight);
        var renderedRatio = rect.width / Math.max(1, rect.height);
        if (style.objectFit === 'fill' && Math.abs(intrinsicRatio - renderedRatio) / intrinsicRatio > 0.08) {
          addIssue(issues, slide, slideIndex, element, 'media', 'warning', 'Imagen deformada', 'La proporción renderizada difiere de la proporción original.');
        }
      }
      if (tag === 'svg' && !String(element.getAttribute('aria-label') || '').trim() && element.getAttribute('role') !== 'presentation') {
        addIssue(issues, slide, slideIndex, element, 'media', 'warning', 'Gráfico sin nombre accesible', 'Añade aria-label o marca el SVG como presentación.');
      }
    });
  }

  function auditOverflow(slide, slideIndex, view, issues) {
    Array.prototype.forEach.call(slide.querySelectorAll('*'), function (element) {
      var style = view.getComputedStyle(element);
      var rect = element.getBoundingClientRect();
      if (!isVisible(element, style, rect)) return;
      var clipsX = /hidden|clip/.test(style.overflowX) && element.scrollWidth > element.clientWidth + 2;
      var clipsY = /hidden|clip/.test(style.overflowY) && element.scrollHeight > element.clientHeight + 2;
      if (clipsX || clipsY) {
        addIssue(issues, slide, slideIndex, element, 'overflow', 'blocking', 'Contenido recortado', 'El contenido supera un contenedor que oculta el desbordamiento.', (clipsX ? 'horizontal' : '') + (clipsX && clipsY ? ' + ' : '') + (clipsY ? 'vertical' : ''));
      }
    });
  }

  function auditLegibility(slide, slideIndex, view, issues) {
    var textLength = 0;
    var textElements = 0;
    Array.prototype.forEach.call(slide.querySelectorAll(TEXT_SELECTOR), function (element) {
      if (element.querySelector(TEXT_SELECTOR)) return;
      var style = view.getComputedStyle(element);
      var rect = element.getBoundingClientRect();
      var text = String(element.textContent || '').replace(/\s+/g, ' ').trim();
      if (!text || !isVisible(element, style, rect)) return;
      textLength += text.length;
      textElements += 1;
      var fontSize = number(style.fontSize, 16);
      if (fontSize < 14) addIssue(issues, slide, slideIndex, element, 'legibility', 'blocking', 'Texto demasiado pequeño', 'El tamaño es insuficiente para una pantalla de presentación.', fontSize.toFixed(1) + ' px');
      else if (fontSize < 20) addIssue(issues, slide, slideIndex, element, 'legibility', 'warning', 'Texto pequeño para sala', 'Comprueba la lectura a distancia antes de publicar.', fontSize.toFixed(1) + ' px');
      if (number(style.lineHeight, fontSize * 1.2) < fontSize * 1.08 && text.length > 40) {
        addIssue(issues, slide, slideIndex, element, 'legibility', 'warning', 'Interlineado muy ajustado', 'El bloque largo puede perder legibilidad a distancia.');
      }
    });
    if (textLength > 700 || textElements > 18) {
      addIssue(issues, slide, slideIndex, slide, 'density', 'blocking', 'Diapositiva demasiado densa', 'Reduce contenido o divide la idea en varias diapositivas.', textLength + ' caracteres · ' + textElements + ' bloques');
    } else if (textLength > 430 || textElements > 12) {
      addIssue(issues, slide, slideIndex, slide, 'density', 'warning', 'Densidad elevada', 'Valora simplificar el contenido para una lectura más rápida.', textLength + ' caracteres · ' + textElements + ' bloques');
    }
  }

  function auditSafeArea(slide, slideIndex, view, issues) {
    var slideRect = slide.getBoundingClientRect();
    if (slideRect.width <= 1 || slideRect.height <= 1) return;
    var insetX = slideRect.width * SAFE_AREA_RATIO;
    var insetY = slideRect.height * SAFE_AREA_RATIO;
    var safe = {
      left: slideRect.left + insetX,
      right: slideRect.right - insetX,
      top: slideRect.top + insetY,
      bottom: slideRect.bottom - insetY
    };
    var candidates = Array.prototype.filter.call(slide.querySelectorAll('h1,h2,h3,p,img,svg,video,.inner,.deck-copy,.deck-progress'), function (element) {
      if (isPrivate(element)) return false;
      var tag = String(element.tagName || '').toLowerCase();
      var role = String(element.getAttribute && element.getAttribute('role') || '').toLowerCase();
      var decorativeMedia = /^(img|svg|video)$/.test(tag) && (
        String(element.getAttribute('aria-hidden') || '').toLowerCase() === 'true' ||
        role === 'presentation' ||
        role === 'none'
      );
      return !decorativeMedia;
    });
    candidates.forEach(function (element) {
      var style = view.getComputedStyle(element);
      var rect = element.getBoundingClientRect();
      if (!isVisible(element, style, rect) || style.position === 'fixed') return;
      var beyondSlide = rect.left < slideRect.left - 2 || rect.right > slideRect.right + 2 || rect.top < slideRect.top - 2 || rect.bottom > slideRect.bottom + 2;
      var outsideSafe = rect.left < safe.left - 2 || rect.right > safe.right + 2 || rect.top < safe.top - 2 || rect.bottom > safe.bottom + 2;
      if (!outsideSafe) return;
      addIssue(
        issues, slide, slideIndex, element, 'safe-area',
        beyondSlide ? 'blocking' : 'warning',
        beyondSlide ? 'Elemento fuera de la diapositiva' : 'Elemento fuera del área segura',
        beyondSlide ? 'Parte del elemento queda fuera del lienzo.' : 'Deja al menos un 5% de margen para pantallas y proyectores.'
      );
    });
  }

  function audit(options) {
    options = options || {};
    var documentRef = options.document || (typeof document !== 'undefined' ? document : null);
    var view = options.window || (documentRef && documentRef.defaultView);
    if (!documentRef || !view || typeof view.getComputedStyle !== 'function') throw new Error('Visual auditor requires a rendered document');
    var query = options.search !== undefined ? String(options.search) : String(view.location && view.location.search || '');
    if (new URLSearchParams(query).get('audience') === '1') {
      return {version: VERSION, skipped: true, reason: 'audience-mode', slides: 0, blocking: 0, warnings: 0, issues: []};
    }
    nextIssueId = 0;
    var issues = [];
    var slides = Array.prototype.slice.call(documentRef.querySelectorAll(options.slideSelector || '.slide'));
    slides.forEach(function (slide, slideIndex) {
      auditContrast(slide, slideIndex, view, issues);
      auditImages(slide, slideIndex, view, issues);
      auditOverflow(slide, slideIndex, view, issues);
      auditLegibility(slide, slideIndex, view, issues);
      auditSafeArea(slide, slideIndex, view, issues);
    });
    issues.sort(function (left, right) {
      if (left.severity !== right.severity) return left.severity === 'blocking' ? -1 : 1;
      if (left.slideIndex !== right.slideIndex) return left.slideIndex - right.slideIndex;
      return left.rule.localeCompare(right.rule);
    });
    return {
      version: VERSION,
      skipped: false,
      slides: slides.length,
      blocking: issues.filter(function (issue) { return issue.severity === 'blocking'; }).length,
      warnings: issues.filter(function (issue) { return issue.severity === 'warning'; }).length,
      issues: issues
    };
  }

  function navigateToIssue(issue, options) {
    options = options || {};
    var documentRef = options.document || document;
    var slides = documentRef.querySelectorAll(options.slideSelector || '.slide');
    var slide = slides[issue.slideIndex];
    if (!slide) return false;
    if (typeof options.onNavigate === 'function') options.onNavigate(issue.slideIndex, issue);
    else slide.scrollIntoView({behavior: viewReducedMotion(documentRef.defaultView) ? 'auto' : 'smooth', block: 'start'});
    var previous = documentRef.querySelector('.visual-audit-target');
    if (previous) previous.classList.remove('visual-audit-target');
    var target = issue.selector ? slide.querySelector(issue.selector) : slide;
    target = target || slide;
    target.classList.add('visual-audit-target');
    if (target.__visualAuditTimer) clearTimeout(target.__visualAuditTimer);
    target.__visualAuditTimer = setTimeout(function () { target.classList.remove('visual-audit-target'); }, 2600);
    return true;
  }

  function viewReducedMotion(view) {
    return Boolean(view && view.matchMedia && view.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function mount(options) {
    options = options || {};
    var documentRef = options.document || document;
    var container = options.container || documentRef.getElementById('admiraPresenterPanel');
    if (!container || documentRef.getElementById('presenterVisualAuditor')) return null;
    var section = documentRef.createElement('section');
    section.id = 'presenterVisualAuditor';
    section.className = 'presenter-visual-auditor';
    section.setAttribute('data-audit-state', 'idle');
    section.setAttribute('data-presenter-private', '');
    section.setAttribute('aria-labelledby', 'presenterVisualAuditTitle');

    var head = documentRef.createElement('div');
    head.className = 'presenter-visual-auditor-head';
    var heading = documentRef.createElement('div');
    var eyebrow = documentRef.createElement('span');
    eyebrow.textContent = 'Prepublicación · análisis local';
    var title = documentRef.createElement('strong');
    title.id = 'presenterVisualAuditTitle';
    title.textContent = 'Auditor visual';
    heading.appendChild(eyebrow);
    heading.appendChild(title);
    var state = documentRef.createElement('span');
    state.id = 'presenterVisualAuditState';
    state.setAttribute('role', 'status');
    state.setAttribute('aria-live', 'polite');
    state.textContent = 'Sin ejecutar';
    head.appendChild(heading);
    head.appendChild(state);

    var help = documentRef.createElement('p');
    help.textContent = 'Reglas deterministas en este navegador. No usa IA ni red y no promete equivalencia píxel a píxel.';
    var summary = documentRef.createElement('div');
    summary.id = 'presenterVisualAuditSummary';
    summary.className = 'presenter-visual-audit-summary';
    summary.setAttribute('aria-live', 'polite');
    var list = documentRef.createElement('ol');
    list.id = 'presenterVisualAuditIssues';
    list.className = 'presenter-visual-audit-issues';
    var rerun = documentRef.createElement('button');
    rerun.id = 'presenterVisualAuditRun';
    rerun.type = 'button';
    rerun.textContent = 'Ejecutar auditoría';

    section.appendChild(head);
    section.appendChild(help);
    section.appendChild(summary);
    section.appendChild(list);
    section.appendChild(rerun);
    container.appendChild(section);

    function render(result) {
      section.setAttribute('data-audit-state', result.blocking ? 'blocked' : result.warnings ? 'warning' : 'ready');
      state.textContent = result.blocking ? 'Publicación bloqueada' : result.warnings ? 'Revisar avisos' : 'Sin incidencias';
      summary.textContent = result.slides + ' diapositivas · ' + result.blocking + ' bloqueantes · ' + result.warnings + ' avisos';
      while (list.firstChild) list.removeChild(list.firstChild);
      if (!result.issues.length) {
        var clean = documentRef.createElement('li');
        clean.className = 'presenter-visual-audit-empty';
        clean.textContent = 'No se detectaron incidencias con las reglas disponibles.';
        list.appendChild(clean);
      }
      result.issues.forEach(function (issue) {
        var item = documentRef.createElement('li');
        item.setAttribute('data-severity', issue.severity);
        var button = documentRef.createElement('button');
        button.type = 'button';
        var label = documentRef.createElement('strong');
        label.textContent = (issue.severity === 'blocking' ? 'Bloqueante' : 'Aviso') + ' · Diapositiva ' + issue.slideNumber;
        var titleNode = documentRef.createElement('span');
        titleNode.textContent = issue.title;
        var detail = documentRef.createElement('small');
        detail.textContent = issue.detail + (issue.metric ? ' · ' + issue.metric : '');
        button.appendChild(label);
        button.appendChild(titleNode);
        button.appendChild(detail);
        button.addEventListener('click', function () { navigateToIssue(issue, options); });
        item.appendChild(button);
        list.appendChild(item);
      });
    }

    function run() {
      rerun.disabled = true;
      rerun.textContent = 'Analizando…';
      state.textContent = 'Analizando';
      var result;
      try {
        result = audit({document: documentRef, window: documentRef.defaultView, slideSelector: options.slideSelector});
        render(result);
      } finally {
        rerun.disabled = false;
        rerun.textContent = 'Repetir auditoría';
      }
      return result;
    }

    rerun.addEventListener('click', run);
    return {element: section, run: run, destroy: function () { section.remove(); }};
  }

  return {
    VERSION: VERSION,
    audit: audit,
    mount: mount,
    contrastRatio: contrastRatio,
    parseColor: parseColor
  };
}));
