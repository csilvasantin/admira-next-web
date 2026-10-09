// Dirección de un tramo de macro. Solo lleva el plan y el contexto: nunca una clave.
const HOGARES = {
  biz: 'https://www.admira.biz/',
  app: 'https://www.admira.app/retailer',
  store: 'https://www.admira.store/',
  studio: 'https://www.admira.studio/',
  tv: 'https://www.admira.tv/',
};
const GEMELOS = {
  biz: ['admira.biz', 'clearchannel.tv'],
  app: ['admira.app', 'yokup.com'],
  store: ['admira.store', 'xpaceos.com'],
  studio: ['admira.studio', 'pixeria.com'],
  tv: ['admira.tv'],
};
const PARAMS = ['ax_demo', 'ax_run', 'ax_i', 'ax_v', 'marca', 'project', 'circuit', 'lang'];

export function urlDePieza(plan, index, run, langForzado) {
  const item = plan?.items?.[index];
  if (!item) throw new Error('pieza');
  const site = String(item.ref || '').split('/')[0];
  let base = HOGARES[site] || 'https://www.admiranext.com/demo/';
  const subUrl = item.subdemo && item.subdemo.url;
  if (typeof subUrl === 'string') {
    try {
      const parsed = new URL(subUrl);
      const host = parsed.hostname.replace(/^www\./, '');
      if ((GEMELOS[site] || []).includes(host) && !parsed.username && !parsed.password) base = parsed.origin + parsed.pathname;
    } catch { /* el hogar del sitio */ }
  }
  const url = new URL(base);
  url.search = '';
  url.hash = '';
  url.username = '';
  url.password = '';
  const ctx = plan.context || {};
  const lang = langForzado === 'en' || langForzado === 'es' ? langForzado : (ctx.lang === 'en' ? 'en' : 'es');
  url.searchParams.set('ax_demo', 'macro:' + plan.id);
  url.searchParams.set('ax_run', String(run || 'run'));
  url.searchParams.set('ax_i', String(index));
  url.searchParams.set('ax_v', String(plan.version));
  for (const key of ['marca', 'project', 'circuit']) {
    if (typeof ctx[key] === 'string' && ctx[key] && ctx[key].length <= 80) url.searchParams.set(key, ctx[key]);
  }
  url.searchParams.set('lang', lang);
  for (const key of [...url.searchParams.keys()]) {
    if (!PARAMS.includes(key)) url.searchParams.delete(key);
  }
  return url.href;
}
