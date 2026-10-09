import {
  OPS, SITIOS, aSlug, agregarSubdemo, anotar, choque, colorDe, coincide, comandoDe, crearHistorial, demoNueva, deshacer,
  documentoMacro, duplicarMacro, duplicarSubdemo, duracionDe, filasMacro, letra, localizar,
  lineaEstado, macroVacia, moverItem, pasoVacio, quitarItem, quitarSubdemo, renombrarComando, resumenMacro, selectoresConocidos,
  sitioDe, slugValido, t, textoDuracion, urlDePieza,
} from './modelo.mjs';

const $ = (id) => document.getElementById(id);
const paramsIdioma = new URLSearchParams(location.search);
const marcaSinIdioma = !(paramsIdioma.get('lang') || '').trim() && (paramsIdioma.get('marca') || '').trim();
let idiomaExplicito = !marcaSinIdioma;
const langInicial = () => {
  const pedido = (paramsIdioma.get('lang') || '').trim();
  if (pedido) return pedido.slice(0, 2) === 'en' ? 'en' : 'es';
  if (marcaSinIdioma) return 'es';
  return (document.documentElement.lang || 'es').slice(0, 2) === 'en' ? 'en' : 'es';
};
if (marcaSinIdioma) document.documentElement.lang = 'es';

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

function buscarCorto() {
  return window.matchMedia('(max-width: 800px)').matches;
}

function aplicarIdioma() {
  document.documentElement.lang = estado.lang;
  $('h-biblioteca').textContent = t(estado.lang, 'biblioteca');
  $('h-macro').textContent = t(estado.lang, 'macroTitulo');
  $('h-pasos').textContent = t(estado.lang, 'pasos');
  $('h-inspector').textContent = t(estado.lang, 'inspector');
  $('tab-biblioteca').textContent = t(estado.lang, 'biblioteca');
  $('tab-macro').textContent = t(estado.lang, 'macroTitulo');
  $('tab-inspector').textContent = t(estado.lang, 'inspector');
  $('titulo').textContent = t(estado.lang, 'titulo');
  $('guardar').textContent = t(estado.lang, 'guardar');
  $('publicar').textContent = t(estado.lang, 'publicar');
  $('ejecutar').textContent = t(estado.lang, 'ejecutar');
  $('mas-acciones').setAttribute('aria-label', t(estado.lang, 'masAcciones'));
  const busca = t(estado.lang, buscarCorto() ? 'buscarCorto' : 'buscar');
  $('buscar').placeholder = busca;
  $('buscar').setAttribute('aria-label', busca);
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
  $('voz').setAttribute('aria-checked', $('voz').checked ? 'true' : 'false');
  $('reproductor-parar').textContent = t(estado.lang, 'parar');
  document.title = t(estado.lang, 'titulo') + ' · AdmiraNeXT';
}

function aviso(texto) {
  $('aviso').textContent = texto || '';
}

function anotarEnExperto(doc) {
  const api = window.AdmiraExperto;
  if (api && typeof api.anotarNombres === 'function') api.anotarNombres([doc.slug, ...(doc.aliases || [])]);
}

function abrirCampoSlug(chip, actual, aplicar) {
  if (!chip || document.querySelector('.slug-input')) return;
  const input = document.createElement('input');
  input.className = 'slug-input';
  input.value = actual || '';
  input.maxLength = 40;
  input.spellcheck = false;
  input.setAttribute('aria-label', t(estado.lang, 'slug'));
  const fijo = chip.id === 'pastilla';
  if (fijo) {
    chip.hidden = true;
    chip.after(input);
  } else chip.replaceWith(input);
  input.focus();
  input.select();
  let cerrado = false;
  const cerrar = (guardar) => {
    if (cerrado) return;
    cerrado = true;
    if (fijo) {
      input.remove();
      chip.hidden = false;
    }
    if (guardar) aplicar(input.value);
    else pintar();
  };
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') { event.preventDefault(); cerrar(true); }
    if (event.key === 'Escape') { event.preventDefault(); cerrar(false); }
  });
  input.addEventListener('blur', () => cerrar(true));
}

function abrirSlugMacro(id) {
  const macro = (id && estado.macros.find((item) => item.id === id)) || estado.macro;
  if (!macro) return;
  const fila = id
    ? [...document.querySelectorAll('#lista-macros button')].find((boton) => boton.querySelector('.slug') && boton.classList.contains('sel'))
    : null;
  const chip = (fila && fila.querySelector('.slug')) || $('pastilla');
  abrirCampoSlug(chip, comandoDe(macro) || aSlug(macro.title && macro.title.es), (valor) => confirmarSlugMacro(macro, valor));
}

function confirmarSlugMacro(macro, valor) {
  const propuesta = renombrarComando(macro.slug || macro.id ? macro : { ...macro, id: aSlug(valor) }, valor);
  if (!propuesta.ok || !slugValido(aSlug(valor))) { aviso(t(estado.lang, 'slugOcupado')); pintar(); return; }
  const doc = { ...propuesta.doc, kind: 'macro', id: macro.id || propuesta.doc.slug };
  if (choque(estado.demos.concat(estado.macros), doc)) { aviso(t(estado.lang, 'slugOcupado')); pintar(); return; }
  const enLista = estado.macros.find((item) => item.id === macro.id);
  tocar(() => {
    if (!estado.macro.id) estado.macro.id = doc.id;
    estado.macro.slug = doc.slug;
    estado.macro.aliases = doc.aliases || [];
    estado.macro.status = 'draft';
    if (enLista && enLista !== estado.macro) {
      enLista.slug = doc.slug;
      enLista.aliases = doc.aliases || [];
    }
  });
  anotarEnExperto(doc);
}

function abrirSlugSub(ref) {
  const { demo, sub } = localizar(estado.demos, ref);
  if (!demo || !sub) return;
  const chip = document.querySelector('#arbol li.sel .slug');
  abrirCampoSlug(chip, comandoDe(sub), (valor) => confirmarSlugSub(demo, sub, valor));
}

function confirmarSlugSub(demo, sub, valor) {
  const propuesta = renombrarComando(sub, valor);
  if (!propuesta.ok) { aviso(t(estado.lang, 'slugOcupado')); pintar(); return; }
  const copia = {
    ...demo,
    kind: 'demo',
    subdemos: demo.subdemos.map((item) => (item.id === sub.id ? propuesta.doc : item)),
  };
  if (choque(estado.demos.concat(estado.macros), copia)) { aviso(t(estado.lang, 'slugOcupado')); pintar(); return; }
  tocar(() => {
    Object.assign(sub, propuesta.doc);
    estado.sucios.add(demo.id);
  });
  anotarEnExperto(propuesta.doc);
}

function pintarBiblioteca() {
  const arbol = $('arbol');
  arbol.replaceChildren();
  let piezas = 0;
  for (const sitio of SITIOS) {
    const demos = estado.demos.filter((demo) => demo.site === sitio.id && demo.status !== 'deleted');
    const bloque = document.createElement('section');
    bloque.className = 'sitio';
    const cabeza = document.createElement('h3');
    cabeza.textContent = sitio[estado.lang];
    bloque.append(cabeza);
    bloque.style.borderLeftColor = sitio.color;
    const lista = document.createElement('ul');
    for (const demo of demos) {
      for (const sub of demo.subdemos) {
        const texto = titulo(sub.title) + ' ' + sub.id + ' ' + (sub.aliases || []).join(' ');
        if (!coincide([texto, sitio.id], estado.consulta)) continue;
        const li = document.createElement('li');
        li.draggable = true;
        li.dataset.ref = demo.site + '/' + sub.id;
        li.className = estado.ref === li.dataset.ref ? 'sel' : '';
        li.title = titulo(sub.title);
        const marca = document.createElement('b');
        marca.textContent = letra(sub.n);
        const nombre = document.createElement('span');
        nombre.className = 'titulo-demo';
        nombre.textContent = titulo(sub.title);
        const chip = document.createElement('small');
        chip.className = 'slug';
        chip.textContent = comandoDe(sub);
        chip.addEventListener('click', (event) => {
          event.stopPropagation();
          estado.ref = li.dataset.ref;
          estado.paso = -1;
          pintar();
          abrirSlugSub(li.dataset.ref);
        });
        nombre.addEventListener('click', (event) => {
          event.stopPropagation();
          estado.ref = li.dataset.ref;
          estado.paso = -1;
          pintar();
          abrirSlugSub(li.dataset.ref);
        });
        nombre.addEventListener('dblclick', (event) => {
          event.preventDefault();
          event.stopPropagation();
          abrirSlugSub(li.dataset.ref);
        });
        li.append(marca, nombre, chip);
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
        piezas += 1;
      }
    }
    if (!lista.childElementCount && estado.consulta) continue;
    if (!lista.childElementCount) {
      const guia = document.createElement('p');
      guia.className = 'guia';
      guia.dataset.vacio = 'sitio';
      guia.textContent = t(estado.lang, 'sinSubdemos').replace('{sitio}', sitio[estado.lang]);
      bloque.append(guia);
    } else bloque.append(lista);
    arbol.append(bloque);
  }
  const macros = $('lista-macros');
  macros.replaceChildren();
  let macrosVisibles = 0;
  for (const macro of estado.macros) {
    if (!coincide([titulo(macro.title), macro.id], estado.consulta)) continue;
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = estado.macro.id === macro.id ? 'sel' : '';
    const nombre = document.createElement('span');
    nombre.className = 'titulo-demo';
    nombre.textContent = titulo(macro.title);
    const chip = document.createElement('small');
    chip.className = 'slug';
    chip.textContent = comandoDe(macro);
    nombre.addEventListener('click', (event) => {
      event.stopPropagation();
      cargarMacro(macro);
      abrirSlugMacro(macro.id);
    });
    nombre.addEventListener('dblclick', (event) => {
      event.preventDefault();
      event.stopPropagation();
      abrirSlugMacro(macro.id);
    });
    chip.addEventListener('click', (event) => {
      event.stopPropagation();
      cargarMacro(macro);
      abrirSlugMacro(macro.id);
    });
    boton.addEventListener('dblclick', (event) => {
      event.preventDefault();
      cargarMacro(macro);
      abrirSlugMacro(macro.id);
    });
    boton.append(nombre, chip);
    boton.addEventListener('click', () => cargarMacro(macro));
    macros.append(boton);
    macrosVisibles += 1;
  }
  if (estado.consulta.trim() && piezas === 0 && macrosVisibles === 0) {
    const guia = document.createElement('p');
    guia.className = 'guia';
    guia.dataset.vacio = 'busqueda';
    guia.textContent = t(estado.lang, 'sinResultados').replace('{q}', estado.consulta.trim());
    arbol.append(guia);
  }
}

function pintarFila() {
  const fila = $('fila');
  fila.replaceChildren();
  const filas = filasMacro(estado.macro.items, estado.macro.transition, estado.lang);
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
    card.style.borderColor = colorDe(site);
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
  const soltar = $('soltar');
  soltar.replaceChildren();
  const avisoSoltar = document.createElement('strong');
  avisoSoltar.textContent = t(estado.lang, 'soltar');
  soltar.append(avisoSoltar);
  if (!estado.macro.items.length) {
    const guia = document.createElement('span');
    guia.className = 'guia';
    guia.dataset.vacio = 'macro';
    guia.textContent = t(estado.lang, 'guiaMacro');
    soltar.append(guia);
  }
  const datos = resumenMacro(estado.macro.items, estado.demos, estado.macro.status, estado.lang, comandoDe(estado.macro));
  $('resumen').textContent = lineaEstado(datos, estado.lang);
  $('pastilla').textContent = datos.comando;
  let nota = $('alias-nota');
  if (!nota) {
    nota = document.createElement('p');
    nota.id = 'alias-nota';
    nota.className = 'alias-nota';
    $('pastilla').after(nota);
  }
  nota.textContent = estado.macro.aliases && estado.macro.aliases.length
    ? t(estado.lang, 'alias') + ' ' + estado.macro.aliases.join(', ')
    : '';
  $('pastilla').onclick = () => abrirSlugMacro(estado.macro.id);
  $('pastilla').ondblclick = () => abrirSlugMacro(estado.macro.id);
}

function pintarPasos() {
  const lista = $('lista-pasos');
  lista.replaceChildren();
  const { sub } = piezaActual();
  if (!sub) {
    const p = document.createElement('p');
    p.className = 'guia';
    p.dataset.vacio = 'subdemo';
    p.textContent = t(estado.lang, 'sinSubdemo');
    lista.append(p);
    pintarInspector(null);
    return;
  }
  if (!sub.steps.length) {
    const p = document.createElement('p');
    p.className = 'guia';
    p.dataset.vacio = 'paso';
    p.textContent = t(estado.lang, 'sinPaso');
    lista.append(p);
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

function pasosActivos(activos) {
  $('probar').disabled = !activos;
  $('desde').disabled = !activos;
  $('borrar-paso').disabled = !activos;
}

function pintarInspector(sub) {
  const form = $('paso-form');
  form.replaceChildren();
  if (!sub || estado.paso < 0 || !sub.steps[estado.paso]) {
    const guia = document.createElement('p');
    guia.className = 'guia';
    guia.dataset.vacio = 'inspector';
    guia.textContent = t(estado.lang, 'eligePaso');
    form.append(guia);
    pasosActivos(false);
    return;
  }
  pasosActivos(true);
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

function planEjecutable() {
  return {
    ...estado.macro,
    items: estado.macro.items.map((item) => ({ ref: item.ref, subdemo: localizar(estado.demos, item.ref).sub })),
  };
}

function cargarReproductor() {
  if (window.AdmiraDemoMacro) return Promise.resolve(window.AdmiraDemoMacro);
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = '/suite/demo-control.js?v=20261009-marca-5463';
    const fallo = () => reject(new Error(estado.lang === 'en' ? 'The player did not load.' : 'No se pudo cargar el reproductor.'));
    script.onload = () => (window.AdmiraDemoMacro ? resolve(window.AdmiraDemoMacro) : fallo());
    script.onerror = fallo;
    document.head.appendChild(script);
  });
}

async function ejecutarMacro() {
  if (!estado.macro.id || estado.macro.status !== 'published') {
    aviso(estado.lang === 'en' ? 'Publish the macro before running it.' : 'Publica la macro antes de ejecutarla.');
    return;
  }
  const run = Date.now().toString(36);
  location.assign(urlDePieza(planEjecutable(), 0, run, estado.lang));
}

async function probarPasos(steps, desde) {
  try {
    const reproductor = await cargarReproductor();
    reproductor.probar(steps, { desde, lang: estado.lang });
  } catch (error) {
    aviso(error.message);
  }
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
$('mas-acciones').addEventListener('click', () => {
  const abierto = $('mas-acciones').closest('.acciones').classList.toggle('abierto');
  $('mas-acciones').setAttribute('aria-expanded', abierto ? 'true' : 'false');
});
document.querySelector('.pestanas').addEventListener('click', (event) => {
  const boton = event.target.closest('[role="tab"]');
  if (!boton) return;
  document.querySelector('.editor').dataset.panel = boton.id.replace('tab-', '');
  document.querySelectorAll('.pestanas [role="tab"]').forEach((nodo) => {
    nodo.setAttribute('aria-selected', nodo === boton ? 'true' : 'false');
  });
});
$('buscar').addEventListener('input', () => { estado.consulta = $('buscar').value; pintarBiblioteca(); });
window.addEventListener('resize', () => {
  const busca = t(estado.lang, buscarCorto() ? 'buscarCorto' : 'buscar');
  if ($('buscar').placeholder !== busca) {
    $('buscar').placeholder = busca;
    $('buscar').setAttribute('aria-label', busca);
  }
  margenBiblioteca();
});
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
  probarPasos([sub.steps[estado.paso]], 0);
});
$('desde').addEventListener('click', () => {
  const { sub } = piezaActual();
  if (!sub) return;
  probarPasos(sub.steps, Math.max(0, estado.paso));
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
$('voz').addEventListener('change', () => {
  estado.voz = $('voz').checked;
  $('voz').setAttribute('aria-checked', $('voz').checked ? 'true' : 'false');
});
$('reproductor-parar').addEventListener('click', () => { estado.parar = true; $('reproductor').hidden = true; window.speechSynthesis?.cancel(); });
window.addEventListener('keydown', tecla);
window.setLanguage = (lang) => {
  if (marcaSinIdioma && !idiomaExplicito) return;
  estado.lang = String(lang).startsWith('en') ? 'en' : 'es';
  pintar();
};

function margenBiblioteca() {
  const biblioteca = document.querySelector('.biblioteca');
  const rail = document.getElementById('ykExpertRail');
  if (!biblioteca || !rail || document.documentElement.classList.contains('yk-open-bottom')) return;
  const alto = Math.ceil(rail.getBoundingClientRect().height);
  if (alto > 0) biblioteca.style.setProperty('--editor-rail', `${alto}px`);
}
function permitirIdioma() {
  if (!marcaSinIdioma) return;
  const input = document.getElementById('ykCliInput');
  if (!input || !input.form || input.form.dataset.idiomaMarca) return;
  input.form.dataset.idiomaMarca = '1';
  input.form.addEventListener('submit', () => {
    const verbo = (input.value || '').trim().replace(/^\//, '').toLowerCase().split(/\s+/)[0] || '';
    if (/^(idioma|language|languague|brand|marca|help|ayuda|clear|limpiar|status|estado|go|ir)/.test(verbo)) {
      idiomaExplicito = true;
    }
  }, true);
}
function guardarIdiomaDeMarca() {
  if (!marcaSinIdioma || idiomaExplicito || document.documentElement.lang === 'es') return;
  document.documentElement.lang = 'es';
}

function lineaExperto() {
  const rail = document.getElementById('ykExpertRail');
  guardarIdiomaDeMarca();
  margenBiblioteca();
  permitirIdioma();
  if (!rail || document.documentElement.classList.contains('yk-open-bottom')) return;
  rail.inert = false;
  rail.setAttribute('aria-hidden', 'false');
}
function vigilarExperto() {
  lineaExperto();
  new MutationObserver(lineaExperto).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  const input = document.getElementById('ykCliInput');
  if (input && input.form) {
    input.form.addEventListener('submit', () => {
      if (window.AdmiraFrame && typeof window.AdmiraFrame.abrir === 'function') window.AdmiraFrame.abrir('bottom', true);
    });
  }
}
if (document.getElementById('ykExpertRail')) vigilarExperto();
else window.addEventListener('admira-frame:ready', vigilarExperto, { once: true });
arrancar();
