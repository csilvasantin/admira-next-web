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
    'Todos': 'All', 'Todo': 'All', 'Proyecto': 'Project', 'Cliente': 'Client', 'Idea': 'Idea', 'General': 'General',
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
  if (A.aplicar) A.aplicar();
})(window);
