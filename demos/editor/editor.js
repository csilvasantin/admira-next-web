import {
  OPS, SITIOS, agregarSubdemo, anotar, colorDe, coincide, crearHistorial, demoNueva, deshacer,
  documentoMacro, duplicarMacro, duplicarSubdemo, duracionDe, filasMacro, letra, localizar,
  macroVacia, moverItem, pasoVacio, quitarItem, quitarSubdemo, resumenMacro, selectoresConocidos,
  sitioDe, t, textoDuracion,
} from './modelo.mjs';

const $ = (id) => document.getElementById(id);
const langInicial = () => (new URLSearchParams(location.search).get('lang') || document.documentElement.lang || 'es').slice(0, 2) === 'en' ? 'en' : 'es';

const estado = {
  lang: langInicial(),
  demos: [],
  macros: [],
  macro: macroVacia(''),
  macroExiste: false,
  sucios: new Set(),
  ref: '',
  paso: -1,
  voz: true,
  consulta: '',
  historial: null,
  parar: false,
};

function foto() {
  return {
    demos: estado.demos,
    macro: estado.macro,
    macroExiste: estado.macroExiste,
    sucios: [...estado.sucios],
    ref: estado.ref,
    paso: estado.paso,
  };
}

function restaurar(fotoEstado) {
  estado.demos = fotoEstado.demos;
  estado.macro = fotoEstado.macro;
  estado.macroExiste = fotoEstado.macroExiste;
  estado.sucios = new Set(fotoEstado.sucios);
  estado.ref = fotoEstado.ref;
  estado.paso = fotoEstado.paso;
  pintar();
}

function tocar(mutar) {
  if (!estado.historial) estado.historial = crearHistorial(foto());
  else anotar(estado.historial, foto());
  mutar();
  pintar();
}

function titulo(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value[estado.lang] || value.es || value.en || '';
}

function piezaActual() {
  return localizar(estado.demos, estado.ref);
}

function aplicarIdioma() {
  document.documentElement.lang = estado.lang;
  $('h-biblioteca').textContent = t(estado.lang, 'biblioteca');
  $('titulo').textContent = t(estado.lang, 'titulo');
  $('atajo').textContent = t(estado.lang, 'atajo');
  $('guardar').textContent = t(estado.lang, 'guardar');
  $('publicar').textContent = t(estado.lang, 'publicar');
  $('ejecutar').textContent = t(estado.lang, 'ejecutar');
  $('deshacer').textContent = t(estado.lang, 'deshacer');
  $('buscar').placeholder = t(estado.lang, 'buscar');
  $('buscar').setAttribute('aria-label', t(estado.lang, 'buscar'));
  $('h-macros').textContent = t(estado.lang, 'macros');
  $('mas-demo').textContent = t(estado.lang, 'masDemo');
  $('mas-sub').textContent = t(estado.lang, 'masSub');
  $('mas-macro').textContent = t(estado.lang, 'masMacro');
  $('duplicar').textContent = t(estado.lang, 'duplicar');
  $('borrar').textContent = t(estado.lang, 'borrar');
  $('anadir-paso').textContent = t(estado.lang, 'anadir');
  $('probar').textContent = t(estado.lang, 'probar');
  $('desde').textContent = t(estado.lang, 'desde');
  $('borrar-paso').textContent = t(estado.lang, 'borrar');
  $('voz-texto').textContent = t(estado.lang, 'voz');
  $('idioma-barra').textContent = estado.lang === 'en' ? 'ES' : 'EN';
  $('reproductor-parar').textContent = t(estado.lang, 'parar');
  document.title = t(estado.lang, 'titulo') + ' · AdmiraNeXT';
}

function aviso(texto) {
  $('aviso').textContent = texto || '';
}

function pintarBiblioteca() {
  const arbol = $('arbol');
  arbol.replaceChildren();
  for (const sitio of SITIOS) {
    const demos = estado.demos.filter((demo) => demo.site === sitio.id && demo.status !== 'deleted');
    const bloque = document.createElement('section');
    bloque.className = 'sitio';
    const cabeza = document.createElement('h3');
    const punto = document.createElement('i');
    punto.className = 'punto';
    punto.style.background = sitio.color;
    cabeza.append(punto, document.createTextNode(sitio[estado.lang]));
    bloque.append(cabeza);
    const lista = document.createElement('ul');
    for (const demo of demos) {
      for (const sub of demo.subdemos) {
        const texto = titulo(sub.title) + ' ' + sub.id + ' ' + (sub.aliases || []).join(' ');
        if (!coincide([texto, sitio.id], estado.consulta)) continue;
        const li = document.createElement('li');
        li.draggable = true;
        li.dataset.ref = demo.site + '/' + sub.id;
        li.className = estado.ref === li.dataset.ref ? 'sel' : '';
        const marca = document.createElement('b');
        marca.textContent = letra(sub.n);
        li.append(marca, document.createTextNode(' ' + titulo(sub.title)));
        li.addEventListener('dragstart', (event) => {
          event.dataTransfer.setData('text/plain', 'ref:' + li.dataset.ref);
          event.dataTransfer.effectAllowed = 'copy';
        });
        li.addEventListener('click', () => {
          estado.ref = li.dataset.ref;
          estado.paso = -1;
          pintar();
        });
        lista.append(li);
      }
    }
    if (!lista.childElementCount && estado.consulta) continue;
    bloque.append(lista);
    arbol.append(bloque);
  }
  const macros = $('lista-macros');
  macros.replaceChildren();
  for (const macro of estado.macros) {
    if (!coincide([titulo(macro.title), macro.id], estado.consulta)) continue;
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.textContent = titulo(macro.title);
    boton.className = estado.macro.id === macro.id ? 'sel' : '';
    boton.addEventListener('click', () => cargarMacro(macro));
    macros.append(boton);
  }
}

function pintarFila() {
  const fila = $('fila');
  fila.replaceChildren();
  const filas = filasMacro(estado.macro.items, estado.macro.transition, estado.lang);
  if (!filas.length) {
    const vacio = document.createElement('p');
    vacio.className = 'vacio';
    vacio.textContent = t(estado.lang, 'vacio');
    fila.append(vacio);
  }
  for (const filaItem of filas) {
    if (filaItem.kind === 'salto') {
      const salto = document.createElement('article');
      salto.className = 'salto';
      salto.textContent = filaItem.card + ' · ' + textoDuracion(filaItem.seconds, estado.lang);
      fila.append(salto);
      continue;
    }
    const { demo, sub } = localizar(estado.demos, filaItem.ref);
    const card = document.createElement('article');
    card.className = 'tarjeta' + (estado.ref === filaItem.ref ? ' sel' : '');
    card.draggable = true;
    card.dataset.index = String(filaItem.index);
    const site = sitioDe(filaItem.ref);
    card.innerHTML = '<button type="button" class="quitar" aria-label="×">×</button><i class="punto"></i><small></small><strong></strong><em></em>';
    card.querySelector('.punto').style.background = colorDe(site);
    card.querySelector('small').textContent = site + ' · ' + (sub ? letra(sub.n) : '·');
    card.querySelector('strong').textContent = sub ? titulo(sub.title) : filaItem.ref;
    card.querySelector('em').textContent = (sub ? textoDuracion(duracionDe(demo, sub), estado.lang) : '—') + ' · ' + ((sub && sub.steps.length) || 0);
    card.addEventListener('dragstart', (event) => {
      event.dataTransfer.setData('text/plain', 'move:' + filaItem.index);
      event.dataTransfer.effectAllowed = 'move';
    });
    card.addEventListener('dragover', (event) => event.preventDefault());
    card.addEventListener('drop', (event) => { event.preventDefault(); soltar(event.dataTransfer.getData('text/plain'), filaItem.index); });
    card.addEventListener('click', (event) => {
      if (event.target.classList.contains('quitar')) return;
      estado.ref = filaItem.ref;
      estado.paso = -1;
      pintar();
    });
    card.querySelector('.quitar').addEventListener('click', () => {
      tocar(() => { estado.macro.items = quitarItem(estado.macro.items, filaItem.index); estado.macro.status = 'draft'; });
    });
    fila.append(card);
  }
  $('soltar').textContent = t(estado.lang, 'soltar');
  const datos = resumenMacro(estado.macro.items, estado.demos, estado.macro.status, estado.lang);
  $('resumen').textContent = datos.elementos + ' ' + t(estado.lang, 'elementos')
    + ' · ' + datos.sitios + ' ' + t(estado.lang, 'sitios')
    + ' · ' + textoDuracion(datos.duracion, estado.lang) + ' ' + t(estado.lang, 'duracion')
    + ' · ' + datos.estado + ' ' + t(estado.lang, 'estado')
    + ' · ' + t(estado.lang, 'comando') + ' ' + datos.comando;
}

function pintarPasos() {
  const lista = $('lista-pasos');
  lista.replaceChildren();
  const { sub } = piezaActual();
  if (!sub) {
    const p = document.createElement('p');
    p.textContent = t(estado.lang, 'sinPasos');
    lista.append(p);
    $('paso-form').replaceChildren();
    return;
  }
  sub.steps.forEach((step, index) => {
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.draggable = true;
    boton.className = estado.paso === index ? 'sel' : '';
    boton.textContent = (index + 1) + '. ' + step.op + (step.text ? ' · ' + titulo(step.text) : '');
    boton.addEventListener('click', () => { estado.paso = index; pintar(); });
    boton.addEventListener('dragstart', (event) => event.dataTransfer.setData('text/plain', 'step:' + index));
    boton.addEventListener('dragover', (event) => event.preventDefault());
    boton.addEventListener('drop', (event) => {
      event.preventDefault();
      const data = event.dataTransfer.getData('text/plain');
      if (!data.startsWith('step:')) return;
      const desde = Number(data.slice(5));
      if (desde === index) return;
      tocar(() => {
        const actual = piezaActual();
        actual.sub.steps = moverItem(actual.sub.steps, desde, index);
        estado.sucios.add(actual.demo.id);
        estado.paso = desde < index ? index - 1 : index;
      });
    });
    lista.append(boton);
  });
  pintarInspector(sub);
}

function campo(form, etiqueta, nodo) {
  const label = document.createElement('label');
  label.append(document.createTextNode(etiqueta), nodo);
  form.append(label);
}

function pintarInspector(sub) {
  const form = $('paso-form');
  form.replaceChildren();
  if (estado.paso < 0 || !sub.steps[estado.paso]) return;
  const step = sub.steps[estado.paso];
  const accion = document.createElement('select');
  for (const op of OPS) {
    const option = document.createElement('option');
    option.value = op;
    option.textContent = op;
    option.selected = op === step.op;
    accion.append(option);
  }
  accion.addEventListener('change', () => tocar(() => {
    sub.steps[estado.paso] = pasoVacio(accion.value);
    estado.sucios.add(piezaActual().demo.id);
  }));
  campo(form, t(estado.lang, 'accion'), accion);
  if ('selector' in step || ['point', 'click', 'open', 'close', 'fill', 'select', 'check'].includes(step.op)) {
    const linea = document.createElement('span');
    linea.className = 'linea';
    const input = document.createElement('input');
    input.value = step.selector || '';
    input.addEventListener('change', () => tocar(() => { step.selector = input.value; estado.sucios.add(piezaActual().demo.id); }));
    const elegir = document.createElement('button');
    elegir.type = 'button';
    elegir.textContent = t(estado.lang, 'elegir');
    elegir.addEventListener('click', () => elegirSelector(step, input));
    linea.append(input, elegir);
    campo(form, t(estado.lang, 'selector'), linea);
  }
  if (step.text || ['say', 'point'].includes(step.op)) {
    const es = document.createElement('input');
    const en = document.createElement('input');
    es.value = step.text?.es || '';
    en.value = step.text?.en || '';
    const guardarTexto = () => tocar(() => {
      step.text = { es: es.value, en: en.value };
      estado.sucios.add(piezaActual().demo.id);
    });
    es.addEventListener('change', guardarTexto);
    en.addEventListener('change', guardarTexto);
    campo(form, t(estado.lang, 'texto') + ' ESP', es);
    campo(form, t(estado.lang, 'texto') + ' ENG', en);
  }
  if (step.op === 'wait') {
    const input = document.createElement('input');
    input.type = 'number';
    input.min = '1';
    input.max = '30';
    input.value = String(step.seconds || 1);
    input.addEventListener('change', () => tocar(() => { step.seconds = Number(input.value); estado.sucios.add(piezaActual().demo.id); }));
    campo(form, t(estado.lang, 'espera'), input);
  }
  if ('url' in step) {
    const input = document.createElement('input');
    input.value = step.url || '';
    input.addEventListener('change', () => tocar(() => { step.url = input.value; estado.sucios.add(piezaActual().demo.id); }));
    campo(form, 'URL', input);
  }
  if ('value' in step) {
    const input = document.createElement('input');
    input.value = step.value || '';
    input.addEventListener('change', () => tocar(() => { step.value = input.value; estado.sucios.add(piezaActual().demo.id); }));
    campo(form, estado.lang === 'en' ? 'Value' : 'Valor', input);
  }
  if ('command' in step) {
    const input = document.createElement('input');
    input.value = step.command || '';
    input.addEventListener('change', () => tocar(() => { step.command = input.value; estado.sucios.add(piezaActual().demo.id); }));
    campo(form, estado.lang === 'en' ? 'Command' : 'Comando', input);
  }
  if ('expect' in step) {
    const input = document.createElement('input');
    input.value = step.expect || '';
    input.addEventListener('change', () => tocar(() => { step.expect = input.value; estado.sucios.add(piezaActual().demo.id); }));
    campo(form, estado.lang === 'en' ? 'Expect' : 'Resultado', input);
  }
  if (step.op === 'native') {
    const input = document.createElement('input');
    input.value = step.id || '';
    input.addEventListener('change', () => tocar(() => { step.id = input.value; estado.sucios.add(piezaActual().demo.id); }));
    campo(form, 'ID', input);
  }
}

function pintar() {
  aplicarIdioma();
  pintarBiblioteca();
  pintarFila();
  pintarPasos();
}

function soltar(data, index) {
  if (!data) return;
  if (data.startsWith('ref:')) {
    const ref = data.slice(4);
    tocar(() => {
      const items = estado.macro.items.slice();
      items.splice(index, 0, { ref });
      estado.macro.items = items;
      estado.macro.status = 'draft';
      estado.ref = ref;
    });
  } else if (data.startsWith('move:')) {
    const desde = Number(data.slice(5));
    tocar(() => { estado.macro.items = moverItem(estado.macro.items, desde, index); estado.macro.status = 'draft'; });
  }
}

function cargarMacro(macro) {
  tocar(() => {
    estado.macro = JSON.parse(JSON.stringify(macro));
    estado.macro.items = (macro.items || []).map((item) => ({ ref: item.ref }));
    estado.macroExiste = true;
    estado.ref = estado.macro.items[0]?.ref || '';
    estado.paso = -1;
  });
}

async function preguntar(tituloDialogo, campos, confirmar) {
  $('dialogo-titulo').textContent = tituloDialogo;
  const caja = $('dialogo-campos');
  caja.replaceChildren();
  for (const campoDef of campos) {
    const label = document.createElement('label');
    label.textContent = campoDef.label;
    let input;
    if (campoDef.opciones) {
      input = document.createElement('select');
      for (const opcion of campoDef.opciones) {
        const option = document.createElement('option');
        option.value = opcion.value;
        option.textContent = opcion.label;
        input.append(option);
      }
    } else {
      input = document.createElement('input');
      input.value = campoDef.value || '';
    }
    input.name = campoDef.name;
    input.required = !!campoDef.required;
    label.append(input);
    caja.append(label);
  }
  $('dialogo-ok').textContent = confirmar ? t(estado.lang, 'aceptar') : t(estado.lang, 'aceptar');
  $('dialogo-cancel').textContent = t(estado.lang, 'cancelar');
  const dialogo = $('dialogo');
  return new Promise((resolve) => {
    const cerrar = () => {
      dialogo.removeEventListener('close', cerrar);
      if (dialogo.returnValue !== 'ok') resolve(null);
      else {
        const datos = {};
        caja.querySelectorAll('input,select').forEach((input) => { datos[input.name] = input.value; });
        resolve(datos);
      }
    };
    dialogo.addEventListener('close', cerrar);
    dialogo.showModal();
  });
}

async function elegirSelector(step, input) {
  const { demo } = piezaActual();
  const conocidos = selectoresConocidos(demo);
  const datos = await preguntar(t(estado.lang, 'elegir'), [
    { name: 'selector', label: t(estado.lang, 'selector'), value: step.selector || '', required: true },
    ...conocidos.slice(0, 8).map((selector, index) => ({ name: 'conocido' + index, label: selector, value: selector })),
  ]);
  if (!datos) return;
  const elegido = datos.selector || input.value;
  input.value = elegido;
  tocar(() => { step.selector = elegido; estado.sucios.add(demo.id); });
}

async function sesionEditor() {
  const respuesta = await fetch('/api/session', { credentials: 'same-origin', cache: 'no-store' });
  if (!respuesta.ok) return null;
  const datos = await respuesta.json();
  if (!datos.ok || !datos.csrf) return null;
  if (!['admin', 'editor'].includes(datos.user?.role)) return null;
  return datos;
}

async function enviar(method, path, body, sesionDatos) {
  const respuesta = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json', 'x-admira-csrf': sesionDatos.csrf },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const datos = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) throw new Error(datos.error || ('HTTP ' + respuesta.status));
  return datos;
}

async function guardar(publicar) {
  const sesionDatos = await sesionEditor();
  if (!sesionDatos) { aviso(t(estado.lang, 'sesion')); return; }
  if (!estado.macro.items.length) { aviso(estado.lang === 'en' ? 'The macro needs at least one subdemo.' : 'La macro necesita al menos una subdemo.'); return; }
  if (!estado.macro.id) {
    const datos = await preguntar('+ Macro', [
      { name: 'id', label: 'ID', required: true },
      { name: 'es', label: 'ESP', value: 'Biz con tres y app con dos', required: true },
      { name: 'en', label: 'ENG', value: 'Biz with three and app with two', required: true },
    ]);
    if (!datos) return;
    estado.macro.id = datos.id;
    estado.macro.title = { es: datos.es, en: datos.en };
    estado.macro.context.project = datos.id;
    estado.macro.context.circuit = datos.id;
  }
  try {
    for (const id of estado.sucios) {
      const demo = estado.demos.find((item) => item.id === id);
      if (!demo) continue;
      const guardada = await enviar('PUT', '/api/demos/' + encodeURIComponent(demo.id), { ...demo, status: 'draft' }, sesionDatos);
      Object.assign(demo, guardada);
    }
    estado.sucios.clear();
    const cuerpo = documentoMacro(estado.macro);
    const guardada = estado.macroExiste
      ? await enviar('PUT', '/api/demos/' + encodeURIComponent(estado.macro.id), cuerpo, sesionDatos)
      : await enviar('POST', '/api/demos', cuerpo, sesionDatos);
    estado.macro = guardada;
    estado.macro.items = guardada.items.map((item) => ({ ref: item.ref }));
    estado.macroExiste = true;
    if (publicar) {
      const publicada = await enviar('POST', '/api/demos/' + encodeURIComponent(estado.macro.id) + '/publish', undefined, sesionDatos);
      estado.macro.version = publicada.version;
      estado.macro.status = publicada.status;
      for (const demo of estado.demos.filter((item) => item.status === 'draft')) {
        const hecha = await enviar('POST', '/api/demos/' + encodeURIComponent(demo.id) + '/publish', undefined, sesionDatos);
        Object.assign(demo, hecha);
      }
    }
    aviso(publicar ? t(estado.lang, 'publicada') : t(estado.lang, 'borrador'));
    pintar();
  } catch (error) {
    aviso(error.message);
  }
}

function hablar(textoVoz) {
  if (!estado.voz || !window.speechSynthesis || !textoVoz) return;
  const frase = new SpeechSynthesisUtterance(textoVoz);
  frase.lang = estado.lang === 'en' ? 'en-GB' : 'es-ES';
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(frase);
}

function dormir(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function reproducir(steps, desde) {
  estado.parar = false;
  $('reproductor').hidden = false;
  for (let index = desde; index < steps.length; index++) {
    if (estado.parar) break;
    const step = steps[index];
    const frase = step.text ? titulo(step.text) : step.op;
    $('reproductor-texto').textContent = (index + 1) + '. ' + step.op + ' · ' + frase;
    if (step.op === 'say' || step.op === 'point') hablar(frase);
    const espera = step.op === 'wait' ? Math.min(Number(step.seconds) || 1, 8) * 1000 : 700;
    await dormir(espera);
  }
  if (!estado.parar) $('reproductor').hidden = true;
}

async function ejecutarMacro() {
  estado.parar = false;
  $('reproductor').hidden = false;
  let anterior = '';
  for (const item of estado.macro.items) {
    if (estado.parar) break;
    const site = sitioDe(item.ref);
    if (anterior && anterior !== site) {
      $('reproductor-texto').textContent = (estado.macro.transition.card || t(estado.lang, 'salto'));
      await dormir(Math.min(Number(estado.macro.transition.seconds) || 0, 4) * 1000);
    }
    anterior = site;
    const { sub } = localizar(estado.demos, item.ref);
    if (!sub) continue;
    $('reproductor-texto').textContent = site + ' · ' + titulo(sub.title);
    await reproducir(sub.steps, 0);
  }
  $('reproductor').hidden = true;
}

function reemplazarDemo(demo) {
  const index = estado.demos.findIndex((item) => item.id === demo.id);
  if (index >= 0) estado.demos[index] = demo;
  else estado.demos.push(demo);
  estado.sucios.add(demo.id);
}

async function altaDemo() {
  const libres = SITIOS.filter((sitio) => !estado.demos.some((demo) => demo.site === sitio.id && demo.id === sitio.id));
  const datos = await preguntar(t(estado.lang, 'masDemo'), [
    { name: 'site', label: estado.lang === 'en' ? 'Site' : 'Sitio', opciones: (libres.length ? libres : SITIOS).map((sitio) => ({ value: sitio.id, label: sitio[estado.lang] })) },
    { name: 'es', label: 'ESP', required: true },
    { name: 'en', label: 'ENG', required: true },
    { name: 'subId', label: 'ID', value: 'recorrido', required: true },
    { name: 'url', label: 'URL', value: 'https://www.admiranext.com/demo/', required: true },
  ]);
  if (!datos) return;
  const demo = demoNueva(datos.site, { id: datos.site, es: datos.es, en: datos.en, subId: datos.subId, subEs: datos.es, subEn: datos.en, url: datos.url });
  tocar(() => { estado.demos.push(demo); estado.sucios.add(demo.id); estado.ref = demo.site + '/' + datos.subId; });
}

async function altaSubdemo() {
  const { demo } = piezaActual();
  const base = demo || estado.demos.find((item) => item.kind === 'demo');
  if (!base) return;
  const datos = await preguntar(t(estado.lang, 'masSub'), [
    { name: 'id', label: 'ID', required: true },
    { name: 'es', label: 'ESP', required: true },
    { name: 'en', label: 'ENG', required: true },
    { name: 'url', label: 'URL', value: 'https://www.admiranext.com/demo/', required: true },
  ]);
  if (!datos) return;
  tocar(() => {
    const siguiente = agregarSubdemo(base, datos);
    reemplazarDemo(siguiente);
    estado.ref = siguiente.site + '/' + datos.id;
    estado.paso = 0;
  });
}

async function altaMacro() {
  if (!estado.macro.items.length) {
    aviso(estado.lang === 'en' ? 'Drop at least one subdemo first.' : 'Suelta al menos una subdemo antes.');
    return;
  }
  estado.macro.id = '';
  estado.macroExiste = false;
  await guardar(false);
}

async function duplicar() {
  const { demo, sub } = piezaActual();
  if (sub && demo) {
    tocar(() => {
      const siguiente = duplicarSubdemo(demo, sub.id);
      reemplazarDemo(siguiente);
      const copia = siguiente.subdemos[siguiente.subdemos.length - 1];
      estado.ref = siguiente.site + '/' + copia.id;
    });
    return;
  }
  if (!estado.macro.id) return;
  const datos = await preguntar(t(estado.lang, 'duplicar'), [{ name: 'id', label: 'ID', value: estado.macro.id + '-copia', required: true }]);
  if (!datos) return;
  const copia = duplicarMacro(estado.macro, datos.id);
  tocar(() => {
    estado.macros.push(copia);
    estado.macro = copia;
    estado.macroExiste = false;
  });
}

async function borrarSeleccion() {
  const seguro = await preguntar(t(estado.lang, 'confirmar'), []);
  if (!seguro) return;
  const { demo, sub } = piezaActual();
  if (sub && demo && demo.subdemos.length > 1) {
    tocar(() => {
      reemplazarDemo(quitarSubdemo(demo, sub.id));
      estado.ref = '';
      estado.paso = -1;
    });
    return;
  }
  if (!estado.macro.id || !estado.macroExiste) {
    tocar(() => { estado.macro = macroVacia(''); estado.macroExiste = false; });
    return;
  }
  const sesionDatos = await sesionEditor();
  if (!sesionDatos) { aviso(t(estado.lang, 'sesion')); return; }
  try {
    await enviar('DELETE', '/api/demos/' + encodeURIComponent(estado.macro.id), undefined, sesionDatos);
    estado.macros = estado.macros.filter((macro) => macro.id !== estado.macro.id);
    estado.macro = macroVacia('');
    estado.macroExiste = false;
    aviso(t(estado.lang, 'borrador'));
    pintar();
  } catch (error) {
    aviso(error.message);
  }
}

function tecla(event) {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z' && !event.shiftKey) {
    const campoActivo = document.activeElement;
    if (campoActivo && (campoActivo.tagName === 'INPUT' || campoActivo.tagName === 'TEXTAREA')) return;
    event.preventDefault();
    if (estado.historial && deshacer(estado.historial)) restaurar(estado.historial.actual);
  }
}

async function arrancar() {
  aplicarIdioma();
  try {
    const respuesta = await fetch('/api/demos', { cache: 'no-store' });
    const datos = await respuesta.json();
    estado.demos = datos.demos || [];
    estado.macros = datos.macros || [];
  } catch (error) {
    aviso(error.message);
  }
  estado.historial = crearHistorial(foto());
  pintar();
  const params = new URLSearchParams(location.search);
  if (params.get('ax_demo') === 'editor') aviso(estado.lang === 'en' ? 'Opened with /demo editor.' : 'Abierto con /demo editor.');
}

$('guardar').addEventListener('click', () => guardar(false));
$('publicar').addEventListener('click', () => guardar(true));
$('ejecutar').addEventListener('click', () => ejecutarMacro());
$('deshacer').addEventListener('click', () => { if (estado.historial && deshacer(estado.historial)) restaurar(estado.historial.actual); });
$('idioma-barra').addEventListener('click', () => { estado.lang = estado.lang === 'en' ? 'es' : 'en'; pintar(); });
$('buscar').addEventListener('input', () => { estado.consulta = $('buscar').value; pintarBiblioteca(); });
$('mas-demo').addEventListener('click', () => altaDemo());
$('mas-sub').addEventListener('click', () => altaSubdemo());
$('mas-macro').addEventListener('click', () => altaMacro());
$('duplicar').addEventListener('click', () => duplicar());
$('borrar').addEventListener('click', () => borrarSeleccion());
$('anadir-paso').addEventListener('click', () => {
  const { demo, sub } = piezaActual();
  if (!sub) return;
  tocar(() => {
    sub.steps = sub.steps.concat(pasoVacio('say'));
    estado.sucios.add(demo.id);
    estado.paso = sub.steps.length - 1;
  });
});
$('probar').addEventListener('click', () => {
  const { sub } = piezaActual();
  if (!sub || estado.paso < 0) return;
  reproducir([sub.steps[estado.paso]], 0);
});
$('desde').addEventListener('click', () => {
  const { sub } = piezaActual();
  if (!sub) return;
  reproducir(sub.steps, Math.max(0, estado.paso));
});
$('borrar-paso').addEventListener('click', () => {
  const { demo, sub } = piezaActual();
  if (!sub || estado.paso < 0) return;
  tocar(() => {
    sub.steps = sub.steps.filter((_, index) => index !== estado.paso);
    estado.sucios.add(demo.id);
    estado.paso = -1;
  });
});
$('soltar').addEventListener('dragover', (event) => event.preventDefault());
$('soltar').addEventListener('drop', (event) => {
  event.preventDefault();
  soltar(event.dataTransfer.getData('text/plain'), estado.macro.items.length);
});
$('voz').addEventListener('change', () => { estado.voz = $('voz').checked; });
$('reproductor-parar').addEventListener('click', () => { estado.parar = true; $('reproductor').hidden = true; window.speechSynthesis?.cancel(); });
window.addEventListener('keydown', tecla);
window.setLanguage = (lang) => { estado.lang = String(lang).startsWith('en') ? 'en' : 'es'; pintar(); };
arrancar();
