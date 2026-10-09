// Modelo del editor de demos. No toca la red ni el DOM: lo usa la página y las pruebas.
export const ESQUEMA = 'admira.demo/2';
export const SITIOS = [
  { id: 'biz', color: '#FFCC00', es: 'admira.biz', en: 'admira.biz' },
  { id: 'app', color: '#7ce8d8', es: 'admira.app', en: 'admira.app' },
  { id: 'store', color: '#33FF99', es: 'admira.store', en: 'admira.store' },
  { id: 'studio', color: '#FF33CC', es: 'Admira Studio', en: 'Admira Studio' },
  { id: 'tv', color: '#FF3366', es: 'admira.tv', en: 'admira.tv' },
];
export const OPS = ['navigate', 'say', 'point', 'click', 'open', 'close', 'fill', 'select', 'video', 'audio', 'wait', 'cli', 'check', 'native'];
export { urlDePieza } from '../../subdemos/macro-url.mjs';

export const TEXTO = {
  es: {
    titulo: 'Editor de demos',
    guardar: 'Guardar borrador',
    publicar: 'Publicar',
    ejecutar: 'Ejecutar macrodemo',
    deshacer: 'Deshacer',
    atajo: 'Deshacer con Ctrl+Z',
    buscar: 'Buscar demos, subdemos o macros',
    macros: 'Macrodemos',
    masDemo: '+ Demo',
    masSub: '+ Subdemo',
    masMacro: '+ Macro',
    duplicar: 'Duplicar',
    borrar: 'Borrar',
    soltar: 'Soltar aquí',
    anadir: '+ Añadir paso',
    probar: 'Probar paso',
    desde: 'Desde aquí',
    elegir: 'Elegir',
    voz: 'Voz al probar',
    accion: 'Acción',
    selector: 'Selector',
    texto: 'Texto',
    espera: 'Espera',
    elementos: 'elementos',
    sitios: 'sitios',
    duracion: 'duración',
    estado: 'estado',
    comando: 'comando',
    borrador: 'borrador',
    publicada: 'publicada',
    salto: 'Siguiente tramo',
    vacio: 'Arrastra una subdemo desde la biblioteca.',
    sinPasos: 'Elige una subdemo para ver sus pasos.',
    confirmar: '¿Seguro que quieres borrarlo?',
    cancelar: 'Cancelar',
    aceptar: 'Aceptar',
    sesion: 'Para guardar hace falta una sesión de editor.',
    parar: 'Parar',
    biblioteca: 'Biblioteca',
  },
  en: {
    titulo: 'Demo editor',
    guardar: 'Save draft',
    publicar: 'Publish',
    ejecutar: 'Run macro',
    deshacer: 'Undo',
    atajo: 'Undo with Ctrl+Z',
    buscar: 'Search demos, subdemos or macros',
    macros: 'Macro demos',
    masDemo: '+ Demo',
    masSub: '+ Subdemo',
    masMacro: '+ Macro',
    duplicar: 'Duplicate',
    borrar: 'Delete',
    soltar: 'Drop here',
    anadir: '+ Add step',
    probar: 'Try step',
    desde: 'From here',
    elegir: 'Choose',
    voz: 'Voice when trying',
    accion: 'Action',
    selector: 'Selector',
    texto: 'Text',
    espera: 'Wait',
    elementos: 'items',
    sitios: 'sites',
    duracion: 'duration',
    estado: 'status',
    comando: 'command',
    borrador: 'draft',
    publicada: 'published',
    salto: 'Next segment',
    vacio: 'Drag a subdemo from the library.',
    sinPasos: 'Choose a subdemo to see its steps.',
    confirmar: 'Delete this? This cannot be undone from the screen.',
    cancelar: 'Cancel',
    aceptar: 'Confirm',
    sesion: 'Saving needs an editor session.',
    parar: 'Stop',
    biblioteca: 'Library',
  },
};

const clon = (value) => JSON.parse(JSON.stringify(value));

export function t(lang, clave) {
  return (TEXTO[lang] || TEXTO.es)[clave] || TEXTO.es[clave] || clave;
}

export function letra(n) {
  return Number.isInteger(n) && n >= 1 && n <= 26 ? String.fromCharCode(96 + n) : '·';
}

export function sitioDe(ref) {
  return String(ref || '').split('/')[0];
}

export function colorDe(site) {
  return SITIOS.find((item) => item.id === site)?.color || '#9aa';
}

export function duracionDe(demo, sub) {
  const legado = demo?.legacy?.manifest?.subdemos?.find((item) => item.id === sub?.id);
  if (legado && Number(legado.duracion) > 0) return Number(legado.duracion);
  const steps = sub?.steps || [];
  if (!steps.length) return 8;
  return steps.reduce((sum, step) => sum + (step.op === 'wait' ? Number(step.seconds) || 0 : 4), 0);
}

export function textoDuracion(segundos, lang) {
  const total = Math.max(0, Math.round(Number(segundos) || 0));
  const minutos = Math.floor(total / 60);
  const resto = total % 60;
  const unidad = lang === 'en' ? 'min' : 'min';
  if (minutos && resto) return minutos + ' ' + unidad + ' ' + resto + ' s';
  if (minutos) return minutos + ' ' + unidad;
  return resto + ' s';
}

export function localizar(demos, ref) {
  const [site, id] = String(ref || '').split('/');
  const candidatos = demos.filter((demo) => demo.kind === 'demo' && demo.site === site);
  const ordenados = candidatos.sort((a, b) => (a.id === a.site ? 0 : 1) - (b.id === b.site ? 0 : 1));
  for (const demo of ordenados) {
    const sub = demo.subdemos.find((item) => item.id === id);
    if (sub) return { demo, sub };
  }
  return { demo: null, sub: null };
}

export function filasMacro(items, transition, lang) {
  const filas = [];
  items.forEach((item, index) => {
    if (index > 0 && sitioDe(item.ref) !== sitioDe(items[index - 1].ref)) {
      filas.push({
        kind: 'salto',
        card: transition?.card || t(lang, 'salto'),
        seconds: Number(transition?.seconds ?? 3),
      });
    }
    filas.push({ kind: 'pieza', index, ref: item.ref });
  });
  return filas;
}

export function moverItem(items, desde, hasta) {
  const next = items.slice();
  if (desde < 0 || desde >= next.length || hasta < 0 || hasta > next.length) return next;
  const [item] = next.splice(desde, 1);
  const destino = desde < hasta ? hasta - 1 : hasta;
  next.splice(destino, 0, item);
  return next;
}

export function quitarItem(items, index) {
  return items.filter((_, posicion) => posicion !== index);
}

export function resumenMacro(items, demos, status, lang) {
  const sitios = new Set(items.map((item) => sitioDe(item.ref)));
  const duracion = items.reduce((sum, item) => {
    const { demo, sub } = localizar(demos, item.ref);
    return sum + (sub ? duracionDe(demo, sub) : 0);
  }, 0);
  return {
    elementos: items.length,
    sitios: sitios.size,
    duracion,
    estado: status === 'published' ? t(lang, 'publicada') : t(lang, 'borrador'),
    comando: items.map((item) => '/demo ' + item.ref).join(' · ') || '/demo editor',
  };
}

export function coincide(partes, consulta) {
  const q = String(consulta || '').trim().toLowerCase();
  if (!q) return true;
  return partes.join(' ').toLowerCase().includes(q);
}

export function crearHistorial(estado) {
  return { pasado: [], futuro: [], actual: clon(estado) };
}

export function anotar(historial, estado) {
  historial.pasado.push(historial.actual);
  if (historial.pasado.length > 40) historial.pasado.shift();
  historial.actual = clon(estado);
  historial.futuro = [];
  return historial;
}

export function deshacer(historial) {
  if (!historial.pasado.length) return false;
  historial.futuro.push(historial.actual);
  historial.actual = historial.pasado.pop();
  return true;
}

export function macroVacia(id) {
  return {
    schema: ESQUEMA,
    kind: 'macro',
    id: id || '',
    title: { es: 'Nueva macro', en: 'New macro' },
    context: { marca: 'admira', project: id || 'macro', circuit: id || 'macro', lang: 'es' },
    transition: { card: 'Siguiente tramo', seconds: 3 },
    items: [],
    status: 'draft',
    version: 1,
  };
}

export function documentoMacro(macro) {
  return {
    schema: ESQUEMA,
    kind: 'macro',
    id: macro.id,
    title: { es: macro.title.es, en: macro.title.en },
    context: { ...macro.context },
    transition: { card: macro.transition.card, seconds: Number(macro.transition.seconds) },
    items: macro.items.map((item) => ({ ref: item.ref })),
    status: 'draft',
    version: macro.version || 1,
  };
}

export function pasoVacio(op) {
  const text = { es: 'Nuevo paso', en: 'New step' };
  if (op === 'navigate' || op === 'video' || op === 'audio') return { op, url: 'https://www.admiranext.com/demo/' };
  if (op === 'click' || op === 'open' || op === 'point') return { op, selector: 'body', text };
  if (op === 'fill' || op === 'select') return { op, selector: 'body', value: 'demo' };
  if (op === 'wait') return { op, seconds: 1 };
  if (op === 'cli') return { op, command: '/demo help' };
  if (op === 'check') return { op, expect: 'ok' };
  if (op === 'native') return { op, id: 'tv' };
  if (op === 'close') return { op };
  return { op: 'say', text };
}

export function agregarSubdemo(demo, campos) {
  const siguiente = demo.subdemos.reduce((max, sub) => Math.max(max, sub.n), 0) + 1;
  const sub = {
    id: campos.id,
    n: siguiente,
    title: { es: campos.es, en: campos.en },
    url: campos.url,
    mode: demo.mode || 'recorrido',
    aliases: [],
    steps: [pasoVacio('say')],
  };
  sub.steps[0].text = { es: campos.es, en: campos.en };
  return { ...demo, subdemos: demo.subdemos.concat(sub) };
}

export function duplicarSubdemo(demo, id) {
  const origen = demo.subdemos.find((sub) => sub.id === id);
  if (!origen) return demo;
  let nuevo = id + '-copia';
  let n = 2;
  while (demo.subdemos.some((sub) => sub.id === nuevo)) nuevo = id + '-copia-' + (n++);
  const copia = clon(origen);
  copia.id = nuevo;
  copia.n = demo.subdemos.reduce((max, sub) => Math.max(max, sub.n), 0) + 1;
  return { ...demo, subdemos: demo.subdemos.concat(copia) };
}

export function quitarSubdemo(demo, id) {
  if (demo.subdemos.length < 2) return demo;
  return { ...demo, subdemos: demo.subdemos.filter((sub) => sub.id !== id) };
}

export function duplicarMacro(macro, id) {
  const copia = clon(macro);
  copia.id = id;
  copia.version = 1;
  copia.status = 'draft';
  copia.title = { es: macro.title.es + ' copia', en: macro.title.en + ' copy' };
  return copia;
}

export function demoNueva(site, campos) {
  return {
    schema: ESQUEMA,
    kind: 'demo',
    site,
    id: campos.id || site,
    title: { es: campos.es, en: campos.en },
    mode: 'recorrido',
    version: 1,
    status: 'draft',
    subdemos: [{
      id: campos.subId,
      n: 1,
      title: { es: campos.subEs, en: campos.subEn },
      url: campos.url,
      mode: 'recorrido',
      aliases: [],
      steps: [{ op: 'say', text: { es: campos.subEs, en: campos.subEn } }],
    }],
  };
}

export function selectoresConocidos(demo) {
  const vistos = new Set();
  for (const sub of demo?.subdemos || []) {
    for (const step of sub.steps || []) {
      if (step.selector) vistos.add(step.selector);
    }
  }
  return [...vistos];
}
