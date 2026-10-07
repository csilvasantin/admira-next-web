// Validación compartida de catálogos editados. No ejecuta pasos ni modifica el catálogo global.
import {videoPorDemo} from './retail-videos.mjs?v=20261007-retail-video-1';
const PLATAFORMAS = new Set(['biz', 'store', 'studio']);
const MAX_BYTES = 200000;
const bytes = value => new TextEncoder().encode(value).byteLength;
function https(value, label) {
  if (typeof value !== 'string' || value.length > 2048) throw Error(label + ': URL HTTPS obligatoria');
  let url; try { url = new URL(value); } catch { throw Error(label + ': URL HTTPS obligatoria'); }
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) throw Error(label + ': URL HTTPS obligatoria');
  return value;
}
export function validarVideo(raw) {
  if (raw === null) return null;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw Error('Vídeo no válido');
  const keys = ['version','tipo','url','poster','duracion','audio','idioma','descripcion','fuente'];
  if (Object.keys(raw).some(key => !keys.includes(key)) || raw.version !== 1 || raw.tipo !== 'video') throw Error('Contrato de vídeo no válido');
  https(raw.url, 'Vídeo');
  if (raw.poster !== undefined) https(raw.poster, 'Póster de vídeo');
  if (raw.duracion !== undefined && (typeof raw.duracion !== 'number' || !Number.isFinite(raw.duracion) || raw.duracion <= 0 || raw.duracion > 300)) throw Error('Duración del vídeo no válida (0–300 segundos)');
  if (typeof raw.audio !== 'boolean' || !['es','en','ca'].includes(raw.idioma) || typeof raw.descripcion !== 'string' || raw.descripcion.length > 1000 || raw.fuente !== 'ensayo-local') throw Error('Metadatos de vídeo no válidos');
  return JSON.parse(JSON.stringify(raw));
}
export function validarSubdemo(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw Error('Subdemo no válida');
  const encoded = JSON.stringify(raw);
  if (bytes(encoded) > 30000) throw Error('Subdemo demasiado grande');
  const s = JSON.parse(encoded);
  if (!/^[a-z0-9-]{1,40}$/.test(s.id || '')) throw Error('ID: usa minúsculas, números y guiones (máximo 40)');
  for (const [key, max] of [['nombre',160],['desc',1000],['cmd',200],['letra',4]]) {
    if (s[key] !== undefined && (typeof s[key] !== 'string' || s[key].length > max)) throw Error('Campo no válido: ' + key);
  }
  if (!s.nombre?.trim()) throw Error('Nombre obligatorio');
  s.nombre = s.nombre.trim(); s.desc ||= '';
  https(s.url, 'Subdemo');
  if (s.ensayo_url) {
    if (s.ensayo_url.startsWith('/subdemos/ensayo.html?')) s.ensayo_url = new URL(s.ensayo_url, 'https://www.admiranext.com').href;
    else https(s.ensayo_url, 'Ensayo');
  }
  if (s.aliases !== undefined && (!Array.isArray(s.aliases) || s.aliases.length > 20 || s.aliases.some(x => typeof x !== 'string' || x.length > 80))) throw Error('Aliases no válidos');
  for (const key of ['steps', 'guion', 'pasos']) if (s[key] !== undefined && (!Array.isArray(s[key]) || s[key].length > 60)) throw Error('Pasos no válidos');
  if (s.muestra !== undefined && s.muestra !== null) {
    if (typeof s.muestra !== 'object' || Array.isArray(s.muestra)) throw Error('Muestra no válida');
    https(s.muestra.url, 'Muestra');
    if (s.muestra.variantes !== undefined) {
      if (!Array.isArray(s.muestra.variantes) || s.muestra.variantes.length > 20) throw Error('Variantes no válidas');
      for (const v of s.muestra.variantes) https(v?.url, 'Variante');
    }
  }
  if (s.video !== undefined) s.video = validarVideo(s.video);
  return s;
}
export function normalizarCatalogo(raw = []) {
  if (!Array.isArray(raw) || raw.length > 3 || bytes(JSON.stringify(raw)) > MAX_BYTES) throw Error('Catálogo no válido (máximo tres plataformas y 200 KB)');
  const seen = new Set();
  return raw.map(m => {
    if (!m || m.version !== undefined && m.version !== 1 || !PLATAFORMAS.has(m.plataforma) || seen.has(m.plataforma) || !Array.isArray(m.subdemos) || m.subdemos.length > 40) throw Error('Manifiesto no válido');
    seen.add(m.plataforma);
    const subdemos = m.subdemos.map(validarSubdemo);
    if (new Set(subdemos.map(s => s.id)).size !== subdemos.length) throw Error('IDs repetidos');
    return {...JSON.parse(JSON.stringify(m)), version:1, subdemos};
  });
}
export function catalogoActual(globales) {
  return normalizarCatalogo(globales.map(g => ({version:1, plataforma:g.id, subdemos:g.subdemos})));
}
export function guardarSubdemo(catalogo, plataforma, raw, originalId = '') {
  const result = normalizarCatalogo(catalogo), s = validarSubdemo(raw), m = result.find(x => x.plataforma === plataforma);
  if (!m) throw Error('Plataforma desconocida');
  if (originalId && s.id !== originalId) throw Error('El ID de una subdemo existente es estable');
  if (!originalId && m.subdemos.some(x => x.id === s.id)) throw Error('Ya existe esa subdemo');
  const index = m.subdemos.findIndex(x => x.id === originalId);
  if (originalId && index < 0) throw Error('Subdemo desconocida');
  if (index < 0) m.subdemos.push(s); else m.subdemos[index] = s;
  return normalizarCatalogo(result);
}
export function borrarSubdemo(catalogo, plataforma, id) {
  const result = normalizarCatalogo(catalogo), m = result.find(x => x.plataforma === plataforma);
  if (!m || !m.subdemos.some(s => s.id === id)) throw Error('Subdemo desconocida');
  m.subdemos = m.subdemos.filter(s => s.id !== id);
  return result;
}
export function guionDeCatalogo(demos, globales, catalogo = [], anteriores = {}) {
  const overrides = normalizarCatalogo(catalogo), set = new Set(demos), result = [];
  for (const g of globales) {
    if (set.has(g.id)) result.push({clave:g.id,titulo:g.nombre,desc:g.desc,url:g.url,cmd:'/demo '+g.id,steps:[],guion:[],muestra:null});
    const subs = overrides.find(m => m.plataforma === g.id)?.subdemos ?? g.subdemos;
    const fallback=anteriores[g.id]||[];
    const entries = [...subs, ...fallback.filter(s => !subs.some(x => x.id === s.id))];
    for (const s of entries) if (set.has(g.id+'/'+s.id)) result.push({...s,clave:g.id+'/'+s.id,titulo:g.nombre+' · '+(s.letra?s.letra+'. ':'')+s.nombre,desc:s.desc||'',cmd:s.cmd||'',steps:s.steps||[],guion:s.guion||[],muestra:s.muestra||null,video:videoPorDemo({clave:g.id+'/'+s.id,video:s.video})});
  }
  return result;
}
