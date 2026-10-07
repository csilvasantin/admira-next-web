import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MANIFIESTOS_NEGOCIO} from '../subdemos/negocio.mjs';
import {GLOBALES, PROYECTOS_INICIALES, aplicarManifiesto, resolver, guion, guionTexto} from '../subdemos/catalogo.mjs';

const manifests = ['store', 'biz'].map(id => JSON.parse(readFileSync(new URL('../subdemos/' + id + '.subdemos.json', import.meta.url), 'utf8')));

test('manifiestos publicados, fallback y catálogo describen las mismas cinco funciones', () => {
  assert.deepEqual(MANIFIESTOS_NEGOCIO, manifests);
  const ids = {store: ['voz', 'musica', 'imagenes', 'video', 'tpv'], biz: ['proyecto', 'circuito', 'gemelo', 'iot', 'itil']};
  for (const m of manifests) {
    assert.equal(m.version, 1);
    assert.equal(m.default_mode, 'recorrido');
    assert.deepEqual(m.subdemos.map(d => d.id), ids[m.plataforma]);
    assert.deepEqual(GLOBALES.find(g => g.id === m.plataforma).subdemos, m.subdemos);
    assert.deepEqual(m.subdemos.map(d => d.cmd), ['/demo 1', '/demo 2', '/demo 3', '/demo 4', '/demo 5']);
    assert.deepEqual(m.subdemos.map(d => d.letra), ['a', 'b', 'c', 'd', 'e']);
    const aliases = m.subdemos.flatMap(d => d.aliases);
    assert.equal(new Set(aliases).size, aliases.length, 'ningún alias selecciona dos funciones');
  }
  assert.deepEqual(manifests[0].subdemos[4].aliases, ['caja', 'tpv', 'venta']);
  for (const host of ['xpaceos.com', 'www.xpaceos.com']) assert.ok(manifests[0].activacion.hosts.includes(host));
});

test('cada recorrido abre el ensayo correspondiente y conserva datos sin acciones de alta real', () => {
  for (const m of manifests) for (const d of m.subdemos) {
    const ensayo = new URL(d.ensayo_url);
    assert.equal(ensayo.pathname, '/subdemos/ensayo.html');
    assert.equal(ensayo.searchParams.get('plataforma'), m.plataforma);
    assert.equal(ensayo.searchParams.get('demo'), d.id);
    assert.equal(new URL(d.url).protocol, 'https:');
    assert.ok(d.caso && Object.keys(d.caso).length);
    assert.ok(d.guion.length >= 3);
    assert.ok(d.guion.every(p => ['di', 'señala'].includes(p.accion) && p.texto));
    assert.deepEqual(d.steps, []);
    if (d.muestra) {
      assert.ok(['audio', 'image', 'video'].includes(d.muestra.tipo));
      assert.equal(new URL(d.muestra.url).origin, 'https://www.pixeria.com');
    }
  }
});

test('circuito, gemelo, IoT e inventario ITIL se relacionan con IDs de un único caso', () => {
  const [proyecto, circuito, gemelo, iot, itil] = manifests[1].subdemos.map(d => d.caso);
  assert.equal(proyecto.circuito, circuito.id);
  assert.equal(circuito.proyecto, proyecto.id);
  assert.equal(gemelo.proyecto, proyecto.id);
  assert.equal(iot.gemelo, gemelo.gemelo);
  assert.equal(itil.ubicacion, gemelo.gemelo);
  assert.deepEqual(itil.elementos.map(e => e.dispositivo), iot.dispositivos.map(d => d.id));
  assert.equal(new Set(iot.dispositivos.map(d => d.id)).size, 4);
  assert.deepEqual(iot.dispositivos.map(d => d.tipo), ['Pantalla', 'Altavoz', 'Cámara', 'Tótem']);
  assert.equal(circuito.puntos.length, 3);
  assert.ok(circuito.vuelo.inicio <= circuito.vuelo.fin);
  assert.ok(Number.isFinite(Date.parse(circuito.vuelo.inicio)) && Number.isFinite(Date.parse(circuito.vuelo.fin)));
  assert.ok(circuito.vuelo.pieza_segundos > 0 && circuito.vuelo.franjas.length);
});

test('guion inicial incluye los diez recorridos Store/Biz y el caso junto al enlace de ensayo', () => {
  const pasos = guion(PROYECTOS_INICIALES[0].demos);
  for (const m of manifests) for (const d of m.subdemos) {
    const p = pasos.find(p => p.clave === m.plataforma + '/' + d.id);
    assert.ok(p);
    assert.equal(p.cmd, d.cmd);
    assert.deepEqual(p.caso, d.caso);
    assert.deepEqual(p.guion, d.guion);
    assert.equal(p.ensayo_url, d.ensayo_url);
  }
  const texto = guionTexto(PROYECTOS_INICIALES[0]);
  assert.match(texto, /Gestión de locuciones/);
  assert.match(texto, /Dar de alta un circuito DooH/);
  for (const m of manifests) for (const d of m.subdemos) assert.ok(texto.includes('Ensayo: ' + d.ensayo_url));
  assert.doesNotMatch(texto, /\[object Object\]/);
});

test('aplicar un manifiesto clona el caso y guion para evitar mutaciones del objeto externo', () => {
  for (const original of manifests) {
    const grupo = GLOBALES.find(g => g.id === original.plataforma);
    const antes = grupo.subdemos;
    try {
      const m = structuredClone(original);
      aplicarManifiesto(m);
      m.subdemos[0].caso.estado = 'Cambio externo';
      m.subdemos[0].guion[0].texto = 'Cambio externo';
      assert.deepEqual(grupo.subdemos[0].caso, original.subdemos[0].caso);
      assert.deepEqual(grupo.subdemos[0].guion, original.subdemos[0].guion);
    } finally {grupo.subdemos = antes;}
  }
});

test('las funciones Store antiguas guardadas mantienen su significado y quedan fuera del catálogo nuevo', () => {
  const actuales = GLOBALES.find(g => g.id === 'store').subdemos.map(d => d.id);
  assert.ok(!actuales.includes('signage'));
  assert.equal(resolver('store/signage').sub.nombre, 'Digital signage');
  assert.equal(resolver('store/reglas').sub.cmd, '/ifthendothat');
  const old = guion(['store/signage', 'store/reglas']);
  assert.deepEqual(old.map(p => p.clave), ['store/signage', 'store/reglas']);
  assert.equal(old[1].cmd, '/ifthendothat');
});
