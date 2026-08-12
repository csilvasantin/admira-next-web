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
    volver: 'cd /tmp && git clone https://github.com/csilvasantin/admira-next-web.git admiranext-return && cd admiranext-return && git checkout d25067db2524801b3313bd07df1d4fb49ba3b3df && ADMIRA_RELEASE_AGENT=TrinityMBP14 ADMIRA_RELEASE_MACHINE=MacBookProNegro14 ./deploy.sh',
    tipo: 'sitio', shot: '/webmaster-shots/admiranext.jpg',
  },
  {
    clave: 'admiranext-webmaster', nombre: 'AdmiraNeXT Webmaster',
    url: 'https://www.admiranext.com/webmaster',
    estadoUrl: 'https://www.admiranext.com',
    parentKey: 'admiranext',
    repo: 'csilvasantin/admira-next-web', repoTxt: 'admira-next-web · webmaster',
    pages: 'admiranext', publica: './deploy.sh → Pages admiranext',
    volver: 'cd /tmp && git clone https://github.com/csilvasantin/admira-next-web.git admiranext-webmaster-return && cd admiranext-webmaster-return && git checkout d25067db2524801b3313bd07df1d4fb49ba3b3df && ADMIRA_RELEASE_AGENT=TrinityMBP14 ADMIRA_RELEASE_MACHINE=MacBookProNegro14 ./deploy.sh',
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
    volver: 'git worktree add /tmp/yokup-pages-return dd8139e && npx wrangler pages deploy /tmp/yokup-pages-return/yokup-site --project-name yokup --branch main',
    tipo: 'sitio', shot: '/webmaster-shots/yokup.jpg',
    nota: 'Retorno anterior a la autoría principal: deployment 498ee810-cb20-4cb8-85c7-bb6b623fe51e · commit dd8139e. El comando crea un worktree inmutable y lo vuelve a publicar.',
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
    volver: 'cd /tmp && git clone https://github.com/csilvasantin/32.-ConsejoAdmiraNextGame.git admira-live-return && cd admira-live-return && git checkout 86a64e783233c0a1954be40714a9379163c7d39c && ADMIRA_RELEASE_AGENT=TrinityMBP14 ADMIRA_RELEASE_MACHINE=MacBookProNegro14 ./deploy.sh && cd workers/admira-auth-edge && npx wrangler rollback 496f8b99-0bdd-46b1-8db3-b875d0b37dd5 --yes && cd ../admira-fleet-proxy && npx wrangler rollback 0ee6d212-1594-4f8d-be94-258c363e3c96 --yes',
    tipo: 'sitio', shot: '/webmaster-shots/admira-live.jpg',
  },
  {
    clave: 'la-incubadora', nombre: 'La Incubadora v1.0 · futuro ieu.ai',
    url: 'https://www.admira.live/13rue/',
    estadoUrl: 'https://www.admira.live',
    parentKey: 'admira-live',
    repo: 'csilvasantin/32.-ConsejoAdmiraNextGame', repoTxt: '32.-ConsejoAdmiraNextGame · 13rue/',
    pages: 'admira-live', publica: './deploy.sh → Pages admira-live (repo COMPLETO, ver nota)',
    tipo: 'sitio', shot: null,
    nota: 'El vecindario de 13 Rue del Percebe traducido a doce agentes de IA, cada uno con su system prompt, su léxico y su vocabulario vetado. Se levanta en admira.live y su nombre definitivo será ieu.ai (también escrito eui.ai: son EL MISMO proyecto, no dos copias con dos URLs — cuando se registre se elige uno y el otro redirige). Ojo al alcance: ieu.ai nace para el Universo entero, no para Admira; Admira es quien lo construye, no su dueño temático. AVISO DE DESPLIEGUE, aprendido rompiéndolo el 9-ago-2026: admira.live se publica ENTERO desde 32.-ConsejoAdmiraNextGame. Existe además un repo csilvasantin/admira-live que solo tiene la portada y unas pocas páginas; desplegar desde ÉL sustituye el sitio completo y borra /control, /diario, /usuarios y /agora, que pasan a devolver la portada con 200 (un 404 disfrazado que no salta a la vista). Publicar siempre desde el repo completo.',
  },
  {
    clave: 'incubadora-bus', nombre: 'Incubadora · bus de estado',
    url: 'https://incubadora-bus.csilvasantin.workers.dev/state',
    estadoUrl: 'https://www.admira.live/13rue/',
    parentKey: 'la-incubadora',
    repo: null, repoTxt: 'incubadora-bus (local, sin remoto todavía)',
    pages: null, publica: 'cd ~/Claude/incubadora-bus && wrangler deploy',
    tipo: 'worker', shot: null,
    nota: 'El motor del edificio: un Durable Object único guarda el global_slack_state, lo tickea con su propio alarm y lo difunde por WebSocket a todos los visitantes a la vez. Es lo que hace que dos personas vean el mismo edificio. Desplegado desde MacBookPro14 con la cuenta gmail.',
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
    yokupId: 'xpaceos',
    repo: 'csilvasantin/admira-store', repoTxt: 'admira-store',
    pages: 'admira-store', publica: './deploy.sh',
    tipo: 'sitio', shot: '/webmaster-shots/admira-store.jpg',
    nota: 'Espejo de xpaceos.com con identidad visual propia; comparte su ficha canónica XpaceOS y su responsable en Yokup.',
  },
  {
    clave: 'admira-tv', nombre: 'admira.tv', url: 'https://admira.tv',
    repo: 'csilvasantin/admira-tv', repoTxt: 'admira-tv',
    pages: 'admira-tv', publica: './deploy.sh → Pages + wrangler.toml',
    tipo: 'sitio', shot: '/webmaster-shots/admira-tv.jpg',
    volver: 'cd /tmp && git clone https://github.com/csilvasantin/admira-tv.git admira-tv-return && cd admira-tv-return && git checkout a5fb8ad176e395b847d7fec4314fca5b1e78310e && ADMIRA_RELEASE_AGENT=MorfeoMacMini ADMIRA_RELEASE_MACHINE=MacMini ./deploy.sh cf',
    nota: 'Retorno exacto anterior a Xperiencias Payment: commit a5fb8ad176e395b847d7fec4314fca5b1e78310e · release v.12.08.2026.r15.17:42 · deployment Pages 5ddb7f58-08e4-46a5-9ad0-89064b8fadc1.',
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
    volver: 'cd /tmp && git clone https://github.com/csilvasantin/ainimation.git ainimation-return && cd ainimation-return && git checkout AInimation-v.11.08.2026.r4 && git push origin HEAD:main',
    nota: 'Director creativo IA (cast·stage·score). Release Payment v.12.08.2026.r1.17:50. Retorno exacto anterior: tag AInimation-v.11.08.2026.r4 (commit 16f7dcaf473303a8028d5dd45a6c216c1e3a8504).',
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
    volver: 'npx wrangler rollback 080863ec-123e-4d0a-b9f8-1f41e73e6753 --name pixer-eleven --yes',
    tipo: 'worker', shot: null,
    nota: 'Producción sincronizada con Git. Retorno exacto anterior al almacenamiento HTML de Xperiencias Payment: version 080863ec-123e-4d0a-b9f8-1f41e73e6753 (deployment 6b209751-f1e3-4aa2-9f6e-a927f0e9db7c).',
  },
  {
    // Antes compartía clave con el sitio yokup y enseñaba el historial de la web.
    clave: 'yokup-rtc', nombre: 'yokup-rtc (worker)', url: 'https://api.yokup.com',
    parentKey: 'yokup',
    repo: 'csilvasantin/tool', repoTxt: 'tool · yokup-rtc/',
    pages: null, publica: 'cd yokup-rtc && wrangler deploy',
    volver: 'npx wrangler rollback e941bb22-c71c-4e1c-a336-0c278a47d4a4 --name yokup-rtc --yes',
    tipo: 'worker', shot: null,
    nota: 'Retorno anterior a la autoría principal y al alta de OpenCode/Nemotron: Worker e941bb22-c71c-4e1c-a336-0c278a47d4a4. Versión viva: v.12.08.2026.r3.10:02, firmada por TrinityMBP14 en MacBookProNegro14.',
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
