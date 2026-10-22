/* Private development bridge on admira.biz; production admira.tv is untouched. */
export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (!['GET','HEAD'].includes(request.method) || !url.pathname.startsWith('/pruebas/visor/')) {
      return new Response('Admira Visor · acceso firmado requerido', {status:404});
    }
    const upstream = new URL(url.pathname + url.search, 'https://868b396d.admiranext.pages.dev');
    const response = await fetch(new Request(upstream, request), {redirect:'manual'});
    const headers = new Headers(response.headers);
    // The existing visor middleware supplies the device cookie and private cache policy.
    headers.set('x-admira-watch-version','v.11.10.2026.r1');
    return new Response(response.body,{status:response.status,headers});
  }
};
