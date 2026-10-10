/**
 * Historia pública de los cinco pilares (encargo #5548).
 * Dominio y rol salen de data/arquitectura.json. El verbo corto y el pilar
 * de Bits and Atoms (tecnología, creatividad, negocio) son el relato único
 * que leen la portada, /marcablanca, la API, /demo y el deck.
 * El token es el id del cargador de marca blanca en los clones; no es el nombre público.
 */
import DATOS from './arquitectura.json' with { type: 'json' };

const FICHA = {
  studio: { pilar: 'creatividad', verbo: 'crea', verboEn: 'creates', token: 'studio', ruta: '/crear', modoNativo: 'oscuro' },
  store: { pilar: 'negocio', verbo: 'distribuye', verboEn: 'distributes', token: 'store', ruta: '/gemelos', modoNativo: 'oscuro' },
  tv: { pilar: 'tecnologia', verbo: 'emite', verboEn: 'broadcasts', token: 'tv', ruta: '/', modoNativo: 'oscuro' },
  app: { pilar: 'tecnologia', verbo: 'mantiene', verboEn: 'maintains', token: 'yokup', ruta: '/incidencias', modoNativo: 'claro' },
  biz: { pilar: 'negocio', verbo: 'comercializa', verboEn: 'sells', token: 'app', ruta: '/', modoNativo: 'oscuro' }
};

/** Cadena visible: crear, distribuir, emitir, mantener, comercializar. */
export const ORDEN = ['studio', 'store', 'tv', 'app', 'biz'];

function rolPublico(rol) {
  return String(rol || '')
    .replace(/\s*El sitio anterior era el de Yokup\.?/gi, '')
    .replace(/\s*The previous site was Yokup's\.?/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function patas() {
  const nodos = (DATOS.nodos || []).filter((n) => n.tipo === 'pata');
  return ORDEN.map((id) => {
    const n = nodos.find((x) => x.id === id);
    const f = FICHA[id];
    if (!n || !f) throw new Error('arquitectura sin la pata ' + id);
    const url = String(n.url || '').endsWith('/') ? n.url : String(n.url || '') + '/';
    return {
      id,
      dominio: n.dominio,
      url,
      pilar: f.pilar,
      verbo: f.verbo,
      verboEn: f.verboEn,
      token: f.token,
      ruta: f.ruta,
      modoNativo: f.modoNativo,
      nombre: n.dominio,
      rol: rolPublico(n.es && n.es.rol),
      rolEn: rolPublico(n.en && n.en.rol)
    };
  });
}

/** Objeto `plataformas` de GET /marcablanca/api/marcas. Sin tokens internos. */
export function plataformasCatalogo() {
  const salida = {};
  for (const p of patas()) {
    salida[p.id] = {
      nombre: p.dominio,
      verbo: p.verbo,
      dominio: p.dominio,
      pilar: p.pilar,
      rol: p.rol,
      modoNativo: p.modoNativo
    };
  }
  return salida;
}
