// Pasos sacados de suite/demo-control.js. Solo operaciones del esquema; el
// recorrido de admira.tv sigue en native porque todavía no está partido.
const T = (es, en) => ({ es, en });
const con = (path, paso) => (path ? { ...paso, path } : paso);
const point = (selector, es, en, path) => con(path, { op: 'point', selector, text: T(es, en) });
const click = (selector, es, en, path) => con(path, { op: 'click', selector, text: T(es, en) });
const fill = (selector, value, es, en, path) => con(path, { op: 'fill', selector, value, text: T(es, en) });
const select = (selector, value, es, en, path) => con(path, { op: 'select', selector, value, text: T(es, en) });
const open = (selector, es, en, path) => con(path, { op: 'open', selector, text: T(es, en) });
const close = (selector, es, en, path) => con(path, { op: 'close', selector, text: T(es, en) });
const video = (site, id, path) => con(path, {
  op: 'video',
  url: 'https://www.admiranext.com/assets/demos/suite-v1/' + site + '-' + id + '.mp4',
  text: T('Veamos el resultado preparado de esta función.', 'Let us see the prepared result of this feature.'),
});

const audio = '/audio';
const music = '/musica';
const image = '/imagenes';
const clip = '/video';
const adapt = '/adaptaciones/';

export const RECORRIDOS = {
  studio: {
    voz: [
      fill('#proj-cliente', 'Alsea · Starbucks · demostración', 'Prepararemos el mensaje de bienvenida de la cafetería.', 'We will prepare the coffee shop welcome message.', audio),
      fill('#a-personaje', 'Voz adulta cálida y cercana', 'Definimos la identidad de la voz.', 'We define the voice identity.', audio),
      select('#a-idioma', 'Espanol (ES)', 'Elegimos el idioma de la locución.', 'We choose the voiceover language.', audio),
      select('#a-tono', 'Cercano', 'Elegimos un tono cercano al cliente.', 'We choose a warm tone.', audio),
      fill('#a-guion', 'Bienvenidos a nuestra cafetería. Haz una pausa y disfruta de un café recién hecho.', 'Escribimos el texto que escucharía el cliente en tienda.', 'We write the message the customer would hear in store.', audio),
      point('#playOutput', 'Este botón genera una locución nueva. En este recorrido escuchamos una ya preparada.', 'This button generates a new voiceover. Here we play a prepared one.', audio),
      video('studio', 'voz', audio),
    ],
    musica: [
      select('#m-versiones', 'Loop instrumental ~15s', 'Para el ambiente de tienda elegimos un loop instrumental.', 'For the store atmosphere we choose an instrumental loop.', music),
      select('#m-style', 'blues', 'Escogemos el estilo musical.', 'We choose the musical style.', music),
      fill('#m-titulo', 'Una pausa con café', 'Damos nombre a la pieza.', 'We name the piece.', music),
      fill('#m-letra', '[Instrumental]\nPiano cálido, guitarra suave y contrabajo. Sin voz.', 'Describimos instrumentos y ambiente, sin letra cantada.', 'We describe the instruments and atmosphere, without sung lyrics.', music),
      point('#playOutput', 'Aquí se solicita la música. Escuchemos la muestra preparada.', 'Music is requested here. Let us hear the prepared sample.', music),
      video('studio', 'musica', music),
    ],
    imagen: [
      fill('#proj-cliente', 'Alsea · Starbucks · demostración', 'La creatividad conserva el contexto del proyecto.', 'The creative retains the project context.', image),
      fill('#i-prompt', 'Fotografía publicitaria de café humeante en una taza de cerámica, barra de madera, luz cálida de mañana, fondo de cafetería desenfocado, sin texto.', 'Describimos producto, luz y composición.', 'We describe the product, light and composition.', image),
      point('#playOutput', 'Aquí comienza la creación de imagen; ahora vemos el resultado preparado.', 'Image creation starts here; we now show the prepared result.', image),
      video('studio', 'imagen', image),
    ],
    video: [
      fill('#clip-stock', '1791230658801-jnv969', 'Partimos de una imagen preparada de la biblioteca.', 'We start with a prepared library image.', clip),
      fill('#clip-prompt', 'La cámara se acerca lentamente al café y el vapor asciende suavemente. Conserva la taza y el fondo, sin texto.', 'Definimos el movimiento sin cambiar el producto.', 'We define motion without changing the product.', clip),
      point('#clip-one', 'Este control solicita el clip. Veamos el movimiento del ejemplo preparado.', 'This control requests the clip. Let us see the prepared example in motion.', clip),
      video('studio', 'video', clip),
    ],
    adaptar: [
      click('#stock-pick', 'Abrimos la biblioteca para elegir un contenido existente.', 'We open the library to choose existing content.', adapt),
      select('#stock-list li[role="option"]', 'Un anuncio elegante de café recién hecho', 'Elegimos el anuncio de café de la demostración.', 'We choose the coffee ad prepared for this demonstration.', adapt),
      click('#btn-adaptar', 'Abrimos los formatos de salida de esta pieza.', 'We open the output formats for this content.', adapt),
      point('#grid', 'La misma pieza se adapta a pantallas horizontales, verticales y otros tamaños.', 'The same content adapts to landscape, portrait and other screen sizes.', adapt),
      point('#export-all', 'La exportación produciría los archivos. Comparemos las cuatro variantes ya preparadas.', 'Export would produce the files. Let us compare the four prepared variants.', adapt),
      video('studio', 'adaptar', adapt),
    ],
  },
  store: {
    voz: [
      open('#pfOptions', 'Abrimos las opciones de gestión del local.', 'We open the store management options.'),
      open('[data-option-id="megafonia"]', 'Abrimos la gestión de locuciones.', 'We open voiceover management.'),
      select('#announcementVoice', 'browser', 'La voz local permite ensayar el mensaje.', 'A local voice allows us to rehearse the message.'),
      fill('#announcementText', 'Bienvenidos a Starbucks. Haz una pausa y disfruta de tu café.', 'Preparamos el aviso que escucharía el cliente.', 'We prepare the message the customer would hear.'),
      point('[data-xp-do="mega"]', 'Este control emitiría el aviso. Ahora mostramos el ejemplo preparado.', 'This control would broadcast the message. We now show the prepared example.'),
      video('store', 'voz'),
    ],
    musica: [
      open('[data-option-id="music"]', 'Pasamos al hilo musical del local.', 'We move to the store background music.'),
      point('[data-pixeria-library="music"]', 'La biblioteca conecta música de Studio con el local.', 'The library connects Studio music to the store.'),
      open('[data-options-playlist="music"]', 'Abrimos la playlist actual para revisar su orden.', 'We open the current playlist to review its order.'),
      video('store', 'musica'),
    ],
    imagenes: [
      open('[data-option-id="pixerai"]', 'Abrimos las imágenes disponibles para esta tienda.', 'We open the images available for this store.'),
      point('[data-pixeria-library="image"]', 'Aquí se eligen las creatividades de la biblioteca.', 'Library creatives are chosen here.'),
      video('store', 'imagenes'),
    ],
    video: [
      open('[data-option-id="video"]', 'La gestión de vídeo utiliza la misma biblioteca.', 'Video management uses the same library.'),
      open('[data-options-playlist="screens"]', 'Revisamos la playlist de las pantallas.', 'We review the screen playlist.'),
      video('store', 'video'),
    ],
    tpv: [
      close('#pfOptions', 'Volvemos al gemelo para mostrar el punto de venta.', 'We return to the digital twin to show the point of sale.'),
      point('[data-pos-register="starbucks-tpv-01"]', 'La caja del gemelo conecta pedidos, audio y pantallas.', 'The twin register connects orders, audio and screens.'),
      video('store', 'tpv'),
    ],
  },
  biz: {
    circuito: [
      close('#splash-close', 'Abrimos el mapa de espacios comerciales.', 'We open the commercial spaces map.'),
      open('#header-advanced-toggle', 'Abrimos las herramientas avanzadas del mapa.', 'We open the advanced map tools.'),
      open('#header-circuit-btn', 'Abrimos el selector de circuitos.', 'We open the circuit selector.'),
      select('#circuit-scope-select', 'national', 'Elegimos el alcance del circuito.', 'We choose the circuit scope.'),
      select('#circuit-select', 'alsea_starbucks', 'Seleccionamos el circuito Alsea Starbucks.', 'We select the Alsea Starbucks circuit.'),
      point('#circuit-list', 'Revisamos los puntos DooH asociados al circuito.', 'We review the DooH locations linked to the circuit.'),
      video('biz', 'circuito'),
    ],
    proyecto: [
      open('#header-advanced-toggle', 'Volvemos a las herramientas de campaña.', 'We return to the campaign tools.'),
      click('#header-planner-btn', 'Abrimos el planificador de campaña.', 'We open the campaign planner.'),
      fill('#plan-start', '2026-10-08', 'Definimos la fecha de inicio del vuelo de ejemplo.', 'We define the example flight start date.'),
      fill('#plan-end', '2026-10-15', 'Definimos el final del vuelo.', 'We define the flight end date.'),
      select('#plan-passes', '500', 'Preparamos la frecuencia de pases de ejemplo.', 'We prepare the example playback frequency.'),
      select('#plan-duration', '15', 'Elegimos la duración de la creatividad.', 'We choose the creative duration.'),
      point('#planner-modal', 'El planificador permite revisar el plan antes de contratar.', 'The planner lets us review the plan before booking.'),
      video('biz', 'proyecto'),
    ],
    gemelo: [
      close('#plan-close', 'Volvemos al circuito de la propuesta.', 'We return to the proposed circuit.'),
      open('#header-advanced-toggle', 'Volvemos a las herramientas del circuito.', 'We return to the circuit tools.'),
      open('#header-circuit-btn', 'Mostramos los puntos del circuito.', 'We show the circuit locations.'),
      point('#circuit-list', 'Cada punto conecta con su gemelo y su catálogo de superficies.', 'Each location connects to its twin and surface catalogue.'),
      video('biz', 'gemelo'),
    ],
    iot: [
      point('#circuit-sel-count', 'Los dispositivos soportan la red de pantallas del circuito. Veamos la propuesta preparada de IoT.', 'Devices support the circuit screen network. Let us see the prepared IoT proposal.'),
      video('biz', 'iot'),
    ],
    itil: [
      point('#circuit-select', 'La operación se completa con inventario y trazabilidad. Veamos el ejemplo preparado de ITIL.', 'Operations are completed with inventory and traceability. Let us see the prepared ITIL example.'),
      video('biz', 'itil'),
    ],
  },
  app: {
    establecimientos: [
      point('#workspace', 'Este es el portal del comercio: establecimientos, equipos e incidencias autorizados.', 'This is the retailer portal: authorized locations, devices and incidents.', '/retailer'),
      point('.retailer-locations', 'Revisamos los establecimientos vinculados a la cuenta.', 'We review the locations linked to the account.', '/retailer'),
      fill('#site-search', 'Starbucks', 'Buscamos los establecimientos de la demostración. Si tu cuenta no los tiene, la búsqueda lo muestra.', 'We search for the demonstration locations. If your account does not contain them, the search shows that.', '/retailer'),
      fill('#site-search', '', 'Volvemos a mostrar todos tus establecimientos.', 'We return to all your locations.', '/retailer'),
    ],
    inventario: [
      select('#site-filter', '', 'El inventario permite filtrar los equipos por establecimiento.', 'The inventory lets us filter equipment by location.', '/retailer'),
      select('#device-state', 'maintenance', 'Revisamos los equipos con mantenimiento pendiente.', 'We review devices with pending maintenance.', '/retailer'),
      select('#device-state', '', 'Volvemos al inventario completo autorizado.', 'We return to the complete authorized inventory.', '/retailer'),
    ],
    incidencias: [
      click('[data-filter="active"]', 'Consultamos las incidencias en curso.', 'We review ongoing incidents.', '/retailer'),
      point('.status-filters', 'Aquí se sigue el estado de cada intervención.', 'Intervention status is tracked here.', '/retailer'),
      click('[data-filter="rate"]', 'Consultamos las intervenciones pendientes de valoración.', 'We review interventions awaiting a rating.', '/retailer'),
      click('[data-filter="all"]', 'Recuperamos la vista de todas las incidencias.', 'We return to all incidents.', '/retailer'),
      click('#refresh', 'Actualizamos la consulta de estado.', 'We refresh the status query.', '/retailer'),
    ],
    itil: [
      point('#itil', 'El inventario ITIL relaciona grupos, posiciones y códigos de los equipos.', 'The ITIL inventory links device groups, positions and codes.', '/retailer'),
      point('.itil-controls', 'La operación conecta el equipo de cada tienda con su mantenimiento.', 'Operations connect each store device to its maintenance.', '/retailer'),
    ],
  },
};

export const APP = {
  schema: 'admira.demo/2',
  kind: 'demo',
  site: 'app',
  id: 'app',
  title: { es: 'admira.app', en: 'admira.app' },
  mode: 'recorrido',
  version: 1,
  status: 'published',
  subdemos: [
    ['establecimientos', 1, 'Establecimientos', 'Locations', ['establecimientos', 'locales']],
    ['inventario', 2, 'Inventario', 'Inventory', ['inventario', 'equipos']],
    ['incidencias', 3, 'Incidencias', 'Incidents', ['incidencias']],
    ['itil', 4, 'ITIL', 'ITIL', ['itil']],
  ].map(([id, n, es, en, aliases]) => ({
    id,
    n,
    title: { es, en },
    url: 'https://www.admira.app/retailer',
    mode: 'recorrido',
    aliases,
    steps: RECORRIDOS.app[id],
  })),
};
