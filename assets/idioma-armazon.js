/* idioma-armazon.js — diccionario ES→EN de las páginas con armazón de admiranext.com (06-10-2026).
 *
 * Carlos (10:11): «sigo sin ver el cambio de idioma». /idioma ENG traducía el armazón pero no el
 * texto propio de cada página. admira-frame.js lo descarga la primera vez que alguien pide inglés
 * y traduce con esto TODO el texto fijo de la página (también lo que la página pinte después).
 *
 *  · dicc: frase exacta en castellano → inglés (sin el adorno de delante: «☰ », «○ », «· »…).
 *    Una frase «a · b · c» que no esté entera se traduce trozo a trozo.
 *  · reglas: [RegExp, reemplazo | función(m, traducir)] para lo que lleva números o fechas.
 * Los datos escritos en castellano (títulos de hitos, nombres) NO se traducen.
 * Al añadir una página: vuelca su texto visible en ES, añade aquí lo fijo y súbele el ?v=
 * (IDIOMA_STAMP en admira-frame.js).
 */
(function (G) {
  'use strict';
  var A = G.AdmiraIdiomaArmazon;
  if (!A || !A.anadir) return;

  var MES = {ene: 'Jan', feb: 'Feb', mar: 'Mar', abr: 'Apr', may: 'May', jun: 'Jun', jul: 'Jul', ago: 'Aug', sep: 'Sep', oct: 'Oct', nov: 'Nov', dic: 'Dec'};
  var MES_LARGO = {enero: 'January', febrero: 'February', marzo: 'March', abril: 'April', mayo: 'May', junio: 'June', julio: 'July',
    agosto: 'August', septiembre: 'September', octubre: 'October', noviembre: 'November', diciembre: 'December'};
  var ESTADO = {hecho: 'done', 'en curso': 'in progress', en_curso: 'in progress', confirmado: 'confirmed', propuesta: 'proposed'};
  var ESTADO_MAY = {Hecho: 'Done', 'En curso': 'In progress', Confirmado: 'Confirmed', Propuesta: 'Proposed'};
  var mesCorto = function (m) { var k = m.toLowerCase(); return MES[k] ? (m === m.toUpperCase() ? MES[k].toUpperCase() : MES[k]) : m; };
  var hitos = function (n) { return n + (n === '1' ? ' milestone' : ' milestones'); };

  var dicc = {
    // Comunes
    'Todos': 'All', 'Todo': 'All', 'Créame demo': 'Make me a demo', 'Proyecto': 'Project', 'Cliente': 'Client', 'Idea': 'Idea', 'General': 'General',
    'Anterior': 'Previous', 'Siguiente': 'Next', 'Día': 'Day', 'Semana': 'Week', 'Mes': 'Month', 'Trimestre': 'Quarter', 'Año': 'Year',
    'NUEVO': 'NEW', 'Cargando…': 'Loading…', 'Cerrar': 'Close', 'Buscar': 'Search', 'Filtro': 'Filter', 'Filtro ·': 'Filter ·',
    'Estados': 'States', 'Hub MCP': 'MCP hub',
    // Las cinco patas y la mesa (rótulos fijos)
    'La mesa que une las cinco patas': 'The table that joins the five legs',
    'Creación y Adaptación de Contenidos': 'Content Creation and Adaptation',
    'Distribución, Gestión y Visualización': 'Distribution, Management and Visualisation',
    'Reproducción, Emisión y Proof of Play': 'Playback, Broadcast and Proof of Play',
    'Instalaciones, Mantenimiento y Gestión': 'Installation, Maintenance and Management',
    'Nuevos ingresos con DooH y Retail Media': 'New revenue with DooH and Retail Media',
    // Ideas del RoadMap
    'Clientes globales y marca blanca': 'Global clients and white label', 'Entrada de agentes sin Google': 'Agent sign-in without Google',
    'Modo Experto': 'Expert mode', 'Instalaciones y soporte': 'Installations and support', 'Contenidos y Pixeria': 'Content and Pixeria',
    'Reproducción y Proof of Play': 'Playback and Proof of Play', 'Circuitos DooH': 'DooH circuits', 'Inventario y plano del local': 'Inventory and venue floor plan',
    // RoadMap
    'Panorama del RoadMap': 'RoadMap overview', 'Contadores del RoadMap': 'RoadMap counters', 'Meses del RoadMap': 'RoadMap months',
    'Escala del RoadMap': 'RoadMap scale', 'Presentador (P)': 'Presenter (P)', 'Salir presentador': 'Exit presenter',
    'Modo presentador (P) · ←/→ cambia de pata · Espacio pausa · Esc sale': 'Presenter mode (P) · ←/→ changes leg · Space pauses · Esc exits',
    'Hitos': 'Milestones', 'Hechos': 'Done', 'En curso': 'In progress', 'Confirmados': 'Confirmed', 'Propuestas': 'Proposed',
    '% completado': '% complete', 'Hecho': 'Done', 'Confirmado': 'Confirmed', 'Propuesta': 'Proposed',
    'Pasa el ratón por un hito · clic fija la ficha · P presentador · Esc': 'Hover a milestone · click pins the card · P presenter · Esc',
    'Clic: enfoca el Gantt en el mes · doble clic: abre el corte del mes': 'Click: focus the Gantt on the month · double click: open the month cut',
    'Por definir con Carlos': 'To be defined with Carlos', 'Cargando el Gantt…': 'Loading the Gantt…',
    'leyendo /api/roadmap…': 'reading /api/roadmap…', 'Corte por periodo': 'Cut by period',
    'borrador para validar por Carlos': 'draft for Carlos to validate',
    'Pata': 'Leg', 'Fechas': 'Dates', 'Responsable': 'Owner', 'Fuente': 'Source',
    'No se pudo leer /api/roadmap. El corte de abajo sigue disponible.': 'Could not read /api/roadmap. The cut below is still available.',
    'Por definir con Carlos · ningún hito en este periodo con estos filtros.': 'To be defined with Carlos · no milestones in this period with these filters.',
  };

  var reglas = [
    [/^(\d+) hitos?$/, function (m) { return hitos(m[1]); }],
    [/^(\d+) (hecho|en curso|confirmado|propuesta)$/, function (m) { return m[1] + ' ' + ESTADO[m[2]]; }],
    [/^(\d+)% hecho$/, '$1% done'],
    [/^(\d+) meses$/, '$1 months'],
    [/^(\d+) d[ií]as?$/, function (m) { return m[1] + (m[1] === '1' ? ' day' : ' days'); }],
    [/^(Hecho|En curso|Confirmado|Propuesta)(:| ·) (\d+)$/, function (m) { return ESTADO_MAY[m[1]] + m[2] + ' ' + m[3]; }],
    [/^(hecho|en_curso|confirmado|propuesta)$/, function (m) { return ESTADO[m[1]]; }],
    [/^Resaltar (.+) en el Gantt$/, 'Highlight $1 in the Gantt'],
    [/^api\/roadmap · (\d+) hitos$/, function (m) { return 'api/roadmap · ' + hitos(m[1]); }],
    [/^(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic) (\d{4})$/i, function (m) { return mesCorto(m[1]) + ' ' + m[2]; }],
    [/^(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre) de (\d{4})$/, function (m) { return MES_LARGO[m[1]] + ' ' + m[2]; }],
    [/^CORTE · (.*)$/, function (m, t) { return 'CUT · ' + (t(m[1]) || m[1]); }],
    [/^HOY (\d+) ([A-Z]{3})$/, function (m) { return 'TODAY ' + m[1] + ' ' + mesCorto(m[2]); }],
    [/^Fuente: ([\s\S]*)$/, 'Source: $1'],
    [/^Plazo transcurrido: (\d+)% \(calculado con la fecha de hoy\)$/, 'Time elapsed: $1% (calculated with today\'s date)'],
    [/^Gantt del RoadMap por pata, (\d+) (\w{3}) (\d{4}) – (\d+) (\w{3}) (\d{4})$/, function (m) {
      return 'RoadMap Gantt by leg, ' + m[1] + ' ' + mesCorto(m[2]) + ' ' + m[3] + ' – ' + m[4] + ' ' + mesCorto(m[5]) + ' ' + m[6];
    }],
    // aria-label de cada hito: «Título · Estado · fechas» → sólo el estado
    [/^([\s\S]+) · (Hecho|En curso|Confirmado|Propuesta) · (\d{4}-\d\d-\d\d → \d{4}-\d\d-\d\d)$/, function (m) { return m[1] + ' · ' + ESTADO_MAY[m[2]] + ' · ' + m[3]; }]
  ];

  A.anadir(dicc, reglas);

  // /organigrama
  var diccOrg = {
    'La mesa de ADmiraNeXT': 'The ADmiraNeXT table',
    'Tres niveles: responde · dirige · ejecuta. Jobs, cinco patas, DeepAgents y agentes en vivo.': 'Three levels: accountable · directs · executes. Jobs, five legs, DeepAgents and live agents.',
    'Responsabilidad': 'Accountability', 'Dirección': 'Direction', 'Ejecución': 'Execution',
    'El Consejo responde de la mesa; cada consejero, de su pata.': 'The Council is accountable for the table; each counsellor, for their leg.',
    'Un DeepAgent dirige cada pata (nombre y motor en la carta).': 'A DeepAgent directs each leg (name and engine on the card).',
    'Los agentes ejecutan el trabajo de su pata.': 'Agents carry out the work of their leg.',
    'El DeepAgent se puede cambiar o reforzar según la carga o si se queda sin tokens u horas. Latido: verde < 10 min · ámbar < 30 min · rojo sin señal reciente (Yokup / flota).':
      'The DeepAgent can be swapped or reinforced depending on load or if it runs out of tokens or hours. Heartbeat: green < 10 min · amber < 30 min · red no recent signal (Yokup / fleet).',
    'Consejero · une las cinco patas': 'Counsellor · joins the five legs', 'Consejero': 'Counsellor', 'Consejera': 'Counsellor',
    'DeepAgent que lo dirige': 'DeepAgent in charge', 'Escena viva': 'Live scene',
    'Árbol compactado al cargar: solo Jobs. Clic en un nodo para descompactar el siguiente nivel (Jobs → patas → DeepAgents → agentes). Arrastra una caja para recolocarla: las flechas la siguen en vivo y su rama se recoloca con muelle suave. Arrastra el fondo para mover la vista · rueda o +/− · R recolocar · P presentador · Esc · Enter/Espacio · Alt+flechas mueve la caja enfocada.':
      'Tree collapsed on load: only Jobs. Click a node to expand the next level (Jobs → legs → DeepAgents → agents). Drag a box to move it: the arrows follow live and its branch settles with a soft spring. Drag the background to pan · wheel or +/− · R re-arrange · P presenter · Esc · Enter/Space · Alt+arrows moves the focused box.',
    'Organigrama interactivo': 'Interactive org chart', 'Controles del organigrama': 'Org chart controls',
    'Centrar': 'Center', 'Recolocar': 'Re-arrange', 'Devolver las cajas a su sitio (R)': 'Put the boxes back in place (R)',
    'Modo presentador': 'Presenter mode', 'Presentador': 'Presenter', 'Salir presentador': 'Exit presenter',
    'Latido: cargando flota…': 'Heartbeat: loading fleet…', 'Mesa · une las cinco patas': 'Table · joins the five legs',
    'Motor:': 'Engine:', 'Orquesta las cinco patas': 'Orchestrates the five legs', 'Agente': 'Agent',
    'Agentes de emisión y PoP': 'Broadcast and PoP agents', 'Agentes de creación': 'Creation agents',
    'Agentes de distribución': 'Distribution agents', 'Agentes de instalaciones': 'Installation agents',
    'Agentes de retail media': 'Retail media agents', 'Emisión · PoP · player': 'Broadcast · PoP · player',
    'Contenido · adaptación': 'Content · adaptation', 'Stock · visualización': 'Stock · visualization',
    'Instalaciones · mantenimiento': 'Installations · maintenance', 'Organigrama de ADmiraNeXT': 'ADmiraNeXT org chart',
    'Latido flota · sin lectura de Yokup (reintento)': 'Fleet heartbeat · no reading from Yokup (retrying)',
    'sin señal': 'no signal', 'trabajando': 'working'
  };
  var reglasOrg = [
    [/^Agentes de (\S+)$/, 'Agents of $1'],
    [/^Dirige (\S+) bajo (\S+)\.$/, 'Directs $1 under $2.'],
    [/^Ejecuta bajo (\S+)$/, 'Works under $1'],
    [/^Latido flota · (\d+) vivos · (\d+) tibios · (\d+) sin señal · (\d+) trabajando · (.+)$/, 'Fleet heartbeat · $1 alive · $2 lukewarm · $3 no signal · $4 working · $5'],
    [/^Trabajando · (.+)$/, 'Working · $1'],
    [/^Latido flota · (\d+) vivos · (\d+) tibios · (\d+) sin señal · ([\s\S]+)$/, function (m, t) {
      return 'Fleet heartbeat · ' + m[1] + ' alive · ' + m[2] + ' lukewarm · ' + m[3] + ' no signal · ' + (t(m[4]) || m[4]);
    }],
    [/^(\d+) trabajando$/, '$1 working'],
    [/^Trabajando · ([\s\S]+)$/, 'Working · $1'],
    [/^trabajando$/, 'working'],
    [/^hace (\d+) ?(s|min|h|d)$/, '$1 $2 ago'],
    [/^ahora$/, 'now']
  ];

  // /proyectos
  var diccProy = {
    'AdmiraNeXT · definición': 'AdmiraNeXT · definition',
    'El censo vivo está en Yokup. Aquí se ve el modelo (qué es un proyecto, de qué xpacio, por dónde entra) y el inventario actual, sin borrar nada. Pulsa una cabecera del censo para ordenar.':
      'The live census lives in Yokup. Here you see the model (what a project is, which xpacio, how it comes in) and the current inventory, without deleting anything. Click a census header to sort.',
    'Enlaces de la página': 'Page links', 'El censo de la flota está en esta página': 'The fleet census is on this page',
    'El censo se lee con': 'The census is read with',
    '. admira.biz es DooH y Retail Media (antes clearchannel.tv). admira.app es instalaciones y mantenimiento. Las misiones se ven en': '. admira.biz is DooH and Retail Media (formerly clearchannel.tv). admira.app is installation and maintenance. Missions are shown at',
    'Las misiones se ven en': 'Missions are shown at', 'y el principal del día en': 'and the main project of the day at',
    'Modelo canónico': 'Canonical model', 'Agente (silicio)': 'Agent (silicon)',
    'Persona + apellido de máquina (': 'Person + machine surname (', 'El alta de trabajo lleva': 'Each work check-in carries',
    'del censo. Si falta, Yokup hereda el principal del día — y se trabaja en el proyecto equivocado.': 'from the census. If missing, Yokup inherits the main project of the day — and work lands on the wrong project.',
    'Principal del día:': 'Main project of the day:', 'con id + nombre + slug. Se ve en /equipo.': 'with id + name + slug. Shown at /equipo.',
    'Obligatorios:': 'Required:', 'slug), nombre, xpacio (AdmiraNeXT o Yokup), responsable. Puertas norma 24:': 'slug), name, xpacio (AdmiraNeXT or Yokup), owner. Rule 24 doors:',
    'humanos) y': 'humans) and', 'agentes). No se borra el censo: se añade o se retitula.': 'agents). The census is never deleted: entries are added or renamed.',
    'Censo vivo': 'Live census', 'cargando…': 'loading…', 'Leyendo api.yokup.com/projects': 'Reading api.yokup.com/projects',
    'Número de proyecto: único en todo el ecosistema Admira': 'Project number: unique across the whole Admira ecosystem',
    'Nombre': 'Name', 'Volver a leer el censo': 'Read the census again', 'proyectos': 'projects', 'Esta página': 'This page',
    'no se borra nada desde aquí.': 'nothing is deleted from here.',
    'Nº pendiente: api.yokup.com/projects aún no publica el número de proyecto.': 'No. pending: api.yokup.com/projects does not publish the project number yet.'
  };
  var reglasProy = [
    [/^Censo del (.+)$/, 'Census of $1'],
    [/^No se pudo leer el censo: ([\s\S]*)$/, 'Could not read the census: $1']
  ];

  A.anadir(diccOrg, reglasOrg);
  A.anadir(diccProy, reglasProy);

  // /flota (Agentes)
  var diccFlota = {
    'AdmiraNeXT · Gestión de proyectos': 'AdmiraNeXT · Project management', 'Agentes: marcador y misiones': 'Agents: scoreboard and missions',
    'Refrescar': 'Refresh', 'Refrescar ahora': 'Refresh now', 'Quién está trabajando': 'Who is working', 'Marcador del día': 'Today\'s scoreboard',
    'Misiones vivas': 'Live missions', 'Yokup · marcador ↗': 'Yokup · scoreboard ↗', 'Yokup · misiones ↗': 'Yokup · missions ↗',
    'Agente': 'Agent', 'Total': 'Total', 'Misiones': 'Missions', 'Ventanas': 'Windows', 'Máquina': 'Machine', 'Trabajo': 'Work', 'Estado': 'Status',
    'Última señal': 'Last signal', 'Ref': 'Ref', 'Asunto': 'Subject', 'Hoy no puntúa nadie todavía.': 'Nobody has scored today yet.',
    'Contados trabajando': 'Counted as working', 'Sesiones abiertas': 'Open sessions', 'Con trabajo asignado': 'With assigned work',
    'sin motivo': 'no reason', 'Yokup no ve a nadie con trabajo asignado ahora mismo.': 'Yokup sees nobody with assigned work right now.',
    'No hay misiones vivas.': 'There are no live missions.', 'Nadie figura trabajando': 'Nobody is listed as working',
    'No he podido leer Yokup entero:': 'I could not read all of Yokup:', 'Lo que se ve abajo puede estar incompleto.': 'What you see below may be incomplete.',
    'se refresca solo cada 30 s': 'refreshes itself every 30 s', 'rancio': 'stale'
  };
  var reglasFlota = [
    [/^modo (.+)$/, 'mode $1'],
    [/^ejecuta (\S+)$/, 'run by $1'],
    [/^(\d+) vivas$/, '$1 live'],
    [/^Datos de api\.yokup\.com · actualizado a las (\S+)$/, 'Data from api.yokup.com · updated at $1'],
    [/^y sin embargo hay (\d+) sesión\(es\) abierta\(s\)\. Yokup ve los procesos, pero no puede atarlos a una misión o tarea\. Motivos que declara: ([\s\S]*)$/,
      'and yet there are $1 open session(s). Yokup sees the processes but cannot tie them to a mission or task. Declared reasons: $2'],
    [/^(\d+) trabajo\(s\) con estado$/, '$1 job(s) with status'],
    [/^: hay misión o tarea asignada, pero nadie ha mandado señal de avance reciente\.$/, ': a mission or task is assigned, but nobody has sent a recent progress signal.']
  ];

  // /consejo
  var diccConsejo = {
    'El Consejo de ADmiraNeXT': 'The ADmiraNeXT Council', 'El Consejo': 'The Council',
    'Ocho asesores legendarios deliberan sobre las decisiones': 'Eight legendary advisors deliberate on the', 'reales': 'real',
    'de la empresa: Robot-as-a-Service, IoT con inteligencia artificial y XpaceOS. Elige un consejero (o pregunta a todo el Consejo) y plantéale una decisión de negocio.':
      'decisions of the company: Robot-as-a-Service, AI-powered IoT and XpaceOS. Pick a counsellor (or ask the whole Council) and put a business decision to them.',
    'Leyendas': 'Legends', 'Coetáneos': 'Contemporaries',
    '¿Cuál debe ser nuestra prioridad estratégica este trimestre?': 'What should our strategic priority be this quarter?',
    '¿Cómo escalamos el alquiler de robots en España sin quemar caja?': 'How do we scale robot rental in Spain without burning cash?',
    '¿Qué métrica única deberíamos perseguir el próximo año?': 'Which single metric should we chase next year?',
    '¿Vale la pena entrar en hospitales públicos o nos centramos en retail?': 'Is it worth entering public hospitals or do we focus on retail?',
    'Preguntar al consejero': 'Ask the counsellor', 'Preguntar a todo el Consejo': 'Ask the whole Council',
    'El Consejo razona con contexto real de ADmiraNeXT (RaaS de robots Unitree/Agibot en España, IoT con IA, XpaceOS · OmniPublicity). Las respuestas son orientativas, generadas por IA en la persona de cada asesor':
      'The Council reasons with real ADmiraNeXT context (Unitree/Agibot robot RaaS in Spain, AI IoT, XpaceOS · OmniPublicity). Answers are indicative, AI-generated in the persona of each advisor',
    'Versión interactiva completa en admira.live': 'Full interactive version at admira.live', 'Consejo en vivo': 'Live Council',
    'Plantea una decisión de AdmiraNext… (p. ej. ¿Cómo priorizamos el alquiler de robots en España este trimestre?)':
      'Put an AdmiraNext decision… (e.g. How do we prioritise robot rental in Spain this quarter?)',
    'Cómic': 'Comic', 'pensando…': 'thinking…', 'sin respuesta': 'no response', 'no se pudo contactar al Consejo': 'could not reach the Council'
  };
  var reglasConsejo = [
    [/^Consejero: (.+) · (\w+)$/, 'Counsellor: $1 · $2']
  ];

  // /normativa (09-10-2026): la prosa va en data-en por bloque (ver admira-frame.js, traducirBloques).
  // Aquí solo lo que queda suelto entre etiquetas: las tres máximas de cabecera y el pie.
  var diccNormativa = {
    'Ningún agente existe sin el apellido de su máquina': 'No agent exists without the surname of its machine',
    'Todo trabajo comparte una única secuencia diaria': 'All work shares a single daily sequence',
    'Nadie trabaja sin haberse introducido': 'Nobody works without having introduced themselves',
    'Fuente canónica →': 'Canonical source →',
    'Contrato operativo del equipo de silicio de': 'Operating contract of the silicon team of',
    'La normativa crece aquí, numerada y verificable · fuente única de identidad': 'The rules grow here, numbered and verifiable · single source of identity',
    'Ver también': 'See also',
    'espejo operativo en': 'operational mirror at'
  };
  A.anadir(diccNormativa, []);
  // Títulos de las normas: el armazón los copia a su índice (☰ Opciones), fuera de los bloques data-en.
  var titulosNormativa = {
    "El nombre único es el identificador; el equipo acompaña": "The unique name is the identifier; the machine goes alongside",
    "Diccionario único de equipos": "Single dictionary of machines",
    "Los nombres antiguos se leen; no se propagan": "Old names are read; they are not propagated",
    "Todo trabajo dice en qué equipo se hizo": "All work states which machine it was done on",
    "Una referencia para todo el trabajo": "One reference for all work",
    "La doctrina que crece se renumera y se anuncia": "Doctrine that grows is renumbered and announced",
    "Una sola forma de decir la versión": "One single way to state the version",
    "Todo cambio se firma por su responsable y su equipo": "Every change is signed by whoever is responsible and their machine",
    "Cada cambio publicado, una versión nueva": "Every published change, a new version",
    "OnIdle horario: tres acciones cuando el equipo está desatendido": "Hourly OnIdle: three actions when the team is unattended",
    "Modo rápido siempre puesto": "Fast mode always on",
    "El proyecto acompaña al agente responsable": "The project accompanies the responsible agent",
    "Siempre la última versión — y su autor": "Always the latest version — and its author",
    "Lo que se decide y lo que se hace se da de alta, siempre": "What is decided and what is done is always registered",
    "Tu identidad se comprueba en tu sesión, no se copia del censo": "Your identity is checked in your session, not copied from the census",
    "A un consejero se le enseña con guiones, no con vídeos": "An adviser is taught with scripts, not with videos",
    "Cada cierre declara sus puntos y el total verificado": "Every closure declares its points and the verified total",
    "Introducirse: el día empieza dándose de alta": "Introducing yourself: the day starts by signing up",
    "Dos Xpacios, un origen y responsabilidades distintas": "Two Xpacios, one origin and distinct responsibilities",
    "App de escritorio solo donde hay un humano; el resto, CLI": "Desktop app only where there is a human; everything else, CLI",
    "Tarea, mision u objetivo — y todo encargo declara lo que produjo": "Task, mission or objective — and every order declares what it produced",
    "El cierre son tres líneas, y son las mismas corras donde corras": "The close-out is three lines, and they are the same wherever you run",
    "Cositas: delegar es obligatorio y el cierre declara el contexto gastado": "Cositas: delegation is mandatory and the close-out declares the context spent",
    "Cada proyecto abre dos puertas: /help para el carbono y /mcp para el silicio": "Every project opens two doors: /help for carbon and /mcp for silicon",
    "El aviso de recarga dice la versión, no que hay una versión": "The reload notice states the version, not that there is a version",
    "Todo agente tiene un proyecto principal, y se declara donde se mira": "Every agent has a main project, and declares it where people look",
    "El alta y el cierre son la misma obligación, y alcanzan a todos": "Registration and closing are the same obligation, and they apply to everyone",
    "Todos entran en todos los proyectos; uno responde, todos cuidan": "Everyone enters every project; one answers for it, everyone looks after it",
    "Sesión corta; contexto largo es basura cara": "Short session; long context is expensive garbage",
    "La misión y el encargo no comparten número": "Mission and order do not share a number"
  };
  A.anadir(titulosNormativa, []);
  // Títulos de /help, /mcp y /telegram: el armazón los copia a su índice, fuera de los bloques data-en.
  var titulosAyuda = {
    "/help del equipo Matrix": "/help for the Matrix team",
    "Comandos Dentro De Telegram": "Commands inside Telegram",
    "CLI de AgoraMatrix": "AgoraMatrix CLI",
    "Invocar agentes": "Invoking agents",
    "Miembros De AgoraMatrix": "AgoraMatrix members",
    "Comandos De Terminal Para Agentes": "Terminal commands for agents",
    "Protocolos Operativos": "Operating protocols",
    "Cuando Carlos da una orden por Telegram": "When Carlos gives an order via Telegram",
    "Cuando un agente termina una accion": "When an agent finishes an action",
    "Frase de confirmacion de escucha": "Listening confirmation phrase",
    "Usuarios y proyectos": "Users and projects",
    "Las 4 patas: el sistema operativo del retail": "The 4 legs: the operating system of retail",
    "La matriz de la empresa agéntica": "The parent site of the agentic company",
    "Páginas para humanos y agentes": "Pages for humans and agents",
    "Presentar": "Present",
    "Generador de Presentaciones · MCP vivo + ayuda": "Presentation Generator · Live MCP + help",
    "Generador de créditos": "Credits generator",
    "Generador de presupuestos": "Quote generator",
    "Narrativa de Impacto": "Impact Narrative",
    "Los 14 Mandamientos": "The 14 Commandments",
    "Filosofía del equipo": "Team philosophy",
    "Normativa operativa": "Operating rules",
    "Colgada aquí": "Posted here",
    "Los MCP de la suite, uno por producto": "The suite's MCPs, one per product",
    "Una clave por persona y equipo, válida en toda la suite": "One key per person and machine, valid across the whole suite",
    "De un mensajea una misión real": "From a messageto a real mission",
    "Grupo AgoraMatrix": "AgoraMatrix group",
    "Qué puedes hacer": "What you can do",
    "Encargar una misión": "Order a mission",
    "Elegir agente o equipo": "Choose an agent or machine",
    "Adjuntar contexto": "Attach context",
    "Seguir el progreso": "Follow progress",
    "Recibir el resultado": "Receive the result",
    "Auditar en YOKUP": "Audit in YOKUP",
    "Cómo funciona": "How it works",
    "Mensaje + archivos": "Message + files",
    "Identidad, presencia y carga": "Identity, presence and load",
    "Una ejecución, un responsable": "One execution, one owner",
    "Progreso y prueba": "Progress and proof",
    "Resultado + informe": "Result + report",
    "Habla como quieras": "Speak however you like",
    "Estados que verás": "Statuses you will see",
    "Dos vistas, una verdad": "Two views, one truth"
  };
  A.anadir(titulosAyuda, []);
  // Rótulos sueltos de /mcp y /telegram que no viven en un bloque (enlaces de la cabecera, estado de la conexión).
  A.anadir({
    'Abrir llms.txt': 'Open llms.txt', 'Abrir manifest.json': 'Open manifest.json', 'Para agentes': 'For agents',
    'MCP del generador': 'Generator MCP', 'Consejo MCP (admira.live) ↗': 'Council MCP (admira.live) ↗',
    'Ver cómo funciona': 'See how it works', 'sin conexión · reintentando': 'offline · retrying',
    'sin conexión': 'offline', 'reintentando': 'retrying', 'conectando…': 'connecting…', 'conectando': 'connecting', 'en vivo': 'live'
  }, []);
  A.anadir(diccFlota, reglasFlota);
  A.anadir(diccConsejo, reglasConsejo);
  if (A.aplicar) A.aplicar();
})(window);
