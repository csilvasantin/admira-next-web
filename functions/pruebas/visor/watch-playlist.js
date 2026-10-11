/* Fase A: playlist fija. El middleware conserva el acceso firmado de un dispositivo. */
import { origenPermitido } from './img.js';
export async function playlistWatch(fetchImpl) {
  const response = await fetchImpl('https://admira.tv/api/playlist?screen=virtual-frescaria', { redirect: 'follow' });
  if (!response.ok) { const error = new Error('playlist_unavailable'); error.upstreamStatus = response.status; throw error; }
  const data = await response.json();
  const items = (data.draft?.items || []).flatMap((item) => {
    if (!origenPermitido(item.asset) || !['image', 'video'].includes(item.assetType)) return [];
    const type = item.assetType;
    return [{ id: String(item.id), title: String(item.title || 'Contenido'), type,
      ...(type === 'video' && new URL(item.asset).pathname === '/stock/1790352875323-h4x25z/asset.mp4'
        ? { poster: '/pruebas/visor/media/b9178c7ea30f3a132f17-poster.jpg' } : {}),
      seconds: Math.max(2, Math.min(600, Number(item.seconds) || 10)),
      url: `/pruebas/visor/${type === 'video' ? 'vid' : 'watch-img'}?src=${encodeURIComponent(item.asset)}` }];
  });
  return { screen: 'virtual-frescaria', revision: data.draft?.rev || 0, items };
}
export async function onRequestGet() {
  try {
    return Response.json(await playlistWatch(fetch), { headers: { 'cache-control': 'private, no-store' } });
  } catch (error) {
    return Response.json({ error: 'playlist_unavailable', upstreamStatus: error.upstreamStatus || null }, { status: 502, headers: { 'cache-control': 'private, no-store' } });
  }
}
