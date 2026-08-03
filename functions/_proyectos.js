/*
 * EL CENSO — la única lista de proyectos del ecosistema.
 *
 * Antes había tres listas del mismo asunto y ninguna se enteraba de las otras:
 * la tabla de /webmaster (nombre, versión, repo, comando), las fichas de puntos
 * de retorno (con las etiquetas copiadas a mano) y el mapa PROYECTOS de
 * /api/historial. Resultado previsible: admiraxperience tenía historial pero no
 * fila desde la que abrirlo, el worker yokup-rtc enseñaba el historial del sitio
 * yokup, y las versiones se quedaban viejas en cuanto alguien publicaba —el
 * mismo día 3 de agosto, la tabla decía de yokup r14 y la portada ya iba por r7
 * del día siguiente.
 *
 * Ahora se declara aquí y una sola vez. Dar de alta un proyecto es añadir un
 * objeto a esta lista: aparece solo en la tabla, en su ficha y en el historial.
 *
 * Lo que NO se escribe aquí, porque se lee vivo:
 *   · la versión en producción → del sello de la portada (ver api/proyectos.js)
 *   · los puntos de retorno    → de las etiquetas del repositorio (GitHub)
 *   · los snapshots            → de los despliegues de Cloudflare Pages
 *
 * Campos:
 *   clave     identificador estable — lo usan /api/historial y /api/proyectos
 *   nombre    cómo se llama de cara a la gente
 *   url       portada pública; null si no tiene web que mirar (workers)
 *   estadoUrl portada cuyo sello/firma gobierna el despliegue; por defecto url
 *             (útil para subsoluciones que comparten release con su sitio padre)
 *   parentKey clave del proyecto padre; vacío/null significa proyecto raíz
 *   repo      owner/repo en GitHub
 *   privado   true si el repositorio no es público (hace falta GITHUB_TOKEN)
 *   repoTxt   cómo se enseña el repositorio en la tabla (p.ej. subcarpeta)
 *   pages     proyecto de Cloudflare Pages, o null si no vive ahí
 *   publica   el comando con el que se publica, tal cual se teclea
 *   tipo      'sitio' | 'worker'
 *   shot      miniatura de la portada, o null
 *   nota      la trampa concreta de este proyecto, si la tiene
 */

export const PROYECTOS = [
  {
    clave: 'admiranext', nombre: 'admiranext.com', url: 'https://www.admiranext.com',
    repo: 'csilvasantin/admira-next-web', repoTxt: 'admira-next-web',
    pages: 'admiranext', publica: './deploy.sh → Pages admiranext',
    tipo: 'sitio', shot: '/webmaster-shots/admiranext.jpg',
  },
  {
    clave: 'admiranext-webmaster', nombre: 'AdmiraNeXT Webmaster',
    url: 'https://www.admiranext.com/webmaster',
    estadoUrl: 'https://www.admiranext.com',
    parentKey: 'admiranext',
    repo: 'csilvasantin/admira-next-web', repoTxt: 'admira-next-web · webmaster',
    pages: 'admiranext', publica: './deploy.sh → Pages admiranext',
    tipo: 'sitio', shot: null,
    nota: 'Subproyecto interno de AdmiraNeXT: inventario, releases, responsables y puntos de retorno. Requiere sesión Google autorizada.',
  },
  {
    clave: 'generador-presupuestos', nombre: 'Generador de Presupuestos',
    url: 'https://www.admiranext.com/presupuestos/',
    estadoUrl: 'https://www.admiranext.com',
    parentKey: 'admiranext',
    repo: 'csilvasantin/admira-next-web', repoTxt: 'admira-next-web · presupuestos/',
    pages: 'admiranext', publica: './deploy.sh → Pages admiranext',
    tipo: 'sitio', shot: null,
    nota: 'Subsolución de AdmiraNeXT: abre /presupuestos/ y comparte despliegue, sello y firma con admiranext.com.',
  },
  {
    clave: 'yokup', nombre: 'yokup.com', url: 'https://yokup.com',
    repo: 'csilvasantin/tool', repoTxt: 'tool · yokup-site/',
    pages: 'yokup', publica: 'cd yokup-site && wrangler pages deploy .',
    tipo: 'sitio', shot: '/webmaster-shots/yokup.jpg',
  },
  {
    clave: 'pixeria', nombre: 'pixeria.com', url: 'https://www.pixeria.com',
    repo: 'csilvasantin/pixeria', repoTxt: 'pixeria',
    pages: 'pixeria', publica: './deploy.sh → Pages pixeria',
    tipo: 'sitio', shot: '/webmaster-shots/pixeria.jpg',
  },
  {
    clave: 'xpaceos', nombre: 'xpaceos.com', url: 'https://www.xpaceos.com',
    repo: 'csilvasantin/xpaceos', repoTxt: 'xpaceos',
    pages: null, publica: 'git push (GitHub Pages)',
    tipo: 'sitio', shot: '/webmaster-shots/xpaceos.jpg',
  },
  {
    clave: 'admira-live', nombre: 'admira.live', url: 'https://www.admira.live',
    repo: 'csilvasantin/32.-ConsejoAdmiraNextGame', repoTxt: '32.-ConsejoAdmiraNextGame',
    pages: 'admira-live', publica: './deploy.sh → Pages admira-live',
    tipo: 'sitio', shot: '/webmaster-shots/admira-live.jpg',
  },
  {
    clave: 'admira-studio', nombre: 'admira.studio', url: 'https://www.admira.studio',
    repo: 'csilvasantin/admira-studio', repoTxt: 'admira-studio',
    pages: null, publica: 'git push (GitHub Pages)',
    tipo: 'sitio', shot: '/webmaster-shots/admira-studio.jpg',
    nota: 'Lleva dentro el deploy.sh de pixeria, que publica en pixeria.com. Nunca ejecutarlo: admira.studio se publica con git push.',
  },
  {
    clave: 'admira-store', nombre: 'admira.store', url: 'https://admira.store',
    repo: 'csilvasantin/admira-store', repoTxt: 'admira-store',
    pages: 'admira-store', publica: './deploy.sh',
    tipo: 'sitio', shot: '/webmaster-shots/admira-store.jpg',
  },
  {
    clave: 'admira-tv', nombre: 'admira.tv', url: 'https://admira.tv',
    repo: 'csilvasantin/admira-tv', repoTxt: 'admira-tv',
    pages: 'admira-tv', publica: './deploy.sh → Pages + wrangler.toml',
    tipo: 'sitio', shot: '/webmaster-shots/admira-tv.jpg',
  },

  // ── Las 20 subsoluciones de admira.tv ────────────────────────────────────
  // Son las mismas veinte que la portada de admira.tv explica y enumera
  // (`apps/public-catalog.json`), cada una con su propia dirección pública.
  // No se publican por separado: viven en el mismo repositorio y salen a
  // producción en el mismo despliegue que su sitio padre, así que comparten
  // sello, firma y punto de retorno. De ahí `estadoUrl: https://admira.tv`
  // —la tabla abre la subsolución, pero verifica la versión donde de verdad
  // se publica— y de ahí que `publica` repita el comando del padre: es el
  // único que las pone en el aire.
  ...[
    ['dashboard',           'Dashboard',              'Reúne rendimiento, contenidos y resultados para entender la actividad de un vistazo.'],
    ['digitalsignage',      'Señalización',           'Planifica y publica contenidos en pantallas, desde una ubicación hasta una red completa.'],
    ['contentcatalogue',    'Catálogo de contenidos', 'Organiza creatividades y campañas para encontrar, reutilizar y distribuir cada pieza con rapidez.'],
    ['support',             'Soporte',                'Centraliza ayuda, seguimiento y resolución para mantener cada experiencia disponible.'],
    ['pushnotifications',   'Notificaciones',         'Activa avisos relevantes para equipos y audiencias en el momento adecuado.'],
    ['virtualassistant',    'Asistente virtual',      'Responde preguntas, orienta al visitante y acompaña tareas mediante conversación natural.'],
    ['adcelerate',          'ADcelerate',             'Conecta segmentación, inventario y activación publicitaria para aprovechar mejor cada pantalla.'],
    ['gamification',        'Gamificación',           'Convierte interacciones en retos y recompensas que aumentan participación y recuerdo.'],
    ['iotmanager',          'IoT Manager',            'Conecta pantallas, players y sensores para coordinar el espacio como un sistema único.'],
    ['videoanalytics',      'Analítica de vídeo',     'Mide atención y comportamiento de forma agregada para mejorar contenidos y espacios.'],
    ['radioanalytics',      'Analítica de radio',     'Estima afluencia mediante señales anónimas para comprender patrones de visita.'],
    ['socialwifi',          'Social WiFi',            'Ofrece conectividad de invitados y convierte cada acceso consentido en una relación útil.'],
    ['queuemanager',        'Gestión de colas',       'Ordena turnos y tiempos de espera para hacer la atención más fluida y previsible.'],
    ['roombooking',         'Reserva de salas',       'Permite descubrir y reservar espacios disponibles sin fricción ni dobles asignaciones.'],
    ['audiobranding',       'Audiobranding',          'Diseña una identidad sonora coherente para acompañar cada momento de la experiencia.'],
    ['olfactorymarketing',  'Marketing olfativo',     'Integra el aroma como canal de marca para crear ambientes reconocibles y memorables.'],
    ['virtualreality',      'Realidad virtual',       'Crea experiencias inmersivas para explorar productos, historias y espacios imposibles.'],
    ['augmentedreality',    'Realidad aumentada',     'Superpone información e interacción digital sobre productos y entornos físicos.'],
    ['xpaceos',             'XpaceOS · Gemelo digital', 'Representa el espacio como un gemelo digital para coordinar contenido, contexto y operación. No confundir con el sitio xpaceos.com, que es otro proyecto con su propio repositorio y despliegue.'],
    ['yarig',               'Yarig.ai · Team Building', 'Convierte la colaboración del equipo en una experiencia compartida impulsada por IA.'],
  ].map(([slug, nombre, quePasa]) => ({
    clave: `admira-tv-${slug}`, nombre,
    url: `https://admira.tv/${slug}/`,
    estadoUrl: 'https://admira.tv',
    parentKey: 'admira-tv',
    repo: 'csilvasantin/admira-tv', repoTxt: `admira-tv · ${slug}/`,
    pages: 'admira-tv', publica: './deploy.sh → Pages + wrangler.toml',
    tipo: 'sitio', shot: null,
    nota: `Subsolución de admira.tv: ${quePasa} Abre /${slug}/ y comparte despliegue, sello y firma con admira.tv.`,
  })),

  {
    clave: 'clearchannel-tv', nombre: 'clearchannel.tv', url: 'https://www.clearchannel.tv',
    repo: 'csilvasantin/clearchannel-tv', repoTxt: 'clearchannel-tv',
    pages: 'clearchannel-tv', publica: './deploy.sh → Pages clearchannel-tv',
    tipo: 'sitio', shot: '/webmaster-shots/clearchannel-tv.jpg',
    nota: 'Comparte proyecto de Pages con admira.app: publicar uno publica el otro. El push no publica.',
  },
  {
    // Su repositorio es propio, pero el dominio cuelga del proyecto de Pages de
    // clearchannel-tv. Antes esta fila apuntaba entera a clearchannel-tv y
    // enseñaba commits que no eran suyos.
    clave: 'admira-app', nombre: 'admira.app', url: 'https://www.admira.app',
    repo: 'csilvasantin/admira-app', repoTxt: 'admira-app',
    pages: 'clearchannel-tv', publica: 'lo publica clearchannel.tv',
    tipo: 'sitio', shot: '/webmaster-shots/admira-app.jpg',
    nota: 'Mismo proyecto de Pages que clearchannel.tv, por eso enseñan los mismos snapshots. El proyecto admira-app existe, pero sin dominio propio.',
  },
  {
    clave: 'digitalavatar', nombre: 'digitalavatar.ai', url: 'https://digitalavatar.ai',
    repo: 'csilvasantin/digitalavatar.ai', repoTxt: 'digitalavatar.ai',
    pages: null, publica: 'git push (GitHub Pages)',
    tipo: 'sitio', shot: '/webmaster-shots/digitalavatar.jpg',
    nota: 'La portada se queda cargando: el contador pasa del 100 % («Cargando avatar… 133 %») y no arranca.',
  },
  {
    clave: 'ainimation', nombre: 'ainimation.studio', url: 'https://www.ainimation.studio',
    repo: 'csilvasantin/ainimation', repoTxt: 'ainimation',
    pages: null, publica: 'git push (GitHub Pages)',
    tipo: 'sitio', shot: '/webmaster-shots/ainimation.jpg',
  },
  {
    clave: 'admiraxperience', nombre: 'AdmiraXperience · DigitalTwin', url: null,
    repo: 'csilvasantin/01.-AdmiraXperience-Game', repoTxt: '01.-AdmiraXperience-Game',
    pages: null, publica: 'git push (GitHub Pages)',
    tipo: 'sitio', shot: null,
    nota: 'Tenía historial pero ninguna fila desde la que abrirlo. Falta declarar en qué dirección está publicado.',
  },

  // ── Workers ──────────────────────────────────────────────────────────────
  // No hay portada que mirar y la marcha atrás no es de git: wrangler rollback.
  {
    clave: 'pixer-worker', nombre: 'pixer-eleven (worker)', url: null,
    repo: 'csilvasantin/pixer-worker', repoTxt: 'pixer-worker',
    pages: null, publica: 'wrangler deploy',
    tipo: 'worker', shot: null,
    nota: 'El repositorio está desfasado de producción: no desplegar a ciegas.',
  },
  {
    // Antes compartía clave con el sitio yokup y enseñaba el historial de la web.
    clave: 'yokup-rtc', nombre: 'yokup-rtc (worker)', url: null,
    parentKey: 'yokup',
    repo: 'csilvasantin/tool', repoTxt: 'tool · yokup-rtc/',
    pages: null, publica: 'cd yokup-rtc && wrangler deploy',
    tipo: 'worker', shot: null,
    nota: 'Commit ANTES de desplegar: se ha desplegado más de una vez con código que no estaba en el repositorio, y el siguiente despliegue borra esas rutas sin enterarse.',
  },
  {
    clave: 'admira-telegram', nombre: 'admira-telegram (worker)', url: null,
    repo: 'csilvasantin/admira-telegram', repoTxt: 'admira-telegram', privado: true,
    pages: null, publica: '~/Claude/admira-telegram/deploy.sh',
    tipo: 'worker', shot: null,
    nota: 'Espeja el grupo de Telegram en D1. Sostiene admira.live/telegram y el Diario de Silicio.',
  },
  {
    clave: 'admira-vault', nombre: 'admira-vault (worker)', url: null,
    repo: 'csilvasantin/admira-vault', repoTxt: 'admira-vault', privado: true,
    pages: null, publica: 'wrangler deploy',
    tipo: 'worker', shot: null,
    nota: 'La bóveda de la flota. Su copia local diverge entre máquinas: desplegar desde un checkout viejo borra scripts vivos.',
  },
  {
    clave: 'xpl-store', nombre: 'xpl-store (worker)', url: null,
    repo: 'csilvasantin/xpl-store', repoTxt: 'xpl-store', privado: true,
    pages: null, publica: 'wrangler deploy',
    tipo: 'worker', shot: null,
    nota: 'Motor de reglas condicionales XPL por pantalla. Lo consume admira.tv/cms.',
  },
];

/** Búsqueda por clave — lo que antes hacía el objeto PROYECTOS. */
export const porClave = (clave) => PROYECTOS.find((p) => p.clave === clave) || null;
