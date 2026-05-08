(function() {
  // ============ URL ROUTING ============
  const ROUTE_MAP = {
    '/about': 'about',
    '/work': 'work',
    '/clients': 'clients',
    '/skills': 'skills',
    '/contact': 'contact',
    '/social': 'social',
    '/philosophy': 'philosophy',
    '/testimonials': 'testimonials',
    '/awards': 'awards',
    '/privacy': 'privacy',
    '/articles': 'articles',
  };
  const ROUTE_TITLES = {
    '': 'ADmiraNeXT | Diseñador de Producto y Líder de Sistemas de Diseño',
    'about': 'Sobre ADmiraNeXT | 15 años en Diseño de Producto',
    'work': 'Trabajo | 12 Proyectos en 6 Países | ADmiraNeXT',
    'clients': 'Clientes | Más de 30 Empresas | ADmiraNeXT',
    'skills': 'Habilidades | Sistemas de Diseño, UX, Diseño de Producto | ADmiraNeXT',
    'contact': 'Contacto ADmiraNeXT | Diseño y Consultoría',
    'social': 'Perfiles Sociales | ADmiraNeXT',
    'philosophy': 'Filosofía de Diseño | ADmiraNeXT',
    'testimonials': 'Testimonios | Lo que dicen Clientes y Colegas | ADmiraNeXT',
    'awards': 'Premios y Reconocimientos | ADmiraNeXT',
    'privacy': 'Política de Privacidad | ADmiraNeXT',
    'articles': 'Artículos sobre Sistemas de Diseño, UX y Estrategia | ADmiraNeXT',
  };

  function updateUrl(command) {
    const slug = ROUTE_MAP[command];
    if (slug !== undefined) {
      const url = '/' + slug;
      if (window.location.pathname !== url) {
        history.pushState({ cmd: command }, '', url);
      }
      document.title = ROUTE_TITLES[slug] || ROUTE_TITLES[''];
    } else if (command === '/clear' || command === '/help') {
      if (window.location.pathname !== '/') {
        history.pushState({ cmd: '' }, '', '/');
      }
      document.title = ROUTE_TITLES[''];
    }
  }

  // Handle back/forward navigation
  window.addEventListener('popstate', (e) => {
    const path = window.location.pathname.replace(/^\//, '');
    const slug = path || '';
    document.title = ROUTE_TITLES[slug] || ROUTE_TITLES[''];
    if (e.state && e.state.cmd) {
      executeCommand(e.state.cmd);
    } else if (slug) {
      executeCommand('/' + slug);
    }
  });

  // ============ COMMANDS DATA ============
  const COMMANDS = {
    '/help': {
      desc: 'Listar todos los comandos disponibles',
      fn: cmdHelp
    },
    '/about': {
      desc: '¿Quién es ADmiraNeXT?',
      fn: cmdAbout
    },
    '/work': {
      desc: 'Proyectos destacados y estudios de caso',
      fn: cmdWork
    },
    '/clients': {
      desc: 'Empresas con las que he trabajado',
      fn: cmdClients
    },
    '/skills': {
      desc: 'Experiencia y capacidades',
      fn: cmdSkills
    },
    '/philosophy': {
      desc: 'Mi filosofía de diseño',
      fn: cmdPhilosophy
    },
    '/social': {
      desc: 'Perfiles sociales y enlaces',
      fn: cmdSocial
    },
    '/articles': {
      desc: 'Artículos publicados y guías',
      fn: cmdArticles
    },
    '/testimonials': {
      desc: 'Lo que la gente dice de mí',
      fn: cmdTestimonials
    },
    '/awards': {
      desc: 'Premios y reconocimientos',
      fn: cmdAwards
    },
    '/contact': {
      desc: 'Ponerse en contacto',
      fn: cmdContact
    },
    '/clear': {
      desc: 'Limpiar la terminal',
      fn: cmdClear
    },
  };

  // ============ QUICK INFO COMMANDS ============
  const INFO_COMMANDS = {
    '/phone': {
      desc: 'Número de teléfono',
      fn: cmdPhone
    },
    '/email': {
      desc: 'Dirección de correo electrónico',
      fn: cmdEmail
    },
    '/agency': {
      desc: 'ADmiraNeXT — sobre nosotros',
      fn: cmdAgency
    },
    '/location': {
      desc: 'Dónde me encuentro',
      fn: cmdLocation
    },
    '/privacy': {
      desc: 'Política de privacidad y cookies',
      fn: cmdPrivacy
    },
  };

  // ============ PROJECT COMMANDS ============
  const PROJECT_COMMANDS = {
    '/signals': {
      desc: 'Signals — Plataforma de Integridad de Investigación',
      fn: () => cmdProject('Signals')
    },
    '/anylyze': {
      desc: 'Anylyze — Plataforma de Datos Analíticos',
      fn: () => cmdProject('Anylyze')
    },
    '/liveu': {
      desc: 'LiveU — Sistema de Diseño Signa',
      fn: () => cmdProject('LiveU — Signa Design System')
    },
    '/tuiasi': {
      desc: 'TUIASI — Rediseño Universitario',
      fn: () => cmdProject('TUIASI — University Redesign')
    },
    '/resnet': {
      desc: 'ResNet AI — Sistema de Diseño para Hostelería',
      fn: () => cmdProject('ResNet AI')
    },
    '/socyal': {
      desc: 'Socyal — Plataforma Móvil de RR.HH.',
      fn: () => cmdProject('Socyal')
    },
    '/app4home': {
      desc: 'App4Home — App IoT para el Hogar Inteligente',
      fn: () => cmdProject('App4Home')
    },
    '/cyberghost': {
      desc: 'CyberGhost VPN — Privacidad del Consumidor',
      fn: () => cmdProject('CyberGhost VPN')
    },
    '/cognitiveseo': {
      desc: 'CognitiveSEO — Panel de SEO',
      fn: () => cmdProject('CognitiveSEO')
    },
    '/big5': {
      desc: 'Big5 American Diner — Identidad de Marca de Restaurante',
      fn: () => cmdProject('Big5 American Diner')
    },
    '/darnic': {
      desc: 'Darnic — Branding de Campaña de ONG',
      fn: () => cmdProject('Darnic for Education')
    },
    '/crafting-social': {
      desc: 'Crafting Social Stories — Marca de Taller',
      fn: () => cmdProject('Crafting Social Stories')
    },
  };

  // ============ THEME COMMANDS ============
  const THEME_COMMANDS = {
    '/dark': {
      desc: 'Modo oscuro (predeterminado)',
      fn: cmdDark
    },
    '/light': {
      desc: 'Modo claro',
      fn: cmdLight
    },
    '/retro': {
      desc: 'Modo retro CRT',
      fn: cmdRetro
    },
    '/glass': {
      desc: 'Modo cristal moderno',
      fn: cmdGlass
    },
    '/themes': {
      desc: 'Explorar todos los temas',
      fn: cmdThemes
    },
  };

  // Combined lookup for all command groups
  const ALL_COMMAND_GROUPS = [COMMANDS, INFO_COMMANDS, PROJECT_COMMANDS, THEME_COMMANDS];

  // English descriptions for /help (ES descs viven en cada entry como fallback).
  // Si el idioma activo es 'en', getDesc() devuelve esta versión; en caso contrario
  // devuelve data.desc (Spanish original).
  const DESC_EN = {
    '/help':         'List all available commands',
    '/about':        'Who is ADmiraNeXT?',
    '/work':         'Featured projects and case studies',
    '/clients':      'Companies we have worked with',
    '/skills':       'Expertise and capabilities',
    '/philosophy':   'Our design philosophy',
    '/social':       'Social profiles and links',
    '/articles':     'Published articles and guides',
    '/testimonials': 'What people say',
    '/awards':       'Awards and recognition',
    '/contact':      'Get in touch',
    '/clear':        'Clear the terminal',
    '/phone':        'Phone number',
    '/email':        'Email address',
    '/agency':       'ADmiraNeXT — about us',
    '/location':     'Where we are',
    '/privacy':      'Privacy policy and cookies',
    '/dark':         'Dark mode (default)',
    '/light':        'Light mode',
    '/retro':        'Retro CRT mode',
    '/glass':        'Modern glass mode',
    '/themes':       'Explore all themes',
  };
  function getDesc(cmd, fallback) {
    if (window.currentLang === 'en' && DESC_EN[cmd]) return DESC_EN[cmd];
    return fallback;
  }

  // Map de slug-canónico → key de i18n. Sólo para los comandos que tienen
  // versión localizada (los proyectos /signals /liveu etc. mantienen su nombre).
  const SLUG_KEY = {
    '/help': 'cmd.help', '/about': 'cmd.about', '/work': 'cmd.work',
    '/clients': 'cmd.clients', '/skills': 'cmd.skills', '/philosophy': 'cmd.philosophy',
    '/social': 'cmd.social', '/articles': 'cmd.articles', '/testimonials': 'cmd.testimonials',
    '/awards': 'cmd.awards', '/contact': 'cmd.contact', '/clear': 'cmd.clear',
    '/phone': 'cmd.phone', '/email': 'cmd.email', '/agency': 'cmd.agency',
    '/location': 'cmd.location', '/privacy': 'cmd.privacy',
    '/dark': 'cmd.dark', '/light': 'cmd.light', '/retro': 'cmd.retro',
    '/glass': 'cmd.glass', '/themes': 'cmd.themes',
  };
  function displaySlug(cmd) {
    const k = SLUG_KEY[cmd];
    if (k && typeof window.t === 'function') {
      const v = window.t(k);
      if (v && v !== k) return v;
    }
    return cmd;
  }

  // Command aliases
  const ALIASES = {
    // Spanish command aliases (válidos en cualquier idioma)
    '/ayuda': '/help',
    '/sobre': '/about',
    '/acerca': '/about',
    '/acerca de': '/about',
    '/acerca-de': '/about',
    '/quien': '/about',
    '/quienes': '/about',
    '/filosofia': '/philosophy',
    '/filosofía': '/philosophy',
    '/trabajo': '/work',
    '/trabajos': '/work',
    '/proyectos': '/work',
    '/portafolio': '/work',
    '/clientes': '/clients',
    '/habilidades': '/skills',
    '/experiencia': '/skills',
    '/contacto': '/contact',
    '/contratar': '/contact',
    '/correo': '/email',
    '/telefono': '/phone',
    '/teléfono': '/phone',
    '/llamar': '/phone',
    '/temas': '/themes',
    '/tema': '/themes',
    '/agencia': '/agency',
    '/ubicacion': '/location',
    '/ubicación': '/location',
    '/privacidad': '/privacy',
    '/oscuro': '/dark',
    '/claro': '/light',
    '/cristal': '/glass',
    '/articulos': '/articles',
    '/escritos': '/articles',
    '/premios': '/awards',
    '/reconocimientos': '/awards',
    '/testimonios': '/testimonials',
    '/testimoniales': '/testimonials',
    '/recomendaciones': '/testimonials',
    '/redes': '/social',
    '/perfiles': '/social',
    '/limpiar': '/clear',
    '/borrar': '/clear',
    '/secretos': '/secrets',
    '/salir': '/exit',
    '/cerrar': '/exit',
    // English aliases
    '/portfolio': '/work',
    '/projects': '/work',
    '/works': '/work',
    '/me': '/about',
    '/who': '/about',
    '/info': '/about',
    '/expertise': '/skills',
    '/services': '/skills',
    '/writing': '/articles',
    '/blog': '/articles',
    '/publications': '/articles',
    '/reviews': '/testimonials',
    '/recommendations': '/testimonials',
    '/recognition': '/awards',
    '/award': '/awards',
    '/trophies': '/awards',
    '/wins': '/awards',
    '/certificates': '/awards',
    '/certifications': '/awards',
    '/hire': '/contact',
    '/links': '/social',
    '/profiles': '/social',
    '/socials': '/social',
    '/reset': '/clear',
    '/cls': '/clear',
    '/call': '/phone',
    '/productrocket': '/agency',
    '/product-rocket': '/agency',
    '/rocket': '/agency',
    '/mail': '/email',
    // Skill names → /skills
    '/product design': '/skills',
    '/design systems': '/skills',
    '/ux research': '/skills',
    '/ux': '/skills',
    '/ui design': '/skills',
    '/ui': '/skills',
    '/data visualization': '/skills',
    '/brand': '/skills',
    '/design leadership': '/skills',
    '/accessibility': '/skills',
    '/wcag': '/skills',
    '/prototyping': '/skills',
    '/motion': '/skills',
    '/workshop': '/skills',
    // Theme aliases
    '/theme': '/themes',
    '/colors': '/themes',
    '/appearance': '/themes',
    '/darkmode': '/dark',
    '/lightmode': '/light',
    '/dark mode': '/dark',
    '/light mode': '/light',
  };

  // ============ EMAIL OBFUSCATION ============
  const _e = ['info', 'admira.com'].join('@');
  function mailto() { return 'mai' + 'lto:' + _e; }

  // ============ DOM ============
  const bootText = document.getElementById('bootText');
  const terminal = document.getElementById('terminal');
  const terminalBody = document.getElementById('terminalBody');
  const outputArea = document.getElementById('outputArea');
  const cmdInput = document.getElementById('cmdInput');
  const autocompleteEl = document.getElementById('autocomplete');
  const asciiNameEl = document.getElementById('asciiName');
  document.getElementById('emailSubtitle').textContent = _e;
  const closeOverlay = document.getElementById('closeOverlay');

  // ============ SHARP WALLPAPER (lazy) ============
  // Blur wallpaper is the LCP candidate; sharp version only matters when minimized.
  let sharpLoaded = false;
  function loadSharpWallpaper() {
    if (sharpLoaded) return;
    sharpLoaded = true;
    const sharp = document.getElementById('wallpaper-sharp');
    if (!sharp) return;
    sharp.querySelectorAll('source[data-srcset]').forEach(s => {
      s.srcset = s.dataset.srcset;
    });
    const img = sharp.querySelector('img[data-src]');
    if (img) img.src = img.dataset.src;
  }
  if ('requestIdleCallback' in window) {
    window.addEventListener('load', () => requestIdleCallback(loadSharpWallpaper, { timeout: 3000 }), { once: true });
  } else {
    window.addEventListener('load', () => setTimeout(loadSharpWallpaper, 1500), { once: true });
  }

  // ============ TITLEBAR BUTTONS ============
  terminal.querySelector('.titlebar-dot.red').addEventListener('click', () => {
    terminal.style.display = 'none';
    closeOverlay.classList.add('visible');
  });

  document.getElementById('closeReopen').addEventListener('click', () => {
    closeOverlay.classList.remove('visible');
    terminal.style.display = '';
    terminal.classList.remove('minimized');
    document.body.classList.remove('minimized');
    cmdInput.focus();
  });

  terminal.querySelector('.titlebar-dot.yellow').addEventListener('click', () => {
    loadSharpWallpaper();
    const isMinimized = terminal.classList.toggle('minimized');
    document.body.classList.toggle('minimized', isMinimized);
    if (isMinimized) {
      terminal.dataset.wasMaximized = terminal.classList.contains('maximized') ? '1' : '';
      terminal.classList.remove('maximized');
      document.body.classList.remove('maximized');
    } else {
      if (terminal.dataset.wasMaximized === '1') {
        terminal.classList.add('maximized');
        document.body.classList.add('maximized');
      }
      cmdInput.focus();
    }
  });

  terminal.querySelector('.titlebar-dot.green').addEventListener('click', () => {
    if (terminal.classList.contains('minimized')) {
      terminal.classList.remove('minimized');
      document.body.classList.remove('minimized');
    }
    const isMaximized = terminal.classList.toggle('maximized');
    document.body.classList.toggle('maximized', isMaximized);
  });

  let commandHistory = [];
  let historyIndex = -1;
  let acItems = [];
  let acIndex = -1;
  let helpCount = 0;
  let idleTimer = null;
  let idleCount = 0;
  let cmdCount = 0;
  let currentTheme = 'dark';

  // ============ ASCII ART ============
  const ASCII_NAME = `
 █████╗ ██████╗ ███╗   ███╗██╗██████╗  █████╗   ███╗   ██╗███████╗██╗  ██╗████████╗
██╔══██╗██╔══██╗████╗ ████║██║██╔══██╗██╔══██╗  ████╗  ██║██╔════╝╚██╗██╔╝╚══██╔══╝
███████║██║  ██║██╔████╔██║██║██████╔╝███████║  ██╔██╗ ██║█████╗   ╚███╔╝    ██║
██╔══██║██║  ██║██║╚██╔╝██║██║██╔══██╗██╔══██║  ██║╚██╗██║██╔══╝   ██╔██╗    ██║
██║  ██║██████╔╝██║ ╚═╝ ██║██║██║  ██║██║  ██║  ██║ ╚████║███████╗██╔╝ ██╗   ██║
╚═╝  ╚═╝╚═════╝ ╚═╝     ╚═╝╚═╝╚═╝  ╚═╝╚═╝  ╚═╝  ╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝   ╚═╝   `.trim();

  // ============ PIXEL ROCKET SCALE-TO-FIT ============
  function scalePixelRocket() {
    const rocket = document.querySelector('.pixel-rocket');
    if (!rocket) return;
    requestAnimationFrame(() => {
      const parent = rocket.parentElement;
      if (!parent) return;
      const parentW = parent.clientWidth - 32; // account for padding
      const rocketW = rocket.scrollWidth;
      if (rocketW > parentW && parentW > 0) {
        const scale = parentW / rocketW;
        rocket.style.transform = `scale(${scale})`;
        rocket.style.transformOrigin = 'top center';
        rocket.style.height = (rocket.scrollHeight * scale) + 'px';
      }
    });
  }
  window.addEventListener('resize', scalePixelRocket);

  // ============ BOOT SEQUENCE ============
  // bootLines uses i18n keys; texto resuelto en runtime via window.t() para
  // que respete el idioma actual (en/es).
  const bootLines = [
    { key: 'boot.l1',  delay: 200 },
    { key: 'boot.l2',  delay: 150 },
    { key: 'boot.l3',  delay: 200 },
    { key: 'boot.l4',  delay: 100, append: true },
    { key: 'boot.l5',  delay: 100, cls: 'done', append: true },
    { key: 'boot.l6',  delay: 150 },
    { key: 'boot.l7',  delay: 200 },
    { key: 'boot.l8',  delay: 80, cls: 'done', append: true },
    { key: 'boot.l9',  delay: 100 },
    { key: 'boot.l10', delay: 100 },
    { key: 'boot.l11', delay: 80, cls: 'dim' },
    { key: 'boot.l12', delay: 100 },
    { key: 'boot.l13', delay: 300 },
    { key: 'boot.l14', delay: 80, cls: 'accent', append: true },
    { key: 'boot.l15', delay: 200, append: true },
    { key: 'boot.l16', delay: 100 },
  ];
  function _bootText(step) {
    return (typeof window.t === 'function' ? window.t(step.key) : step.key);
  }

  async function runBoot() {
    // Esperar a que el gate de acceso esté desbloqueado antes de hacer nada
    // que pueda robarle el foco al input del password (cmdInput.focus() etc.)
    // o capturarle el Enter (los keydown globales del boot animation).
    if (window.__gateUnlocked && typeof window.__gateUnlocked.then === 'function') {
      await window.__gateUnlocked;
    }
    // Check if we're on a deep-link route (e.g. /about, /work)
    const routeCmd = document.body.dataset.route;
    const isDeepLink = routeCmd && routeCmd.length > 0;

    // Marca body como "booting" para que el wallpaper muestre el banner video
    document.body.classList.add('booting');
    const bootVideo = document.getElementById('bootVideo');
    if (bootVideo) { try { const p = bootVideo.play(); if (p && p.catch) p.catch(() => {}); } catch (e) {} }

    if (isDeepLink) {
      // Skip boot animation for deep links — go straight to terminal
      document.body.classList.remove('booting');
      terminal.classList.remove('booting');
      asciiNameEl.textContent = ASCII_NAME;
      scalePixelRocket();
      await sleep(100);
      cmdInput.focus();
      resetIdleTimer();
      await sleep(200);
      executeCommand(routeCmd);
      return;
    }

    let currentLine = '';
    for (const step of bootLines) {
      await sleep(step.delay || 100);
      const text = _bootText(step);
      if (step.append) {
        const span = document.createElement('span');
        if (step.cls) span.className = step.cls;
        span.textContent = text;
        bootText.appendChild(span);
      } else {
        const div = document.createElement('div');
        if (step.cls) div.className = step.cls;
        div.textContent = text;
        bootText.appendChild(div);
      }
    }

    // Wait for Enter
    await new Promise(resolve => {
      function onKey(e) {
        if (e.key === 'Enter' || e.type === 'click' || e.type === 'touchstart') {
          document.removeEventListener('keydown', onKey);
          document.removeEventListener('click', onKey);
          document.removeEventListener('touchstart', onKey);
          resolve();
        }
      }
      document.addEventListener('keydown', onKey);
      document.addEventListener('click', onKey);
      document.addEventListener('touchstart', onKey);
    });

    document.body.classList.remove('booting');
    terminal.classList.remove('booting');
    bootText.textContent = '';
    asciiNameEl.textContent = ASCII_NAME;
    scalePixelRocket();
    await sleep(100);
    cmdInput.focus();
    resetIdleTimer();

    // Show cookie consent banner if not yet decided
    if (!localStorage.getItem('cookie_consent')) {
      await sleep(600);
      showConsentBanner();
    }

    // Auto-run command from 404 redirect
    const autoCmd = sessionStorage.getItem('autoCommand');
    if (autoCmd) {
      sessionStorage.removeItem('autoCommand');
      await sleep(400);
      executeCommand(autoCmd);
    }
  }

  function showConsentBanner() {
    const _T = (typeof window.t === 'function') ? window.t : (k => k);
    const banner = document.createElement('div');
    banner.className = 'output-block';
    banner.id = 'consentBanner';
    const msg = document.createElement('div');
    msg.className = 'output-line dim';
    msg.style.fontStyle = 'italic';
    msg.innerHTML = `  <span class="accent" style="opacity:0.7">[system]</span> <span data-consent-msg>${_T('consent.msg')}</span>`;
    banner.appendChild(msg);

    const actions = document.createElement('div');
    actions.className = 'output-line';
    actions.style.marginTop = '4px';
    actions.innerHTML = `
      <span style="margin-left:2ch">
        <a href="#" id="consentAccept" style="cursor:pointer;text-decoration:underline;color:var(--text-dim);font-style:italic" data-consent-accept>${_T('consent.accept')}</a>
        <span class="dim"> · </span>
        <a href="#" id="consentDecline" style="cursor:pointer;text-decoration:underline;color:var(--text-dim);font-style:italic" data-consent-decline>${_T('consent.decline')}</a>
        <span class="dim"> · </span>
        <span class="dim" style="font-style:italic" data-consent-privacy>${_T('consent.privacy')}</span>
      </span>
    `;
    banner.appendChild(actions);
    outputArea.appendChild(banner);
    terminalBody.scrollTop = terminalBody.scrollHeight;

    document.getElementById('consentAccept').addEventListener('click', (e) => {
      e.preventDefault();
      localStorage.setItem('cookie_consent', 'granted');
      gtag('consent', 'update', { analytics_storage: 'granted' });
      banner.innerHTML = `<div class="output-line dim" style="font-style:italic">  <span class="accent" style="opacity:0.7">[system]</span> ${_T('consent.granted')}</div>`;
      setTimeout(() => banner.remove(), 3000);
    });

    document.getElementById('consentDecline').addEventListener('click', (e) => {
      e.preventDefault();
      localStorage.setItem('cookie_consent', 'denied');
      banner.innerHTML = `<div class="output-line dim" style="font-style:italic">  <span class="accent" style="opacity:0.7">[system]</span> ${_T('consent.denied')}</div>`;
      setTimeout(() => banner.remove(), 3000);
    });
  }

  // Re-translate consent banner if user toggles language while it's visible
  window.addEventListener('admiranext:langchanged', function () {
    if (typeof window.t !== 'function') return;
    const m = document.querySelector('[data-consent-msg]');
    if (m) m.textContent = window.t('consent.msg');
    const a = document.querySelector('[data-consent-accept]');
    if (a) a.textContent = window.t('consent.accept');
    const d = document.querySelector('[data-consent-decline]');
    if (d) d.textContent = window.t('consent.decline');
    const p = document.querySelector('[data-consent-privacy]');
    if (p) p.textContent = window.t('consent.privacy');
  });

  // ============ PROJECT DATA (shared by cmdWork + cmdProject) ============
  const PROJECTS = [
    { name: 'Signals', year: '2024', type: 'Plataforma de Integridad de Investigación', desc: 'Rediseño de paneles de investigación densos para mayor claridad. Navegación por pestañas, métricas fijas, filtrado dinámico.', tags: ['Diseño UX', 'Dashboard', 'Investigación'], stats: ['60% recuperación más rápida', '100% WCAG', '5x menos scroll'] },
    { name: 'Anylyze', year: '2024', type: 'Plataforma de Datos Analíticos', desc: 'Reconstrucción de la capa de visualización de datos con tipografía de tres niveles y cinco estados de componentes.', tags: ['UX Dashboard', 'Visualización de Datos', 'SaaS'], stats: ['38% tareas más rápidas', '71% menos errores', '9.4/10 confianza'] },
    { name: 'LiveU — Sistema de Diseño Signa', year: '2024', type: 'Empresa de Transmisión', desc: 'Más de 120 componentes para una plataforma global de video en vivo. Diseño Atómico, Plus Jakarta Sans + Inter, cuadrícula de 8px.', tags: ['Sistema de Diseño', 'Empresa', 'Broadcasting'], stats: ['60% más velocidad', '120+ componentes', '100% consistencia'] },
    { name: 'TUIASI — Rediseño Universitario', year: '2023', type: 'Plataforma Educativa', desc: 'Reconstrucción de emergencia en 4 semanas del sitio universitario de una década de antigüedad. Récord de admisiones posterior.', tags: ['Diseño Web', 'UX Educación', 'Arquitectura'], stats: ['+4,200 estudiantes', '91% páginas más ligeras', '10x más rápido'] },
    { name: 'ResNet AI', year: '2023', type: 'Sistema de Diseño para Hostelería', desc: 'Consolidación de más de 1,300 variantes dispersas en un sistema gobernado basado en tokens con documentación completa.', tags: ['Sistema de Diseño', 'Tokens', 'SaaS'], stats: ['60% menos componentes', '40% entrega más rápida', '100% a11y'] },
    { name: 'Socyal', year: '2023', type: 'Plataforma Móvil de RR.HH.', desc: 'Transformación de una herramienta de RR.HH. en un producto móvil independiente listo para inversores. #3 Producto del Día en Product Hunt.', tags: ['Diseño de Producto', 'UX Móvil', 'Product Hunt'], stats: ['#3 Product Hunt', 'entrega en 5 meses'] },
    { name: 'App4Home', year: '2024', type: 'App IoT para el Hogar Inteligente', desc: 'Rediseño de controles domésticos inteligentes con panel consciente del tiempo, navegación por habitaciones y recomendaciones de IA.', tags: ['UX Móvil', 'IoT', 'Diseño de Producto'], stats: ['40% menos desorden', '2x incorporación más rápida'] },
    { name: 'CyberGhost VPN', year: '2018', type: 'App de Privacidad del Consumidor', desc: 'VPN accesible para usuarios no técnicos. Modo oscuro, deslizar para conectar, incorporación en 30 segundos.', tags: ['Ciberseguridad', 'UX Móvil', 'Diseño de Producto'], stats: ['Incorporación en 3 pasos', 'Líder en UX de privacidad'] },
    { name: 'CognitiveSEO', year: '2017', type: 'Dashboard de SEO', desc: 'Reestructuración de tres módulos con divulgación progresiva. Herramientas para usuarios avanzados accesibles para especialistas en marketing.', tags: ['UX Dashboard', 'Visualización de Datos', 'SaaS'], stats: ['40% tareas más rápidas', '30% ↑ retención', '45% menos carga cognitiva'] },
    { name: 'Big5 American Diner', year: '2020', type: 'Identidad de Marca de Restaurante', desc: 'Sistema de marca completo anclado en cinco recetas fundadoras. Estética de restaurante americano de mediados de siglo.', tags: ['Branding', 'Packaging', 'Storytelling'], stats: ['#1 Marca Hostelería Iasi', '100% crecimiento orgánico'] },
    { name: 'Darnic for Education', year: '2024', type: 'Branding de Campaña de ONG', desc: '"La generosidad construye futuros". Marca cohesiva para campaña navideña de entrega de regalos para niños desfavorecidos.', tags: ['Diseño de Logo', 'ONG', 'Guías de Marca'], stats: ['3x producción más rápida', '100% cohesión visual'] },
    { name: 'Crafting Social Stories', year: '2024', type: 'Marca de Taller Educativo', desc: 'Identidad de doble atractivo para talleres infantiles: lúdica pero creíble para donantes corporativos.', tags: ['Branding', 'ONG', 'Identidad Visual'], stats: ['↑ registros de voluntarios', '↑ compromiso de donantes'] },
  ];

  // ============ COMMAND FUNCTIONS ============

  function cmdHelp() {
    const _T = (typeof window.t === 'function') ? window.t : (k => k);
    const sectionStyle = 'text-transform:uppercase;letter-spacing:1px;font-size:0.75em';
    const lines = [
      { text: _T('help.title'), cls: 'heading' },
      { text: '' },
      { html: `  <span class="cmd-desc" style="${sectionStyle}">${_T('help.section.nav')}</span>` },
    ];
    for (const [cmd, data] of Object.entries(COMMANDS)) {
      lines.push({ html: `  <span class="cmd-name">${displaySlug(cmd)}</span> <span class="cmd-desc">${getDesc(cmd, data.desc)}</span>` });
    }
    lines.push({ text: '' });
    lines.push({ html: `  <span class="cmd-desc" style="${sectionStyle}">${_T('help.section.info')}</span>` });
    for (const [cmd, data] of Object.entries(INFO_COMMANDS)) {
      lines.push({ html: `  <span class="cmd-name">${displaySlug(cmd)}</span> <span class="cmd-desc">${getDesc(cmd, data.desc)}</span>` });
    }
    lines.push({ text: '' });
    lines.push({ html: `  <span class="cmd-desc" style="${sectionStyle}">${_T('help.section.projects')}</span>` });
    for (const [cmd, data] of Object.entries(PROJECT_COMMANDS)) {
      lines.push({ html: `  <span class="cmd-name">${displaySlug(cmd)}</span> <span class="cmd-desc">${getDesc(cmd, data.desc)}</span>` });
    }
    lines.push({ text: '' });
    lines.push({ html: `  <span class="cmd-desc" style="${sectionStyle}">${_T('help.section.themes')}</span>` });
    for (const [cmd, data] of Object.entries(THEME_COMMANDS)) {
      lines.push({ html: `  <span class="cmd-name">${displaySlug(cmd)}</span> <span class="cmd-desc">${getDesc(cmd, data.desc)}</span>` });
    }
    lines.push({ text: '' });
    lines.push({ text: _T('help.aliases'), cls: 'dim' });
    lines.push({ text: _T('help.tip'), cls: 'dim' });
    lines.push({ text: '' });
    lines.push({ text: _T('help.suffix'), cls: 'dim', style: 'opacity:0.5;font-style:italic' });
    return lines;
  }

  function cmdAbout() {
    const _T = (typeof window.t === 'function') ? window.t : (k => k);
    return [
      { text: _T('about.title'), cls: 'heading' },
      { text: '' },
      { text: '  ' + _T('about.l1') },
      { text: '' },
      { text: _T('about.h1'), cls: 'heading' },
      { text: '' },
      { text: '  ◆ ' + _T('about.who'), cls: 'cyan' },
      { text: '  ◆ ' + _T('about.what'), cls: 'cyan' },
      { text: '  ◆ ' + _T('about.how'), cls: 'cyan' },
      { text: '  ◆ ' + _T('about.why'), cls: 'cyan' },
      { text: '' },
      { text: _T('about.h2'), cls: 'heading' },
      { text: '' },
      { text: '  ' + _T('about.l2') },
      { text: '' },
      { text: '  ' + _T('about.l3'), cls: 'accent' },
      { text: '' },
      { text: '  → ' + _T('cmd.work') + '   ' + _T('about.tip.work'), cls: 'dim' },
      { text: '  → ' + _T('cmd.contact') + '   ' + _T('about.tip.contact'), cls: 'dim' },
      { text: '  // ' + _T('about.tip.readme'), cls: 'dim', style: 'opacity:0.4' },
    ];
  }

  function cmdWork() {
    const _T = (typeof window.t === 'function') ? window.t : (k => k);
    return [
      { text: _T('work.title'), cls: 'heading' },
      { text: '' },
      { text: '  ' + _T('comingSoon'), cls: 'accent' },
      { text: '' },
      { text: '  ' + _T('work.l1'), cls: 'dim' },
      { text: '' },
      { text: '  → ' + _T('cmd.contact') + ' ' + _T('work.tip'), cls: 'dim' },
    ];
  }

  function cmdClients() {
    const _T = (typeof window.t === 'function') ? window.t : (k => k);
    return [
      { text: _T('clients.title'), cls: 'heading' },
      { text: '' },
      { text: '  ' + _T('comingSoon'), cls: 'accent' },
      { text: '' },
      { text: '  ' + _T('clients.l1'), cls: 'dim' },
    ];
  }

  function cmdSkills() {
    const skills = [
      { name: 'Diseño de Producto', pct: 97, color: 'accent' },
      { name: 'Sistemas de Diseño', pct: 95, color: 'accent' },
      { name: 'Investigación y Estrategia UX', pct: 90, color: 'green' },
      { name: 'Diseño UI y Visual', pct: 95, color: 'green' },
      { name: 'Visualización de Datos', pct: 88, color: 'blue' },
      { name: 'Marca e Identidad', pct: 85, color: 'purple' },
      { name: 'Liderazgo de Diseño', pct: 92, color: 'purple' },
      { name: 'Accesibilidad (WCAG)', pct: 90, color: 'cyan' },
      { name: 'Prototipado y Movimiento', pct: 85, color: 'cyan' },
      { name: 'Facilitación de Talleres', pct: 88, color: 'blue' },
    ];

    const container = document.createElement('div');
    container.innerHTML = `<div class="output-line heading">Experiencia y Capacidades</div><div style="height:8px"></div>`;

    skills.forEach(s => {
      const bar = document.createElement('div');
      bar.className = 'skill-bar';
      bar.innerHTML = `
        <span class="skill-label">${s.name}</span>
        <div class="bar-track"><div class="bar-fill ${s.color}" data-width="${s.pct}%"></div></div>
        <span class="skill-pct">${s.pct}%</span>
      `;
      container.appendChild(bar);
    });

    const toolsSection = document.createElement('div');
    toolsSection.innerHTML = `
      <div class="output-line heading" style="margin-top:20px">Herramientas</div>
      <div class="output-line" style="margin-top:4px">  Figma &bull; Adobe XD &bull; Sketch &bull; After Effects</div>
      <div class="output-line">  Miro &bull; FigJam &bull; Notion &bull; Linear</div>
      <div class="output-line">  HTML/CSS &bull; Webflow &bull; Framer</div>
      <div class="output-line dim" style="margin-top:12px">  → /philosophy para ver cómo pienso</div>
      <div class="output-line dim" style="margin-top:4px;opacity:0.4">  $ ls</div>
    `;
    container.appendChild(toolsSection);

    // Animate bars after render
    requestAnimationFrame(() => {
      setTimeout(() => {
        container.querySelectorAll('.bar-fill').forEach(el => {
          el.style.width = el.dataset.width;
        });
      }, 100);
    });

    return container;
  }

  function cmdPhilosophy() {
    return [
      { text: 'Filosofía de Diseño', cls: 'heading' },
      { text: '' },
      { text: '  "¿Esto elimina la fricción?"', cls: 'accent' },
      { text: '  — La pregunta que me hago en cada etapa.' },
      { text: '' },
      { text: '  ◆ La investigación primero', cls: 'green' },
      { text: '    Análisis, grabaciones de sesiones, comentarios de los usuarios. La intuición es una hipótesis; los datos son la prueba.' },
      { text: '' },
      { text: '  ◆ Construido para escalar', cls: 'green' },
      { text: '    Sistemas de diseño para ciclos de desarrollo más rápidos y experiencias consistentes en todas las plataformas.' },
      { text: '' },
      { text: '  ◆ Resultados sobre productos', cls: 'green' },
      { text: '    Las pantallas hermosas no significan nada sin resultados comerciales medibles.' },
      { text: '' },
      { text: '  ◆ Claridad sobre densidad', cls: 'green' },
      { text: '    La complejidad no es el enemigo, la confusión lo es. Cada elemento gana su píxel.' },
      { text: '' },
      { text: '  ◆ La accesibilidad como base', cls: 'green' },
      { text: '    No es una ocurrencia tardía. El cumplimiento de WCAG es donde comienza el diseño, no donde termina.' },
      { text: '' },
      { text: '  → /contact para iniciar una conversación', cls: 'dim' },
    ];
  }

  function cmdSocial() {
    const container = document.createElement('div');
    container.innerHTML = `
      <div class="output-line heading">Perfiles Sociales</div>
      <div style="height:8px"></div>
    `;

    const links = [
      { icon: '🌐', name: 'Web', url: 'https://csilvasantin.github.io/ADmiraNeXT/', color: 'green', handle: 'csilvasantin.github.io/ADmiraNeXT' },
      { icon: '✉', name: 'Email', url: 'mailto:info@admira.com', color: 'accent', handle: 'info@admira.com' },
    ];

    links.forEach(l => {
      const row = document.createElement('a');
      row.href = l.url;
      row.target = '_blank';
      row.rel = 'noopener noreferrer';
      row.className = 'social-link';
      row.innerHTML = `
        <span class="social-badge ${l.color}">${l.icon}</span>
        <span class="social-name">${l.name}</span>
        <span class="social-handle">${l.handle}</span>
        <span class="social-arrow">→</span>
      `;
      container.appendChild(row);
    });

    const hint = document.createElement('div');
    hint.className = 'output-line dim';
    hint.style.marginTop = '12px';
    hint.textContent = '  → /contact para ponerse en contacto directamente';
    container.appendChild(hint);

    return container;
  }

  function cmdAwards() {
    const container = document.createElement('div');
    container.innerHTML = `
      <div class="output-line heading">Premios y Reconocimientos</div>
      <div class="output-line dim" style="margin-bottom:12px">  admiranext.com — 2026</div>
    `;

    const awards = [
      { icon: '✦', name: 'Awwwards',          handle: 'Mención de Honor',                color: 'accent' },
      { icon: '✦', name: 'The FWA',           handle: 'Caso Destacado',                  color: 'purple' },
      { icon: '✦', name: 'CSS Design Awards', handle: 'Mejor UI · Mejor UX · Innovación', color: 'green'  },
      { icon: '✦', name: 'CSS Winner',        handle: 'Sitio del Día',                   color: 'blue'   },
    ];

    awards.forEach(a => {
      const row = document.createElement('div');
      row.className = 'social-link';
      row.innerHTML = `
        <span class="social-badge ${a.color}">${a.icon}</span>
        <span class="social-name">${a.name}</span>
        <span class="social-handle">${a.handle}</span>
      `;
      container.appendChild(row);
    });

    const blurb = document.createElement('div');
    blurb.className = 'output-line dim';
    blurb.style.marginTop = '12px';
    blurb.textContent = '  Cuatro premios internacionales de diseño para un solo sitio en un año: un portafolio con temática CLI que demostró que no necesitas un carrusel para convencer a los jurados.';
    container.appendChild(blurb);

    const certHeading = document.createElement('div');
    certHeading.className = 'output-line heading';
    certHeading.style.marginTop = '20px';
    certHeading.textContent = 'Certificaciones';
    container.appendChild(certHeading);
    container.insertAdjacentHTML('beforeend', '<div style="height:8px"></div>');

    const cert = document.createElement('a');
    cert.href = 'https://growth.design/certificates/968kip45';
    cert.target = '_blank';
    cert.rel = 'noopener noreferrer';
    cert.className = 'social-link';
    cert.innerHTML = `
      <span class="social-badge green">✓</span>
      <span class="social-name">Growth.Design</span>
      <span class="social-handle">Masterclass en Psicología del Producto · 2025</span>
      <span class="social-arrow">→</span>
    `;
    container.appendChild(cert);

    const hint = document.createElement('div');
    hint.className = 'output-line dim';
    hint.style.marginTop = '12px';
    hint.innerHTML = '  → /about para conocer la historia completa<br>  → /work para ver qué más se ha lanzado';
    container.appendChild(hint);

    const easter = document.createElement('div');
    easter.className = 'output-line dim';
    easter.style.cssText = 'margin-top:4px;opacity:0.4';
    easter.textContent = '  // trophy.case --list';
    container.appendChild(easter);

    return container;
  }

  function cmdContact() {
    const _T = (typeof window.t === 'function') ? window.t : (k => k);
    return [
      { text: _T('contact.title'), cls: 'heading' },
      { text: '' },
      { text: '  ✉  ' + _e, cls: 'accent' },
      { text: '  📞  +34 658 207 699', cls: 'blue' },
      { text: '  📍  ' + _T('location.city'), cls: 'purple' },
      { text: '  🌐  admiranext.com', cls: 'green' },
      { text: '' },
      { text: '  ' + _T('contact.openTo') },
      { text: '' },
      { text: '  ' + _T('contact.cta'), cls: 'accent' },
      { text: '' },
      { text: '  // ' + _T('contact.tip'), cls: 'dim', style: 'opacity:0.4' },
    ];
  }

  function cmdTestimonials() {
    const _T = (typeof window.t === 'function') ? window.t : (k => k);
    return [
      { text: _T('testimonials.title'), cls: 'heading' },
      { text: '' },
      { text: '  ' + _T('comingSoon'), cls: 'accent' },
      { text: '' },
      { text: '  ' + _T('testimonials.l1'), cls: 'dim' },
      { text: '' },
      { text: '  → ' + _T('cmd.contact') + ' ' + _T('testimonials.tip'), cls: 'dim' },
    ];
  }

  function cmdArticles() {
    const _T = (typeof window.t === 'function') ? window.t : (k => k);
    return [
      { text: _T('articles.title'), cls: 'heading' },
      { text: '' },
      { text: '  ' + _T('comingSoon'), cls: 'accent' },
      { text: '' },
      { text: '  ' + _T('articles.l1'), cls: 'dim' },
    ];
  }

  // ============ QUICK INFO FUNCTIONS ============

  // (Personal social commands removed — out of scope for ADmiraNeXT brand.)

  function cmdPhone() {
    const _T = (typeof window.t === 'function') ? window.t : (k => k);
    const container = document.createElement('div');
    container.innerHTML = `
      <div class="output-line heading">${_T('phone.title')}</div>
      <div style="height:8px"></div>
    `;
    const link = document.createElement('a');
    link.href = 'tel:+34658207699';
    link.className = 'social-link';
    link.innerHTML = `
      <span class="social-badge green">📞</span>
      <span class="social-name">+34 658 207 699</span>
      <span class="social-handle">${_T('phone.handle')}</span>
      <span class="social-arrow">→</span>
    `;
    container.appendChild(link);
    const hint = document.createElement('div');
    hint.className = 'output-line dim';
    hint.style.marginTop = '12px';
    hint.textContent = '  → ' + _T('cmd.contact') + ' ' + _T('phone.tip');
    container.appendChild(hint);
    return container;
  }

  function cmdEmail() {
    const _T = (typeof window.t === 'function') ? window.t : (k => k);
    const container = document.createElement('div');
    container.innerHTML = `
      <div class="output-line heading">${_T('email.title')}</div>
      <div style="height:8px"></div>
    `;
    const link = document.createElement('a');
    link.href = mailto();
    link.className = 'social-link';
    link.innerHTML = `
      <span class="social-badge accent">✉</span>
      <span class="social-name">${_e}</span>
      <span class="social-handle">${_T('email.handle')}</span>
      <span class="social-arrow">→</span>
    `;
    container.appendChild(link);
    const hint = document.createElement('div');
    hint.className = 'output-line dim';
    hint.style.marginTop = '12px';
    hint.textContent = '  → ' + _T('cmd.contact') + ' ' + _T('email.tip');
    container.appendChild(hint);
    return container;
  }

  function cmdAgency() {
    const _T = (typeof window.t === 'function') ? window.t : (k => k);
    const container = document.createElement('div');
    container.innerHTML = `
      <div class="output-line heading">${_T('agency.title')}</div>
      <div style="height:8px"></div>
    `;
    const link = document.createElement('a');
    link.href = 'https://admiranext.com';
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.className = 'social-link';
    link.innerHTML = `
      <span class="social-badge accent">🤖</span>
      <span class="social-name">ADmiraNeXT</span>
      <span class="social-handle">admiranext.com</span>
      <span class="social-arrow">→</span>
    `;
    container.appendChild(link);
    const desc = document.createElement('div');
    desc.className = 'output-line';
    desc.style.marginTop = '8px';
    desc.textContent = '  ' + _T('agency.l1');
    container.appendChild(desc);
    const desc2 = document.createElement('div');
    desc2.className = 'output-line';
    desc2.textContent = '  ' + _T('agency.l2');
    container.appendChild(desc2);
    const hint = document.createElement('div');
    hint.className = 'output-line dim';
    hint.style.marginTop = '12px';
    hint.textContent = '  → ' + _T('cmd.work') + ' ' + _T('agency.tip');
    container.appendChild(hint);
    return container;
  }

  function cmdLocation() {
    const _T = (typeof window.t === 'function') ? window.t : (k => k);
    return [
      { text: _T('location.title'), cls: 'heading' },
      { text: '' },
      { text: '  📍  ' + _T('location.city'), cls: 'accent' },
      { text: '  🌍  ' + _T('location.scope') },
      { text: '  🕐  ' + _T('location.tz') },
      { text: '' },
      { text: '  → ' + _T('cmd.contact') + ' ' + _T('location.tip'), cls: 'dim' },
    ];
  }

  function cmdPrivacy() {
    const consent = localStorage.getItem('cookie_consent');
    const status = consent === 'granted' ? 'aceptado' : consent === 'denied' ? 'rechazado' : 'no establecido';
    return [
      { text: 'Política de Privacidad', cls: 'heading' },
      { text: '' },
      { text: '  Última actualización: marzo de 2026' },
      { text: '' },
      { text: 'Qué recopila este sitio', cls: 'heading' },
      { text: '' },
      { text: '  Este sitio utiliza Google Analytics 4 (a través de Google Tag Manager) para comprender cómo interactúan los visitantes con el sitio: páginas vistas, tiempo de permanencia y patrones generales de tráfico.' },
      { text: '' },
      { text: '  No se recopilan datos personales más allá de lo que GA4 recopila por defecto. Sin nombres, sin correos electrónicos, sin seguimiento en otros sitios web.' },
      { text: '' },
      { text: 'Cookies', cls: 'heading' },
      { text: '' },
      { text: '  Las cookies de análisis solo se establecen si las aceptas. Si las rechazas, GA4 se ejecuta en modo sin cookies: solo datos agregados, sin información de identificación.' },
      { text: '' },
      { text: `  Tu elección actual: ${status}`, cls: status === 'aceptado' ? 'green' : status === 'rechazado' ? 'red' : 'dim' },
      { text: '' },
      { text: 'Tus derechos (GDPR)', cls: 'heading' },
      { text: '' },
      { text: '  Tienes derecho a:' },
      { text: '  ◆ Saber qué datos se recopilan sobre ti', cls: 'cyan' },
      { text: '  ◆ Solicitar la eliminación de tus datos', cls: 'cyan' },
      { text: '  ◆ Retirar el consentimiento en cualquier momento', cls: 'cyan' },
      { text: '  ◆ Presentar una reclamación ante una autoridad de control', cls: 'cyan' },
      { text: '' },
      { text: '  Para ejercer estos derechos o hacer preguntas, envía un correo electrónico a ' + _e, cls: 'accent' },
      { text: '' },
      { text: 'Responsable del tratamiento de datos', cls: 'heading' },
      { text: '' },
      { text: '  ADmiraNeXT' },
      { text: '  Product Rocket (productrocket.ro)' },
      { text: '  Str. Trei Fantani 6A, Iasi, Rumania' },
      { text: '  ' + _e },
      { text: '' },
      { text: '  → /contact para ver todas las opciones de contacto', cls: 'dim' },
    ];
  }

  // ============ PROJECT COMMAND FUNCTION ============

  function cmdProject(projectName) {
    const project = PROJECTS.find(p => p.name === projectName);
    if (!project) return [{ text: `  Proyecto "${projectName}" no encontrado.`, cls: 'red' }];

    const container = document.createElement('div');
    const card = document.createElement('div');
    card.className = 'project-card';
    card.innerHTML = `
      <span class="project-year">${project.year}</span>
      <div class="project-name">${project.name}</div>
      <div class="project-type">${project.type}</div>
      <div class="project-desc">${project.desc}</div>
      <div class="project-tags">${project.tags.map(t => `<span class="project-tag">${t}</span>`).join('')}</div>
      ${project.stats ? `<div class="project-stats">${project.stats.map(s => `<span class="project-stat">✦ ${s}</span>`).join('')}</div>` : ''}
    `;
    container.appendChild(card);

    const hint = document.createElement('div');
    hint.className = 'output-line dim';
    hint.style.marginTop = '12px';
    hint.textContent = '  → /work para ver todos los proyectos  •  /contact para discutir este proyecto';
    container.appendChild(hint);
    return container;
  }

  // ============ THEME FUNCTIONS ============

  function setWallpaper(theme) {
    const picture = document.getElementById('wallpaper-picture');
    const sources = picture.querySelectorAll('source');
    const img = picture.querySelector('img');
    sources[0].srcset = theme + '-theme.avif';
    sources[1].srcset = theme + '-theme.webp';
    img.src = theme + '-theme.png';
  }

  function cmdDark() {
    document.documentElement.className = '';
    currentTheme = 'dark';
    setWallpaper('dark');
    return [
      { text: '  ✦ Modo oscuro activado. Como debe ser.', cls: 'accent' },
    ];
  }

  function cmdLight() {
    document.documentElement.className = 'theme-light';
    currentTheme = 'light';
    setWallpaper('light');
    return [
      { text: '  ☀ Modo claro activado. Mis ojos... pero está bien.', cls: 'yellow' },
    ];
  }

  function cmdRetro() {
    document.documentElement.className = 'theme-retro';
    currentTheme = 'retro';
    setWallpaper('retro');
    return [
      { text: '  ▓ Modo CRT activado. Bienvenido a 1983.', cls: 'green' },
      { text: '  Líneas de escaneo: ON | Fósforo: VERDE | Nostalgia: MÁX', cls: 'dim' },
    ];
  }

  function cmdGlass() {
    document.documentElement.className = 'theme-glass';
    currentTheme = 'glass';
    setWallpaper('glass');
    return [
      { text: '  ◈ Modo cristal activado. Transparencia en su máxima expresión.', cls: 'accent' },
    ];
  }

  function cmdThemes() {
    const themes = [
      { cmd: '/dark', label: 'Oscuro', desc: 'Predeterminado — tonos profundos, agradables a la vista', colors: ['#1a1b26', '#24273a', '#e8a87c', '#c3c7d1'], active: currentTheme === 'dark' },
      { cmd: '/light', label: 'Claro', desc: 'Limpio, brillante y profesional', colors: ['#f5f5f5', '#ffffff', '#d08a5a', '#3c3c3c'], active: currentTheme === 'light' },
      { cmd: '/retro', label: 'Retro', desc: 'Resplandor de fósforo CRT de 1983 — líneas de escaneo incluidas', colors: ['#2b2b2b', '#1a1a1a', '#33ff33', '#00cc00'], active: currentTheme === 'retro' },
      { cmd: '/glass', label: 'Cristal', desc: 'Cristal esmerilado con profundidad y desenfoque', colors: ['#1a1b26', '#2a2d3a', '#e8a87c', '#8b9cc7'], active: currentTheme === 'glass' },
    ];

    const container = document.createElement('div');
    container.innerHTML = `<div class="output-line heading">Temas</div><div class="output-line" style="margin-bottom:12px">  Escribe el nombre de un tema para cambiar. Actual: <span class="accent">${currentTheme}</span></div>`;

    themes.forEach(t => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:12px;padding:8px 12px;margin:4px 0;border:1px solid var(--border);border-radius:6px;cursor:pointer;transition:border-color 0.2s,background 0.2s';
      if (t.active) row.style.borderColor = 'var(--accent)';
      const swatches = t.colors.map(c => `<span style="display:inline-block;width:14px;height:14px;border-radius:3px;background:${c};border:1px solid rgba(255,255,255,0.1)"></span>`).join('');
      row.innerHTML = `<div style="display:flex;gap:4px">${swatches}</div><span class="cmd-name">${t.cmd}</span><span class="cmd-desc">${t.desc}</span>${t.active ? '<span class="accent" style="margin-left:auto;font-size:0.75em">● activo</span>' : ''}`;
      row.addEventListener('click', () => executeCommand(t.cmd));
      row.addEventListener('mouseenter', () => { row.style.borderColor = 'var(--accent)'; row.style.background = 'rgba(232,168,124,0.04)'; });
      row.addEventListener('mouseleave', () => { row.style.borderColor = t.active ? 'var(--accent)' : 'var(--border)'; row.style.background = ''; });
      container.appendChild(row);
    });

    const hint = document.createElement('div');
    hint.className = 'output-line dim';
    hint.style.cssText = 'margin-top:12px;font-style:italic';
    hint.textContent = '  Los temas persisten durante tu sesión. Recarga para restablecer.';
    container.appendChild(hint);
    return container;
  }

  function cmdClear() {
    outputArea.innerHTML = '';
    return null;
  }

  // ============ EASTER EGG COMMANDS ============

  // Hidden commands object (not shown in /help autocomplete)
  const HIDDEN_COMMANDS = {};

  function registerHidden(name, fn) {
    HIDDEN_COMMANDS[name] = fn;
  }

  // /easter-eggs — secret cheat sheet
  registerHidden('/easter-eggs', function() {
    return [
      { text: 'Secret Commands', cls: 'heading' },
      { text: '  Shhh... you found the cheat sheet.', cls: 'dim' },
      { text: '' },
      { text: '  Hidden Commands', cls: 'heading' },
      { html: '  <span class="cmd-name">sudo hire admiranext</span> <span class="cmd-desc">Fake contract with progress bar</span>' },
      { html: '  <span class="cmd-name">rm -rf doubts</span> <span class="cmd-desc">Remove all your doubts</span>' },
      { html: '  <span class="cmd-name">/matrix</span> <span class="cmd-desc">Matrix green rain</span>' },
      { html: '  <span class="cmd-name">/figma</span> <span class="cmd-desc">Where I actually live</span>' },
      { html: '  <span class="cmd-name">/coffee</span> <span class="cmd-desc">Design fuel status</span>' },
      { html: '  <span class="cmd-name">ls</span> <span class="cmd-desc">Skills as Linux files</span>' },
      { html: '  <span class="cmd-name">cat readme.md</span> <span class="cmd-desc">A hidden personal message</span>' },
      { html: '  <span class="cmd-name">ping admiranext</span> <span class="cmd-desc">Are we available? Find out</span>' },
      { html: '  <span class="cmd-name">git log</span> <span class="cmd-desc">Totally real commit history</span>' },
      { html: '  <span class="cmd-name">whoami</span> <span class="cmd-desc">The terminal knows you</span>' },
      { html: '  <span class="cmd-name">exit</span> <span class="cmd-desc">Try to leave. I dare you.</span>' },
      { text: '' },
      { text: '  Themes', cls: 'heading' },
      { html: '  <span class="cmd-name">/dark</span> <span class="cmd-desc">Default dark theme</span>' },
      { html: '  <span class="cmd-name">/light</span> <span class="cmd-desc">Light mode (controversial)</span>' },
      { html: '  <span class="cmd-name">/retro</span> <span class="cmd-desc">CRT green phosphor + scanlines</span>' },
      { text: '' },
      { text: '  Secrets', cls: 'heading' },
      { html: '  <span class="cmd-name">/konami</span> <span class="cmd-desc">Party mode with confetti</span>' },
      { html: '  <span class="cmd-name">↑↑↓↓←→←→BA</span> <span class="cmd-desc">Konami code on keyboard</span>' },
      { html: '  <span class="cmd-name">/help x3</span> <span class="cmd-desc">Type help 3 times in a row...</span>' },
      { html: '  <span class="cmd-name">Idle 60s</span> <span class="cmd-desc">Terminal gets impatient</span>' },
    ];
  });
  registerHidden('/eastereggs', function() { return HIDDEN_COMMANDS['/easter-eggs'](); });
  registerHidden('/secrets', function() { return HIDDEN_COMMANDS['/easter-eggs'](); });

  // /secret (singular) — "I'm feeling lucky" random hidden command
  const luckyCommands = [
    '/matrix', 'sudo hire admiranext', 'rm -rf doubts', '/figma', '/coffee',
    'ls', 'cat readme.md', 'ping admiranext', 'git log', 'whoami', '/konami'
  ];
  registerHidden('/secret', function() {
    const pick = luckyCommands[Math.floor(Math.random() * luckyCommands.length)];
    setTimeout(() => executeCommand(pick), 1200);
    return [
      { text: '  I\'m feeling lucky...', cls: 'accent', style: 'font-style:italic' },
      { html: `  Rolling the dice → <span class="cmd-name">${pick}</span>`, cls: 'dim' },
    ];
  });

  // /matrix — green rain
  registerHidden('/matrix', function() {
    runMatrixRain();
    return [
      { text: '  Entering the Matrix...', cls: 'green' },
      { text: '  There is no spoon. Only good design.', cls: 'dim' },
    ];
  });

  // sudo hire admiranext
  function sudoHireRender() {
    const container = document.createElement('div');
    container.innerHTML = `
      <div class="output-line green">  [sudo] password for visitor: ********</div>
      <div class="output-line green">  ✓ Authentication successful.</div>
      <div class="output-line" style="margin-top:8px">  Sending contract to ADmiraNeXT...</div>
      <div class="output-line dim" id="hireProgress">  [░░░░░░░░░░░░░░░░░░░░] 0%</div>
      <div class="output-line accent" id="hireDone" style="display:none;margin-top:8px">  ✦ Contract sent! The ADmiraNeXT team will be in touch shortly.</div>
      <div class="output-line dim" id="hireHint" style="display:none"></div>
    `;
    // Animate progress bar
    setTimeout(() => {
      const bar = document.getElementById('hireProgress');
      const done = document.getElementById('hireDone');
      const hint = document.getElementById('hireHint');
      if (!bar) return;
      let pct = 0;
      const iv = setInterval(() => {
        pct += Math.random() * 15 + 5;
        if (pct >= 100) {
          pct = 100;
          clearInterval(iv);
          bar.textContent = '  [████████████████████] 100%';
          bar.className = 'output-line green';
          if (done) done.style.display = '';
          if (hint) { hint.textContent = '  (Okay fine, just email ' + _e + ')'; hint.style.display = ''; }
          terminalBody.scrollTop = terminalBody.scrollHeight;
        } else {
          const filled = Math.round(pct / 5);
          const empty = 20 - filled;
          bar.textContent = `  [${'█'.repeat(filled)}${'░'.repeat(empty)}] ${Math.round(pct)}%`;
        }
      }, 200);
    }, 300);
    return container;
  }
  registerHidden('sudo hire admiranext', sudoHireRender);
  registerHidden('sudo hire admira', sudoHireRender);
  registerHidden('sudo contratar admiranext', sudoHireRender);

  // rm -rf doubts
  registerHidden('rm -rf doubts', function() {
    return [
      { text: '  $ rm -rf doubts/', cls: 'dim' },
      { text: '  Removing doubts/impostor-syndrome... done', cls: 'green' },
      { text: '  Removing doubts/will-he-deliver... done', cls: 'green' },
      { text: '  Removing doubts/is-he-expensive... done', cls: 'green' },
      { text: '  Removing doubts/can-he-lead... done', cls: 'green' },
      { text: '' },
      { text: '  ✦ All doubts removed. You should definitely hire me.', cls: 'accent' },
    ];
  });

  // /figma
  registerHidden('/figma', function() {
    return [
      { text: '  ┌─────────────────────────────────────┐' },
      { text: '  │                                     │' },
      { text: '  │   ███  ██  ██████  ███   ███  ███   │', cls: 'purple' },
      { text: '  │   █    █   █       █ █ █ █   █   █  │', cls: 'purple' },
      { text: '  │   ███  █   █  ██   █  █  █   █████  │', cls: 'blue' },
      { text: '  │   █    █   █   █   █     █   █   █  │', cls: 'green' },
      { text: '  │   █    ██  █████   █     █   █   █  │', cls: 'accent' },
      { text: '  │                                     │' },
      { text: '  └─────────────────────────────────────┘' },
      { text: '' },
      { text: '  I live here. Send help.', cls: 'accent' },
      { text: '  Current tab count: ∞', cls: 'dim' },
      { text: '  Unsaved changes: always', cls: 'dim' },
    ];
  });

  // /coffee
  registerHidden('/coffee', function() {
    return [
      { text: '           ( (', cls: 'dim' },
      { text: '            ) )', cls: 'dim' },
      { text: '         ........', cls: 'dim' },
      { text: '         |      |]', cls: 'accent' },
      { text: '         \\      /', cls: 'accent' },
      { text: '          `----´', cls: 'accent' },
      { text: '' },
      { text: '  Design fuel level:', cls: 'heading' },
      { text: '  [████████████████░░░░] 80%', cls: 'green' },
      { text: '' },
      { text: '  Status: Caffeinated and pixel-pushing', cls: 'dim' },
      { text: '  Daily intake: Yes', cls: 'dim' },
    ];
  });

  // ls
  registerHidden('ls', function() {
    return [
      { text: '  drwxr-xr-x  AdmiraNext  iot-platform/', cls: 'green' },
      { text: '  drwxr-xr-x  AdmiraNext  fleet-orchestration/', cls: 'blue' },
      { text: '  -rwxr-xr-x  AdmiraNext  physical-ai.bin', cls: 'accent' },
      { text: '  -rw-r--r--  AdmiraNext  robot-as-a-service.so', cls: 'purple' },
      { text: '  -rwxr-xr-x  AdmiraNext  edge-runtime.bin', cls: 'cyan' },
      { text: '  drwxr-xr-x  AdmiraNext  customer-deployments/', cls: 'green' },
      { text: '  -rw-r--r--  AdmiraNext  uptime-sla.cfg', cls: 'yellow' },
      { text: '  -rwxr-xr-x  AdmiraNext  brand-identity.svg', cls: 'accent' },
      { text: '  -rw-r--r--  AdmiraNext  coffee-dependency.lock', cls: 'dim' },
      { text: '  -rw-------  AdmiraNext  secret-sauce.enc', cls: 'red' },
    ];
  });

  // cat readme.md
  registerHidden('cat readme.md', function() {
    return [
      { text: '  # README.md', cls: 'heading' },
      { text: '' },
      { text: '  Hey, you found this. Nice.', cls: 'accent' },
      { text: '' },
      { text: '  If you\'re reading this, you\'re probably the kind of' },
      { text: '  person who inspects elements, reads source code, and' },
      { text: '  appreciates the details. We\'d get along.' },
      { text: '' },
      { text: '  Physical AI is going to eat the world the way software did.' },
      { text: '  Robots in the lobby, on the shop floor, in the warehouse.' },
      { text: '  Owning the hardware is the wrong abstraction — most' },
      { text: '  companies want the outcome, not a fleet to manage.' },
      { text: '' },
      { text: '  So we built ADmiraNeXT: Robot as a Service. You pay for' },
      { text: '  the result; we run the platform, the IoT, and the robots.', cls: 'green' },
      { text: '' },
      { text: '  — ADmiraNeXT', cls: 'accent' },
    ];
  });

  // ping admiranext
  function pingRender() {
    const container = document.createElement('div');
    container.innerHTML = `<div class="output-line dim">  PING admiranext (192.168.1.337): 56 data bytes</div>`;
    const pings = [
      '64 bytes from Barcelona: icmp_seq=0 ttl=64 time=0.1ms — Fleet online',
      '64 bytes from Barcelona: icmp_seq=1 ttl=64 time=0.2ms — All robots reporting',
      '64 bytes from Barcelona: icmp_seq=2 ttl=64 time=0.1ms — IoT platform healthy',
      '64 bytes from Barcelona: icmp_seq=3 ttl=64 time=0.3ms — Ready for your project',
    ];
    pings.forEach((p, i) => {
      const line = document.createElement('div');
      line.className = 'output-line green';
      line.style.opacity = '0';
      line.style.transition = 'opacity 0.3s';
      line.textContent = `  ${p}`;
      container.appendChild(line);
      setTimeout(() => { line.style.opacity = '1'; }, (i + 1) * 600);
    });
    const stats = document.createElement('div');
    stats.className = 'output-line dim';
    stats.style.marginTop = '8px';
    stats.style.opacity = '0';
    stats.style.transition = 'opacity 0.3s';
    stats.textContent = '  --- admiranext ping statistics ---';
    container.appendChild(stats);
    const stats2 = document.createElement('div');
    stats2.className = 'output-line dim';
    stats2.style.opacity = '0';
    stats2.style.transition = 'opacity 0.3s';
    stats2.textContent = '  4 packets transmitted, 4 received, 0% packet loss';
    container.appendChild(stats2);
    setTimeout(() => { stats.style.opacity = '1'; stats2.style.opacity = '1'; }, 3000);
    return container;
  }
  registerHidden('ping admiranext', pingRender);
  registerHidden('ping admira', pingRender);

  // git log
  registerHidden('git log', function() {
    return [
      { text: '  commit a1b2c3d (HEAD -> main)', cls: 'yellow' },
      { text: '  Author: ADmiraNeXT <' + _e + '>', cls: 'dim' },
      { text: '  Date: today', cls: 'dim' },
      { text: '' },
      { text: '      Fixed pixel that was 1px off. Again.', cls: 'accent' },
      { text: '' },
      { text: '  commit e4f5g6h', cls: 'yellow' },
      { text: '  Date: yesterday', cls: 'dim' },
      { text: '' },
      { text: '      Removed 47 unnecessary gradients from client mockup' },
      { text: '' },
      { text: '  commit i7j8k9l', cls: 'yellow' },
      { text: '  Date: 2 days ago', cls: 'dim' },
      { text: '' },
      { text: '      Convinced stakeholder that Comic Sans is not on-brand' },
      { text: '' },
      { text: '  commit m0n1o2p', cls: 'yellow' },
      { text: '  Date: 3 days ago', cls: 'dim' },
      { text: '' },
      { text: '      Refactored entire design system at 2am. No regrets.' },
      { text: '' },
      { text: '  commit q3r4s5t', cls: 'yellow' },
      { text: '  Date: last week', cls: 'dim' },
      { text: '' },
      { text: '      Deleted production Figma file. Recovered it. Nobody noticed.' },
      { text: '' },
      { text: '  commit u6v7w8x', cls: 'yellow' },
      { text: '  Date: last month', cls: 'dim' },
      { text: '' },
      { text: '      Added dark mode. Refused to add light mode. Stood ground.' },
    ];
  });

  // whoami / quiensoyyo (alias ES)
  function whoamiLines() {
    const T = (typeof window.t === 'function') ? window.t : function (k) { return k; };
    return [
      { text: T('whoami.line1'), cls: 'accent' },
      { text: '' },
      { text: T('whoami.line2'), cls: 'dim' },
    ];
  }
  registerHidden('whoami', whoamiLines);
  registerHidden('quiensoyyo', whoamiLines);
  registerHidden('quien soy yo', whoamiLines);
  registerHidden('quiensoy', whoamiLines);

  // exit / quit
  registerHidden('quit', function() { return HIDDEN_COMMANDS['exit'](); });
  registerHidden('/exit', function() { return HIDDEN_COMMANDS['exit'](); });
  registerHidden('/quit', function() { return HIDDEN_COMMANDS['exit'](); });
  registerHidden('exit', function() {
    return [
      { text: '  There is no escape.', cls: 'red' },
      { text: '  But /contact is a way forward.', cls: 'green' },
      { text: '' },
      { text: '  (You\'re stuck here now. Might as well explore.)', cls: 'dim' },
    ];
  });


  // /konami (also triggered by key sequence)
  registerHidden('/konami', function() {
    runConfetti();
    return [
      { text: '  🎉 ↑ ↑ ↓ ↓ ← → ← → B A', cls: 'accent' },
      { text: '  PARTY MODE ACTIVATED!', cls: 'yellow' },
      { text: '' },
      { text: '  You found the Konami code! Have some confetti.', cls: 'green' },
    ];
  });

  // ============ MATRIX RAIN ============

  function runMatrixRain() {
    const canvas = document.getElementById('matrixCanvas');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.classList.add('active');

    const chars = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ADMIRANEXT';
    const fontSize = 14;
    const columns = Math.floor(canvas.width / fontSize);
    const drops = Array(columns).fill(1);

    let frameCount = 0;
    const maxFrames = 180; // ~3 seconds at 60fps

    function draw() {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#33ff33';
      ctx.font = fontSize + 'px monospace';

      for (let i = 0; i < drops.length; i++) {
        const text = chars[Math.floor(Math.random() * chars.length)];
        ctx.fillText(text, i * fontSize, drops[i] * fontSize);
        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i]++;
      }

      frameCount++;
      if (frameCount < maxFrames) {
        requestAnimationFrame(draw);
      } else {
        // Fade out
        canvas.classList.remove('active');
        setTimeout(() => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }, 400);
      }
    }
    draw();
  }

  // ============ CONFETTI ============

  function runConfetti() {
    const canvas = document.getElementById('confettiCanvas');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ['#e8a87c', '#7ec89b', '#7caae8', '#e87c7c', '#b88ce8', '#e8d87c', '#7ce8d8'];
    const particles = [];

    for (let i = 0; i < 150; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height - canvas.height,
        w: Math.random() * 8 + 4,
        h: Math.random() * 4 + 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: (Math.random() - 0.5) * 4,
        vy: Math.random() * 3 + 2,
        rot: Math.random() * Math.PI * 2,
        rotV: (Math.random() - 0.5) * 0.2,
        opacity: 1,
      });
    }

    let frameCount = 0;
    const maxFrames = 180;

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      frameCount++;
      const fade = frameCount > 120 ? 1 - (frameCount - 120) / 60 : 1;

      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.rotV;
        p.vy += 0.05;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = fade;
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });

      if (frameCount < maxFrames) {
        requestAnimationFrame(draw);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
    draw();
  }

  // ============ KONAMI CODE LISTENER ============

  const konamiSequence = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
  let konamiIndex = 0;

  document.addEventListener('keydown', (e) => {
    if (e.key === konamiSequence[konamiIndex] || e.key.toLowerCase() === konamiSequence[konamiIndex]) {
      konamiIndex++;
      if (konamiIndex === konamiSequence.length) {
        konamiIndex = 0;
        executeCommand('/konami');
      }
    } else {
      konamiIndex = 0;
    }
  });

  // Re-translate idle hints already rendered cuando el usuario cambia idioma
  window.addEventListener('admiranext:langchanged', function () {
    if (typeof window.t !== 'function') return;
    document.querySelectorAll('[data-idle-i18n]').forEach(function (el) {
      el.textContent = '  ' + window.t(el.dataset.idleI18n);
    });
  });

  // ============ IDLE TIMER ============

  // Video idle: tras N segundos sin actividad, body.idle se activa →
  // el wallpaper-video fade-in y la imagen fade-out (CSS hace el cross-fade).
  const VIDEO_IDLE_MS = 8000;
  let videoIdleTimer = null;
  const wallpaperVideo = document.getElementById('wallpaperVideo');
  function enterIdle() {
    if (document.body.classList.contains('idle')) return;
    if (document.getElementById('password-screen') &&
        document.getElementById('password-screen').style.display !== 'none') return;
    document.body.classList.add('idle');
    if (wallpaperVideo) {
      try { const p = wallpaperVideo.play(); if (p && p.catch) p.catch(() => {}); } catch (e) {}
    }
  }
  function exitIdle() {
    if (!document.body.classList.contains('idle')) return;
    document.body.classList.remove('idle');
  }
  function resetVideoIdle() {
    exitIdle();
    clearTimeout(videoIdleTimer);
    videoIdleTimer = setTimeout(enterIdle, VIDEO_IDLE_MS);
  }
  ['mousemove', 'mousedown', 'keydown', 'wheel', 'touchstart'].forEach(function (ev) {
    document.addEventListener(ev, resetVideoIdle, { passive: true });
  });
  // Arranca el primer ciclo en cuanto cargue el documento
  document.addEventListener('DOMContentLoaded', resetVideoIdle);
  // También cuando el usuario desbloquea el gate
  if (window.__gateUnlocked && typeof window.__gateUnlocked.then === 'function') {
    window.__gateUnlocked.then(resetVideoIdle);
  }

  const idleHintKeys = ['idle.1', 'idle.2', 'idle.3', 'idle.4', 'idle.5', 'idle.6'];

  function resetIdleTimer() {
    clearTimeout(idleTimer);
    const firstDelay = idleCount === 0 ? 10000 : 45000;
    idleTimer = setTimeout(function showIdleHint() {
      const block = document.createElement('div');
      block.className = 'output-block';
      const line = document.createElement('div');
      line.className = 'output-line dim';
      line.style.fontStyle = 'italic';
      const key = idleHintKeys[Math.min(idleCount, idleHintKeys.length - 1)];
      const txt = (typeof window.t === 'function' ? window.t(key) : key);
      line.dataset.idleI18n = key;
      line.textContent = '  ' + txt;
      block.appendChild(line);
      outputArea.appendChild(block);
      terminalBody.scrollTop = terminalBody.scrollHeight;
      idleCount++;
      if (idleCount < idleHintKeys.length) {
        idleTimer = setTimeout(showIdleHint, 45000);
      }
    }, firstDelay);
  }

  // ============ COMMAND EXECUTION ============

  function applyStaggerAnimation(container) {
    const selectors = '.output-line, .project-card, .client-item, .skill-bar';
    const children = container.querySelectorAll(selectors);
    let index = 0;
    const maxStagger = 30;
    children.forEach(el => {
      // Skip cmd-echo children and empty spacer lines
      if (el.closest('.cmd-echo')) return;
      if (el.classList.contains('output-line') && !el.textContent.trim() && !el.innerHTML.trim()) return;
      if (index < maxStagger) {
        el.classList.add('stagger-child');
        el.style.setProperty('--i', index);
        index++;
      } else {
        el.classList.add('stagger-child');
        el.style.setProperty('--i', maxStagger);
      }
    });
  }

  function renderCommandResult(block, hiddenFn, cmd) {
    const fn = hiddenFn || (cmd && cmd.fn);
    if (!fn) return;
    const result = fn();
    if (result === null) return;
    if (result instanceof HTMLElement) {
      block.appendChild(result);
    } else if (Array.isArray(result)) {
      result.forEach(line => {
        const div = document.createElement('div');
        div.className = 'output-line' + (line.cls ? ' ' + line.cls : '');
        if (line.style) div.setAttribute('style', line.style);
        if (line.html) {
          div.innerHTML = line.html;
        } else {
          div.textContent = line.text;
        }
        block.appendChild(div);
      });
    }
    // Apply staggered reveal animation to content children
    applyStaggerAnimation(block);
  }

  // ============ NATURAL LANGUAGE INTENT MATCHING ============
  const INTENT_MAP = [
    // About
    { cmd: '/about', phrases: ['about admiranext', 'about admira', 'who is admiranext', 'who are you', 'who is this', 'tell me about', 'about you', 'introduce yourself', 'bio', 'background', 'what do you do'] },
    // Contact
    { cmd: '/contact', phrases: ['get in touch', 'reach out', 'hire admiranext', 'contact admiranext', 'how to reach', 'how to contact', 'want to hire', 'book a call', 'schedule a call', 'talk to admiranext', 'send a message', 'i need a robot', 'need robotics', 'need help'] },
    // Work / Portfolio
    { cmd: '/work', phrases: ['show work', 'show portfolio', 'show projects', 'your work', 'your projects', 'case studies', 'what have you done', 'what did you build', 'previous work', 'past projects'] },
    // Skills
    { cmd: '/skills', phrases: ['what can you do', 'your skills', 'your capabilities', 'your expertise', 'areas of expertise', 'skill set', 'services you offer', 'what services'] },
    // Clients
    { cmd: '/clients', phrases: ['who have you worked with', 'your clients', 'companies', 'who do you work for', 'worked with', 'client list', 'past clients'] },
    // Social
    { cmd: '/social', phrases: ['social media', 'social links', 'social profiles', 'your socials', 'online presence'] },
    // Testimonials
    { cmd: '/testimonials', phrases: ['what people say', 'reviews', 'feedback', 'recommendations', 'what others say', 'client feedback', 'endorsements'] },
    // Philosophy
    { cmd: '/philosophy', phrases: ['design philosophy', 'how do you work', 'your approach', 'your process', 'design approach', 'how you design', 'your methodology', 'your principles', 'values'] },
    // Email
    { cmd: '/email', phrases: ['email address', 'your email', 'mail address', 'send email', 'write email'] },
    // Phone
    { cmd: '/phone', phrases: ['phone number', 'your phone', 'call number', 'telephone'] },
    // Location
    { cmd: '/location', phrases: ['where are you', 'where is admiranext', 'your location', 'based in', 'where based', 'what city', 'which country'] },
    // Articles
    { cmd: '/articles', phrases: ['your articles', 'blog posts', 'what have you written', 'publications', 'your writing', 'read articles'] },
    // Awards
    { cmd: '/awards', phrases: ['your awards', 'recognition', 'have you won', 'won any awards', 'design awards', 'awwwards', 'the fwa', 'css design awards', 'css winner', 'certifications', 'certificates', 'growth design'] },
    // Agency
    { cmd: '/agency', phrases: ['your agency', 'product rocket', 'your company', 'your studio'] },
    // Themes
    { cmd: '/themes', phrases: ['change theme', 'change color', 'change colours', 'dark mode', 'light mode', 'switch theme', 'change appearance', 'change the look', 'how to change theme', 'customize'] },
    // Help
    { cmd: '/help', phrases: ['help me', 'what can i do', 'list commands', 'show commands', 'available commands', 'how does this work', 'instructions', 'what is this'] },
  ];

  function matchIntent(input) {
    const lower = input.toLowerCase().trim();
    let bestMatch = null;
    let bestScore = 0;

    for (const intent of INTENT_MAP) {
      for (const phrase of intent.phrases) {
        // Exact phrase match
        if (lower === phrase) return intent.cmd;

        // Input contains the full phrase
        if (lower.includes(phrase)) {
          const score = phrase.length / lower.length;
          if (score > bestScore) { bestScore = score; bestMatch = intent.cmd; }
          continue;
        }

        // Word overlap scoring — at least 2 matching words needed
        const inputWords = lower.split(/\s+/);
        const phraseWords = phrase.split(/\s+/);
        const matchingWords = phraseWords.filter(w => inputWords.includes(w));
        if (matchingWords.length >= 2 || (matchingWords.length === 1 && phraseWords.length === 1)) {
          const score = matchingWords.length / phraseWords.length * 0.8;
          if (score > bestScore) { bestScore = score; bestMatch = intent.cmd; }
        }
      }
    }

    // Only return if confidence is reasonable
    return bestScore >= 0.4 ? bestMatch : null;
  }

  function executeCommand(input) {
    const raw = input.trim().toLowerCase();
    if (!raw) return;

    // Restore from minimized mode
    if (terminal.classList.contains('minimized')) {
      terminal.classList.remove('minimized');
      document.body.classList.remove('minimized');
      terminal.dataset.wasMaximized = '';
    }

    // Reset idle timer on any command
    resetIdleTimer();

    // Save to history
    commandHistory.unshift(input.trim());
    if (commandHistory.length > 50) commandHistory.pop();
    historyIndex = -1;

    // Command counter milestones
    cmdCount++;
    const milestoneKeys = {
      3: 'milestone.3',
      5: 'milestone.5',
      7: 'milestone.7',
      12: 'milestone.12',
    };
    if (milestoneKeys[cmdCount]) {
      setTimeout(() => {
        const note = document.createElement('div');
        note.className = 'output-block';
        const sys = document.createElement('div');
        sys.className = 'output-line dim';
        sys.style.fontStyle = 'italic';
        const _T = (typeof window.t === 'function') ? window.t : function(k){return k;};
        sys.innerHTML = `  <span class="accent" style="opacity:0.7">[system]</span> ${_T(milestoneKeys[cmdCount])}`;
        note.appendChild(sys);
        outputArea.appendChild(note);
        terminalBody.scrollTop = terminalBody.scrollHeight;
      }, 1500);
    }

    // Track help count for easter egg
    if (raw === '/help' || raw === 'help') {
      helpCount++;
      if (helpCount >= 3) {
        helpCount = 0;
        // Auto-redirect after showing help
        setTimeout(() => {
          const nudge = document.createElement('div');
          nudge.className = 'output-block';
          const line = document.createElement('div');
          line.className = 'output-line accent';
          line.style.fontStyle = 'italic';
          line.textContent = '  You seem lost. Here, let me just show you...';
          nudge.appendChild(line);
          outputArea.appendChild(nudge);
          terminalBody.scrollTop = terminalBody.scrollHeight;
          setTimeout(() => executeCommand('/about'), 800);
        }, 500);
      }
    } else {
      helpCount = 0;
    }

    // Check hidden commands first
    const hiddenFn = HIDDEN_COMMANDS[raw];

    // Resolve aliases for regular commands
    const resolved = ALIASES[raw] || raw;
    let cmd = COMMANDS[resolved] || INFO_COMMANDS[resolved] || PROJECT_COMMANDS[resolved] || THEME_COMMANDS[resolved];

    // If no match yet, try prefixing with "/" for bare-word input
    let isFuzzyMatch = false;
    let fuzzyResolved = null;
    if (!cmd && !hiddenFn && !raw.startsWith('/')) {
      const withSlash = '/' + raw;
      const aliasResolved = ALIASES[withSlash] || withSlash;
      const fuzzyCmd = COMMANDS[aliasResolved] || INFO_COMMANDS[aliasResolved] || PROJECT_COMMANDS[aliasResolved] || THEME_COMMANDS[aliasResolved];
      if (fuzzyCmd) {
        cmd = fuzzyCmd;
        isFuzzyMatch = true;
        fuzzyResolved = aliasResolved;
      }
    }

    // Natural language intent matching — detect phrases and map to commands
    if (!cmd && !hiddenFn) {
      const intentMatch = matchIntent(raw);
      if (intentMatch) {
        const intentCmd = COMMANDS[intentMatch] || INFO_COMMANDS[intentMatch] || PROJECT_COMMANDS[intentMatch] || THEME_COMMANDS[intentMatch];
        if (intentCmd) {
          cmd = intentCmd;
          isFuzzyMatch = true;
          fuzzyResolved = intentMatch;
        }
      }
    }

    // Update URL for routable commands
    const finalCmd = fuzzyResolved || resolved;
    updateUrl(finalCmd);

    // Create output block
    const block = document.createElement('div');
    block.className = 'output-block';

    // Echo the command
    const echo = document.createElement('div');
    echo.className = 'cmd-echo';
    echo.innerHTML = `<span class="prompt-symbol">&gt;</span> ${escapeHtml(input.trim())}`;
    block.appendChild(echo);

    // Commands that skip thinking animation
    const skipThinking = ['/clear', 'clear', '/matrix', 'matrix'];
    const needsThinking = !skipThinking.includes(raw) && (hiddenFn || cmd);

    if (needsThinking) {
      if (isFuzzyMatch) {
        // Multi-step "intent detection" animation for bare-word input
        const thinking = document.createElement('div');
        thinking.className = 'thinking-indicator';
        thinking.innerHTML = `<span class="thinking-text">Processing</span><span class="thinking-dots"><span></span><span></span><span></span></span>`;
        block.appendChild(thinking);
        outputArea.appendChild(block);
        requestAnimationFrame(() => { terminalBody.scrollTop = terminalBody.scrollHeight; });

        const isNaturalLanguage = input.trim().includes(' ');
        const delay1 = 600 + Math.random() * 800;
        setTimeout(() => {
          // Step 1: acknowledge the input
          thinking.remove();
          const step1 = document.createElement('div');
          step1.className = 'output-line dim';
          step1.style.fontStyle = 'italic';
          step1.innerHTML = isNaturalLanguage
            ? `  Interpreting: "${escapeHtml(input.trim())}"...`
            : `  "${escapeHtml(input.trim())}" doesn't look like a valid command...`;
          block.appendChild(step1);
          requestAnimationFrame(() => { terminalBody.scrollTop = terminalBody.scrollHeight; });

          const delay2 = 800 + Math.random() * 600;
          setTimeout(() => {
            // Step 2: "assuming intent"
            const step2 = document.createElement('div');
            step2.className = 'output-line accent';
            step2.style.fontStyle = 'italic';
            step2.innerHTML = isNaturalLanguage
              ? `  I think you're looking for <span class="cmd-name">${fuzzyResolved}</span> — loading results`
              : `  Assuming you meant <span class="cmd-name">${fuzzyResolved}</span> — loading results`;
            block.appendChild(step2);

            // Step 2.5: show new thinking dots
            const thinking2 = document.createElement('div');
            thinking2.className = 'thinking-indicator';
            thinking2.innerHTML = `<span class="thinking-text">Resolving</span><span class="thinking-dots"><span></span><span></span><span></span></span>`;
            block.appendChild(thinking2);
            requestAnimationFrame(() => { terminalBody.scrollTop = terminalBody.scrollHeight; });

            const delay3 = 600 + Math.random() * 800;
            setTimeout(() => {
              // Step 3: show the actual result
              thinking2.remove();
              renderCommandResult(block, hiddenFn, cmd);
              requestAnimationFrame(() => { terminalBody.scrollTop = terminalBody.scrollHeight; });
              setTimeout(() => {
                block.querySelectorAll('.bar-fill').forEach(el => {
                  el.style.width = el.dataset.width;
                });
              }, 100);
            }, delay3);
          }, delay2);
        }, delay1);
      } else {
        // Standard thinking animation for proper /commands
        const thinking = document.createElement('div');
        thinking.className = 'thinking-indicator';
        const thinkingPhrases = [
          'Processing', 'Fetching data', 'Loading', 'Compiling',
          'Resolving', 'Querying', 'Scanning', 'Rendering'
        ];
        const phrase = thinkingPhrases[Math.floor(Math.random() * thinkingPhrases.length)];
        thinking.innerHTML = `<span class="thinking-text">${phrase}</span><span class="thinking-dots"><span></span><span></span><span></span></span>`;
        block.appendChild(thinking);
        outputArea.appendChild(block);
        requestAnimationFrame(() => { terminalBody.scrollTop = terminalBody.scrollHeight; });

        // ~8% chance: briefly glitch a hidden command name into the thinking text
        if (Math.random() < 0.08) {
          const glitchWords = ['matrix', 'sudo hire admiranext', 'konami', 'secrets', 'ping admiranext', 'git log', 'figma', 'coffee'];
          const glitchWord = glitchWords[Math.floor(Math.random() * glitchWords.length)];
          const textEl = thinking.querySelector('.thinking-text');
          const glitchDelay = 200 + Math.random() * 400;
          setTimeout(() => {
            if (!textEl || !textEl.parentNode) return;
            const original = textEl.textContent;
            textEl.textContent = glitchWord;
            textEl.style.opacity = '0.6';
            textEl.style.fontStyle = 'italic';
            setTimeout(() => {
              if (!textEl.parentNode) return;
              textEl.textContent = original;
              textEl.style.opacity = '';
              textEl.style.fontStyle = '';
            }, 120 + Math.random() * 80);
          }, glitchDelay);
        }

        // Random delay 800-2500ms for natural feel
        const delay = 800 + Math.random() * 1700;
        setTimeout(() => {
          thinking.remove();
          renderCommandResult(block, hiddenFn, cmd);
          requestAnimationFrame(() => { terminalBody.scrollTop = terminalBody.scrollHeight; });
          setTimeout(() => {
            block.querySelectorAll('.bar-fill').forEach(el => {
              el.style.width = el.dataset.width;
            });
          }, 100);
        }, delay);
      }
    } else {
      // Instant execution for clear, matrix, and unknown commands
      if (hiddenFn) {
        renderCommandResult(block, hiddenFn, null);
      } else if (cmd) {
        const result = cmd.fn();
        if (result === null) return; // /clear
      } else {
        const _T = (typeof window.t === 'function') ? window.t : function(k){return k;};
        const err = document.createElement('div');
        err.className = 'output-line red';
        err.textContent = `  ${_T('error.notfound').replace('{cmd}', input.trim())}`;
        block.appendChild(err);
        const hint = document.createElement('div');
        hint.className = 'output-line dim';
        const breadcrumbKeys = ['error.hint1', 'error.hint2', 'error.hint3', 'error.hint4'];
        const k = breadcrumbKeys[Math.floor(Math.random() * breadcrumbKeys.length)];
        hint.textContent = '  ' + _T(k);
        block.appendChild(hint);
      }
      outputArea.appendChild(block);
      requestAnimationFrame(() => { terminalBody.scrollTop = terminalBody.scrollHeight; });
      setTimeout(() => {
        block.querySelectorAll('.bar-fill').forEach(el => {
          el.style.width = el.dataset.width;
        });
      }, 100);
    }
  }

  // ============ AUTOCOMPLETE ============

  function updateAutocomplete(value) {
    const val = value.toLowerCase().trim();
    acItems = [];
    acIndex = -1;

    if (!val || val.length < 1) {
      autocompleteEl.classList.remove('show');
      return;
    }

    const allCmds = [].concat(...ALL_COMMAND_GROUPS.map(g => Object.entries(g)));

    // Inject secret/secrets into autocomplete after 3 chars
    const secretEntries = [
      ['/secrets', { desc: '...are you sure you want to go there?' }],
      ['/secret', { desc: 'I\'m feeling lucky' }],
    ];
    const withSecrets = allCmds.concat(secretEntries);

    const matches = withSecrets.filter(([cmd]) => cmd.startsWith(val) || cmd.startsWith('/' + val));

    if (matches.length === 0 || (matches.length === 1 && matches[0][0] === val)) {
      autocompleteEl.classList.remove('show');
      return;
    }

    acItems = matches;
    autocompleteEl.innerHTML = '';
    matches.forEach(([cmd, data], i) => {
      const item = document.createElement('div');
      item.className = 'autocomplete-item';
      item.innerHTML = `<span class="ac-cmd">${cmd}</span><span class="ac-desc">${data.desc}</span>`;
      item.addEventListener('mousedown', (e) => {
        e.preventDefault();
        cmdInput.value = cmd;
        autocompleteEl.classList.remove('show');
        cmdInput.focus();
      });
      autocompleteEl.appendChild(item);
    });

    autocompleteEl.classList.add('show');
  }

  // ============ EVENT LISTENERS ============

  cmdInput.addEventListener('input', () => {
    updateAutocomplete(cmdInput.value);
  });

  cmdInput.addEventListener('keydown', (e) => {
    // Autocomplete navigation
    if (autocompleteEl.classList.contains('show')) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        acIndex = Math.min(acIndex + 1, acItems.length - 1);
        highlightAcItem();
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        acIndex = Math.max(acIndex - 1, -1);
        highlightAcItem();
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        if (acIndex >= 0 && acItems[acIndex]) {
          cmdInput.value = acItems[acIndex][0];
        } else if (acItems.length > 0) {
          cmdInput.value = acItems[0][0];
        }
        autocompleteEl.classList.remove('show');
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (acIndex >= 0 && acItems[acIndex]) {
          cmdInput.value = acItems[acIndex][0];
        } else if (acItems.length > 0) {
          cmdInput.value = acItems[0][0];
        }
        autocompleteEl.classList.remove('show');
        return;
      }
      if (e.key === 'Escape') {
        autocompleteEl.classList.remove('show');
        return;
      }
    }

    // Tab autocomplete without dropdown
    if (e.key === 'Tab' && !autocompleteEl.classList.contains('show')) {
      e.preventDefault();
      const val = cmdInput.value.toLowerCase().trim();
      if (val) {
        const allKeys = [].concat(...ALL_COMMAND_GROUPS.map(g => Object.keys(g)));
        const match = allKeys.find(c => c.startsWith(val) || c.startsWith('/' + val));
        if (match) cmdInput.value = match;
      }
      return;
    }

    // Enter = execute
    if (e.key === 'Enter') {
      autocompleteEl.classList.remove('show');
      const value = cmdInput.value;
      cmdInput.value = '';
      executeCommand(value);
      return;
    }

    // History navigation (when autocomplete is closed)
    if (e.key === 'ArrowUp' && !autocompleteEl.classList.contains('show')) {
      e.preventDefault();
      if (historyIndex < commandHistory.length - 1) {
        historyIndex++;
        cmdInput.value = commandHistory[historyIndex];
      }
      return;
    }
    if (e.key === 'ArrowDown' && !autocompleteEl.classList.contains('show')) {
      e.preventDefault();
      if (historyIndex > 0) {
        historyIndex--;
        cmdInput.value = commandHistory[historyIndex];
      } else {
        historyIndex = -1;
        cmdInput.value = '';
      }
      return;
    }
  });

  function highlightAcItem() {
    autocompleteEl.querySelectorAll('.autocomplete-item').forEach((el, i) => {
      el.classList.toggle('active', i === acIndex);
      if (i === acIndex) el.scrollIntoView({ block: 'nearest' });
    });
  }

  // Focus input on click anywhere in terminal body
  terminalBody.addEventListener('click', (e) => {
    if (!window.getSelection().toString()) {
      cmdInput.focus();
    }
  });

  // Also focus on any keypress
  document.addEventListener('keydown', (e) => {
    if (e.target !== cmdInput && !e.ctrlKey && !e.metaKey && !e.altKey && e.key.length === 1) {
      cmdInput.focus();
    }
  });

  // ============ UTILITIES ============

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ============ INIT ============
  runBoot();

})();
