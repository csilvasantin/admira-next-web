/*!
 * Vista previa de marca blanca en /pruebas (encargos #5552 y #5566).
 * La URL pasa por /marcablanca/api/analizar, que no guarda la marca.
 * El logo se lee en este navegador y no se envía al servidor.
 * «Pide tu propuesta» crea una solicitud pendiente, no una propuesta.
 */
import {propuestaDesdeDatos, paletaDesdeColores, cssVariables, variablesMarca} from '/marcablanca/marca.js?v=20261001-catalogo';
import {coloresDeImagen, leerArchivo} from '/marcablanca/logo-paleta.js?v=20261001-catalogo';
import {pintar} from '/marcablanca/maquetas.js?v=20261002-propuesta';

// Cinco patas, en este orden: store, tv, app, studio, biz.
// El pintor de mantenimiento del catálogo se rotula App; el de campaña, Biz.
const PILARES = [
  {id: 'store', es: 'Admira.store · distribuye', en: 'Admira.store · distributes', pinta: 'store', ruta: 'admira.store/gemelos'},
  {id: 'tv', es: 'Admira.tv · emite', en: 'Admira.tv · broadcasts', ruta: 'admira.tv/'},
  {id: 'app', es: 'Admira.app · mantiene', en: 'Admira.app · maintains', pinta: 'yokup', busca: '<span class="mk-plat">Yokup</span>', rotulo: 'App', ruta: 'admira.app/incidencias'},
  {id: 'studio', es: 'Admira.Studio · crea', en: 'Admira.Studio · creates', pinta: 'studio', ruta: 'admira.studio/crear'},
  {id: 'biz', es: 'Admira.biz · comercializa', en: 'Admira.biz · sells', pinta: 'app', busca: '<span class="mk-plat">App</span>', rotulo: 'Biz', ruta: 'admira.biz/'}
];

const T = {
  es: {
    falta: 'Escribe una web https o sube un logo.',
    analizando: 'Analizando la web…',
    lista: 'Así se ve tu marca. No la hemos guardado.',
    logo: 'Paleta sacada del logo en este navegador. No la hemos guardado.',
    bloqueo: 'La web bloquea el análisis automático',
    fallo: 'No se pudo analizar',
    red: 'No se pudo contactar con el analizador.',
    logoMal: 'No he podido leer ese logo.',
    pideFalta: 'Escribe el nombre y un correo.',
    enviando: 'Enviando la solicitud…',
    pendiente: 'Solicitud pendiente. No se ha creado una propuesta.',
    limite: 'Has llegado al límite de solicitudes de hoy.',
    pideMal: 'No se pudo enviar la solicitud.'
  },
  en: {
    falta: 'Enter an https website or upload a logo.',
    analizando: 'Reading the website…',
    lista: 'This is your brand. We did not store it.',
    logo: 'Palette taken from the logo in this browser. We did not store it.',
    bloqueo: 'The website blocks automatic analysis',
    fallo: 'The website could not be read',
    red: 'The analyzer could not be reached.',
    logoMal: 'That logo could not be read.',
    pideFalta: 'Enter the name and an email.',
    enviando: 'Sending the request…',
    pendiente: 'Pending request. A proposal was not created.',
    limite: 'You have reached today’s request limit.',
    pideMal: 'The request could not be sent.'
  }
};

const $ = (id) => document.getElementById(id);
const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));

function idioma() {
  const actual = document.documentElement.lang;
  if (actual === 'en' || actual === 'es') return actual;
  const q = new URLSearchParams(location.search).get('lang');
  return q === 'en' ? 'en' : 'es';
}

function aplicarIdioma(lang) {
  document.documentElement.lang = lang === 'en' ? 'en' : 'es';
  const l = document.documentElement.lang;
  for (const el of document.querySelectorAll('[data-es]')) {
    el.textContent = el.getAttribute(l === 'en' ? 'data-en' : 'data-es') || '';
  }
  for (const el of document.querySelectorAll('[data-ph-es]')) {
    el.placeholder = el.getAttribute(l === 'en' ? 'data-ph-en' : 'data-ph-es') || '';
  }
  document.title = l === 'en' ? 'Your brand · preview' : 'Tu marca · vista previa';
  for (const id of ['vistaEstado', 'pideEstado']) {
    const n = $(id);
    if (n.dataset.clave && T[l][n.dataset.clave]) n.textContent = T[l][n.dataset.clave];
  }
  if (estado.marca) pintarShowrooms(estado.marca);
}

function decir(nodo, texto, tipo, clave) {
  nodo.dataset.clave = clave || '';
  nodo.dataset.tipo = tipo || '';
  nodo.textContent = clave ? (T[idioma()][clave] || texto) : texto;
}

const estado = {marca: null, web: ''};

function logoHtml(marca) {
  const src = marca.logo?.imagen || marca.logo?.svg || '';
  if (!src) return '';
  return `<img src="${esc(src)}" alt="">`;
}

function urlPilar(p, marcaId) {
  return (marcaId && marcaId !== 'admira' ? marcaId + '.' : '') + p.ruta;
}

function tvHtml(marca, logo) {
  const piezas = (marca.demo && marca.demo.piezas) || [];
  const canales = ['Pantalla vertical', 'Pantalla horizontal', 'Altavoz'];
  const filas = canales.map((canal, i) => {
    const pieza = piezas[i] || canal;
    return `<tr><td>${esc(pieza)}</td><td>${canal}</td><td><span class="mb-estado mb-estado--ok">En emisión</span></td></tr>`;
  }).join('');
  return `<div class="so"><header class="so-top"><span class="mb-logo so-logo" data-mb-logo>${logo}</span><span class="mk-plat">TV</span>` +
    `<nav class="so-nav"><a aria-current="page">Emisión</a><a>Playlists</a><a>Pantallas</a></nav></header>` +
    `<div class="so-body"><h4 class="mk-h">${esc(marca.nombreCorto || marca.nombre)} · en pantalla</h4>` +
    `<table class="mb-tabla"><thead><tr><th>Pieza</th><th>Canal</th><th>Estado</th></tr></thead><tbody>${filas}</tbody></table></div></div>`;
}

function maqueta(p, marca, logo) {
  if (p.id === 'tv') return tvHtml(marca, logo);
  const raw = pintar(p.pinta, marca, {logo});
  return p.rotulo ? raw.replace(p.busca, `<span class="mk-plat">${p.rotulo}</span>`) : raw;
}

function pintarShowrooms(marca) {
  const l = idioma() === 'en' ? 'en' : 'es';
  const caja = $('showrooms');
  const estilo = cssVariables(variablesMarca(marca, marca.modo));
  const logo = logoHtml(marca);
  caja.hidden = false;
  caja.innerHTML = PILARES.map((p) => {
    const etiqueta = l === 'en' ? p.en : p.es;
    return `<article class="mk" data-plataforma="${p.id}">
      <div class="mk-chrome"><span class="d"></span><span class="d"></span><span class="d"></span>
        <span class="mk-url">${esc(urlPilar(p, marca.id))}</span>
        <span class="mk-tag">${esc(etiqueta)}</span></div>
      <div class="mk-scope" style="${esc(estilo)}">${maqueta(p, marca, logo)}</div>
    </article>`;
  }).join('');
}

async function desdeLogo(file, nombre) {
  const data = await leerArchivo(file);
  const colores = await coloresDeImagen(data);
  const pal = paletaDesdeColores(colores);
  return propuestaDesdeDatos({
    nombre: nombre || (idioma() === 'en' ? 'Your brand' : 'Tu marca'),
    logo: data,
    primario: pal.primario,
    secundario: pal.secundario,
    acento: pal.acento
  });
}

async function desdeWeb(url, nombre, logoData) {
  const r = await fetch('/marcablanca/api/analizar', {
    method: 'POST',
    headers: {'content-type': 'application/json', accept: 'application/json'},
    body: JSON.stringify({url})
  });
  const body = await r.json().catch(() => ({}));
  if (r.status === 429) {
    const e = new Error(T[idioma()].limite + ' ' + (body.error || ''));
    e.tipo = 'limite';
    throw e;
  }
  if (!r.ok || !body.ok) {
    const dic = T[idioma()];
    const motivo = body.bloqueo ? dic.bloqueo : dic.fallo;
    const e = new Error(`${motivo}: ${body.error || r.status}`);
    e.tipo = 'error';
    throw e;
  }
  const datos = {...body.datos};
  if (nombre) datos.nombre = nombre;
  if (logoData) {
    datos.logo = logoData;
    try {
      const pal = paletaDesdeColores(await coloresDeImagen(logoData));
      Object.assign(datos, pal);
    } catch (_) {}
  }
  return propuestaDesdeDatos(datos);
}

$('vistaForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const lang = idioma();
  const nombre = $('vistaNombre').value.trim();
  const bruto = $('vistaWeb').value.trim();
  const file = $('vistaLogo').files && $('vistaLogo').files[0];
  if (!bruto && !file) { decir($('vistaEstado'), '', 'error', 'falta'); return; }
  const boton = e.target.querySelector('button');
  boton.disabled = true;
  decir($('vistaEstado'), '', '', 'analizando');
  try {
    let marca;
    if (bruto) {
      const url = /^https:\/\//i.test(bruto) ? bruto : 'https://' + bruto.replace(/^http:\/\//i, '');
      let logoData = '';
      if (file) logoData = await leerArchivo(file);
      marca = await desdeWeb(url, nombre, logoData);
      estado.web = url;
    } else {
      marca = await desdeLogo(file, nombre);
      estado.web = '';
    }
    estado.marca = marca;
    if (!$('vistaNombre').value.trim()) $('vistaNombre').value = marca.nombre;
    pintarShowrooms(marca);
    $('vistaAviso').hidden = false;
    $('vistaAviso').textContent = bruto ? T[lang].lista : T[lang].logo;
    decir($('vistaEstado'), marca.nombre, 'ok');
  } catch (error) {
    decir($('vistaEstado'), error.tipo === 'limite' ? error.message : (error.message || T[lang].logoMal), 'error');
  } finally {
    boton.disabled = false;
  }
});

$('pideForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const lang = idioma();
  const nombre = ($('vistaNombre').value.trim() || estado.marca?.nombre || '').trim();
  const email = $('pideEmail').value.trim();
  if (nombre.length < 2 || !email) { decir($('pideEstado'), '', 'error', 'pideFalta'); return; }
  const boton = e.target.querySelector('button');
  boton.disabled = true;
  decir($('pideEstado'), '', '', 'enviando');
  try {
    const r = await fetch('/pruebas/api/solicitud', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {'content-type': 'application/json', accept: 'application/json'},
      body: JSON.stringify({
        nombre,
        email,
        web: estado.web || $('vistaWeb').value.trim(),
        idioma: lang,
        nota: $('pideNota').value.trim()
      })
    });
    const body = await r.json().catch(() => ({}));
    if (r.status === 429) { decir($('pideEstado'), '', 'error', 'limite'); return; }
    if (!r.ok || body.estado !== 'pendiente' || body.propuesta) {
      decir($('pideEstado'), body.error || T[lang].pideMal, 'error');
      return;
    }
    decir($('pideEstado'), `${T[lang].pendiente} ${body.id || ''}`, 'ok');
  } catch (_) {
    decir($('pideEstado'), T[lang].pideMal, 'error');
  } finally {
    boton.disabled = false;
  }
});

document.addEventListener('admira:languagechange', (e) => {
  const n = e.detail && e.detail.lang;
  if (n === 'en' || n === 'es') aplicarIdioma(n);
});

aplicarIdioma(idioma());
const webInicial = new URLSearchParams(location.search).get('web');
if (webInicial) {
  $('vistaWeb').value = webInicial;
  $('vistaForm').requestSubmit();
}
