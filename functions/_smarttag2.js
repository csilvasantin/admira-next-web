import {validarAviso} from './_ubicacion.js';

// Contrato del adaptador, NO una respuesta supuesta de la API de Samsung.
// El proveedor autenticado debe entregar una medición del tag, no del teléfono.
export function normalizarSmartTag2(input, now = Date.now()) {
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      Object.keys(input).some(key => !['label','tipo','latitude','longitude','accuracy','battery','timestamp'].includes(key)) ||
      input.label !== 'Luka' || input.tipo !== 'smarttag2') {
    return validarAviso(null, now, 'luka');
  }
  return validarAviso({
    equipo:'luka', lat:input.latitude, lon:input.longitude,
    precision_m:input.accuracy, ts:input.timestamp,
    fuente:'smartthings-find',
    ...('battery' in input ? {bateria:input.battery} : {}),
  }, now, 'luka');
}
