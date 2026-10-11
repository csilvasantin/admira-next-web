/* Local vocabulary, shared with the existing /idioma ES ↔ EN command. */
(function (G) {
  var A = G.AdmiraIdiomaArmazon;
  if (!A || !A.anadir) return;
  A.anadir({
    'Mapa de equipos':'Device map', 'Silicio':'Silicon', 'Fase 1':'Phase 1',
    'La última ubicación de cada equipo, en un solo lugar.':'The latest location of each device, in one place.',
    'Origen de los datos':'Data source', 'Datos reales':'Real data',
    'DEMO · Datos sintéticos. Estas ubicaciones no corresponden a equipos reales.':'DEMO · Synthetic data. These locations do not belong to real devices.',
    'Consultando ubicaciones…':'Loading locations…', 'Centrar equipos':'Fit devices', 'Actualizar':'Refresh',
    'Ubicaciones':'Locations', 'Mapa de ubicaciones de los equipos':'Device location map',
    'Aún no hay posiciones confirmadas. Los equipos sin ubicación se muestran en la lista.':'No confirmed positions yet. Devices without a location appear in the list.',
    'Leyenda':'Legend', 'Móvil':'Mobile', 'Fijo':'Fixed', 'Desactualizado':'Outdated', 'más de 2 h':'over 2 h',
    'Equipos':'Devices', 'Esperando datos…':'Waiting for data…',
    'Dato de prueba':'Test data', 'Inicia sesión para ver los equipos.':'Sign in to see the devices.',
    'Dato de prueba. No es un aviso del equipo.':'Test data. This is not a device report.',
    'Dato de prueba · DEMO':'Test data · DEMO',
    'Los móviles se actualizan desde el equipo. Los fijos utilizan una dirección manual.':'Mobile devices report their location. Fixed devices use a manual address.',
    'Pruebas':'Testing', 'acceso privado':'private access',
    'Se conserva un máximo de 7 días. El mapa muestra la última posición recibida.':'Data is kept for a maximum of 7 days. The map shows the latest received position.',
    'Lista de equipos':'Device list', 'Mapa':'Map', 'Actualizar ubicaciones':'Refresh locations',
    'Centrar todos los equipos':'Fit all devices', 'Datos':'Data', 'Ver datos reales':'View real data',
    'Probar demo sintética':'Try synthetic demo',
    'Más de 2 h sin aviso: desactualizado. Los equipos sin coordenadas permanecen en la lista.':'Over 2 h without a report: outdated. Devices without coordinates remain in the list.'
  });
  A.aplicar();
})(window);
