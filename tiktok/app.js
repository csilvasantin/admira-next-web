(function () {
  'use strict';

  const core = window.TikTokCore;
  if (!core) return;

  const $ = (selector) => document.querySelector(selector);
  const form = $('#generatorForm');
  const contentSourceUrl = $('#contentSourceUrl');
  const loadContentSource = $('#loadContentSource');
  const sourceStatus = $('#sourceStatus');
  const sourceSummary = $('#sourceSummary');
  const adIdeaForm = $('#adIdeaForm');
  const adIdeaStatus = $('#adIdeaStatus');
  const adIdeaCount = $('#adIdeaCount');
  const adLibrary = $('#adLibrary');
  const adIdeaList = $('#adIdeaList');
  const adDate = $('#adDate');
  const adIdeaInput = $('#adIdea');
  const developAdButton = $('#developAdIdea');
  const adIdeaAccess = $('#adIdeaAccess');
  const stage = $('#phoneStage');
  const sceneCopy = $('.scene-copy');
  const sceneLabel = $('#sceneLabel');
  const sceneHeadline = $('#sceneHeadline');
  const sceneBody = $('#sceneBody');
  const proofChip = $('#proofChip');
  const progress = $('#videoProgress');
  const timecode = $('#timecode');
  const playPause = $('#playPause');
  const exportVideo = $('#exportVideo');
  const exportStatus = $('#exportStatus');
  const openTester = $('#openTester');
  const storyboard = $('#storyboard');
  const grokBoard = $('#grokBoard');
  const grokBoardStrip = $('#grokBoardStrip');
  const grokBoardCaption = $('#grokBoardCaption');
  const exportStoryboard = $('#exportStoryboard');
  const storyboardNote = $('#storyboardNote');
  const referenceFrames = $('#referenceFrames');
  const referenceStrip = $('#referenceStrip');
  const referenceFramesCaption = $('#referenceFramesCaption');
  const scriptText = $('#scriptText');
  const wordCount = $('#wordCount');
  const paceStatus = $('#paceStatus');
  const voiceButton = $('#toggleSound');
  const previewTitle = $('#previewTitle');
  const modeInputs = Array.from(document.querySelectorAll('input[name="productionMode"]'));
  const motionTransport = $('#motionTransport');
  const grokStudio = $('#grokStudio');
  const grokPrompt = $('#grokPrompt');
  const grokResolution = $('#grokResolution');
  const generateGrokButton = $('#generateGrokVideo');
  const grokJob = $('#grokJob');
  const grokJobLabel = $('#grokJobLabel');
  const grokJobPercent = $('#grokJobPercent');
  const grokJobDetail = $('#grokJobDetail');
  const grokProgress = $('#grokProgress');
  const grokVideo = $('#grokVideo');
  const grokResultActions = $('#grokResultActions');
  const openGrokVideo = $('#openGrokVideo');
  const copyGrokUrl = $('#copyGrokUrl');
  const grokAccess = $('#grokAccess');
  const prepareMeta = $('#prepareMeta');
  const metaVideo = $('#metaVideo');
  const metaStatus = $('#metaStatus');
  const pixeriaBridge = $('#pixeriaBridge');
  const pixeriaLabel = $('#pixeriaLabel');
  const pixeriaDetail = $('#pixeriaDetail');
  const openPixeriaAsset = $('#openPixeriaAsset');
  const retryPixeria = $('#retryPixeria');
  const preRollEnabled = $('#preRollEnabled');
  const preRollTitle = $('#preRollTitle');
  const postRollEnabled = $('#postRollEnabled');
  const postRollCta = $('#postRollCta');
  const referenceVideo = $('#referenceVideo');
  const referenceModeInputs = Array.from(document.querySelectorAll('input[name="referenceMode"]'));
  const referenceLocal = $('#referenceLocal');
  const referenceUrlRow = $('#referenceUrlRow');
  const referenceUrl = $('#referenceUrl');
  const loadReferenceUrl = $('#loadReferenceUrl');
  const referencePreview = $('#referencePreview');
  const referenceSourceLink = $('#referenceSourceLink');
  const analyzeReference = $('#analyzeReference');
  const clearReference = $('#clearReference');
  const referenceStatus = $('#referenceStatus');
  const referenceProfileView = $('#referenceProfile');
  const packageOutput = $('#packageOutput');
  const packageStatus = $('#packageStatus');
  const packageProgress = $('#packageProgress');
  const composeGrokPackage = $('#composeGrokPackage');
  const openPackageAsset = $('#openPackageAsset');
  const openStockCatalogo = $('#openStockCatalogo');
  const packageTags = $('#packageTags');
  const downloadGrokPackage = $('#downloadGrokPackage');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const STORAGE_KEY = 'admiranext:tiktok15:brief:v1';
  const SOURCE_KEY = 'admiranext:tiktok15:source:v1';
  const AD_IDEAS_KEY = 'admiranext:tiktok15:ad-ideas:v1';

  // ── Producto de catálogo (deep-link ?producto=<JSON>) ─────────────────────
  // admira.tv/contentcatalogue abre este estudio con un producto del folleto
  // (Alcampo) ya cargado: nombre, precio REAL, unidad, promo y validez. El
  // contrato del JSON es fijo; si llega roto se ignora y el estudio arranca
  // como siempre. Con producto, el precio se pinta encima de todo el vídeo.
  const UNIDADES_PRODUCTO = {ud:'la unidad', pack:'el pack', desde:'desde', '€/kg':'el kilo', '€/100 g':'los 100 g', '€/litro':'el litro'};
  const MESES_CORTOS = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  const MESES_LARGOS = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;

  function precioTexto(precio) { return precio.toFixed(2).replace('.', ',') + ' €'; }
  function slugCatalogo(value) {
    return String(value == null ? '' : value).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  }
  // Imagen real del producto (FLT-100318): URL pública https, sin espacios. Si
  // no vale, el anuncio sale sin foto: nunca rompe. (Espejo de
  // functions/presentaciones/api/_imagen-producto.mjs, que además acota hosts.)
  function urlImagenProducto(value) {
    const raw = String(value == null ? '' : value).trim();
    if(!/^https:\/\/\S{4,500}$/.test(raw)) return '';
    try{ const url = new URL(raw); return url.protocol === 'https:' && !url.username && !url.password ? url.href : ''; }catch(_){ return ''; }
  }
  // Formato del anuncio (FLT-100372, Carlos 12-sep-2026): «tenemos que poder
  // escoger si queremos los vídeos en landscape o en portrait o las dos
  // versiones». El catálogo manda `formatos` (['9:16'], ['16:9'] o los dos);
  // cada versión es una generación de Grok, un máster y una pieza del Stock con
  // identidad propia (la horizontal lleva el sufijo «:16x9» en el externalId).
  const FORMATOS_ANUNCIO = {'9:16':{w:1080, h:1920, nombre:'vertical 9:16', tag:'vertical'}, '16:9':{w:1920, h:1080, nombre:'horizontal 16:9', tag:'horizontal'}};
  function leerFormatos(value) {
    const lista = (Array.isArray(value) ? value : [value]).map(v => String(v == null ? '' : v).trim()).filter(v => FORMATOS_ANUNCIO[v]);
    return lista.length ? [...new Set(lista)] : ['9:16'];
  }
  // Estética del folleto (FLT-100372): «por defecto hay que coger la estética
  // del catálogo de referencia para que se vea una continuidad de marca; todos
  // los vídeos son muy oscuros cuando el catálogo es blanco». El catálogo mide
  // la portada y manda {fondo, claro, colores[], tinta}; sin dato, un folleto
  // de supermercado se asume claro (fondo blanco).
  const HEX_COLOR = /^#[0-9a-f]{6}$/i;
  function leerEstilo(value) {
    const e = value && typeof value === 'object' ? value : {};
    const fondo = HEX_COLOR.test(String(e.fondo || '')) ? String(e.fondo).toLowerCase() : '#ffffff';
    const tinta = HEX_COLOR.test(String(e.tinta || '')) ? String(e.tinta).toLowerCase() : '#111111';
    const colores = (Array.isArray(e.colores) ? e.colores : []).map(c => String(c || '').toLowerCase()).filter(c => HEX_COLOR.test(c)).slice(0, 4);
    const claro = e.claro == null ? lumaHex(fondo) > 140 : Boolean(e.claro);
    return {fondo, tinta, colores, claro, origen:core.clean(e.origen, 40), acento:colores[0] || '#e3000f'};
  }
  function lumaHex(hex) {
    const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  function fechaPartes(iso) { const [y, m, d] = iso.split('-').map(Number); return {y, m, d}; }
  function validezCorta(v) {
    if(!v) return '';
    const a = fechaPartes(v.desde), b = fechaPartes(v.hasta);
    return a.m === b.m ? `${a.d}–${b.d} ${MESES_CORTOS[b.m - 1]}` : `${a.d} ${MESES_CORTOS[a.m - 1]} – ${b.d} ${MESES_CORTOS[b.m - 1]}`;
  }
  function validezSello(v) {
    if(!v) return '';
    const a = fechaPartes(v.desde), b = fechaPartes(v.hasta);
    return a.m === b.m ? `Del ${a.d} al ${b.d} de ${MESES_LARGOS[b.m - 1]}` : `Del ${a.d} de ${MESES_LARGOS[a.m - 1]} al ${b.d} de ${MESES_LARGOS[b.m - 1]}`;
  }
  function leerProductoCatalogo() {
    try{
      const raw = new URLSearchParams(window.location.search).get('producto');
      if(!raw) return null;
      const p = JSON.parse(raw);
      if(!p || typeof p !== 'object') return null;
      const nombre = core.clean(p.nombre, 120);
      if(!nombre) return null;
      const precio = Number(p.precio);
      const unidad = core.clean(p.unidad, 12);
      const validez = p.validez && FECHA_ISO.test(String(p.validez.desde || '')) && FECHA_ISO.test(String(p.validez.hasta || ''))
        ? {desde:String(p.validez.desde), hasta:String(p.validez.hasta)} : null;
      const catalogo = core.clean(p.catalogo, 80);
      const tienda = core.clean((catalogo.split(/[·–-]/)[0] || ''), 30) || 'Alcampo';
      const producto = {
        p:Number.isInteger(Number(p.p)) ? Number(p.p) : null,
        seccion:core.clean(p.seccion, 40),
        nombre,
        marca:core.clean(p.marca, 60),
        detalle:core.clean(p.detalle, 200),
        precio:Number.isFinite(precio) && precio > 0 ? Math.round(precio * 100) / 100 : null,
        unidad:UNIDADES_PRODUCTO[unidad] ? unidad : '',
        promo:core.clean(p.promo, 160),
        destacado:Boolean(p.destacado),
        catalogo, tienda, validez,
        origen:core.clean(p.origen, 60),
        catalogo_id:slugCatalogo(p.catalogo_id) || `${slugCatalogo(tienda)}-${validez ? validez.desde : 'catalogo'}`,
        imagen:urlImagenProducto(p.imagen),
        formatos:leerFormatos(p.formatos || p.formato),
        estilo:leerEstilo(p.estilo)
      };
      if(!producto.precio && !producto.promo) return null;
      producto.precioTexto = producto.precio == null ? '' : `${precioTexto(producto.precio)}${producto.unidad ? ` ${UNIDADES_PRODUCTO[producto.unidad]}` : ''}`;
      producto.validezCorta = validezCorta(validez);
      producto.validezSello = validezSello(validez);
      producto.slug = slugCatalogo(nombre) || 'producto';
      return producto;
    }catch(_){ return null; }
  }
  // Titular con el que se prefija el campo del director creativo.
  function tituloProducto(p) {
    return core.clean([p.nombre, p.precioTexto || p.promo, `${p.tienda}${p.validezCorta ? ` ${p.validezCorta}` : ''}`].join(' · '), 200);
  }
  // Meta `catalogo` con la que la pieza llega al Stock (Yokup #3183, contrato
  // fijo con el Worker de Pixeria): con ella el Stock agrupa las piezas en la
  // opción «Catálogo» y las asigna a players. El cliente es lo que va antes del
  // primer guion del id («alcampo-2026-09-10» → «alcampo»). Espejo de
  // saneaCatalogo en functions/presentaciones/api/_ficha-video.mjs, que la
  // vuelve a sanear en el servidor sin recalcular nada.
  function catalogoStock(p) {
    if(!p?.catalogo_id) return null;
    return {
      id:p.catalogo_id,
      cliente:slugCatalogo(p.catalogo_id.split('-')[0]),
      nombre:p.catalogo || '',
      desde:p.validez ? p.validez.desde : '',
      hasta:p.validez ? p.validez.hasta : '',
      proyecto:'admira-tv',
      producto:p.slug
    };
  }
  // Las 7 etiquetas de una pieza de catálogo, en el orden del contrato: casa,
  // 'catalogo', cliente, id del catálogo y mes «AAAA-MM» de inicio de validez.
  function etiquetasCatalogo(c) {
    if(!c) return ['admiranext', 'tiktok', 'vertical'];
    return ['admiranext', 'tiktok', 'vertical', 'catalogo', c.cliente, c.id, c.desde ? c.desde.slice(0, 7) : ''].filter(Boolean);
  }
  // URL de la opción «Catálogo» del Stock de Pixeria para un catálogo concreto.
  function urlStockCatalogo(c) {
    return c?.id ? `https://www.pixeria.com/stock.html?catalogo=${encodeURIComponent(c.id)}` : '';
  }
  // Ficha con la que la pieza llega al Stock. La clave externa es ESTABLE por
  // producto y catálogo: el Stock deriva de ella el id del asset, así que el
  // catálogo puede saber que ya existe (y dos clics no hacen dos piezas).
  function fichaProducto(p, formato = formatoActual) {
    const catalogo = catalogoStock(p);
    const f = FORMATOS_ANUNCIO[formato] ? formato : '9:16';
    const horizontal = f === '16:9';
    return {
      title:core.clean(`${p.nombre} · ${p.precio != null ? precioTexto(p.precio) : p.promo} · ${p.tienda}${horizontal ? ' · 16:9' : ''}`, 200),
      comment:core.clean(`${p.catalogo || p.tienda}${p.p ? ` · página ${p.p}` : ''}${p.seccion ? ` · ${p.seccion}` : ''}. ${p.marca ? `${p.marca}. ` : ''}${p.detalle ? `${p.detalle}. ` : ''}${p.precioTexto ? `Precio ${p.precioTexto}. ` : ''}${p.promo ? `${p.promo}. ` : ''}${p.validezSello ? `${p.validezSello}. ` : ''}Formato ${FORMATOS_ANUNCIO[f].nombre}. Generado desde ${p.origen || 'admira.tv/contentcatalogue'}.`, 1200),
      tags:etiquetasCatalogo(catalogo).map(t => t === 'vertical' ? FORMATOS_ANUNCIO[f].tag : t),
      catalogo,
      formato:f,
      // La vertical conserva la identidad de siempre (el catálogo ya la busca así);
      // la horizontal es OTRA pieza: misma receta + «:16x9». El catálogo pregunta
      // por las dos al Stock (admira.tv/contentcatalogue → externalIdProducto).
      externalId:`admiranext:catalogo:${p.catalogo_id}:${p.slug}${horizontal ? ':16x9' : ''}`.replace(/[^A-Za-z0-9:_-]+/g, '-').slice(0, 120),
      // El bruto de Grok NO va al Stock: se retiene como fuente y solo sale el máster.
      brutoAlStock:false
    };
  }
  const productoCatalogo = leerProductoCatalogo();
  // La foto real del folleto, precargada al abrir la ficha con crossOrigin para
  // que el lienzo del máster no quede «manchado» (toDataURL y captureStream
  // fallarían). Si la carga falla se queda en null y el overlay sale sin imagen.
  let imagenProducto = null;
  function imagenLista(img) { return Boolean(img && img.complete && img.naturalWidth > 0); }
  function precargarImagenProducto(p, onLoad) {
    if(!p?.imagen) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.onload = () => { imagenProducto = img; if(typeof onLoad === 'function') onLoad(img); };
    img.onerror = () => { imagenProducto = null; };
    img.src = p.imagen;
  }

  // ── Brief de campaña (deep-link ?brief=<JSON>) ────────────────────────────
  // Generaliza ?producto=: quien encarga (p. ej. admira.tv/videoanalytics/xtore)
  // manda campaña, tipología de público, título, mensaje y la IDENTIDAD con la
  // que la pieza debe llegar al Stock (externalId estable, «admiranext:xtore:coche»).
  // Sin precio: el overlay es un rótulo discreto con el título y un claim abajo.
  // Los dos deep-links conviven; si vienen ambos, manda el producto (tiene precio).
  const TIPOLOGIAS_BRIEF = {
    persona:'Persona a pie', coche:'Conductor en coche', moto:'Motorista', bici:'Ciclista',
    hombre:'Hombre', mujer:'Mujer'
  };
  function leerBrief() {
    try{
      const raw = new URLSearchParams(window.location.search).get('brief');
      if(!raw) return null;
      const b = JSON.parse(raw);
      if(!b || typeof b !== 'object') return null;
      const titulo = core.clean(b.titulo, 120);
      if(!titulo) return null;
      const lane = slugCatalogo(b.lane || b.tipologia);
      const tipologia = core.clean(b.tipologia, 40) || TIPOLOGIAS_BRIEF[lane] || lane;
      const duracion = Number(b.duracion);
      const externalId = String(b.externalId == null ? '' : b.externalId).replace(/[^A-Za-z0-9:_-]+/g, '-').slice(0, 120);
      return {
        campana:core.clean(b.campana, 80) || 'Campaña',
        lane, tipologia,
        titulo,
        mensaje:core.clean(b.mensaje, 240),
        claim:core.clean(b.claim, 60) || 'Xtore · IoT Gallery',
        marca:core.clean(b.marca, 60) || 'Xtore',
        externalId:externalId.length >= 16 ? externalId : (lane ? `admiranext:xtore:${lane}` : ''),
        formato:core.clean(b.formato, 8) || '9:16',
        duracion:Number.isFinite(duracion) && duracion > 0 ? Math.min(60, Math.round(duracion)) : 15,
        origen:core.clean(b.origen, 80),
        overlay:b.overlay !== false
      };
    }catch(_){ return null; }
  }
  function tituloBrief(b) { return core.clean([b.titulo, b.mensaje].filter(Boolean).join(' · '), 200); }
  // Ficha del Stock: el externalId del máster es EXACTAMENTE el del brief (estable,
  // el MCP del player lo busca por prefijo); el bruto lleva :grok:<requestId>.
  function fichaBrief(b) {
    return {
      title:core.clean(`${b.titulo} · ${b.marca} · ${b.tipologia}`, 200),
      comment:core.clean(`${b.campana} · público: ${b.tipologia}${b.lane ? ` (${b.lane})` : ''}. ${b.mensaje ? `${b.mensaje} ` : ''}Claim: ${b.claim}. ${b.formato} · ${b.duracion} s. Generado desde ${b.origen || 'admiranext.com/tiktok'}.`, 1200),
      tags:['admiranext', 'tiktok', b.formato === '16:9' ? 'horizontal' : 'vertical', slugCatalogo(b.marca) || 'xtore'],
      externalId:b.externalId,
      formato:FORMATOS_ANUNCIO[b.formato] ? b.formato : '9:16',
      // El bruto de Grok NO va al Stock: se retiene como fuente y solo sale el máster.
      brutoAlStock:false
    };
  }
  const briefCampana = productoCatalogo ? null : leerBrief();
  // Formato en curso y cola de versiones pendientes (FLT-100372). Con «las dos
  // versiones» se hace primero la vertical y, publicada, la horizontal con la
  // MISMA idea del director creativo (una sola llamada a ad-idea, dos a Grok).
  let formatoActual = productoCatalogo ? productoCatalogo.formatos[0] : (briefCampana && FORMATOS_ANUNCIO[briefCampana.formato] ? briefCampana.formato : '9:16');
  let colaFormatos = [];
  function dimensionesFormato(formato = formatoActual) { return FORMATOS_ANUNCIO[formato] || FORMATOS_ANUNCIO['9:16']; }
  // Arranque automático (FLT-100372, Carlos: «generar vídeos sin necesidad de
  // volver a pulsar en el generador si ya lo hemos decidido en el catálogo»).
  // admira.tv abre este estudio con ?auto=1 y, abierta la sesión, el flujo de
  // un clic arranca solo. Se retira de la URL al instante: un F5 no debe
  // encargar otro vídeo.
  function retirarAutoDeLaUrl() {
    const url = new URL(window.location.href);
    if(!url.searchParams.has('auto')) return false;
    const valor = url.searchParams.get('auto');
    url.searchParams.delete('auto');
    try { window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`); } catch (_) { /* Sin historial no pasa nada. */ }
    return valor !== '0' && valor !== 'false' && valor !== 'no';
  }
  const arranqueAuto = retirarAutoDeLaUrl();
  // Encargo de un clic (catálogo o brief): la ficha con la que la pieza llega al Stock.
  function fichaActiva() {
    if(productoCatalogo) return fichaProducto(productoCatalogo, formatoActual);
    if(briefCampana) return fichaBrief(briefCampana);
    return null;
  }
  // Verdadero mientras dura el flujo de un clic (catálogo o brief): idea → vídeo →
  // publicación → máster con overlay. Al terminar (o fallar) vuelve a falso.
  let flujoCatalogo = false;
  // La idea que el director creativo desarrolló A PARTIR DEL ENCARGO en esta
  // sesión. Con un brief o un producto cargado, Grok NUNCA arranca sin ella:
  // el 11-sep-2026 el tótem de Xtore recibió un anuncio de edición de PDF (el
  // ejemplo del estudio) con la ficha «Aparca. Entra. Estrena. · Xtore · coche».
  let ideaEncargo = null;
  function encargoActivo() { return productoCatalogo || briefCampana || null; }
  // El taller (formulario del guion) se siembra con el encargo desde el primer
  // segundo: así ni el storyboard ni el prompt muestran jamás el ejemplo del PDF.
  function briefDelEncargo() {
    if(productoCatalogo){
      const p = productoCatalogo;
      return {
        task:core.clean(`${p.nombre} a ${p.precioTexto || p.promo} en ${p.tienda}`, 180),
        solution:core.clean(p.detalle || p.promo || `Cógelo en ${p.tienda}`, 220),
        result:core.clean(`${p.nombre} en el carro al precio del folleto`, 180),
        presenter:'fusion', tone:'energetic',
        audience:core.clean(`Clientes de ${p.tienda}`, 110),
        cta:p.validezCorta ? `Solo ${p.validezCorta}` : 'Descúbrelo hoy'
      };
    }
    if(briefCampana){
      const b = briefCampana;
      return {
        task:core.clean(b.titulo, 180),
        solution:core.clean(b.mensaje || `Entra ahora en ${b.marca}`, 220),
        result:core.clean(`Más visitas a ${b.marca}`, 180),
        presenter:'fusion', tone:'energetic',
        audience:core.clean(`${b.tipologia} que pasa por delante de ${b.marca}`, 110),
        cta:core.clean(b.claim, 90) || 'Ven a conocernos hoy'
      };
    }
    return null;
  }
  // ¿La idea desarrollada habla del encargo? Si no, no se genera nada.
  function ideaCoherenteConEncargo(ad) {
    if(!ad || !ad.idea) return false;
    const idea = ad.idea.toLowerCase();
    if(productoCatalogo) return idea.includes(productoCatalogo.nombre.toLowerCase().slice(0, 12)) || (productoCatalogo.precio != null && idea.includes(precioTexto(productoCatalogo.precio)));
    if(briefCampana) return idea.includes(briefCampana.titulo.toLowerCase().slice(0, 18)) || idea.includes(briefCampana.marca.toLowerCase());
    return true;
  }
  const GROK_JOB_KEY = 'admiranext:tiktok15:grok-job:v1';
  const REFERENCE_PROFILE_KEY = 'admiranext:tiktok:reference-profile:v1';
  const TESTER_DB = 'pixeria-media-transfer';
  const TESTER_STORE = 'media';
  const TESTER_KEY = 'latest-tiktok';

  let variation = 0;
  let plan = null;
  let playing = !reduceMotion.matches;
  let startedAt = performance.now();
  let pausedAt = 0;
  let renderedSceneId = '';
  let animationFrame = 0;
  let grokPollTimer = 0;
  let grokPolling = false;
  let grokVideoUrl = '';
  let grokRequestId = '';
  let referenceObjectUrl = '';
  let referenceProfile = null;
  let referenceSource = null;
  let packageBlobUrl = '';
  let packageId = '';
  let adIdeas = [];
  let contentSource = null;

  const example = {
    task: 'Encontrar las acciones importantes dentro de un PDF largo',
    solution: 'Súbelo a NotebookLM y pregunta: ¿cuáles son las tres acciones?',
    result: 'Un documento largo convertido en un plan claro',
    presenter: 'fusion',
    tone: 'energetic',
    audience: 'Personas que quieren ahorrar tiempo',
    cta: 'Guárdalo y pruébalo hoy'
  };

  const objectiveLabels = {
    leads: 'Contactos',
    visits: 'Visitas',
    sales: 'Ventas',
    launch: 'Lanzamiento',
    awareness: 'Marca'
  };

  function readForm() {
    const data = new FormData(form);
    return Object.fromEntries(data.entries());
  }

  function writeForm(data) {
    Object.entries(data || {}).forEach(([key, value]) => {
      const field = form.elements.namedItem(key);
      if (field && typeof value === 'string') field.value = value;
    });
  }

  function saveDraft() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(readForm())); } catch (_) { /* Device-local persistence is optional. */ }
  }

  function loadDraft() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (saved && typeof saved === 'object') writeForm(saved);
    } catch (_) { /* Ignore malformed local data. */ }
  }

  function setSourceMessage(message, state = '') {
    sourceStatus.textContent = message;
    sourceStatus.classList.toggle('is-success', state === 'success');
    sourceStatus.classList.toggle('is-error', state === 'error');
  }

  function renderContentSource() {
    if(!contentSource){
      sourceSummary.hidden = true;
      sourceSummary.textContent = '';
      return;
    }
    const label = contentSource.source?.kind === 'presentation' ? 'Presentación' : 'Web';
    const title = core.clean(contentSource.source?.title, 180) || 'Fuente preparada';
    const summary = core.clean(contentSource.summary, 600);
    sourceSummary.replaceChildren();
    const strong = document.createElement('strong');
    strong.textContent = `${label} · ${title}`;
    sourceSummary.append(strong, document.createTextNode(summary ? ` — ${summary}` : ''));
    sourceSummary.hidden = false;
  }

  function saveContentSource() {
    try{
      if(contentSource) localStorage.setItem(SOURCE_KEY, JSON.stringify(contentSource));
      else localStorage.removeItem(SOURCE_KEY);
    }catch(_){ /* Device-local persistence is optional. */ }
  }

  function clearContentSource(clearInput = true) {
    contentSource = null;
    if(clearInput) contentSourceUrl.value = '';
    saveContentSource();
    renderContentSource();
    setSourceMessage('También puedes completar el brief manualmente.');
  }

  function restoreContentSource() {
    try{
      const saved = JSON.parse(localStorage.getItem(SOURCE_KEY) || 'null');
      if(saved?.source?.url && saved?.brief){
        contentSource = saved;
        contentSourceUrl.value = saved.source.url;
        writeForm(saved.brief);
        renderContentSource();
        setSourceMessage('Fuente recuperada. El brief y el prompt conservan su resumen.', 'success');
      }
    }catch(_){contentSource = null;}
  }

  async function loadBriefFromSource() {
    const url = core.clean(contentSourceUrl.value, 1600);
    if(!url){setSourceMessage('Pega primero la URL de una web o presentación.', 'error'); contentSourceUrl.focus(); return;}
    loadContentSource.disabled = true;
    loadContentSource.textContent = 'Leyendo…';
    setSourceMessage('Leyendo la fuente y seleccionando las ideas principales…');
    try{
      const response = await fetch('/presentaciones/api/source-brief', {
        method:'POST',
        credentials:'same-origin',
        headers:{'content-type':'application/json', accept:'application/json'},
        body:JSON.stringify({url})
      });
      const type = response.headers.get('content-type') || '';
      if(!type.includes('application/json')){
        throw new Error('El lector de URLs no está disponible ahora. Vuelve a intentarlo en unos segundos.');
      }
      const payload = await response.json();
      if(!response.ok){
        const error = new Error(payload?.error || 'No se pudo leer la fuente.');
        throw error;
      }
      if(!payload?.brief || !payload?.source?.url) throw new Error('La fuente no devolvió un resumen utilizable.');
      contentSource = payload;
      contentSourceUrl.value = payload.source.url;
      writeForm(payload.brief);
      saveContentSource();
      renderContentSource();
      variation = 0;
      generate();
      setSourceMessage(`Resumen listo · ${payload.keyPoints?.length || 0} ideas principales convertidas en un vídeo de 15 segundos.`, 'success');
    }catch(error){
      setSourceMessage(String(error?.message || 'No se pudo preparar la fuente.'), 'error');
    }finally{
      loadContentSource.disabled = false;
      loadContentSource.textContent = 'Preparar resumen';
    }
  }

  function todayValue() {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }

  function loadAdIdeas() {
    try {
      const saved = JSON.parse(localStorage.getItem(AD_IDEAS_KEY) || '[]');
      adIdeas = Array.isArray(saved) ? saved.filter((item) => item && typeof item.idea === 'string').slice(0, 24) : [];
    } catch (_) { adIdeas = []; }
  }

  function saveAdIdeas() {
    try { localStorage.setItem(AD_IDEAS_KEY, JSON.stringify(adIdeas)); } catch (_) { /* Device-local persistence is optional. */ }
  }

  function formatAdDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return 'Sin fecha';
    const [year, month, day] = value.split('-');
    return `${day}/${month}/${year}`;
  }

  function openAdIdea(ad, grokMode) {
    clearContentSource();
    writeForm(core.buildBriefFromAd(ad));
    variation = 0;
    generate();
    if (grokMode) {
      const grokInput = modeInputs.find((input) => input.value === 'grok');
      if (grokInput) grokInput.checked = true;
      setProductionMode('grok');
      adIdeaStatus.textContent = 'Dirección preparada. Revisa el prompt y pulsa “Generar con Grok” cuando quieras iniciar el vídeo.';
    } else {
      const motionInput = modeInputs.find((input) => input.value === 'motion');
      if (motionInput) motionInput.checked = true;
      setProductionMode('motion');
      adIdeaStatus.textContent = 'Anuncio abierto en el taller para ajustar el brief y revisar el guion.';
    }
    adIdeaStatus.classList.add('is-success');
    $('#workspace').scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'start' });
  }

  function createAdCard(ad) {
    const article = document.createElement('article');
    article.className = 'ad-card';
    const meta = document.createElement('div');
    meta.className = 'ad-card-meta';
    const brand = document.createElement('span');
    brand.textContent = core.clean(ad.brand, 28) || 'SIN MARCA';
    const date = document.createElement('span');
    date.textContent = formatAdDate(ad.date);
    meta.append(brand, date);
    const title = document.createElement('h3');
    title.textContent = ad.idea;
    const description = document.createElement('p');
    description.textContent = `${objectiveLabels[ad.objective] || 'Anuncio'} · ${core.clean(ad.audience, 80) || 'Público por definir'}`;
    const actions = document.createElement('div');
    actions.className = 'ad-card-actions';
    const open = document.createElement('button');
    open.type = 'button';
    open.textContent = 'Abrir guion';
    open.addEventListener('click', () => openAdIdea(ad, false));
    const grok = document.createElement('button');
    grok.type = 'button';
    grok.textContent = 'Preparar Grok';
    grok.addEventListener('click', () => openAdIdea(ad, true));
    actions.append(open, grok);
    article.append(meta, title, description, actions);
    return article;
  }

  function renderAdIdeas() {
    adIdeaCount.textContent = `${adIdeas.length} ${adIdeas.length === 1 ? 'anuncio' : 'anuncios'}`;
    adLibrary.hidden = adIdeas.length === 0;
    adIdeaList.replaceChildren(...adIdeas.slice(0, 3).map(createAdCard));
  }

  function setAdIdeaMessage(message, state = '') {
    adIdeaStatus.textContent = message;
    adIdeaStatus.classList.toggle('is-success', state === 'success');
    adIdeaStatus.classList.toggle('is-error', state === 'error');
  }

  function syncAdIdeaAgentMode(updateMessage = false) {
    const hasHeadline = core.clean(adIdeaInput.value, 200).length > 0;
    developAdButton.textContent = hasHeadline ? '✨ Desarrollar idea' : '✨ Crear idea';
    developAdButton.title = hasHeadline ? 'Desarrollar el titular con el director creativo' : 'Crear una idea completa desde cero';
    if(updateMessage){
      setAdIdeaMessage(hasHeadline
        ? 'Pulsa “Desarrollar idea” y completaremos el anuncio respetando este titular.'
        : 'Pulsa “Crear idea” para que el director creativo genere el anuncio completo desde cero.');
    }
    return hasHeadline;
  }

  async function developAdIdea() {
    const headline = core.clean(adIdeaInput.value, 200);
    const hasHeadline = headline.length > 0;
    developAdButton.disabled = true;
    developAdButton.textContent = hasHeadline ? 'Desarrollando…' : 'Creando…';
    adIdeaAccess.hidden = true;
    setAdIdeaMessage(hasHeadline
      ? 'El director creativo está convirtiendo el titular en una campaña completa…'
      : 'El director creativo está inventando una campaña completa desde cero…');
    try {
      const response = await fetch('/presentaciones/api/ad-idea', {
        method:'POST',
        credentials:'same-origin',
        headers:{'content-type':'application/json', accept:'application/json'},
        body:JSON.stringify(productoCatalogo ? {headline, producto:productoCatalogo} : briefCampana ? {headline, brief:briefCampana} : {headline})
      });
      const type = response.headers.get('content-type') || '';
      if(!type.includes('application/json')){
        const error = new Error('Inicia sesión en el Generador de Presentaciones para desarrollar ideas.');
        error.auth = response.status === 401 || response.status === 403;
        throw error;
      }
      const payload = await response.json();
      if(!response.ok){
        const error = new Error(payload?.error || 'No se pudo desarrollar la idea.');
        error.auth = response.status === 401 || response.status === 403;
        throw error;
      }
      if(!payload?.ad || typeof payload.ad !== 'object') throw new Error('La idea desarrollada quedó incompleta.');
      Object.entries(payload.ad).forEach(([key, value]) => {
        const field = adIdeaForm.elements.namedItem(key);
        if(field && typeof value === 'string') field.value = value;
      });
      if(!adDate.value) adDate.value = todayValue();
      const createdFromScratch = payload.mode === 'create' || !hasHeadline;
      setAdIdeaMessage(createdFromScratch
        ? 'Idea creada desde cero. Revisa el concepto y pulsa “Storyboard” para obtener el guion y las escenas.'
        : 'Idea desarrollada. Revisa el enfoque y pulsa “Storyboard” para obtener el guion y las escenas.', 'success');
      $('#adDetail').focus();
      return true;
    } catch(error) {
      adIdeaAccess.hidden = !error?.auth;
      setAdIdeaMessage(String(error?.message || 'No se pudo desarrollar la idea.'), 'error');
      return false;
    } finally {
      developAdButton.disabled = false;
      syncAdIdeaAgentMode(false);
    }
  }

  function buildAdFromForm() {
    const raw = Object.fromEntries(new FormData(adIdeaForm).entries());
    if(!core.clean(raw.idea, 200)) return null;
    return {
      id: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `ad-${Date.now()}`,
      createdAt: new Date().toISOString(),
      idea: core.clean(raw.idea, 200),
      detail: core.clean(raw.detail, 1400),
      brand: core.clean(raw.brand, 90),
      objective: raw.objective,
      audience: core.clean(raw.audience, 110),
      date: raw.date
    };
  }

  function createAdIdea(event) {
    event.preventDefault();
    const ad = buildAdFromForm();
    if(!ad){
      setAdIdeaMessage('Primero pulsa “Crear idea”, o escribe un titular y pulsa “Desarrollar idea”.', 'error');
      developAdButton.focus();
      return;
    }
    adIdeas = [ad, ...adIdeas].slice(0, 24);
    saveAdIdeas();
    renderAdIdeas();
    openAdIdea(ad, false);
    adIdeaStatus.textContent = 'Anuncio creado: ya tienes brief, guion y storyboard. Puedes ajustarlos o preparar el vídeo con Grok.';
  }

  // ── Ficha «Producto del catálogo» y flujo de un clic ──────────────────────
  function renderFichaProducto() {
    if(!productoCatalogo) return;
    const p = productoCatalogo;
    const aside = document.createElement('aside');
    aside.className = 'catalog-product panel';
    aside.id = 'catalogProduct';
    aside.setAttribute('aria-labelledby', 'catalogProductTitle');
    const meta = [p.p ? `p. ${p.p}` : '', p.seccion, p.destacado ? '★ destacado' : ''].filter(Boolean).join(' · ');
    const filas = [
      p.marca ? ['Marca', p.marca] : null,
      p.detalle ? ['Detalle', p.detalle] : null,
      p.promo ? ['Promo', p.promo] : null,
      p.validezSello ? ['Validez', p.validezSello] : null,
      p.catalogo ? ['Catálogo', p.catalogo] : null
    ].filter(Boolean);
    const dl = filas.map(([k, v]) => `<div><dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd></div>`).join('');
    aside.innerHTML = `
      <div class="catalog-product-head">
        ${p.imagen ? `<figure class="catalog-product-figure"><img src="${escapeHtml(p.imagen)}" alt="Foto del producto: ${escapeHtml(p.nombre)}" width="120" height="120" crossorigin="anonymous" decoding="async"></figure>` : ''}
        <div>
          <span class="section-code">PRODUCTO DEL CATÁLOGO${meta ? ` · ${escapeHtml(meta.toUpperCase())}` : ''}</span>
          <h3 id="catalogProductTitle">${escapeHtml(p.nombre)}</h3>
        </div>
        <div class="catalog-price-tag" aria-label="Precio ${escapeHtml(p.precioTexto || p.promo)}">
          ${p.precio != null ? `<b>${escapeHtml(precioTexto(p.precio))}</b><small>${escapeHtml(UNIDADES_PRODUCTO[p.unidad] || '')}</small>` : `<b class="is-promo">${escapeHtml(p.promo)}</b>`}
        </div>
      </div>
      <dl class="catalog-product-data">${dl}</dl>
      <div class="catalog-product-actions${arranqueAuto ? ' is-auto' : ''}">
        <button class="button primary" id="generarAnuncioCatalogo" type="button">Generar anuncio</button>
        <fieldset class="formato-anuncio" id="formatoAnuncio" aria-label="Formato del anuncio">
          <legend>Formato</legend>
          <label><input type="radio" name="formatoAnuncio" value="9:16"><i class="formato-icono v"></i> Vertical 9:16</label>
          <label><input type="radio" name="formatoAnuncio" value="16:9"><i class="formato-icono h"></i> Horizontal 16:9</label>
          <label><input type="radio" name="formatoAnuncio" value="ambos"><i class="formato-icono v"></i><i class="formato-icono h"></i> Las dos</label>
        </fieldset>
        <span class="estilo-folleto" title="Estética del folleto: fondo ${escapeHtml(p.estilo.fondo)}${p.estilo.colores.length ? ` · colores ${escapeHtml(p.estilo.colores.join(' '))}` : ''}"><i style="background:${escapeHtml(p.estilo.fondo)}"></i>${p.estilo.colores.slice(0, 3).map(c => `<i style="background:${escapeHtml(c)}"></i>`).join('')} estética del folleto${p.estilo.claro ? ' · clara' : ' · oscura'}</span>
        <p class="composer-status" id="catalogProductStatus" role="status">${arranqueAuto ? 'Arranque automático desde el catálogo: ' : 'Un clic: '}idea → vídeo de 15 s con Grok (${escapeHtml(p.formatos.map(f => FORMATOS_ANUNCIO[f].nombre).join(' + '))}) → publicación en el Stock con el precio${p.imagen ? ' y la foto real del producto' : ''} en pantalla.</p>
      </div>`;
    adIdeaForm.parentNode.insertBefore(aside, adIdeaForm);
    $('#generarAnuncioCatalogo').addEventListener('click', () => { void generarAnuncioCatalogo(); });
    // Selector de formato: refleja lo que decidió el catálogo y se puede cambiar
    // antes de generar (durante el flujo queda bloqueado).
    const valorFormato = p.formatos.length > 1 ? 'ambos' : p.formatos[0];
    aside.querySelectorAll('input[name="formatoAnuncio"]').forEach(input => {
      input.checked = input.value === valorFormato;
      input.addEventListener('change', () => {
        if(flujoCatalogo){ input.checked = false; aside.querySelector(`input[name="formatoAnuncio"][value="${p.formatos.length > 1 ? 'ambos' : p.formatos[0]}"]`).checked = true; return; }
        p.formatos = input.value === 'ambos' ? ['9:16', '16:9'] : [input.value];
        formatoActual = p.formatos[0];
        setCatalogStatus(`Formato: ${p.formatos.map(f => FORMATOS_ANUNCIO[f].nombre).join(' + ')}. Pulsa «Generar anuncio».`);
      });
    });
    // La foto llega después que el storyboard: al cargar, se repintan los
    // fotogramas para que enseñen la tarjeta con el producto real.
    precargarImagenProducto(p, () => { if(plan) storyboard.replaceChildren(...plan.scenes.map((scene, i) => createStoryCard(scene, i, plan))); });
    sembrarTallerConEncargo();
    adIdeaInput.value = tituloProducto(p);
    $('#adBrand').value = p.marca || p.tienda;
    $('#adObjective').value = 'sales';
    syncAdIdeaAgentMode(true);
    setAdIdeaMessage(`Titular prefijado desde el catálogo: «${adIdeaInput.value}». Pulsa “Generar anuncio” o “Desarrollar idea”.`, 'success');
  }

  // ── Ficha «Brief de campaña» (deep-link ?brief=) ──────────────────────────
  function renderFichaBrief() {
    if(!briefCampana) return;
    const b = briefCampana;
    const aside = document.createElement('aside');
    aside.className = 'catalog-product brief-campaign panel';
    aside.id = 'catalogProduct';
    aside.setAttribute('aria-labelledby', 'catalogProductTitle');
    const filas = [
      ['Campaña', b.campana],
      ['Tipología', `${b.tipologia}${b.lane && b.lane !== slugCatalogo(b.tipologia) ? ` · ${b.lane}` : ''}`],
      b.mensaje ? ['Mensaje', b.mensaje] : null,
      ['Claim', b.claim],
      ['Formato', `${b.formato} · ${b.duracion} s`],
      b.externalId ? ['Identidad en el Stock', b.externalId] : null,
      b.origen ? ['Origen', b.origen] : null
    ].filter(Boolean);
    const dl = filas.map(([k, v]) => `<div><dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd></div>`).join('');
    aside.innerHTML = `
      <div class="catalog-product-head">
        <div>
          <span class="section-code">BRIEF DE CAMPAÑA · ${escapeHtml(b.campana.toUpperCase())}</span>
          <h3 id="catalogProductTitle">${escapeHtml(b.titulo)}</h3>
        </div>
        <div class="brief-lane-tag" aria-label="Tipología ${escapeHtml(b.tipologia)}"><small>público</small><b>${escapeHtml(b.tipologia)}</b></div>
      </div>
      <dl class="catalog-product-data">${dl}</dl>
      <div class="catalog-product-actions">
        <button class="button primary" id="generarAnuncioCatalogo" type="button">Generar anuncio</button>
        <p class="composer-status" id="catalogProductStatus" role="status">Un clic: idea → vídeo de ${escapeHtml(String(b.duracion))} s con Grok → publicación en el Stock como «${escapeHtml(b.externalId || 'sin identidad')}».</p>
      </div>`;
    adIdeaForm.parentNode.insertBefore(aside, adIdeaForm);
    $('#generarAnuncioCatalogo').addEventListener('click', () => { void generarAnuncioCatalogo(); });
    sembrarTallerConEncargo();
    adIdeaInput.value = tituloBrief(b);
    $('#adBrand').value = b.marca;
    $('#adObjective').value = 'visits';
    syncAdIdeaAgentMode(true);
    setAdIdeaMessage(`Titular prefijado desde el brief: «${adIdeaInput.value}». Pulsa “Generar anuncio” o “Desarrollar idea”.`, 'success');
  }

  function sembrarTallerConEncargo() {
    const brief = briefDelEncargo();
    if(!brief) return;
    clearContentSource();
    writeForm(brief);
    variation = 0;
    generate();
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function setCatalogStatus(message, state = '') {
    const status = $('#catalogProductStatus');
    if(!status) return;
    status.textContent = message;
    status.classList.toggle('is-success', state === 'success');
    status.classList.toggle('is-error', state === 'error');
  }

  // El mismo camino que ya existe, encadenado: director creativo → brief y
  // storyboard → Grok → (al publicarse) máster de 15 s con el precio encima.
  // Prompt de Grok para el formato en curso, SIEMPRE desde la idea desarrollada
  // del encargo (nunca de lo que haya en pantalla) y con la estética del folleto.
  function prepararPromptEncargo(ad, formato) {
    const brief = core.buildBriefFromAd(ad);
    const planEncargo = core.buildPlan(productoCatalogo ? {...brief, formato, estilo:productoCatalogo.estilo} : {...brief, formato}, 0);
    grokPrompt.value = core.clean(`${planEncargo.grokPrompt}${referenceProfile?.promptFragment ? `\n\n${referenceProfile.promptFragment}` : ''}`, 3200);
    return grokPrompt.value.includes(core.clean(ad.idea, 180).slice(0, 40));
  }
  function textoVersiones() {
    const hechas = (productoCatalogo ? productoCatalogo.formatos : [formatoActual]).length;
    return hechas > 1 ? ` (versión ${dimensionesFormato().nombre}${colaFormatos.length ? `, luego ${colaFormatos.map(f => dimensionesFormato(f).nombre).join(' y ')}` : ''})` : ` (${dimensionesFormato().nombre})`;
  }
  async function generarAnuncioCatalogo() {
    if(!(productoCatalogo || briefCampana) || flujoCatalogo) return;
    const button = $('#generarAnuncioCatalogo');
    flujoCatalogo = true;
    button.disabled = true;
    colaFormatos = productoCatalogo ? [...productoCatalogo.formatos] : [FORMATOS_ANUNCIO[briefCampana.formato] ? briefCampana.formato : '9:16'];
    formatoActual = colaFormatos.shift();
    try{
      if(!core.clean(adIdeaInput.value, 200)) adIdeaInput.value = productoCatalogo ? tituloProducto(productoCatalogo) : tituloBrief(briefCampana);
      setCatalogStatus(productoCatalogo ? `1/3 · El director creativo escribe el guion con el precio literal y la estética del folleto${textoVersiones()}…` : `1/3 · El director creativo escribe el guion para «${briefCampana.tipologia}»…`);
      const ok = await developAdIdea();
      if(!ok) throw new Error(`El director creativo no devolvió la idea (${adIdeaStatus.textContent || 'sin detalle'}). No se genera nada: el vídeo debe salir de la idea desarrollada, nunca del ejemplo del estudio.`);
      const ad = buildAdFromForm();
      if(!ad) throw new Error('La idea desarrollada llegó sin titular. No se genera nada.');
      if(!ideaCoherenteConEncargo(ad)) throw new Error(`La idea desarrollada («${ad.idea}») no habla del encargo. No se genera nada: vuelve a pulsar «Generar anuncio».`);
      ideaEncargo = ad;
      adIdeas = [ad, ...adIdeas].slice(0, 24);
      saveAdIdeas();
      renderAdIdeas();
      openAdIdea(ad, true);
      // El prompt de Grok se construye AQUÍ desde la idea desarrollada, no se
      // confía en lo que haya quedado en pantalla.
      if(!prepararPromptEncargo(ad, formatoActual)) throw new Error('El prompt de Grok no salió de la idea desarrollada. No se genera nada.');
      setCatalogStatus(`2/3 · Grok genera el vídeo de 15 s${textoVersiones()}…`);
      const enviado = await startGrokVideo();
      if(!enviado) throw new Error(grokJobDetail.textContent || 'Grok no aceptó el encargo.');
      setCatalogStatus(`2/3 · Grok está generando${textoVersiones()}. Al terminar se publica y se monta el máster con el precio en pantalla.`, 'success');
    }catch(error){
      flujoCatalogo = false;
      colaFormatos = [];
      button.disabled = false;
      setCatalogStatus(String(error?.message || 'No se pudo generar el anuncio.'), 'error');
    }
  }
  // Siguiente versión de la cola («las dos»): misma idea, otro formato. Se llama
  // al publicar con éxito la anterior; si falla, la cola se vacía y se avisa.
  async function siguienteVersion() {
    if(!colaFormatos.length || !ideaEncargo) return false;
    formatoActual = colaFormatos.shift();
    flujoCatalogo = true;
    const button = $('#generarAnuncioCatalogo');
    if(button) button.disabled = true;
    try{
      if(!prepararPromptEncargo(ideaEncargo, formatoActual)) throw new Error('El prompt de la siguiente versión no salió de la idea desarrollada.');
      setCatalogStatus(`Versión ${dimensionesFormato().nombre}: Grok genera el vídeo de 15 s con la misma idea…`);
      const enviado = await startGrokVideo();
      if(!enviado) throw new Error(grokJobDetail.textContent || 'Grok no aceptó la siguiente versión.');
      setCatalogStatus(`Versión ${dimensionesFormato().nombre}: Grok está generando. Al terminar se publica como pieza propia en el Stock.`, 'success');
      return true;
    }catch(error){
      flujoCatalogo = false;
      colaFormatos = [];
      if(button) button.disabled = false;
      setCatalogStatus(`La versión ${dimensionesFormato().nombre} no arrancó: ${String(error?.message || 'sin detalle')}. La anterior ya está publicada; cambia el formato y vuelve a pulsar «Generar anuncio» para esta.`, 'error');
      return false;
    }
  }

  // ── Pase firmado desde admira.tv (Yokup #3165) ─────────────────────────────
  // admira.tv abre este estudio con ?producto=…&pase=<payload.firma>. Carlos ya
  // estaba logado allí, pero el Generador sólo conocía su propia sesión y ad-idea
  // / grok-video contestaban 401. El pase se canjea UNA vez en
  // /presentaciones/api/sso, que emite las mismas cookies que el login del
  // Generador. Se borra de la URL al instante (un F5 no debe reintentar un
  // nonce ya quemado) y `producto`/`brief` se quedan donde estaban.
  function retirarPaseDeLaUrl() {
    const url = new URL(window.location.href);
    const pase = url.searchParams.get('pase');
    if(!pase) return '';
    url.searchParams.delete('pase');
    try { window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`); } catch (_) { /* Sin historial no pasa nada. */ }
    return pase;
  }
  function avisoSesion(message, state = '', conEnlaceLogin = false) {
    const status = $('#catalogProductStatus') || adIdeaStatus;
    if(!status) return;
    status.replaceChildren(document.createTextNode(message));
    if(conEnlaceLogin){
      const link = document.createElement('a');
      link.className = 'composer-access';
      link.href = '/presentaciones/';
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = 'Iniciar sesión en el Generador ↗';
      status.append(' ', link);
    }
    status.classList.toggle('is-success', state === 'success');
    status.classList.toggle('is-error', state === 'error');
  }
  async function abrirSesionConPase() {
    const pase = retirarPaseDeLaUrl();
    if(!pase) return 'sin-pase';
    const encargo = encargoActivo();
    avisoSesion('Abriendo sesión desde admira.tv…');
    try{
      const response = await fetch('/presentaciones/api/sso', {
        method:'POST',
        credentials:'same-origin',
        headers:{'content-type':'application/json', accept:'application/json'},
        body:JSON.stringify({pase})
      });
      let payload = null;
      try { payload = await response.json(); } catch (_) { payload = null; }
      if(!response.ok || !payload?.ok){
        const motivo = payload?.error || (response.status === 401 ? 'El pase no es válido o ha caducado.' : `El Generador respondió ${response.status}.`);
        throw new Error(motivo);
      }
      adIdeaAccess.hidden = true;
      grokAccess.hidden = true;
      const quien = payload.email_masked ? ` · ${payload.email_masked}` : '';
      avisoSesion(encargo
        ? (arranqueAuto ? `Sesión abierta desde admira.tv${quien}. Arrancando solo: idea → vídeo de 15 s con Grok → publicación en el Stock.` : `Sesión abierta desde admira.tv${quien}. Pulsa «Generar anuncio»: idea → vídeo de 15 s con Grok → publicación en el Stock.`)
        : `Sesión abierta desde admira.tv${quien}. Ya puedes desarrollar ideas y usar Grok.`, 'success');
      return true;
    }catch(error){
      avisoSesion(`No se pudo abrir la sesión desde admira.tv: ${String(error?.message || 'sin detalle')} ${encargo ? 'El encargo sigue cargado; inicia sesión y vuelve a pulsar «Generar anuncio».' : ''}`.trim(), 'error', true);
      adIdeaAccess.hidden = false;
      return false;
    }
  }

  function terminarFlujoCatalogo(message, state) {
    flujoCatalogo = false;
    // Publicada una versión y quedan formatos en cola: se encadena la siguiente
    // sin tocar nada (el aviso de la publicada se enseña un instante).
    if(state === 'success' && colaFormatos.length){
      setCatalogStatus(`${message} Ahora la versión ${dimensionesFormato(colaFormatos[0]).nombre}…`, 'success');
      window.setTimeout(() => { void siguienteVersion(); }, 1200);
      return;
    }
    colaFormatos = [];
    const button = $('#generarAnuncioCatalogo');
    if(button) button.disabled = false;
    setCatalogStatus(message, state);
  }

  function formatTime(seconds) {
    const safe = Math.max(0, Math.min(15, seconds));
    return `00:${safe.toFixed(1).padStart(4, '0')}`;
  }

  function setScene(scene, immediate) {
    if (!scene || scene.id === renderedSceneId) return;
    const update = () => {
      sceneLabel.textContent = scene.label;
      sceneHeadline.textContent = scene.headline;
      sceneBody.textContent = scene.body;
      proofChip.textContent = scene.id === 'result' ? plan.presenter.name.toUpperCase() + ' · LISTO' : plan.presenter.name.toUpperCase() + ' · 15S';
      renderedSceneId = scene.id;
      sceneCopy.classList.remove('changing');
    };
    if (immediate || reduceMotion.matches) return update();
    sceneCopy.classList.add('changing');
    window.setTimeout(update, 160);
  }

  function tick(now) {
    if (plan && playing) {
      const elapsed = ((now - startedAt) / 1000) % plan.duration;
      pausedAt = elapsed;
      progress.style.width = `${(elapsed / plan.duration) * 100}%`;
      timecode.textContent = formatTime(elapsed);
      setScene(core.sceneAt(plan, elapsed));
    }
    animationFrame = requestAnimationFrame(tick);
  }

  function restart() {
    renderedSceneId = '';
    pausedAt = 0;
    startedAt = performance.now();
    playing = !reduceMotion.matches;
    playPause.textContent = playing ? 'Pausar' : 'Reproducir';
    progress.style.width = '0%';
    timecode.textContent = '00:00.0';
    if (plan) setScene(plan.scenes[0], true);
  }

  /* ── Storyboard CON IMAGEN (Carlos, 4-ago-2026) ────────────────────────────
     Eran tres tarjetas de texto. Ahora cada una lleva el fotograma REAL de su
     escena: no es una ilustracion aproximada de "como quedaria", es el mismo
     pintor —drawFrame— que exporta el video, congelado a mitad de escena. Lo
     que ves en el storyboard es literalmente lo que se va a exportar.
     Se pinta a mitad de escena (0.5) porque al principio la entrada aun esta
     animandose y el rotulo no ha terminado de aparecer.
     Gratis, sin terceros y sin esperar: se dibuja en el mismo navegador. */
  function storyFrame(planData, scene) {
    try{
      const canvas = document.createElement('canvas');
      canvas.width = 216; canvas.height = 384;          // 9:16, el mismo encuadre
      const ctx = canvas.getContext('2d', {alpha:false});
      drawFrame(ctx, planData, scene.from + (scene.to - scene.from) * 0.5);
      const img = document.createElement('img');
      img.className = 'story-shot';
      img.src = canvas.toDataURL('image/jpeg', 0.82);
      img.alt = 'Fotograma de la escena: ' + scene.headline;
      img.loading = 'lazy';
      return img;
    }catch(_){
      return null;   // si el pintor falla, la tarjeta sigue siendo util en texto
    }
  }

  /* ── Imagen de escena con Meta AI (Carlos, 4-ago-2026 · FLT-1189) ──────────
     El fotograma real sigue siendo el que manda: es lo que se va a exportar.
     Pero para presentar una idea antes de producirla a veces quieres una
     imagen mas evocadora, y Meta AI la hace gratis. Como no hay API de imagen,
     va asistido igual que el video: el estudio escribe el prompt del PLANO
     —no del anuncio entero— y la imagen vuelve por un selector.

     El prompt se construye con lo que ya sabe la escena: su titular, lo que
     cuenta y la direccion de plano, mas el formato que el storyboard necesita.
     Nada inventado: si el guion no lo dice, no se escribe.

     Y se marca. Una imagen generada NO es lo que se va a exportar, asi que
     lleva distintivo y se puede volver al fotograma real de un clic — si no,
     el storyboard dejaria de decir la verdad, que era su gracia. */
  function promptDeEscena(planData, scene, index) {
    const partes = [
      `Fotograma ${index + 1} de un anuncio vertical.`,
      scene.headline ? `Idea del plano: ${scene.headline}` : '',
      scene.body ? `Cuenta: ${scene.body}` : '',
      scene.direction ? `Direccion: ${scene.direction}` : '',
      planData?.brief?.task ? `Contexto: ${planData.brief.task}` : '',
      'Formato: imagen vertical 9:16, fotograma fijo, sin texto sobreimpreso.'
    ];
    return partes.filter(Boolean).join('\n');
  }

  function accionesDeEscena(planData, scene, index, article, shot) {
    const fila = document.createElement('div');
    fila.className = 'story-actions';

    const aviso = document.createElement('p');
    aviso.className = 'story-note';
    aviso.setAttribute('role', 'status');
    aviso.setAttribute('aria-live', 'polite');

    const pedir = document.createElement('button');
    pedir.type = 'button';
    pedir.className = 'story-act';
    pedir.textContent = 'Prompt → Meta AI';
    pedir.setAttribute('aria-label', `Copiar el prompt de imagen de la escena ${index + 1} y abrir Meta AI`);
    pedir.addEventListener('click', async () => {
      const texto = promptDeEscena(planData, scene, index);
      let copiado = false;
      try{ await navigator.clipboard.writeText(texto); copiado = true; }catch(_){ copiado = false; }
      aviso.textContent = copiado
        ? 'Prompt del plano copiado. Generalo en Meta AI y traelo con «Traer imagen».'
        : 'No he podido copiar solo. Abre Meta AI y describe el plano a mano.';
      window.open(META_URL, '_blank', 'noopener');
    });

    const etiqueta = document.createElement('label');
    etiqueta.className = 'story-act story-file';
    const rotulo = document.createElement('span');
    rotulo.textContent = 'Traer imagen';
    const entrada = document.createElement('input');
    entrada.type = 'file';
    entrada.accept = 'image/png,image/jpeg,image/webp';
    entrada.setAttribute('aria-label', `Traer la imagen de Meta AI para la escena ${index + 1}`);
    etiqueta.append(rotulo, entrada);

    const volver = document.createElement('button');
    volver.type = 'button';
    volver.className = 'story-act story-revert';
    volver.textContent = 'Volver al fotograma';
    volver.hidden = true;
    volver.setAttribute('aria-label', `Devolver la escena ${index + 1} al fotograma real del anuncio`);

    const origen = shot ? shot.src : '';
    let generada = '';

    function marcar(esGenerada) {
      article.classList.toggle('story-ia', esGenerada);
      volver.hidden = !esGenerada;
    }

    entrada.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if(!file) return;
      if(!/^image\//.test(file.type || '')){
        aviso.textContent = 'Ese fichero no es una imagen.';
        return;
      }
      if(!shot){
        aviso.textContent = 'Esta escena no tiene hueco de imagen.';
        return;
      }
      if(generada) URL.revokeObjectURL(generada);
      generada = URL.createObjectURL(file);
      shot.src = generada;
      shot.alt = `Imagen generada con Meta AI para la escena ${index + 1}: ${scene.headline}`;
      marcar(true);
      aviso.textContent = 'Imagen de Meta AI puesta. Ojo: es una idea, no el fotograma que se exportara.';
      entrada.value = '';
    });

    volver.addEventListener('click', () => {
      if(!shot) return;
      if(generada){ URL.revokeObjectURL(generada); generada = ''; }
      shot.src = origen;
      shot.alt = 'Fotograma de la escena: ' + scene.headline;
      marcar(false);
      aviso.textContent = 'De vuelta al fotograma real del anuncio.';
    });

    fila.append(pedir, etiqueta, volver);
    return { fila, aviso };
  }

  /* ── Hoja de storyboard para APROBAR con el cliente (decision 0323) ────────
     El paso caro es producir el video. Esta hoja existe para que el cliente
     diga que si ANTES: las escenas con su imagen, su tramo de tiempo y lo que
     cuenta cada una, mas el guion completo, en un solo PNG que se manda por
     donde sea.

     Se exporta lo que HAY EN PANTALLA, no una version paralela: si has
     sustituido una escena por una imagen de Meta AI, va esa —y con su marca de
     idea, para que el cliente sepa que ese plano aun no es el definitivo.

     Se dibuja a canvas y se descarga: sin librerias, sin servidor y sin que
     salga nada del navegador. */
  const HOJA = {w:1240, h:1754, margen:64};

  function textoEnCaja(ctx, texto, x, y, ancho, alto, salto) {
    const palabras = String(texto || '').split(/\s+/).filter(Boolean);
    let linea = '', cy = y;
    for(const palabra of palabras){
      const prueba = linea ? linea + ' ' + palabra : palabra;
      if(ctx.measureText(prueba).width > ancho && linea){
        ctx.fillText(linea, x, cy); cy += salto; linea = palabra;
        if(cy > y + alto) return cy;
      }else{ linea = prueba; }
    }
    if(linea) { ctx.fillText(linea, x, cy); cy += salto; }
    return cy;
  }

  async function exportarStoryboard() {
    if(!plan) return;
    exportStoryboard.disabled = true;
    storyboardNote.textContent = 'Componiendo la hoja…';
    try{
      const canvas = document.createElement('canvas');
      canvas.width = HOJA.w; canvas.height = HOJA.h;
      const ctx = canvas.getContext('2d', {alpha:false});
      const m = HOJA.margen;

      ctx.fillStyle = '#080d14'; ctx.fillRect(0, 0, HOJA.w, HOJA.h);

      // Cabecera
      ctx.fillStyle = '#7aa7ff';
      ctx.font = '600 20px ui-monospace, monospace';
      ctx.fillText('STORYBOARD · ADMIRANEXT', m, m + 22);
      ctx.fillStyle = '#eef3fb';
      ctx.font = '700 40px -apple-system, Segoe UI, Roboto, sans-serif';
      textoEnCaja(ctx, plan.brief?.task || 'Anuncio', m, m + 78, HOJA.w - m * 2, 96, 46);
      ctx.fillStyle = '#8fa2bd';
      ctx.font = '400 19px -apple-system, Segoe UI, Roboto, sans-serif';
      ctx.fillText(`${plan.scenes.length} escenas · ${plan.duration}s · vertical 9:16`, m, m + 176);
      ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(m, m + 200); ctx.lineTo(HOJA.w - m, m + 200); ctx.stroke();

      // Escenas: se toma la imagen tal y como se ve en la tarjeta
      const tarjetas = Array.from(storyboard.querySelectorAll('.story-card'));
      const hueco = 26;
      const ancho = Math.floor((HOJA.w - m * 2 - hueco * (plan.scenes.length - 1)) / plan.scenes.length);
      const alto = Math.round(ancho * 16 / 9);
      const top = m + 236;

      for(let i = 0; i < plan.scenes.length; i++){
        const escena = plan.scenes[i];
        const x = m + i * (ancho + hueco);
        const img = tarjetas[i]?.querySelector('.story-shot');
        ctx.fillStyle = '#05090d';
        ctx.fillRect(x, top, ancho, alto);
        if(img && img.complete && img.naturalWidth){
          try{ ctx.drawImage(img, x, top, ancho, alto); }catch(_){ /* imagen no dibujable */ }
        }
        if(tarjetas[i]?.classList.contains('story-ia')){
          ctx.fillStyle = 'rgba(6,12,22,.85)';
          ctx.fillRect(x + 8, top + 8, 150, 26);
          ctx.fillStyle = '#9dbcff';
          ctx.font = '700 13px ui-monospace, monospace';
          ctx.fillText('IDEA · META AI', x + 16, top + 26);
        }
        let cy = top + alto + 34;
        ctx.fillStyle = '#7aa7ff';
        ctx.font = '700 15px ui-monospace, monospace';
        ctx.fillText(`0${i + 1} · ${escena.from}–${escena.to}s`, x, cy);
        cy += 30;
        ctx.fillStyle = '#eef3fb';
        ctx.font = '700 22px -apple-system, Segoe UI, Roboto, sans-serif';
        cy = textoEnCaja(ctx, escena.headline, x, cy, ancho, 90, 28) + 8;
        ctx.fillStyle = '#9fb1c9';
        ctx.font = '400 17px -apple-system, Segoe UI, Roboto, sans-serif';
        cy = textoEnCaja(ctx, escena.body, x, cy, ancho, 110, 24) + 8;
        ctx.fillStyle = '#6f8299';
        ctx.font = '400 15px ui-monospace, monospace';
        textoEnCaja(ctx, escena.direction, x, cy, ancho, 90, 21);
      }

      // Guion completo al pie
      const pie = top + alto + 330;
      ctx.strokeStyle = 'rgba(255,255,255,.12)';
      ctx.beginPath(); ctx.moveTo(m, pie); ctx.lineTo(HOJA.w - m, pie); ctx.stroke();
      ctx.fillStyle = '#7aa7ff';
      ctx.font = '600 15px ui-monospace, monospace';
      ctx.fillText('LOCUCIÓN', m, pie + 32);
      ctx.fillStyle = '#c8d5e6';
      ctx.font = '400 20px -apple-system, Segoe UI, Roboto, sans-serif';
      textoEnCaja(ctx, plan.script, m, pie + 68, HOJA.w - m * 2, HOJA.h - pie - 140, 30);

      ctx.fillStyle = '#5d6f88';
      ctx.font = '400 14px ui-monospace, monospace';
      ctx.fillText('admiranext.com · propuesta para aprobación, aún no producida', m, HOJA.h - m + 14);

      const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
      if(!blob) throw new Error('no-blob');
      downloadBlob(blob, `${core.fileSlug(plan.brief.task)}-storyboard.png`);
      storyboardNote.textContent = 'Hoja descargada. Ya puedes enseñarla antes de producir.';
    }catch(_){
      storyboardNote.textContent = 'No se pudo componer la hoja. Vuelve a intentarlo.';
    }finally{
      exportStoryboard.disabled = false;
    }
  }

  function createStoryCard(scene, index, planData) {
    const article = document.createElement('article');
    article.className = 'story-card';
    const shot = planData ? storyFrame(planData, scene) : null;
    if(shot) article.appendChild(shot);
    const header = document.createElement('header');
    const number = document.createElement('span');
    number.textContent = `0${index + 1}`;
    const duration = document.createElement('span');
    duration.textContent = `${scene.from}–${scene.to}s`;
    header.append(number, duration);
    const title = document.createElement('h3');
    title.textContent = scene.headline;
    const body = document.createElement('p');
    body.textContent = scene.body;
    const footer = document.createElement('footer');
    footer.textContent = scene.direction;
    article.append(header, title, body, footer);
    if(shot){
      const {fila, aviso} = accionesDeEscena(planData, scene, index, article, shot);
      article.append(fila, aviso);
    }
    return article;
  }

  function syncGrokPrompt() {
    if(!plan) return;
    const style = referenceProfile?.promptFragment ? `\n\n${referenceProfile.promptFragment}` : '';
    grokPrompt.value = core.clean(`${plan.grokPrompt}${style}`, 3200);
  }

  function renderReferenceProfile() {
    if(!referenceProfile){
      referenceProfileView.hidden = true;
      referenceProfileView.textContent = '';
      return;
    }
    referenceProfileView.textContent = `Dirección aplicada · ${referenceProfile.summary} Cámara: ${referenceProfile.camera} Ritmo: ${referenceProfile.rhythm}`;
    referenceProfileView.hidden = false;
    clearReference.hidden = false;
  }

  function saveReferenceProfile() {
    try{
      if(referenceProfile) localStorage.setItem(REFERENCE_PROFILE_KEY, JSON.stringify({profile:referenceProfile, source:referenceSource}));
      else localStorage.removeItem(REFERENCE_PROFILE_KEY);
    }catch(_){ /* Optional device-local persistence. */ }
  }

  function selectedReferenceMode() {
    return referenceModeInputs.find(input => input.checked)?.value || 'none';
  }

  function renderReferenceMode(mode) {
    referenceLocal.hidden = mode !== 'local';
    referenceUrlRow.hidden = mode !== 'url';
  }

  function loadReferenceProfile() {
    try{
      const saved = JSON.parse(localStorage.getItem(REFERENCE_PROFILE_KEY) || 'null');
      if(saved?.profile && typeof saved.profile.promptFragment === 'string' && typeof saved.profile.summary === 'string'){
        referenceProfile = saved.profile;
        referenceSource = saved.source && typeof saved.source.mode === 'string' ? saved.source : null;
      }
    }catch(_){ referenceProfile = null; referenceSource = null; }
    const restoredMode = referenceSource?.mode === 'local' ? 'local' : (referenceSource ? 'url' : 'none');
    const restoredInput = referenceModeInputs.find(input => input.value === restoredMode);
    if(restoredInput) restoredInput.checked = true;
    renderReferenceMode(restoredMode);
    if(referenceSource?.url){
      referenceUrl.value = referenceSource.url;
      referenceSourceLink.href = referenceSource.url;
      referenceSourceLink.hidden = false;
    }
    renderReferenceProfile();
    if(referenceProfile) setReferenceMessage('Guía visual recuperada de este dispositivo y aplicada al prompt.', 'success');
  }

  function renderPlan(nextPlan) {
    plan = nextPlan;
    document.body.dataset.presenter = plan.presenter.key;
    scriptText.textContent = plan.script;
    wordCount.textContent = String(plan.pace.words);
    paceStatus.textContent = plan.pace.label;
    paceStatus.style.color = plan.pace.level === 'too-fast' ? '#ff7a30' : '';
    storyboard.replaceChildren(...plan.scenes.map((scene, i) => createStoryCard(scene, i, plan)));
    exportStoryboard.disabled = false;
    proofChip.textContent = plan.presenter.name.toUpperCase() + ' · 15S';
    syncGrokPrompt();
    saveDraft();
    restart();
  }

  function generate() {
    const data = readForm();
    if(contentSource){
      data.sourceUrl = contentSource.source?.url;
      data.sourceKind = contentSource.source?.kind;
      data.sourceTitle = contentSource.source?.title;
      data.sourceSummary = contentSource.summary;
      data.sourceKeyPoints = contentSource.keyPoints;
    }
    renderPlan(core.buildPlan(data, variation));
  }

  function copyText(text, button, idleText) {
    const done = () => {
      button.textContent = 'Copiado';
      window.setTimeout(() => { button.textContent = idleText; }, 1500);
    };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
    } else fallbackCopy(text, done);
  }

  function fallbackCopy(text, done) {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    try { document.execCommand('copy'); done(); } finally { area.remove(); }
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function guardarParaTester(blob, filename) {
    if (!openTester || !('indexedDB' in window)) return Promise.resolve(false);
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(TESTER_DB, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(TESTER_STORE)) {
          request.result.createObjectStore(TESTER_STORE);
        }
      };
      request.onerror = () => reject(request.error || new Error('No se pudo preparar el Tester.'));
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction(TESTER_STORE, 'readwrite');
        tx.objectStore(TESTER_STORE).put({
          blob,
          filename,
          type: blob.type,
          width: 1080,
          height: 1920,
          createdAt: new Date().toISOString()
        }, TESTER_KEY);
        tx.oncomplete = () => { db.close(); resolve(true); };
        tx.onerror = () => { db.close(); reject(tx.error || new Error('No se pudo guardar el vídeo para el Tester.')); };
      };
    });
  }

  function downloadPlan() {
    const payload = JSON.stringify(plan, null, 2);
    downloadBlob(new Blob([payload], { type: 'application/json' }), `${core.fileSlug(plan.brief.task)}-plan.json`);
  }

  function speakPlan() {
    if (!('speechSynthesis' in window)) {
      exportStatus.textContent = 'La voz de prueba no está disponible en este navegador.';
      return;
    }
    if (speechSynthesis.speaking) {
      speechSynthesis.cancel();
      voiceButton.setAttribute('aria-pressed', 'false');
      return;
    }
    const utterance = new SpeechSynthesisUtterance(plan.script);
    utterance.lang = 'es-ES';
    utterance.rate = 1.12;
    utterance.pitch = plan.presenter.key === 'chispa' ? 1.14 : 1;
    utterance.onend = () => voiceButton.setAttribute('aria-pressed', 'false');
    utterance.onerror = () => voiceButton.setAttribute('aria-pressed', 'false');
    voiceButton.setAttribute('aria-pressed', 'true');
    speechSynthesis.speak(utterance);
  }

  function selectedProductionMode() {
    return modeInputs.find((input) => input.checked)?.value || 'motion';
  }

  function setProductionMode(mode) {
    const grokMode = mode === 'grok';
    document.body.dataset.productionMode = grokMode ? 'grok' : 'motion';
    grokStudio.hidden = !grokMode;
    motionTransport.hidden = grokMode;
    $('.timecode').hidden = grokMode;
    previewTitle.textContent = grokMode ? 'Vídeo puro con Grok' : 'Pieza generada';
    if(grokMode){
      playing = false;
      playPause.textContent = 'Reproducir';
      stage.hidden = Boolean(grokVideoUrl);
      grokVideo.hidden = !grokVideoUrl;
    }else{
      stage.hidden = false;
      grokVideo.hidden = true;
      if(!reduceMotion.matches && !playing){
        playing = true;
        startedAt = performance.now() - pausedAt * 1000;
        playPause.textContent = 'Pausar';
      }
    }
  }

  function setGrokJob(label, percent, detail) {
    const safePercent = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
    grokJob.hidden = false;
    grokJobLabel.textContent = label;
    grokJobPercent.textContent = `${safePercent}%`;
    grokProgress.style.width = `${safePercent}%`;
    grokJobDetail.textContent = detail;
  }

  function saveGrokJob(job) {
    try{ localStorage.setItem(GROK_JOB_KEY, JSON.stringify(job)); }catch(_){ /* Resuming is optional. */ }
  }

  function loadGrokJob() {
    try{
      const job = JSON.parse(localStorage.getItem(GROK_JOB_KEY) || 'null');
      if(!job || typeof job.requestId !== 'string' || Date.now() - Number(job.startedAt || 0) > 6 * 60 * 60 * 1000) return null;
      return job;
    }catch(_){ return null; }
  }

  function clearGrokJob() {
    try{ localStorage.removeItem(GROK_JOB_KEY); }catch(_){ /* Best effort. */ }
  }

  function setPixeriaState(status, payload = {}) {
    pixeriaBridge.dataset.status = status;
    openPixeriaAsset.hidden = true;
    retryPixeria.hidden = true;
    if(status === 'uploading'){
      pixeriaLabel.textContent = 'Pixeria · copiando el MP4';
      pixeriaDetail.textContent = 'El enlace interno está transfiriendo el vídeo al Stock de Pixeria.';
    }else if(status === 'retenido'){
      pixeriaLabel.textContent = 'Pixeria · bruto retenido (no se publica)';
      pixeriaDetail.textContent = 'Encargo con identidad estable: el bruto queda en ADmiraNeXT como fuente y al Stock solo irá el máster con rótulo. Así no hay duplicados.';
    }else if(status === 'published'){
      pixeriaLabel.textContent = payload.existente ? 'Pixeria · ya estaba en el Stock' : 'Pixeria · publicado en Stock';
      pixeriaDetail.textContent = payload.existente
        ? `Asset ${payload.id || ''} ya existía con esta identidad: no se ha duplicado.`
        : `Asset ${payload.id || ''} disponible para reutilizar y distribuir.`;
      openPixeriaAsset.href = payload.stockUrl || 'https://www.pixeria.com/stock.html';
      openPixeriaAsset.hidden = false;
    }else if(status === 'failed'){
      pixeriaLabel.textContent = 'Pixeria · envío pendiente';
      pixeriaDetail.textContent = payload.error || 'El vídeo está a salvo, pero Pixeria no pudo copiarlo todavía.';
      retryPixeria.hidden = false;
    }else{
      pixeriaBridge.dataset.status = 'ready';
      pixeriaLabel.textContent = 'Pixeria · envío automático activado';
      pixeriaDetail.textContent = 'Al terminar, el MP4 se copiará al Stock de Pixeria sin pasar por tu navegador.';
    }
  }

  async function readApiResponse(response, fallback = 'No se pudo completar la solicitud de Grok.') {
    const type = response.headers.get('content-type') || '';
    if(!type.includes('application/json')){
      if(response.status === 401 || response.status === 403) throw Object.assign(new Error('Inicia sesión en el Generador de Presentaciones para usar Grok.'), {auth:true});
      throw Object.assign(new Error(fallback), {status:response.status});
    }
    const payload = await response.json();
    const detail = payload?.error || payload?.message || payload?.errors?.[0]?.message || fallback;
    if(!response.ok) throw Object.assign(new Error(detail), {status:response.status, auth:response.status === 401 || response.status === 403});
    return payload;
  }

  function setReferenceMessage(message, state = '') {
    referenceStatus.textContent = message;
    referenceStatus.classList.toggle('is-error', state === 'error');
    referenceStatus.classList.toggle('is-success', state === 'success');
  }

  function waitForMedia(element, eventName) {
    return new Promise((resolve, reject) => {
      const done = () => { cleanup(); resolve(); };
      const failed = () => { cleanup(); reject(new Error('No pudimos leer el vídeo de referencia.')); };
      const cleanup = () => {
        element.removeEventListener(eventName, done);
        element.removeEventListener('error', failed);
      };
      element.addEventListener(eventName, done, {once:true});
      element.addEventListener('error', failed, {once:true});
    });
  }

  function resetReferenceMedia() {
    pintarMomentos(null);
    referenceVideo.value = '';
    referencePreview.removeAttribute('src');
    referencePreview.load();
    referencePreview.hidden = true;
    if(referenceObjectUrl) URL.revokeObjectURL(referenceObjectUrl);
    referenceObjectUrl = '';
    referenceSourceLink.hidden = true;
    referenceSourceLink.removeAttribute('href');
    analyzeReference.disabled = true;
  }

  function youtubeVideoId(value) {
    try{
      const url = new URL(value);
      if(url.protocol !== 'https:' || url.username || url.password) return '';
      const host = url.hostname.toLowerCase();
      let id = '';
      if(host === 'youtu.be') id = url.pathname.split('/').filter(Boolean)[0] || '';
      else if(host === 'youtube.com' || host.endsWith('.youtube.com')){
        if(url.pathname === '/watch') id = url.searchParams.get('v') || '';
        else id = url.pathname.match(/^\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{11})(?:\/|$)/)?.[1] || '';
      }
      return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : '';
    }catch(_){ return ''; }
  }

  function pixeriaReference(value) {
    try{
      const url = new URL(value);
      if(url.protocol !== 'https:' || url.username || url.password) return null;
      const host = url.hostname.toLowerCase();
      let id = '';
      if(host === 'api.admira.store') id = url.pathname.match(/^\/stock\/asset\/([^/]+)$/)?.[1] || '';
      else if(host === 'pixeria.com' || host === 'www.pixeria.com') id = url.searchParams.get('highlight') || '';
      if(!/^(?:\d{10,16}-[a-z0-9]{4,16}|auto-[a-f0-9]{20})$/i.test(id)) return null;
      return {id, assetUrl:`https://api.admira.store/stock/asset/${encodeURIComponent(id)}`};
    }catch(_){ return null; }
  }

  async function prepareVideoReference(sourceUrl, source, shouldReset = true) {
    if(shouldReset) resetReferenceMedia();
    referenceSource = source;
    referencePreview.src = sourceUrl;
    referencePreview.hidden = false;
    referenceSourceLink.href = source.url || sourceUrl;
    referenceSourceLink.hidden = false;
    clearReference.hidden = false;
    setReferenceMessage('Leyendo duración y formato…');
    try{
      if(referencePreview.readyState < 1) await waitForMedia(referencePreview, 'loadedmetadata');
      if(!Number.isFinite(referencePreview.duration) || referencePreview.duration <= 0 || referencePreview.duration > 30 * 60){
        throw new Error('La referencia debe durar menos de 30 minutos.');
      }
      analyzeReference.disabled = false;
      setReferenceMessage(`${source.label} lista · ${referencePreview.duration.toFixed(1)}s. Sacando sus 5 momentos…`);
      // Se enseñan YA, sin esperar a «Analizar»: ver como esta contado el
      // anuncio que te gusta es util por si solo, aunque no lo analices.
      try{
        pintarMomentos(await captureReferenceFrames());
        setReferenceMessage(`${source.label} lista · ${referencePreview.duration.toFixed(1)}s. Ahí tienes sus 5 momentos; analízala para aplicar su lenguaje visual.`);
      }catch(_){
        pintarMomentos(null);
        setReferenceMessage(`${source.label} lista · ${referencePreview.duration.toFixed(1)}s. Analízala para aplicar su lenguaje visual.`);
      }
    }catch(error){
      analyzeReference.disabled = true;
      setReferenceMessage(error.message || 'No pudimos leer el vídeo de referencia.', 'error');
    }
  }

  async function selectReferenceVideo() {
    const file = referenceVideo.files?.[0];
    if(!file) return;
    const allowed = ['video/mp4', 'video/webm', 'video/quicktime'];
    if(!allowed.includes(file.type) || file.size > 200 * 1024 * 1024){
      referenceVideo.value = '';
      setReferenceMessage('Usa un MP4, WebM o MOV de hasta 200 MB.', 'error');
      return;
    }
    resetReferenceMedia();
    referenceObjectUrl = URL.createObjectURL(file);
    await prepareVideoReference(referenceObjectUrl, {mode:'local', label:'Archivo local', name:core.clean(file.name, 120)}, false);
  }

  async function loadReferenceFromUrl() {
    const value = core.clean(referenceUrl.value, 800);
    const youtubeId = youtubeVideoId(value);
    const pixeria = pixeriaReference(value);
    referenceProfile = null;
    saveReferenceProfile();
    renderReferenceProfile();
    syncGrokPrompt();
    if(youtubeId){
      resetReferenceMedia();
      referenceSource = {mode:'youtube', label:'YouTube', url:value, videoId:youtubeId};
      referenceSourceLink.href = value;
      referenceSourceLink.hidden = false;
      clearReference.hidden = false;
      analyzeReference.disabled = false;
      setReferenceMessage('URL de YouTube lista. Analízala para convertir sus fotogramas representativos en dirección visual.');
      return;
    }
    if(pixeria){
      await prepareVideoReference(pixeria.assetUrl, {mode:'pixeria', label:'Vídeo de Pixeria', url:value, id:pixeria.id, assetUrl:pixeria.assetUrl});
      return;
    }
    resetReferenceMedia();
    referenceSource = null;
    clearReference.hidden = false;
    setReferenceMessage('Usa una URL válida de YouTube o un enlace de asset/Stock de Pixeria.', 'error');
  }

  async function captureReferenceFrames() {
    const canvas = document.createElement('canvas');
    canvas.width = 360;
    canvas.height = 640;
    const ctx = canvas.getContext('2d', {alpha:false});
    const duration = referencePreview.duration;
    const frames = [];
    // CINCO momentos, no cuatro: entrada, desarrollo, giro, remate y cierre.
    // Es lo que pidio Carlos y ademas cuadra con como esta contado un anuncio.
    ultimosMomentos = [];
    for(const fraction of MOMENTOS){
      referencePreview.currentTime = Math.max(0, Math.min(duration - 0.05, duration * fraction));
      await waitForMedia(referencePreview, 'seeked');
      const scale = Math.max(canvas.width / referencePreview.videoWidth, canvas.height / referencePreview.videoHeight);
      const width = referencePreview.videoWidth * scale;
      const height = referencePreview.videoHeight * scale;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(referencePreview, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
      frames.push(canvas.toDataURL('image/jpeg', 0.72));
      ultimosMomentos.push(referencePreview.currentTime);
    }
    return frames;
  }

  /* ── Los 5 momentos de la referencia, A LA VISTA (Carlos, 4-ago-2026) ───────
     Estos fotogramas ya se sacaban para mandarselos a analizar y se tiraban sin
     enseñarlos. Son el material mas util que hay antes de decidir nada: como
     abre el anuncio que te gusta, donde gira y como remata. Ahora se ven. */
  function pintarMomentos(frames) {
    if(!frames || !frames.length){
      referenceFrames.hidden = true;
      referenceStrip.replaceChildren();
      return;
    }
    referenceStrip.replaceChildren(...frames.map((src, i) => {
      const fig = document.createElement('figure');
      fig.className = 'reference-shot';
      const img = document.createElement('img');
      img.src = src;
      img.loading = 'lazy';
      const seg = ultimosMomentos[i];
      const marca = Number.isFinite(seg) ? seg.toFixed(1) + 's' : `Momento ${i + 1}`;
      img.alt = `Momento ${i + 1} del anuncio de referencia, en el segundo ${marca}`;
      const pie = document.createElement('figcaption');
      pie.textContent = marca;
      fig.append(img, pie);
      return fig;
    }));
    referenceFramesCaption.textContent = `Los ${frames.length} momentos del anuncio de referencia`;
    referenceFrames.hidden = false;
  }

  async function analyzeReferenceVideo() {
    if(!referenceSource || analyzeReference.disabled) return;
    analyzeReference.disabled = true;
    setReferenceMessage(referenceSource.mode === 'youtube' ? 'Recuperando fotogramas representativos de YouTube…' : 'Leyendo los 5 momentos en este dispositivo…');
    try{
      // Si ya se sacaron al cargar, no se vuelve a barrer el video entero.
      const yaSacados = referenceStrip.querySelectorAll('img');
      const requestBody = referenceSource.mode === 'youtube'
        ? {sourceUrl:referenceSource.url}
        : {frames: yaSacados.length ? Array.from(yaSacados, (i) => i.src) : await captureReferenceFrames()};
      setReferenceMessage('Grok está leyendo cámara, ritmo, luz y paleta…');
      const response = await fetch('/presentaciones/api/video-reference', {
        method:'POST', credentials:'same-origin',
        headers:{'content-type':'application/json', accept:'application/json'},
        body:JSON.stringify(requestBody)
      });
      const payload = await readApiResponse(response);
      referenceProfile = payload.profile;
      saveReferenceProfile();
      renderReferenceProfile();
      syncGrokPrompt();
      setReferenceMessage('Referencia analizada y aplicada a la dirección visual de Grok.', 'success');
    }catch(error){ setReferenceMessage(error.message || 'No pudimos analizar la referencia.', 'error'); }
    finally{ analyzeReference.disabled = false; }
  }

  function clearReferenceVideo(resetMode = true) {
    resetReferenceMedia();
    referenceUrl.value = '';
    referenceSource = null;
    referenceProfile = null;
    saveReferenceProfile();
    renderReferenceProfile();
    syncGrokPrompt();
    clearReference.hidden = true;
    if(resetMode){
      const none = referenceModeInputs.find(input => input.value === 'none');
      if(none) none.checked = true;
      renderReferenceMode('none');
      setReferenceMessage('Sin referencia · el anuncio se generará solo a partir del brief.');
    }
  }

  function changeReferenceMode() {
    const mode = selectedReferenceMode();
    clearReferenceVideo(false);
    renderReferenceMode(mode);
    if(mode === 'none') setReferenceMessage('Sin referencia · el anuncio se generará solo a partir del brief.');
    else if(mode === 'local') setReferenceMessage('Selecciona un MP4, WebM o MOV local de hasta 200 MB. El archivo no se subirá: solo enviaremos cuatro fotogramas al analizarlo.');
    else setReferenceMessage('Pega una URL de YouTube o un enlace del Stock de Pixeria.');
  }

  function showGrokError(error) {
    const auth = Boolean(error?.auth);
    generateGrokButton.disabled = false;
    grokAccess.hidden = !auth;
    setGrokJob('No se pudo iniciar', 0, String(error?.message || 'No se pudo conectar con Grok.'));
  }

  function showGrokVideo(payload) {
    // Encargo: el bruto retenido se sirve same-origin (/tiktok/media/…) y el
    // canvas del máster no se ensucia. Flujo libre: la copia del Stock.
    const durableUrl = payload.pixeria?.mediaUrl || payload.pixeria?.assetUrl || payload.video.url;
    grokVideoUrl = durableUrl;
    if(grokVideo.src !== durableUrl) grokVideo.src = durableUrl;
    openGrokVideo.href = grokVideoUrl;
    grokResultActions.hidden = false;
    stage.hidden = true;
    grokVideo.hidden = false;
    pintarStoryboardGrok();
  }

  /* ── Motor gratuito: Meta AI asistido ──────────────────────────────────────
     Meta AI (Vibes / Movie Gen) hace hasta 16 s en 1080p con audio y es gratis,
     pero no expone API de video. Asi que el estudio hace su parte —el prompt— y
     el usuario trae el MP4. A partir de ahi NO hay camino especial: se usa el
     mismo grokVideoUrl, el mismo montaje de 25 s y la misma publicacion en
     Pixeria, para que solo exista una tuberia que mantener.
     El blob: local ademas es same-origin, asi que no ensucia el canvas del
     montaje como podria hacerlo una URL remota. */
  const META_URL = 'https://www.meta.ai/';
  // Entrada, desarrollo, giro, remate y cierre.
  const MOMENTOS = [0.06, 0.28, 0.5, 0.72, 0.94];
  let ultimosMomentos = [];

  // Vibes genera vertical y corto, que es justo lo que pide el montaje; pero el
  // prompt de arriba esta escrito para Grok, donde el formato va aparte (el
  // selector de resolucion). Al pasarlo a Meta AI se le adjunta el formato que
  // el propio estudio exige —9:16 y 15 s, el hueco entre las dos cortinillas—
  // para que lo que vuelva encaje sin retocar. No se toca el prompt original.
  const META_FORMATO = 'Formato: vídeo vertical 9:16, 15 segundos, sin texto sobreimpreso.';

  async function prepararMeta(){
    const prompt = (grokPrompt.value || '').trim();
    if(!prompt){
      metaStatus.textContent = 'Escribe antes el prompt: es lo que se copia.';
      return;
    }
    const paraMeta = prompt + '\n\n' + (encargoActivo() && formatoActual === '16:9' ? 'Formato: vídeo horizontal 16:9, 15 segundos, sin texto sobreimpreso.' : META_FORMATO);
    let copiado = false;
    try{ await navigator.clipboard.writeText(paraMeta); copiado = true; }catch(_){ copiado = false; }
    metaStatus.textContent = copiado
      ? 'Prompt copiado. Pegalo en Meta AI, genera el video y traelo con el boton de al lado.'
      : 'No he podido copiar solo: selecciona el prompt de arriba y copialo a mano.';
    window.open(META_URL, '_blank', 'noopener');
  }

  function traerVideoMeta(file){
    if(!file) return;
    if(!/^video\//.test(file.type || '')){
      metaStatus.textContent = 'Ese fichero no es un video.';
      return;
    }
    if(grokVideoUrl.startsWith('blob:')) URL.revokeObjectURL(grokVideoUrl);
    grokVideoUrl = URL.createObjectURL(file);
    grokVideo.src = grokVideoUrl;
    openGrokVideo.href = grokVideoUrl;
    grokResultActions.hidden = false;
    stage.hidden = true;
    grokVideo.hidden = false;
    const mb = (file.size / (1024 * 1024)).toFixed(1);
    metaStatus.textContent = 'Video de Meta AI cargado (' + mb + ' MB). Ya puedes montar los 25 s y publicar en Pixeria.';
    pintarStoryboardGrok();
  }

  /* ── Storyboard DEL VIDEO GENERADO (Carlos, 4-ago-2026) ────────────────────
     El escenario dejaba media columna en blanco con el video centrado. Esa
     mitad —la de ADmira Motion— pasa a enseñar el storyboard del propio video
     de Grok: sus momentos, sacados del MP4 que se acaba de generar. Es el
     storyboard de verdad, no una maqueta: son fotogramas del anuncio.

     Se sacan del <video> con un canvas. Si la fuente es remota y no manda
     CORS, el canvas queda "sucio" y toDataURL revienta: se dice y se deja el
     video, en vez de fingir que no ha pasado nada. Con el MP4 de Meta AI, que
     es un blob local, siempre funciona. */
  async function pintarStoryboardGrok() {
    if(!grokVideoUrl){ grokBoard.hidden = true; grokBoardStrip.replaceChildren(); return; }
    try{
      if(grokVideo.readyState < 1) await waitForMedia(grokVideo, 'loadedmetadata');
      const dur = grokVideo.duration;
      if(!Number.isFinite(dur) || dur <= 0) throw new Error('sin duración');
      const canvas = document.createElement('canvas');
      canvas.width = 216; canvas.height = 384;
      const ctx = canvas.getContext('2d', {alpha:false});
      const tomas = [];
      const eraMudo = grokVideo.muted;
      grokVideo.muted = true;
      for(const f of [0.1, 0.5, 0.88]){
        grokVideo.currentTime = Math.max(0, Math.min(dur - 0.05, dur * f));
        await waitForMedia(grokVideo, 'seeked');
        const escala = Math.max(canvas.width / grokVideo.videoWidth, canvas.height / grokVideo.videoHeight);
        const w = grokVideo.videoWidth * escala, h = grokVideo.videoHeight * escala;
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(grokVideo, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
        tomas.push({src: canvas.toDataURL('image/jpeg', 0.78), t: grokVideo.currentTime});
      }
      grokVideo.muted = eraMudo;
      grokVideo.currentTime = 0;
      grokBoardStrip.replaceChildren(...tomas.map((toma, i) => {
        const fig = document.createElement('figure');
        fig.className = 'grok-board-shot';
        const img = document.createElement('img');
        img.src = toma.src; img.loading = 'lazy';
        img.alt = `Escena ${i + 1} del vídeo generado, en el segundo ${toma.t.toFixed(1)}`;
        const pie = document.createElement('figcaption');
        pie.textContent = toma.t.toFixed(1) + 's';
        fig.append(img, pie);
        return fig;
      }));
      grokBoardCaption.textContent = `Storyboard del vídeo generado · ${tomas.length} escenas`;
      grokBoard.hidden = false;
    }catch(_){
      grokBoardStrip.replaceChildren();
      const aviso = document.createElement('p');
      aviso.className = 'grok-board-note';
      aviso.textContent = 'No se pudo sacar el storyboard de este vídeo: la fuente no permite leer sus fotogramas desde el navegador.';
      grokBoardStrip.appendChild(aviso);
      grokBoard.hidden = false;
    }
  }

  function finishGrokVideo(payload) {
    grokRequestId = payload.requestId || grokRequestId;
    showGrokVideo(payload);
    const publication = payload.pixeria || {status:'failed', error:'Pixeria no devolvió el estado de la publicación.'};
    setPixeriaState(publication.status, publication);
    if(publication.status === 'uploading' || publication.status === 'pending'){
      generateGrokButton.disabled = true;
      setGrokJob('Copiando a Pixeria', 96, 'Grok ya terminó. Estamos guardando el MP4 en el Stock de Pixeria…');
      scheduleGrokPoll(grokRequestId, 5000);
      return;
    }
    generateGrokButton.disabled = false;
    grokAccess.hidden = true;
    if(publication.status === 'published' || publication.status === 'retenido'){
      if(publication.status === 'retenido') setGrokJob('Vídeo listo · bruto retenido', 100, 'Grok ha terminado. El bruto no se publica: al Stock irá solo el máster con rótulo.');
      else if(publication.status === 'published' && recordarPublicado(grokRequestId, publication.id)) setGrokJob('Vídeo ya publicado antes', 100, `Este mismo vídeo ya estaba en el Stock como ${publication.id}. No se ha duplicado.`);
      else setGrokJob('Vídeo publicado', 100, 'Grok ha terminado y Pixeria ya tiene una copia permanente en su Stock.');
      packageOutput.hidden = false;
      composeGrokPackage.disabled = false;
      packageStatus.textContent = 'El máster principal está listo. Añadiremos preroll y postroll y publicaremos la pieza final en Pixeria.';
      clearGrokJob();
      if(flujoCatalogo && (productoCatalogo || briefCampana)){
        // Pieza de catálogo o de brief: 15 s justos (sin rolls) con el overlay encima.
        preRollEnabled.checked = false;
        postRollEnabled.checked = false;
        setCatalogStatus(productoCatalogo ? '3/3 · Montando el máster de 15 s con el precio en pantalla…' : '3/3 · Montando el máster de 15 s con el rótulo de campaña…');
        void composeAndPublishGrokPackage();
      }
    }else{
      setGrokJob('Vídeo listo · Pixeria pendiente', 100, 'Puedes revisar el MP4 y reintentar su envío a Pixeria sin volver a generar el vídeo.');
      if(flujoCatalogo) terminarFlujoCatalogo(encargoActivo() ? 'El vídeo está listo pero no se pudo retener como fuente del máster. Reintenta Pixeria y luego “Montar y publicar”.' : 'El vídeo está listo pero el Stock no lo recibió. Reintenta Pixeria y luego “Montar y publicar”.', 'error');
    }
  }

  // Flujo libre: memoria local de los requestId ya publicados (requestId → id del
  // Stock). Devuelve true si este requestId ya se había registrado antes.
  const PUBLICADOS_KEY = 'admiranext:tiktok15:publicados:v1';
  function recordarPublicado(requestId, stockId) {
    if(!requestId) return false;
    let publicados = {};
    try{ publicados = JSON.parse(localStorage.getItem(PUBLICADOS_KEY) || '{}') || {}; }catch(_){ publicados = {}; }
    const yaEstaba = Boolean(publicados[requestId]);
    publicados[requestId] = stockId || publicados[requestId] || true;
    try{ localStorage.setItem(PUBLICADOS_KEY, JSON.stringify(publicados)); }catch(_){ /* Persistencia opcional. */ }
    return yaEstaba;
  }

  function scheduleGrokPoll(requestId, delay = 5000) {
    window.clearTimeout(grokPollTimer);
    grokPollTimer = window.setTimeout(() => { void pollGrokVideo(requestId); }, delay);
  }

  async function pollGrokVideo(requestId) {
    if(grokPolling) return;
    grokPolling = true;
    try{
      const response = await fetch(`/presentaciones/api/grok-video?id=${encodeURIComponent(requestId)}`, {headers:{accept:'application/json'}, credentials:'same-origin'});
      const payload = await readApiResponse(response);
      if(payload.status === 'done' && payload.video?.url){
        finishGrokVideo(payload);
        return;
      }
      if(payload.status === 'failed' || payload.status === 'expired'){
        generateGrokButton.disabled = false;
        setGrokJob('Generación interrumpida', payload.progress || 0, payload.error || 'Grok no pudo completar el vídeo.');
        clearGrokJob();
        if(flujoCatalogo) terminarFlujoCatalogo(payload.error || 'Grok no pudo completar el vídeo.', 'error');
        return;
      }
      const progressValue = payload.progress || 0;
      setGrokJob('Grok está generando', progressValue, 'La creación es asíncrona y puede tardar varios minutos. Esta pantalla se actualizará automáticamente.');
      scheduleGrokPoll(requestId);
    }catch(error){
      if(error?.status === 429){
        setGrokJob('Grok sigue trabajando', Number(grokJobPercent.textContent.replace('%','')) || 0, 'Límite temporal de consulta. Reintentaremos automáticamente.');
        scheduleGrokPoll(requestId, 10000);
      }else showGrokError(error);
    }finally{
      grokPolling = false;
    }
  }

  async function startGrokVideo() {
    const prompt = core.clean(grokPrompt.value, 3200);
    if(prompt.length < 40){
      setGrokJob('Falta dirección visual', 0, 'Describe con algo más de detalle qué debe aparecer en el vídeo puro.');
      return false;
    }
    // Con encargo (brief o producto) el vídeo sale SIEMPRE de la idea
    // desarrollada por el director creativo; jamás del ejemplo ni de un plan
    // que no venga del encargo. Se comprueba aquí, en el único sitio por el
    // que se llama a Grok, para que dé igual qué botón se pulse.
    if(encargoActivo()){
      if(!ideaEncargo){
        setGrokJob('Falta la idea del encargo', 0, 'Con un brief o un producto cargado, el vídeo debe salir de la idea desarrollada por el director creativo. Pulsa «Generar anuncio» en la ficha de arriba.');
        return false;
      }
      if(prompt.includes(example.task) || !prompt.includes(core.clean(ideaEncargo.idea, 180).slice(0, 40))){
        setGrokJob('El prompt no sale del encargo', 0, `El prompt de Grok debe llevar la idea desarrollada «${ideaEncargo.idea}». Pulsa «Generar anuncio» para regenerarlo.`);
        return false;
      }
    }
    generateGrokButton.disabled = true;
    grokResultActions.hidden = true;
    grokAccess.hidden = true;
    grokVideoUrl = '';
    if(typeof grokBoard !== 'undefined' && grokBoard){ grokBoard.hidden = true; grokBoardStrip.replaceChildren(); }
    grokRequestId = '';
    packageOutput.hidden = true;
    packageOutput.classList.remove('is-published');
    openPackageAsset.hidden = true;
    if(openStockCatalogo) openStockCatalogo.hidden = true;
    if(packageTags) packageTags.hidden = true;
    downloadGrokPackage.hidden = true;
    packageId = '';
    setPixeriaState('ready');
    grokVideo.removeAttribute('src');
    grokVideo.load();
    grokVideo.hidden = true;
    stage.hidden = false;
    const formatoEnvio = encargoActivo() ? formatoActual : '9:16';
    setGrokJob('Enviando a Grok', 4, `Crearemos una secuencia original de 15 segundos en formato ${dimensionesFormato(formatoEnvio).nombre}.`);
    const clientRequestId = crypto.randomUUID();
    try{
      const ficha = fichaActiva();
      const response = await fetch('/presentaciones/api/grok-video', {
        method:'POST',
        credentials:'same-origin',
        headers:{'content-type':'application/json', accept:'application/json'},
        body:JSON.stringify(ficha
          ? {prompt, resolution:grokResolution.value, clientRequestId, formato:formatoEnvio, ficha, ...(productoCatalogo?.imagen ? {imagen:productoCatalogo.imagen} : {})}
          : {prompt, resolution:grokResolution.value, clientRequestId, formato:formatoEnvio})
      });
      const payload = await readApiResponse(response);
      grokRequestId = payload.requestId;
      // El trabajo se guarda con su identidad y formato: al recargar solo se
      // retoma si es de ESTE encargo (con «Crear vídeo de todos» hay varias
      // pestañas a la vez y cada una debe seguir el suyo).
      saveGrokJob({requestId:payload.requestId, startedAt:Date.now(), prompt, resolution:grokResolution.value, formato:formatoEnvio, externalId:ficha?.externalId || '', cola:[...colaFormatos], flujo:flujoCatalogo});
      setGrokJob('Solicitud aceptada', 8, 'Grok ha recibido el encargo. Esperando los primeros fotogramas…');
      scheduleGrokPoll(payload.requestId, 2500);
      return true;
    }catch(error){ showGrokError(error); return false; }
  }

  async function retryPixeriaPublication() {
    if(!grokRequestId) return;
    retryPixeria.disabled = true;
    setPixeriaState('uploading');
    setGrokJob('Reintentando Pixeria', 96, 'Volvemos a copiar el MP4 ya generado; no se consumirán nuevos créditos de vídeo.');
    try{
      const response = await fetch('/presentaciones/api/grok-video', {
        method:'PUT',
        credentials:'same-origin',
        headers:{'content-type':'application/json', accept:'application/json'},
        body:JSON.stringify({requestId:grokRequestId})
      });
      const payload = await readApiResponse(response);
      if(payload.status === 'done' && payload.video?.url) finishGrokVideo(payload);
      else scheduleGrokPoll(grokRequestId, 5000);
    }catch(error){
      setPixeriaState('failed', {error:String(error?.message || 'Pixeria no respondió.')});
      setGrokJob('Vídeo listo · Pixeria pendiente', 100, 'El MP4 permanece disponible. Puedes volver a intentarlo más tarde.');
    }finally{ retryPixeria.disabled = false; }
  }

  function roundedRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  function wrapLines(ctx, text, maxWidth, maxLines) {
    const words = core.clean(text).split(/\s+/);
    const lines = [];
    let current = '';
    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      if (ctx.measureText(test).width <= maxWidth || !current) current = test;
      else {
        lines.push(current);
        current = word;
        if (lines.length === maxLines - 1) break;
      }
    }
    if (current && lines.length < maxLines) lines.push(current);
    if (lines.join(' ').split(/\s+/).length < words.length) lines[lines.length - 1] = lines[lines.length - 1].replace(/[.…]+$/, '') + '…';
    return lines;
  }

  function paletteFor(key) {
    return {
      fusion: ['#65e9f4', '#ff7a30'],
      pix: ['#ff7a30', '#65e9f4'],
      chispa: ['#ff4fa3', '#7c4dff'],
      nexo: ['#3df08a', '#4a86ff']
    }[key] || ['#65e9f4', '#ff7a30'];
  }

  function drawPix(ctx, x, y, scale, accent, secondary, bob) {
    ctx.save();
    ctx.translate(x, y + bob);
    ctx.scale(scale, scale);
    ctx.fillStyle = accent;
    ctx.fillRect(-3, -112, 6, 30);
    ctx.beginPath();
    ctx.arc(0, -116, 10, 0, Math.PI * 2);
    ctx.fillStyle = secondary;
    ctx.shadowColor = secondary;
    ctx.shadowBlur = 22;
    ctx.fill();
    ctx.shadowBlur = 0;
    roundedRect(ctx, -63, -84, 126, 91, 31);
    ctx.fillStyle = '#b9edf0';
    ctx.fill();
    ctx.lineWidth = 7;
    ctx.strokeStyle = '#172730';
    ctx.stroke();
    ctx.fillStyle = '#06252b';
    ctx.beginPath(); ctx.ellipse(-25, -39, 9, 16, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(25, -39, 9, 16, 0, 0, Math.PI * 2); ctx.fill();
    roundedRect(ctx, -82, 4, 164, 98, 35);
    ctx.fillStyle = accent;
    ctx.fill();
    ctx.strokeStyle = '#172730';
    ctx.stroke();
    ctx.fillStyle = '#08252a';
    ctx.font = '900 23px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('PIX', 0, 63);
    ctx.beginPath();
    ctx.arc(54, 72, 14, 0, Math.PI * 2);
    ctx.fillStyle = secondary;
    ctx.fill();
    ctx.strokeStyle = '#172730';
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.restore();
  }

  function drawFrame(ctx, planData, seconds) {
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;
    const [accent, secondary] = paletteFor(planData.presenter.key);
    const scene = core.sceneAt(planData, seconds);
    const local = (seconds - scene.from) / Math.max(0.01, scene.to - scene.from);
    const ease = 1 - Math.pow(1 - Math.min(1, local * 2.4), 3);

    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#0b1924');
    gradient.addColorStop(0.58, '#05090d');
    gradient.addColorStop(1, '#0c151c');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    const offset = (seconds * 24) % 70;
    for (let y = -70 + offset; y < height + 70; y += 70) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }
    for (let x = 0; x < width; x += 70) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); }
    ctx.restore();

    ctx.save();
    ctx.translate(width - 120, 360);
    ctx.rotate(Math.PI / 4 + seconds * 0.025);
    ctx.globalAlpha = 0.27;
    ctx.strokeStyle = accent;
    ctx.lineWidth = 4;
    ctx.strokeRect(-220, -220, 440, 440);
    ctx.restore();

    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = '800 18px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.fillText('ZONA SEGURA', 74, 86);
    ctx.fillText('@ADmiraNeXT', 74, height - 80);

    ctx.save();
    ctx.globalAlpha = ease;
    ctx.translate(0, (1 - ease) * 34);
    ctx.font = '900 23px ui-monospace, monospace';
    const labelWidth = Math.min(width - 148, ctx.measureText(scene.label).width + 48);
    roundedRect(ctx, 74, 210, labelWidth, 64, 8);
    ctx.fillStyle = 'rgba(5,9,13,0.78)';
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = accent;
    ctx.fillText(scene.label, 98, 251);

    ctx.fillStyle = '#eef8fa';
    ctx.font = '900 78px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    const headlineLines = wrapLines(ctx, scene.headline, width - 148, 4);
    headlineLines.forEach((line, index) => ctx.fillText(line, 74, 385 + index * 78));
    ctx.fillStyle = '#c8d9de';
    ctx.font = '500 31px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    const bodyY = 385 + headlineLines.length * 78 + 28;
    wrapLines(ctx, scene.body, width - 250, 4).forEach((line, index) => ctx.fillText(line, 74, bodyY + index * 43));
    ctx.restore();

    drawPix(ctx, width - 245, height - 410, 1.5, accent, secondary, Math.sin(seconds * 3.2) * 8);

    ctx.font = '900 20px ui-monospace, monospace';
    const proof = `${planData.presenter.name.toUpperCase()} · LISTO`;
    const proofWidth = ctx.measureText(proof).width + 42;
    roundedRect(ctx, width - proofWidth - 74, height - 112, proofWidth, 52, 7);
    ctx.fillStyle = 'rgba(5,9,13,0.78)';
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = accent;
    ctx.fillText(proof, width - proofWidth - 53, height - 79);

    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(0, height - 10, width, 10);
    ctx.fillStyle = accent;
    ctx.fillRect(0, height - 10, width * Math.min(1, seconds / planData.duration), 10);
    drawOverlayEncargo(ctx, seconds);
  }

  // Overlay del encargo de un clic: precio (catálogo) o rótulo (brief). Sin encargo, nada.
  function drawOverlayEncargo(ctx, seconds) {
    if(productoCatalogo) drawPrecioOverlay(ctx, productoCatalogo, seconds);
    else if(briefCampana && briefCampana.overlay) drawBriefOverlay(ctx, briefCampana, seconds);
  }

  // ── Overlay de brief: rótulo discreto ─────────────────────────────────────
  // Sin precio que vender: arriba el título del brief en una caja oscura con
  // filo cian, abajo el claim en una píldora centrada. Mismo lienzo y escala que
  // drawPrecioOverlay; entra con un fundido corto para no tapar el arranque.
  function drawBriefOverlay(ctx, b, seconds = 0) {
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;
    const k = Math.min(width, height) / 1080;
    const m = 74 * k;
    ctx.save();
    ctx.globalAlpha = Math.min(1, Math.max(0, seconds / 0.6));
    ctx.textBaseline = 'alphabetic';

    ctx.font = `900 ${Math.round(48 * k)}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    const titulo = wrapLines(ctx, b.titulo.toUpperCase(), width - 2 * m - 48 * k, 2);
    const cajaAlto = (titulo.length * 56 + 44) * k;
    roundedRect(ctx, m, 110 * k, width - 2 * m, cajaAlto, 14 * k);
    ctx.fillStyle = 'rgba(5,9,13,0.72)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(101,233,244,0.9)';
    ctx.lineWidth = 3 * k;
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    titulo.forEach((line, i) => ctx.fillText(line, m + 24 * k, (110 + 30 + 46 + i * 56) * k));

    if(b.claim){
      ctx.font = `800 ${Math.round(34 * k)}px ui-monospace, monospace`;
      const claimTexto = b.claim.toUpperCase();
      const claimW = Math.min(width - 2 * m, ctx.measureText(claimTexto).width + 64 * k);
      const claimH = 68 * k;
      const claimX = (width - claimW) / 2, claimY = height - 215 * k;
      roundedRect(ctx, claimX, claimY, claimW, claimH, claimH / 2);
      ctx.fillStyle = 'rgba(5,9,13,0.72)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(101,233,244,0.9)';
      ctx.lineWidth = 3 * k;
      ctx.stroke();
      ctx.fillStyle = '#65e9f4';
      ctx.textAlign = 'center';
      ctx.fillText(claimTexto, width / 2, claimY + 46 * k);
    }
    ctx.restore();
  }

  // Etiqueta amarilla del precio (tienda, precio en rojo, unidad). `o` da centro,
  // tamaño, giro, escala y factor de fuente `f` (1 = la etiqueta grande de
  // siempre; 0.74 = la que solapa la tarjeta de producto).
  function drawEtiquetaPrecio(ctx, p, k, o) {
    const tagW = o.w, tagH = o.h, f = o.f || 1;
    const px = -tagW / 2 + 28 * k * f;
    ctx.save();
    ctx.translate(o.cx, o.cy);
    ctx.rotate(o.rot || 0);
    ctx.scale(o.scale || 1, o.scale || 1);
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = 28 * k;
    ctx.shadowOffsetY = 10 * k;
    roundedRect(ctx, -tagW / 2, -tagH / 2, tagW, tagH, 22 * k * f);
    ctx.fillStyle = '#ffe600';
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = '#b3000c';
    ctx.font = `800 ${Math.round(26 * k * f)}px ui-monospace, monospace`;
    ctx.textAlign = 'left';
    ctx.fillText(p.tienda.toUpperCase(), px, -tagH / 2 + 46 * k * f);
    if(p.precio != null){
      const entero = Math.floor(p.precio);
      const cent = Math.round((p.precio - entero) * 100).toString().padStart(2, '0');
      ctx.fillStyle = '#e3000f';
      ctx.font = `900 ${Math.round(150 * k * f)}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
      const enteroTexto = `${entero},`;
      const enteroAncho = ctx.measureText(enteroTexto).width;
      ctx.fillText(enteroTexto, px, 62 * k * f);
      ctx.font = `900 ${Math.round(84 * k * f)}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
      ctx.fillText(`${cent}€`, px + enteroAncho, 6 * k * f);
      ctx.fillStyle = '#111111';
      ctx.font = `800 ${Math.round(36 * k * f)}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
      ctx.fillText(UNIDADES_PRODUCTO[p.unidad] || '', px, tagH / 2 - 40 * k * f);
    }else{
      ctx.fillStyle = '#e3000f';
      ctx.font = `900 ${Math.round(52 * k * f)}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
      wrapLines(ctx, p.promo, tagW - 56 * k * f, 4).forEach((line, i) => ctx.fillText(line, px, -tagH / 2 + (120 + i * 58) * k * f));
    }
    ctx.restore();
  }

  // ── Tarjeta de producto estilo folleto (FLT-100318) ───────────────────────
  // Con la foto REAL del folleto cargada: marco blanco con sombra, la imagen
  // centrada (contain, sin deformar) y la etiqueta amarilla solapando la esquina
  // inferior derecha. Entra con escala 0.9→1 en 0,4 s y flota suavemente; NO se
  // apaga nunca: producto y precio se ven los 15 s completos. Sin foto no se
  // llama y el overlay es el de siempre.
  function drawTarjetaProducto(ctx, p, foto, seconds, k, zona) {
    const width = ctx.canvas.width;
    // Zona horizontal opcional (máster 16:9): la tarjeta se centra en ella.
    const left = zona.left != null ? zona.left : 74 * k;
    const right = zona.right != null ? zona.right : width - 74 * k;
    const maxW = Math.min(720 * k, right - left);
    const maxH = Math.max(320 * k, zona.bottom - zona.top - 80 * k);
    const marco = 26 * k;
    const ratio = (foto.naturalWidth || 1) / (foto.naturalHeight || 1);
    let imgW = maxW - 2 * marco, imgH = imgW / ratio;
    if(imgH > maxH - 2 * marco){ imgH = maxH - 2 * marco; imgW = imgH * ratio; }
    const cardW = imgW + 2 * marco, cardH = imgH + 2 * marco;
    const entrada = Math.min(1, Math.max(0, seconds / 0.4));
    const esc = 0.9 + 0.1 * (1 - Math.pow(1 - entrada, 3));
    const cx = (left + right) / 2 - 24 * k;
    const cy = zona.top + (zona.bottom - zona.top) / 2 - 24 * k + Math.sin(seconds * 1.7) * 7 * k;
    ctx.save();
    ctx.globalAlpha = Math.min(1, 0.4 + entrada);
    ctx.translate(cx, cy);
    ctx.scale(esc, esc);
    ctx.rotate(-0.02);
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 40 * k;
    ctx.shadowOffsetY = 16 * k;
    roundedRect(ctx, -cardW / 2, -cardH / 2, cardW, cardH, 18 * k);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.drawImage(foto, -imgW / 2, -imgH / 2, imgW, imgH);
    ctx.restore();
    const f = 0.74;
    const pulso = 1 + Math.sin(seconds * 2.2) * 0.018;
    drawEtiquetaPrecio(ctx, p, k, {cx:cx + (cardW / 2) * esc - 44 * k, cy:cy + (cardH / 2) * esc - 30 * k, w:470 * k * f, h:330 * k * f, rot:-0.07, scale:pulso * esc, f});
  }

  // ── Overlay de precio estilo folleto ──────────────────────────────────────
  // Se pinta sobre TODO el vídeo cuando hay producto de catálogo: nombre arriba,
  // etiqueta amarilla con el precio en rojo y la unidad pequeña, y el sello de
  // validez abajo. Sin producto no se llama y nada cambia. Lienzo 1080×1920;
  // las medidas se escalan por si el lienzo es otro (storyboard, pruebas).
  function drawPrecioOverlay(ctx, p, seconds = 0) {
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;
    // Formato (FLT-100372): en horizontal el nombre va arriba a la izquierda y
    // la tarjeta con la foto a la derecha; la escala sale del lado corto para
    // que el rótulo pese lo mismo en 1080×1920 que en 1920×1080.
    const horizontal = width > height;
    const k = Math.min(width, height) / 1080;
    const m = 74 * k;
    // Estética del folleto (FLT-100372): con folleto claro, caja blanca con la
    // tinta y el acento de la marca; con folleto oscuro, la caja oscura de antes.
    const e = p.estilo || leerEstilo(null);
    const claro = e.claro;
    const acento = e.acento;
    ctx.save();
    ctx.textBaseline = 'alphabetic';

    // Nombre del producto, arriba (en horizontal, la mitad izquierda).
    const cajaX = m;
    const cajaY = horizontal ? 64 * k : 110 * k;
    const cajaW = horizontal ? Math.round(width * 0.5) : width - 2 * m;
    ctx.font = `900 ${Math.round(54 * k)}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    const nombre = wrapLines(ctx, p.nombre.toUpperCase(), cajaW - 48 * k, 2);
    const marcaAlto = p.marca ? 30 : 0;
    const nombreAlto = (nombre.length * 62 + 44 + marcaAlto) * k;
    roundedRect(ctx, cajaX, cajaY, cajaW, nombreAlto, 14 * k);
    ctx.fillStyle = claro ? 'rgba(255,255,255,0.94)' : 'rgba(5,9,13,0.82)';
    ctx.fill();
    ctx.strokeStyle = claro ? acento : '#ffe600';
    ctx.lineWidth = 4 * k;
    ctx.stroke();
    ctx.fillStyle = claro ? e.tinta : '#ffffff';
    ctx.textAlign = 'left';
    nombre.forEach((line, i) => ctx.fillText(line, cajaX + 24 * k, cajaY + (30 + 52 + marcaAlto + i * 62) * k));
    if(p.marca){
      ctx.font = `800 ${Math.round(24 * k)}px ui-monospace, monospace`;
      ctx.fillStyle = claro ? acento : '#ffe600';
      ctx.fillText(p.marca.toUpperCase(), cajaX + 24 * k, cajaY + 40 * k);
    }

    // Con la foto real cargada: tarjeta estilo folleto con la etiqueta solapando
    // su esquina; sin foto, la etiqueta amarilla de siempre.
    const foto = imagenLista(imagenProducto) ? imagenProducto : null;
    const pulso = 1 + Math.sin(seconds * 2.2) * 0.018;
    const tagW = 470 * k, tagH = 330 * k;
    if(horizontal){
      const zona = {top:48 * k, bottom:height - 48 * k, left:width * 0.54, right:width - m};
      if(foto) drawTarjetaProducto(ctx, p, foto, seconds, k, zona);
      else drawEtiquetaPrecio(ctx, p, k, {cx:(zona.left + zona.right) / 2, cy:height / 2, w:tagW, h:tagH, rot:-0.07, scale:pulso, f:1});
    }else if(foto){
      drawTarjetaProducto(ctx, p, foto, seconds, k, {top:110 * k + nombreAlto + 36 * k, bottom:height - (p.precio != null && p.promo ? 330 : 250) * k});
    }else{
      // Etiqueta amarilla del precio, abajo a la izquierda, con un latido suave.
      drawEtiquetaPrecio(ctx, p, k, {cx:m + tagW / 2, cy:height - 660 * k + tagH / 2, w:tagW, h:tagH, rot:-0.07, scale:pulso, f:1});
    }

    // Promo corta (cuando además hay precio): bajo la etiqueta en vertical,
    // bajo el nombre en horizontal.
    if(p.precio != null && p.promo){
      ctx.font = `800 ${Math.round(30 * k)}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
      ctx.fillStyle = claro ? acento : '#ffe600';
      ctx.textAlign = 'left';
      const promoY = horizontal ? cajaY + nombreAlto + 52 * k : height - 300 * k;
      const lineas = wrapLines(ctx, p.promo, horizontal ? cajaW : width - 2 * m, 2);
      if(horizontal && claro){
        // Fondo claro bajo la promo para que se lea sobre cualquier vídeo.
        const promoH = (lineas.length * 38 + 26) * k;
        roundedRect(ctx, cajaX, promoY - 32 * k, cajaW, promoH, 10 * k);
        ctx.fillStyle = 'rgba(255,255,255,0.86)';
        ctx.fill();
        ctx.fillStyle = acento;
      }
      lineas.forEach((line, i) => ctx.fillText(line, cajaX + (horizontal ? 24 * k : 0), promoY + i * 38 * k));
    }

    // Sello de validez: abajo y centrado (vertical) o abajo a la izquierda (horizontal).
    if(p.validezSello){
      ctx.font = `900 ${Math.round(38 * k)}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
      const selloTexto = p.validezSello.toUpperCase();
      const anchoMax = horizontal ? cajaW : width - 2 * m;
      const selloW = Math.min(anchoMax, ctx.measureText(selloTexto).width + 64 * k);
      const selloH = 72 * k;
      const selloX = horizontal ? cajaX : (width - selloW) / 2;
      const selloY = horizontal ? height - 64 * k - selloH : height - 215 * k;
      roundedRect(ctx, selloX, selloY, selloW, selloH, selloH / 2);
      ctx.fillStyle = claro ? acento : '#e3000f';
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(selloTexto, selloX + selloW / 2, selloY + 50 * k);
    }
    ctx.restore();
  }

  function supportedMime() {
    const types = [
      'video/mp4;codecs=h264,aac',
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm'
    ];
    return types.find((type) => MediaRecorder.isTypeSupported(type)) || '';
  }

  // GATE DE VALIDACIÓN DEL MÁSTER (Yokup #3199, 12-sep-2026). Antes de subir
  // nada se reproduce el blob en un <video> oculto, se muestrean ≥12 fotogramas
  // repartidos y se mide luma media y varianza de cada uno. Si más del 70 % son
  // negros (luma < 16 y varianza baja), dura < 10 s o no hay pista de vídeo,
  // NO se publica. Además se elige el fotograma con más información como póster
  // (JPEG 540×960): el frame 0 del máster es el relleno #020508 con el que se
  // siembra el canvas antes de captureStream(), y era lo que el catálogo de
  // admira.tv enseñaba en negro con el «Langostino cocido».
  // Sin validador cargado no se publica: la regla es «prueba antes de publicar».
  async function validarMaster(blob, duracionEsperada, dimensiones){
    const V = window.AdmiraValidacionVideo;
    if(!V) return {validacion:{ok:false, negros:0, muestras:0, duracion:null, motivo:'validador de vídeo no cargado (assets/tiktok-validacion.js)'}, poster:null, posterT:null, muestras:[]};
    try{
      // Póster con la orientación del máster: 540×960 en vertical, 960×540 en horizontal.
      const horizontal = dimensiones && dimensiones.w > dimensiones.h;
      return await V.muestrearVideo(blob, {duracionEsperada, muestras:12, posterW:horizontal ? 960 : 540, posterH:horizontal ? 540 : 960});
    }catch(error){
      return {validacion:{ok:false, negros:0, muestras:0, duracion:null, motivo:`no se pudo analizar el máster (${error?.message || error})`}, poster:null, posterT:null, muestras:[]};
    }
  }
  function registrarMasterInvalido(analisis, duracionEsperada){
    const v = analisis.validacion || {};
    const registro = {
      at:new Date().toISOString(), motivo:v.motivo, negros:v.negros, muestras:v.muestras, duracion:v.duracion, esperada:duracionEsperada,
      ficha:fichaActiva()?.externalId || null, lumas:(analisis.muestras || []).map(m => Math.round(m.luma))
    };
    console.warn('tiktok:master-invalido', JSON.stringify(registro));
    try{
      const lista = JSON.parse(localStorage.getItem('admiranext.tiktok.masters-invalidos') || '[]');
      lista.unshift(registro);
      localStorage.setItem('admiranext.tiktok.masters-invalidos', JSON.stringify(lista.slice(0, 20)));
    }catch(_){ /* sin registro local */ }
  }

  function drawVideoCover(ctx, video) {
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;
    const sourceWidth = video.videoWidth || 1080;
    const sourceHeight = video.videoHeight || 1920;
    const scale = Math.max(width / sourceWidth, height / sourceHeight);
    const drawWidth = sourceWidth * scale;
    const drawHeight = sourceHeight * scale;
    ctx.fillStyle = '#020508';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(video, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
  }

  function drawRollFrame(ctx, kind, seconds, text) {
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;
    const outgoing = kind === 'post';
    const accent = outgoing ? '#bd86ff' : '#65e9f4';
    const secondary = outgoing ? '#65e9f4' : '#ff7a30';
    const local = Math.max(0, Math.min(1, seconds / 5));
    const pulse = 0.5 + Math.sin(seconds * 3.2) * 0.5;
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#081722');
    gradient.addColorStop(0.58, '#05090d');
    gradient.addColorStop(1, outgoing ? '#170c22' : '#102029');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    ctx.save();
    ctx.globalAlpha = 0.1 + pulse * 0.08;
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    const offset = (seconds * 46) % 90;
    for(let y = -90 + offset; y < height + 90; y += 90){ ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }
    for(let x = 0; x < width; x += 90){ ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); }
    ctx.restore();
    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.rotate(seconds * (outgoing ? -0.08 : 0.08));
    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = accent;
    ctx.lineWidth = 5;
    ctx.strokeRect(-360 - local * 30, -360 - local * 30, 720 + local * 60, 720 + local * 60);
    ctx.restore();

    ctx.textAlign = 'center';
    ctx.fillStyle = secondary;
    ctx.font = '900 24px ui-monospace, monospace';
    ctx.fillText(outgoing ? 'POSTROLL · 05S' : 'PREROLL · 05S', width / 2, 330);
    ctx.fillStyle = '#eef8fa';
    ctx.font = '900 78px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    const lines = wrapLines(ctx, text, width - 180, 4);
    const firstY = height / 2 - ((lines.length - 1) * 48);
    lines.forEach((line, index) => ctx.fillText(line, width / 2, firstY + index * 94));
    ctx.fillStyle = accent;
    ctx.font = '900 23px ui-monospace, monospace';
    ctx.fillText(outgoing ? '@ADmiraNeXT · PIXERIA' : 'ADmiraNeXT · CREATIVE STUDIO', width / 2, height - 260);
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(74, height - 165, width - 148, 5);
    ctx.fillStyle = accent;
    ctx.fillRect(74, height - 165, (width - 148) * local, 5);
  }

  async function retryPackagePublication() {
    if(!packageId) return;
    composeGrokPackage.disabled = true;
    packageStatus.textContent = 'Reintentando la publicación del master final en Pixeria…';
    try{
      const response = await fetch('/presentaciones/api/video-package', {
        method:'PUT', credentials:'same-origin',
        headers:{'content-type':'application/json', accept:'application/json'},
        body:JSON.stringify({id:packageId})
      });
      const payload = await readApiResponse(response, 'No se pudo reintentar la publicación del máster final en Pixeria.');
      if(payload.pixeria?.status !== 'published') throw new Error(payload.pixeria?.error || 'Pixeria todavía no ha podido guardar el master.');
      finishPackagePublication(payload);
    }catch(error){
      packageStatus.textContent = error.message || 'Pixeria no respondió. Puedes volver a intentarlo.';
      composeGrokPackage.textContent = 'Reintentar Pixeria';
      composeGrokPackage.disabled = false;
    }
  }

  function finishPackagePublication(payload) {
    packageId = payload.id || packageId;
    packageOutput.classList.add('is-published');
    packageStatus.textContent = `Master final de ${payload.duration || 25} segundos ${payload.pixeria?.reutilizado ? 'ya estaba en Pixeria (idéntico, no se ha duplicado)' : 'publicado en Pixeria'}${payload.pixeria?.id ? ` · ${payload.pixeria.id}` : ''}${payload.pixeria?.sustituye ? ' · sustituye a la pieza anterior con la misma identidad (sin duplicados)' : ''}.`;
    openPackageAsset.href = payload.pixeria?.stockUrl || 'https://www.pixeria.com/stock.html';
    openPackageAsset.hidden = false;
    // Pieza de catálogo (Yokup #3183): se enseñan los hashtags con los que ha
    // salido y el enlace a la opción «Catálogo» del Stock, que la agrupa con
    // el resto de piezas del mismo folleto para asignarlas a players.
    const ficha = fichaActiva();
    const catalogo = ficha?.catalogo || null;
    if(packageTags){
      packageTags.textContent = ficha?.tags?.length ? `Publicado con ${ficha.tags.map(t => `#${t}`).join(' ')}` : '';
      packageTags.hidden = !packageTags.textContent;
    }
    if(openStockCatalogo){
      openStockCatalogo.href = urlStockCatalogo(catalogo) || '#';
      openStockCatalogo.hidden = !catalogo;
    }
    composeGrokPackage.textContent = 'Publicado en Pixeria';
    composeGrokPackage.disabled = true;
    packageProgress.hidden = false;
    packageProgress.firstElementChild.style.width = '100%';
  }

  // Si el máster con rótulo no se puede montar en este navegador (autoplay,
  // MediaRecorder, canvas sucio…), la pieza no se queda fuera del Stock: se
  // publica el vídeo bruto tal cual con la identidad EXACTA del encargo
  // (admiranext:xtore:<lane>), avisando de que va sin rótulo, para que la regla
  // del player la enganche igual. El siguiente máster con rótulo la sustituye.
  async function publicarBrutoSinRotulo(motivo) {
    const ficha = fichaActiva();
    const razon = core.clean(motivo, 200) || 'el máster no se pudo montar';
    if(!flujoCatalogo || !ficha?.externalId || !grokVideoUrl){
      terminarFlujoCatalogo(`${razon}. Pulsa “Montar y publicar” para repetir el máster.`, 'error');
      return false;
    }
    setCatalogStatus(`3/3 · El máster no se pudo montar (${razon}). Publicando el vídeo bruto SIN rótulo como «${ficha.externalId}»…`);
    try{
      const origen = await fetch(grokVideoUrl, {mode:'cors'});
      if(!origen.ok) throw new Error(`no se pudo leer el vídeo bruto (${origen.status})`);
      const blob = await origen.blob();
      if(blob.size < 1024) throw new Error('el vídeo bruto llegó vacío');
      const tipo = ['video/mp4', 'video/webm', 'video/quicktime'].includes(blob.type) ? blob.type : 'video/mp4';
      const fichaBruto = {
        ...ficha,
        title:core.clean(`${ficha.title} · sin rótulo`, 200),
        comment:core.clean(`SIN RÓTULO (el máster no se montó: ${razon}). ${ficha.comment}`, 1200)
      };
      const response = await fetch('/presentaciones/api/video-package', {
        method:'POST', credentials:'same-origin',
        headers:{
          'content-type':tipo, accept:'application/json',
          'x-client-request-id':crypto.randomUUID(),
          'x-package-title':encodeURIComponent(fichaBruto.title),
          'x-package-ficha':encodeURIComponent(JSON.stringify(fichaBruto))
        },
        body:blob
      });
      const payload = await readApiResponse(response, 'No se pudo publicar el vídeo bruto.');
      if(payload.pixeria?.status !== 'published') throw new Error(payload.pixeria?.error || 'Pixeria no guardó el bruto.');
      packageId = payload.id || packageId;
      finishPackagePublication(payload);
      terminarFlujoCatalogo(`Publicado SIN rótulo como «${ficha.externalId}» (${payload.pixeria.id}): la regla del player ya lo encuentra. Cuando quieras el rótulo, vuelve a pulsar «Generar anuncio».`, 'success');
      return true;
    }catch(error){
      terminarFlujoCatalogo(`Ni el máster ni el bruto llegaron al Stock: ${error?.message || error}. Pulsa “Montar y publicar” para reintentar.`, 'error');
      return false;
    }
  }

  async function composeAndPublishGrokPackage() {
    if(packageId && composeGrokPackage.textContent.includes('Reintentar')) return retryPackagePublication();
    if(!grokVideoUrl || !window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream){
      packageStatus.textContent = 'Este navegador no puede montar el vídeo final. Prueba con Chrome, Edge o Safari actualizado.';
      if(flujoCatalogo) void publicarBrutoSinRotulo('este navegador no puede montar el máster');
      return;
    }
    composeGrokPackage.disabled = true;
    openPackageAsset.hidden = true;
    if(openStockCatalogo) openStockCatalogo.hidden = true;
    if(packageTags) packageTags.hidden = true;
    packageProgress.hidden = false;
    packageProgress.firstElementChild.style.width = '0%';
    // Lienzo del máster según el formato del encargo (FLT-100372): 1080×1920
    // (vertical, el de siempre) o 1920×1080 (horizontal). Sin encargo, vertical.
    const dimensiones = encargoActivo() ? dimensionesFormato() : FORMATOS_ANUNCIO['9:16'];
    packageStatus.textContent = `Preparando el master ${dimensiones.nombre}…`;
    const before = preRollEnabled.checked ? 5 : 0;
    const after = postRollEnabled.checked ? 5 : 0;
    const totalDuration = before + 15 + after;
    const canvas = document.createElement('canvas');
    canvas.width = dimensiones.w;
    canvas.height = dimensiones.h;
    const ctx = canvas.getContext('2d', {alpha:false});
    // Seed the canvas before captureStream(). Chrome can otherwise anchor the
    // first encoded video timestamp when the 15s source begins playing and
    // silently drop the whole preroll interval.
    if(before){
      drawRollFrame(ctx, 'pre', 0, core.clean(preRollTitle.value, 90) || 'ADmiraNeXT presenta');
    }else{
      ctx.fillStyle = '#020508';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    const stream = canvas.captureStream(30);
    let capturedVideoStream = null;
    let recorder = null;
    let packageAudioContext = null;
    let packageAudioClock = null;
    try{
      if(grokVideo.readyState < 2) await waitForMedia(grokVideo, 'loadeddata');
      grokVideo.currentTime = 0;
      await grokVideo.play();
      grokVideo.pause();
      if(typeof grokVideo.captureStream === 'function'){
        capturedVideoStream = grokVideo.captureStream();
        const capturedAudioTracks = capturedVideoStream.getAudioTracks();
        const AudioCtor = window.AudioContext || window.webkitAudioContext;
        if(AudioCtor){
          // MediaRecorder can discard canvas frames produced before the first
          // audio timestamp and truncate again when the source video's audio
          // ends. A silent, continuous Web Audio clock keeps the muxer's
          // timeline alive for preroll + main video + postroll.
          packageAudioContext = new AudioCtor();
          await packageAudioContext.resume();
          const destination = packageAudioContext.createMediaStreamDestination();
          packageAudioClock = packageAudioContext.createOscillator();
          const silentGain = packageAudioContext.createGain();
          silentGain.gain.value = 0;
          packageAudioClock.connect(silentGain).connect(destination);
          packageAudioClock.start();
          if(capturedAudioTracks.length){
            const sourceStream = new MediaStream(capturedAudioTracks);
            packageAudioContext.createMediaStreamSource(sourceStream).connect(destination);
          }
          destination.stream.getAudioTracks().forEach(track => stream.addTrack(track));
        }else{
          capturedAudioTracks.forEach(track => stream.addTrack(track));
        }
      }
      const mimeType = supportedMime();
      recorder = new MediaRecorder(stream, mimeType ? {mimeType, videoBitsPerSecond:6500000} : {videoBitsPerSecond:6500000});
      const chunks = [];
      recorder.ondataavailable = event => { if(event.data?.size) chunks.push(event.data); };
      const completed = new Promise((resolve, reject) => {
        recorder.onstop = resolve;
        recorder.onerror = () => reject(recorder.error || new Error('No se pudo codificar el master final.'));
      });
      const started = performance.now();
      let mainStarted = false;
      let active = true;
      function render(now){
        if(!active) return;
        const elapsed = Math.min(totalDuration, (now - started) / 1000);
        if(elapsed < before){
          drawRollFrame(ctx, 'pre', elapsed, core.clean(preRollTitle.value, 90) || 'ADmiraNeXT presenta');
        }else if(elapsed < before + 15){
          if(!mainStarted){
            mainStarted = true;
            grokVideo.currentTime = 0;
            void grokVideo.play().catch(() => {});
          }
          drawVideoCover(ctx, grokVideo);
        }else{
          if(!grokVideo.paused) grokVideo.pause();
          drawRollFrame(ctx, 'post', elapsed - before - 15, core.clean(postRollCta.value, 90) || plan.brief.cta || 'Descúbrelo hoy');
        }
        drawOverlayEncargo(ctx, elapsed);
        const percent = Math.round((elapsed / totalDuration) * 90);
        packageProgress.firstElementChild.style.width = `${percent}%`;
        packageStatus.textContent = `Montando ${totalDuration}s · ${percent}%`;
        if(elapsed >= totalDuration){
          active = false;
          window.setTimeout(() => recorder.stop(), 180);
        }else requestAnimationFrame(render);
      }
      recorder.start(1000);
      requestAnimationFrame(render);
      await completed;
      const finalType = recorder.mimeType || mimeType || 'video/webm';
      const extension = finalType.includes('mp4') ? 'mp4' : 'webm';
      const blob = new Blob(chunks, {type:finalType});
      if(blob.size < 1024) throw new Error('El master final quedó vacío. Vuelve a intentarlo.');
      packageStatus.textContent = 'Validando el máster (fotogramas, luma, duración)…';
      packageProgress.firstElementChild.style.width = '91%';
      const analisis = await validarMaster(blob, totalDuration, dimensiones);
      if(!analisis.validacion.ok){
        registrarMasterInvalido(analisis, totalDuration);
        packageStatus.textContent = `${analisis.validacion.motivo}. No se ha publicado nada: pulsa «Rehacer montaje».`;
        composeGrokPackage.textContent = 'Rehacer montaje';
        composeGrokPackage.disabled = false;
        packageProgress.firstElementChild.style.width = '0%';
        if(flujoCatalogo) terminarFlujoCatalogo(`Máster rechazado (${analisis.validacion.motivo}). Nada se ha publicado; pulsa «Rehacer montaje».`, 'error');
        return;
      }
      if(packageBlobUrl) URL.revokeObjectURL(packageBlobUrl);
      packageBlobUrl = URL.createObjectURL(blob);
      downloadGrokPackage.href = packageBlobUrl;
      downloadGrokPackage.download = `${core.fileSlug(plan.brief.task)}-${totalDuration}s${dimensiones.w > dimensiones.h ? '-16x9' : ''}.${extension}`;
      downloadGrokPackage.hidden = false;
      packageStatus.textContent = 'Montaje terminado. Subiendo el master final y publicándolo en Pixeria…';
      packageProgress.firstElementChild.style.width = '94%';
      const clientRequestId = crypto.randomUUID();
      // Póster representativo + veredicto → ANTES del máster, para que el Stock
      // los reciba en el mismo publish (Yokup #3199). Si esta llamada falla, el
      // máster se publica igual y el catálogo captura el fotograma en cliente.
      try{
        await fetch('/presentaciones/api/video-package', {
          method:'PATCH', credentials:'same-origin',
          headers:{'content-type':'application/json', accept:'application/json'},
          body:JSON.stringify({clientRequestId, poster:analisis.poster || '', posterAt:analisis.posterT, validacion:analisis.validacion})
        });
      }catch(_){ /* el póster es deseable, no imprescindible para publicar */ }
      const headers = {
        'content-type':finalType,
        accept:'application/json',
        'x-client-request-id':clientRequestId,
        'x-package-title':encodeURIComponent(fichaActiva() ? fichaActiva().title : `${plan.brief.task} · ${totalDuration}s`)
      };
      if(fichaActiva()) headers['x-package-ficha'] = encodeURIComponent(JSON.stringify(fichaActiva()));
      const response = await fetch('/presentaciones/api/video-package', {
        method:'POST', credentials:'same-origin',
        headers,
        body:blob
      });
      const payload = await readApiResponse(response, 'No se pudo guardar el máster final de 25 segundos.');
      packageId = payload.id || '';
      if(payload.pixeria?.status === 'published'){
        finishPackagePublication(payload);
        if(flujoCatalogo) terminarFlujoCatalogo(productoCatalogo ? `Anuncio ${dimensiones.nombre} publicado en el Stock con el precio en pantalla.${colaFormatos.length ? '' : ' Ya puedes volver al catálogo.'}` : `Anuncio publicado en el Stock como «${briefCampana?.externalId || 'brief'}». El player lo engancha por esa identidad.`, 'success');
      }else{
        packageStatus.textContent = payload.pixeria?.error || 'El master está guardado en ADmiraNeXT, pero Pixeria todavía no lo ha incorporado.';
        composeGrokPackage.textContent = 'Reintentar Pixeria';
        composeGrokPackage.disabled = false;
        if(flujoCatalogo) void publicarBrutoSinRotulo(packageStatus.textContent);
      }
    }catch(error){
      packageStatus.textContent = error.message || 'No se pudo montar el master final.';
      composeGrokPackage.textContent = 'Volver a montar 25s';
      composeGrokPackage.disabled = false;
      if(flujoCatalogo) void publicarBrutoSinRotulo(packageStatus.textContent);
    }finally{
      if(!grokVideo.paused) grokVideo.pause();
      stream.getTracks().forEach(track => track.stop());
      capturedVideoStream?.getTracks().forEach(track => track.stop());
      if(packageAudioClock){ try{ packageAudioClock.stop(); }catch(_){ /* Already stopped. */ } }
      if(packageAudioContext){ try{ await packageAudioContext.close(); }catch(_){ /* Best effort. */ } }
    }
  }

  async function exportClip() {
    if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) {
      exportStatus.textContent = 'Este navegador no puede codificar vídeo. El plan JSON y el guion siguen disponibles.';
      return;
    }
    if ('speechSynthesis' in window && speechSynthesis.speaking) speechSynthesis.cancel();
    exportVideo.disabled = true;
    exportStatus.textContent = 'Preparando el lienzo vertical…';

    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext('2d', { alpha: false });
    const stream = canvas.captureStream(30);
    let audioContext = null;
    let oscillator = null;
    let toneGain = null;

    try {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (AudioCtor) {
        audioContext = new AudioCtor();
        await audioContext.resume();
        const destination = audioContext.createMediaStreamDestination();
        oscillator = audioContext.createOscillator();
        toneGain = audioContext.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.value = 92;
        toneGain.gain.value = 0.018;
        oscillator.connect(toneGain).connect(destination);
        oscillator.start();
        destination.stream.getAudioTracks().forEach((track) => stream.addTrack(track));
      }

      const mimeType = supportedMime();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType, videoBitsPerSecond: 6500000 } : { videoBitsPerSecond: 6500000 });
      const chunks = [];
      recorder.ondataavailable = (event) => { if (event.data && event.data.size) chunks.push(event.data); };
      const completed = new Promise((resolve, reject) => {
        recorder.onstop = resolve;
        recorder.onerror = () => reject(recorder.error || new Error('No se pudo codificar el vídeo.'));
      });
      const exportStart = performance.now();
      let active = true;

      function renderExport(now) {
        if (!active) return;
        const elapsed = Math.min(plan.duration, (now - exportStart) / 1000);
        if (oscillator && audioContext) {
          const frequency = elapsed < 3 ? 132 : elapsed < 11 ? 92 : 176;
          oscillator.frequency.setTargetAtTime(frequency, audioContext.currentTime, 0.08);
          toneGain.gain.setTargetAtTime(elapsed > 14.6 ? 0 : 0.018, audioContext.currentTime, 0.08);
        }
        drawFrame(ctx, plan, elapsed);
        exportStatus.textContent = `Generando vídeo… ${Math.min(100, Math.round((elapsed / plan.duration) * 100))}%`;
        if (elapsed >= plan.duration) {
          active = false;
          window.setTimeout(() => recorder.stop(), 180);
        } else requestAnimationFrame(renderExport);
      }

      recorder.start(1000);
      requestAnimationFrame(renderExport);
      await completed;
      const finalType = recorder.mimeType || mimeType || 'video/webm';
      const extension = finalType.includes('mp4') ? 'mp4' : 'webm';
      const blob = new Blob(chunks, { type: finalType });
      const filename = `${core.fileSlug(plan.brief.task)}-15s.${extension}`;
      downloadBlob(blob, filename);
      const preparado = await guardarParaTester(blob, filename).catch(() => false);
      if (openTester) openTester.hidden = !preparado;
      exportStatus.textContent = preparado
        ? `Vídeo descargado en ${extension.toUpperCase()} y preparado para probarlo en los formatos de digital signage.`
        : `Vídeo descargado en ${extension.toUpperCase()}. Incluye animación, subtítulos y base sonora; la locución queda en el guion.`;
    } catch (error) {
      exportStatus.textContent = error && error.message ? error.message : 'No se pudo generar el vídeo en este navegador.';
    } finally {
      stream.getTracks().forEach((track) => track.stop());
      if (oscillator) { try { oscillator.stop(); } catch (_) { /* Already stopped. */ } }
      if (audioContext) { try { await audioContext.close(); } catch (_) { /* Best effort. */ } }
      exportVideo.disabled = false;
    }
  }

  adIdeaForm.addEventListener('submit', createAdIdea);
  adIdeaForm.addEventListener('input', (event) => {
    adIdeaAccess.hidden = true;
    if(event.target === adIdeaInput) syncAdIdeaAgentMode(true);
  });
  developAdButton.addEventListener('click', () => { void developAdIdea(); });
  form.addEventListener('submit', (event) => { event.preventDefault(); variation = 0; generate(); });
  form.addEventListener('input', saveDraft);
  $('#variationButton').addEventListener('click', () => { variation = (variation + 1) % 3; generate(); });
  $('#loadExample').addEventListener('click', () => { clearContentSource(); writeForm(example); variation = 0; generate(); });
  loadContentSource.addEventListener('click', () => { void loadBriefFromSource(); });
  contentSourceUrl.addEventListener('keydown', event => {
    if(event.key === 'Enter'){event.preventDefault(); void loadBriefFromSource();}
  });
  contentSourceUrl.addEventListener('input', () => {
    if(contentSource?.source?.url && contentSourceUrl.value.trim() !== contentSource.source.url){
      contentSource = null;
      saveContentSource();
      renderContentSource();
      setSourceMessage('URL modificada. Pulsa “Preparar resumen” para actualizar el brief.');
    }
  });
  $('#restartPreview').addEventListener('click', restart);
  playPause.addEventListener('click', () => {
    playing = !playing;
    if (playing) startedAt = performance.now() - pausedAt * 1000;
    playPause.textContent = playing ? 'Pausar' : 'Reproducir';
  });
  $('#copyScript').addEventListener('click', (event) => copyText(plan.script, event.currentTarget, 'Copiar guion'));
  $('#downloadPlan').addEventListener('click', downloadPlan);
  voiceButton.addEventListener('click', speakPlan);
  exportVideo.addEventListener('click', exportClip);
  modeInputs.forEach((input) => input.addEventListener('change', () => setProductionMode(selectedProductionMode())));
  generateGrokButton.addEventListener('click', () => { void startGrokVideo(); });
  retryPixeria.addEventListener('click', () => { void retryPixeriaPublication(); });
  referenceVideo.addEventListener('change', () => { void selectReferenceVideo(); });
  referenceModeInputs.forEach(input => input.addEventListener('change', changeReferenceMode));
  loadReferenceUrl.addEventListener('click', () => { void loadReferenceFromUrl(); });
  referenceUrl.addEventListener('keydown', event => {
    if(event.key === 'Enter'){ event.preventDefault(); void loadReferenceFromUrl(); }
  });
  analyzeReference.addEventListener('click', () => { void analyzeReferenceVideo(); });
  clearReference.addEventListener('click', () => clearReferenceVideo(true));
  composeGrokPackage.addEventListener('click', () => { void composeAndPublishGrokPackage(); });
  copyGrokUrl.addEventListener('click', () => copyText(grokVideoUrl, copyGrokUrl, 'Copiar URL'));
  exportStoryboard.addEventListener('click', exportarStoryboard);
  prepareMeta.addEventListener('click', prepararMeta);
  metaVideo.addEventListener('change', (e) => traerVideoMeta(e.target.files && e.target.files[0]));
  reduceMotion.addEventListener('change', restart);
  window.addEventListener('beforeunload', () => {
    cancelAnimationFrame(animationFrame);
    window.clearTimeout(grokPollTimer);
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    if(referenceObjectUrl) URL.revokeObjectURL(referenceObjectUrl);
    if(packageBlobUrl) URL.revokeObjectURL(packageBlobUrl);
  });

  adDate.value = todayValue();
  syncAdIdeaAgentMode(false);
  loadAdIdeas();
  renderAdIdeas();
  loadDraft();
  restoreContentSource();
  loadReferenceProfile();
  generate();
  renderFichaProducto();
  renderFichaBrief();
  setProductionMode(selectedProductionMode());
  // Un trabajo pendiente solo se retoma si es de este mismo encargo (o no hay
  // encargo): otra pestaña con otro producto tiene el suyo y no se pisan.
  const pendingGrokJob = loadGrokJob();
  const fichaAlCargar = fichaActiva();
  const retomable = pendingGrokJob && (!fichaAlCargar || !pendingGrokJob.externalId || (fichaAlCargar.externalId === pendingGrokJob.externalId || String(pendingGrokJob.externalId).startsWith(`${fichaAlCargar.externalId.replace(/:16x9$/, '')}`)));
  if(retomable){
    grokRequestId = pendingGrokJob.requestId;
    const grokMode = modeInputs.find((input) => input.value === 'grok');
    if(grokMode) grokMode.checked = true;
    if(typeof pendingGrokJob.prompt === 'string') grokPrompt.value = pendingGrokJob.prompt;
    if(['480p','720p','1080p'].includes(pendingGrokJob.resolution)) grokResolution.value = pendingGrokJob.resolution;
    if(FORMATOS_ANUNCIO[pendingGrokJob.formato]) formatoActual = pendingGrokJob.formato;
    if(Array.isArray(pendingGrokJob.cola)) colaFormatos = pendingGrokJob.cola.filter(f => FORMATOS_ANUNCIO[f]);
    setProductionMode('grok');
    generateGrokButton.disabled = true;
    setGrokJob('Recuperando generación', 8, 'Retomando el seguimiento del vídeo iniciado anteriormente…');
    scheduleGrokPoll(pendingGrokJob.requestId, 500);
  }
  // Arranque automático desde el catálogo (FLT-100372): con la sesión abierta
  // por el pase (o sin pase, si ya había sesión), el flujo de un clic arranca
  // solo. Si el pase falló, se queda el aviso con el enlace de login y NO se
  // encarga nada. Si ya se está retomando un trabajo de este encargo, tampoco.
  void abrirSesionConPase().then(resultado => {
    if(!arranqueAuto || !encargoActivo()) return;
    if(resultado === false) return;
    if(retomable){ setCatalogStatus('Este anuncio ya se estaba generando: se retoma donde estaba.'); return; }
    window.setTimeout(() => { void generarAnuncioCatalogo(); }, 400);
  });
  animationFrame = requestAnimationFrame(tick);

  const requestedSource = new URLSearchParams(window.location.search).get('source');
  if(requestedSource && (!contentSource || requestedSource !== contentSource.source?.url)){
    if(contentSource) clearContentSource(false);
    contentSourceUrl.value = requestedSource;
    void loadBriefFromSource();
  }
})();
