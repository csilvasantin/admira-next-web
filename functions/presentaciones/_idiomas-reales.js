// UNA COPIA DEL CASTELLANO NO ES UN IDIOMA (Alsea · Starbucks, 07-10-2026).
// La presentación declaraba ["es","en"], pero su «traducción» inglesa era una copia literal del
// castellano. El botón EN y ?lang=en traducían la cromática (secciones, botones) y dejaban el
// contenido en castellano: idiomas mezclados delante del cliente. El contenido base es el
// castellano por convención del modelo; cualquier otro idioma vive en ideas.translations[idioma].
// Aquí se retira, sin tocar lo guardado, el idioma cuya traducción repite el original.
//
// Lo que NO cambia: un idioma declarado sin traducción, o con la traducción a medias, se sigue
// ofreciendo y se ve incompleto. Es una decisión anterior y tiene su prueba
// (presentation-translation-review: «keeps absent and partial locales incomplete instead of
// silently falling back to Spanish»): que falte se tiene que notar, no taparse con castellano.

const CAMPOS_BLOQUE = ['title', 'message', 'detail', 'product', 'promise'];

function textos(valor = {}) {
  const salida = [valor.hero?.eyebrow, valor.hero?.title, valor.hero?.summary, valor.objective, valor.closing?.title, valor.closing?.action];
  for (const bloque of Array.isArray(valor.skeleton) ? valor.skeleton : []) for (const campo of CAMPOS_BLOQUE) salida.push(bloque?.[campo]);
  return salida.map(texto => String(texto || '').trim());
}

// true si, de los textos que la traducción trae escritos (los de más de 12 caracteres, para no
// contar nombres propios ni cifras), son más los idénticos al castellano que los distintos.
export function esCopiaDelCastellano(base = {}, traduccion) {
  if (!traduccion || typeof traduccion !== 'object') return false;
  const original = textos(base), traducido = textos(traduccion);
  let iguales = 0, distintos = 0;
  for (let i = 0; i < traducido.length; i += 1) {
    const a = original[i] || '', b = traducido[i] || '';
    if (!b || Math.max(a.length, b.length) <= 12) continue;
    if (a === b) iguales += 1; else distintos += 1;
  }
  return iguales > 0 && iguales > distintos;
}

export function idiomasOfrecidos(declarados, ideas = {}) {
  const lista = (Array.isArray(declarados) && declarados.length ? declarados : ['es']).map(idioma => String(idioma || '').toLowerCase()).filter(Boolean);
  const validos = [...new Set(lista)].filter(idioma => idioma === 'es' || !esCopiaDelCastellano(ideas, ideas.translations?.[idioma]));
  return validos.length ? validos : ['es'];
}
