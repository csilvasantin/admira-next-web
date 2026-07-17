import {listAccessEvents} from '../../_access.js';

function json(body, status = 200){
  return new Response(JSON.stringify(body), {status, headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
}

export async function onRequestGet(context){
  if (!context.env.PRESENTATION_IDEAS) return json({error:'Almacenamiento no configurado.'}, 503);
  const url = new URL(context.request.url);
  const days = Math.min(Math.max(Number(url.searchParams.get('days')) || 30, 1), 180);
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const client = String(url.searchParams.get('client') || '').toLowerCase().slice(0, 80);
  const type = String(url.searchParams.get('type') || '').slice(0, 40);
  const events = await listAccessEvents(context.env, {limit:1000, since, client, type});
  const identities = new Map();
  const clients = new Map();
  const cutoff24 = Date.now() - 86400000;
  let views = 0, downloads = 0, plays = 0, last24h = 0;
  for (const event of events) {
    if (event.visitorId || event.email) identities.set(event.visitorId || event.email, {name:event.name,email:event.email});
    if (event.type === 'page_view') views += 1;
    if (event.type === 'download') downloads += 1;
    if (event.type === 'media_play') plays += 1;
    if (Date.parse(event.timestamp) >= cutoff24) last24h += 1;
    const key = event.client || 'sin-cliente';
    const aggregate = clients.get(key) || {client:key,events:0,views:0,downloads:0,visitors:new Set(),lastAccess:''};
    aggregate.events += 1;
    if (event.type === 'page_view') aggregate.views += 1;
    if (event.type === 'download') aggregate.downloads += 1;
    if (event.visitorId || event.email) aggregate.visitors.add(event.visitorId || event.email);
    if (!aggregate.lastAccess || event.timestamp > aggregate.lastAccess) aggregate.lastAccess = event.timestamp;
    clients.set(key, aggregate);
  }
  const clientStats = [...clients.values()].map(item => ({...item, visitors:item.visitors.size})).sort((a,b)=>b.events-a.events);
  return json({
    generatedAt:new Date().toISOString(), days,
    summary:{events:events.length,views,downloads,plays,visitors:identities.size,last24h},
    clients:clientStats,
    events
  });
}
